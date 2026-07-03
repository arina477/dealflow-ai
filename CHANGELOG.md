# Changelog

All notable changes to DealFlow AI are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

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
