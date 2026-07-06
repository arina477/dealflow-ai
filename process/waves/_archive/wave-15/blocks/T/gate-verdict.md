# Wave 15 — T-9 Journey Gate Verdict (head-tester, fresh spawn, Phase 1)

**Wave topic:** M7 admin (user-mgmt invite/role/deactivate + workspace settings + data-source connection credential storage + shell polish)
**wave_type:** [ui, backend, auth(user-creation/role/deactivate + credentials)] — **SECURITY-SCOPE-TIGHTENED**
**Deployed + verified SHA:** `f5455d6` (= CI-green code `596a78d` + docs-only chore); services LIVE on Railway.
**Gate:** T-9 (block-exit). Verdict authority: head-tester.

## Verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers:
    build_gate: "head-builder B-6 — 2-phase APPROVED (hollow-CONC-1→real-service 795e896; M1 uniform-error + M2 workspace-settings singleton advisory-lock + L3 e150925); production code CORRECT at critical+high"
    ci_deploy_gate: "head-ci-cd C-2 — APPROVED; CI 5/5 green @596a78d (incl pnpm-audit --audit-level=high); deployed f5455d6 LIVE; CREDENTIALS_ENC_KEY set+proven (201 not 500); migration 0013 additive live; credential-never-returned live"
    head_tester: "self — source-level re-verification of the security-invariant test map at the deployed SHA (did NOT trust the fixed-at-795e896 claim; read the shipped test + guard source)"
  failed_checks: []
  rationale: >
    Every security-invariant checkbox for this security-scope-tightened admin wave is tickable
    from concrete artifacts re-verified at the deployed SHA — not inferred from a green badge and
    not taken on the B-6 claim that CONC-1 went hollow→real. The five load-bearing invariants each
    have genuine, fault-killing coverage; the three findings (2 LOW, 1 INFO) are non-blocking.
  next_action: PROCEED_TO_V
