/**
 * DataSourceAdminService (wave-15, task 41c017f7) — admin CRUD + enable/disable
 * over the M3 data_source_connections store + AES-256-GCM credential management.
 *
 * ── CREDENTIAL NEVER LEAKS (P-4 LOAD-BEARING) ───────────────────────────────
 * The plaintext credential is encrypted BEFORE reaching the DB:
 *   encryptedCredentials = AES-256-GCM(plaintext) stored as 'v1:iv:tag:ct'
 *
 * Security invariants:
 *   1. Random IV per encryption (crypto.randomBytes(12)) — NEVER reused.
 *   2. GCM auth-tag stored AND verified on decrypt — tamper-evident.
 *   3. Key-id prefix on ciphertext ('v1') — reserves key rotation.
 *   4. READ path NEVER returns plaintext: hasCredential boolean instead.
 *   5. Plaintext REDACTED before ANY error is constructed or logged.
 *      A DrizzleError echoing INSERT params could carry the plaintext.
 *      A ZodError echoing the input body could carry the plaintext.
 *      Both are scrubbed here before re-throwing.
 *   6. Credential NEVER hashed into contentHash/payloadHash audit fields
 *      (a low-entropy key hash is brute-forceable).
 *   7. Audit rows record ACTION + non-secret metadata (source name, actor) ONLY.
 *
 * ── CONFIG TYPED-BOUNDARY (wave-16, task 2560fecc — P-4 Finding 2) ──────────
 *   8. config is validated against dataSourceConnectionConfigSchema BEFORE any
 *      DB write. Invalid config → 400 UNIFORM STATIC message (no value echo).
 *      The rejection message is a fixed string that NEVER includes the offending
 *      config value — mirroring the wave-15 B-6 M1 no-input-echo pattern.
 *   9. Config stays plaintext-by-contract for whitelisted fields only
 *      (fieldMapping / syncBatchSize / regionSlug). Secrets MUST use credential.
 *
 * MVP documented limitation (required by spec):
 *   Loss of CREDENTIALS_ENC_KEY = permanent loss of all stored credentials.
 *   Single-key = no rotation without re-encrypting all stored values.
 *   The 'v1' prefix reserves the rotation path for a future multi-key scheme.
 *
 * All mutations audited LAST-IN-TXN via AuditService.append (WORM).
 * Audit failure rolls back the mutation.
 *
 * RBAC: admin-only.
 * NO live connection-test (deferred per spec — enable = state only).
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  DataSourceConnectionAdminRecord,
  DataSourceConnectionToggleInput,
  DataSourceConnectionUpsertInput,
} from '@dealflow/shared';
import { dataSourceConnectionConfigSchema } from '@dealflow/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { dataSourceConnections } from '../../db/schema/sourcing';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
import { decryptCredential, encryptCredential } from './credential-crypto';

/** Deterministic SHA-256 hex over a canonical JSON object (credential-free). */
function hashJsonSafe(value: unknown): string {
  const sorted =
    typeof value === 'object' && value !== null
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort())
      : value;
  return createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

/**
 * Scrub a plaintext credential from an error message or object before
 * re-throwing. Returns a sanitized error object.
 *
 * This catches the DrizzleError-echoes-INSERT-params and ZodError-echoes-input
 * leak vectors identified in the P-4 security review.
 */
