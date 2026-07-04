# Product Decisions — DealFlow AI

**Append-only decision log.** Captures the "why" behind product and technical choices so AI agents and future developers don't re-litigate settled decisions.

---

## Entry format

```markdown
### [YYYY-QN] <Short decision title>
**Category**: Architecture / Security / Payments / Marketplace / Design / DevOps / Process / Data Model / API
**Status**: Active / Superseded / Deferred / Cancelled
**Context**: What situation required the decision.
**Decision**: The actual decision.
**Rationale**: Why this choice over alternatives.
**Alternatives considered**: Options rejected and why.
```

---

## Architecture & Stack

### [2026-Q2] Tech stack selected
**Category**: Architecture
**Status**: Active
**Context**: v5 onboarding stack selection.
**Decision**: claudomat baseline (applied as default) — Turborepo/pnpm monorepo, NestJS + Next.js 15 (TypeScript), PostgreSQL + Drizzle, SuperTokens auth, Railway hosting (bring-your-own), GitHub Actions CI, Biome, Vitest + Playwright. Payments (Stripe) deferred — no MVP payments. See stack-decisions.md.
**Rationale**: No stack signal in v0 docs or founder requests; product is a standard data-heavy TypeScript/React web app the baseline fits directly. Applied silently per always-on rule 17 and announced to the founder.
**Alternatives considered**: None raised by founder.
**Cascading updates**: None on the default path. v6 architecture additionally specifies project-driven pieces not in the generic baseline: a transactional-email + event-tracking provider (required for compliant outreach), a tamper-evident append-only audit-log store, an LLM provider for matching/drafting, and deal-source/enrichment data providers.

## Authentication & Security

### [2026-Q2] Formal compliance-regime classification = none (features still built)
**Category**: Security
**Status**: Active
**Context**: v6b project.yaml consolidation. The `compliance_regime` enum (gdpr/hipaa/pci/soc2/none) has no FINRA/SOX option; asked the founder how to classify for ongoing reviews.
**Decision**: `stack.compliance_regime: none` — keep the formal regulatory classification light for now. **This does NOT reverse compliance-first**: the compliance FEATURES (tamper-evident audit log, pre-send approval gate, suppression/disclaimer rules, recordkeeping export) remain MVP-core and are fully architected (v6 security/databases branches). What "none" changes is only that future changes are NOT gated by a formal SOC2/GDPR regime review; the founder can raise the classification later.
**Rationale**: Founder chose "keep it light for now." For an internal/pilot tool, building the audit/recordkeeping features matters more right now than formally binding the project to a regulatory regime label. Reversible.
**Alternatives considered**: soc2 (SOX/FINRA-aligned controls) — not chosen now; GDPR — only if EU data enters scope.

### [2026-Q2] Build compliance-first into the MVP (not deferred)
**Category**: Security
**Status**: Active
**Context**: The founder's brief listed "compliance-first architecture (SOX, FINRA readiness)" as an MVP must-have, but also framed DealFlow AI as an internal tool — which normally defers formal compliance to a later horizon. Surfaced at v1 onboarding.
**Decision**: Treat compliance as MVP-scope (H1). The first shippable version includes tamper-evident audit logs, communication recordkeeping, and FINRA/SOX-minded outreach controls as core to the outreach loop — not a later milestone.
**Rationale**: M&A outreach lives under recordkeeping/communications rules; an outreach tool without defensible audit trails is unusable for live mandates regardless of matching quality. Compliance is therefore a precondition for the core loop being usable and a wedge vs ungoverned point tools (Hunter.io / RocketReach). Founder explicitly chose "build compliance-first now" over deferring.
**Alternatives considered**: (a) Audit trail now, formal SOX/FINRA controls later — rejected as it leaves live-mandate outreach under-governed at pilot. (b) Minimal compliance, decide regime at planning — rejected as too risky for regulated outreach with a pilot partner.

## Payments & Finance

_(empty)_

## Marketplace & Product

_(empty)_

## UI & Design

