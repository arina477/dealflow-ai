# Wave 38 — P-2 Spec (pointer)

> Source of truth: `tasks.description` for task `7f4d150b-409f-4936-a09f-12fe46d5b90c`.

## Spec contract

**Title:** FIX: prod migrations do not auto-apply on deploy (0021 + rate_limit_hits missing)

**Problem:** Migration 0021 (`create_firm_workspace`) did not auto-apply to prod despite
`MIGRATE_DATABASE_URL` set — applied manually in wave-37. `rate_limit_hits` (0019) also missing
(rate-limit degraded to in-process). The migrate mechanism in `main.ts` was not applying new
migrations → every future migration at risk. Root-cause the mechanism + fix so migrations apply
on deploy. Pilot-hardening priority.

**wave_type:** infra

## Acceptance criteria (derived from the spec)

1. Root cause of the non-applying migrations identified (not patched blind).
2. Migrations reliably apply on deploy going forward.
3. The two specifically-missing objects exist on prod: table `rate_limit_hits`, function
   `create_firm_workspace(text,text,text)`.
4. `RateLimitMiddleware` no longer logs `relation "rate_limit_hits" does not exist`.
5. dealflow-api deploys SUCCESS + boots healthy (no self-inflicted outage from the fix).
