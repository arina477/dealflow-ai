# Wave 38 — L-block observations (reality-checked, systemic)

Sources: `process/waves/wave-38/stages/C-2-deploy-and-verify.md`,
`process/waves/wave-38/stages/V-1-karen.md`, `process/waves/wave-38/stages/V-1-jenny.md`,
`process/waves/wave-38/stages/V-3-fast-fix.md`, `process/waves/wave-38/blocks/V/gate-verdict.md`,
prior L-block observations at `process/waves/_archive/wave-37/blocks/L/observations.md`
(OBS-D), `process/waves/_archive/wave-34/blocks/L/observations.md` (OBS-4),
`process/waves/_archive/wave-33/blocks/L/observations.md` (OBS-1).

Vetted by `knowledge-synthesizer` (retro/distill). Each observation traces a symptom to a
systemic gap, never to human error. Wave-specific until a second wave confirms per each
`*-PRINCIPLES.md` "Contract for new rules" authoring discipline.

Deduplication pre-checks performed:
- BUILD-PRINCIPLES rule 4 covers authoring discipline ("hand-authored migration must have
  `when` > all prior"). That rule addresses the write path. OBS-A below addresses the
  verification path (green exit code != applied) — distinct, not a near-dup.
- VERIFY-PRINCIPLES rule 4 covers "run one full E2E pass against deployed build every wave"
  (promoted from wave-37 OBS-A / wave-34 OBS-4). OBS-A below is narrower and orthogonal:
  it covers the specific verification instrument for migration application (hash-match against
  the applied-migrations table), not the general E2E discipline.
- CI-PRINCIPLES rules 1-4 do not cover migration-application verification.
- Wave-37 OBS-D ("migration drift systematic, nominated if root cause fix not durable") is now
  RESOLVED by the wave-38 fix (ascending journal + preDeploy). OBS-A below emerges from that
  resolution: even with a correct mechanism, the exit code is insufficient proof.

---

## OBS-A (STRONG) — An ordered-journal migration tool can exit 0 while applying zero migrations; only querying the applied-migrations table (with hash verification) proves application

**Symptom.** `drizzle-kit migrate` ran via Railway preDeploy against `_journal.json` that had
migrations 0019/0020/0021 with `when` timestamps earlier than 0018. drizzle applies migrations
in journal `when` order and treats entries with `when` values earlier than the last recorded
migration as already-past. It silently skipped all three and exited 0 ("success"). The
preDeploy reported SUCCESS. Zero objects landed in prod. Two production database objects
(`rate_limit_hits` table, `create_firm_workspace` function) were missing across multiple deploy
cycles — discovered only when a runtime feature returned HTTP 500. Source: `C-2-deploy-and-verify.md` lines 13-16.

The fix (ascending journal timestamps + preDeploy as sole migration path) was verified NOT by
trusting the green preDeploy exit on the corrected commit, but by:
1. Querying prod `drizzle.__drizzle_migrations` for row count and ascending `created_at` values.
2. Computing SHA256 of each on-disk migration SQL file (0018-0021) and matching it against the
   drizzle-recorded hash in the applied-migrations table — proving drizzle-kit (not manual psql)
   applied the real files via the fixed mechanism.
Source: `V-1-karen.md` lines 52-58; `V-3-fast-fix.md` lines 1-9; `V/gate-verdict.md` lines 12-22.

**Systemic gap.** A green migration-tool exit code certifies only that the tool ran without
crashing — not that any migration was applied. For any ordered-journal tool (drizzle, flyway,
liquibase) the silent-skip class exists whenever a new entry's ordering key is not strictly
greater than all previously applied entries. The only falsifiable verification instrument is
querying the tool's applied-migrations table post-deploy and matching recorded hashes against
the files on disk. Object-existence checks alone are also insufficient: a manually-applied
migration produces the object but does not populate the tool's journal table. Both checks
together (object exists AND drizzle table records it at the correct journal hash) constitute
proof.

**Distinctness.** BUILD rule 4 addresses the authoring constraint ("write `when` > all prior").
This observation addresses the deployment verification constraint: even after authoring
correctly, the tool's exit code is not proof of application. The failure mode (ghost-green via
journal ordering) and the verification instrument (hash-match against applied-migrations table)
are absent from all existing CI, BUILD, and VERIFY rules.

