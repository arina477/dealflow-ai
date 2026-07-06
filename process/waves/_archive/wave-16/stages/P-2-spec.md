# Wave 16 — P-2 Spec (pointer)
**Source of truth:** the spec contract YAML head + prose lives in the primary/seed task's `tasks.description` (id 904a3c25-ab46-4050-8122-d998e5a6f2a1). This file is a convenience copy for P-3/P-4.
**wave_type:** multi-spec (6 blocks) | **claimed_task_ids:** [904a3c25, 6f1a96da, c54db02d, 042cf4e6, 2560fecc, 8bb0a22f] | **design_gap_flag:** false

## Acceptance criteria (summary per block)
1. **904a3c25 — compliance-default cascade (mvp-critical spine):** mandate inherits firm workspace_settings default for an unset compliance field; explicit value wins; no retroactive mutation of existing mandates; **mandatory e2e mandate-inherits-firm-default proof** (set default→create omitting field→row carries default; change default→existing mandate unchanged).
2. **6f1a96da — admin nav:** admin-only nav section links /admin/{users,settings,integrations,activity}; advisor doesn't see it; no orphaned page.
3. **c54db02d — invite dedup:** already-registered active user → 409; already-pending live invite → 409/idempotent (no 2nd row); fresh → one invite; expired/consumed → new allowed; concurrent-same-email → exactly one.
4. **042cf4e6 — reactivate + prod-cleanup:** deactivated_at→NULL, admin-only, audited under NEW additive action user-reactivate; already-active→400; **NON-DEFERRABLE prod-cleanup** (restore advisor1@example.com + WORM-safe neutralize 3 KAREN-V1-SENTINEL records) executed at C-2.
5. **2560fecc — config typed-boundary:** config is typed/whitelisted (NOT a runtime scanner); secret-shaped value→400 (→ credential field); legit config unchanged; existing connections unbroken; no secret logged; any typing migration additive+journaled.
6. **8bb0a22f — admin activity view:** read-only /admin/activity over the EXISTING immutable audit log (6 admin actions + user-reactivate), firm-scoped, newest-first, actor/target/action/timestamp; admin-only (advisor 403/anon 401); basic filter; empty state; opening writes NOTHING to the log (reuse recordkeeping reader).

## Load-bearing invariants
cascade-inherits-firm-default (e2e proof) | invite-dedup-both-cases | reactivate-audited-additive-action | config-typed-boundary | admin-activity-reads-immutable-log-only (no write). No schema change except possible additive+journaled config-typing migration. sending-domain-verify #141-deferred.

## P-4 security-rework (folded into the authoritative spec)
- **c54db02d invite:** advisory-lock (pg_advisory_xact_lock on email-hash) is the ONLY race-safe guard; NO partial index (would break expired→reinvite); expired/consumed→new-allowed; concurrent→exactly-one (real-service test).
- **2560fecc config:** 400 is uniform-static NO-echo (scrubCredentialFromError covers input.credential NOT input.config); B-1 enumerates per-field non-secret whitelist (no free-text slot).
- **8bb0a22f/904a3c25:** "firm-scoped" DROPPED (single-tenant); admin-activity asserts admin-only + read-only-immutable (0 audit rows written) + no-secret/PII-in-metadata.
