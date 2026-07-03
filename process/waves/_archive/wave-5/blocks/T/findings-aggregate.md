# Wave 5 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-5 | fixed | antiCsrf VIA_TOKEN | authed CRUD POST 401 in-browser (missing anti-csrf token) → VIA_CUSTOM_HEADER + rid header (13e55ef); LIVE 201 | fixed |
| 2 | T-6 | low | TopBar title | shows Dashboard on settings/audit-log routes → folded into AppShell-polish task | non-blocking |
| 3 | T-8 | low | disclaimer substring | plaintext-v1 match (HTML rendered-text enforcement M6) | non-blocking |
**Totals:** 0 critical remaining. Compliance-gate SoD + non-bypass + config-audit LIVE (C-2); settings CRUD real-browser 201 (CSRF+FK fixes proven); 2 low non-blocking; 1 real-browser CSRF bug fixed.