function scrubCredentialFromError(err: unknown, credential: string): Error {
  if (!credential) return err instanceof Error ? err : new Error(String(err));

  const message =
    err instanceof Error
      ? err.message.replace(new RegExp(escapeRegExp(credential), 'g'), '[REDACTED]')
      : String(err).replace(new RegExp(escapeRegExp(credential), 'g'), '[REDACTED]');

  const sanitized = new InternalServerErrorException(message);
  return sanitized;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Uniform static message for config validation failures (P-4 Finding 2).
 *
 * CRITICAL: This message MUST NOT echo any part of the offending config value.
 * It is a fixed string defined here so callers cannot accidentally interpolate
 * user-supplied data into it. Mirrors the wave-15 B-6 M1 "no input echo" pattern.
 */
const CONFIG_VALIDATION_ERROR =
  'config contains an unsupported or disallowed field; secrets must use the credential field';

/**
 * Validate input.config against the typed whitelist schema.
 * Throws a uniform static BadRequestException (NO value echo) on failure.
 *
 * Called BEFORE any DB write in createConnection and updateConnection so that
 * a secret-shaped or unknown-key config never reaches the database as plaintext.
 *
 * SECURITY CONTRACT:
 *   - The error message is the fixed CONFIG_VALIDATION_ERROR constant.
 *   - The ZodError (which may contain the offending value in .message/.issues)
 *     is intentionally discarded — only the fixed constant is surfaced.
 *   - Nothing about the config value is logged here (no console.error / logger call).
 */
function validateConfigOrThrow(config: unknown): void {
  if (config === undefined || config === null) return;
  const result = dataSourceConnectionConfigSchema.safeParse(config);
  if (!result.success) {
    // Discard result.error entirely — it may echo the offending value.
    throw new BadRequestException(CONFIG_VALIDATION_ERROR);
  }
}

/** Map a DB row to the shared read shape (NO credential included). */
function toAdminRecord(
  row: typeof dataSourceConnections.$inferSelect
): DataSourceConnectionAdminRecord {
  return {
    id: row.id,
    providerKey: row.providerKey,
    displayName: row.displayName,
    enabled: row.enabled,
    hasCredential: row.encryptedCredentials !== null,
    createdAt: row.createdAt,
    createdBy: row.createdBy ?? null,
  };
}

@Injectable()
export class DataSourceAdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  /**
   * GET /admin/integrations — list all connections.
   * Credential is never included in the response (hasCredential boolean only).
   */
  async listConnections(): Promise<DataSourceConnectionAdminRecord[]> {
    const rows = await this.db.select().from(dataSourceConnections);
    return rows.map(toAdminRecord);
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  /**
   * POST /admin/integrations — create a new data source connection.
   * If `input.credential` is provided, it is encrypted BEFORE DB write.
   * Audited LAST-IN-TXN.
   */
  async createConnection(
    input: DataSourceConnectionUpsertInput,
    actorUserId: string,
    actorRole: string
  ): Promise<DataSourceConnectionAdminRecord> {
    // Enforce typed config boundary BEFORE entering the transaction.
    // Throws uniform static 400 (no value echo) if config fails the whitelist schema.
    validateConfigOrThrow(input.config);

    const plainCredential = input.credential;

    return this.db.transaction(async (tx) => {
      let encryptedCredentials: string | null = null;

      if (plainCredential) {
        try {
          encryptedCredentials = encryptCredential(plainCredential);
        } catch (err) {
          // Fail-closed: encryption failure should not reveal the credential.
          throw new InternalServerErrorException('Credential encryption failed');
        }
      }

      let row: typeof dataSourceConnections.$inferSelect;
      try {
        const [inserted] = await tx
          .insert(dataSourceConnections)
          .values({
            providerKey: input.providerKey,
            displayName: input.displayName,
            config: (input.config as Record<string, unknown>) ?? {},
            enabled: true,
            encryptedCredentials,
            createdBy: actorUserId,
          })
          .returning();

        if (!inserted) throw new Error('Connection insert returned no row');
        row = inserted;
      } catch (err) {
        // REDACT the credential from any error that might echo the INSERT params.
        if (plainCredential) {
          throw scrubCredentialFromError(err, plainCredential);
        }
        throw err;
      }

      // Audit: action + non-secret metadata only (NO credential).
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'data-source-conn-upsert',
        resourceType: 'data_source_connection',
        resourceId: row.id,
        contentHash: hashJsonSafe({
          id: row.id,
          displayName: row.displayName,
          providerKey: row.providerKey,
        }),
        payloadHash: hashJsonSafe({
          op: 'create',
          displayName: row.displayName,
          providerKey: row.providerKey,
        }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toAdminRecord(row);
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  /**
   * PATCH /admin/integrations/:id — update an existing connection.
   * If `input.credential` is provided, it is re-encrypted and stored.
   * Omitting `input.credential` leaves the existing encrypted value unchanged.
   * Audited LAST-IN-TXN.
   */
  async updateConnection(
    id: string,
    input: DataSourceConnectionUpsertInput,
    actorUserId: string,
    actorRole: string
  ): Promise<DataSourceConnectionAdminRecord> {
    // Enforce typed config boundary BEFORE entering the transaction.
    // Throws uniform static 400 (no value echo) if config fails the whitelist schema.
    validateConfigOrThrow(input.config);

    const plainCredential = input.credential;

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(dataSourceConnections)
        .where(eq(dataSourceConnections.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Data source connection ${id} not found`);
      }

      const updateValues: Partial<typeof dataSourceConnections.$inferInsert> = {
        providerKey: input.providerKey,
        displayName: input.displayName,
      };

      if (input.config !== undefined) {
        updateValues.config = input.config as Record<string, unknown>;
      }

      if (plainCredential) {
        try {
          updateValues.encryptedCredentials = encryptCredential(plainCredential);
        } catch {
          throw new InternalServerErrorException('Credential encryption failed');
        }
      }

      let row: typeof dataSourceConnections.$inferSelect;
      try {
        const [updated] = await tx
          .update(dataSourceConnections)
          .set(updateValues)
          .where(eq(dataSourceConnections.id, id))
          .returning();

        if (!updated) throw new Error('Connection update returned no row');
        row = updated;
      } catch (err) {
        if (plainCredential) {
          throw scrubCredentialFromError(err, plainCredential);
        }
        throw err;
      }

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'data-source-conn-upsert',
        resourceType: 'data_source_connection',
        resourceId: row.id,
        contentHash: hashJsonSafe({
          id: row.id,
          displayName: row.displayName,
          providerKey: row.providerKey,
        }),
        payloadHash: hashJsonSafe({
          op: 'update',
          displayName: row.displayName,
          providerKey: row.providerKey,
        }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toAdminRecord(row);
    });
  }

  // ---------------------------------------------------------------------------
  // Toggle enable/disable (NO live connection-test)
  // ---------------------------------------------------------------------------

  /**
   * PATCH /admin/integrations/:id/toggle — enable or disable a connection.
   * enable/disable = state only, NO live connection-test (deferred per spec).
   * Audited LAST-IN-TXN.
   */
  async toggleConnection(
    id: string,
    input: DataSourceConnectionToggleInput,
    actorUserId: string,
    actorRole: string
  ): Promise<DataSourceConnectionAdminRecord> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(dataSourceConnections)
        .where(eq(dataSourceConnections.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Data source connection ${id} not found`);
      }

      const [updated] = await tx
        .update(dataSourceConnections)
        .set({ enabled: input.enabled })
        .where(eq(dataSourceConnections.id, id))
        .returning();

      if (!updated) throw new Error('Connection toggle update returned no row');

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'data-source-conn-toggle',
        resourceType: 'data_source_connection',
        resourceId: id,
        contentHash: hashJsonSafe({
          id,
          displayName: updated.displayName,
          enabled: updated.enabled,
        }),
        payloadHash: hashJsonSafe({ op: 'toggle', id, enabled: input.enabled }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toAdminRecord(updated);
    });
  }

  // ---------------------------------------------------------------------------
  // Decrypt (internal — used by the ETL adapter layer, never in REST response)
  // ---------------------------------------------------------------------------

  /**
   * Internal use only — decrypt a stored credential for the ETL adapter.
   * This method MUST NOT be exposed via any HTTP endpoint.
   * The caller must ensure the plaintext is used immediately and not logged.
   */
  decryptStoredCredential(encryptedValue: string): string {
    return decryptCredential(encryptedValue);
  }
}
