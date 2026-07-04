# Wave 6 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-6 | low | TopBar title | shows Dashboard on /sourcing/companies (recurring x-invoke-path, now 4 screens) → polish task d7f716b4 (bumped) | non-blocking |
**Totals:** 0 critical. Dedupe correctness (cross-source/no-false-positive/provenance/idempotent) LIVE-proven (C-2); companies screen real-browser 8/8; 1 low recurring (TopBar title). B-6 (4 dedupe CRIT + candidate-idempotency) + C-2 (import-type DI + fixture-asset) all fixed.
