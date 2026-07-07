# B-3 Frontend — wave-23 seller-intent (task 6840c25d)

## Scope

`apps/web/app/(app)/insights/page.tsx` + `page.test.tsx` + `next.config.ts`
(the prior B-3 run added the seller-intent section; this pass fixes 5 failing tests).

---

## Seller-intent section (SI)

Added `SellerIntentSection` sub-component below the existing `CalibrationSection`.

**Per-mandate table columns:** Mandate (truncated UUID), Intent score, Direction, Outreach Eng., Pipeline Vel., Match Disp.

**Sorting:** `[...sellerIntent].sort((a, b) => b.score - a.score)` — hottest mandates first.

**Direction rendering:** `directionChip()` helper returns color-coded `<span>` with `aria-label`:
- `heating` → emerald-600 (#10b981), "↑ Heating"
- `cooling` → amber-600 (#d97706), "↓ Cooling"
- `flat` → zinc-500 (#6b7280), "— Flat"

**Score column header:** "Intent score" (disambiguated from calibration's "Score band" — see fix B below).

**notApplied signals:** `isSignalNotApplied(breakdown.notApplied, key)` guards each signal cell; not-applied signals render "—" (absence of data) not "0" (zero-activity).

**Empty state:** `data-testid="seller-intent-empty"` paragraph when sorted list is empty.

**Error state:** `role="alert"` banner when `sellerIntent === null` (fetch failed / schema mismatch).

**RBAC:** page-level `assertRole('/insights', me.role)` gate; analyst + compliance are redirected before the section renders.

---

## SI1 — tieBreak NEVER surfaced

The API does not return `tieBreak` in the seller-intent response. Per SI1 it must not appear in any rendered output — not as a column, not as a caption, not as a footnote.

**Root cause of failure group A (4 tests):** The prior B-3 run added a visible `<p>` caption below the section heading:

```jsx
<p style={{ ... }}>
  Hottest mandates first — sorted by intent score. Breakdown: outreach engagement, pipeline
  velocity, match disposition. NO tie-break signal (SI1).
</p>
```

Testing-library's `queryByText(/tie.?break/i)` found this visible text. The wave-19 calibration tests (`queryByText(/tie-break/i)`) also failed because the same regex matched this new paragraph.

**Fix:** Removed the `<p>` caption entirely. The SI1 rationale is preserved only in a JSX block comment (comments are not rendered). The breakdown signals (outreachEngagement / pipelineVelocity / matchDisposition) are self-evident from the column headers; no caption is needed.

---

## Score column header disambiguation (failure group B — 1 test)

**Root cause:** `getByRole('columnheader', { name: /score/i })` matched two elements:
- Calibration table: `<th>Score band</th>` (matches `/score/i`)
- Seller-intent table: `<th>Score</th>` (matches `/score/i`)

Testing-library threw `Found multiple elements` error.

**Fix:** Renamed the seller-intent score header from "Score" to "Intent score". This is unambiguous and clearer for advisors (the calibration table uses "Score band"; no overlap). Updated the corresponding test assertion from `/score/i` to `/intent score/i`.

---

## Empty / loading / error states

| State | Trigger | Rendered |
|---|---|---|
| Error | `sellerIntent === null` (fetch non-ok or schema mismatch) | `role="alert"` banner — "Unable to load seller-intent data." |
| Empty | `sorted.length === 0` | `data-testid="seller-intent-empty"` paragraph — "No seller-intent signals yet." |
| Populated | `sorted.length > 0` | Per-mandate table, sorted descending by score |

---

## RBAC

Seller-intent data is gated by the page-level `assertRole('/insights', me.role)`. Roles `analyst` and `compliance` are redirected to `/` before any fetch runs. `advisor` and `admin` reach the section. No separate per-section RBAC gate is needed.

---

## Test results

`pnpm --filter @dealflow/web test`: **837 passed, 0 failed** (30 test files).

Targeted fixes:
- "SI1: tieBreak NEVER rendered > does NOT render any tieBreak or tie-break text" — PASS
- "wave-19 calibration: renders exactly 2 score dimension labels (tieBreak absent)" — PASS
- "wave-19 calibration: does NOT render a Tie-Break row" — PASS
- "wave-19 calibration: renders exactly 2 dimension rows" — PASS
- "wave-23 seller-intent: renders Intent score column header" — PASS

TypeScript: `tsc --noEmit` — clean (0 errors).

---

## Deviations

None. The seller-intent section content (score + direction + 3-signal breakdown, sorted descending, SI1 clean, empty/error/RBAC intact) matches the P-2 spec for task 6840c25d. The two test fixes are minimal and correct: removed a rendered string that violated SI1, renamed one column header for clarity.