### [2026-Q2] Design direction approved
**Category**: Design
**Status**: Active
**Context**: v7 onboarding design direction, anchored on the Dashboard.
**Decision**: Clean, light-mode interface — calm neutral slate/grey scale (near-white backgrounds → near-black text) with an emerald-green accent for positive/status states; left sidebar navigation; dashboard composed of active-mandate cards, AI match fit-scores, outreach-activity, and a compliance queue. Restrained, credible, data-dense-but-legible — Linear/Stripe spirit, deliberately not a heavy enterprise CRM. Emotional anchors: credible · calm · precise · fast · trustworthy. Light default (dark-mode-feasible token structure, deferred).
**Rationale**: Fits a time-pressured M&A advisory audience working dense deal/financial data who need to trust an audit-grade tool; beats incumbent (DealCloud) density/bloat while matching its credibility. Founder approved on first generation (no revisions needed).
**Artifacts**: `design/direction.html`, `process/session/onboarding/v7-direction-brief.md`

### [2026-Q2] Design system built + approved
**Category**: Design
**Status**: Active
**Context**: v8 onboarding design system generation, on the approved v7 direction + locked module list.
**Decision**: `design/DESIGN-SYSTEM.md` populated — neutral zinc/grey scale + emerald accent + a 5-value status palette; Inter typography with tabular-nums for financial data; spacing/radius/shadow/motion tokens; and a component kit (standard primitives + DealFlow-specific: MatchCard with FitScore, StatusBadge set, ComplianceCheckPanel, AuditLogRow with integrity indicator, MandateCard). Light default, dark-mode-feasible token structure. Visual showcase at `design/staging/design-system.html`.
**Rationale**: Aligned to approved direction (v7) + locked module list (v6b). Founder approved first build.
**Artifacts**: `design/DESIGN-SYSTEM.md`, `design/staging/design-system.html`

### [2026-Q2] Per-page designs complete (20 screens)
**Category**: Design
**Status**: Active
**Context**: v9 onboarding per-page design generation; founder reviewed in 4 grouped batches and approved all.
**Decision**: 20 screens designed + approved (canonical at `design/<page>.html`): dashboard, mandates-list, mandate-detail, mandate-new, matches-shortlist, buyer-universe, outreach-composer, pipeline, sourcing-workspace, companies-contacts, templates-library, compliance-queue, audit-log-export, compliance-settings, admin-integrations, admin-users, admin-workspace-settings, login, accept-invite, reset-password.
**Consistency note**: Pages were generated independently and a ui-designer audit found chrome drift (mixed icon libraries, per-page nav variation, a few off-palette accents). The egregious structural cases (matches-shortlist, outreach-composer, audit-log-export) were regenerated against the canonical shell. Remaining minor drift is ACCEPTED as directional — true cross-page consistency is enforced at build time by a single shared `<AppShell>` (Sidebar + TopBar) + the design-system contract added at DESIGN-SYSTEM.md §10 (lucide-only icons, emerald-600 primary, zinc+emerald+5-status palette, canonical sidebar item set). B-block must implement chrome once, not per page.
**Artifacts**: `design/<page>.html` ×20, `command-center/product/per-page-pd/<page>.md` (annotated), DESIGN-SYSTEM.md §10.

## DevOps & Deploy

### [2026-Q2] CI + canary + PR conventions (defaults)
**Category**: DevOps
**Status**: Active
**Context**: v13 onboarding CI-PRINCIPLES + CI workflow authoring.
**Decision**: GitHub Actions CI (lint / typecheck / test-with-real-Postgres / `pnpm audit --audit-level=high` / build; every job `timeout-minutes` + least-privilege `permissions`). Canary = Standard profile (error_rate 1.0%, p95 +200ms, 15min), runs once real-user DAU crosses 1000. PR conventions = AI-attribution footer ON, auto-merge OFF, squash. Applied silently as technical defaults (rule 17).
**Rationale**: Standard canary fits pilot-customer; conservative human-merge fits a solo/internal team; the audit gate reflects the compliance-first posture.
**Alternatives considered**: Strict/lenient canary; auto-merge — not chosen for a pilot.

## Testing

### [2026-Q2] Test accounts — auto-provision via signup
**Category**: Testing
**Status**: Active
**Context**: v13 onboarding test-account seeding.
**Decision**: Test accounts are created through the project's own signup flow at the first UI wave's B-5 (one local-dev + one prod-fixture per v3 persona: advisor / analyst / compliance / admin). `project.yaml: test_users.local_dev` = `[]` until then.
**Rationale**: No credentials needed at handoff; avoids vendor lock-in to provider tooling. T-5 / T-8 won't block — accounts exist before first needed.
**Next action**: First UI wave's B-5 scripts the signup endpoint.

## Process & Workflow

