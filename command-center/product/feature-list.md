# Feature List — DealFlow AI

Feature catalog with horizon classification. Source: user-flows.md + v1 vision + v2 competitive scan.

**Horizon defaulting:** founder-stage is `pilot-customer` (compliance default H2), but the founder's explicit **"build compliance-first now"** override (a named first-customer/regulated-outreach requirement) tags all compliance-themed features **H1**. Cited per the v3 exception clause.

Legend — Complexity: S / M / L / XL. Personas: Adv (Advisor), An (Analyst), Comp (Compliance), Adm (Admin).

---

## MVP (H1) — the integrated core loop + compliance-first

| # | Feature | Personas | Flows | Dependencies | Cx |
|---|---|---|---|---|---|
| 1 | **Multi-source deal sourcing connectors** — ingest target companies from ≥2 external data sources | An | F6 | data-source APIs, ingestion jobs | XL |
| 2 | **Company/target & contact data store** — normalized records with provenance | An, Adv | F6, F9 | DB, storage | L |
| 3 | **Dedupe & enrichment** — merge duplicates, fill decision-maker contacts | An | F6, F7, F9 | enrichment source(s), queue | L |
| 4 | **Sell-side mandate management** — engagement object (seller profile + buyer criteria + compliance profile) | Adv | F1 | DB, auth | M |
| 5 | **Buyer universe builder** — assemble + filter + enrich candidate buyers per mandate | An, Adv | F7 | #2,#3 | L |
| 6 | **AI buyer-seller matching engine (ranked output + rationale)** — score buyers vs mandate, explainable | Adv | F2 | LLM/ML, #4,#5 | XL |
| 7 | **Match review & shortlist** — accept/reject/flag ranked buyers | Adv | F2 | #6 | M |
| 8 | **Outreach template library** — merge fields + required compliance blocks; AI-assisted drafting | An | F8 | LLM | M |
| 9 | **Compliant email outreach send + tracking** — personalized send, opens/clicks/replies/bounces | Adv | F3, F4 | email send provider, webhooks | L |
| 10 | **Tamper-evident audit log** — immutable record of every comm + decision (timestamp, sender, content hash) | Comp, Adv | F3, F11 | append-only store, hashing | L |
| 11 | **Outreach compliance gate (pre-send check + approval workflow)** — block non-compliant sends; route for review | Comp, Adv | F3, F10 | #10, #12 | M |
| 12 | **Compliance rules** — suppression/blocklist, required disclaimers per jurisdiction, approval-gating policy | Comp | F12 | DB | M |
| 13 | **Recordkeeping export** — verifiable FINRA/SOX-minded export package by date range/mandate | Comp | F11 | #10 | M |
| 14 | **Pipeline / deal-stage tracking** — advance buyers through stages, notes, next actions | Adv | F4 | #9 | M |
| 15 | **Auth + RBAC (advisor/analyst/compliance/admin)** | All | F14 | auth provider | M |
| 16 | **Dashboard** — mandates, pipeline, outreach status, compliance queue at a glance | All | F1–F4, F10 | most | M |
| 17 | **Data-source connection management** | Adm | F13 | secrets mgmt | M |
| 18 | **User management** | Adm | F14 | #15 | S |
| 19 | **Workspace & sending-identity settings** (firm profile, verified send domain, default compliance profile) | Adm | F15 | email/domain verify | M |

> #10, #11, #12, #13 are compliance-themed and would default to H2 under `pilot-customer`; promoted to **H1** by the founder's compliance-first override. This is the differentiating wedge (no scanned competitor offers it — see competitive-benchmarks/INDEX.md).

---

## H2 — pilot expansion + integrations + depth

| # | Feature | Personas | Notes | Cx |
|---|---|---|---|---|
| 20 | **Pilot-partner workspace (data isolation, lite)** | Adm | Lets one external design-partner firm operate isolated — NOT full multi-tenant SaaS | L |
| 21 | **CRM integrations (Salesforce / DealCloud / Affinity sync)** | Adv, An | Meet firms where they are; competitive parity | L |
| 22 | **Advanced analytics & reporting** | Adv, Comp | Mandate throughput, response rates, advisor productivity | M |
| 23 | **Multi-channel outreach (LinkedIn/phone tasks)** | Adv | Beyond email | M |
| 24 | **Seller intent signals** | An, Adv | Pre-market signals (departures, hiring, ownership) — Grata/Cyndx parity | L |
| 25 | **Advanced recordkeeping & SOX/FINRA certification artifacts** | Comp | Formal controls, retention policies, attestation reports | L |
| 26 | **AI matching tuning & feedback loop** | Adv | Learn from accept/reject to improve ranking | L |

---

## H3 — moat / platform

| # | Feature | Personas | Notes | Cx |
|---|---|---|---|---|
| 27 | **Multi-tenant SaaS for external advisory firms** | Adm | The v2+ vision: license to other firms | XL |
| 28 | **Billing & licensing for external firms** | Adm | Monetization of the platform | L |
| 29 | **Deal network / marketplace** | Adv | Cross-firm vetted deal flow (Grata Deal Network analog) | XL |
| 30 | **Predictive deal-readiness models** | Adv, An | Proprietary models on accumulated outcome data | XL |

---

## Counts
- **MVP (H1):** 19 features (incl. 4 compliance-themed promoted to H1)
- **H2:** 7 features
- **H3:** 4 features
