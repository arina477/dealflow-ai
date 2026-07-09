# Wave 37 — L-block observations (reality-checked, systemic)

Sources: `process/waves/wave-37/stages/TV-closeout.md`, `process/waves/wave-37/blocks/C/verify.md`,
`process/waves/wave-37/stages/P-2-spec.md`, prior L-block observations at
`process/waves/_archive/wave-33/blocks/L/observations.md` (OBS-1),
`process/waves/_archive/wave-34/blocks/L/observations.md` (OBS-4).

Vetted by `knowledge-synthesizer` (retro/distill). Each observation traces a symptom to a
**systemic gap** (missing verification layer / missing safeguard), never to human error.
Wave-specific until a second wave confirms per each `*-PRINCIPLES.md` "Contract for new rules"
authoring discipline.

---

## OBS-A (STRONGEST — CONFIRMED-2X — PROMOTION-READY) — A deploy-only fault is invisible to a green test suite and caught only by a deployed-origin E2E pass

**Symptom.** POST /auth/signup-firm returned HTTP 500 ("function does not exist") on the
deployed app immediately after the wave-37 deploy. All 1077 api + 1004 web unit/integration
tests were green; the deploy itself was green (process reporting healthy). The self-serve
create-firm feature was completely non-functional live. Root cause: migration 0021
(CREATE OR REPLACE FUNCTION create_firm_workspace + GRANT) did NOT auto-apply to prod despite
MIGRATE_DATABASE_URL being set — the function the endpoint calls did not exist in prod.
Applied manually. The rate_limit_hits table had the same drift (prior wave). Deployed-state
E2E pass (browser: login link → /create-firm → firm name+email+password → workspace landed,
0 5xx) caught it on the first attempted navigation; the unit/integration suites had no
structural ability to observe it because they do not exercise the real deployed database state.
Follow-up task 7f4d150b authored to root-cause and fix migrate-on-boot.

**Systemic gap (not human error).** No verification layer between "green test suite + green
deploy pipeline" and "the deployed app actually works" exists for deploy-state faults (missing
migrations, missing grants, missing database functions). The gap is structural: unit and
integration tests run against a controlled local/CI database and cannot observe whether a
migration reached prod. Only a deployed-origin E2E exercising the real prod DB state can close
this gap. The deployed E2E caught it in the first live request; the counterfactual (500 →
201/landed on manual migration, same code path) is the proof.

**Cross-wave lineage (decisive for promotion).**

Wave-34 OBS-4: AppShell.tsx server-component event-handler caused HTTP 500 on every
authenticated route in the deployed build. Unit + integration tests green; deploy green.
Deployed-origin E2E (browser, authenticated routes) caught it in the first navigation.
Root cause: Next.js hard-errors on event-handler props in Server Components — a deployed-build
render path that no isolated test exercises. Fault class: deploy-only server-render fault.

Wave-37 OBS-A (this wave): migration 0021 not applied to prod DB caused HTTP 500 on first
signup call. All tests green; deploy green. Deployed-state E2E (browser, self-serve signup
flow) caught it on first attempt. Root cause: migrate-on-boot not firing — a deployed-infra
state that no isolated test exercises. Fault class: deploy-only DB-state fault.