### [2026-Q2] Launch stage = pilot-customer (upgraded from self-use-mvp)
**Category**: Process
**Status**: Active
**Context**: The brief declared founder stage `self-use-mvp` (founder is first user inside her own firm). At v1 onboarding the founder clarified that one friendly outside advisory firm is planned as a design partner shortly after launch.
**Decision**: Set founder stage to `pilot-customer`. Build for the founder's firm first, but keep a near-term external design partner in mind for security, data isolation, and compliance scoping.
**Rationale**: A design partner outside the founder's own firm changes the trust/security bar from "internal only" to "another firm's data flows through this." Combined with the compliance-first decision, this raises the v6 security branch and v10 compliance milestone to H1.
**Alternatives considered**: Keep self-use-mvp — rejected because it would under-scope security/data-isolation for the imminent external partner.

## Data Model Decisions

### [2026-Q2] Roadmap authored — 12 themed milestones (v10)
**Category**: Process
**Status**: Active
**Context**: v10 planning; founder approved the roadmap shape.
**Decision**: Authored 12 themed milestones (DB, all `status='todo'`, zero child tasks — decomposition is per-wave). H1/MVP (7): M1 Foundation, M2 Compliance backbone, M3 Deal sourcing & data, M4 Mandates & buyer universe, M5 AI matching, M6 Compliant outreach & pipeline, M7 Admin & settings. H2 (3): M8 Pilot-partner workspace, M9 Integrations & insight, M10 Advanced compliance artifacts. H3 (2): M11 Multi-tenant SaaS + billing, M12 Deal network + predictive models. The broad v1 seed milestone ("H1 — Integrated sourcing…") was CANCELLED (superseded by this build-ordered themed set). M2 (compliance backbone) is H1 per the compliance-first override; formal SOX/FINRA artifacts (M10) stay H2.
**Rationale**: Build-order themes with platform-foundation first (M1/M2), then the product loop (M3→M6), then admin (M7). Every MVP page/feature/module/SDK is covered in some milestone's Scope prose. M6 is the "one live mandate end-to-end" proof of the core bet.
**Alternatives considered**: Trim to MVP-only — founder chose full roadmap. Reshape — not requested.

### [2026-Q2] v6b architecture cross-branch conflict resolutions
**Category**: Architecture / Data Model
**Status**: Active
**Context**: v6b integration; architect-reviewer found 19 cross-branch items. `_library.md` is authoritative; resolutions below applied (architect-recommended winners adopted).
**Decisions**:
1. Recordkeeping is a real H1 module with an `export_jobs` status table (async export, fire-and-query).
2. Add `notifications` + `notification_preferences` tables (Databases was missing them).
3. Buyer-universe is a real backend module + `buyer_universe` schema (canonical backend module roster reconciled).
4. Templates is its own module (split from Outreach) with `template_versions` — needed so editing a message after approval invalidates the approval (compliance version-binding).
5. **Audit integrity = HMAC-SHA256 with a Railway-secret key (+ `chain_version`)**, NOT bare SHA-256 — DB-write access alone must not be able to forge the chain. (Compliance crown jewel.)
6. Audit append-only enforced by BOTH an INSERT-only DB grant AND a BEFORE UPDATE/DELETE trigger (defense-in-depth).
7. Audit table = `audit_log_entries`, PK `sequence_number` (Databases is physical-schema authority); fold in `actor_role` + `chain_version`; keep `content_hash` (chain hash) and `payload_hash` (payload hash) as distinct fields.
8. Compliance tables use Databases names: `compliance_approvals` (not `compliance_queue`), `suppression_list`, `disclaimer_templates`, `compliance_rules`.
9. **Pipeline: fixed stage enum for MVP** (shortlisted→contacted→engaged→diligence→offer→closed/withdrawn) + a separate append-only `pipeline_events` table for notes/transitions (feeds audit log). Advisor-configurable per-mandate stages deferred to H2. *(Product-flavored default — reversible; revisit if the founder wants custom stages.)*
10. **Data-source credentials live in Railway env vars only** (`data_source_connections` holds metadata + `provider_key`, no encrypted secrets in DB) — matches the project secrets convention. Consequence: adding a NEW data source needs an ops/env change (no in-app dynamic credential entry) — acceptable for pilot's few fixed sources; in-app source management deferred to H2. *(Logged consequence.)*
11. SuperTokens runs against its OWN Railway Postgres instance, separate from the app DB (`SUPERTOKENS_*` URL never aliases `DATABASE_URL`).
12. App DB env var standardized to `DATABASE_URL` (drop `POSTGRES_URL`).
13. Email webhook secret = provider-agnostic `EMAIL_WEBHOOK_SECRET`; email API key provider-agnostic too (pluggable email provider; Resend is a candidate, not locked).
14. Background queue = BullMQ + Redis (confirmed — Outreach per-domain send rate-limiting depends on it); adds a Redis service.
15. CI test DB = real Postgres container (Docker Compose / testcontainers), NOT pg-mem — the audit append-only grant tests (SQLSTATE 42501) need real role grants.
16. Realtime = SSE for MVP (no WebSocket/Socket.IO gateway); DevOps `api` label corrected.
17. Add `pnpm audit --audit-level=high` as a CI gate (compliance posture).
18. Playwright Chrome binary must be installed host-side before the first UI wave's T-5 (env gap; flagged in test.md + devops.md + competitive-benchmarks/INDEX.md).
**Rationale**: All are UNAMBIGUOUS winners or technical defaults; the four compliance-core invariants (append-only audit, hash-chain integrity, non-bypassable pre-send gate, sender≠approver separation of duties) were consistent across branches — conflicts were mechanism/naming detail only.

