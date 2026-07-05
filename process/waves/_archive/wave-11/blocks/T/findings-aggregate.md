# Wave 11 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | MEDIUM | T-5/T-6/T-8 | Deployed test-credential registry (command-center/testing/test-accounts.md) is an EMPTY template + test_users.local_dev empty → a FRESH tester cannot self-serve authed deployed testing. The brain works around via the invite→signup flow (head-ci-cd did this at C-2). Recommend: populate test-accounts.md with the 4 personas OR document the invite→signup flow for testers. Cross-wave carry-forward (affects V-1 too). NOT a wave defect. |
| 2 | LOW | T-5 | Interactive UI-click gate-verdict panel not captured as a browser flow (verdict copy verified in authed HTML + web unit tests; full live send_eligible needs cross-user SoD sourcing chain). |
| 3 | LOW | T-6 | Authed visual screenshots (mobile/design-fidelity) not captured on deployed prod (structure verified via authed HTML + D-3 + component tests). |
| 4 | LOW | T-8 | Cookie-attribute/session-rotation not freshly probed (auth backbone unchanged by wave-11). |
| 5 | INFO | env | POST /auth/signup → 500 is CORRECT (app is invite-only by design, wave-2). NOT a defect. |
| 6 | LOW | env | Playwright MCP pinned to absent chrome channel (/opt/google/chrome) — testers must use project-local chromium. Infra, not product. |
## Compliance substance — PROVEN (not a gap):
- Non-bypassable gate reaches send_eligible ONLY via passing evaluate(): CI real-DB e2e 6/6.
- SoD (composer≠approver) + RBAC (compliance-only approve) + version-binding + content-hash: CI e2e + outreach.spec + C-2 live RBAC.
- AC-STRIP / CODE-OF-CONDUCT provenance (no false send/AI): C-2 grep of deployed authed HTML.
- Audit chain last-in-txn: audit.spec + e2e append path.
findings_total: 6 (0 critical, 0 high, 1 medium, 4 low, 1 info)
