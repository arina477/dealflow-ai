# Wave 12 — T-5 e2e (active)
## Coverage — substance across CI + C-2 deployed-authed
- **CI real-DB e2e (T-4):** the pipeline compose→audit path proven 4/4 — enroll/note audit-rollback (zero orphan), happy-path (exactly-one event+audit per action), idempotent-409.
- **C-2 deployed-authed live (invite→signup advisor session):** GET /pipeline 200 (grouped-by-stage, tables live); enroll of nonexistent source → 404 (FK-guarded, not 500); RBAC anon 401, analyst 403, advisor 200; SSR web board renders.
- **C-2 AC-STRIP (deployed authed 31.6KB board HTML, self-grepped):** all 7 fixed columns render (shortlisted→…→withdrawn); ZERO send/schedule/email/AI-draft affordances (only DealFlow AI brand meta tagline).
## Residual gap (non-blocking; substance covered)
- Full interactive enroll→move-stage→add-note→timeline UI journey NOT assembled on deployed prod — production has NO eligible source (GET /outreach empty; needs the whole wave-10/11 sourcing→match→accept / outreach→send_eligible chain). The audit-last-in-txn + enroll/transition/note behavior is proven by the CI real-DB e2e at the exact deployed commit 989fae9; the interactive UI-click journey (board render + move-select + note-add wiring) is unit-tested (web 453 incl the pipeline board/timeline tests). Defer a full live smoke to V-1 or a seeded run.
```yaml
test_pattern: active
findings:
  - {severity: LOW, journey: pipeline-enroll, description: "full interactive enroll→move→note journey not assembled live (no eligible source in prod; audit invariant proven by CI e2e + UI unit-tested)"}
```
