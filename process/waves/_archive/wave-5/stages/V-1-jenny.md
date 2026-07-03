# V-1 jenny — Wave 5 (Compliance rules engine + non-bypassable pre-send gate)

**Reviewer:** jenny (semantic spec-compliance — DEPLOYED behavior vs SPEC-CONTRACT intent). Karen owns source-claim, independently.
**Compliance/SoD-critical → strict, no rubber-stamp.**
**Spec source of truth:** `tasks.description` of seed `0595a835-…` (YAML head, 4 blocks) + P-4 SoD=compliance-only remediation addendum.
**Architecture intent:** `command-center/dev/architecture/security.md` §Outreach-compliance-controls + §RBAC-SoD (L64-65, 84-88). **Journey:** user-journey-map.md row 17.
**Live:** api https://dealflow-api-production-66d4.up.railway.app · web https://dealflow-web-production-a4f7.up.railway.app
**Deployed /health:** `{"status":"ok","db":"ok","version":"13e55ef"}` — matches declared deploy hash.
**Source drift check:** repo HEAD `bdf8849` is 3 docs/test-only commits past deployed `13e55ef`; `git diff --stat ce97423 13e55ef` shows **NO change to any `compliance-gate/` source** (only CSRF config + web client + tests/docs) — the gate/evaluator code I read IS the deployed gate code, and C-2's SoD live matrix (run against ce97423's identical gate) is valid for 13e55ef.

## VERDICT: **APPROVE**

All four spec-blocks' acceptance criteria MATCH the deployed behavior against spec intent. The compliance-first wedge promise is genuinely met: a single non-bypassable gate authority enforcing SoD (compliance-only, admin excluded) / suppression / disclaimers / content-hash, every decision audited in-tx; a compliance-only settings CRUD with every mutation audited and RBAC fail-closed; and an **honest thin slice** — the gate is a callable contract, and NO live send path or gate HTTP surface is falsely claimed (all such probes 404). **drift=0, gap=0.**

---

## Per-block MATCHES / DRIFTS (spec AC vs LIVE)

### Block 1 — rules-engine schema + non-bypassable gate service (0595a835) — **MATCHES**
- **4 tables, additive migration (+reversible down):** migration `0003_giant_outlaw_kid.sql` = 4 `CREATE TABLE` (compliance_rules, suppression_list, disclaimer_templates, compliance_approvals) + FK-add ALTERs on the NEW tables only; `.down.sql` DROPs all 4. No existing table touched. Live `/health db:ok` + all live CRUD/audit writes succeeding confirm 0003 applied on the app DB. **MATCHES.**
- **Single `ComplianceGateService.evaluate(ctx, tx)` = SOLE authority:** service is the only composition point; the 4 evaluators are a `private readonly const` array with no independent entry point and no HTTP surface (module exports the service for M6 only). **MATCHES.**
- **Non-bypassability (load-bearing):** `evaluate()` is 2-param (ctx, tx) — no `dryRun`/`skipChecks`/per-check flag; `gateContextSchema.parse(ctx)` is the FIRST statement (fail-closed on malformed ctx → throw → tx rollback, no verdict); all 4 evaluators iterate unconditionally in fixed order; audit-in-tx `await this.audit.append(...)` runs AFTER verdict, BEFORE return — append-throw rolls back the tx → **no verdict without its audit entry**. **MATCHES.** Honest boundary: gate is a callable contract; M6 send-path is a tracked dependency, not claimed live (see thin-slice note).
- **Every verdict audited (recordkeeping):** verdict written to the wave-4 `AuditService.append` in the same tx, action `gate-evaluate`, content-hash bound. C-2 Step 4.D proved LIVE `gate-evaluate` entries 0→5 (one per evaluate). **MATCHES.**
- **Default posture (edge case):** documented + tested allow-with-no-rules (coverage is the invariant, not blanket-deny), while a REAL send is deny-until-approved because the SoD evaluator blocks any resource lacking a valid compliance approval. **MATCHES.**

