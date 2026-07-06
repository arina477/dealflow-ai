# P-4 Phase 2 — jenny drift-check (wave-13, M6 audit-log/recordkeeping-EXPORT)

Spec: tasks 36a17c81 (read+verify) / 20c479db (export) / 10ee0ec4 (page). Checked against product-decisions #80 (20 screens designed), #141 (send/webhook deferred), LLM-spend deferral, per-page-pd/audit-log-export.md, user-journey-map F11 + row 16, M2 immutability (v6b #5/#6/#7), M1 RBAC.

## Per-item verdicts

1. **Page scope /compliance/audit-log (#80, design/audit-log-export.html)** — MATCH. Spec is a legitimate MVP-slice of the designed page: retains the filterable immutable-log table, integrity badge, export panel — the defensibility core (entries+hashes+full-chain verify+manifest). Scope-hold (defer PDF / triple-format / multi-regulation presets / background jobs / export_templates / forensic reports) drops only convenience depth from per-page-pd §7/Notes; none is integrity-critical or claimed mvp-critical by #80 (which only records "designed+approved"). P-0 ceo-reviewer + mvp-thinner explicitly sanctioned the hold. Not a contradiction.

2. **Recordkeeping-export success metric** — MATCH. Spec delivers verbatim M6 clause "compliance can export a verifiable recordkeeping package" (P-0 frame line 13). Also honors per-page-pd success-metric #8 ("100% of exports logged — who exported what, when") via the export_generated audit row.

3. **RBAC roles** — DRIFT (internal contradiction). per-page-pd §Audience grants export to Compliance Reviewer (own mandates) / Compliance Officer / Audit Lead / Admin; Advisor own-outreach view, NO export. Seed 36a17c81 AC and export 20c479db **YAML AC** correctly INCLUDE audit-lead in export → MATCH per-page-pd. But export 20c479db **prose body** says "export rights restricted to compliance-reviewer / compliance-officer / admin … audit-lead and advisor have NO export rights" — EXCLUDES audit-lead, contradicting both its own YAML AC and per-page-pd §Audience (Audit Lead: "export for internal audit and risk assessment"). Conflicting decision: per-page-pd/audit-log-export.md §Audience & Access Control. Resolve before B: align the 20c479db prose body to include audit-lead (weight of evidence: 2 ACs + per-page-pd all grant it; prose is the outlier).

4. **Read-only immutability (M2)** — MATCH. Read path emits ZERO audit rows, no edit/delete affordance, export appends exactly one export_generated row last-in-txn. Consistent with v6b #6/#7 (append-only, INSERT-only grant + BEFORE UPDATE/DELETE trigger) and #5 (HMAC chain not forgeable). Verify reuses the real AuditVerifier (no fork).

5. **Deferrals (#141, LLM)** — MATCH. Hard boundary: ZERO email key / EMAIL_WEBHOOK_SECRET / LLM/Anthropic spend / new SDK / send / webhook. All read/export over existing data; sole write is the export-event append. Honors #141 (send/webhook) + LLM-spend Tier-3 deferral.

6. **Verify shape reconciliation** — MATCH. Spec pins the API to REAL AuditVerifier {ok, entriesChecked, firstBreakAt?, reason?} (not invented {ok, anomalies[]}), while the page badge preserves per-page-pd/design "N anomalies / break at #" copy computed from that real shape. Sound reconciliation, not drift.

7. **Deep-link entry points** — MINOR DRIFT. Seed page YAML AC (10ee0ec4) honors ?mandate_id=/?from=/?to= only. per-page-pd §Entry Points #2 (F10 → "View full audit trail" → ?campaign_id=<uuid>) and #4 (admin → ?mode=export pre-open panel) are dropped; the 10ee0ec4 prose body itself names ?mandate_id/?campaign_id/?mode=export, so the AC is narrower than its own prose. ?campaign_id is unwired because the read filter is mandateId/type/actor/from/to (no campaignId) — a defensible MVP reduction, but a coverage gap vs per-page-pd Entry Points + F10 cross-link. Low severity; note for the builder, not a blocker.

## F11 / journey — MATCH. Route /compliance/audit-log = journey row 16; F11 (audit log review & recordkeeping export, Compliance) delivered.

## PLAN review — no drift. P-3 approach reuses M2 AuditService/AuditVerifier + M1 RolesGuard/getUserWithRole, additive-only (at most an additive pgEnum value export_generated, flagged for B-1 confirmation), no new dep/SDK/secret, serial B-0→B-3, compliance invariants enumerated. Consistent with the spec + boundaries.

## Verdict
DRIFTS (2): (3) audit-lead export contradiction in 20c479db prose body vs its YAML AC + per-page-pd §Audience [medium — resolve before B]; (7) deep-link ?campaign_id/?mode=export dropped from 10ee0ec4 AC vs per-page-pd Entry Points + own prose [low — note]. All other spec items MATCH.
