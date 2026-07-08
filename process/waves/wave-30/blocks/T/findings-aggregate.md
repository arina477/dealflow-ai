# Wave 30 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | P2 (accepted, PRE-LIVE-HOOKUP) | B-6 | adapter doesn't safeParse its OWN output vs normalizedSourceRecordSchema (fixture adapter does) — fold BEFORE the live hookup (C-2+key); L-2 candidate |
| 2 | P2 (accepted) | B-6 | backoff TIMING untested (retry covered) — vi.useFakeTimers follow-up |
| 3 | INFO→founder | live-hookup | the LIVE Affinity verification awaits the founder's AFFINITY_API_KEY (no-new-code: set the Railway env var → live paginated fetch activates). M9 _TBD metric (founder-reserved). |
## Substance: the Affinity adapter is LIVE @a6ad02c (registered, DORMANT until the key). SDK-doc-first + robust (paginate-all/429-backoff/retry/timeout/boundary-Zod, genuinely mock-tested) + secret-env-never-committed + graceful-no-key (app boots) — B-6 + /review 3-crown-jewels pass. The buildable core shipped; the live hookup is founder-key-gated.
findings_total: 3 (0 crit/high, 2 P2-accepted, 1 info)
