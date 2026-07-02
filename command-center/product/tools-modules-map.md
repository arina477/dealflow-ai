# Tools / Modules Map — DealFlow AI

Reusable building blocks extracted from features + flows. First pass; v6 architecture deepens this. Each entry: purpose + consuming features (by # from feature-list.md).

---

## External services

| Service | Purpose | Consumed by |
|---|---|---|
| **Deal-source data APIs** (≥2, e.g. private-company data providers) | Source target companies + buyer candidates | #1, #3, #5, #24 |
| **Contact-enrichment provider** | Decision-maker contacts + verified emails | #3, #5, #9 |
| **Transactional email + tracking provider** (send + opens/clicks/bounces via webhooks) | Compliant outreach delivery + engagement events | #9, #14 |
| **Sending-domain / DKIM-SPF-DMARC verification** | Deliverability + sender authentication | #19, #9 |
| **LLM / AI provider** (latest Claude models) | Matching rationale, AI-assisted drafting, scoring assist | #6, #8, #26, #30 |
| **Auth provider** | Authentication + session | #15 |
| **Object storage** | Documents, export packages, attachments | #2, #13 |
| **Error tracking + monitoring** | Reliability/observability | infra (all) |
| **Analytics** | Usage + funnel (internal) | #22 |

> External-SDK integrations follow `claudomat-brain/rules/external-sdk-integration-rules.md`; per-SDK docs land in `command-center/dev/SDK-Docs/<Name>/`.

---

## Internal modules

| Module | Purpose | Consumed by |
|---|---|---|
| **Auth & RBAC** | Roles: advisor / analyst / compliance / admin; least-privilege | #15, #18, all gated |
| **Data ingestion / ETL** | Pull, normalize, schedule source syncs | #1, #6, #17 |
| **Dedupe & enrichment engine** | Entity resolution + field enrichment w/ provenance | #3, #9 |
| **Mandate service** | Sell-side engagement model + criteria + compliance profile | #4 |
| **Matching engine** | Buyer-seller ranking + explainable rationale | #6, #7, #26 |
| **Outreach engine** | Template render, personalization, send orchestration, status | #8, #9, #14 |
| **Audit-log service (append-only, tamper-evident)** | Immutable comm + decision records, integrity hashes | #10, #11, #13 |
| **Compliance rules engine** | Suppression/blocklist, disclaimers, approval-gating, pre-send checks | #11, #12 |
| **Recordkeeping/export module** | Verifiable retention packages | #13, #25 |
| **Pipeline/deal-stage module** | Stage tracking + notes + next actions | #14 |
| **Notification module** | In-app + email alerts (compliance queue, replies, sync errors) | #4, #10, #14 |
| **Admin/settings module** | Data-source mgmt, users, workspace/sending identity | #17, #18, #19, #20 |

---

## Shared primitives (UI)

| Primitive | Purpose | Consumed by |
|---|---|---|
| Data tables (sortable/filterable, ranked lists) | Matches, buyer universe, pipeline, audit log | #5, #7, #11, #14 |
| Forms + validation | Mandate, templates, settings | #4, #8, #12, #19 |
| Modals / drawers | Record detail, match rationale, approvals | #7, #10 |
| Toasts / inline alerts | Compliance blocks, send results, errors | #9, #11 |
| Status badges / stage chips | Outreach + pipeline state | #14, #9 |
| Design tokens | Consistent visual system (set in v8) | all UI |

---

## Background work

| Job | Purpose | Consumed by |
|---|---|---|
| **Sourcing/sync jobs** (scheduled crawl/pull) | Keep target/buyer data fresh | #1, #6, #24 |
| **Enrichment queue** | Async contact/field enrichment | #3, #5, #9 |
| **Outreach send queue** | Rate-limited, retryable sends | #9 |
| **Email-event webhook processor** | Ingest opens/clicks/replies/bounces → pipeline + audit log | #9, #10, #14 |
| **Integrity/verification job** | Periodic audit-log hash verification | #10, #11 |

---

## Cross-reference check
- Every module/tool above lists ≥1 consuming feature. ✓
- The compliance trio (audit-log service, compliance rules engine, recordkeeping/export) maps to H1 features #10–#13 — the differentiating wedge. ✓
