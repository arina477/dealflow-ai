# Wave 17 — P-0 Frame

## Discover
- wave_db_id: f20122c8-89b6-489e-a6b8-34050a09f954 (wave_number 17, milestone M8)
- Prior-work: M7 shipped/blocked (admin complete-modulo-#141); wave-16 N-1 BOARD (7/7) advanced to M8. This is M8's first bundle (BOARD-authored vertical).
- Roadmap milestone: M8 — Pilot-partner workspace data-isolation (in_progress, Class product-feature, Tier T4, H2). Success metric _TBD-by-founder; testable proxy = qualitative "no cross-firm data visibility" + the cross-tenant negative-read proof (task 4).
- Spec-contract short-circuit: no-prior-spec (decomposer prose rows) → full P-1..P-3.
- Product decision: the _TBD quantitative success metric is a founder-poll (surfaced in the wave-16 N-1 digest) — NOT a hard-stop on building the isolation foundation this wave (ceo-reviewer concurs). Build against the qualitative bar + negative-read proof; founder defines the quant metric async.

## Reframe
### Original framing
4-task M8 data-isolation vertical: (seed) workspaces anchor + workspace_id scoping column across tenant tables; deny-by-default RLS by workspace_id; propagate authed workspace into every request-scoped DB session; cross-tenant negative-read integration test. ONE partner firm (not H3 SaaS).

### problem-framer — PROCEED
DB-level deny-by-default RLS keyed on workspace_id is the correct CAUSAL fix (app-layer WHERE-filtering is the classic multi-tenant leak antipattern). Scope = minimum-correct isolation primitive (not premature SaaS, not a leaky half-measure). 4-task vertical coherently layered. **3 non-blocking correctness obligations → P-2/P-3 (grounded in shipped schema):**
- **(A) FORCE RLS + owner-connection test [LOAD-BEARING]:** the API runs as the table-OWNING role → RLS needs explicit `FORCE ROW LEVEL SECURITY`, AND the negative-read test (task 4) must run over that same owner connection — else a FALSE-GREEN (RLS silently bypassed for the owner).
- **(B) audit_log_entries workspace_id [LOAD-BEARING]:** adding workspace_id to audit_log_entries must be HASH-EXCLUDED (wave-14 mandate_id precedent) OR bump chain_version; RLS SELECT policies must NOT break the chain verifier's full-chain walk (verifyChain must stay ok:true).
- **(C) backfill:** existing rows → default-workspace backfill BEFORE NOT NULL + deny-by-default cutover.
- Sizing signal (P-1): request-scope propagation (task 3) is greenfield (zero current_setting/SET LOCAL today); RLS across N tables + backfill = potentially a big wave.

### ceo-reviewer — SELECTIVE-EXPANSION
Right next move (M5/M6/M7 all blocked + un-unblockable by the brain; M8 is the movable high-value milestone tracing to the compliance-wedge bet whose falsifier is the partner firm's trust) at the right ambition (durable deny-by-default DB-RLS scoped to ONE firm, not premature H3 SaaS). ONE cheap-but-disproportionate BOUNDARY correction (NOT new tasks): the RLS (task 2) + negative-read proof (task 4) MUST explicitly include the **M2 audit_log + recordkeeping-export READ surfaces** in the isolation boundary — WORM (append-only) ≠ tenant-scoped-on-read; the single worst leak for a compliance-first M&A tool is one firm reading the other's audit/communication record. The "no change to WORM guarantees" carve-out must NOT be misread as "audit_log is exempt from read-isolation." _TBD metric = founder poll, not hard-stop.

### mvp-thinner — OK
Atomic isolation vertical: each of the 4 ACs fails the trace test if removed (anchor inert without RLS; RLS breaks-app/fails-closed without request-scope propagation; no isolation CLAIM without the negative-read proof). The one candidate thinness (split RLS high-sensitivity-now vs low-later) would ship a wave that CLAIMS isolation but leaks — there are NO low-sensitivity tenant tables in an M&A confidentiality context. Nothing splittable. NOT OVER-CUT (cutting the test/propagation = worst outcome for a confidentiality feature).

### Mediation (ceo-reviewer vs mvp-thinner)
No conflict: ceo's SELECTIVE-EXPANSION corrects the isolation BOUNDARY of existing ACs (audit/recordkeeping read-scoping into task 2/4), doesn't add tasks; mvp-thinner OK keeps all 4. Both survive. Precedence n/a.

### Disposition: PROCEED
Final framing → P-1: 4-task M8 data-isolation wave (multi-spec). Fold in: problem-framer's 3 correctness obligations (FORCE-RLS+owner-connection-test, audit_log-hash-exclude+chain-verifier-safe, backfill-before-cutover) + ceo-reviewer's boundary correction (audit_log + recordkeeping read surfaces IN the RLS + negative-read proof). SECURITY-SCOPE-TIGHTENED by nature (multi-tenancy/RLS/auth/data-isolation) — P-4 confirms.

claimed_task_ids: [0db154ff-31f1-45c4-85cd-71d34d65c437 (seed), e45ba68c-80f3-475e-a240-54c23ea9ccb2, 96026365-77b2-4763-bf57-705fbf340ba8, df2f3b2f-6e7d-4f39-a6ab-7ca49020e967]
