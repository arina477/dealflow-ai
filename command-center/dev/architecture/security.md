# Security Architecture

Branch: Security · Project: DealFlow AI · Stack: NestJS + Next.js 15 + SuperTokens + PostgreSQL (Drizzle) on Railway · Authored v6 architecture.

## Summary

DealFlow AI is an internal/pilot AI platform for an M&A advisory firm: deal sourcing, AI buyer-seller matching, and compliance-first outreach in one workflow. Founder-stage is `pilot-customer`, which would normally cap security work at MVP scope (auth end-to-end, session management, secrets handling, input validation, basic RBAC) and defer the heavier artefacts (STRIDE threat model, residency matrix, consent architecture) to H2.

The founder issued an explicit **compliance-first override** (see `command-center/product/founder-stage.md` and the feature-list H1 promotion note). Three areas that would otherwise be H2 are **MVP-CORE** and are designed in full here:

1. **Tamper-evident, append-only audit log** with hash-chain integrity, covering every outreach communication and every compliance decision (FINRA/SOX-minded recordkeeping).
2. **Outreach compliance controls** — pre-send compliance gate, suppression/blocklist enforcement, required disclaimers, and an approval workflow.
3. **RBAC for 4 roles** (advisor / analyst / compliance / admin) with least-privilege and **separation of duties** — the person who sends an outreach is never the person who approves it.

Everything below is the MVP security contract. Deferred-to-H2 items are enumerated in `## Risk / open items` with their justification.

The security posture is defense-in-depth around two crown jewels: (a) **non-public deal and contact data** (a leak is a client-confidentiality and regulatory event for an M&A advisor), and (b) the **integrity of the compliance record** (the audit log is evidence — if it can be silently altered, the entire compliance wedge is worthless). The design treats the audit log as write-once evidence and the compliance gate as a non-bypassable choke point, not a UI nicety.

## Inventory

### Authentication — SuperTokens (self-hosted on Railway)

- **Deployment:** SuperTokens Core runs as a Railway service with its own PostgreSQL instance, reachable from the NestJS API over the Railway **private network** only (never public). The Core dashboard, if enabled, is behind admin auth and not exposed publicly.
- **Recipe:** EmailPassword + Session. **No open signup** — this is an internal tool. The public sign-up surface is disabled; the only way an account is created is via the invite flow.
- **Invite-only onboarding (F14):** An Admin creates a user from `/admin/users`. The backend creates the SuperTokens user in a provisioned-but-no-credential state and issues a single-use, time-boxed (e.g. 72h) **invite token** (cryptographically random, hashed at rest, single-use). The invitee lands on `/invite/:token`, sets a password, and the token is consumed. Role is assigned by the Admin at invite time and bound to the user via the RBAC mapping (see RBAC below). Invite tokens that expire or are already consumed return a generic failure (no token-state enumeration).
- **Login (`/login`):** EmailPassword sign-in. On success SuperTokens issues an access token (short-lived JWT) and a refresh token. Password policy: minimum length + breach/common-password rejection at the application layer; account-lockout / throttling on repeated failures (see Session + Rate limiting). MFA is **not** in MVP scope (see Risk).
- **Password reset (`/reset-password`):** SuperTokens reset-token flow — emailed single-use, time-boxed link; same generic-response posture to avoid account enumeration.
- **JWT + refresh:** Access tokens are short-lived (target ~1h) JWTs carrying the user id and role claim; refresh tokens are long-lived and rotated. SuperTokens **refresh-token rotation with reuse detection** is enabled — a replayed (already-rotated) refresh token revokes the whole session family. JWT signing keys are SuperTokens-managed; the API verifies via the SuperTokens session middleware, never by hand-rolling JWT verification.

### Session management

- Tokens are delivered as **`httpOnly`, `Secure`, `SameSite=Lax` cookies** (frontend-driven cookie mode), not in `localStorage` — this removes the token from JavaScript reach and shrinks XSS impact.
- **CSRF:** SuperTokens anti-CSRF protection is enabled for cookie-based sessions (anti-CSRF token + `SameSite`). All state-changing endpoints are POST/PUT/PATCH/DELETE and require a valid session + anti-CSRF token; no state change is reachable via GET.
- **Session lifecycle:** short access-token TTL with silent refresh; absolute session cap; sign-out and Admin-initiated **revoke** invalidate the session family server-side (SuperTokens `revokeSession`). Admin deactivating a user (F14) revokes all that user's sessions immediately.
- **Claim freshness:** the role lives in the session as a claim but is **re-verified server-side** on every authorization decision against the canonical role mapping — a token minted before a role change is never trusted for elevated access (role downgrade takes effect immediately; see RBAC).