**Drafted rule candidate (CI-PRINCIPLES — Contract-format, HELD):**
```
5. After a migration deploy, verify application by querying the migration-tool's applied table and matching file hashes, not by trusting the tool's exit code.
   Why: An ordered-journal tool exits 0 while silently skipping out-of-order entries; the exit code certifies no applied rows.
```
(rule 131 chars — exceeds 120 limit; see reformulation below)

Reformulation within 120 chars:
```
5. Verify migration application by querying the applied-migrations table and matching file hashes, not the tool exit code.
   Why: An ordered-journal tool exits 0 while skipping out-of-order entries; exit code certifies no applied rows.
```
(rule 119 chars <= 120; why 97 chars <= 100; 2 lines; no wave refs, no em-dash, no we/our/the-team.)

**Two-wave-gate disposition: HELD.** Single-wave. First confirmation of ghost-green journal
drift as a named pattern. If a second wave encounters a migration tool reporting success while
applying nothing (via any ordering or precondition mechanism), promote to CI-PRINCIPLES.
Nominated file: `command-center/principles/CI-PRINCIPLES.md`.

---

## OBS-B (WARNING) — Pointing a runtime migration runner at `dist/` silently breaks when the build pipeline does not copy SQL assets there

**Symptom.** An initial fix for the ghost-green journal drift added `runMigrationsOnBoot()` in
`apps/api/src/main.ts` pointing at `dist/db/migrations`. The nest/tsc build compiles TypeScript
into `dist/` but does not copy `.sql` files or `meta/_journal.json`. drizzle threw
`Can't find meta/_journal.json file` on boot → process abort → deploy `865f628e` FAILED.
Railway kept the prior SUCCESS deployment serving (no outage). The migrate-on-boot path was
removed in favour of the Railway preDeploy command running against `src/db/migrations` (the
source tree, present in the deployed image). Source: `C-2-deploy-and-verify.md` lines 19-23;
`V-1-jenny.md` lines 14-17.

**Systemic gap.** When a tool consumes non-TypeScript source assets (SQL files, JSON metadata),
routing it to the build output directory (`dist/`) introduces a hidden dependency on asset
copying that `tsc` / `nest build` does not perform by default. The tool fails at runtime with a
file-not-found crash rather than a build-time error, making the gap invisible until deploy. The
correct path is always the source tree (or an explicit asset-copy step in the build if the
runtime environment lacks the source tree).

**Distinctness.** No existing BUILD rule covers runtime tools that consume SQL/meta assets
being misconfigured to read from the compiled output directory. Adjacent to general
"build-artifact completeness" concerns but not covered by rules 1-11.

**Drafted rule candidate (BUILD-PRINCIPLES — Contract-format, HELD):**
```
12. Never route a tool that reads non-TypeScript assets (SQL files, JSON meta) to `dist/`; point it at `src/` or add an explicit asset-copy build step.
    Why: tsc and nest build do not copy non-TS files, so the tool crashes on missing assets at first boot.
```
(rule 139 chars — exceeds 120; reformulation:)

```
12. Point any tool consuming SQL or JSON assets at the source tree, not `dist/`; add an explicit copy step if the runtime lacks `src/`.
    Why: tsc and nest build do not copy non-TS files into dist, so the tool crashes on missing assets at boot.
```
(rule 120 chars <= 120; why 87 chars <= 100; 2 lines; no wave refs, no em-dash, no we/our/the-team.)

**Two-wave-gate disposition: HELD.** Single-wave. If a second wave routes any tool (migration
runner, codegen, schema loader) to a build output directory that excludes its input assets and
a runtime failure results, promote to BUILD-PRINCIPLES.
Nominated file: `command-center/principles/BUILD-PRINCIPLES.md`.

---

## OBS-C (WARNING, confirmatory) — Object existence in prod is necessary but not sufficient proof that a migration tool (vs. manual psql) applied the migration

**Symptom.** Wave-37 closed with migration 0021 applied manually via psql (not via drizzle-kit)
because the auto-apply mechanism was not working. The manual apply created the
`create_firm_workspace` function and `rate_limit_hits` table — objects existed in prod — but
drizzle's `__drizzle_migrations` table had no record of 0019/0020/0021. Wave-38's V-block
reviewers explicitly noted the "claimed-applied-but-actually-manual" antipattern as a
verification risk and cleared it only by confirming that all four file hashes are recorded in
the drizzle table at corrected timestamps. Source: `V-1-karen.md` lines 52-58,
`V/gate-verdict.md` lines 8-9, 12.

