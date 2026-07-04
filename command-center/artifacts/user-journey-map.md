---
name: User Journey Map
description: Canonical inventory of every user flow, screen, route, API endpoint. Regenerated at T-9 from production state.
last_updated: 2026-06-29
version: 0.2
---

# User Journey Map — DealFlow AI

Canonical inventory of every screen / route + the flows that connect them. Source: v3 user-flows.md + feature-list.md + founder-approved page map (v4). Regenerated at T-9 Journey each wave; consumed by T-5 (E2E swarm).

> **Internal tool:** no public marketing site for MVP. Entry is sign-in; everything else is the authed app, role-gated (Advisor / Analyst / Compliance / Admin).
>
> **Compliance-quota override:** founder-stage `pilot-customer` caps compliance surfaces at ~10% of MVP pages (excess → stub PDs). The founder's explicit compliance-first decision makes the 3 compliance screens (queue, audit log + export, rules) core to the MVP wedge, so they receive **full PDs**, not stubs. Documented in product-decisions.md.

---

## Page inventory (MVP / H1)

| # | Page | Route | Persona(s) | Related flows | Tools/modules |
|---|---|---|---|---|---|
| 1 | Login | `/login` | All | auth | Auth & RBAC |
| 2 | Accept invite & set password | `/accept-invite?token=` | Invited user | F14 | Auth & RBAC |
| 3 | Reset password | `/reset-password` | All | auth | Auth & RBAC |

> **Wave 2 (auth) — LIVE (deployed + real-browser E2E 6/6):** `/login`, `/accept-invite?token=`, `/reset-password` are implemented and verified end-to-end (invite-only signup → session + role claim → role-aware landing). A placeholder authed landing `/dashboard` exists (reads the session, shows the role); the full AppShell/dashboard is a later M1 bundle. Route reconciled: journey `/invite/:token` → implemented as `/accept-invite?token=`.
| 4 | Dashboard | `/` | All (role-aware) | F1,F2,F4,F10 | most modules |

