# Wave 2 — V-2 Triage

Findings from T-block (2) + Karen V-1 (cosmetic) + jenny V-1 (1 low drift) + security-engineer follow-up. **No blocking findings** — both reviewers APPROVE; auth is live + spec-conformant; real-browser E2E 6/6.

## Classification
| # | source | sev | summary | bucket | disposition |
|---|---|---|---|---|---|
| 1 | T-8 | medium | no rate-limiting on /auth/* | non-blocking | → task 6fe232e3 (auth hardening) |
| 2 | jenny | low | signup missing inviteToken → 500 not 4xx | non-blocking | → task 6fe232e3 (input validation) |
| 3 | security-engineer | low | /auth/logout anti-CSRF under cookie transfer | non-blocking | → task 6fe232e3 (logout CSRF) |
| 4 | Karen | low | cosmetic path/naming nits (dto.ts, supertokens.env.ts) | **noise** | naming is fine + intentional (co-located module files); zero functional impact |
| 5 | T-1 | low | as-unknown-as AuthRepository test-fixture cast | **noise** | test fixture; already tracked (wave-1 task bfadcec1 test-fixture typing) |

## Non-blocking task INSERTed
- `6fe232e3-c639-4f6c-ad66-2889df8d9717` — Auth hardening: rate-limiting + input validation + logout anti-CSRF (milestone M1, wave 2 provenance). Bundles findings #1/#2/#3.

## Noise suppressed (2): #4, #5 — rationale in table.

## Fast-fix queue: EMPTY (no blocking findings). No B re-entry needed.

```yaml
findings_input_count: 5
findings_blocking: []
findings_non_blocking:
  - {id: 1+2+3, source: T-8/jenny/security-engineer, summary: "auth hardening (rate-limit + signup-validation + logout-CSRF)", task_id: 6fe232e3-c639-4f6c-ad66-2889df8d9717, milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882}
findings_noise:
  - {id: 4, source: karen, summary: "cosmetic path nits", rationale: "intentional co-located file naming; no functional impact"}
  - {id: 5, source: T-1, summary: "test-fixture cast", rationale: "test fixture; already tracked wave-1 bfadcec1"}
fast_fix_queue: []
b_block_re_entry_required: []
```
