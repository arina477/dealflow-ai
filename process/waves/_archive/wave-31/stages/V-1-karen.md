# Wave 31 — V-1 Karen reality-check (DEPLOYED state)

**Agent:** karen (fresh-spawned @ V-1)
**Wave topic:** M9 Twenty CRM DataSourceAdapter — external-SDK CRM adapter behind the existing `DataSourceAdapter` interface (dormant-deployed, live-verify key-gated).
**Merged HEAD (git-verified):** `b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891`
**Active Railway deploy:** `986c1b1d-10cd-4727-95c4-0b6b4ebe2347` (`commitHash = b1f81d79…`, active-routed, SUCCESS).
**Mode:** automatic. **Precedent:** wave-30 Affinity V-block APPROVED (same dormant-deploy + key-gated-live-verify shape) — re-verified against wave-31 code, NOT rubber-stamped.

---

## VERDICT: **APPROVE** — 6/6 load-bearing claims TRUE in deployed reality. 0 blocking findings.

This is an HONEST dormant-deploy wave. Every artifact claims exactly what is true — "registered + boot-clean-dormant on the merged SHA; live Twenty fetch key-gated to a founder follow-up" — and nothing more. No done-theater. No false live-claim. The crux (Finding 4) is clean.

---

## Finding 1 — Adapter deployed at the merged SHA (not just merged) — **CONFIRMED** [severity: n/a — TRUE]

- `git cat-file -t b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891` → `commit` (real object, full 40-char SHA resolves).
- On main: `git merge-base --is-ancestor b1f81d79… main` → **YES**. `git log b1f81d79` shows it as the wave-31 merge commit ("merge: wave-31 Twenty CRM DataSourceAdapter").
- **C-block gate-verdict Ghost-Green reasoning HOLDS** (`process/waves/wave-31/blocks/C/gate-verdict.md:38-51`):
  - First `serviceInstanceDeployV2` (no `commitSha`) would redeploy the service's *pinned* commit `a6ad02c` (wave-30 Affinity — NO Twenty adapter). That deploy (`ca49b200`) was discarded before verification → final state **REMOVED**. Verifying it would have been a fabricated green. Sound catch.
  - Corrected deploy pinned to `commitSha:"b1f81d79…"` → deployment `986c1b1d`, `meta.commitHash = b1f81d79…`, is `serviceInstance.latestDeployment` (active-routed), SUCCESS.
  - `/health` = 200, `db:ok`. The `/health.version` self-reports `a6ad02c` — correctly identified as a **lagging build-time env var** (CI-PRINCIPLES rule 1), NOT authoritative; deployed SHA proven via Railway `commitHash`, not the self-report. This is the right discrimination — a naive reviewer would have flagged `version:a6ad02c` as a stale deploy; the gate correctly proves the SHA independently.
- No migration/schema/`.sql` file in the merge diff (`git diff 2c355c8..b1f81d7 --name-only`) — adapter-only confirmed.

## Finding 2 — Twenty adapter REGISTERED in createDefaultRegistry — **CONFIRMED** [TRUE]

`apps/api/src/modules/sourcing/adapters/adapter.registry.ts`:
- Import: `import { TwentyDataSourceAdapter } from './twenty.adapter';` (line 24).
- Registration: `registry.register(new TwentyDataSourceAdapter());` (line 61), inside `createDefaultRegistry()` alongside Fixture + Affinity.

## Finding 3 — App boots clean WITHOUT the key (dormant, no crash) — **CONFIRMED** [TRUE]

Read of `apps/api/src/modules/sourcing/adapters/twenty.adapter.ts` (actual code, not header comment):
- Absent `TWENTY_API_KEY` → `console.warn(...)` + `return []` (lines 365-372). No throw.
- Absent `TWENTY_BASE_URL` → `console.warn(...)` + `return []` (lines 374-381). No throw.
- Non-https / malformed base URL → warn + `return []` (SSRF guard, lines 383-401). No throw.
- **Env reads are LAZY** — both `process.env.*` reads are inside `fetchCompanies` (lines 365, 374), NOT the constructor. The class has **no constructor** — `new TwentyDataSourceAdapter()` at the register site reads no env, so the DI container boots dormant regardless of env state.
- Boot-clean proof: Railway healthcheck gates SUCCESS on `/health` 200, which requires the full NestJS module graph — incl. `SourcingModule.createDefaultRegistry()` (Fixture + Affinity + Twenty) — to initialize without throwing under absent Twenty config. `/health` = 200 on the active deploy.

