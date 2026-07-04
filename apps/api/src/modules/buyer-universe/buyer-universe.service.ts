/**
 * BuyerUniverseService — orchestration for the buyer-universe spine.
 *
 * Responsibilities:
 *   1. assembleAsActor   — assemble a buyer universe for a mandate from M3 companies.
 *   2. filterAsActor     — apply mandate's buyer criteria to include/exclude candidates.
 *   3. enrichAsActor     — attach M3 contacts to included candidates (read/view join).
 *   4. getGaps           — flag included candidates with no M3 contacts / missing data.
 *   5. submitAsActor     — mark status=submitted (ready-to-rank for M5). Guard: must
 *                          be assembled+filtered (400 if empty/draft).
 *   6. getById           — returns BuyerUniverseDetail (404 if absent).
 *   7. listByMandate     — returns all universes for a mandate.
 *   8. patchCandidateAsActor — PATCH a single candidate membership (include/exclude).
 *
 * ── Actor identity (wave-5 lesson) ─────────────────────────────────────────
 * ALL users.id FK columns are populated from the APP users.id — NEVER the
 * raw SuperTokens user id from the session. The service translates via
 * AuthRepository.getUserWithRole(supertokensUserId) before any DB write.
 *
 * ── One-txn atomicity ───────────────────────────────────────────────────────
 * assembleAsActor opens ONE transaction: reads mandate + criteria, SELECTs
 * M3 companies, UPSERTs buyer_universe, INSERTs candidates (onConflictDoNothing),
 * audits LAST-IN-TXN.
 * filterAsActor opens ONE transaction: reads candidates, applies criteria,
 * bulk-updates membership, updates status→filtered, audits LAST-IN-TXN.
 *
 * ── Idempotent re-assemble ───────────────────────────────────────────────────
 * If a buyer_universe already exists for the mandate, assembleAsActor reuses
 * it (UPSERT at service level). New companies are inserted with
 * onConflictDoNothing on the composite unique (buyer_universe_id, company_id),
 * so re-assemble never creates duplicate candidates.
 *
 * ── M4/M5 BOUNDARY (CRITICAL) ──────────────────────────────────────────────
 * NO score / rank / fit / rationale / LLM anywhere in this service.
 * assemble + filter + enrich + flag + submit ONLY.
 * The head-builder polices this at B-6.
 *
 * ── Audit (last-in-txn) ────────────────────────────────────────────────────
 * AuditService.append is called LAST in every mutating transaction, after all
 * business writes. Audit failure rolls back the whole transaction.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  BuyerUniverseAssembleInput,
  BuyerUniverseCandidatePatchInput,
  BuyerUniverseDetail,
  BuyerUniverseGapsResponse,
  EnrichedCandidate,
} from '@dealflow/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { companies } from '../../db/schema/sourcing';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type {
  BuyerUniverseCandidateRow,
  BuyerUniverseRow,
  ContactRow,
  Tx,
} from './buyer-universe.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { BuyerUniverseRepository } from './buyer-universe.repository';

@Injectable()
export class BuyerUniverseService {
  constructor(
    private readonly repository: BuyerUniverseRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // assembleAsActor
  // ---------------------------------------------------------------------------

  /**
   * assembleAsActor — assemble a buyer universe for a mandate.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Read mandate + mandateBuyerCriteria (M4 — read-only).
   *   3. SELECT all active M3 companies as prospective buyers.
   *   4. UPSERT buyer_universe (one per mandate — reuse if exists).
   *   5. INSERT buyer_universe_candidates with onConflictDoNothing (idempotent).
   *   6. AUDIT buyer-universe-assemble LAST-IN-TXN.
   */
  async assembleAsActor(
    input: BuyerUniverseAssembleInput,
    supertokensUserId: string
  ): Promise<BuyerUniverseRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read mandate (validate it exists — M4 read-only).
      const mandate = await this.repository.findMandateByIdInTx(tx, input.mandateId);
      if (!mandate) {
        throw new NotFoundException(`Mandate ${input.mandateId} not found`);
      }

      // 3. SELECT active M3 companies as prospective buyers.
      const allCompanies = await this.repository.listActiveCompaniesInTx(tx);

      // 4. UPSERT buyer_universe — reuse existing if one exists for this mandate.
      const existing = await this.repository.findBuyerUniverseByMandateIdInTx(tx, input.mandateId);
      let universe: BuyerUniverseRow;
      if (existing) {
        universe = existing;
      } else {
        universe = await this.repository.insertBuyerUniverse(tx, {
          mandateId: input.mandateId,
          createdBy: appUserId,
        });
      }

      // 5. INSERT candidates with onConflictDoNothing (idempotent re-assemble).
      const candidateInputs = allCompanies.map((company) => ({
        buyerUniverseId: universe.id,
        companyId: company.id,
        provenance: 'assembled from sourcing',
      }));
      await this.repository.insertCandidatesBatch(tx, candidateInputs);

      // 6. AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId: universe.id,
        mandateId: input.mandateId,
        companiesCount: allCompanies.length,
        actorRole,
        reused: !!existing,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-assemble',
        resourceType: 'buyer_universe',
        resourceId: universe.id,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return universe;
    });
  }

  // ---------------------------------------------------------------------------
  // filterAsActor
  // ---------------------------------------------------------------------------

  /**
   * filterAsActor — apply the mandate's mandateBuyerCriteria to include/exclude
   * each candidate. Updates membership_status + provenance per candidate.
   * Updates universe status → 'filtered'.
   *
   * Steps (ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Read universe + validate exists.
   *   3. Read the mandate's mandateBuyerCriteria (M4 — read-only).
   *   4. List all candidates in the universe.
   *   5. Apply each criterion dimension — include if matches (or criterion is null),
   *      exclude if any dimension mismatches.
   *   6. Bulk-update candidate membership.
   *   7. Update universe status → 'filtered'.
   *   8. AUDIT LAST-IN-TXN.
   */
  async filterAsActor(universeId: string, supertokensUserId: string): Promise<BuyerUniverseRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. Read mandate's buyer criteria (M4 — read-only).
      const criteria = await this.repository.findBuyerCriteriaByMandateIdInTx(
        tx,
        universe.mandateId
      );

      // 4. List candidates.
      const candidates = await this.repository.listCandidatesByUniverseIdInTx(tx, universeId);

      // 5. Apply filter dimensions. Read M3 companies for each candidate to
      //    compare sector/status against criteria.
      //    Criterion is null → no restriction (pass for that dimension).
      const companyIds = candidates.map((c) => c.companyId);
      const companyMap = new Map<string, { id: string; sector: string | null; name: string }>();

      if (companyIds.length > 0) {
        const companyRows = await tx
          .select()
          .from(companies)
          .where(inArray(companies.id, companyIds));
        for (const c of companyRows) {
          companyMap.set(c.id, { id: c.id, sector: c.sector ?? null, name: c.name });
        }
      }

      const updates: Array<{
        id: string;
        membershipStatus: 'included' | 'excluded';
        provenance: string;
      }> = [];

      for (const candidate of candidates) {
        const company = companyMap.get(candidate.companyId);
        const exclusionReasons: string[] = [];

        if (criteria) {
          // Industry dimension: criteria.industry is non-null → company must have matching sector
          if (criteria.industry && company?.sector) {
            const normCriterion = criteria.industry.toLowerCase();
            const normSector = company.sector.toLowerCase();
            if (!normSector.includes(normCriterion) && !normCriterion.includes(normSector)) {
              exclusionReasons.push(
                `industry mismatch: expected "${criteria.industry}", got "${company.sector}"`
              );
            }
          }
          // Note: geo and sizeBand are not columns on companies; deal_type is on mandates.
          // These criteria dimensions require M3 enrichment beyond what's available at filter time.
          // We filter strictly on the dimensions where data is available (sector = industry).
        }

        if (exclusionReasons.length > 0) {
          updates.push({
            id: candidate.id,
            membershipStatus: 'excluded',
            provenance: `excluded: ${exclusionReasons.join('; ')}`,
          });
        } else {
          updates.push({
            id: candidate.id,
            membershipStatus: 'included',
            provenance: criteria
              ? 'included: passed buyer criteria filter'
              : 'included: no filter criteria defined',
          });
        }
      }

      // 6. Bulk-update candidate membership.
      await this.repository.batchUpdateCandidateMembership(tx, updates);

      // 7. Update universe status → 'filtered'.
      const updatedUniverse = await this.repository.updateBuyerUniverseStatus(
        tx,
        universeId,
        'filtered'
      );

      // 8. AUDIT LAST-IN-TXN.
      const includedCount = updates.filter((u) => u.membershipStatus === 'included').length;
      const excludedCount = updates.filter((u) => u.membershipStatus === 'excluded').length;
      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        includedCount,
        excludedCount,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-filter',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return updatedUniverse;
    });
  }

  // ---------------------------------------------------------------------------
  // enrichAsActor
  // ---------------------------------------------------------------------------

  /**
   * enrichAsActor — attach M3 contacts to included candidates.
   *
   * No new vendor, no writes to companies/contacts. Contacts are read from
   * the M3 contacts table and attached to included candidates. The enriched
   * candidates are returned; this is primarily a view/join operation.
   *
   * Steps (ONE tx for audit atomicity):
   *   1. Translate ST id → app users.id.
   *   2. Read universe.
   *   3. List included candidates.
   *   4. Read M3 contacts for included companies.
   *   5. AUDIT LAST-IN-TXN.
   *   6. Return enriched candidates (contacts attached).
   */
  async enrichAsActor(
    universeId: string,
    supertokensUserId: string
  ): Promise<{ universeId: string; enrichedCandidates: EnrichedCandidate[] }> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. List included candidates.
      const includedCandidates =
        await this.repository.listIncludedCandidatesByUniverseId(universeId);

      // 4. Read M3 contacts for included companies (batch by company id).
      const companyIds = includedCandidates.map((c) => c.companyId);
      const contactRows = await this.repository.findContactsByCompanyIds(companyIds);

      // Build company → contacts map.
      const contactsByCompany = new Map<string, ContactRow[]>();
      for (const contact of contactRows) {
        const existing = contactsByCompany.get(contact.companyId) ?? [];
        existing.push(contact);
        contactsByCompany.set(contact.companyId, existing);
      }

      // 5. AUDIT LAST-IN-TXN.
      const enrichedCount = includedCandidates.filter(
        (c) => (contactsByCompany.get(c.companyId) ?? []).length > 0
      ).length;

      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        includedCandidates: includedCandidates.length,
        enrichedWithContacts: enrichedCount,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-enrich',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // 6. Build enriched candidates response.
      const enrichedCandidates: EnrichedCandidate[] = includedCandidates.map((candidate) => ({
        id: candidate.id,
        buyerUniverseId: candidate.buyerUniverseId,
        companyId: candidate.companyId,
        membershipStatus: candidate.membershipStatus as 'candidate' | 'included' | 'excluded',
        provenance: candidate.provenance ?? null,
        createdAt: candidate.createdAt,
        contacts: (contactsByCompany.get(candidate.companyId) ?? []).map((c) => ({
          id: c.id,
          companyId: c.companyId,
          name: c.name ?? null,
          email: c.email ?? null,
          normalizedEmail: c.normalizedEmail ?? null,
          title: c.title ?? null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt ?? null,
        })),
      }));

      return { universeId, enrichedCandidates };
    });
  }

  // ---------------------------------------------------------------------------
  // getGaps
  // ---------------------------------------------------------------------------

  /**
   * getGaps — returns included candidates with no M3 contacts or all-null emails.
   * These are "gap" candidates that may need additional data sourcing before M5.
   */
  async getGaps(universeId: string): Promise<BuyerUniverseGapsResponse> {
    const universe = await this.repository.findBuyerUniverseById(universeId);
    if (!universe) {
      throw new NotFoundException(`Buyer universe ${universeId} not found`);
    }

    const includedCandidates = await this.repository.listIncludedCandidatesByUniverseId(universeId);
    const companyIds = includedCandidates.map((c) => c.companyId);
    const contactRows = await this.repository.findContactsByCompanyIds(companyIds);

    // Build company → contacts map.
    const contactsByCompany = new Map<string, ContactRow[]>();
    for (const contact of contactRows) {
      const existing = contactsByCompany.get(contact.companyId) ?? [];
      existing.push(contact);
      contactsByCompany.set(contact.companyId, existing);
    }

    const gaps = includedCandidates
      .map((candidate) => {
        const contacts = contactsByCompany.get(candidate.companyId) ?? [];
        if (contacts.length === 0) {
          return {
            candidateId: candidate.id,
            companyId: candidate.companyId,
            reason: 'no contacts found in M3 sourcing data',
          };
        }
        // All contacts have null email → data gap
        const allEmailsNull = contacts.every((c) => !c.email && !c.normalizedEmail);
        if (allEmailsNull) {
          return {
            candidateId: candidate.id,
            companyId: candidate.companyId,
            reason: `${contacts.length} contact(s) found but all have missing email addresses`,
          };
        }
        return null;
      })
      .filter((g): g is { candidateId: string; companyId: string; reason: string } => g !== null);

    return { universeId, gaps };
  }

  // ---------------------------------------------------------------------------
  // submitAsActor
  // ---------------------------------------------------------------------------

  /**
   * submitAsActor — marks the universe status → 'submitted' (ready-to-rank for M5).
   *
   * Guards:
   *   - Universe must exist.
   *   - Universe must not be in 'draft' status with zero candidates (guard empty→400).
   *   - Universe must have been through filter (status=filtered) OR have candidates.
   *
   * Steps (ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Read universe + validate.
   *   3. Guard: must have at least some included candidates.
   *   4. Update status → 'submitted'.
   *   5. AUDIT LAST-IN-TXN.
   */
  async submitAsActor(universeId: string, supertokensUserId: string): Promise<BuyerUniverseRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. Guard: must be assembled + filtered (not draft with zero candidates).
      const totalCount = await this.repository.countCandidatesByUniverseId(universeId);
      if (totalCount === 0 || universe.status === 'draft') {
        throw new BadRequestException(
          `Buyer universe ${universeId} cannot be submitted: ` +
            (totalCount === 0
              ? 'no candidates assembled yet (run assemble first)'
              : 'universe is in draft status (run filter first)')
        );
      }

      // 4. Update status → 'submitted'.
      const updatedUniverse = await this.repository.updateBuyerUniverseStatus(
        tx,
        universeId,
        'submitted'
      );

      // 5. AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        previousStatus: universe.status,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-submit',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return updatedUniverse;
    });
  }

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  /**
   * getById — returns a BuyerUniverseDetail (universe + enriched candidates).
   * Throws NotFoundException (404) if the universe is not found.
   */
  async getById(universeId: string): Promise<BuyerUniverseDetail> {
    const universe = await this.repository.findBuyerUniverseById(universeId);
    if (!universe) {
      throw new NotFoundException(`Buyer universe ${universeId} not found`);
    }

    const candidates = await this.repository.listCandidatesByUniverseId(universeId);
    const companyIds = candidates.map((c) => c.companyId);
    const contactRows = await this.repository.findContactsByCompanyIds(companyIds);

    const contactsByCompany = new Map<string, ContactRow[]>();
    for (const contact of contactRows) {
      const existing = contactsByCompany.get(contact.companyId) ?? [];
      existing.push(contact);
      contactsByCompany.set(contact.companyId, existing);
    }

    const enrichedCandidates: EnrichedCandidate[] = candidates.map((candidate) => ({
      id: candidate.id,
      buyerUniverseId: candidate.buyerUniverseId,
      companyId: candidate.companyId,
      membershipStatus: candidate.membershipStatus as 'candidate' | 'included' | 'excluded',
      provenance: candidate.provenance ?? null,
      createdAt: candidate.createdAt,
      contacts: (contactsByCompany.get(candidate.companyId) ?? []).map((c) => ({
        id: c.id,
        companyId: c.companyId,
        name: c.name ?? null,
        email: c.email ?? null,
        normalizedEmail: c.normalizedEmail ?? null,
        title: c.title ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? null,
      })),
    }));

    return {
      universe: {
        id: universe.id,
        mandateId: universe.mandateId,
        createdBy: universe.createdBy,
        status: universe.status,
        createdAt: universe.createdAt,
        updatedAt: universe.updatedAt ?? null,
      },
      candidates: enrichedCandidates,
    };
  }

  // ---------------------------------------------------------------------------
  // listByMandate
  // ---------------------------------------------------------------------------

  /**
   * listByMandate — returns all buyer universes for a given mandate.
   */
  async listByMandate(mandateId: string): Promise<{ universes: BuyerUniverseRow[] }> {
    const universes = await this.repository.listBuyerUniversesByMandateId(mandateId);
    return { universes };
  }

  // ---------------------------------------------------------------------------
  // patchCandidateAsActor
  // ---------------------------------------------------------------------------

  /**
   * patchCandidateAsActor — PATCH a single candidate's membership_status and/or provenance.
   * Audited in-txn via AuditService.append.
   *
   * @param universeId   — the buyer_universe UUID (for validation)
   * @param candidateId  — the buyer_universe_candidates UUID to update
   * @param input        — { membershipStatus?, provenance? }
   * @param supertokensUserId — raw ST id (translated to app users.id)
   */
  async patchCandidateAsActor(
    universeId: string,
    candidateId: string,
    input: BuyerUniverseCandidatePatchInput,
    supertokensUserId: string
  ): Promise<BuyerUniverseCandidateRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Validate universe exists.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // Update the candidate. exactOptionalPropertyTypes: use conditional spread so
      // no key is present with value `undefined`.
      const updated = await this.repository.updateCandidateMembership(tx, candidateId, {
        ...(input.membershipStatus !== undefined && { membershipStatus: input.membershipStatus }),
        ...(input.provenance !== undefined && { provenance: input.provenance }),
      });

      // AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId,
        candidateId,
        membershipStatus: updated.membershipStatus,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        // Reuse buyer-universe-filter action for individual candidate patches.
        action: 'buyer-universe-filter',
        resourceType: 'buyer_universe_candidate',
        resourceId: candidateId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return updated;
    });
  }
}
