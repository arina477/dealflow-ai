# Changelog

## [0.15.0] — 2026-07-06 — Admin & settings (M7)

### Added
- **Admin console** (M7) — three admin-only pages let a firm run itself: **user management** (/admin/users) to invite teammates (invite-only), assign their role, and deactivate people who leave; **workspace & firm settings** (/admin/settings) for the firm profile and default compliance fields (jurisdiction, disclaimer, suppression); and **data-source connections** (/admin/integrations) to add, edit, enable, and disable the outside data feeds the product pulls from. Advisors and signed-out visitors are refused.
- Shell polish — the app navigation now has real placeholder pages for Matches and Outreach (no more dead links), and the top bar shows the correct page title.

### Correctness / compliance
- **The firm can never lock itself out of administration** — a race-safe guard blocks removing or demoting the last remaining admin, even under two simultaneous requests (refused with a clear conflict response). Every admin action — invite, role change, deactivation, settings change, connection change — is written to the immutable audit trail. Deactivation is a reversible soft-disable, not a delete.
- **Data-source credentials are encrypted at rest** (AES-256-GCM, per-record random IV + auth tag, key-id prefix for rotation, fail-closed if the key is missing). The credential form is write-only: the secret is never returned or echoed back, and reads expose only whether a credential is set. The audit hash-chain still verifies after this wave's additive schema change (confirmed live: 314 entries, integrity intact).

### Provenance (transparency)
- Admin plumbing only — no email is sent, no AI is used, and no audit record is edited or deleted. This wave adds one additive database migration (0013) and one new production-only secret (CREDENTIALS_ENC_KEY, self-generated, never committed).
- **Known gap, tracked as a follow-up:** the firm's default compliance settings are saved but not yet applied when a new mandate is created — they are write-only for now. Reactivating a deactivated user, duplicate-invite handling, and an in-app link to the connections page are also deferred to follow-up tasks.

## [0.14.0] — 2026-07-06 — Compliance hardening (audit mandate-attribution + recordkeeping fidelity)

### Added
- **Mandate-attributable compliance decisions** — the pre-send compliance gate now stamps each allow/block decision with the mandate it belongs to, so a mandate-scoped recordkeeping export includes the gate decisions for that mandate. A new read-only **compliance oversight** view (/compliance/oversight) lets compliance/admin see each outreach's gate outcome, mandate, and separation-of-duties status at a glance (distinct from the version-approval queue).

### Correctness / compliance
- The mandate stamp is recorded as tamper-evidence-neutral metadata — it is NOT part of the audit log's hash chain, so adding it left every existing entry's integrity hash byte-identical and the chain still verifies (confirmed live on the production chain of 310 entries after the change). The pre-send gate's non-bypassable allow/block behaviour is unchanged. A real-database test now proves the mandate-scoped export captures every mandate-derivable record — including gate decisions — and correctly isolates one mandate's records from another's even when they share a template, lifting the prior hold on relying on the scoped export for a regulator request.

### Provenance (transparency)
- Compliance hardening only — no email send, no AI, no edit/delete of audit records. The mandate stamp is a filterable attribution field, not a tamper-evident one (documented in the audit architecture notes); a distinct control would be needed if mandate-attribution integrity itself became a regulatory requirement.

## [0.13.0] — 2026-07-06 — Audit-log & recordkeeping export (M6 compliance-defensibility)

### Added
- **Verifiable recordkeeping export** (M6 recordkeeping wedge) — the /compliance/audit-log page is now the full compliance-defensibility surface: a filterable, paginated view of the immutable audit trail (mandate/event-type/actor/date), a hash-chain **integrity badge** (tamper-evidence at a glance), and a **recordkeeping export** — a mandate/time-scoped, self-contained package (in-scope entries + per-entry hashes + a full-chain integrity result + a manifest) that a regulator or auditor can independently re-verify offline. No schema change (reads the existing audit log).
- Endpoints: `GET /compliance/audit-log` (filtered read), `GET /compliance/audit-log/verify` (chain integrity), `POST /compliance/audit-log/export` (verifiable package). Compliance/admin see org-wide and can export; advisors see their own outreach and cannot export.

### Correctness / compliance
- The audit log stays immutable: the read and verify paths write nothing to it; only the export action records itself — exactly one entry, last in its transaction (proven live: an export moved the verified chain from 309 to 310 entries). The integrity check is the real tamper-evidence verifier over the whole chain. Export is restricted server-side (advisors are refused). Bad filter input is rejected (not run as an unbounded query). The mandate-scoped view honestly documents which records it derives (it does not overclaim completeness — the full-chain export is the complete record).

### Provenance (transparency)
- Recordkeeping only — no email is sent, no AI drafting, no edit or delete of audit rows. Formal PDF/multi-regulation export formats and producer-side mandate-tagging of every gate decision are deferred to later bundles.