### Block 2 — suppression + SoD (95adac6c) + P-4 remediation — **MATCHES** (the load-bearing wedge invariant)
- **Suppression HARD block:** `suppressionEvaluator` — exact case-insensitive email match OR dot-boundary domain-suffix match (`blocked.com` catches `foo@sub.blocked.com`, NOT `foo@xblocked.com`); every hit → `suppression` BlockReason, not advisory. C-2 4.D(e): suppressed recipient → `allowed:false` LIVE. **MATCHES.**
- **SoD = compliance ONLY, admin EXCLUDED (P-4 finding-1, the wedge invariant):** `sod.evaluator.ts` — `SOD_APPROVER_ROLE = 'compliance'` (single const); blocks unless the STORED approval row (server-side `repo.loadApproval`, never ctx) satisfies status=`approved` AND `approverUserId !== ctx.senderUserId` AND `approverRole === 'compliance'` exactly. admin/advisor/analyst → `sod/invalid-approver-role`. This is faithful to security.md §RBAC-SoD L64 "no super-role shortcut." **Proven LIVE at C-2 4.D(b): admin-approver → `allowed:false` / `sod/invalid-approver-role` (ADMIN BLOCKED AS APPROVER).** **MATCHES.**
- **Self-approval + null-approver fail-closed:** sender==approver → `sod/sender-is-approver` (C-2 4.D(c) LIVE blocked); deleted approver (FK ON DELETE SET NULL → `approverUserId===null`) is blocked with `approver-unknown` BEFORE the self-approval short-circuit (cannot prove sender≠approver). **MATCHES** the edge-cases.

### Block 3 — jurisdiction disclaimers + content-hash binding (034463b1) — **MATCHES**
- **Disclaimers ENFORCED (not advisory):** `disclaimerEvaluator` resolves the ACTIVE template (highest active version) for `ctx.jurisdiction`; unsatisfied (canonicalized body not a substring of canonicalized content) → `missing-disclaimer` block AND template id in `requiredDisclaimers[]` — `allowed` stays false. Version-drift handled by resolving the current active template every call. **MATCHES.** (T-8 low, non-blocking: substring-plaintext v1; HTML-rendered-text enforcement deferred to M6 — not a bypass of the current invariant.)
- **Content-hash binding (load-bearing):** `content-hash.ts` = keyless SHA-256 over canonicalized content (CRLF→LF, strip trailing newline, trim) — deliberately NOT the audit HMAC (equality-binding, not tamper-evidence). `contentHashEvaluator` RECOMPUTES from `ctx.content` (does NOT trust caller `ctx.contentHash`) and blocks `content-hash-mismatch` unless it equals the STORED `approval.contentHash` → post-approval edit re-blocks. C-2 4.D(d): edited content → `allowed:false` / `content-hash-mismatch` LIVE. **MATCHES.**

### Block 4 — compliance-settings CRUD (34cb1d18) — **MATCHES** (independently reproduced LIVE)
- **CRUD live, RBAC compliance (journey row 17), per design/compliance-settings.html sections:** routes `/compliance/{rules,suppression,disclaimers}` live. My independent live matrix (fresh role users via /auth/invite→/auth/signup, cookie jars, `rid:anti-csrf` on mutations):
  | Check | Expected | Observed (jenny, LIVE) |
  |---|---|---|
  | compliance GET rules / suppression / disclaimers | 200 | **200 / 200 / 200** |
  | admin GET rules | 200 (admin manages config) | **200** |
  | advisor GET rules / suppression / disclaimers | 403 | **403 / 403 / 403** |
  | unauth GET rules / suppression / disclaimers | 401 | **401 / 401 / 401** |
  | compliance POST suppression (domain) | 201 | **201**, row `5b364109…`, `createdBy` valid app users.id `7290fd6f…` (FK-safe) |
  | compliance POST rule invalid enum | 400 (Zod boundary validation) | **400** — rejected `approval_policy`, listed valid enum |
  | compliance POST rule valid (`approval_required`) | 201 | **201**, row `76852810…` |
  | advisor POST suppression / rule (non-compliance denied) | 403 | **403 / 403** |
  | disclaimer versioning: POST US v1, then v2 | exactly 1 active | v1 `active=false`, **v2 `active=true`** (append-style, prior deactivated) |
  | compliance DELETE rule | 204 | **204** |
  - Three sections (Approval & Gating Policy, Suppression Matrix, Jurisdiction Templates) present in design/compliance-settings.html and served (C-2 4.E + Karen: settings render 200, 3 sections; T-5 pixel-verified in chromium). **MATCHES.**
