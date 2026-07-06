# Wave 15 — P-1 Decompose

## Maximum size rubric — NO threshold trips
| Measure | Estimate | Threshold | Trip? |
|---|---|---|---|
| Files touched | ~26-36 (user-mgmt service/repo/controller/spec + settings + data-source-conn service/repo/controller (encrypted cred) + 3 admin pages + placeholders + shared + tests; possibly a migration for data_source_connections + settings) | >60 | NO |
| New primitives | ~14-18 (user-admin routes + settings routes + data-source-conn table+routes+encryption + 3 pages) | >60 | NO |
| Estimated net LOC | ~2,800-3,200 (4 tasks) | >5,000 | NO |
| Stage-4 working set | ~150-190K | >350K | NO |

## Wave type
- claimed_task_ids.length = 4 (82ec8724 seed + 648a86a6 + 41c017f7 + d7f716b4) → **multi-spec**.

## Minimum floor (multi-spec: >2,500 LOC OR ≥6 specs)
- ~2,800-3,200 net LOC > 2,500 → **floor MET**. (mvp-thinner: peeling d7f716b4 drops to ~2,400-2,500 at/under floor → floor-constrained; keep all 4.)

## Verdict: **PROCEED** (no split, no merge)

## design_gap_flag: **false**
- User-management admin (82ec8724) → design/admin-users.html EXISTS. Workspace/firm settings (648a86a6) → design/admin-workspace-settings.html EXISTS. Data-source connection admin (41c017f7) → design/admin-integrations.html EXISTS. AppShell placeholders (d7f716b4) → placeholders, no mockup needed. All admin surfaces have up-front mockups. No new admin dir yet (new pages, built to the mockups). → false.

## CARRIED CONSTRAINTS for P-2/P-3/P-4/B (from P-0):
1. RACE-SAFE last-admin guard (server-side atomic; concurrent double-deactivate-last-admin must not leave zero admins — DB-level guard/advisory-lock/transactional count, not a service TOCTOU).
2. CREDENTIAL NEVER IN AUDIT ROW/LOGS (data-source cred form: encrypted-at-rest; audit the ACTION + non-secret metadata only, NEVER the plaintext secret — no leak into audit_log_entries/errors/logs).
3. SoD + WORM-audit (M2 last-in-txn) on every role/settings/credential mutation; actor via getUserWithRole.
4. SECURITY-SCOPE-TIGHTENED at P-4 (82ec8724 user-creation/invite/role/deactivate is auth-adjacent → ≥2 Phase-2 iterations).
5. ENCRYPTION-AT-REST for the data-source credential — generate the encryption key myself (openssl/crypto.randomBytes per rule 6) as an env var (NOT committed); the FORM stores encrypted; no account-issued credential needed for the encryption mechanism itself (the actual data-source vendor key is deferred/founder-gated — this wave stores what the admin enters, encrypted, without a live test).

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [82ec8724, 648a86a6, 41c017f7, d7f716b4]
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
carried_constraints: [race-safe-last-admin, credential-never-logged, SoD-WORM-audit, security-scope-tightened, encryption-at-rest-self-generated-key]