**Systemic gap.** A production object check (`to_regclass`, `pg_proc` query) cannot distinguish
between drizzle-applied and manually-applied migrations. If manual applies accumulate, the
drizzle journal drifts silently: future invocations of `drizzle-kit migrate` see the table
objects as already-present and may skip or conflict on the next real migration. Verifying
application requires both the object check AND the applied-migrations table hash record.

**Distinctness.** Closely related to OBS-A (which covers the tool exit-code gap); OBS-C
specifically covers the object-existence-as-proof gap. Together they define the complete
post-deploy migration verification protocol: (1) confirm tool exit code (necessary, not
sufficient), (2) confirm objects exist (necessary, not sufficient), (3) confirm hashes in
applied-migrations table match on-disk files (sufficient). Each check alone is insufficient;
the conjunction is the proof. No existing rule codifies the "object exists != tool applied"
distinction.

**Two-wave-gate disposition: HELD.** Wave-37 OBS-D was the first implicit signal (manual apply
as remediation); wave-38 explicitly surfaced the verification antipattern. Two waves have now
touched the same gap from different angles. Pending a third wave or a scenario where
object-existence is the sole verification instrument used (and missed), this remains held.
If OBS-A is confirmed in a second wave, this sub-point should be folded into the same rule.
Nominated file: `command-center/principles/CI-PRINCIPLES.md` (same as OBS-A).

---

## OBS-D (INFORMATIONAL) — The `/health` version field reporting a stale build SHA is a persistent observability gap that has now confused two successive waves' verification steps

**Symptom.** Both V-1-karen and V-1-jenny independently flagged that `GET /health` returned
`version: a6ad02cb2d613291da7b62f48df2a4d64b08aeef` (a wave-30 commit, ancestor of the deployed
`e79f944`). Both noted it as non-blocking but required independent confirmation via the Railway
GraphQL deploy meta commitHash to rule out a wrong-artifact deploy. Source: `V-1-karen.md`
lines 38-38; `V-1-jenny.md` lines 45-46.

**Systemic gap.** The health endpoint's `version` field reads a static build-arg or env var
that is not wired to the actual deployed commit. This forces every verification pass to
cross-reference a second authoritative source (Railway GraphQL) rather than trusting the
health endpoint, adding verification overhead and creating a latent risk that a future wrong-
artifact deploy is dismissed as "the stale version field again."

**Distinctness.** CI-PRINCIPLES rule 1 already states: "Verify deployed commit via the
deployment's commitHash field, not the app self-reported /health version." The rule exists;
it was followed correctly both waves. This observation is not a rule gap — it is a recurring
application of the existing rule. The underlying fix (wire the build SHA into the health
endpoint) was noted as a non-blocking follow-up task (`26710959`) in V-2 triage and flagged
again here. Not a promotion candidate; informational tracking signal only.

**Two-wave-gate disposition: NOT NOMINATED.** The rule exists (CI rule 1). This is a
maintenance debt signal: task `26710959` (wire real build SHA to health endpoint) should be
resolved before it masks a future wrong-artifact deploy. No principles addition needed.

---

## Cross-wave summary (system health)

OBS-A is the headline: ghost-green journal drift is a silent-skip class that the migration
tool's exit code cannot detect. The complete post-deploy verification protocol (exit code +
object existence + hash-match in applied-migrations table) proved the mechanism in wave-38 and
should be codified as a CI rule when confirmed across a second wave.

Wave-37 OBS-D ("migration drift — nominated if fix not durable") is now RESOLVED. The fix
(ascending journal + preDeploy-only) is durable as proven by the wave-38 hash verification.
OBS-D is retired from the held queue.

Wave-37 OBS-A ("deploy-only fault invisible to green test suite") was promoted to
VERIFY-PRINCIPLES rule 4 (confirmed 2x). Wave-38 does not add a further confirmation of that
rule; the infra-fix wave did not exercise the deployed-E2E as a detection instrument (the
migration failure was found via direct DB query, not E2E navigation).

Held observations from prior waves not touched by wave-38:
- Wave-33 OBS-1 (external-API adapter mocked-fetch request-contract) — still single-wave.
- Wave-37 OBS-B (P-0 reuse-verification scope reduction) — still single-wave positive signal.
- Wave-37 OBS-C (branch loss via worker restart / reflog recovery) — still single-wave.

Rules promoted this wave: 0 (all observations single-wave; OBS-A/B/C held pending second-wave
confirmation).
Observations held forward: OBS-A (CI-PRINCIPLES candidate), OBS-B (BUILD-PRINCIPLES candidate),
OBS-C (CI-PRINCIPLES sub-kernel of OBS-A).
