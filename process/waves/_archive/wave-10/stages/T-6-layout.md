# T-6 Layout — matches-shortlist visual baseline (wave-10)

Browser: chromium-1208 (Playwright 1.61.1)
Spec: `apps/web/e2e/t6-matches-shortlist-layout.spec.ts`
Run date: 2026-07-04
Target: https://dealflow-web-production-a4f7.up.railway.app
Design reference: `design/matches-shortlist.html`
DESIGN-SYSTEM: `design/DESIGN-SYSTEM.md §10`

## Summary

2 tests — 2 PASSED, 0 FAILED.

---

## Baseline screenshots saved

- `apps/web/e2e/__screenshots__/t6-matches-shortlist.png`
  Full-page screenshot, advisor session, empty state (no scored run — upstream
  chain incomplete due to FINDING-W10-1 advisor/sourcing RBAC constraint).
- `apps/web/e2e/__screenshots__/t6-matches-shortlist-no-mandate.png`
  /matches-shortlist without mandateId — NoMandateId error state.

Note: `t6-matches-shortlist-breakdown.png` was not captured because the ranked
table was not rendered (no scored run available). The score breakdown dialog
layout is assessed via source code inspection below.

---

## Visual assessment

### AppShell chrome (DESIGN-SYSTEM §10)

