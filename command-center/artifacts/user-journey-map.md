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
| 8 | Buyer universe | `/buyer-universe` | An, Adv | F7 | Buyer-universe builder, enrichment |

> **Wave 9 (buyer-universe builder) — LIVE (deployed 937ae18 + real-browser E2E 14/14 + C-2 first-try):** the buyer-universe builder is live at `/buyer-universe?mandateId=` (reached from the mandate-detail 'Buyer Engine' link; analyst-primary). For a wave-8 mandate the analyst **assembles** a candidate buyer set from the M3 canonical companies (idempotent — one universe per mandate), **filters** by the mandate's stored buyer criteria (per-candidate include/exclude + provenance; unsupported geo/size/deal-type dims honestly recorded as not-applied since M3 companies carry only sector), **enriches** included candidates with their M3 contacts, flags gaps, and **submits** the universe ready-to-rank (guarded: ≥1 included + all triaged). Every mutation audited (M2 hash-chain); one-transaction atomicity. This COMPLETES M4's success metric (assemble + enrich a buyer universe ready to rank). **M4/M5 boundary: NO fit-scoring / ranking / rationale / LLM here — that is M5's flagship.** Schema additive (migration 0008: buyer_universe + buyer_universe_candidates, mandate_id UNIQUE).
| 9 | Matches & shortlist | `/matches-shortlist` | Adv | F2 | Matching engine |

> **Wave 10 (deterministic matching) — LIVE (deployed 0075a20 + real-browser E2E 12/12 + C-2 first-try):** the deterministic match spine is live at `/matches-shortlist?mandateId=` (reached from the mandate-detail 'Ranked Candidates' link; advisor-primary + analyst read). For a mandate whose buyer universe is SUBMITTED, the advisor runs a match — a DETERMINISTIC rule-based fit score (integer 0-100 from the mandate's buyer criteria [sector] + contact-completeness, with a meaningfully-discriminating ranking + per-dimension score breakdown; unsupported dims [geo/size/deal] recorded as not-applied) → a RANKED buyer list → accept/reject/flag to build a shortlist → ready-for-outreach handoff. Idempotent (one run per universe; re-run PRESERVES accept/reject decisions); submit-guard (400 if the universe isn't submitted); handoff-guard (≥1 accepted). Every mutation audited (M2 hash-chain). This delivers the DETERMINISTIC HALF of M5's success metric. **The score is RULE-BASED — NOT AI-generated (no LLM/rationale this bundle; the LLM-assisted ranking + explainable rationale is a later, gated M5 bundle). No false AI-capability claim on the page (CODE-OF-CONDUCT provenance).** Handoff = a persisted ready-for-outreach status M6 (compliant outreach) reads — this bundle does NOT do outreach. Schema additive (migration 0009: match_run + match_candidates).
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


---

## Wave-11 delivered — Compliant-outreach foundation (LIVE @ af5b5d9)

The following pages/flows are now DEPLOYED and functional (M6 first bundle):

- **Templates library** (`/outreach-templates`) — advisor/analyst author outreach templates, draft immutable versions (content-hash), request compliance approval. Version-binding badge: send-eligible only for an approved + hash-matching version.
- **Outreach composer** (`/outreach-composer`) — advisor selects an approved template + a shortlist recipient → **"Run Compliance Gate & Create Record"** → the NON-BYPASSABLE pre-send compliance gate (reuses the M2 ComplianceGateService, now binding compliance_approvals) evaluates version-binding + SoD (composer≠approver) + disclaimer + suppression + content-hash → verdict **send_eligible** ("Send-eligible record created" + "No email has been sent") or **blocked** (+ reason). NO email is sent, NO AI drafting — deferred bundles (honest provenance per CODE-OF-CONDUCT).
- **Compliance queue** (`/compliance-queue`) — compliance-role grants/rejects pending template versions; SoD enforced (grant sets approved_content_hash + approved_by; a version the compliance user did not author).

### F16 — Compliant outreach: template → approval → compose → send-eligible (Advisor + Compliance)
Entry: Templates library (`/outreach-templates`) → draft version → request approval → Compliance queue (`/compliance-queue`, compliance grants, SoD) → Outreach composer (`/outreach-composer`, advisor composes → pre-send gate → send-eligible record). Produces a send-ELIGIBLE record only; actual send is a later bundle.

