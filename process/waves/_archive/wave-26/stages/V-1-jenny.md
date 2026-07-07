# Wave 26 — V-1 jenny (spec-compliance verification)

**Spec:** seed 1a1c5855 (DB) — P-2 SCOPE + MG1/MG2 (karen P-4 binding). M10 FINAL-hardening: RLS connection-split deploy ACs + preflight.
**Verdict source:** independent inspection of devops.md, apps/api/src/db/index.ts, apps/api/src/main.ts, url-distinct-preflight.spec.ts, product-decisions.md.

## VERDICT: **APPROVE** — 5/5 MATCHES, 0 DRIFTS

---

## Check-by-check

### 1. Three deliverables present + accurate — MATCH
- **(1) Contract documented** — `command-center/dev/architecture/devops.md:237-308` § "RLS connection-split & role-privilege deploy contract": role-split table (`DATABASE_URL`=dealflow_app NOSUPERUSER NOBYPASSRLS runtime / `MIGRATE_DATABASE_URL`=owner preDeploy-only, devops.md:243-248); PATH-safe preDeployCommand with the `bash -lc` PATH-reset gotcha + bare env-prefix fix (devops.md:250-259); coupled-rollback with the old-code-lacks-[RLS-GUARD] hazard + additive-only-migrations note (devops.md:284-293). All three sub-contracts present and accurate.
- **(2) Standing deploy-AC checklist** — `devops.md:295-302`: 4 concrete checkable items (2-URLs-distinct→`assertUrlsDistinct()`; runtime NOSUPERUSER NOBYPASSRLS→`[RLS-GUARD]`+`/health db:ok`; PATH-safe preDeployCommand; rollback-before-mutation reverting BOTH deployment + runtime URL). Each anchored to a mechanism/artifact — not vague prose (BUILD #11 satisfied).
- **(3) Mechanize the checkable half** — `[RLS-GUARD]` documented as the runtime-role anchor (devops.md:261-272) pointing at the real `assertNonSuperuserConnection()` (`apps/api/src/db/index.ts:57-85`, predicates intact); 2-URLs-distinct preflight `assertUrlsDistinct()` (`index.ts:105-120`), wired `main.ts:30` under `NODE_ENV!=='test'` **before** `assertNonSuperuserConnection()` (`main.ts:44`) — correct fail-before-connect order; tested at `apps/api/src/db/url-distinct-preflight.spec.ts` (present). NO ci.yml change (GAP-3 deferred).

### 2. MG1/MG2 honored — MATCH
- **MG1 [RLS-GUARD] frozen (doc-only):** `index.ts:57-85` predicate SQL (`current_setting('is_superuser')`, `rolbypassrls FROM pg_roles`), both branches (`is_superuser==='on'`, `has_bypassrls`), and the three fail-closed throws are unchanged. Only JSDoc/message/cross-ref text added (the wave-26 contract pointer at index.ts:45-49, 74, 82). Consistent with karen P-4 BINDING MG1 and B-6 diff verification. No check-logic edit.
- **MG2 stale § corrected:** `devops.md:226-235` § "Postgres migrations in CI" no longer claims migrations use "the same POSTGRES_URL"; it now splits prod preDeploy (owner `MIGRATE_DATABASE_URL`) vs CI test-DB (`ensureMigrated()`/`TEST_DATABASE_URL` superuser) and cross-links the new contract § (devops.md:233). No lingering contradiction — internally consistent. Matches karen MG2 obligation (correct, not merely append).

### 3. Accurate to the real deploy (not invented) — MATCH
Contract cross-checks against the seed's C-2 evidence source: the 2 URLs (dealflow_app/owner), the PATH gotcha (`bash -lc` reset PATH → pnpm-not-found, wave-17 api deploy #1 FAILED), and coupled-rollback (revert deployment AND runtime `DATABASE_URL`→owner; old code lacks [RLS-GUARD]) all match the seed body (V-1-jenny GAP-5 + C-2 deploy experience) and migration 0016 references. No fabricated mechanism.

### 4. Stays STRICTLY out of recordkeeping scope — MATCH
This is the EXPLICITLY-FINAL bounded hardening/debt-closure wave (product-decisions.md:429-437, wave-25 BOARD 7/7 disposition (c), Tier-3-strict). Deliverable is devops-doc + preflight ONLY: no SOX/FINRA recordkeeping vertical authored, no retention-lock/attestation/export code, no `audit_log_entries` schema touch, no HMAC-preimage change. **No recordkeeping-progress claim** made anywhere in the artifacts. Founder-reserved boundary respected.

### 5. GAP-3 defer + wave-27 pause + _TBD metrics flagged consistently — MATCH
- **GAP-3 (CI DB role):** documented as deferred follow-up in two places (`devops.md:304-308` § GAP-3 + Risk R-7 at devops.md:334) with the PAT-lacks-`Workflows:write` reason. `git diff --name-only main...HEAD` → zero `.github/workflows` changes (confirmed live).
- **wave-27 pause:** consistent with the enforced wave-27 circuit-breaker (product-decisions.md:435) — nothing in this wave smuggles a 4th debt item or pre-empts the founder-gated decomposition pause.
- **_TBD metrics:** P-2 FLAGS carry "M9+M10 _TBD polls" (P-2-spec.md:8); consistent with the BOARD caveat (product-decisions.md:424) and founder-gated pile-up (product-decisions.md:438). Not resolved autonomously (correct — founder-reserved).

---

## Anti-drift scan
- No spec-vs-deployed drift: every documented mechanism maps to real code (`index.ts`, `main.ts`) verified in-tree, not inferred.
- No scope creep beyond the single-task seed 1a1c5855.
- CI signals (typecheck 4/4, lint 0, build 3/3, 986 unit pass, preflight 3/3) re-verified by B-6 head-builder gate (b663615); preflight test mutation-falsifies (not coverage theater).
- No conflicting prior decision found. Fully consistent with wave-25 BOARD (c), P-4 karen MG1/MG2, and the founder-reserved recordkeeping boundary.

---

**APPROVE | MATCHES 5 / DRIFTS 0 | no conflicting prior decision.**
