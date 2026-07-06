# V-1 — jenny (spec-contract semantic verification · wave-16 M7 admin-hardening)

**Verdict:** APPROVE
**Deployed under review:** LIVE @ `d72d7cb` (dealflow-api + dealflow-web, Railway, verified independently below).
**Spec authority:** seed task `904a3c25` `tasks.description` YAML head + P-4 SECURITY REWORK addendum (DB-reachable, read live). Cross-checked P-2-spec.md / P-3-plan.md / C-2-deploy-and-verify.md / T-9 journey.
**Method:** read deployed source (invite/reactivate service, mandate cascade, config schema, admin-activity controller) + independent live unauthed gating probes + C-2 authed live evidence (positive-control-backed). No authed session re-established this pass (invite→signup is heavy); C-2's authed 200/403/401 matrix carries a positive control (advisor `/mandates`=200 proves gating is role-based, not blanket-fail) so it is trustworthy — I corroborated the unauthed floor myself and read source for the semantics C-2's black-box couldn't reach.

## Independent live corroboration (this pass, not inherited)
- `GET /health` → `200 {status:ok, db:ok, version:d72d7cb…}` — deployed hash **exactly matches** the commit under review (not stale-mirage). ✓
- `GET /admin/activity-data` unauthed → **401**; `POST /admin/users/:id/reactivate` unauthed → **401**; `POST /admin/integrations` (secret-shaped) unauthed → **401**; web root → **307**. Fail-closed floor confirmed. ✓

---

## Block-by-block semantic match (spec INTENT, not just literal AC)