Verified: CI real-DB e2e (gate reaches send_eligible only via a passing evaluate; blocks no-approval/SoD/content-drift) + C-2 deployed-authed (RBAC, AC-STRIP on authed HTML, tables live). Deferred (later M6 bundles): actual email send-path + tracking + pipeline; AI-assisted drafting (founder LLM-spend gate).


---

## Wave-12 delivered — M6 pipeline / deal-stage tracking (LIVE @ 989fae9)

- **Pipeline board** (`/pipeline`) — advisor/compliance view; a stage-columned board with the 7 FIXED stages (shortlisted → contacted → engaged → diligence → offer → closed → withdrawn, product-decision #137). Enrolled deals (from send-eligible outreach or accepted matches) show under mandate + buyer identity; an advisor moves a deal to a valid stage (server-side illegal-transition + role rejection). Every enroll/transition is an append-only HMAC-audited event (M2 audit log). NO email send, NO AI — pipeline tracking only.
- **Per-deal event timeline** (on the `/pipeline` deal view) — chronological history: enrollment + each stage transition (from→to) + advisor free-text notes, each with actor + timestamp. Notes append-only, audited last-in-txn. This is the compliance recordkeeping surface.

### F17 — Track a deal through the pipeline (Advisor + Compliance)
Entry: Pipeline board (`/pipeline`) → enroll an eligible deal (send-eligible outreach / accepted match) → move it through the 7 fixed stages → per-deal timeline records every transition + note (audited). No email/send; pipeline advance is human-driven (automated reply/open-driven advance stays deferred with the send/webhook bundle).

Verified: CI real-DB e2e (audit-throw → real ROLLBACK → zero orphan; happy-path exactly-one-event+audit; idempotent-409) + C-2 deployed-authed (7 fixed columns render, RBAC, no send/AI, migration 0011 live). Deferred (founder-gated later M6 bundles): actual email send + webhook tracking; AI-assisted drafting.


---

## Wave-13 delivered — M6 audit-log / recordkeeping export (LIVE @ 2ec4953)

The /compliance/audit-log page (F11) is now the full recordkeeping-defensibility surface:
- **Filterable immutable-log table** — compliance/admin see org-wide, advisor sees own-outreach; filter by mandate (per-resource_type DERIVED), event type, actor, date range; paginated; read-only (no edit/delete of the immutable HMAC chain).
- **Integrity badge** — bound to the hash-chain verify (real AuditVerifier: {ok, entriesChecked, firstBreakAt?, reason?}); "All entries verified (N)" or "break at #M (reason)" — tamper-evidence at a glance.
- **Recordkeeping export** (compliance/admin only; advisor NO export) — mandate/time-scoped verifiable package: in-scope entries + per-entry hashes + full-chain verify result + a manifest for independent offline re-verification. The export action itself is audited (one export_generated row, last-in-txn).

### F11 (updated) — Audit-log review & recordkeeping EXPORT (Compliance/Admin + Advisor read-only)
Entry: /compliance/audit-log. Compliance reviews the filterable immutable audit trail + the integrity badge, and exports a mandate/time-scoped VERIFIABLE recordkeeping package (independently re-verifiable offline) — the regulator-facing compliance-defensibility wedge, the last clause of M6's success metric. Advisor: read-only own-outreach, no export.

Verified: C-2 LIVE — verify {ok:true, entriesChecked:309} over the real production chain; export → package + verify 309→310 (export_generated appended last-in-txn); advisor export 403; M2 validation 400. Deferred (later): PDF/multi-format/multi-regulation presets, background jobs, producer-side gate mandate-attribution.


---

## Wave-14 delivered — M6 compliance hardening (LIVE @ 5754fbf)

- **Gate mandate-attribution (487b0f0c)** — the compliance pre-send gate now records the mandate on its allow/block audit entry (as a hash-EXCLUDED metadata column, so tamper-evidence is preserved — verifyChain stays green live), making gate decisions mandate-attributable in a recordkeeping export. The wave-13 recordkeeping mandate-scoped export now includes gate decisions.
- **Mandate-derivation e2e (07bd1e1a)** — a real-DB test proves the scoped export captures every mandate-derivable producer (incl gate decisions) and excludes other mandates' rows even when they share a template version. This LIFTS the wave-13 hard-gate: the mandate-scoped recordkeeping export is now trustworthy for a live regulator request.
- **Compliance oversight (f5074df8)** — a new read-only gate-outcome oversight surface at **/compliance/oversight** (compliance/admin), showing each outreach's gate verdict + mandate + SoD status. Distinct from the version-approval queue.

### Route reconciliation (journey-map hygiene):
- **/compliance-queue** (hyphen) = the SHIPPED wave-11 compliance approval queue (pending template-version approve/reject + SoD). This is F10.
- **/compliance/oversight** (new, wave-14) = the read-only outreach gate-outcome oversight view (NOT an approval workflow).
These are distinct surfaces; the earlier F10 mapping to "/compliance/queue" (slash) is superseded by the shipped hyphen route + the new oversight route.

Verified: C-2 LIVE — verifyChain {ok:true, entriesChecked:310} after the additive mandate_id column (tamper-evidence intact); gate no-regression; oversight read-only + advisor-blocked. CI: recordkeeping-gate e2e 9/9 real (mandate_id isolation).

## Admin activity view (M7 wave-16, LIVE @d72d7cb) — role:admin only
| Route | Purpose | Endpoints | Compliance |
|---|---|---|---|
| /admin/activity | read-only recent-admin-actions view | GET /admin/activity-data | reads immutable audit log; writes 0 rows; no hash/credential in response; advisor 403/anon 401 |
| /admin/users (reactivate) | reverse a soft-deactivation | POST /admin/users/:id/reactivate | admin-only; audited (user-reactivate); UUID-validated; preserves role_id |
Admin nav section links /admin/{users,settings,integrations,activity} (server-gated). Mandate-create inherits firm compliance defaults (cascade). Data-source config typed-boundary rejects secret-shaped values (400 no-echo).

## Advisor insights / analytics (M9 wave-18, LIVE @5c86cf5) — role:advisor + admin
| Route | Purpose | Endpoints | Scope |
|---|---|---|---|
| /insights | read-only advisor analytics dashboard (metric cards: mandate throughput, outreach compliance-gate outcomes, advisor productivity, match disposition) | GET /analytics (via /analytics proxy) | workspace-scoped (own-firm only, FORCE RLS as dealflow_app); RBAC advisor+admin (analyst/compliance 403, anon 401); read-only; no charts-lib/real-time/export |
Nav: /insights entry (bar-chart-2, server-role-gated). Analytics is read-only over already-live mandates/outreach/pipeline/matches data; the CRM DataSourceAdapter remains founder-gated (#deferred).

## Match-score calibration (M9 wave-19, LIVE @3cc58de) — role:advisor + admin
| Route | Purpose | Endpoints | Scope |
|---|---|---|---|
| /insights (calibration section) | read-only calibration: does the AI match score predict advisor accept/reject — accept-rate by fit_score band + per-dimension acceptance-lift (sectorMatch, contactCompleteness) | GET /match-feedback (via /match-feedback proxy) | workspace-scoped (own-firm only, FORCE RLS as dealflow_app); RBAC advisor+admin (analyst/compliance 403, anon 401); read-only; honest metrics (tieBreak noise-dimension excluded; small-sample n=X caveat; null→n/a not 0%); no charts-lib |
Calibration reads already-live match_candidates (disposition/fit_score/score_breakdown). Additive section on the wave-18 /insights page.

## Outreach-activity tracker (M9 wave-20, LIVE @86ddc29) — role:advisor + admin
| Route | Purpose | Endpoints | Scope |
|---|---|---|---|
| /outreach/activity (Outreach Log) | log + track manual outreach touches (call/email/linkedin/other) as INTERNAL records — create form + my-open-touches list + status transitions (planned/completed/cancelled) + 0-or-1 deal-target link | POST/GET/PATCH /outreach-activity | workspace-scoped WRITE (FORCE RLS FOR-ALL as dealflow_app — own-firm only, write-path-isolated); RBAC advisor+admin (analyst/compliance 403, anon 401); every mutation audit-logged (M2 HMAC chain, last-in-txn); NO external send (channel is a label); mutable ledger (NOT WORM) |
First mutable M9 write surface. New outreach_activity table (migration 0018, additive). All-4-FK deal-target tenancy validated; createdBy server-derived.

## Seller-intent scoring (M9 wave-23, LIVE @6c22919) — role:advisor + admin
| Route | Purpose | Endpoints | Scope |
|---|---|---|---|
| /insights (seller-intent section) | per-mandate deterministic intent score (0-100) + direction (heating/cooling/flat) + 3-signal breakdown (outreach engagement / pipeline velocity / match disposition) — which mandates are heating up vs cooling | GET /seller-intent (via /seller-intent proxy) | workspace-scoped (own-firm only, FORCE RLS as dealflow_app, fail-closed); RBAC advisor+admin (analyst/compliance 403, anon 401); read-only; PURE deterministic (NO-LLM, no Date.now-inside — reproducible/auditable); NO tieBreak surfaced (PRODUCT #1) |
Seller-intent is a read-derived deterministic score over already-live outreach_activity/pipeline_events/match_candidates. Sorted hottest-first. Additive section on the /insights dashboard.

## Wave 27 — M10 recordkeeping EXPORTS (light posture)
- **Route:** `/compliance/export` (firm-admin recordkeeping export page) — RBAC compliance+admin (advisor/analyst → no nav entry + server redirect; anon → /login). Elements: scope picker (Audit log / Deal & pipeline / Both), format picker (CSV / JSON), optional date-range + bounds note (12mo default, 50k cap), one "Export" CTA, result panel (download + IntegrityBadge "Integrity verified" + row count/range + the truncation warning when capped).
- **Endpoint:** `POST /compliance/audit-log/export` (extended) — workspace-scoped (getDb/RLS) export of the firm's audit-log + deal/pipeline activity as CSV/JSON; HMAC-chain integrity boolean; firm-local ordinal (global seq masked); the export is audit-logged (export_generated); bounded (date-range default + 50k cap) with an explicit `X-Export-Manifest` truncation signal (truncated/rowsReturned/rowsAvailable — never a silent short "complete" file). Cross-tenant isolation proven by recordkeeping-export-isolation.e2e (SEC-8, as dealflow_app).

## Wave 28 — M10 RETENTION policy (LIVE @775cd67) — role:compliance + admin
| Route | Purpose | Endpoints | Scope |
|---|---|---|---|
| /compliance/retention (Records retention settings) | configure the firm's retention window (retention_period_days; default 2555 ≈ 7yr; 30–10950 bounds surfaced as years) + read-only derived cutoff-date panel; WORM-PRESERVING — NO purge/delete affordance (records are preserved, deletion is never performed) | GET/PUT /compliance/retention (via /compliance/retention-data BFF proxy) | workspace-scoped WRITE on a NEW mutable config table `workspace_retention_policy` (migration 0020: ENABLE+FORCE RLS + `workspace_isolation` USING-only NULLIF policy + explicit dealflow_app GRANT); RBAC compliance+admin (advisor/analyst → 403/redirect-to-/, anon → 401/redirect-to-/login), server-side fail-closed boot assertion; SEC-A workspace_id server-resolved from ALS GUC (client-supplied workspace_id/firmId → 400 via .strict()); SEC-C every value change appends `retention.policy.updated` to the M2 HMAC audit chain (actor + hashed old→new), WORM audit log never mutated/deleted |
Cross-firm config isolation + foreign-workspace-write rejection proven by retention-policy-isolation.e2e (as dealflow_app — NOT postgres; RET-ISO-1/2, 20 tests in CI run 28927123301). WORM preserved: verifyChain ok:true after a config change + audit count monotonic (RET-WORM-1/2); UI ships no purge/delete control (asserted). New config table is MUTABLE (upsert one row/workspace) but the audit log it writes to remains WORM.

## Wave 29 — M10 records-VIEW deal-activity browse (light, LAST M10 vertical)
- **Route/surface:** /compliance/audit-log page gains a scope toggle "Audit log | Deal activity" (ScopeToggle role=tablist). The "Deal activity" scope (DealActivityTable) is RBAC-gated to compliance/admin (advisor sees the audit-log scope but NOT deal-activity — the tab is hidden + the SSR fetch skipped; the API is the real gate). READ-ONLY (no mutation/export affordance).
- **Endpoint:** `GET /compliance/records/deal-activity` (RBAC compliance/admin, boot-fail-closed) — a PAGINATED (limit max 50, offset), workspace-RLS-scoped (getDb — reuses findDealRowsBounded's pipeline LEFT JOIN mandates RLS join, DESC), READ-ONLY (no audit row) browse of the firm's deal/pipeline activity with filters (date-range, type, mandate). Cross-tenant isolation proven by recordkeeping-deal-activity-isolation.e2e (DA-ISO, as dealflow_app). Completes M10's light metric ("retained records viewable in-app" = the shipped audit-log browse + this deal-activity browse).
