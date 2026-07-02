# Wave 1 — T-5 E2E

**Pattern:** B (active-execution) — **degraded to live-URL HTTP smoke.** The Playwright `ui-comprehensive-tester` swarm could not launch: the host has no Chrome binary (`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`; `npx playwright install chrome` needs root, unavailable in this environment). For this wave's trivial UI (a single placeholder page displaying health status — no product flow, no auth, no forms), an HTTP smoke against the live deploy gives adequate coverage. Documented as a gap for real UI waves (M1+).

## Scenarios (traced to acceptance criteria)
| id | criterion | entry | expected | verdict | evidence |
|---|---|---|---|---|---|
| e2e-1 | Web page loads and shows health status | GET web root | 200, renders "DealFlow AI" + "Status: ok" | **PASS** | curl 200; body contains "DealFlow AI","Status","ok" |
| e2e-2 | Web→API wiring live end-to-end | web SSR fetch of /health | page shows live "ok" (proves the fetch to api succeeded in prod) | **PASS** | rendered "Status: ok" sourced from live /health |
| e2e-3 | API /health serves the contract | GET api /health | 200, `application/json`, `{status:ok,db:ok,version}` | **PASS** | body `{"status":"ok","db":"ok","version":"4cad0179…"}`, content-type application/json |

No FAIL / BLOCKED scenarios. No fix-up cycles needed.

## Gap (routed to V-2, non-blocking; L-2 T-5 principle candidate)
- **MEDIUM / infra:** no real-browser E2E possible until Chrome is installed on the host. This wave's UI is a throwaway placeholder with no interactions, so an HTTP smoke suffices; but the first real product-UI wave (M1+) MUST have `npx playwright install chrome` run host-side (needs elevated perms) before T-5, or the Playwright swarm cannot run and real user flows go unverified.

```yaml
test_pattern: active-degraded-http-smoke
skipped: false
testers_spawned: 0
swarm_blocked_reason: "host Chrome binary absent (npx playwright install chrome needs root)"
scenarios:
  - {id: e2e-1, criterion_ref: "web health page loads", verdict: PASS, evidence_path: "live curl 200 + body match"}
  - {id: e2e-2, criterion_ref: "web→api wiring", verdict: PASS, evidence_path: "rendered live ok status"}
  - {id: e2e-3, criterion_ref: "api /health contract", verdict: PASS, evidence_path: "live /health json 200"}
flakes_observed: []
fix_up_cycles: 0
findings:
  - {severity: medium, scenario: "all", description: "Playwright Chrome binary absent on host; real-browser E2E deferred to HTTP smoke this wave; install required before real UI waves"}
```
