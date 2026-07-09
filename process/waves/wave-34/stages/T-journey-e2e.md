# Wave-34 — M6 Deal-Loop End-to-End PROOF (deployed app)

**Date:** 2026-07-09
**Targets:** Web `https://dealflow-web-production-a4f7.up.railway.app` · API `https://dealflow-api-production-66d4.up.railway.app`
**Login used:** arina@claudomat.dev (role=`admin`, Default Workspace `a1b2c3d4-…-001`) — the ONLY credential available.
**Method:** proof-traced. Every claim below is backed by a live API response, a browser screenshot, or a hash-chain artifact captured today. Nothing is inferred from green tests.

---

## HEADLINE VERDICT

**The full deal loop does NOT work end-to-end on the deployed app.** Two independent blockers:

1. **The web frontend is dead for every logged-in user.** Every authenticated page returns **HTTP 500 (server-side render crash)** — `/`, `/mandates`, `/matches`, `/pipeline`, `/outreach`, `/compliance/audit-log`. The login page renders and login succeeds; the moment a session exists, every route 500s. No human can drive ANY of the 6 steps through the UI right now. This is a systematic SSR regression on the deployed build, independent of the API (the API is healthy).

2. **The single available login (admin) is locked out of the two core M6 steps by design.** Outreach compose is advisor-only; approval is compliance-only; pipeline transitions are advisor-only. Admin gets a real `403` on all three. There is **no working way to provision an advisor/compliance session** on the deployed app (the token-returning invite endpoint `POST /auth/invite` returns `500`; the working `POST /admin/users/invite` deliberately never returns the token; there is no email delivery). So the compliance-gate + separation-of-duties send path — the M6 binding metric — **could not be exercised end-to-end against the deployed app with the access provided.**

The compliance/recordkeeping backbone (audit log, hash-chain verify, export, gate code) is real and verifiable. The deal-loop *plumbing* (mandate → buyer universe) works via API. But the loop cannot be completed by a user, and its M6 climax (approved compliant send by two separated roles) is unproven on deployment.

---

## STEP-BY-STEP

### 1. Sourcing — companies present  → **PASS (data) / BLOCKED (admin UI + admin API read)**
- **Evidence:** `GET /sourcing/connections` (admin-visible) lists **29 connections, 89 companies total**, including a real **`TWENTY | Twenty (self-hosted) | companies=9 | enabled=true | created 2026-07-09`** connection.
- Live re-sync of that connection: `POST /sourcing/connections/46e8889a…/sync` → `{"ingested":0,"updated":9}` — 9 Twenty CRM companies present and re-synced today. Twenty-CRM sourcing sync is real and working.
- **Role-fragmentation finding (confirmed, as prompt predicted):** `GET /sourcing/companies` → `403 Forbidden` for admin (analyst-only per RBAC matrix `/sourcing/companies → ['analyst']`). Admin cannot read the company list itself; the data existence is confirmed only via the admin-visible connection company-counts + the sync result, not the company rows.
- **UI:** `/sourcing` returns SSR 500 (see blocker 1).

### 2. Mandate + buyer universe (M4)  → **PASS (API) / BLOCKED (UI)**
- **Mandate created live:** `POST /mandates` → `201`, id `76bf51af-eff7-4e0f-ba53-b5dda4e704cf`, `dealType:"sell-side"`, `status:"draft"`, `createdBy` = arina. Required compliance acknowledgments (lawful_authorization / ai_results_validated / conflict_dbs_reviewed) enforced at schema level and satisfied.
- **Buyer universe created live:** `POST /buyer-universe {mandateId}` → `201`, id `2f0ab710-a0f5-42d9-860f-845c0ef5c3e3`, bound to the mandate.
- **UI:** `/mandates` returns SSR 500. The capability exists at the API; a user cannot reach it.