```

`APPROVED` requires every stage-exit checkbox ticked. Confirmed below.

---

## Security-invariant test map — each verified NON-HOLLOW at the deployed SHA

Head-tester distrusted the "fixed at 795e896" claim and read the actual shipped test + production source at `596a78d` (the deployed code). Findings:

### 1. RACE-SAFE last-admin guard (write-skew — P-4 #1) — GENUINE + FAULT-KILLING ✔
- **Production guard** (`user-management.service.ts` `runLastAdminGuard`): acquires `pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY=4_200_500_500)` as the serialization primitive, then counts admins that would REMAIN, throws `ConflictException` on zero. Confirmed it is NOT `count(*) FOR UPDATE`; the source docstring explicitly names the write-skew window that FOR UPDATE cannot close. Guard is invoked on demote (line 219) AND deactivate (line 292) paths.
- **CONC-1 (e2e, real vs Postgres):** builds a REAL `UserManagementService(db, auditService)` (bypassing DI, wired to the live test DB), runs `Promise.allSettled([svc.deactivateAsActor(admin1,...), svc.deactivateAsActor(admin2,...)])` on the only two active admins → asserts EXACTLY ONE fulfilled + EXACTLY ONE rejected, the rejection `toBeInstanceOf(ConflictException)` matching `/Cannot (deactivate|demote) the last active admin/`, plus a post-state DB count proving `remaining >= 1`. This is the spec's verbatim requirement and it is fault-killing: against a `count(*) FOR UPDATE` guard both txns read count=2 and BOTH commit → the `toHaveLength(1)` assertion fails. **The hollow inline-SQL re-implementation flagged at B-6 is gone** — verified by reading the shipped file, not the verdict.
- **CONC-3 / CONC-4:** demote-last-admin (`assignRoleAsActor → advisor`) and self-deactivate-last-admin each `rejects.toBeInstanceOf(ConflictException)` through the real service.
- **A-4/A-5/A-6 (unit):** mock `tx.execute → {rows:[{remaining:'0'}]}` and assert `deactivateAsActor` / `assignRoleAsActor` (demote) / self-deactivate each `rejects.toBeInstanceOf(ConflictException)` — the 409 reject path the B-6 first pass found had ZERO coverage is now covered against the real service.
- **C-2 LIVE:** deactivate endpoint admin-only (advisor 403), functional on a non-last user (201, `deactivatedAt` set); 12 active admins remain for the guard to protect.

### 2. CREDENTIAL-NEVER-LEAKS (P-4 #2) — GENUINE ✔
- **SEC-1** (real `DataSourceAdminService.createConnection` → audit row): `auditStr not.toContain(plainCredential)` and connection shape exposes `hasCredential:true` only, `not.toContain('encryptedCredentials')`.
- **SEC-2** (real FORCED-error path via unique-displayName constraint): `errStr`/`errFull not.toContain(plainCredential)` — proves `scrubCredentialFromError` on a real thrown error, not a mocked reject.
- **SEC-3** (real crypto): `encryptCredential → decryptCredential` round-trip recovers plaintext (AES-256-GCM, random 12-byte IV, auth-tag verify, `v1` key-id, fail-closed on missing/short key).
- **SEC-4** (real `listConnections`): read path `not.toContain(plainCredential)` even when one is stored — `hasCredential` boolean only, no encrypted blob.
- **C-2 LIVE:** sentinel plaintext posted as admin appears in NEITHER the create response, NOR the read-back list, NOR the rendered authed HTML — only `hasCredential:true`. Credential is write-only at the network + render surface.
- Not tautological: assertions are `not.toContain(<the actual plaintext>)` against real audit rows / error strings / read payloads, plus a real crypto round-trip — not `expect(mock).toHaveBeenCalled()`.

### 3. CREDENTIALS_ENC_KEY set + working in prod — CONFIRMED ✔
- **C-2 LIVE:** `POST /admin/integrations` with a credential → **201, not 500** = the AES-GCM encrypt path executed end-to-end against the live prod key (source fails CLOSED with 500 if key unset/wrong-length). Fresh 32-byte key generated by head-ci-cd (`openssl rand -base64 32`, never echoed/committed), byte-accurate readback = exactly 32 bytes, set BEFORE the api served traffic.
- **secret-grep CLEAN (re-run by head-tester):** every `CREDENTIALS_ENC_KEY` hit at `596a78d` is an env-var-name reference (`env.CREDENTIALS_ENC_KEY` in credential-crypto.ts / service / module), the `.env.example` placeholder, or test-config — ZERO committed key literals.

### 4. RBAC / SoD — GENUINE ✔
- **C-2 LIVE server-side:** advisor `GET`/`POST` on all 3 admin endpoints → **403** (RolesGuard, admin-only); anon → **401** (SessionGuard). Not merely UI-hidden — probed at the API. DB-authoritative RolesGuard + role-reverify (`getUserWithRole`) confirmed; boot fail-closed on empty role matrix (source invariant, B-6 #6).
- **AC-STRIP LIVE:** zero send/compose/schedule/AI-draft affordance across the 3 authed admin pages; the only AI hits are the allowed global DealFlow-AI brand tagline (CODE-OF-CONDUCT clean).

### 5. Migration 0013 additive + auditActionEnum extended — CONFIRMED ✔
- 0013 strictly additive (all-new `workspace_settings` table + two nullable ADD COLUMNs `users.deactivated_at` + `data_source_connections.encrypted_credentials` + FKs on the new table; zero DROP/ALTER-TYPE/NOT-NULL-on-existing; DROP only in `.down`). Applied by the api preDeploy migrate one-shot before serving; `db:ok` on /health after. LIVE-proven: all 3 admin endpoints 200 with no relation/column error, deactivate write-path exercises the new column.
- `auditActionEnum` extended additively (all 6 admin actions appended at the end — serialization order preserved; B-6 #3).

---

## Provenance (no Ghost Green)

- CI GREEN on the EXACT code SHA `596a78d` — run `28792309258`: lint / typecheck / test / build / audit 5/5 (incl `pnpm audit --audit-level=high`, not bypassed). The load-bearing admin-concurrency e2e ran REAL against a fresh migration-0013-applied CI Postgres.
- Deploy target `f5455d6` = `596a78d` + a docs-only chore (2 files under `process/`, zero application/schema/CI bytes; `[skip ci]` correct). Head-tester re-ran `git diff --name-only 596a78d f5455d6` = the 2 process/ files only. The deployed artifact IS the CI-green code.

## E2E / Layout infra-readiness note (Playwright binary gate)

- T-5/T-6 for this wave are **Pattern-A (CI) + active LIVE HTTP/render verification via C-2**, NOT a headless-browser Playwright DOM suite. The live UI evidence is real deployed authed page renders (200, 22-27KB real pages vs the 6.4KB 404 shell) + server-side API probes with data-attribute-level assertions (RBAC 403/401, credential absent from HTML, AC-STRIP grep). No Playwright-Chromium suite claimed a green with zero executed tests → the missing-browser-binary silent-false-PASS hazard does NOT apply here (there is no browser-binary-dependent stage asserting a pass). No infra-readiness ESCALATE trigger fires.

## Findings disposition (3 total: 0 crit / 0 high / 0 med / 2 low / 1 info) — NON-BLOCKING

| # | Sev | Disposition |
|---|---|---|
| 1 | LOW | last-admin guard over-strict on an already-deactivated admin → harmless fail-closed 409. Fail-SAFE direction (never leaves 0 admins). Optional short-circuit. NOT a gate blocker. |
| 2 | LOW | data-source config blob (non-secret by contract) could hold a secret if an admin pastes one (config IS returned + persisted plaintext). Documented; the SECRET field (`encrypted_credentials`) is correctly write-only/encrypted. Doc note, not an invariant breach. NOT a blocker. |
| 3 | INFO | CREDENTIALS_ENC_KEY is a new prod env var; key-loss = credential-loss + no-rotation-in-MVP. Documented in `.env.example` + ops note. Accepted MVP posture. |

None touch a load-bearing security invariant; all are fail-safe-direction or documented ops posture.

## Anti-pattern sweep (all clear)

- **Coverage theater / tautological:** CONC-1 + SEC-1..4 + A-4/5/6 all assert concrete state (exactly-one-succeeds, DB remaining-count, `not.toContain(plaintext)`, real crypto round-trip) against the REAL service — verified by reading source, not the verdict. Clear.
- **Untested compliance invariants:** write-skew guard, credential-never-leaks, RBAC/SoD all covered by adversarial API-level + real-DB tests (concurrent last-admin, forced-error credential path, direct-API RBAC probes). Clear.
- **Layout-only false-PASS:** live checks assert data (RBAC 403/401, credential ABSENT from HTML, AC-STRIP grep), not container visibility. Clear.
- **Silently-skipped / missing-binary E2E:** no browser-binary-dependent Playwright stage claims a green; C-2 live probes have non-zero real executed HTTP/render evidence. Clear.
- **Hollow test (the B-6 catch):** re-verified GONE at the shipped SHA — CONC-1 drives the real service; no inline SQL re-implementation. Clear.

## Footer

```yaml
verdict: APPROVED
gate: T-9 PASSED
block: T (Test)
security_invariants_verified:
  write_skew_last_admin_guard: genuine (advisory-lock, NOT count-FOR-UPDATE; CONC-1 fault-killing real-service concurrent; A-4/5/6 409 units; C-2 live)
  credential_never_leaks: genuine (SEC-1/2/3/4 real service + real crypto round-trip + forced-error; C-2 live sentinel write-only)
  credentials_enc_key_prod: confirmed (C-2 201-not-500; secret-grep clean, no committed literal)
  rbac_sod: genuine (server-side advisor 403 + anon 401 live; DB-authoritative + role-reverify; boot fail-closed)
  migration_0013: additive live; auditActionEnum extended additively
provenance: no-ghost-green (CI 5/5 @596a78d; deploy f5455d6 = code + docs-only)
findings: {total: 3, critical: 0, high: 0, medium: 0, low: 2, info: 1}  # non-blocking
hollow_conc1_recheck: real-service-at-shipped-SHA (B-6 fix verified, not trusted)
next_action: PROCEED_TO_V
handoff: V-block
```