### 1. Cascade [904a3c25 mvp-critical] — MATCH
- **Spec §AC1-4 / edge-cases:** unset field inherits firm `workspace_settings` default; explicit wins; no retroactive mutation; resolve-once-at-create.
- **Deployed (`mandate.service.ts` L131-193):** `resolvedJurisdiction = input.compliance.jurisdiction ?? firmSettings?.defaultJurisdiction ?? null` — explicit-wins is a true short-circuit; `resolvedSuppressionScope` uses `!== undefined` (correctly lets an explicit `null` win over the firm default). Resolved values are **stamped into the compliance_profile row** at create time (L186-193), so a later firm-default change cannot mutate an existing mandate — the no-retroactive invariant is structural, not a promise. Firm settings read is tx-scoped (`findWorkspaceSettingsInTx`). C-2 §9 proved inherits-US live end-to-end (mandate omitting jurisdiction → US + derived disclaimer `fe1c504d`).
- **Semantic nuance (documented, NOT a defect):** spec AC1 names three inheritable fields (jurisdiction, disclaimer_template, suppression_scope); deployed cascades only jurisdiction + suppressionScope. `disclaimer_template_id` is **DERIVED** from the resolved jurisdiction (`findActiveDisclaimerByJurisdiction`, L154-162), never sourced from firm default or request body. This is the correct security posture (a user/firm can't inject an arbitrary disclaimer FK) and the docstring calls it out explicitly. Intent ("compliance defaults cascade") is honored; disclaimer is a *derived* consequence of the jurisdiction cascade, not an independently-inherited field. No drift.

### 2. Invite dedup [c54db02d + P-4 Finding 1] — MATCH (the key semantic holds)
- **Spec:** registered-active→409; live-pending→409/idempotent; EXPIRED/consumed→NEW allowed; concurrent-same-email→exactly-one via advisory lock (partial index REJECTED).
- **Deployed (`user-management.service.ts` L153-241):** `pg_advisory_xact_lock(hashtext(lower(email))::bigint)` is the FIRST statement (L164), then SELECT-active-user (409, L173) → SELECT-**live** invite `consumed_at IS NULL AND expiry > now()` (409, L190) → INSERT. **The expired→reinvite semantic is genuinely preserved:** the liveness check filters on `gt(expiry, now())`, so an expired/consumed prior invite fails the "live" predicate and a new invite is INSERTed — a partial unique index (which the P-4 rework rejected) would have blocked exactly this. There is NO email index; the advisory lock is the sole race guard. T-4 INVITE-CONC-1 is a real-service fault-killing concurrency test (VERIFY rule 3), not hollow. Intent matched.

### 3. Reactivate [042cf4e6] — MATCH; consistent with wave-15 deactivate/last-admin design
- **Spec:** deactivated_at→null; admin-only; audited (`user-reactivate` additive enum); already-active→400; non-UUID→400; advisor 403/anon 401.
- **Deployed (`user-management.service.ts` L404-450):** sets `deactivated_at = null`, **preserves role_id** (L435 comment + no role write), already-active→`BadRequestException` 400 (L427), unknown→404, audit `user-reactivate` LAST-IN-TXN (L436-446). **No last-admin-guard conflict** — correct by construction: reactivate can only *raise* the active-admin count, so it never trips the zero-admin guard (the guard runs only on deactivate/demote paths, L285/L358). Consistent with the wave-15 deactivate mirror. C-2 §7 proved live: advisor1 restored (deactivated_at→null), non-UUID→400 (not 500 — the /review fix held), advisor 403, re-call 400 already-active. Audit action is additive (appended at end of the CLOSED shared enum — wave-15 Inv-6 lesson honored); C-2 §11 shows HMAC chain still verifies (`ok:true`, 324→328) after `user-reactivate` shipped.

### 4. Config-boundary [2560fecc + P-4 Finding 2] — MATCH (encrypted-at-rest intent + no-echo)
- **Spec:** secret-shaped config→400 uniform (no echo); legit persists; existing connections unbroken; config never logged.
- **Deployed:** `dataSourceConnectionConfigSchema` (`packages/shared/src/data-source-admin.ts` L95-119) is `.strict()` with ONLY constrained non-secret fields (`fieldMapping` bounded strings, `syncBatchSize` int 1-10000, `regionSlug` format-regex) — **no free-text slot** per P-4 Finding 2. `.strict()` means any unknown/secret-shaped key → parse failure → `validateConfigOrThrow` throws a **uniform static** `CONFIG_VALIDATION_ERROR` (`data-source-admin.service.ts` L99-126) with NO value echo, run BEFORE the DB tx (L179-181, L262-264). C-2 §10 proved live: secret+unknown field → 400 uniform static, canary secret ABSENT from body; legit `config:{}` → 201. Matches encrypted-at-rest / config-non-secret contract.

### 5. Admin-activity [8bb0a22f + P-4 Finding 3] — MATCH; clean persona split from wave-13 audit-log
- **Spec (P-4 real controls):** admin-only (advisor 403/anon 401); read-only-immutable (opening appends 0 audit rows); metadata carries no secret/PII (actor/target/action/timestamp only).
- **Deployed (`admin-activity.controller.ts`):** GET-only, `SessionGuard`+`RolesGuard` fail-closed (throws on boot if route resolves to `[]`, L42-47), query Zod-validated with no echo (L79-81), service-layer row projection (controller never passes raw audit fields). C-2 §6 proved live: admin 200 (14 rows, keys EXACTLY `{action,actor,sequenceNumber,target,timestamp}`), grep for hash/credential/payload/secret → NONE, advisor 403/anon 401, **read-only proven** (audit `entriesChecked` 324 before AND after the GET). **Clean persona split:** this is a filtered read over the *same* immutable audit log the wave-13 `/compliance/audit-log` reads, but scoped to the 7 admin actions for an admin operational lens (not the compliance/recordkeeping export lens) — reuses the audit.repository reader (no forked second reader per spec). Not redundant.

### 6. Nav [6f1a96da] — MATCH
- **Spec:** admin nav server-gated; /admin/integrations un-orphaned; advisor doesn't see admin section.
- **Deployed:** C-2 §5 behavioral server-gate (authoritative): all 4 `/admin/*` routes admin→200 / advisor→307; `/admin/integrations` admin→200 (un-orphaned), advisor→307; positive control advisor `/mandates`→200 (proves 307 is role-gating, not auth-fail). Sidebar renders `navItemsForRole(me.role)`; all 4 routes `allowedRoles:['admin']` in shared `rbac.ts` (server-rendered gate, not CSS hide). Matched.

### 7. Deferral honesty — CONSISTENT
- sending-domain DKIM/SPF/DMARC (#141) stays deferred (out-of-wave, founder digest) — spec head + P-3 Action 4 both state this explicitly; nothing in the deployed diff touches email-send. M7 milestone `08d3053a` is **`in_progress`** (NOT falsely closed); all 6 tasks are **`in_progress`** (not marked complete). Honest — the wave shipped its scope without over-claiming milestone closure.

---

## Spec-gap detection (spec didn't anticipate — surface for next wave P-2, NOT drift, NOT blocking)

**G-1 (gap · Low) — hashtext advisory-lock key collision.** `pg_advisory_xact_lock(hashtext(lower(email))::bigint)` maps email→int4 (`hashtext` is int4). Two *different* emails can collide on the same lock key, serializing unrelated concurrent invites. This is a **throughput** concern only — correctness is unaffected because the SELECT-live-check under the lock filters on the exact email, so a colliding email never causes a wrong 409/allow. Spec §Finding-1 specified the lock but did not address key-space collision. Surface for P-2 if invite volume ever grows.

**G-2 (gap · Low) — `sequenceNumber` surfaced to the admin-activity view.** Spec AC ("actor/target/action/timestamp") + P-4 Finding 3 ("return only actor/target/action/timestamp") did NOT enumerate `sequenceNumber`, yet the deployed row shape (and C-2-confirmed live keys) include it — it doubles as the pagination cursor (`admin-activity.controller.ts` L63,67). Not a secret/PII leak (it's a monotonic audit-chain index), but it exposes total audit volume/ordering to admins, which the spec's field list didn't anticipate. Acceptable for a single-tenant admin-only view; flag for P-2 to decide whether cursor should be opaque/encoded.

**G-3 (gap · Low) — `fieldMapping` bounded-but-not-enum value slot.** The config whitelist's `fieldMapping: z.record(z.string().max(128))` (`data-source-admin.ts` L103) is bounded-length but free-value — a short secret (≤128 chars, e.g. an API key) could technically pass the whitelist and land in plaintext `config`. P-4 Finding 2 required "constrained non-secret types (enum/bool/number/bounded-format) — NO free-text slot"; `fieldMapping` values are bounded-format-adjacent (they're meant to be provider field NAMES) but not format-constrained the way `regionSlug` is. The intent (no *dedicated* free-text field) is met and the field's purpose is legitimate, but the value slot is the residual soft spot the spec's "no free-text slot" framing didn't fully close. Surface for P-2 — a format regex on `fieldMapping` values would harden it.

*(These three are the latent observations the T-block did not record as findings — all T-stage `findings: []`. They are spec-anticipation gaps for the NEXT wave's P-2, not defects in the deployed d72d7cb behavior.)*

---

## Summary
- **APPROVE.** All 6 blocks match spec-contract INTENT (not just literal ACs) in deployed d72d7cb; P-4 SECURITY REWORK (advisory-lock-not-index, config no-echo + no-free-text, drop-vacuous-firm-scope) is faithfully implemented. Deferral honesty holds (M7 in_progress, #141 deferred). No spec-drift (no case where deployed code contradicts spec).
- **Findings: 3 — 0 drift / 3 gap** (all Low-severity spec-anticipation gaps: hashtext-collision, seq-cursor-to-admin exposure, fieldMapping bounded-value slot). None block the wave; all routed to next-wave P-2.

wrote V-1-jenny.md
