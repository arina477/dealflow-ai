/**
 * AuditKeyring (wave-4, task a8b2b5a2) — HMAC key resolution + boot fail-fast.
 *
 * ── Boot fail-fast (security invariant) ────────────────────────────────────
 * AUDIT_LOG_HMAC_KEY MUST be present and non-empty. If it is missing/empty the
 * keyring THROWS at construction — the AuditModule cannot instantiate, so the
 * API refuses to boot. This is the SuperTokens `assertNoDatabaseAlias` pattern:
 * a security-critical env invariant asserted before the app serves any request.
 * The guarantee: it is impossible to write an UNSIGNED audit entry, because the
 * append service constructor-depends on the keyring, which cannot exist without
 * a key.
 *
 * ── Key isolation (security invariant) ─────────────────────────────────────
 * The key is read from the environment ONLY. It is NEVER written to the DB and
 * NEVER logged. This class holds it in a private field; no method returns it in
 * a loggable form and no `toString`/`toJSON` exposes it. The append service and
 * verifier obtain the key via `keyFor(chainVersion)` and pass it straight into
 * `node:crypto` — the plaintext never reaches a log line or a DB column.
 *
 * ── chain_version → key map (rotation-ready) ───────────────────────────────
 * `chain_version` is a monotonic integer that pins BOTH the HMAC key version
 * AND the canonical-serialization format (see audit.hash.ts). Today only v1
 * exists (= AUDIT_LOG_HMAC_KEY_VERSION, default 1). The map shape lets a future
 * rotation add v2 (a second env var, e.g. AUDIT_LOG_HMAC_KEY_V2) WITHOUT any
 * change to the verifier's key-selection logic: the verifier already asks the
 * keyring `keyFor(entry.chainVersion)` per entry, so mixed-version chains verify
 * with the correct historical key.
 */

import { parseEnv } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/**
 * The current chain version. New appends stamp this into `chain_version`.
 * A future serialization-format change OR key rotation MUST bump this (and add
 * the corresponding key to the map below) — the two concerns are versioned
 * together by a single monotonic integer.
 */
export const CURRENT_CHAIN_VERSION = 1;

const keyringEnvSchema = z.object({
  // Non-empty is the load-bearing assertion — an empty key would silently
  // produce forgeable HMACs. min(1) makes an empty string a boot failure.
  AUDIT_LOG_HMAC_KEY: z.string().min(1, 'AUDIT_LOG_HMAC_KEY must be set and non-empty'),
  // Coerced: env vars are strings; default 1 mirrors .env.example.
  AUDIT_LOG_HMAC_KEY_VERSION: z.coerce.number().int().positive().default(1),
});

export type AuditKeyringEnv = z.infer<typeof keyringEnvSchema>;

@Injectable()
export class AuditKeyring {
  /** version → key. Private; never enumerated in logs. */
  readonly #keysByVersion: ReadonlyMap<number, string>;

  /** The version stamped onto NEW appends. */
  readonly #currentVersion: number;

  /**
   * @param source env source (defaults to process.env). Injectable seam for
   *               tests: a test can pass `{}` to prove the boot fail-fast, or a
   *               known key to prove golden-vector determinism.
   */
  constructor(source: Record<string, string | undefined> = process.env) {
    // parseEnv throws (fail-fast) if AUDIT_LOG_HMAC_KEY is missing/empty.
    const env = parseEnv(keyringEnvSchema, source);

    // The env's declared version pins the CURRENT key. When a rotation lands,
    // extend this map (v1 stays mapped to the retired key for verification of
    // historical entries; v2 becomes current) — no verifier change required.
    this.#currentVersion = env.AUDIT_LOG_HMAC_KEY_VERSION;
    this.#keysByVersion = new Map([[env.AUDIT_LOG_HMAC_KEY_VERSION, env.AUDIT_LOG_HMAC_KEY]]);
  }

  /** The chain_version stamped onto new appends (the current key version). */
  get currentVersion(): number {
    return this.#currentVersion;
  }

  /**
   * Resolve the HMAC key for a given chain_version. Used by BOTH the append
   * service (with `currentVersion`) and the verifier (with each entry's stored
   * `chain_version`, so a rotated chain verifies with the correct historical
   * key). Throws if the version is unknown — an entry stamped with a version the
   * running process has no key for is an unverifiable/misconfigured state, not a
   * silent pass.
   */
  keyFor(chainVersion: number): string {
    const key = this.#keysByVersion.get(chainVersion);
    if (key === undefined) {
      throw new Error(
        `AuditKeyring: no HMAC key configured for chain_version=${chainVersion}. ` +
          'A rotated/older entry references a key version this process does not hold — ' +
          'add the corresponding AUDIT_LOG_HMAC_KEY_V<n> to the environment.'
      );
    }
    return key;
  }
}