> **Wave 3 (AppShell + RBAC) — LIVE (deployed 935b847 + real-browser E2E 7/7):** the shared AppShell chrome (Sidebar+TopBar per §10, built once via the `(app)` route-group layout) + role-aware dashboard shell are live at `/` (authed; unauth→/login). Per-route RBAC is ENFORCED (opt-in `@Roles()`, DB-authoritative role, fail-closed on empty roles) via the single `roleRoutes` source of truth in @dealflow/shared, which also drives the role-aware Sidebar nav (nav⊆RBAC by construction). Enforced-RBAC exemplar endpoint `GET /compliance/summary` (roles: compliance, admin) added. Allowlist: /auth/*, /health ungated. Live matrix verified: compliance→200, advisor→403, unauth→401. Route rows 5-20 below have their role→route access pinned in `roleRoutes` (the enforcement contract) though their pages land in M3+.
| 5 | Mandates list | `/mandates` | Adv, An | F1 | Mandate service |

> **Wave 8 (mandate spine) — LIVE (deployed 46642e7 + real-browser E2E S1-S5 PASS):** the mandate flow is live — an advisor creates a fully-configured sell-side mandate at `/mandates/new` (seller/target profile + regions + size + buyer criteria [core-4] + compliance guardrails [jurisdiction dropdown → disclaimer template DERIVED server-side; suppression scope; 3 required acknowledgments], captured-not-enforced [M6 gate enforces later]) → persisted in ONE transaction (mandates + buyer_criteria + compliance_profile) + audited (M2 hash-chain) → redirect to `/mandates/:id` (SSR-hydrated detail: profile + criteria + compliance + status + deferred Buyer-Engine/Ranked/Pipeline placeholders for the next M4 bundle). `/mandates` list + status filter. RBAC: advisor/admin create+configure (analyst read-only). Active mandates are locked (no reconfigure/revert). Migrations 0006 (3 tables) + 0007 (one-active-disclaimer-per-jurisdiction). This delivers the first half of M4's success metric (create a configured mandate); the buyer-universe builder is the next M4 bundle.
| 6 | Mandate detail | `/mandates/:id` | Adv, An | F1,F2,F4 | Mandate, matching, pipeline |
| 7 | New / edit mandate | `/mandates/new` | Adv | F1 | Mandate service |
| 8 | Buyer universe | `/mandates/:id/buyers` | An, Adv | F7 | Buyer-universe builder, enrichment |
| 9 | Matches & shortlist | `/mandates/:id/matches` | Adv | F2 | Matching engine |
| 10 | Outreach composer & campaign | `/mandates/:id/outreach` | Adv, An | F3,F8 | Outreach engine, compliance gate |
| 11 | Pipeline | `/pipeline` | Adv | F4 | Pipeline module |
| 12 | Sourcing workspace | `/sourcing` | An | F6 | Ingestion, dedupe |

> **Wave 7 (sourcing-workspace) — LIVE (deployed 0fe63de + real-browser E2E 4/5, connection-create live-verified at C-2):** the sourcing-workspace is live at `/sourcing` (analyst persona; replaced the wave-6 redirect stub) — search over the deduped canonical universe + a source facet + results matrix with per-company source badges (from real data_source_connection displayNames) + a per-connection sync trigger (reuses the wave-6 idempotent ETL→dedupe pipeline) + a hand-off to /sourcing/companies (the dedupe review queue). Connection management: POST /sourcing/connections (create; analyst/admin; AUDITED; providerKey validated against the adapter registry → 400 on unknown; UNIQUE display_name → 409 on dup) + GET list. This completes M3's success metric — search across ≥2 connected sources — verifiable now on ≥2 fixture connections. Deferred: the first REAL provider adapter (blocked on a founder vendor + API-key decision — surfaced) + the in-page dedupe modal + advanced facets.
| 13 | Companies & contacts | `/companies` · `/companies/:id` | An | F9 | Data store, dedupe/enrichment |

> **Wave 6 (deal-sourcing data spine) — LIVE (deployed 918dbf0 + real-browser E2E 8/8):** the companies & contacts screen is live at **`/sourcing/companies`** (analyst persona) — view/filter deduped canonical companies+contacts + a dedupe review queue (merge/reject uncertain matches). Behind it: a pluggable `DataSourceAdapter` (fixture adapter this wave; real provider SDKs later) → idempotent ETL into `raw_companies` staging → a deterministic DEDUPE engine promoting to canonical `companies`/`contacts` with company- AND contact-level provenance (source lineage). LIVE-verified: cross-source dedup (same domain from 2 sources → 1 canonical + provenance from both), NO false-positive merge (distinct companies stay separate), idempotent re-sync (no pile-up), and audited dedupe-resolution (M2 audit log). Route repointed `/companies`→`/sourcing/companies`. Deferred: real provider adapters + scheduled/incremental sync + contact enrichment + the sourcing-workspace page (row 12). This is the data spine M4 (mandates) / M5 (matching) consume.
| 14 | Templates library | `/templates` · `/templates/:id` | An, Comp | F8 | Outreach engine, compliance |
| 15 | Compliance queue (approvals) | `/compliance/queue` | Comp, Adv | F10 | Compliance rules, audit log |
| 16 | Audit log & recordkeeping export | `/compliance/audit-log` | Comp | F11 | Audit-log service, export |

> **Wave 4 (audit-log backbone) — LIVE (deployed cd06e8a + real-browser E2E 7/7):** the tamper-evident audit-log SERVICE is live — an append-only `audit_log_entries` table (DB-layer immutability: INSERT/SELECT-only grant + BEFORE UPDATE/DELETE/TRUNCATE triggers blocking even the owner), an HMAC-SHA256 hash-chained append service (keyed by AUDIT_LOG_HMAC_KEY, genesis-anchored, write-atomic, concurrency-serialized), a chain-integrity verifier, and `GET /compliance/audit-log/verify` (RBAC compliance/admin). The `/compliance/audit-log` page renders the INTEGRITY VIEW (chain status + entries count + verify-now) per design/audit-log-export.html §Integrity Validation (compliance persona). LIVE-verified: chain verifies (ok:true), immutability holds (U/D/T rejected), tamper-detection works (flip→ok:false at break). Recordkeeping EXPORT + real audited-action call-sites deferred to M6+; the rules engine (`/compliance/settings`, row 17) deferred to a later M2 bundle.
| 17 | Compliance settings (rules/suppression/disclaimers) | `/compliance/settings` | Comp | F12 | Compliance rules engine |

> **Wave 5 (compliance rules engine + pre-send gate) — LIVE (deployed 13e55ef + real-browser E2E):** the compliance-settings Rules Engine CRUD screen is live at `/compliance/settings` (compliance persona) — Approval & Gating Policy (rules), Suppression Matrix, Jurisdiction Templates (versioned disclaimers), every mutation audited in-tx to the wave-4 tamper-evident log. Behind it: 4 rules-engine tables + a single NON-BYPASSABLE `ComplianceGateService.evaluate()` (the sole send-eligibility authority) enforcing suppression (hard-block), **separation-of-duties (sender≠approver, approver MUST be `compliance` — admin excluded, live-verified BLOCKED)**, jurisdiction disclaimers, and approval content-hash binding (post-edit re-block) — writing every verdict to the audit log. Anti-CSRF is VIA_CUSTOM_HEADER (mutations require the rid header + SameSite=Lax). The M6 outreach send-path is the gate's real caller (tracked dependency); the gate is a callable, unit+live-tested contract this wave. Completes M2's callable-pre-send-check success metric.
| 18 | Admin · data sources / integrations | `/admin/integrations` | Adm | F13 | Data ingestion, secrets mgmt |
| 19 | Admin · users | `/admin/users` | Adm | F14 | Auth & RBAC |
| 20 | Admin · workspace settings | `/admin/settings` | Adm | F15 | Admin/settings, sending identity |

---

## Flows cross-reference

### F1 — Create & configure a sell-side mandate (Advisor)
Entry: Dashboard (4) / Mandates list (5) → New mandate (7) → Mandate detail (6).

### F2 — Review ranked matches & build shortlist (Advisor)
Entry: Mandate detail (6) → Matches & shortlist (9) → (Compliance approval 15) → Outreach (10).

### F3 — Approve & launch compliant outreach (Advisor)
Entry: Matches (9) / shortlist → Outreach composer (10) → pre-send check + (Compliance queue 15) → send (audit log 16).

### F4 — Monitor responses & pipeline (Advisor)
Entry: Dashboard (4) → Pipeline (11) / Mandate detail (6).

### F6 — Source deals / import targets (Analyst)
Entry: Sourcing workspace (12) → Companies (13) → Mandate (6).

### F7 — Build & refine buyer universe (Analyst)
Entry: Mandate detail (6) → Buyer universe (8) → Matches (9).

### F8 — Draft outreach templates (Analyst)
Entry: Templates library (14) → (Compliance queue 15).

### F9 — Maintain data quality (Analyst)
Entry: Companies & contacts (13).

### F10 — Review & approve outreach (Compliance)
Entry: Dashboard (4) → Compliance queue (15).

### F11 — Audit log review & recordkeeping export (Compliance)
Entry: Audit log & export (16).

### F12 — Manage compliance rules (Compliance)
Entry: Compliance settings (17).

### F13 — Connect & configure data sources (Admin)
Entry: Admin · integrations (18).

### F14 — Manage users & roles (Admin)
Entry: Admin · users (19); invite acceptance → Accept invite (2).

### F15 — Workspace & system settings (Admin)
Entry: Admin · workspace settings (20).

---

## Per-page PDs

Detailed product descriptions live in `command-center/product/per-page-pd/<page>.md` (generated v4, refined per-wave):

- `login.md`, `accept-invite.md`, `reset-password.md`
- `dashboard.md`
- `mandates-list.md`, `mandate-detail.md`, `mandate-new.md`
- `buyer-universe.md`, `matches-shortlist.md`, `outreach-composer.md`, `pipeline.md`
- `sourcing-workspace.md`, `companies-contacts.md`, `templates-library.md`
- `compliance-queue.md`, `audit-log-export.md`, `compliance-settings.md`
- `admin-integrations.md`, `admin-users.md`, `admin-workspace-settings.md`

---

## Coverage check
- Every MVP feature (#1–#19 in feature-list.md) maps to ≥1 page above. ✓
- Every page connects to ≥1 flow. ✓
- H2/H3 pages (pilot-partner workspace, CRM-integration screens, analytics, multi-tenant) are deferred — not in this MVP inventory.
