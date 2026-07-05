# Wave 11 — T-5 e2e (active)
## Coverage (deployed prod @ af5b5d9) — substance PROVEN across CI + C-2 authed + T-5 unauth
- **CI real-DB e2e (T-4):** the compose→gate flow proven 6/6 — approved+SoD-clean→send_eligible; no-approval/SoD/content-drift→blocked; M-2 conflict.
- **C-2 authed live (self-minted invite→signup sessions):** advisor GET /outreach-templates 200 + GET /outreach 200 (tables live); created a real template+v1 live; advisor compose vs UNAPPROVED version → NOT send_eligible (FK/gate-guarded 400) — the gate is live + does not yield send_eligible without approved prereqs. AC-STRIP verified on the DEPLOYED authed HTML (76KB composer / 22KB compliance-queue / 22KB templates): zero Send/Schedule/AI-draft CTAs, CTA 'Run Compliance Gate & Create Record' present, 'No email has been sent' correctly post-compose-gated.
- **T-5 unauth (ui-comprehensive-tester):** all 3 new routes correctly guard unauth → client-redirect to /login, zero console errors.
## Residual gap (non-blocking; substance covered above)
- Interactive Playwright UI-CLICK journey (select approved template + recipient → click compose → visually assert the send_eligible/blocked verdict PANEL after submit) NOT captured as a browser-click flow. The verdict panel's rendered COPY (send-eligible/no-email vs blocked+reason) is present in the authed HTML (C-2) + unit-tested (web 431 incl composer C. gate-verdict tests); the click-through animation was not exercised. A full happy-path live send_eligible needs the whole sourcing→match→accept→approve-by-different-user→compose chain (cross-user SoD seed) — deferred to V-1 or a dedicated smoke.
```yaml
test_pattern: active
findings:
  - {severity: LOW, journey: outreach-compose, description: "interactive UI-click gate-verdict panel not captured as a browser flow (copy verified in authed HTML + unit tests; full live send_eligible needs cross-user SoD chain)"}
```