Both incidents share the **same kernel**: fault exists ONLY in deployed state (deploy-only),
all isolated tests pass (green-in-isolation), a deployed-origin E2E pass is the sole
verification instrument that catches it. The sub-kernel differs (server-render vs. DB-state),
but the general verification rule — run one full E2E pass against the deployed build every
wave — addresses both equally: a server-render 500 is caught by navigating authenticated
routes; a missing-migration 500 is caught by exercising the first real user flow. The
wave-34 drafted rule form ("Run one full end-to-end pass against the deployed build every
wave, not only green unit and integration suites") is more general than the wave-34
server-render-specific "Why" line. The Why line needs to be updated to cover both sub-kernels.

**Verdict: CONFIRMED-2X.** Two real production incidents, two waves, same detection instrument
(deployed-origin E2E), same blind spot (green-in-isolation), distinct sub-kernels that the
general rule form covers. Promotion-eligible pending head-verifier approval.

**Promoted rule candidate (updated from wave-34 draft — Why line generalized):**
```
5. Run one full end-to-end pass against the deployed build every wave, not only green unit and integration suites.
   Why: A deploy-only fault (missing migration, broken server render) passes every isolated test yet 500s live.
```
(rule 111 chars ≤120; why 96 chars ≤100; 2 lines; no wave refs, no war stories, no em-dash,
no we/our/the-team; does not duplicate existing VERIFY rules 1-3 — pre-verified against Contract.)

**Two-wave-gate disposition: PROMOTE.** Wave-34 = first confirmation (held). Wave-37 = second
confirmation (distinct sub-kernel, same general pattern). Both drafted in Contract format.
Head-verifier approval required before appending to VERIFY-PRINCIPLES.md.

---

## OBS-B (POSITIVE, confirmatory) — P-0 reuse-verification prevents secretly-large waves

**Symptom.** Wave-37 surface was "self-serve firm setup + admin grant-admin from UI" — which
reads as medium-to-large new build. Karen 5/5 reuse-verification at P-0 found that 5 of the
6 major components (role-change endpoint PATCH /admin/users/:id/role, assignRoleAsActor,
last-admin-guard 409, M8-RLS, audit-log chain) pre-existed and required zero new code. The
genuinely new surface was scoped to: 1 signup path (POST /auth/signup-firm with
SECURITY-DEFINER server-minted workspace_id, atomic+compensate), migration 0021, create-firm
UI, and a login entry link. Without the reuse pass, the wave plan could plausibly have
re-implemented multiple pre-existing mechanisms, adding build risk, test surface, and
potential behavioral drift from the proven implementations.

**Systemic gap addressed (positive signal, not a defect).** The P-0 reuse-verification
discipline proactively surfaces scope reduction before planning commits to unnecessary build.
The 5/5 result here is a strong signal that the discipline is functioning as designed: a
wave that looks medium-large contracts to a thin authentic build when the reuse inventory is
checked systematically. The reuse finding was the primary input to the plan's "thin"
characterization and drove B-block scoping to the genuinely new surface only.

**Distinctness.** This is a positive-outcome observation, not a defect. Not a near-duplicate
of any existing rule in VERIFY-PRINCIPLES or BUILD-PRINCIPLES (no rule codifies the P-0
reuse-verification as a scope-reduction instrument). Adjacent to BUILD planning principles.

**Two-wave-gate disposition: HELD.** Single-wave positive signal. Nominated for PRODUCT or
BUILD PRINCIPLES if confirmed across a second wave where the same reuse-verification
materially prevents a scope inflation. Not a VERIFY rule candidate (it is pre-build, not
post-deploy verification).

---

## OBS-C (informational) — Branch loss via worker restart is recoverable via git reflog without replay

**Symptom.** A worker restart during wave-37 reset the working branch to origin/main,
discarding committed D-block + backend + frontend work that had not been pushed. The work was
recovered via `git reflog` to the dangling commit containing the full branch state, with no
code replay required.

**Systemic gap.** No automated push-to-remote gate exists after each block (D, B) is merged
internally. The reflog recovery worked because the commit graph was local and intact; a
harder reset or garbage-collect window would have made it unrecoverable. The gap is between
"work is committed locally" and "work is durably persisted remotely."

**Distinctness.** This is an infra-resilience gap, not a verification layer gap. Not adjacent
to any existing VERIFY or BUILD principle. Candidate for an operational principle (push remote
after every block gate) if confirmed in a second wave.

**Two-wave-gate disposition: HELD.** Single-wave. Positive-recovery outcome (reflog worked),
but the gap remains latent. If a second wave encounters the same restart-induced branch loss
and reflog is unavailable (e.g., garbage-collected or different host reset), promote to BUILD
or operational principles. Nominated file: `command-center/principles/BUILD-PRINCIPLES.md`.

---

## OBS-D (informational) — Migration drift is a systematic deploy-readiness gap, not a one-off

**Symptom.** Migration 0021 (this wave) and rate_limit_hits table (prior wave) both failed
to auto-apply to prod despite MIGRATE_DATABASE_URL being configured. Two distinct migrations
across two waves exhibited the same drift. The migrate-on-boot mechanism is not reliably
executing on deploy.

**Systemic gap.** The deploy pipeline's migrate-on-boot is non-deterministic or silently
failing. A green deploy status does not certify that migrations applied. The current state
relies on manual detection (the deployed E2E failing, not a migration-state check) and manual
remediation (psql apply). No automated post-deploy migration-state verification exists.

**Distinctness.** This is the infra-sub-kernel under OBS-A — it explains WHY the deployed
E2E catches what tests miss. It is separately nominated here because the migration drift
itself is a recurring infra gap (two waves) deserving a follow-up task of its own (7f4d150b
authored). Not a VERIFY rule candidate on its own (the deployed-E2E rule in OBS-A already
covers detection); a candidate for a BUILD/infra principle around post-deploy migration-state
certification if the root cause fix in task 7f4d150b is not durable.

**Two-wave-gate disposition: HELD.** Sub-kernel of OBS-A; migration-specific. Two-wave
recurrence of the drift noted. If migrate-on-boot remains unreliable after task 7f4d150b,
nominate for BUILD-PRINCIPLES as "verify migration state post-deploy before certifying the
deploy." Nominated file: `command-center/principles/BUILD-PRINCIPLES.md`.

---

## Cross-wave summary (system health)

OBS-A is the wave-37 headline and the observation that crosses the 2-wave promotion threshold.
The meta-pattern "green-in-isolation is not green-against-reality" (wave-33 cross-wave note,
wave-34 cross-wave note) has now manifested in three consecutive waves under two distinct
sub-kernels (wave-33: external-API request contract; wave-34: deployed server-render; wave-37:
deployed DB-state / migration) — but only the deployed-E2E kernel (wave-34 + wave-37) has
achieved 2-wave confirmation of the SAME general rule. OBS-A is the formal promotion candidate.

Wave-33 OBS-1 (external-API adapter mocked-fetch request-contract) remains HELD — wave-37
did not involve any external-API adapter live-verify that would serve as second-wave
confirmation. That observation remains at single-wave; its pre-loaded second site (Affinity
adapter live-verify) is still the standing candidate for its confirmation.

**Rules promoted this wave: 0 (pending head-verifier approval for OBS-A candidate).**
**Observations held: OBS-B, OBS-C, OBS-D (single-wave or sub-kernel).**
**Promotion-ready candidate: OBS-A → VERIFY-PRINCIPLES.md rule 5 (head-verifier approval required).**
