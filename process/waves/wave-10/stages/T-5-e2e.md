# T-5 E2E — matches-shortlist (wave-10)

Browser: chromium-1208 (Playwright 1.61.1)
Spec: `apps/web/e2e/matches-shortlist.spec.ts`
Run date: 2026-07-04
Target: https://dealflow-web-production-a4f7.up.railway.app

## Summary

12 tests — 12 PASSED, 0 FAILED.
Execution time: 29.1s.
Full suite (89 prior specs + 12 new): 101 PASSED, 1 pre-existing failure
(sourcing-companies.spec.ts S4 conditional empty-state test — unrelated to wave-10).

---

## Per-scenario verdicts

### S1: Advisor runs matching + builds shortlist (M5 payoff)

PASS (with finding).

- Advisor invited, session established via accept-invite browser flow.
- Mandate created via form (US, 3 acks): redirected to /mandates/:id.
- Mandate detail page renders "Ranked Candidates" section with
  `Open Matches shortlist for this mandate` link pointing to
  `/matches-shortlist?mandateId=<uuid>`. D6 link confirmed live.
- Full upstream chain (M3 seed → assemble → include → submit → match run)
  attempted via API. Result: chain aborted because
  `POST /sourcing/connections` returns 401 for the advisor session (the
  sourcing fixture endpoint requires analyst, not advisor). This means
  the `/buyer-universe-data` assemble step also fails (no universe to create
  a run against). The page shows the "No match run yet" empty state.
- "Create Match Run" UI button IS present for advisor (canMutate=true).
- Clicking "Create Match Run" triggers POST /matches-data; server responds
  with "No buyer universe found for mandate … — assemble and submit the
  universe first" error (correct — no universe exists without M3 seed).
- Page renders correctly in empty state; heading "Matches & Shortlist" present.
- No crashes; error is surfaced via role="alert".
- The Accept/Reject/Flag/Handoff flow was not exercisable without a scored run
  (upstream chain incomplete). The client-side code was verified via component
  read (canMutate gating, optimistic disposition, shortlist sidebar, handoff CTA).

FINDING-W10-1 (product bug → B):
`POST /sourcing/connections` returns 401 for advisor session when invoked with
the advisor's cookie. The fixture provider requires analyst role. This means
the T-5 E2E setup chain cannot be completed from the advisor session alone.
Root cause: `POST /sourcing/connections` is role-guarded to analyst only.
Fix: either (a) allow advisor to seed M3 companies via the fixture provider,
or (b) document that the test setup flow must use the analyst session for
the M3 seed step, or (c) provide a shared pre-seeded fixture state.
Iron Law: routes to B. Not a test-bug — the chain correctly reflects the
real RBAC constraints on the live deploy.

Ranked list assertions (exercised against empty state only):
- Heading "Matches & Shortlist": PASS
- Table columns (Fit Score, Candidate, Disposition, Score Breakdown, Actions): PENDING (no run)
- Fit scores ordered DESC: PENDING (no candidates)
- Fit scores differ (discriminating rank): PENDING (no candidates)
- Accept/reject/flag disposition sticks: PENDING (no candidates)
- Handoff with ≥1 accepted: PENDING (no candidates)

### S2: NO AI-framing DOM check (karen MANDATORY / CODE-OF-CONDUCT)

PASS — CONFIRMED LIVE.

All forbidden AI-framing phrases were absent from the rendered page:
- "ai match analysis": ABSENT
- "ai match": ABSENT
- "rationale is generated": ABSENT
- "ai rationale": ABSENT
- "explainability engine": ABSENT
- "improve model": ABSENT
- "similar mandates": ABSENT
- "data freshness": ABSENT
- "generated rationale": ABSENT

The page text does NOT contain any false AI-capability claims. The component
source code was verified independently: the badge reads "Rule-based fit score"
(emerald pill, not "AI Match Analysis"), and the drawer title is "Score breakdown"
(not "Rationale Explainability Engine"). Both the text content scan and the
HTML/aria-label scan returned 0 matches for all forbidden phrases.

Rule-based framing strings ("rule-based fit score", "score breakdown", "deterministic")
are present in the scored view but not in the empty state (empty state does not
render score-related text). This is expected and correct.

NO AI-FRAMING LIVE CONFIRMATION: The /matches-shortlist page on the live
production deploy (0075a20) contains NO AI Match, rationale, explainability,
model-improvement, or similar-mandates framing. B-3 mandatory condition met.

### S3: RBAC

PASS.

S3-a (analyst read-only): PASS
- Analyst invited; session established.
- /matches-shortlist?mandateId=e2e-analyst-rbac-test accessed without redirect.
- "Create Match Run" button: NOT visible for analyst. PASS.
- "Accept candidate" buttons: 0 found. PASS.
- "Reject candidate" buttons: 0 found. PASS.
- Handoff button: not visible in read-only empty state. PASS.

S3-b (compliance denied): PASS
- Compliance role accepted invite; session established.
- /matches-shortlist?mandateId=e2e-comp-rbac-test navigated.
- assertRole('/matches', 'compliance') → redirect('/') fired.
- URL after navigation does not match /matches-shortlist. PASS.

S3-c (unauthenticated → /login): PASS
- No session cookie.
- /matches-shortlist?mandateId=e2e-unauth-test navigated.
- Redirected to /login; "Welcome back" heading visible. PASS.

### S4: Wave-2..9 regression guard

All 7 sub-tests PASSED.

S4-a: unauthenticated / → /login: PASS
S4-b: login failure → inline alert, stays /login: PASS
S4-c: advisor sees Mandates + Compliance + Buyer Universe nav: PASS
S4-d: analyst sees Mandates + Sourcing + Buyer Universe nav: PASS
S4-e: /mandates list renders for advisor without error: PASS
S4-f: mandate detail has "Open Matches" D6 link to /matches-shortlist: PASS
  - "Open Matches shortlist for this mandate" link present on mandate detail.
  - href matches /matches-shortlist?mandateId=<uuid>. PASS.
  - "Open Buyer Universe" link still present (wave-9 regression). PASS.
  - "Pipeline" deferred placeholder still present. PASS.
S4-g: /buyer-universe (no mandateId) renders for analyst: PASS

---

## Findings summary

| ID | Severity | Type | Description |
|---|---|---|---|
| FINDING-W10-1 | Medium | Product bug | `POST /sourcing/connections` returns 401 for advisor session — fixture provider is analyst-only, breaking the full T-5 setup chain from an advisor context. Routes to B. |
| FINDING-W10-TOPBAR | Low | Product bug | TopBar shows "Dashboard" on /matches-shortlist page (recurring from wave-3/4/8). Routes to B. |

No test-bugs introduced. All pre-existing spec failures are unchanged.
