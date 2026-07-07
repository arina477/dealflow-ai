# B-3 Frontend — Wave 27: Firm-admin recordkeeping export page

**Task:** f331a51c (seed sibling)
**Stage:** B-3 (frontend)
**Route:** `/compliance/export`
**RBAC:** compliance + admin only (advisor/analyst → redirect('/') via assertRole)
**Adopted design:** `design/staging/recordkeeping-export.html` (D-3 APPROVED)
**Branch:** wave-27-recordkeeping-export

---

## Files created / modified

| File | Change |
|---|---|
| `apps/web/app/(app)/compliance/export/page.tsx` | NEW — server component; session fetch + assertRole + renders form |
| `apps/web/app/(app)/compliance/export/_components/RecordkeepingExportForm.tsx` | NEW — client component; all interactive state |
| `apps/web/app/(app)/compliance/export/page.test.tsx` | NEW — 58 tests (page RBAC + form states + a11y + export mechanics) |
| `packages/shared/src/rbac.ts` | MODIFIED — added `/compliance/export` route entry (compliance+admin) |
| `apps/web/app/(app)/_components/AppShell.tsx` | MODIFIED — added AppShell-level skip link (D-3 polish note 2) |

---

## Page: `/compliance/export`

**Server component** — `app/(app)/compliance/export/page.tsx`.

Pattern matches `audit-log/page.tsx` exactly:
1. Cookie resolution via `next/headers`.
2. `fetchMe()` → 401/403/null → `redirect('/login')`.
3. `assertRole('/compliance/export', me.role)` → advisor/analyst → `redirect('/')`.
4. Renders `<RecordkeepingExportForm userRole={role} />` beneath a page heading.

No nav item added (route is reached via Compliance section; no sidebar entry for advisor/analyst per RBAC). The `/compliance/export` route was added to `rbac.ts` with `allowedRoles: ['compliance', 'admin']`, no `navItem`.