---

## [2026-07-02] M1 — Foundation: promoted todo → in_progress (N-1 wave-1 close-out)

**Decision**: M1 (Foundation: auth, roles, app shell, data model, CI) promoted `todo → in_progress`.

**Trigger**: N-1 survey found zero `in_progress` milestones — M1 was never promoted during greenfield bootstrap (wave-1 seed was hand-seeded under a `todo` milestone). Highest-tier `todo` (T1, platform-foundation, required-by all milestones) → promoted per slot-promotion rule (Action 8a).

**Consequence**: M1 is now the active milestone. Wave-1 shipped only scaffold+CI of M1's scope; auth/RBAC/AppShell/data-model/auth-screens remain → decomposition fires for the next foundation bundle (see next entry). M1 NOT closed (scope not shipped).

---

## [2026-07-02] M1 — Foundation: bundle authored — 3 tasks (auth vertical slice)
- caller: N-1-next-bundle
- decomposed by: milestone-decomposer sub-agent
- Slice: end-to-end auth vertical (DB + API + UI). Seed "Integrate SuperTokens auth + user/role data model" (SuperTokens on its own Postgres per #11, users/roles/invites additive Drizzle schema, invite-only, role session claim) + siblings "Build invite-only auth API: signup, session, reset" (NestJS auth endpoints + role-aware guard primitive) and "Wire login, accept-invite, reset-password screens end-to-end" (three Next.js 15 auth pages, Playwright E2E to authenticated placeholder). AppShell (DESIGN-SYSTEM.md section 10), role-aware dashboard shell, and full per-route RBAC enforcement deliberately deferred to a FOLLOW-UP M1 bundle to keep this slice within the size rubric.

---

## [2026-07-03] M1 (M1 — Foundation: auth, roles, app shell, data model, CI): bundle authored — 3 tasks (AppShell + role-aware dashboard shell + per-route RBAC)
- caller: N-1-next-bundle
- decomposed by: milestone-decomposer sub-agent
- Slice: the M1 shell + RBAC vertical explicitly deferred by the 2026-07-02 auth-vertical bundle. Seed "Build shared AppShell chrome + role-aware dashboard shell" (single shared `<AppShell>` = `<Sidebar>` + `<TopBar>` + base primitives per DESIGN-SYSTEM.md section 10 — zinc/emerald, lucide-react only, 4px grid; replaces the wave-2 dashboard placeholder with a role-aware landing reading the SuperTokens role claim for the 4 roles advisor/analyst/compliance/admin) + siblings "Enforce per-route RBAC across API and web routes" (extends the wave-2 guard primitive to per-route API 403s + web route protection off one canonical route→allowed-roles mapping) and "Make AppShell navigation role-aware for the 4 roles" (sidebar items render per role off the SAME mapping — no drift between shown nav and reachable route). Vertical slice (UI + API + guard wiring); closes M1's "land on a role-aware dashboard shell" + per-route RBAC success-metric gap. N-1 judgment override: two existing open follow-ups (test-fixture typing bfadcec1; auth-hardening 6fe232e3) left in queue — they do not advance M1's defining unshipped scope.
- N-1 judgment note: seed-candidate guard count returned 0 (both open follow-ups carry a wave_id); authored per N-1 Action 7 re-ordering allowance, not the standard empty-queue trigger.

## Wave 3 — canonical dashboard route + RBAC route matrix (P-4 remediation, 2026-07-03)
**Decision:** The role-aware dashboard shell mounts at **`/`** (authed; unauthenticated → redirect `/login`), per user-journey-map row 4 ("Dashboard, `/`, All role-aware"). This supersedes the wave-2 placeholder `/dashboard` and the wave-1 public `/` health-landing (health remains served by the api `GET /health`). Public (ungated) allowlist = `/auth/*` + `GET /health` only. Login/accept-invite success redirects to `/`.
**Why:** Resolves a spec-vs-journey-map drift jenny caught at P-4 (plan had used `/dashboard` + a public `/`). The product's front door is the authed app; a compliance-first M&A tool has no public marketing landing in the MVP journey map. Follows the canonical journey map rather than the stale placeholder.
**RBAC route matrix:** pinned to the journey-map persona columns (single `roleRoutes` source of truth in `@dealflow/shared`; drives both nav visibility and `@Roles()` enforcement; nav⊆RBAC contract-tested). Enforced live this wave on `/` (all roles) + `/compliance/summary` (compliance, admin); the remaining route→role rows are pinned now as the enforcement contract for M3+ pages.

## [2026-07-03] M1 → done; M2 → in_progress (N-1 milestone disposition, wave-3 close)
**Decision:** M1 (Foundation: auth, roles, app shell, data model, CI) closed `in_progress → done`. M2 (Compliance backbone: tamper-evident audit log + rules engine) promoted `todo → in_progress`.
**Trigger:** N-1 Action 6 closure check (wave-3 close). M1 open_count=3 but ALL 3 open rows are non-core follow-ups (test-fixture typing bfadcec1; auth-hardening rate-limit/CSRF 6fe232e3; AppShell placeholder pages d7f716b4). M1's core `## Scope` (monorepo, NestJS+Next.js, Postgres+Drizzle, SuperTokens invite-only auth, RBAC 4 roles, shared AppShell, auth screens, role-aware dashboard shell, CI) is delivered across the 7 done tasks, and M1's `## Success metric` (invited user → set password → sign in → role-aware dashboard shell; CI green real-Postgres; Railway dev) is SHIPPED + live-verified in wave-3 (935b847, E2E 7/7). None of the 3 open follow-ups is required by the success metric — they are polish/hardening. Judged shipped → closed.
**M1 follow-up disposition:** the 3 open follow-ups re-parented `milestone_id M1 → M2` (they retain their original `wave_id`; parent_task_id NULL) so they stay claimable and get re-triaged under the now-active compliance milestone rather than orphaned. They are candidate seeds for a future wave but do not gate M2's own scope.
**M2 promotion rationale (Action 8a):** M2 is the highest-tier `todo` — `## Tier T1`, `## Class platform-foundation`, `## Bet source Compliance-first outreach wedge`, `## Required by M6, M10`, `## Why now` founder compliance-first override (audit/recordkeeping MVP-core H1, the defensible wedge). Oldest `created_at` in the todo queue and highest tier (vs M3 T2). Advancing the roadmap to the actual product wedge.
**Consequence:** M2 is the active milestone; its queue has no fresh top-level seed (the 3 re-parented rows all carry a wave_id) → N-1 Action 7 fires milestone-decomposition against M2 for the next wave's first bundle.

[2026-07-03] M2 (Compliance backbone: tamper-evident audit log + rules engine): bundle authored — 4 tasks (first vertical slice: stand up the tamper-evident HMAC-SHA256 hash-chained audit-log service — immutable table + append service + integrity verifier + compliance-settings integrity view; rules engine / suppression / disclaimer / pre-send check deferred to a later M2 bundle since they depend on this audit log existing first)
- caller: N-1-next-bundle
- decomposed by: milestone-decomposer sub-agent

## [2026-07-03] M2 (Compliance backbone: tamper-evident audit log + rules engine): bundle authored — 4 tasks (compliance rules engine + callable pre-send gate)
- caller: N-1-next-bundle
- decomposed by: milestone-decomposer sub-agent
- Slice: M2's second (rules-engine) vertical, unblocked now that wave-4 shipped the audit-log half (AuditService.append a8b2b5a2 exists to write to). The prior M2 bundle log explicitly deferred exactly this. Vertical DB→service→UI. Seed "Build compliance rules engine schema + non-bypassable pre-send compliance gate service" (seed 0595a835) = the 4 rules-engine tables (compliance_rules, suppression_list, disclaimer_templates jurisdiction-keyed, compliance_approvals) + the single ComplianceGateService.evaluate() that is the SOLE send-eligibility authority and MUST write its pass/block verdict via AuditService.append in-transaction — non-bypassability is a stated acceptance criterion (no send path can skip the gate + log). Siblings: "Enforce suppression-list + approval-SoD checks inside the pre-send gate" (95adac6c — recipient suppression re-check at send time + sender≠approver / approver-is-compliance SoD assertion, reusing M1 RolesGuard), "Enforce jurisdiction disclaimers + approval-version binding in the pre-send gate" (034463b1 — required per-jurisdiction disclaimer presence + content-hash approval-version match so post-approval edits re-block), and "Wire compliance-settings screen to manage rules, suppression, and disclaimers" (34cb1d18 — compliance-role CRUD on the existing compliance-settings shell 031d79fc, every change audited). Closes M2's success metric "suppression/disclaimer/approval rules are configurable and enforced by a callable pre-send check used by outreach (M6)". Anchored to architecture/security.md §"Outreach compliance controls" + §"Audit-log security" + §RBAC-SoD (one gate service = sole send-eligibility authority; non-bypassable choke point re-run at send time). Est. net LOC ~3,000–4,000, ≤~40 files. P-4 note: compliance-critical + non-bypassable gate → security-scope-tightened + SoD/RBAC gate expected at P-4 next wave; acceptance criteria authored to demand non-bypassability + SoD, gate itself not built here.
- N-1 judgment note: seed-candidate guard count returned 0 before authoring; the 3 pre-existing M1-follow-up rows (d7f716b4 AppShell-polish, 6fe232e3 auth-hardening, bfadcec1 test-fixture typing — all carry a wave_id, all parent_task_id NULL) were left untouched and are NOT part of this bundle.

## [2026-Q3] SoD approver is the compliance role only; admin cannot approve a send
**Category**: Security
**Status**: Active
**Context**: The wave-5 pre-send compliance gate enforces separation of duties (sender ≠ approver). The plan draft allowed the approver role to be either `compliance` or `admin`. jenny's P-4 iteration-1 review flagged this as a CRITICAL drift from `security.md` §RBAC-SoD, which specifies the approver must be `compliance` only, with the principle "no super-role shortcut around separation of duties."
**Decision**: The gate's SoD evaluator accepts an approval ONLY when the approver holds the `compliance` role and is a different person than the sender; `admin` is explicitly excluded as an approver. Settings-CRUD access on the compliance rules/suppression/disclaimer tables remains `compliance, admin` — admin manages configuration, which is a distinct authority from approving an individual send.
**Rationale**: A compliance separation-of-duties control is only meaningful if no single privileged role can both create and approve outreach. Allowing admin to approve would let an admin who also authored a send self-clear it, defeating the control and creating FINRA/SOX recordkeeping and audit exposure. Distinguishing "authority to configure" (admin) from "authority to approve a send" (compliance-only) preserves the control while keeping config management operable. Remediated doc-level at P-4 before B-block; live-verified at C-2 (admin-approver blocked, `sod/invalid-approver-role`).

## [2026-07-03] M2 → done; M3 → in_progress (N-1 milestone disposition, wave-5 close)
**Decision:** M2 (Compliance backbone: tamper-evident audit log + rules engine) closed `in_progress → done`. M3 (Deal sourcing & company/contact data) promoted `todo → in_progress`.
**Trigger:** N-1 Action 6 closure check (wave-5 close). M2 open_count=3 but ALL 3 open rows are the re-parented M1 non-core follow-ups (test-fixture typing bfadcec1; auth-hardening rate-limit/CSRF 6fe232e3; AppShell placeholder pages d7f716b4 — each retains an original wave-1/2/3 `wave_id`, parent_task_id NULL). They are NOT M2-scope work. M2's own `## Scope` names three components and ALL THREE are delivered across the 8 done tasks: (1) tamper-evident append-only audit-log service — HMAC-SHA256 hash-chain, INSERT-only grant + BEFORE UPDATE/DELETE trigger, content/payload hash distinct (wave 4: ec1f279d, a8b2b5a2, e6a4cbfe); (2) compliance rules engine — suppression_list, disclaimer_templates per-jurisdiction, compliance_rules, approval-gating + the callable non-bypassable pre-send check (wave 5: 0595a835, 95adac6c, 034463b1); (3) compliance-settings screen (031d79fc, 34cb1d18). M2's `## Success metric` is fully met: audit writes are hash-chained + integrity-verifiable with tamper detection (UPDATE/DELETE blocked); suppression/disclaimer/approval rules are configurable and enforced by a callable pre-send check. Wave 5 shipped LIVE (13e55ef), all gates APPROVED, real-browser 33/33, SoD admin-approver-BLOCKED live-verified. The success-metric clause "used by outreach (M6)" is an M6 forward dependency — the gate is a callable contract the M6 send-path will invoke (M6 `## Depends on: M2, M5`), NOT M2's own delivery. Judged shipped → closed.
**M2 follow-up disposition:** the 3 open M1-follow-ups re-parented `milestone_id M2 → M3` (they retain their original `wave_id`; parent_task_id NULL) so they stay claimable backlog and get re-triaged under the now-active M3 rather than orphaned or force-cancelled. After re-parenting, M2's own child set is fully terminal (0 open / 8 done) — closure invariant 3 satisfied honestly rather than by force-closing over open children.
**M3 promotion rationale (Action 8a):** M3 is the correct next active milestone — it is the front of the deal-flow pipeline (sourcing → mandates(M4) → matching(M5) → outreach(M6)) with NO `## Depends on`, i.e. the earliest un-blocked milestone. Although M6 carries `## Tier T1` (vs M3/M4/M5 at T2), M6 is dependency-blocked (`## Depends on: M2, M5`; M5 depends on M4 depends on M3) and cannot start now. With the compliance foundation (M1+M2) shipped, M3 advances the roadmap from "compliance backbone built" to the actual deal-flow product. M3 is `## Class product-feature`, so its wave-1 (wave 6) P-0 will run mvp-thinner.
**Consequence:** M3 is the active milestone; its queue has no fresh top-level seed (the 3 re-parented rows all carry a wave_id) → N-1 Action 7 fires milestone-decomposition against M3 for wave 6's first bundle.

## [2026-07-03] M3 (Deal sourcing & company/contact data): bundle authored — 4 tasks (first vertical slice: the deal-sourcing data spine — connection store + pluggable adapter → on-demand ingestion into raw_companies → deterministic dedupe into canonical companies+contacts with provenance → companies-contacts view/clean screen)
- caller: N-1-next-bundle
- decomposed by: milestone-decomposer sub-agent
- Slice: M3's wave-6 (first) vertical. M3 is freshly promoted (0 done tasks). The seed slice is the data backbone every other M3 scope item depends on: nothing (search UI, scheduled sync, enrichment fan-out) can be built before the connection store, staging table, canonical companies/contacts store, and pluggable adapter interface exist. True DB→service→job→API→UI vertical, NOT a horizontal layer. Seed "Stand up data-source-connections store + pluggable DataSourceAdapter interface" (ff378a95) = Drizzle schemas for data_source_connections + sync_runs + raw_companies staging + canonical companies/contacts + provenance joins (company_data_sources/contact_data_sources, non-null source_connection_id + ingested_at per databases.md invariant 3) + dedupe_candidates, the IDataSourceProvider interface in @dealflow/shared with ≥2 DI-registered adapters (provider_key → Railway-env credentials, never in-DB), and admin-only connection CRUD (M1 RolesGuard, every mutation audited via M2 AuditService). Siblings: "Build ingestion/ETL service + on-demand SourceSyncJob into raw_companies staging" (0241222b — IngestionService + BullMQ SourceSyncJob, idempotent upsert on (connection_id, external_id), ETL-module multi-provider fan-out across ≥2 sources, schema-drift quarantine); "Build dedupe engine promoting raw_companies to canonical companies+contacts with provenance" (db274731 — DedupeService deterministic-then-fuzzy entity resolution, non-destructive merge with merged_into_id, provenance rows per contributing source; ≥2-source dedupe → one canonical record with both provenance rows = the metric's "import deduped records with provenance" proof); "Build companies-contacts screen to view, filter, and clean deduped records" (f5771d13 — journey-map page 13; list/detail/provenance-trail + dedupe_candidates accept/reject/merge + archive/suppress, shared-Zod DTOs, design-system tokens → D-block runs). Together they demonstrate M3's full success metric end-to-end in one path (import from ≥2 sources → deduped provenance-tracked records → view/clean on companies screen).
- Deliberate deferrals to a later M3 bundle (kept out to hold this as one coherent vertical, ~4,000–4,800 net LOC, ≤~55 files, 1 seed + 3 siblings): the sourcing-workspace search-and-trigger page (page 12), scheduled/cron SourceSyncJob, and contact-ENRICHMENT via an external provider (email verification, decision-maker discovery). The seed's adapters may be sandbox/fixture-backed for this first bundle if real vendor SDK access is not yet provisioned — the load-bearing acceptance criterion is the pluggable interface + ≥2-provider fan-out + provenance from the start, not the specific vendor; a real vendor integration triggers P-3 SDK-research per external-sdk-integration-rules.md.
- Anchored to architecture/databases.md §companies_contacts + §data_source_connections + invariants 2/3/5, architecture/modules.md #3 (ingestion) + #4 (dedupe/enrichment) + #19 (admin data-source credentials) + §Conventions (adapter pattern, fan-out is ETL responsibility), architecture/sdks.md §3 (Deal-Source Data APIs) + §Conventions (Pluggable Provider Interface + Secrets via Railway Env). Reuses M1 RolesGuard (RBAC) + M2 AuditService (every connection/merge/clean mutation audited, append last-in-txn). P-4 note: M3 is ## Class product-feature → wave-6 P-0 runs mvp-thinner; credentials-handling (provider_key/env, pgcrypto for admin credential storage) touches secrets → security-scope-tightened gate expected at P-4; UI wave → D-block runs.
- N-1 judgment note: seed-candidate guard count returned 0 before authoring, exactly 1 after; the 3 pre-existing re-parented M1-follow-up rows (d7f716b4 AppShell-polish, 6fe232e3 auth-hardening, bfadcec1 test-fixture typing — all carry a wave_id, all parent_task_id NULL) were left untouched and are NOT part of this bundle (backlog re-triaged under M3 by future N-2, not siblings of this seed).