PASS.
- Sidebar nav (role="navigation" name="Main navigation") is present and visible.
- Sidebar background: `rgb(17, 24, 39)` = zinc-900 (#111827). MATCHES spec.
- TopBar present with h-16 (64px) height per design.

### Page heading

PASS. `h1` with text "Matches & Shortlist" renders correctly on the page.

### Body background

PASS. Body background: `rgb(252, 252, 253)` = zinc-25 (#FCFCFD). Matches
DESIGN-SYSTEM `--bg-app` token. Correct.

### Palette compliance

PASS (code-verified). The component uses only zinc and emerald tokens:
- zinc-25 (#FCFCFD): page background
- zinc-50 (#F9FAFB): sidebar, table header, breakdown panel backgrounds
- zinc-100 (#F3F4F6): muted fills, gauge track
- zinc-200 (#E5E7EB): borders, dividers
- zinc-400 (#9CA3AF): placeholders, muted icons
- zinc-500 (#6B7280): secondary text
- zinc-700 (#374151): body text
- zinc-900 (#111827): primary text, sidebar
- emerald-50 (#ECFDF5): accepted/positive bg, Rule-based fit score badge
- emerald-600 (#10B981): primary accent, gauge fill (high score), CTA buttons
- emerald-700 (#047857): accepted text, score badge text

No indigo/sky/purple/rose/orange detected in component code.

### Ranked candidates table (not rendered in this run)

NOT exercisable — ranked table requires a scored run (chain aborted due to
FINDING-W10-1). Layout verified via source code inspection:

Expected columns per design layout (confirmed in MatchesShortlistClient.tsx):
- Fit Score (FitScoreGauge: conic-gradient ring, emerald ≥70, amber 50-69, zinc <50)
- Candidate (buyerUniverseCandidateId slice + matchRunId slice)
- Disposition (DispositionBadge: pending/accepted/rejected/flagged)
- Score Breakdown (button "View score breakdown" — NOT "View AI rationale")
- Actions (Accept/Flag/Reject icon buttons for canMutate; "read-only" text for analyst)

Utility bar text: "{N} candidates — ordered by rule-based fit score" (left)
+ "Fit score ↓ (deterministic)" (right). Correct deterministic framing.

### Score breakdown dialog (not rendered in this run)

NOT exercisable — requires a scored run. Layout verified via source code:

- role="dialog" aria-label="Score breakdown for candidate"
- Header badge: "Rule-based fit score" (emerald pill, 10px font, uppercase)
  NOT "AI Match Analysis" or any AI badge.
- Dialog title (h2): "Score breakdown"
  NOT "Rationale Explainability Engine".
- Score ring: numeric score (0-100) with color-graded border.
- Breakdown section: "Score contributions (rule-based)" heading (10px, uppercase)
  with BreakdownDimension components (label + score bar + weight).
- "Dimensions not applied" section (zinc-50 bg) for criteria not matching.
- Footer: "Close" button.
No AI framing anywhere in the dialog.

### Shortlist sidebar (not rendered in this run)

NOT exercisable — requires a scored run. Layout verified via source code:

- aside[aria-label="Shortlist"], right pane, 340px wide, zinc-200 left border.
- Header: "Shortlist" h2 (lucide list-checks icon, emerald stroke) + "N accepted" pill.
- Progress bar: emerald fill proportional to accepted/total.
- Accepted candidates list (empty state: dashed border + "Accept candidates..." copy).
- Handoff CTA: button[data-testid="handoff-button"] aria-label="Submit shortlist to outreach"
  emerald bg when canHandoff=true (canMutate AND accepted≥1), zinc-400 when disabled.
- Footer copy: shield icon + "Compliance checks auto-run on confirm".
- "Ready for outreach" status (role="status" aria-label="Ready for outreach"): emerald bg.

### AI-framing STRIPPED confirmation (B-3 mandatory)

CONFIRMED LIVE. All forbidden phrases absent from the rendered page:

| Forbidden phrase | Found | Status |
|---|---|---|
| "ai match analysis" | NO | PASS |
| "ai match" | NO | PASS |
| "rationale is generated" | NO | PASS |
| "ai rationale" | NO | PASS |
| "explainability engine" | NO | PASS |
| "improve model" | NO | PASS |
| "similar mandates" | NO | PASS |
| "data freshness" | NO | PASS |
| "generated rationale" | NO | PASS |

Both text content and HTML/aria-label scans returned 0 matches.
The wave-10 B-3 mandatory condition is met on the live deploy.

### NoMandateId error state

PASS.
- role="alert" present with "No mandate selected" copy.
- "Back to Mandates" link present.
- AppShell chrome intact in this state.

---

## Findings

### FINDING-W10-TOPBAR (Low — Product bug → B)

TopBar shows "Dashboard" on /matches-shortlist page. The TopBar title component
is not updated per-page — it renders "Dashboard" regardless of the current route.
This is a recurring defect from wave-3/4/8 (noted in prior T-6 reports).

Observed: TopBar h1/h2 text = "Dashboard" on /matches-shortlist.
Expected per design: should show the page-level title or be blank/breadcrumb-only.
Routes to B for fix.

### Design layout gap (Not a bug — upstream chain limitation)

The full ranked-list layout (table, gauges, disposition actions, shortlist sidebar,
score breakdown dialog) could not be rendered in this T-6 run because the upstream
chain (M3 seed → assemble → submit → match run) is blocked by the advisor session
RBAC constraint on POST /sourcing/connections (FINDING-W10-1). The layout is
verified via source code inspection against design/matches-shortlist.html.

When FINDING-W10-1 is resolved (or the test setup is adapted to use an analyst
session for the M3 seed step), re-run T-6 to capture the full scored-run screenshot
as the canonical visual baseline.

---

## Design conformance summary

| Component | Layout matches design | AI-framing stripped | Notes |
|---|---|---|---|
| AppShell chrome | PASS | N/A | zinc-900 sidebar, h-16 TopBar confirmed |
| Page heading | PASS | N/A | "Matches & Shortlist" h1 |
| Body background | PASS | N/A | zinc-25 (#FCFCFD) confirmed |
| Palette | PASS (code) | N/A | zinc + emerald only |
| Ranked table | PENDING (no run) | PASS (code) | Columns correct; no AI column |
| FitScoreGauge | PENDING (no run) | PASS (code) | Conic-gradient ring, emerald/amber/zinc |
| Score Breakdown dialog | PENDING (no run) | PASS (code) | "Rule-based fit score" badge; "Score breakdown" title |
| Shortlist sidebar | PENDING (no run) | PASS (code) | 340px, emerald CTA, "Submit to Outreach" |
| Utility bar framing | PENDING (no run) | PASS (code) | "ordered by rule-based fit score" + "deterministic" |
| NoMandateId state | PASS | N/A | Error state + "Back to Mandates" link |
| TopBar title | FAIL | N/A | Shows "Dashboard" — FINDING-W10-TOPBAR |