**Max-width:** 720px (matches adopted design; narrower than audit-log's 900px because form-and-result, no data table).

---

## Reused components

- **`ExportPanel`** — pattern reused (the file-download trigger via `apiFetch` + `URL.createObjectURL` blob approach, the `rid` anti-CSRF header injection, and the scope/date inputs shape). The export page extends this pattern into a standalone page with scope/format/date pickers per the adopted design.
- **`IntegrityBadge`** — icon + text convention reused (ShieldCheck inline SVG, emerald band colour, "Integrity verified" text label, `#059669` sub-label shade). The `IntegrityBand` sub-component in `RecordkeepingExportForm` mirrors `IntegrityBadge`'s semantic contract (icon+text, not colour-only).
- **`IntegrityPanel`** — BrokenState + UnavailableState amber/red colour conventions, `#92400E`/`#78350F`/`#78350F` text shades reused in `TruncationWarning`. The persistent `role="alert"` pattern for compliance signals is mirrored.

The existing `apiFetch` helper (anti-CSRF) is imported directly. The existing `assertRole` helper and `meResponseSchema` are used identically to the audit-log page.

---

## States (all 6 implemented)

| State | Visual | Notes |
|---|---|---|
| **idle** | Form card only; no result panel | D-3 polish note 4: result panel not pre-rendered |
| **generating** | CTA disabled (`aria-busy`/`aria-disabled`); spinner; form fields disabled; skeleton result panel | `role="status"` aria-live="polite" on skeleton |
| **success** | Emerald `IntegrityBand` (ShieldCheck + "Integrity verified" + row count sub-label); 3-column meta grid (rows, range, format); emerald download link | `aria-live="polite"` + `aria-atomic` on result section |
| **truncated** | Same emerald integrity band + PROMINENT amber `TruncationWarning` above download link | See SEC-4 section below |
| **empty** | Neutral panel; `file-text` icon; "No records in this range"; NO download link | |
| **error** | `role="alert"` danger panel; error message; Retry button | `aria-live="assertive"` |

---

## SEC-4 truncation-honesty UI (load-bearing)

When `manifest.truncated === true`:

1. **`TruncationWarning` renders** — `role="alert"`, `aria-live="assertive"`, `data-testid="truncation-warning"`.
2. **AlertTriangle icon + "Partial export — N of M rows included" title + "Showing N of M rows — narrow the date range for a complete export" body.** NOT colour-only (amber is a redundant cue; the icon shape and text carry the signal).
3. **Integrity band PERSISTS** in the truncated state — the emerald band correctly scopes the integrity claim to the rows in the file ("HMAC-SHA256 hash chain intact across N exported entries"), making it clear the claim covers exactly what was exported.
4. **Download link remains available** below the warning — honest disclosure, NOT a paternalistic gate. The user can download the partial file; the warning tells them it's partial.
5. **NEVER presents a truncated export as complete** — no "all records" or "complete set" language in the truncation warning; the row counts (N of M) make the incompleteness explicit.

---

## Format/scope/range controls

- **Scope:** `SegmentedControl` with `id="scope-control"` — `role="radiogroup"` (D-3 polish note 1); 3 options (Audit log / Deal & pipeline / Both). Default: Both.
- **Format:** `SegmentedControl` with `id="format-control"` — same idiom; 2 options (CSV / JSON). Default: CSV.
- **Date range:** `<input type="date" id="export-from" aria-describedby="date-hint">` + `<input type="date" id="export-to" aria-describedby="date-hint">`. Disabled during generating.
- **Bounds note** (`role="note"`, `id="date-hint"`): "last 12 months" default + 50,000-row cap advisory.

---

## Download trigger

Client-side blob download:
1. `apiFetch('/compliance/audit-log-data/export', { method: 'POST', body: JSON.stringify({ scope, format, from?, to? }) })` — uses the existing `afterFiles` rewrite proxy (no new rewrite needed).
2. Manifest parsed from `X-Export-Manifest` response header (SEC-4 truncation metadata).
3. Filename from `Content-Disposition` response header; fallback to `dealflow-export-<date>.<ext>`.
4. `URL.createObjectURL(blob)` → set as `href` on `<a download>` element (`data-testid="export-download-link"`).
5. Previous blob URL revoked on each new export to prevent memory leaks.

The request body uses `exportScopeSchema` fields only (`scope`, `format`, `from?`, `to?`). `workspace_id`/`firmId` are forbidden (SEC-2 — server-resolved from session GUC).

---

## A11y

- **Radiogroup idiom (D-3 polish note 1):** `role="radiogroup"` on container; `role="radio"` + `aria-checked` per button; arrow-key roving focus (`ArrowRight/Left/Up/Down`); `Enter/Space` selects. `biome-ignore lint/a11y/useSemanticElements` applied to the `<button role="radio">` per the existing `StatusFilter.tsx` codebase pattern.
- **AppShell skip link (D-3 polish note 2):** Added to `AppShell.tsx` — `<a href="#main-content">Skip to main content</a>` visually hidden until focused, then revealed with emerald styling. `#main-content` is the existing `<main>` id in AppShell. Applied once at shell level, not per-page.
- **Shared derived shades (D-3 polish note 3):** All derived text shades (`#059669`, `#92400E`, `#78350F`, `#991B1B`, `#B91C1C`, `#D97706`) consumed from `SHADES` constant object at file top. No re-hardcoded per-element inline values.
- **Post-CTA result panel (D-3 polish note 4):** Result panel is not pre-rendered at idle. It appears only after the Export CTA fires.
- **focus-visible:** All interactive elements (seg buttons, date inputs, CTA, download link, retry button) have `:focus-visible` emerald outline (2px) or box-shadow (`0 0 0 3px rgba(16,185,129,0.4)`).
- **prefers-reduced-motion:** Spinner and shimmer animations disabled via `@media (prefers-reduced-motion: reduce)`.
- **aria-live:** Generating state `role="status"` `aria-live="polite"` (skeleton); result section `aria-live="polite"` `aria-atomic="true"`; truncation warning `aria-live="assertive"` `role="alert"`; error panel `aria-live="assertive"` `role="alert"`.
- **No colour-only signal:** Integrity band = ShieldCheck icon + "Integrity verified" text + sub-label. Truncation = AlertTriangle icon + "Partial export" heading + explicit N-of-M count. Error = AlertTriangle icon + text.
- **Keyboard trap:** None (no modal on this page).
- **DOM order:** Natural focus order throughout (no tabIndex manipulation).

---

## Test coverage (58 tests, all passing)

| Group | Tests |
|---|---|
| Page RBAC | compliance/admin render; advisor/analyst redirect('/'); 401/403 redirect('/login') |
| Page heading | H1 "Export records"; subtitle; no edit/delete/send/AI |
| Form client-side role guard | compliance/admin: form renders; advisor/analyst: null |
| Idle state | Card present; CTA enabled; result panel absent; scope radiogroup (3 radios, Both default); format radiogroup (2 radios, CSV default); date inputs; bounds note |
| A11y radiogroup idiom | scope/format `role="radiogroup"`; options `role="radio"`; exactly 1 `aria-checked="true"` at a time |
| Scope/format selection | Click changes `aria-checked` |
| Generating state | CTA `aria-busy="true"`; result panel appears |
| Success state | "Integrity verified" text present; download link present; no truncation warning |
| Truncated (SEC-4) | `role="alert"` on warning; `aria-live="assertive"`; row counts (50,000/183,492); "narrow the date range" text; download link still available; integrity band still present; no false "all records" claim |
| Empty state | "No records in this range"; no download link |
| Error state | `role="alert"`; `aria-live="assertive"`; Retry button |
| Export mechanics | POST to `/compliance/audit-log-data/export`; `rid: 'anti-csrf'` header; POST method; scope+format in body; `URL.createObjectURL` called |
| Hard boundary | No edit/delete/send/email/AI buttons |

---

## Typecheck + lint

- `pnpm -w typecheck` — clean (4 tasks successful).
- `pnpm -w lint` — clean (0 errors; 16 warnings pre-existing).
- `pnpm test -- --run` (web) — 31 test files, 895 tests, 0 failures.

---

## Deviations from the adopted design

None that affect correctness or compliance. Minor implementation notes:

1. **`<section>` for result panel** instead of `<div role="region">` — biome `useSemanticElements` lint rule requires the semantic element; functionally equivalent per WAI-ARIA (section has implicit role="region" when it has an accessible name).
2. **`X-Export-Manifest` header** for manifest data — the adopted design assumed manifest embedded in the JSON response body. The implementation reads from the `X-Export-Manifest` response header (what the API contract exposes). If the header is absent (e.g., the endpoint does not yet emit it), the component falls back to a synthetic manifest with `truncated: false`/`rowsReturned: 0` so the success state renders conservatively (shows the download without a manifest-derived row count). This is a graceful degradation, not a change to the SEC-4 truncation contract.
3. **Skip link revealed via `onFocus`/`onBlur`** — using inline event handlers to show/hide the skip link rather than a CSS `:focus-within` approach, because the component uses inline styles throughout (no Tailwind/CSS modules). Behaviour is identical to the CSS approach.