## [0.12.0] — 2026-07-05 — Pipeline / deal-stage tracking (M6 pipeline)

### Added
- **Deal-pipeline tracking** (M6 pipeline half) — an advisor enrolls an eligible deal (a send-eligible outreach or an accepted match) into a fixed-stage pipeline and moves it through the stages on a stage-columned board at `/pipeline`: **shortlisted → contacted → engaged → diligence → offer → closed → withdrawn** (fixed for now; configurable stages deferred). Each deal carries a per-deal event timeline — enrollment, every stage transition, and advisor free-text notes — as an immutable, chronological record. Migration 0011 (pipeline + pipeline_events).
- Endpoints: `GET /pipeline` (board, grouped by stage), `POST /pipeline` (enroll), `PATCH /pipeline/:id/stage` (transition), `POST /pipeline/:id/notes` (add note), `GET /pipeline/:id/events` (timeline). RBAC: advisor moves deals; advisor + compliance read and add notes; every mutation audited.

### Correctness / compliance
- Every enroll, stage transition, and note is written to the immutable audit log **last in its transaction** — if the audit write fails, the whole change rolls back, so a pipeline record can never exist without its audit entry (proven end-to-end against a real database). Enrolling the same deal twice is refused; illegal stage moves and unauthorized roles are rejected on the server; a deal can only be enrolled under the mandate it actually belongs to (no mis-attributed deals); pipeline notes are append-only (no edit or delete).

### Provenance (transparency)
- The pipeline is **tracking only** — no email is sent and no AI drafting is offered here (the board carries no "Send" or "AI" affordance). Automated stage advancement from replies/opens, actual email send, and AI-assisted drafting remain deferred to later M6 bundles.

## [0.11.0] — 2026-07-05 — Compliant-outreach foundation (M6 first bundle)