- **Every config mutation AUDITED in-tx:** each create/update/delete writes `AuditService.append(_, tx)` inside `db.transaction` (audit-fail rolls back the mutation — no silent unaudited change). **Independently proven LIVE:** `/compliance/audit-log/verify` `entriesChecked` grew monotonically across my mutations **29 → 32 → 33** (suppression + disclaimer v1 + rule + disclaimer v2 + DELETE rule), with chain `ok:true` at every step — a real HMAC hash-chain verification, not a truthiness flag. **MATCHES** the "config mutation audit-append fails → mutation fails" edge case (in-tx rollback).

---

## Key intent checks (spec/security.md intent → live judgment)

1. **Is the pre-send gate GENUINELY the non-bypassable single authority (SoD/suppression/disclaimers/content-hash), every decision audited — the compliance-first wedge promise?** **YES.** One service, no skip param, fail-closed ctx parse, all evaluators every call, verdict audited in-tx before return (rollback on audit-fail). Structural non-bypassability, faithful to security.md §Outreach-compliance-controls ("server-side choke point, not a UI nicety") + §Reusability-principle ("one compliance-gate service is the only send-eligibility authority").

2. **Is SoD faithful to security.md §RBAC-SoD (approver=compliance ONLY, admin excluded, "no super-role shortcut") — LIVE?** **YES.** `approverRole === 'compliance'` exactly; admin excluded; approver from stored row server-side; self + null-approver fail-closed. **Admin-approver BLOCKED live** (C-2 4.D(b), `sod/invalid-approver-role`). The distinction is correct: admin MAY manage config (CRUD @Roles compliance,admin — security.md L64) but MAY NOT approve outreach (SoD compliance-only) — exactly the P-4 remediation intent.

3. **Does settings CRUD match journey row 17 (Comp persona) + design/compliance-settings.html; compliance-only; every change audited?** **YES.** Row 17 `/compliance/settings` (Comp) → live CRUD over the 3 design sections; compliance/admin manage, advisor/analyst 403, anon 401 (live-reproduced); every mutation audited in-tx (live entriesChecked monotonic, chain ok).

4. **Is the thin slice honest (gate + rules CRUD live; M6 send-path that CALLS the gate deferred — nothing falsely claimed as a live non-bypass send path)?** **YES — independently confirmed.** I probed for any gate/send/evaluate/approvals HTTP surface: `POST /compliance/gate`, `/compliance/evaluate`, `/gate/evaluate`, `/outreach/send`, `/compliance/gate/evaluate`, `/send`, `GET /compliance/approvals` → **ALL 404**. There is no live send path and no HTTP-reachable gate; the gate is exported for M6 only. The wave claims exactly "callable, enforced-when-called authority" — not "live non-bypassable send." No over-claim.

5. **Any spec AC not met live, or drift from security.md §Outreach-compliance-controls / §RBAC-SoD intent?** **None.** Every AC MATCHES; the one open item (disclaimer HTML-text enforcement) is an explicitly-deferred M6 refinement (T-8 low), not an unmet block-3 AC — the current substring invariant is enforced, not advisory.

---

## Scope-honesty note (not a defect)
The gate verdict is not HTTP-reachable this wave by design (a bare `/evaluate` route would be a callable surface with no send behind it + RBAC ambiguity). The SoD/non-bypass/content-hash invariants are present and correct in the deployed code and the SoD matrix was proven LIVE via a one-off `evaluateStandalone` against the prod DB (temporary Railway TCP proxy, documented DELETED after use) — the only viable gate-verdict proof path this wave, and consistent with definitive source review. They enforce the moment M6 wires the send endpoint to `evaluate()`. Honestly scoped, not over-claimed.

**App-DB access note:** `CLAUDOMAT_DB_URL` in this env is the brain DB (founder_bets/milestones/tasks/waves), NOT the DealFlow app DB (Railway private network, no app RAILWAY_TOKEN here). App-DB shape therefore verified end-to-end via the live API exercising the real tables/indexes — the correct available path (same as Karen).

---

## Result
- **drift (code-wrong-vs-spec): 0**
- **gap (spec-silent / unmet AC): 0**
- **Blocks: 4/4 MATCHES.** VERDICT: **APPROVE.**
