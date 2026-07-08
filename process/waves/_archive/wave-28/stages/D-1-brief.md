# Wave 28 — D-1 Design Brief: retention-policy settings + cutoff surfacing
## Purpose
A firm admin (or compliance role) sets the firm's recordkeeping RETENTION WINDOW (how long records are kept) + sees the derived cutoff, at the LIGHT compliance posture. Config only — NOT a purge tool.
## Route + access
- A retention settings section (under /compliance or /settings — match the existing compliance/settings routing). RBAC admin/compliance (advisor/analyst → no nav + 403).
## Elements (a small settings form + a read-only surfacing panel)
1. **Header:** "Records retention" + a one-line plain subtitle ("Set how long your firm's records are kept.").
2. **Retention-window control:** set retention_period_days — a friendly input (e.g. a number-of-YEARS select/stepper, or months, mapped to days; bounded to the sane min/max). Show the current value. Default ~7 years.
3. **Provenance:** small muted line "Last updated by <name> on <date>" (from updated_by/updated_at).
4. **Primary CTA:** "Save" (one primary, emerald) with a saving/saved state. A confirmation that a change is recorded (audit-logged) — a subtle "This change is recorded in your audit log" note (compliance-first trust signal).
5. **Cutoff-surfacing panel (READ-ONLY, informational):** "Under your <N>-year policy, records dated before <cutoff-date> are eligible for deletion." An informational card (zinc/muted, an Info or CalendarClock icon) — clearly READ-ONLY. **NO delete/purge button anywhere.** Optionally a light note that actual deletion is not performed automatically (records are preserved; this is your policy).
6. **States:** loading / idle (current value) / saving / saved / error (retry) / invalid (out-of-range → inline validation message).
## Design system
zinc/emerald, lucide-react (Save, CalendarClock/Info, ShieldCheck for the audit-recorded note), 4px grid, one primary CTA, accessible (labeled input, focus-visible, aria-live on save, no color-only). Match the existing compliance/settings section shell.
## Compliance-first + WORM emphasis: the "change is recorded in your audit log" note is a trust signal; the cutoff panel is clearly READ-ONLY/informational (NO purge control — records are preserved; this sets policy, it does not delete). This honesty is the point.
## Out of scope: records-VIEW (vertical 3); any actual purge/delete UI (founder/compliance-deferred). No certification.
