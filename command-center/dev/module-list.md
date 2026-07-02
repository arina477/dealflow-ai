---
status: locked
locked_at: 2026-06-29T00:00:00Z
locked_by: v6b
---

# Module List (v6 snapshot)

## MVP modules

- **Auth / RBAC** — SuperTokens-backed session management + four-role guard (advisor / analyst / compliance / admin) enforced globally across all routes
- **Mandate service** — root aggregate for sell-side engagements: seller profile, buyer criteria, compliance profile, and mandate lifecycle
- **Data ingestion / ETL** — scheduled and on-demand pull from external data-source APIs into staging; adapter-per-provider pattern
- **Dedupe / enrichment engine** — entity resolution (normalize + fuzzy merge) and async contact/field enrichment with provenance tracking
- **Matching engine** — deterministic pre-score + LLM-assisted ranked buyer-seller matching with explainable rationale (async BullMQ job)
- **Outreach engine** — template library, AI-assisted drafting, personalized send orchestration, email-event webhook ingestion, compliance-gate enforcement at send time
- **Audit-log service** — append-only, tamper-evident hash-chain record of every communication and decision; single write path via dedicated DB role
- **Compliance rules engine** — suppression/blocklist checks, jurisdiction disclaimer enforcement, approval-gate workflow, pre-send gate result
- **Recordkeeping / export module** — async export package generation (JSONL + CSV + integrity manifest) scoped by date range or mandate; stored in Railway Buckets
- **Pipeline / deal-stage module** — deal board per mandate tracking buyers through shortlisted → contacted → engaged → diligence → offer → closed/withdrawn
- **Notification module** — in-app SSE feed and transactional email alerts driven by domain events from all other modules
- **Admin / settings module** — data-source connection management, user/role management (via auth module), workspace profile, and sending-domain verification
- **Jobs module (background)** — BullMQ worker host for: SourceSyncJob, EnrichmentJob, OutreachSendJob, EmailEventWebhookJob, AuditIntegrityJob, ExportJob
- **DataTable (FE)** — server-side sortable/filterable table primitive; variants for ranked matches, audit log, compliance queue
- **Forms + validation (FE)** — React Hook Form + shared Zod schema resolver; field components and server-error mapping
- **Modals / drawers (FE)** — controlled dialog and drawer primitives; specialized variants for match rationale, compliance violations, audit event detail
- **Toasts / inline alerts (FE)** — ephemeral toasts and persistent compliance-block banners
- **Status badges / stage chips (FE)** — status-to-color-and-label mapping for outreach status, pipeline stage, compliance verdict, match decision
- **Design tokens (FE)** — CSS custom properties + Tailwind theme extension; provisional at MVP, finalized at v8 D-block

## H2 modules

- **Pilot-partner workspace** — tenant provisioning and data isolation for one external design-partner firm; row-level security layer over existing workspace_id filtering
- **CRM integration adapters** — Salesforce / DealCloud / Affinity sync adapters following the existing data-source adapter interface
- **Advanced analytics module** — mandate throughput, outreach response-rate, and advisor-productivity reporting
- **Multi-channel outreach** — LinkedIn and phone-task channels added to outreach engine; channel-router pattern
- **Seller intent signals** — pre-market signal ingestion (hiring, ownership, executive departure) from additional external providers
- **Advanced recordkeeping + SOX/FINRA artifacts** — retention-policy locks, formal attestation report generation, extended certification artifacts on top of MVP recordkeeping module
- **Matching feedback loop** — stores advisor accept/reject signals and retrains/weights the matching scoring model

## H3 modules (planned)

- **Multi-tenant SaaS platform** — full workspace provisioning, tenant isolation, and cross-tenant admin for external advisory firms
- **Billing / licensing module** — Stripe-backed subscription management for external firm licenses
- **Deal network / marketplace** — cross-firm vetted deal flow feed and matching network
- **Predictive deal-readiness models** — proprietary ML models trained on accumulated outcome data; replaces/augments deterministic matching pre-score

---

Last updated: 2026-06-29, source: v6 Modules branch; locked at v6b (status: locked)
