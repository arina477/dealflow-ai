# Wave 10 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| W10-1 | T-5 | test-setup | e2e sourcing seed | advisor 401/403 on POST /sourcing/connections = correct RBAC (sourcing analyst/admin-only; advisor≠sourcing role); E2E should seed M3 with analyst; matching flow C-2-verified end-to-end | test-maintenance (no B route) |
| S2 | T-5/T-6 | PASS | AI-framing | NO AI-framing CONFIRMED LIVE (9 forbidden phrases absent) — karen MANDATORY / CODE-OF-CONDUCT met | — |
| TopBar | T-6 | low | TopBar title | Dashboard on /matches-shortlist (recurring, 8+ screens) → polish | non-blocking carry-forward |
**Totals:** 0 critical, 0 real product bugs. Matching create-run+scorer-discriminates+disposition-preserve+handoff-guard+NO-AI-framing+no-LLM+RBAC LIVE-proven (C-2 first-try). B-6 2 CRIT fixed pre-deploy.
