# Wave 2 — B-2 Backend (auth module)

Implemented by security-engineer (single owner — cohesive, security-critical module). Branch wave-2-auth-backbone. Commit `f24a56d`.

## Files (apps/api/src/)
modules/auth/{supertokens.config.ts, supertokens.env.ts, auth.repository.ts, auth.service.ts, auth.controller.ts, dto.ts, auth.module.ts, guards/session.guard.ts, guards/roles.guard.ts}; db/db.provider.ts; wiring in main.ts + app.module.ts; tests auth.service.spec.ts (9) + supertokens.env.spec.ts (7); config .env.example (+WEB_ORIGIN), package.json (+@types/express dev), biome.json (+unsafeParameterDecoratorsEnabled).

## Six security invariants — enforced (cited)
1. **Invite-only** — `signup` calls `getInviteEmail(tokenHash)` first; null → 4xx BEFORE `EmailPassword.signUp` (test asserts signUp never called; no Core/app user created).
2. **No user-enumeration** — `requestReset` returns void for any email; controller always 202; login/signup failures generic; address never logged.
3. **SuperTokens Postgres ≠ app DB** — `assertNoDatabaseAlias` throws at boot (main.ts pre-create + AuthModule.onModuleInit) if SUPERTOKENS_DATABASE_URL aliases DATABASE_URL/TEST_DATABASE_URL (3 tests).
4. **Role claim in session** — `createNewSession` override resolves role via app-DB and writes accessTokenPayload.role (mint + refresh).
5. **No secrets logged** — invite token returned once; only SHA-256 hash persisted; logs carry only opaque ids.
6. **Concurrent invite consumption** — `consumeInviteAndCreateUser` uses `SELECT … FOR UPDATE` in a txn; exactly one winner; loser compensates (deletes orphaned Core user) → 4xx (test).

## Guard primitive
RolesGuard + @Roles() built + DI-registered, applied to NO route (grep-verified) — problem-framer guardrail honored. SessionGuard (authentication, not RBAC) on /me + /logout only (in-spec 401 anon).

## Verify
`pnpm -r typecheck` passes; `pnpm --filter @dealflow/api test` → 20 passed, 1 skipped (health e2e needs TEST_DATABASE_URL); Biome clean. Full runtime auth against real SuperTokens Core runs at C-2/T (Core provisioned at C-2).

```yaml
skipped: false
fast_path_active: false
specialists_spawned: [security-engineer]
files_implemented: [apps/api/src/modules/auth/*, apps/api/src/db/db.provider.ts, apps/api/src/main.ts, apps/api/src/app.module.ts]
deviations:
  - {specialist: security-engineer, change: "+@types/express devDep", plan_said: "not listed", why: "type express req/res in guards", adjudication: accepted (standard default)}
  - {specialist: security-engineer, change: "biome unsafeParameterDecoratorsEnabled", plan_said: "n/a", why: "first NestJS param-decorator controller", adjudication: accepted}
  - {specialist: security-engineer, change: "db/db.provider.ts DI wrapper", plan_said: "not enumerated", why: "constructor-injectable + testable; no 2nd pool", adjudication: accepted}
  - {specialist: security-engineer, change: ".env.example WEB_ORIGIN", plan_said: "devops at B-5", why: "boot schema needs it", adjudication: accepted (B-5 reconciles private-net)}
  - {specialist: security-engineer, change: "isInviteValid folded into getInviteEmail", plan_said: "separate", why: "/simplify — one fewer query, same semantics", adjudication: accepted}
  - {specialist: security-engineer, change: "env schema in supertokens.env.ts", plan_said: "main.ts OR shared/env", why: "co-located + unit-testable", adjudication: accepted (plan allowed either)}
simplify_applied: true
commit: f24a56d
```
