# Wave 7 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-5 | test-bug | e2e/sourcing-workspace.spec | S2 connection-create 409 (dup displayName collision, misdiagnosed as session — 409≠401 proves auth worked); create LIVE-verified 201 at C-2 | test-maintenance (unique name) |
| 2 | T-6 | low | TopBar title | Dashboard on /sourcing (recurring x-invoke-path, now 5 screens) → polish task | non-blocking |
**Totals:** 0 critical. Workspace + connection-create + ≥2-source + dup-409 + providerKey-400 LIVE-proven (C-2, 3 fix-cycles); real-browser 4/5 (S2 test-data). B-6 (badges+providerKey) + C-2 (journal+DrizzleError) all fixed.
