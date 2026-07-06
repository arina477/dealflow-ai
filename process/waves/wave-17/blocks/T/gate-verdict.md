# Wave 17 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, Phase 1)
**Reviewed against:** process/waves/wave-17/blocks/T/review-artifacts.md + findings-aggregate.md
**Attempt:** 1  (first gate)
**Wave:** M8 pilot-partner data-isolation (workspaces + FORCE RLS ×27 + request-scoped GUC + cross-tenant negative-read proof) — SECURITY-SCOPE-TIGHTENED
**Deployed:** LIVE @ 591b3f8 (main HEAD; dealflow_app runtime)

## Verdict
APPROVED

## Rationale

The single wave-defining question — *is isolation proven ENFORCED as a non-superuser role, not vacuously true under a BYPASSRLS superuser* — is answered YES on both halves (CI test-time AND prod runtime), and I verified it against shipped source, not prose. **CI non-vacuity:** the `withWorkspace()` helper in both `workspace-isolation.e2e-spec.ts` (line 150) and `invite-signup-rls.e2e-spec.ts` (lines 116/339/493) issues `SET ROLE dealflow_app` *before* every isolation assertion; migration `0016_dealflow_app_role.sql` creates that role `NOSUPERUSER NOBYPASSRLS` (as GRANTEE, not owner), so FORCE ROW LEVEL SECURITY genuinely applies for those queries — the exact vacuity trap the B-6 `/review` caught is closed. Non-vacuity is doubly guarded: ISO-2 is a positive control (`toBeGreaterThan(0)` over genuinely-seeded data), so the cross-tenant `toHaveLength(0)` assertions (ISO-1/3) cannot pass merely because everything returns empty; ISO-4 SET-ROLEs and asserts 0 rows with the GUC unset (fail-closed). Seeds deliberately run as superuser, assertions as dealflow_app — correct privilege separation. **Prod runtime non-superuser:** `assertNonSuperuserConnection()` (db/index.ts:51) queries `is_superuser`/`rolbypassrls` and throws → `process.exit(1)` (main.ts:32) on either; C-2's live `/health` 200 at the exact deployed SHA 591b3f8 is therefore positive proof the `[RLS-GUARD]` passed and the runtime is dealflow_app (a superuser boot would fail-closed and /health would be down), independently confirmed at the DB (`is_superuser=off`, `bypassrls=false`; no-GUC read → 0 rows). The other four invariants are non-hollow and fault-killing: **GUC** (GUC-1/2/3 drive the shipped interceptor/repository — not a reimplementation — asserting `set_config` present + `^SET app.workspace_id` absent + fail-closed-on-throw; the B-6 reviewer injected the SET-form regression and confirmed the tests go red); **RBAC CRITICAL-1b** (guard resolves role via the RLS-exempt path or regresses to 403-for-all — fault-killing — live-confirmed 200-not-403 at C-2); **audit + populated-migration** (AMP-4 recomputes the HMAC per-row proving `workspace_id` is excluded from the preimage, the WORM-safe DISABLE/UPDATE/ENABLE-TRIGGER backfill, and C-2 `verifyChain ok:true, entriesChecked:328` over the real prod chain with 0 breaks); **deny-by-default** (NULLIF empty-string cast, migration 0017, backfill-before-NOT-NULL). CI run 28824525244 is green on the EXACT deployed SHA 591b3f8 (5/5 jobs; intermediate 58c1498/dfcda74 were RED — verified per-SHA, no Ghost Green), with ISO/INV/GUC/RBAC/AMP EXECUTED-and-passed (not skipped). This wave carried the most scrutiny of any (P-4 security-auditor 4 defects; B-6 head-builder REWORK→APPROVED across the superuser-bypass-makes-tests-vacuous crux; 3 /review cycles; C-1 caught a real RLS empty-string defect + the populated-DB WORM defect; C-2 switched the runtime to the non-superuser role live). The 2 open findings are both INFO — connection-split documentation and dealflow_app-password-is-Railway-env-only — neither is a defect nor a coverage gap; the connection split is the correct design (owner for preDeploy DDL, non-superuser for runtime) and is itself the enforcement mechanism the [RLS-GUARD] backstops. No coverage theater, no tautological assertions, no layout-only false-PASS (no UI surface this wave), no silently-skipped suite, no residual vacuity. The isolation is genuinely enforced.

## Rework instructions  (only if REWORK)
N/A — APPROVED.

## Escalation  (only if ESCALATE)
N/A — APPROVED.

## Phase 2 (journey regen) disposition
`journey_regen_skipped: true` — backend/RLS/infra-only wave: `wave_type` = [backend, RLS/multi-tenancy, auth] (no `ui`/`heavy`); D-block did not fire (`design_gap_flag: false`); no frontend surface touched (T-6 layout correctly skipped, no UI). Per T-9 Action 2 skip rule, the previous wave's `command-center/artifacts/user-journey-map.md` remains canonical (isolation is transparent — no new screens/routes). Scenario smoke runs unconditionally only if `user-scenarios/` exists.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