## Wave 6 — deal-sourcing schema reconcile + contact-level provenance preserved (P-4 remediation, 2026-07-03)
**Decision:** The deal-sourcing data spine adopts a staging(raw_companies)→canonical(companies/contacts) two-tier schema with company- AND contact-level provenance tables, superseding the pre-implementation databases.md §companies_contacts/§data_source_connections sketch (reconciled as-built there). Contact-level provenance (`contact_provenance`) is PRESERVED (not deferred) to honor databases.md reusability principle 3 — feature #9 (the data-quality screen shipping this wave) is a named consumer.
**Why:** The two-tier + dual provenance is architecturally stronger (non-destructive re-ingest, non-lossy cross-source dedup, traceable lineage) and is the correct foundation M4 (mandates) / M5 (matching) read. Deferred (documented): sync_runs history, real provider SDKs, scheduled sync, contact enrichment, sourcing-workspace page — none needed for M3's first-bundle metric (a deduped, provenance-tracked company universe visible + cleanable in the screen). SoD/compliance unaffected (external-party data; provider secrets Railway-env only).

[2026-07-04] M3 (Deal sourcing & company/contact data): bundle authored — 2 tasks (sourcing-workspace page /sourcing to search connected sources + trigger ingestion [SEED], plus first real DataSourceAdapter behind the existing pluggable interface + ETL fan-out [SIBLING] — the vertical slice that makes the M3 "run a search across ≥2 connected sources" success metric verifiable end-to-end)
- caller: N-1-next-bundle (wave 6 → wave 7 handoff, automatic mode)
- decomposed by: milestone-decomposer sub-agent
- note: real-adapter sibling is gated on the deal-source vendor-selection spend decision + SDK-research (sdks.md §3 Risk 1 + external-sdk-integration-rules.md) which routes to BOARD/ceo-agent at P-3 before any adapter code; no vendor presumed here. Fixture adapter remains a valid source so the seed is demonstrable even if the real-adapter gate defers. Pre-existing M1-follow-up rows (d7f716b4, 6fe232e3, bfadcec1) left untouched — not part of this bundle.