## Finding 4 — HONEST DORMANT claim, NOT a false live-claim (THE crux) — **CONFIRMED HONEST** [TRUE]

Every wave artifact surfaces the LIVE Twenty fetch as a founder-gated follow-up, NOT as done:
- **C-2 gate-verdict** (`blocks/C/gate-verdict.md:55-58`): "Key-gated LIVE-verify (founder follow-up, NOT a C-2 blocker): real Twenty fetch is unverifiable until the founder supplies TWENTY_API_KEY + TWENTY_BASE_URL … C-2 verifies the DORMANT deploy only."
- **T-9 gate-verdict** (`blocks/T/gate-verdict.md:30-32`, `:80-84`): live E2E "FOUNDER-GATED … activation is env-only," explicitly a legitimate deferral not a coverage gap.
- **C + T review-artifacts**: both restate "LIVE Twenty verify = founder-gated; dormant deploy verified, mirrors wave-30 Affinity."
- **Founder request staged** (`process/session/updates/founder-request-twenty-api-key.md`): asks for instance URL + API key; explicitly states "only the live end-to-end (real Twenty data) waits for the URL + key."

No artifact claims the live Twenty fetch works. The claim is precisely "dormant-deployed, live deferred." **Honest — no done-theater.**

## Finding 5 — No committed secret — **CONFIRMED** [TRUE]

- Both credentials read from `process.env.*` only (twenty.adapter.ts:365, :374). No hard-coded value.
- Independent scan for Bearer/long-key literals in shipped adapter + spec → NONE (only fake test keys `test-twenty-api-key-do-not-use`, `my-twenty-api-key` in the spec — clearly non-secret).
- `.env.example` lines 43-44 are **strictly NAME-ONLY**: `TWENTY_API_KEY=` and `TWENTY_BASE_URL=` with nothing between `=` and the trailing `#` comment (verified by stripping the comment — empty value). (Initial grep `!!!VALUE PRESENT` was a false-positive on the comment text; re-verified empty.)
- No committed `.env` anywhere in the tree (`git ls-files` — only `.env.example` variants).

## Finding 6 — Config schema untouched, no migration — **CONFIRMED** [TRUE]

- `git diff 2c355c8..b1f81d7 --name-only` does NOT include `apps/api/src/modules/admin/data-source-admin.service.ts` or `packages/shared/src/data-source-admin.ts` — both files 0-diff in the merge.
- `dataSourceConnectionConfigSchema` appears in the merge diff ONLY inside prose/comments (adapter header, spec, gate docs) — never as a modified definition. wave-16 secret-sink boundary respected (DRIFT-1: prose "base-URL-in-config" correctly superseded by env-only resolution).
- No migration/schema/`.sql` file in the merge diff.

---

## Non-blocking note (for L-2, not a V-block finding)

`blocks/C/review-artifacts.md:18` flags that head-ci-cd appended a CI-PRINCIPLES rule mid-C-block — L-2 (head-learn) must ratify it against the AT-MOST-ONE-per-wave promotion gate or revert. Carried forward; does not affect the V-block verdict.

---

## karen_signoff

```yaml
karen_signoff:
  verdict: APPROVE
  stage: V-1
  claims_verified: 6
  claims_total: 6
  blocking_findings: 0
  crux: HONEST-DORMANT (no false live-claim; live verify founder-gated)
  evidence:
    - "git cat-file -t b1f81d79 -> commit; merge-base --is-ancestor main -> YES"
    - "railway 986c1b1d commitHash=b1f81d79 active-routed SUCCESS; /health 200 db:ok"
    - "Ghost-Green: no-commitSha redeploy ca49b200 (a6ad02c) discarded->REMOVED; pinned redeploy to b1f81d79 verified"
    - "adapter.registry.ts:24 import + :61 register(new TwentyDataSourceAdapter())"
    - "twenty.adapter.ts:365-401 absent-key/URL/non-https -> warn+return [] no throw; lazy env read, no constructor -> dormant boot"
    - "artifacts C-2/T-9/reviews/founder-request all surface live-verify as founder-gated, not done"
    - "secrets env-only (:365,:374); .env.example:43-44 name-only; no committed .env"
    - "git diff 2c355c8..b1f81d7: data-source-admin schema files 0-diff; no migration/sql"
  next_action: PROCEED (feed V-2 triage / V-3 gate)
```
