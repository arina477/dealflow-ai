# Wave 10 — V-2 Triage
Both V-1 reviewers APPROVE. 0 CRITICAL/blocking. 1 Medium (F-1) → fast-fix; 1 Low (route-label) → journey reconcile.
| # | source | sev | summary | bucket | disposition |
|---|---|---|---|---|---|
| F-1 | karen+jenny | Medium | score_breakdown drawer renders broken/blank NaN dimension rows (write/read shape drift) — named-AC gap (score-breakdown-per-buyer) | fast-fix (V-3) | reconcile the UI render (+ shared schema) with the scorer's ACTUAL score_breakdown output shape → per-dimension bars render |
| route | jenny | Low | journey-map:38 stale route /mandates/:id/matches | non-blocking | reconcile → /matches-shortlist (journey doc) |
| TopBar | T-6 | low | TopBar title recurring | non-blocking | polish carry-forward |
## Fast-fix queue (V-3): [F-1 score_breakdown render]. Frontend (+ shared schema) fix; needs redeploy + live re-verify (the drawer renders the per-dimension breakdown).
```yaml
findings_blocking: []
fast_fix_queue: [{fix: F-1-score_breakdown-render, owner: nextjs-developer}]
fast_fix_needs_redeploy: true
