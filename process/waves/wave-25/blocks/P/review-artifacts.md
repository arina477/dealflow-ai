# Wave 25 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M10 AUTH-HARDENING — (1) rate-limiting on /auth/* (per-IP + per-account, before external users), (2) missing-inviteToken 500→clean-400 (shared-Zod validation), (3) logout anti-CSRF under cookie token-transfer mode. | **Block exit gate:** P-4 (SECURITY-SCOPE-TIGHTENED — touches auth/CSRF/rate-limits).
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [6fe232e3] (single-task auth-hardening; wave-26 tripwire: if only debt/hardening candidates remain AND M10 recordkeeping-decomposition still unfired → BOARD-escalate + refuse a 3rd hardening seed)
- **SECURITY-SCOPE-TIGHTENED (head-next + trigger table):** touches auth/CSRF/rate-limits → the P-4 security-scope-tightened gate (a security-auditor Phase-2 pass) + the T-8 Security stage APPLY. 
- **Seed items:** (1) MEDIUM rate-limit /auth/signin+signup+reset/request (per-IP + per-account; mitigated now by invite-only + 0 pilot users but a real brute-force gap before external users); (2) LOW missing-inviteToken→500 should be a clean 400 via shared-Zod; (3) LOW logout anti-CSRF (cookie token-transfer mode — the session-verifying POST /auth/logout expects the right anti-csrf/token handling).
- **LOAD-BEARING:** rate-limiter actually ENFORCES (returns 429; works correctly — beware in-memory-per-instance that doesn't hold across replicas; fail-closed or fail-open decision documented); the 500→400 is a clean Zod-validated error (no account created — already safe); logout anti-CSRF hardened (rid:anti-csrf per the SuperTokens model); NO regression to the invite-only signup / session model; audit-logged where appropriate.
- **design_gap_flag:** likely false (backend auth-hardening, no UI). D-skip likely.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>
