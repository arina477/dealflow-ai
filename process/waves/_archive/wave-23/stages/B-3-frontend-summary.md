# Wave 23 — B-3-frontend-summary
/insights seller-intent section (per-mandate Intent score + direction heating/cooling/flat + 3-signal breakdown, sorted desc; notApplied→'—'; NO tieBreak surfaced [SI1 — visible text removed, comment-only]; empty/loading/error; RBAC-gated). Proxy /seller-intent added. Commits 525667f (+ the prior uncommitted B-3 work landed with it). Web 837 pass, typecheck clean.
```yaml
skipped: false
deviations: []
```
B-5 lint fix (task 6840c25d): removed unused `fmtAcceptRate` function (superseded by `fmtAcceptRateWithCaveat`); added `role="img"` to all three `directionChip` `<span>` elements so `aria-label` is valid per ARIA spec — lint exits 0, 837 tests green, typecheck clean.