### Secrets handling on Railway

- **Source of truth:** Railway service **environment variables** only. Nothing secret is ever committed (always-on rule 2). `.env.example` lists keys with placeholder values; real values live in Railway per service.
- **Scope of secrets:** DB connection strings (app DB + SuperTokens DB), SuperTokens API key, JWT/session secrets, email-send provider key + webhook signing secret, LLM provider key, deal-source/enrichment API keys, Railway Buckets (S3) credentials, and the **audit-log integrity HMAC key** (see Audit-log security).
- **Generation:** App-generated secrets are created with `openssl rand -base64 32` / `crypto.randomBytes` (always-on rule 6) and set via Railway. Account-issued credentials (LLM, email provider, data sources) are requested from the founder at deploy/integration time, not committed.
- **Private networking:** API ↔ SuperTokens Core ↔ Postgres ↔ Buckets traffic stays on Railway's private network; only the Next.js frontend and the NestJS public API are internet-exposed, both over TLS.
- **Egress secrets:** outbound calls to email/LLM/data-source providers carry keys from env only; keys never reach the frontend or appear in logs (see redaction in Conventions).
- **Rotation:** rotation is manual for MVP (Railway var update + redeploy) — documented, not automated (automated rotation deferred, see Risk).

### Input validation — Zod (shared contracts)

- **Single source of truth:** request/response contracts are Zod schemas in `@dealflow/shared`, bridged into NestJS DTOs via `@anatine/zod-nestjs`. The frontend imports the same schemas, so client and server validate against one definition.
- **Validate at the boundary:** every controller input (body, params, query) is parsed by a Zod schema before any business logic runs; parse failures return a structured 400 with field-level errors and **no internal detail**.
- **Strict parsing:** schemas use `.strict()` to reject unknown keys (mass-assignment defense), explicit coercion for query params, and tight types (enums for role/stage/status, bounded string lengths, format-validated emails/URLs).
- **Trust boundaries beyond the user:** inbound **email-event webhooks** (opens/clicks/replies/bounces) and **deal-source/enrichment API responses** are untrusted input and are Zod-validated + signature-verified (webhook HMAC) before persistence. LLM output used in outreach drafts is treated as untrusted text — it is never executed, and it is rendered with output encoding (no `dangerouslySetInnerHTML` of model output).
- **Stored-data safety:** Drizzle parameterized queries throughout (no string-concatenated SQL); React escapes by default on render (XSS defense pairs with the httpOnly-cookie session model above).

### RBAC model — 4 roles + separation of duties

Roles: **advisor**, **analyst**, **compliance**, **admin**. Each user has exactly one role for MVP (role-set is single-valued; multi-role/per-mandate grants are H2).