### Added
- **Compliant outreach foundation** (M6 first bundle) — an advisor builds versioned outreach templates and drafts immutable versions (each content-hashed); a compliance officer grants or rejects each version in a **compliance approval queue** (`/compliance-queue`), with Segregation-of-Duties enforced (the approver is recorded; a template's composer cannot be its own approver). In the **outreach composer** (`/outreach-composer`), an advisor picks an approved template + a shortlisted buyer and runs a **non-bypassable pre-send compliance gate** ("Run Compliance Gate & Create Record") that reuses the M2 compliance authority and returns **send-eligible** or **blocked (+reason)**. Migration 0010 (outreach_templates + outreach_template_versions + outreach).
- Endpoints: `POST /outreach-templates` (+ `/:id/versions`, `/request-approval`, `/approve`, `/reject`), `POST /outreach` (compose → gate → send_eligible|blocked), `GET` list/detail. RBAC: advisor/analyst draft, compliance-only approve, advisor compose; every mutation audited.

### Correctness / compliance
- The pre-send gate is genuinely non-bypassable: a record can become **send-eligible only through a passing compliance verdict** — proven end-to-end by an un-mocked integration test against a real Postgres (an approved, SoD-clean, hash-matching template version passes; no-approval, self-approval, and content-drift are each blocked). Version-binding: editing an approved template mints a new pending version that is not send-eligible until re-approved. Approval is compliance-role-only; a deleted approver fails closed (blocked).

### Provenance (transparency)
- **No email is sent and no AI drafting is offered in this bundle** — the composer produces a *send-eligible record* and states plainly "No email has been sent". The shipped UI carries no "Send", "Schedule Send", or "AI Drafting" affordance (verified on the deployed authenticated pages), so the product never implies a capability it does not perform. Actual email send, tracking, pipeline, and AI-assisted drafting are deferred to later M6 bundles.

## [0.10.0] — 2026-07-04 — Buyer-seller matching (M5 deterministic)

### Added
- **Deterministic buyer-seller matching** (M5 first bundle) — for a mandate whose buyer universe is submitted (ready-to-rank), an advisor runs a match: a deterministic, rule-based fit score (integer 0-100 from the mandate's buyer criteria + contact completeness, with a per-dimension score breakdown) produces a ranked buyer list at `/matches-shortlist`; the advisor accepts/rejects/flags to build a shortlist and hands it off as ready-for-outreach. Reached from the mandate detail's "Ranked Candidates" panel. Migration 0009 (match_run + match_candidates).
- Endpoints: `POST /matches` (run; idempotent per buyer universe), `PATCH /matches/:id/candidates/:cid` (accept/reject/flag), `POST /matches/:id/handoff` (ready-for-outreach), `GET /matches`. RBAC advisor-primary; every mutation audited.

### Correctness / compliance
- The fit score is a pure deterministic function with a meaningfully-discriminating ranking; re-running a match preserves the advisor's existing accept/reject decisions; the run is guarded (a buyer universe must be submitted; a shortlist must have at least one accepted buyer before handoff); dimensions the underlying company data can't support are shown as "not applied" rather than silently scored.

### Provenance (transparency)
- The score is presented as a **rule-based fit score with a per-dimension breakdown — NOT an AI-generated rationale**. There is no LLM/AI in this bundle. The AI-assisted ranking + explainable rationale is a later, separately-gated M5 bundle. No AI-capability is claimed on the page that the system does not perform.

### Boundary
- Matching + shortlist + ready-for-outreach handoff only — this bundle does not send outreach (that is Milestone M6).

## [0.9.0] — 2026-07-04 — Buyer universe (M4 complete)

### Added
- **Buyer-universe builder** (M4 final bundle) — for a sell-side mandate, an analyst assembles a candidate buyer set from the canonical companies store, filters it by the mandate's buyer criteria (per-candidate include/exclude with provenance), enriches included candidates with their contacts, flags gaps, and submits the universe as ready-to-rank. Reached from the mandate detail's "Buyer Engine" panel at `/buyer-universe`. Migration 0008 (buyer_universe + buyer_universe_candidates; one universe per mandate). This **completes Milestone M4 — Mandates & buyer universe** (create a configured mandate → assemble + enrich a buyer universe ready to rank).
- Endpoints: `POST /buyer-universe` (assemble; idempotent per mandate), `POST /:id/filter`, `POST /:id/enrich`, `GET /:id/gaps`, `POST /:id/submit`, `GET /buyer-universe`, `PATCH /:id/candidates/:cid`. RBAC analyst-primary (advisor/admin permitted); every mutation audited.

### Compliance / correctness
- Idempotent assembly (a mandate has exactly one buyer universe; concurrent-safe); submit is guarded (rejects a universe with no included candidates or any un-triaged candidate); the criteria filter is honest about dimensions it cannot yet apply (geo/size/deal-type are recorded as not-applied and surfaced in provenance + the audit trail, rather than silently claiming a full filter).

### Boundary
- Assembly + filtering + enrichment + submission only — no fit-scoring, ranking, or AI matching here; ranked buyer-seller matching is the next milestone (M5).

## [0.8.0] — 2026-07-04 — Mandate spine (M4 create/list/detail)

### Added
- **Mandate management** (M4 first bundle) — an advisor creates a fully-configured sell-side mandate at `/mandates/new`: seller/target profile (name, industry, regions, size band, deal type) + buyer criteria (industry / geo / size-band / deal-type) + compliance guardrails (legal jurisdiction → disclaimer template derived server-side; suppression scope; three required acknowledgments). Persisted in one transaction (mandate + buyer_criteria + compliance_profile), audited (M2 hash-chain), and viewable at `/mandates/:id` (SSR-hydrated detail) and `/mandates` (list + status filter). Migration 0006 (3 mandate tables) + 0007 (one-active-disclaimer-per-jurisdiction unique index).
- **Compliance capture** at mandate creation — the jurisdiction, disclaimer template, suppression scope, and three attestations are captured and stored for the later pre-send compliance gate (enforcement remains in that gate; captured-not-enforced here). Endpoints: `POST /mandates`, `PATCH /mandates/:id` (advisor/admin, audited), `GET /mandates` + `GET /mandates/:id` + `GET /mandates/jurisdictions` (advisor/admin/analyst read).

### Compliance / safety
- One-transaction atomic mandate write (no partial mandate); audit-last-in-transaction (a create that can't be audited doesn't commit); all three acknowledgments strictly required; disclaimer template derivation is deterministic and rejects ambiguous compliance config; active mandates are locked against reconfiguration and illegal state reversion.

### Deferred
- The buyer-universe builder (assemble/filter/enrich candidate buyers → submit to matching) — the next M4 bundle; the mandate-detail page renders labelled placeholders for it.

## [0.7.0] — 2026-07-04 — Sourcing workspace (M3 search entry)

### Added
- **Sourcing workspace** at `/sourcing` (analyst) — the M3 search entry point: search over the deduped canonical company universe (in-memory over the SSR-loaded set), a source facet across connected data sources, a results matrix with per-company source badges (from real connection displayNames), a company detail drawer (contacts + provenance), and a per-connection "sync now" trigger that reuses the wave-6 idempotent ETL→dedupe pipeline. Hand-off to `/sourcing/companies` (the dedupe review queue). Completes M3's success metric — "search across ≥2 connected sources" — verifiable on ≥2 fixture connections.
- **Connection management**: `POST /sourcing/connections` (create; analyst/admin; audited via the M2 hash-chain; providerKey validated against the adapter registry → 400 on unknown; `UNIQUE(display_name)` → 409 on dup) + `GET /sourcing/connections` (list, per-connection company counts). Migration 0005 (UNIQUE display_name). Per-company `connectionIds` on the companies list (source badges).

### Fixed
- Web SSR/client render hardening across the sourcing + compliance surfaces: shared read-schema timestamps accept the PostgreSQL wire format (were rejecting real API data → empty lists); `companySchema` accepts the API `connectionIds`/`sourceCount` fields; the company detail page SSR-hydrates (no Server→Client function-prop violation, no client fetch colliding with the page route).

### Deferred
- The first REAL data-source provider adapter (awaits a founder vendor choice + account-issued API key); an in-page per-candidate dedupe modal; advanced search facets / saved searches.

All notable changes to DealFlow AI are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

## [0.6.0] — 2026-07-04

Deal sourcing goes live: connect data sources, pull in companies and contacts, and automatically fold duplicates into one clean record that remembers where every detail came from.

### Added
- Pluggable data-source connectors with an on-demand sync that pulls company and contact records into a staging area without touching the clean data set.
- Deterministic de-duplication that promotes staged records into canonical companies and contacts, collapsing the same company seen across sources into one record.
- Source provenance on every canonical company and contact, so each record traces back to every source and connection it came from.
- A review queue for uncertain matches that never auto-merges, plus a companies-and-contacts screen to view, filter, and resolve them.

## [0.5.0] — 2026-07-03

The compliance gate goes live: a single, non-bypassable check that every outreach must pass before it can be sent, with each decision recorded in the tamper-evident audit log.

### Added
- Configurable compliance rules engine: suppression lists, per-jurisdiction disclaimers, and approval policies, all managed by compliance and admin roles.
- A single non-bypassable pre-send compliance check that blocks any send failing suppression, separation-of-duties, required-disclaimer, or approval-binding rules — no path can skip it.
- Separation of duties: an outreach can only be sent if a different person in the compliance role has approved it; the sender can never approve their own send, and admins cannot stand in as approver.
- Approval is bound to the exact approved content, so any edit after approval automatically re-blocks the send until re-approved.
- Compliance settings management screen for maintaining rules, suppression entries, and disclaimers, with every change written to the audit log.

## [0.4.0] — 2026-07-03

The tamper-evident audit log: a cryptographic, append-only record of who did what, that no one — not even a database administrator — can silently alter or delete.

### Added
- Append-only audit log: every entry is chained to the one before it with a cryptographic signature, so any edit, deletion, or reordering breaks the chain and is detectable.
- Database-level immutability that blocks updates, deletes, and table truncation outright, so the record cannot be rewritten even by a privileged account.
- Chain-integrity verification endpoint (`GET /compliance/audit-log/verify`), restricted to compliance and admin roles, that confirms the full record is intact or pinpoints where it was tampered.
- Compliance integrity view at `/compliance/audit-log` showing the live record and its verification status.

## [0.3.0] — 2026-07-03

The authenticated shell: a shared app frame, a role-aware landing dashboard, and access control that enforces who can reach what.

### Added
- Shared application shell (sidebar + top bar) rendered once and used by every signed-in page, with a role-aware landing dashboard on `/`.
- Per-route access control (RBAC): every protected API and web route now checks the signed-in member's role and blocks anyone without permission, failing closed by default.
- Role-based navigation that shows each member only the sections their role can open, driven by the same source of truth as access control so the menu can never offer a link the rules would deny.
- Roles are read from the server-verified session on every request, so access reflects a member's current role rather than a stale sign-in claim.



Invite-only user accounts and sign-in: the platform's first authenticated surface, with a role-aware data model and hardened sessions.

### Added
- Invite-only email/password authentication (SuperTokens): login, accept-invite, and reset-password screens wired end-to-end to the API. (#2)
- User/role/invite data model with four seeded roles (advisor, analyst, compliance, admin); each account maps 1:1 to a SuperTokens identity and its session carries a role claim.
- Auth API — signup, `GET /auth/me`, logout, and password reset — plus a role-aware guard primitive (per-route RBAC deferred to a later wave).
- Session hardening: HttpOnly + Secure cookies (SameSite=Lax) with CSRF protection, constant-time reset responses (no user-enumeration), and no account creation without a valid invite.

## [0.1.0] — 2026-07-02

Walking skeleton: the monorepo foundation, a database-aware health endpoint, CI, and a first live deploy.

### Added
- Turborepo + pnpm monorepo with `api` (NestJS), `web` (Next.js 15), and a shared package.
- `GET /health` endpoint returning `{status, db, version}` — 200 when Postgres is reachable, 503 when it is not.
- Postgres schema managed by Drizzle with an idempotent first migration.
- GitHub Actions CI (lint, typecheck, build, integration test against real Postgres) green on `main`. (#1)
- Live deploy on Railway — API and web reachable in production.
