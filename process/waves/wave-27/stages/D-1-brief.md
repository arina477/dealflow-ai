# Wave 27 — D-1 Design Brief: firm-admin recordkeeping EXPORT page
## Purpose
A firm admin (or compliance role) exports the firm's complete workspace-scoped recordkeeping — audit-log + deal/pipeline activity — as a downloadable CSV or JSON, integrity-verifiable, at the LIGHT compliance posture. This is the on-demand-export half of M10's success metric.
## Route + access
- Route: /compliance/export (or /recordkeeping/export) — RBAC compliance+admin (advisor/analyst → no nav entry + 403 on direct hit). Nav: under the compliance/settings area.
## Elements (form + action page)
1. **Header:** "Export records" + a one-line plain-language subtitle ("Download your firm's audit log and deal activity as a verifiable file.").
2. **Scope picker:** what to export — Audit log / Deal & pipeline activity / Both (default Both). (radio or segmented control)
3. **Format picker:** CSV / JSON (default CSV). (segmented control)
4. **Date range:** from / to (optional; a sensible DEFAULT bound is applied server-side — surface the default, e.g. "last 12 months" — so the user knows the export is bounded). A clear note that very large ranges may be capped (SEC-4 truncation is surfaced, not silent).
5. **Primary CTA:** "Export" (one primary button; emerald). Loading state while generating.
6. **Result panel (after export):** download link + an **integrity indicator** — a clear ok/verified badge (emerald check "Integrity verified") derived from the chain-verify boolean, + row count + the applied range. If truncated: a visible warning ("Showing N of M rows — narrow the date range for a complete export").
7. **States:** idle / generating (spinner) / success (download + integrity) / empty (0 rows in range — "No records in this range") / error (retry). Truncation warning is a distinct visible state.
## Design system
zinc/emerald palette, lucide-react icons (Download, ShieldCheck for integrity, FileText), 4px grid, one primary CTA, accessible (keyboard, focus-visible, role/aria on the integrity badge + the format/scope controls, no color-only signal — the integrity badge has an icon + text). Match the existing compliance/insights page shell (same header/card patterns).
## Compliance-first emphasis: the INTEGRITY indicator is the differentiator (a verifiable export, not a plain dump) — make it prominent + trustworthy. The truncation warning is a compliance-honesty signal (never a silent partial "complete" file).
## Out of scope: retention config + the records-VIEW (later M10 verticals). No certification/attestation UI (light posture).
