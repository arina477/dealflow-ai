# Wave-18 B-1 — Shared Analytics Contracts

**Task:** a5ba8068
**Branch:** wave-18-advisor-insights

## Files authored

- `packages/shared/src/analytics.ts` — analytics Zod schemas + TypeScript types
- `packages/shared/src/rbac.ts` — NAV_INSIGHTS nav item + `/insights` + `/analytics` route entries + `ALL_NAV_ITEMS` registration
- `packages/shared/src/index.ts` — analytics exports added

## 4-family summary shape

`AnalyticsSummary` (top-level response) contains:

| Family | Type | Key fields |
|---|---|---|
| F1 | `MandateThroughput` | `totalDraft`, `totalActive`, `total` |
| F2 | `OutreachGateOutcomes` | `totalCompose`, `totalSendEligible`, `totalBlocked`, `total`, `gatePassRate`, `blockedRate` |
| F3 | `AdvisorProductivity` | `rows: AdvisorActivityRow[]`, `total` |
| F4 | `MatchDisposition` | `totalPending`, `totalAccepted`, `totalRejected`, `totalFlagged`, `total` |

## F2 naming contract (load-bearing — P-4 PHASE-2 KAREN CORRECTION)

Field names are `gatePassRate` and `blockedRate` — NOT `responseRate`. The `outreach.status` column is a compliance-gate lifecycle status (compose/send_eligible/blocked); no email send data exists (actual send deferred M6+). The field names reflect gate outcomes, not send/response outcomes.

Div-by-zero guard: `gatePassRate` and `blockedRate` are `number | null`, returning `null` when `total = 0`.

## RBAC map (/analytics roles)

```
/analytics → allowedRoles: ['advisor', 'admin']
/insights  → allowedRoles: ['advisor', 'admin']  (nav item: 'Insights', icon: 'bar-chart-2', group: 'workspace')
```

analyst and compliance excluded: advisory analytics (mandate throughput, deal pipeline) are advisor/admin-facing.

## Empty-state safety

Every field is `number` or `null` (never `undefined`). Empty workspace returns all-zero counts with `gatePassRate: null` and `blockedRate: null`.

## Deviations

None. Schema exactly matches the P-3 plan spec.