### 3. AI matching (M5) — ranked scores + rationale + accept/reject  → **GAP (not exercised end-to-end)**
- `GET /matches` → `200 {"runs":[]}` (endpoint live, no runs yet).
- Match-run creation is gated + requires a populated/enriched buyer universe + run inputs (`POST /matches {}` → `400 "Required"`). I created the mandate and empty buyer universe but did not populate candidates (buyer-universe filter/enrich is a multi-step analyst flow) or produce a ranked run, so **I have NOT observed integer fit-scores (0–100), per-buyer rationale, or an accept/reject shortlist on the deployed app.** The controllers and score-breakdown schemas exist in code, but no live ranked output was produced or seen. Honest status: unproven on deployment this run.
- **UI:** `/matches` returns SSR 500.

### 4. Compliant outreach (M6 core) — pre-send gate + sender≠approver SoD → **BLOCKED (cannot exercise) — strongest gap**
- **Gate is a real, non-bypassable, enforced contract in code (verified by reading deployed source):**
  - `ComplianceGateService.evaluate(ctx, tx)` runs **all four evaluators unconditionally** (suppression, SoD, disclaimer, content-hash) with no skip/dryRun param; writes the verdict to the audit log **in the same tx before returning** (no verdict without its audit row).
  - `OutreachService.composeAsActor` ALWAYS calls the gate; `status='send_eligible'` is only set on `allowed:true`, else `'blocked'`. There is no controller path that sets send-eligibility directly.
  - **SoD evaluator** blocks unless a `compliance_approvals` row exists that is `approved` AND `approver_user_id ≠ sender` AND `approver_role === 'compliance'` EXACTLY (admin explicitly excluded — no super-role shortcut), with fail-closed handling of revoked/null-approver rows.
- **Why it could not be proven on the deployed app:**
  - Compose is advisor-only: `POST /outreach` as admin → `403 Forbidden` (real RBAC after the anti-CSRF header was supplied — see note below).
  - Approval is compliance-only: `/outreach-templates/:id/versions/:vid/approve → ['compliance']`.
  - **No advisor or compliance session obtainable:** `POST /auth/invite` (the only endpoint that returns a usable invite token) → **`500 Internal server error`** on the deployed app; `POST /admin/users/invite` works (`201`, returns `inviteId` only, **token discarded**); no email delivery exists (hard product boundary). So signup-with-known-password for those roles is unreachable.
- **Non-bypassability observation (positive):** there is NO `sent` state in the deployed `outreach_status` enum — it is `['compose','send_eligible','blocked']`. Compose produces a *send-eligible record*, not an actual dispatch; the code comments confirm the live send endpoint is an M6 dependency. So "send (tracked)" as a real dispatch does not exist as a reachable enum state — outreach-activity (advisor/admin) is the tracking surface, and it is empty (`{"activities":[]}`).
- **Net:** the gate + SoD logic is present and rigorous in the deployed code, but the end-to-end "advisor composes → compliance approves (different user) → send tracked" flow was **not executed against the live app** because the roles can't be logged in and the UI is down. Unproven, not disproven.

### 5. Audit + recordkeeping — immutable tamper-evident log + verifiable export  → **PASS (API)**
- `GET /compliance/audit-log/verify` → **`{"ok":true,"entriesChecked":332}`** — the full hash chain verifies clean on the deployed DB.
- `GET /compliance/audit-log` returns real rows with `prevHash`/`entryHash`/`chainVersion`/`sequenceNumber` (e.g. seq 328 = `mandate-create` for the earlier mandate, seq 329 = `sourcing-connection-create`) — genuine append-only hash-linked entries, workspace-scoped.
- `POST /compliance/audit-log/export` → `200`, a real recordkeeping package: manifest with `chainRoot`, `tailHash`, `entryCount:332`, `truncated:false`, `rowsReturned:332`, plus a full CSV of every entry with all hash-chain columns. This is a verifiable, exportable recordkeeping package.
- Admin CAN read/verify/export the audit log (RBAC `/compliance/audit-log → ['compliance','admin','advisor']`). This step is genuinely working on deployment.
- Note: `/compliance/records/deal-activity` → `200 {"rows":[],total:0}` (no deal activity recorded yet, consistent with no live send having occurred).

