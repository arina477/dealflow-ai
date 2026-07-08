# V-1 Karen — wave-28 M10 RETENTION policy — REALITY VERDICT

**VERDICT: APPROVE**
**Findings: 0 blocking / 0 non-blocking.**
**Independently confirmed prod /health @775cd67: YES.**

Deployed state under test: LIVE @775cd67 (api + web); migration 0020 applied to prod;
RLS-config-isolation + WORM-preservation proven by RET-ISO/RET-WORM (20 tests as
`dealflow_app` in CI on this hash).

Note on tree state: HEAD/main is at `6ea1539` (one commit past `775cd67`). That commit is
the T-block deliverables (`[skip ci]`, test artefacts only). Every code deliverable below was
verified to exist **at `775cd67`** via `git cat-file -e 775cd67:<path>` — not merely on the
working tree.

---

## 1. Files REAL @775cd67 — all present (git cat-file verified)

| File | @775cd67 |
|---|---|
| `apps/api/src/db/migrations/0020_retention_policy.sql` | OK |
| `apps/api/src/db/schema/retention-policy.ts` | OK |
| `packages/shared/src/retention.ts` | OK |
| `apps/api/src/modules/retention-policy/{service,controller,repository,module}.ts` | OK |
| `apps/api/test/retention-policy-isolation.e2e-spec.ts` | OK |
| `apps/web/app/(app)/compliance/retention/{page.tsx,page.test.tsx,_components/RetentionPolicyForm.tsx}` | OK |

## 2. RLS-on-new-table (isolation crux) — ALL PRESENT in migration 0020

Grep of `0020_retention_policy.sql` confirms every load-bearing clause:
- `ALTER TABLE "workspace_retention_policy" ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE "workspace_retention_policy" FORCE ROW LEVEL SECURITY;` (FORCE present — the
  0014/0016 owner-bypass false-green trap is closed).
- `CREATE POLICY "workspace_isolation" ... USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)`
  — USING-only (WITH CHECK auto-derived), NULLIF fail-closed / RESET-safe (0017 shape).
- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."workspace_retention_policy" TO dealflow_app;`
  — explicit per-table grant (no 42501 at runtime; no wildcard).

None missing → no cross-firm config leak, no runtime permission-denied.

## 3. WORM-preservation — CONFIRMED

- **Service** (`retention-policy.service.ts`): config change on value-change calls
  `AuditService.appendStandalone({ action: 'retention.policy.updated', ... })` — a normal HMAC
  append. NO delete/mutate/truncate/purge against `audit_log_entries`. Idempotent PUT (no value
  change) skips the audit append (avoids no-op entries) — correct, not a bypass.
- **Repository**: no DELETE method exists (`NO deletion path`). DELETE granted at DB layer but
  service exposes no deletion code path.
- **UI** (`page.tsx` + `RetentionPolicyForm.tsx`): NO purge/delete/erase control. Cutoff panel is
  read-only/informational; a test asserts no button matching `/purge|delete|clean/i` renders.

verifyChain stays `ok:true` — no existing audit row is deleted or mutated.

## 4. Isolation test runs as dealflow_app (NOT postgres) — CONFIRMED

`retention-policy-isolation.e2e-spec.ts`: `await client.query('SET ROLE dealflow_app')` with an
explicit comment — `NOT postgres — postgres bypasses FORCE RLS → false-green (0016 trap)`.
GUC set via `SELECT set_config('app.workspace_id', ...)`; RESET ROLE + RESET GUC in finally.
RET-ISO (cross-firm read isolation + foreign-workspace_id write rejection) and RET-WORM exercised
as the unprivileged app role — the isolation proof is genuine, not a superuser false-green.

## 5. LIVE — independently confirmed

- `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200**
  `{"status":"ok","db":"ok","version":"775cd67e7c910dff76409c7ac9e7b7cc823662f3"}`
  — version hash matches the deployed-state contract EXACTLY.
- `/compliance/retention` unauthed → **401** (perimeter enforced; no anonymous access).
- No prod firm-admin creds → isolation + WORM correctness relies on the CI RET-ISO/RET-WORM suite
  (20 tests as dealflow_app @775cd67), which is the sanctioned proof path.

## 6. Secrets — CLEAN

Secret scan over the api/web/shared diff (main vs merge-base) returned zero password/key/token/
private-key matches. No credential in the deliverable.

---

**Bottom line:** REAL (files at 775cd67), LIVE (prod /health 200 @775cd67, independently hit),
genuinely ISOLATED (ENABLE+FORCE RLS + workspace_isolation policy + explicit dealflow_app grant on
the new table; isolation e2e runs as the app role, not postgres), and WORM-PRESERVING (append-only
audit, no delete path in service/repo, no purge control in UI). Nothing marked done that isn't
functional. APPROVE.