- **Where role lives:** a canonical `role` on the user record in the app DB (Drizzle), mirrored into the SuperTokens session claim. The DB record is authoritative; the claim is a cache re-verified per request (see Session).
- **Enforcement layer:** a NestJS **`RolesGuard`** + `@Roles(...)` decorator on every controller method, backed by the SuperTokens session guard. **Default-deny:** an endpoint with no explicit `@Roles` is treated as deny for non-admin and requires an explicit annotation to ship (lint/review gate). Authorization is enforced server-side; the frontend role-gating (hiding nav/buttons) is UX only and never the security boundary.
- **Least-privilege matrix (MVP):**
  - **analyst** — sourcing, dedupe/enrichment, buyer-universe build, companies/contacts data quality, draft templates. **Cannot** approve compliance, **cannot** send outreach, **cannot** see the audit-log export, **cannot** manage users.
  - **advisor** — mandates CRUD, review matches/shortlist, compose outreach, **send approved outreach**, pipeline. **Cannot** approve their own (or others') outreach for compliance, **cannot** edit compliance rules/suppression, **cannot** manage users.
  - **compliance** — review/approve/reject outreach in the queue, manage compliance rules / suppression / disclaimers, read the full audit log, run recordkeeping exports. **Cannot** send outreach, **cannot** create mandates or run sourcing (read context as needed for review, but not author the work being reviewed).
  - **admin** — user/role management, data-source & integration config, workspace/sending-identity settings. Admin is an operational role; admin **does not** implicitly inherit compliance-approval or send rights (no super-role shortcut around separation of duties — admin granting itself those rights is itself an audited action).
- **Separation of duties (the core SoD invariant):** for any outreach, **sender ≠ approver**. Enforced server-side in the send path: the send endpoint asserts (a) the outreach carries a compliance approval, (b) the approving user has role `compliance`, and (c) `approver_user_id != sender_user_id`. An advisor cannot approve their own send; a compliance reviewer cannot send. This is checked in code, not just in UI, and the assertion failure is itself audited.
- **Object-level authorization:** beyond role checks, queries are scoped so a user only reaches records they're entitled to (mandate/campaign ownership + role). No raw id from the client is trusted to fetch a record without an ownership/role predicate (IDOR defense).

### Audit-log security & integrity

The audit log is the compliance evidence store and is designed as **write-once, tamper-evident** infrastructure. Schema detail lives in the Databases branch (`databases.md`); the security contract is here.

- **Append-only:** application path is INSERT-only — no UPDATE/DELETE code path exists for audit rows. Defense-in-depth at the DB layer: the audit-log table's DB role has `INSERT`/`SELECT` only (no `UPDATE`/`DELETE`/`TRUNCATE` grant), and a `BEFORE UPDATE`/`BEFORE DELETE` trigger raises an exception. Corrections are made by appending a new compensating event, never by mutating history.
- **Hash-chain integrity:** each row stores `prev_hash` and `entry_hash`, where `entry_hash = HMAC-SHA256(key, canonical_serialization(row_fields) || prev_hash)`. The chain links every event to its predecessor, so altering or removing any past row breaks every subsequent hash. The HMAC key is a Railway secret (the "audit-log integrity HMAC key" above) — using HMAC (keyed) rather than a bare hash means an attacker with DB write access still cannot forge a valid continuation without the key.
- **Canonical serialization:** field set and ordering for the hash input are fixed and versioned (a `chain_version` column) so the chain is reproducible and verification is deterministic across deploys.
- **Coverage (non-negotiable for MVP):** an audit event is written for **every outreach communication** (compose → approve/reject → send → each tracked email event: delivered/open/click/reply/bounce) and **every compliance decision** (approval, rejection, rule change, suppression-list change, disclaimer change, role/permission change, recordkeeping export). Each event records actor user id, role, timestamp (server clock), action, target object id, and a **content hash** of the communication payload (the message body is hashed; sensitive payload retention follows the DB branch's retention policy).
- **Integrity verification:** a background job (and an on-demand admin/compliance action) re-walks the chain and reports any break; a verification result is itself an audit event. Verification is the gate behind the recordkeeping export — an export package includes the chain segment + a verification attestation so the export is independently checkable.
- **Recordkeeping export (F11):** export is `compliance`-only, scoped by date range/mandate, and produces a verifiable package (events + hashes + verification attestation) for FINRA/SOX-minded recordkeeping. Export action is audited.
- **Write path is non-bypassable:** audit writes happen in the same transaction as the action they record (or via an outbox guaranteeing eventual write) so an action and its audit entry succeed or fail together — there is no "do the thing, forget to log it" path.

### Outreach compliance controls

The compliance gate is a **server-side choke point** on the send path — not reachable around. Engine logic lives in the Modules branch (compliance-rules engine + outreach engine); the security-relevant enforcement contract is here.

- **Pre-send compliance gate (F3/F10):** no outreach is sendable until it passes the gate. The send endpoint re-runs the gate server-side at send time (not just at compose time) so a record that drifted out of compliance (e.g. a recipient added to suppression after approval) is re-blocked. Gate result (pass/fail + reasons) is audited.
- **Suppression / blocklist enforcement (F12):** every recipient is checked against the suppression/blocklist at send time; a match hard-blocks the send (and is audited). The list is `compliance`-managed; advisors/analysts can read enough to understand a block but cannot edit the list.
- **Required disclaimers:** templates carry required compliance blocks (per the rules engine, jurisdiction-aware); the gate verifies the rendered message contains the required disclaimer text before allowing send. Stripping a disclaimer fails the gate.
- **Approval workflow (SoD-bound):** a send requires a `compliance`-role approval recorded against the specific outreach version, with `approver != sender` (see RBAC SoD). Approvals are version-bound — editing the message after approval invalidates the approval and forces re-review (the gate compares a content hash of the approved version against the version being sent).
- **Every step audited:** compose, submit-for-review, approve, reject, gate pass/fail, suppression hit, and send each produce an audit event (see Audit-log coverage).

## Conventions

- **Default-deny authorization.** Every endpoint declares `@Roles(...)`; un-annotated endpoints are denied and fail review. The frontend never carries the authorization decision.
- **Validate at the trust boundary, once, with the shared schema.** All external input (user, webhook, third-party API, LLM output) is Zod-parsed before use; `.strict()` everywhere; no unknown-key passthrough.
- **Server re-checks at the point of action.** Role claims, compliance gate, suppression, and approval are re-verified at the moment of the privileged action (send/approve/export), not only at the earlier UI step.
- **Secrets only in Railway env.** No secret in code, config files, logs, error messages, or the frontend bundle. App-generated secrets via `openssl`/`crypto.randomBytes`.
- **Log redaction.** Application logs never contain tokens, passwords, full message bodies, PII beyond what's needed, or secret values. Errors returned to clients are generic; detail stays server-side.
- **Parameterized data access only.** Drizzle queries — no string-built SQL. Object-level predicates (ownership/role) on every fetch by client-supplied id.
- **Audit is INSERT-only, in-transaction.** No UPDATE/DELETE path to audit rows; the audit write shares the transaction (or outbox) with the audited action.
- **TLS everywhere; private network for internal hops.** Only the Next.js app and public API are internet-facing; Core/DB/Buckets stay private.
- **Identity in founder/customer-facing copy.** Any shipped UI security text follows the CODE-OF-CONDUCT identity rules (always-on rule 18) — the engine never presents as "Claude".

## Reusability principles

- **One `RolesGuard` + `@Roles` decorator** is the single authorization primitive across all modules — modules never invent their own role checks. SoD assertions are a small reusable helper (`assertSenderIsNotApprover`) called from the send path.
- **One audit-write service** (`AuditService.append(event)`) is the only way to write an audit event — it owns canonical serialization, hash-chaining, and transactional/outbox semantics. No module writes the audit table directly. This guarantees coverage and integrity invariants can't be partially implemented per-feature.
- **One compliance-gate service** is the only send-eligibility authority; the outreach engine calls it, never re-implements rule checks. Adding a rule type extends the engine, not each caller.
- **Shared Zod schemas** in `@dealflow/shared` are the reused validation layer for both ends — new endpoints reuse/extend existing schema primitives (bounded string, role enum, id formats) rather than redefining.
- **SuperTokens session middleware** is the reused auth primitive — no module hand-verifies JWTs or manages cookies itself.
- **Webhook-verification helper** (HMAC signature check + Zod parse) is reused by every inbound webhook (email events now; CRM/other in H2).

## Cross-references

- **Databases branch (`databases.md`)** — owns the **audit-log table** physical schema (columns: id, prev_hash, entry_hash, chain_version, actor_user_id, actor_role, action, target_type, target_id, content_hash, payload retention, created_at), the INSERT-only DB grants + anti-mutation triggers, suppression/blocklist tables, approval records, and retention policy. This branch specifies the integrity/hash-chain + grant requirements those tables must satisfy.
- **Modules branch** — owns the **compliance-rules engine** (rule types, jurisdiction-aware disclaimers, suppression matching) and the **outreach engine pre-send gate** wiring. This branch specifies that the gate is a non-bypassable server-side choke point re-run at send time, and the SoD/approval-version invariants it must enforce.
- **SDK/Services branch** — owns email-send provider + DKIM/SPF/DMARC sending identity, LLM provider, and data-source providers. This branch specifies that all such egress keys are Railway-env-only, all inbound webhooks are signature-verified + Zod-parsed, and LLM output is untrusted.
- **`stack-decisions.md`** — SuperTokens (self-hosted, JWT+refresh, Railway private net), NestJS, Drizzle/Postgres, Zod shared contracts, Railway env-only secrets, Railway Buckets.

## Stack-specific decisions

- **SuperTokens self-hosted on Railway** (Core + dedicated Postgres, private network) rather than a managed IdP — keeps deal/contact data and the auth store inside the founder's own Railway account (bring-your-own hosting), aligning with the confidentiality posture of an M&A advisor.
- **Invite-only via SuperTokens user pre-provisioning + app-issued invite tokens** — public sign-up disabled; account creation is an audited admin action.
- **Cookie-based sessions (httpOnly/Secure/SameSite) + SuperTokens anti-CSRF + refresh rotation with reuse detection** — chosen over header/`localStorage` tokens to minimize XSS token theft for an internal tool handling confidential data.
- **Zod-in-`@dealflow/shared` + `@anatine/zod-nestjs`** — one schema validates both ends; `.strict()` as the mass-assignment default.
- **HMAC-SHA256 hash-chain with a Railway-secret key** for audit integrity — keyed (not bare hash) so DB-write access alone can't forge chain continuation; chain stored in Postgres (baseline-fit per stack-decisions) with INSERT-only grants + anti-mutation triggers as DB-layer defense-in-depth.
- **NestJS `RolesGuard` + `@Roles` default-deny** as the single authorization primitive; SoD (`sender ≠ approver`, approver must be `compliance`) enforced in the send path in code.
- **Manual secret rotation for MVP** (Railway var + redeploy) — automated rotation deferred (see Risk).

## Risk / open items

**Scope basis:** founder-stage is `pilot-customer` (`command-center/product/founder-stage.md`), whose default security scope is MVP-mode (auth, sessions, secrets, input validation, basic RBAC) with the heavier artefacts deferred to H2. The founder's explicit **compliance-first override** (founder-stage.md `custom_note` + the H1 promotion of features #10–#13 in `feature-list.md`) pulls the audit log, outreach compliance controls, and SoD-RBAC **into MVP-CORE** — they are fully designed above and are **not** deferred.

**Deferred to H2 (justified by founder-stage `pilot-customer`; NOT covered by the compliance-first override, which is scoped to recordkeeping + outreach compliance + SoD-RBAC):**

- **Full STRIDE threat model** — no formal per-component STRIDE decomposition for MVP. Justification: `pilot-customer` stage; single firm + one design partner; attack surface is an internal authed app behind invite-only auth. MVP relies on the concrete controls above rather than a formal model. Revisit before broadening beyond the design partner.
- **Cross-border data residency matrix** — no formal residency mapping of where each data class lives/transits. Justification: `pilot-customer`, single-region Railway deployment, one firm's data. Required before any multi-jurisdiction pilot or the H2 pilot-partner workspace.
- **Formal consent architecture** — outreach compliance is enforced via suppression/blocklist + disclaimers + approval (in scope), but a formal, jurisdiction-modeled consent/lawful-basis architecture (e.g. structured opt-in/opt-out state machine, per-jurisdiction lawful-basis tracking) is deferred. Justification: MVP serves the firm's existing regulated outreach process; suppression + disclaimers cover the immediate FINRA/SOX-minded need. Promote with H2 feature #25 (advanced recordkeeping & certification artifacts).
- **M2M / service-to-service least-privilege hardening** — internal service identities (API ↔ Core ↔ provider integrations) rely on private networking + per-service env secrets rather than scoped service tokens / mTLS between internal services. Justification: `pilot-customer`, all services in one Railway project on the private network. Harden before multi-tenant (H3) or external integration surfaces (H2 CRM sync).
- **MFA for human logins** — single-factor EmailPassword for MVP. Justification: small internal user set; low-friction pilot. Recommend enabling SuperTokens MFA (TOTP) early in H2 given the data sensitivity — flagged as the highest-priority deferred item.
- **Automated secret rotation** — manual Railway-var rotation for MVP. Automate alongside H2 hardening.

**Open items to confirm at deploy time:** email sending-identity (DKIM/SPF/DMARC) is owned by the SDK/Services branch but must be verified before any real outreach send; the audit-log retention period + payload-retention policy needs a compliance-owner sign-off (DB branch owns the column, the value is a product/compliance decision).