### 6. Pipeline — reply/open advances buyer through stages  → **BLOCKED (admin) / not exercised**
- Pipeline read + write are gated away from admin: `GET /pipeline` → `403`, `POST /pipeline` → `403` (RBAC `/pipeline → ['advisor','compliance']`, stage-transition `['advisor']`). Admin cannot view or advance the pipeline at all.
- No pipeline entries exist to advance (loop never reached a live send). Stage-advance-on-reply/open was not observed. **UI `/pipeline` returns SSR 500.**

---

## CROSS-CUTTING FINDINGS

- **F1 (Critical) — Web SSR is down for all authenticated pages.** 100% of authenticated routes return HTTP 500 with a Next.js `__next_error__` shell (browser digests e.g. `2577716916`, `1684222324`); unauthenticated routes correctly `307`→`/login`; the login page renders and login works. The crash is in the authenticated server-component render path, uniform across pages while the API is healthy — points to an RSC data-fetch / server-side config (env / cookie-forwarding) failure at render. **This alone makes the whole loop undrivable by a user.** Tight remaining-slice: fix the authenticated-page SSR crash (one root cause, all pages) and re-run this proof.
- **F2 (High) — No reachable role-provisioning on deployed app.** `POST /auth/invite` 500s; `/admin/users/invite` returns no token; no email path. Cannot create/log in as advisor/compliance/analyst → the entire multi-role deal loop (which is deliberately split across 4 roles) is unexerciseable with the provided admin login. Tight slice: fix `/auth/invite` 500 (or expose a test-account provisioning path) so the SoD send flow can be proven.
- **F3 (Medium, likely by-design) — mutating requests need the anti-CSRF custom header.** All non-GET requests without a custom header (e.g. `rid`) return `401` regardless of role; adding the header surfaces the true `403`/`201`. Correct SuperTokens `antiCsrf:'VIA_CUSTOM_HEADER'` posture, but worth confirming the web client always sends it.
- **F4 (informational) — role fragmentation is real and intentional.** admin cannot: read sourcing companies, compose outreach, approve, view/transition pipeline. This is the designed SoD/RBAC model, but it means "log in as admin and drive the loop" is structurally impossible — a proof needs advisor + compliance + analyst sessions.

---

## WHAT IS PROVEN vs UNPROVEN (summary table)

| Step | Verdict | Evidence |
|---|---|---|
| 1 Sourcing (Twenty companies present) | PASS (data) / BLOCKED (admin read + UI) | Twenty connection, 9 companies, live sync `{updated:9}`; `/sourcing/companies` 403; UI 500 |
| 2 Mandate + buyer universe (M4) | PASS (API) / BLOCKED (UI) | mandate `76bf51af…` 201, buyer-universe `2f0ab710…` 201; UI 500 |
| 3 AI matching (M5) ranked+rationale+shortlist | GAP (not exercised) | `/matches` 200 empty; no ranked run produced/seen; UI 500 |
| 4 Compliant outreach + pre-send gate + SoD | BLOCKED (cannot exercise) | gate/SoD rigorous in code; compose 403 admin; no advisor/compliance session obtainable; no `sent` state |
| 5 Audit + recordkeeping export | PASS (API) | verify `{ok:true,332}`; hash-chained rows; export package w/ chainRoot+tailHash+332 rows |
| 6 Pipeline advance on reply/open | BLOCKED / not exercised | `/pipeline` 403 admin; no entries; UI 500 |

**Overall: NOT shipped.** The compliance recordkeeping spine is genuinely live and verifiable, and the mandate→buyer-universe plumbing works via API — but the loop cannot be completed by any user (web SSR down) and the M6 binding climax (advisor-composed, compliance-approved, tracked compliant send with sender≠approver) was not exercisable on the deployed app. Two focused fixes — (a) the authenticated-page SSR 500, (b) a working advisor/compliance provisioning path — are the tight remaining slice needed to make this loop provable, not a milestone reopen.
