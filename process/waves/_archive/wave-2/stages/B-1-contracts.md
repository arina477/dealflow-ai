# Wave 2 — B-1 Contracts

Shared auth contracts authored in `@dealflow/shared` (typescript-pro) — the single source of truth both apps/api (B-2) and apps/web (B-3) consume.

- **File:** `packages/shared/src/auth.ts` (+ barrel export from `index.ts`), matching wave-1's HealthResponse export/dist-consumption pattern.
- **Exports:** `roleEnum`/`Role` (advisor|analyst|compliance|admin); `signupRequest/Response`, `loginRequest/Response`, `meResponse`, `resetRequest`, `resetConfirm`, `inviteCreateRequest/Response` — Zod schemas + inferred types.
- **Design:** all request objects `.strict()` (reject unknown keys); shared `passwordSchema` (min 8) feeds signup + reset-confirm; `resetRequest` carries only `{email}` with a fixed 202 ack → **no-user-enumeration enforced at the contract layer**; pure Zod+TS (no NestJS/Next/SuperTokens imports).
- **Isolation typecheck:** `pnpm --filter @dealflow/shared typecheck` clean. Consumer breakage in api/web expected (written B-2/B-3, validated repo-wide at B-4).
- **Commit:** `49e290a`.
- **Deviations:** added `login*` pair (not explicitly in P-3's B-2 table but required by the login page; prevents B-3/B-4 inventing it) — sensible, self-contained. Password min pinned to 8 (P-3 said "min(N)"; 8 = security.md baseline).

```yaml
skipped: false
contracts_authored: [packages/shared/src/auth.ts, packages/shared/src/index.ts]
sdk_regenerated: false
fast_path_approved: false
deviations: ["added login request/response pair (required by login page; not in P-3 B-2 table)", "password min pinned to 8"]
commit: 49e290a
```
