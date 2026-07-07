# Wave 25 — T-9 Journey (gate)
**Gate:** APPROVED (head-tester, T-8 Security + T-9). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta: NONE new (backend-only; no route added/removed). Behavior changes: /auth/* now 429 past limits; signup missing-inviteToken 500->400. Canonical journey map stays valid.
## Substance: SEC-1..11 GENUINELY tested (real-PG SEC-1-DB atomicity [a SELECT-then-UPDATE fails it] + SEC-4-DB email-keying + prod-429 smoke [fail-open path 429 = limiter genuinely fired]); no coverage-theater; no auth regression (983 unit green, 0 skipped in CI run 28876707093). T-8 thinness (non-blocking->V-2): F1 no forged-XFF integration probe, F2 logout-401 config-only, F3/F4 cosmetic.
