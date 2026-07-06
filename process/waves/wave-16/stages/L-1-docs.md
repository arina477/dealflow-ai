# L-1 Docs — Wave 16 (M7 admin-hardening)

**Ship state:** LIVE @d72d7cb; V-block APPROVED (Karen + jenny + head-verifier). Mode: automatic.

## CHANGELOG
- **Entry:** `## [0.16.0] — 2026-07-06 — Admin hardening & compliance-default cascade (M7)`
- **Location:** `CHANGELOG.md` lines 3–20 (prepended above `[0.15.0]`).
- **House style:** matches ### Added / ### Correctness / compliance / ### Provenance (transparency); declarative present-tense, PM-readable (rule 16); Claudomat/DealFlow AI framing, no "Claude" (rule 18).
- **Compliance-load-bearing bits credited:**
  - The **compliance-default cascade** — new mandates now inherit firm defaults (jurisdiction → derived disclaimer + suppression scope) for unset fields; explicit values win; no retroactive mutation. This **closes the write-only gap** explicitly flagged in 0.15.0.
  - The **admin activity view** (/admin/activity) — read-only oversight over the immutable audit log.
  - The **race-safe invite dedup** — re-invite of registered/pending email refused (409), race-safe.
  - The **config secret-boundary** — connection-config field rejects secret-shaped values, no echo.

## Milestone delta — M7 (id 08d3053a-48fb-4562-a25b-6d99d40b0f62)
- **Status: in_progress → in_progress** (NOT closed — open children remain).
- **This wave marked done:** 6 M7 tasks (wave_id 737f2b22):
  - 904a3c25 — firm default-compliance-profile cascade into mandate creation (seed)
  - 8bb0a22f — admin activity view (read-only)
  - 042cf4e6 — reactivate / undo path for soft-deactivated users
  - c54db02d — invite duplicate/existing-user handling (409, race-safe)
  - 2560fecc — guard config JSONB against raw secrets
  - 6f1a96da — admin nav entry / in-app link to /admin/integrations
- **Open M7 children: 4** (all `todo`, wave_id NULL):
  - be2d9717 (G-1) — constrain data-source config fieldMapping values (residual, V-2)
  - a65cf75e (G-2) — widen invite advisory-lock key space (hashtext 32-bit collision, V-2)
  - 8f24c4c7 (G-3) — make admin-activity pagination cursor opaque (V-2)
  - bfadcec1 — tighten test-fixture typing in wave-1 health tests (unparented carryover)
- **open_count = 4 > 0 → M7 STAYS in_progress.** DB write: none (no transition).

### Complete-modulo-#141 judgment (flag for founder digest / N-block)
M7 Success metric has three legs: (1) connect a data source — **shipped**; (2) invite users + assign roles — **shipped** (wave 15 + this wave's race-safe dedup + reactivate); (3) verify a sending domain so the firm can send compliant outreach — **NOT shipped, founder-gated on #141** (email-provider / sending-domain DKIM/SPF/DMARC credential seam).

**Verdict:** M7 is **functionally shipped except the founder-gated sending-domain leg.** The 3 open non-gated follow-ups (G-1/G-2/G-3) are hardening residuals, not milestone-blocking capability gaps; bfadcec1 is unrelated testing-infra debt. M7 is effectively **complete-modulo-#141** — but status stays `in_progress` honestly, because both #141 (sending-domain leg) and the 4 open tasks remain. Surfaced for the founder digest / N-block disposition. Do NOT close M7.

### Backlog-stockout note for N-1
Open non-gated M7 tasks = 3 (G-1/G-2/G-3; bfadcec1 is unparented testing-infra debt, not an M7-capability seed). This is at/near the 3-task threshold — **flag potential backlog-stockout for N-1**: if N-2 consumes a seed this cycle, N-1 Action 7 (milestone-decomposition) may need to fire, OR M7 approaches complete-modulo-#141 with no shippable non-gated scope left, which is itself an N-block milestone-disposition signal.

## README
- **Skipped.** No new env var, no user-facing quick-start/command change this wave. README Quick start delegates env/db/run to `project.yaml` (no inline env list to update); invite-only auth prose (README:40–42) is unchanged — dedup/race-safety is internal behavior, not a documented-flow change. Per L-block dispatcher: "L-1 README sub-action skips when nothing user-facing changed."

## Commit
- **SHA:** 471d47f
- **Message:** `docs: L-1 wave-16 closeout (changelog)`
- **Pushed to:** main (automatic mode, direct push).

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md lines 3-20 — [0.16.0] Admin hardening & compliance-default cascade (M7)"
  - "M7 (08d3053a) delta: in_progress→in_progress; 6 done this wave; 4 open (G-1 be2d9717, G-2 a65cf75e, G-3 8f24c4c7, carryover bfadcec1); no DB transition"
  - "README: skipped (no user-facing/env change)"
  - "commit 471d47f pushed to main"
note: "M7 effectively complete-modulo-#141 (sending-domain leg founder-gated); status stays in_progress honestly. Backlog-stockout candidate flagged for N-1 (3 open non-gated tasks)."
```
