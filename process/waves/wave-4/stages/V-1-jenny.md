# V-1 jenny — semantic spec-vs-DEPLOYED verification (wave-4: tamper-evident HMAC audit log, M2)

**Reviewer:** jenny (semantic spec-contract intent; Karen does source-claim independently).
**Spec source:** DB `tasks.description` for task `ec1f279d…` (4-block bundle) + P-4 remediation addendum (route/design retarget to `/compliance/audit-log` + `design/audit-log-export.html §Integrity Validation`).
**Architecture:** `command-center/dev/architecture/security.md §Audit-log security & integrity`. **Journey:** row 16.
**Deployed:** api `dealflow-api-production-66d4` · web `dealflow-web-production-a4f7` (deploy `cd06e8a`).
**Method:** live probes against the deployed API + web origin; real role sessions minted via `POST /auth/invite` → `POST /auth/signup` (invite-bound, Set-Cookie session). App DB is on Railway private net (not directly reachable here — DB-layer immutability is C-2's owned proof; jenny verifies via the deployed surfaces + confirms the live chain matches C-2's stated state).

## VERDICT: **APPROVE** — drift: 0, gap: 1 (documented/honest)

Every spec-block acceptance criterion that is observable at the deployed surface MATCHES intent. The audit log is genuinely tamper-evident + append-only (not merely present); the integrity view faithfully shows chain integrity to the compliance persona and ONLY compliance; verify-now works live; the thin slice is honest (no false audited/exported claims). The single gap (tail-truncation non-detection) is an inherent property of a self-contained hash chain, is explicitly documented as an accepted boundary in the verifier + T-8 + security.md, and does not contradict the spec's own gap-detection wording. No blocking finding.

---

## Block 1 — audit_log_entries table (append-only) — **MATCHES**

- **Immutability (LIVE, per C-2 + re-confirmed):** the live chain of 3 entries appended via the real HMAC service is still intact right now (`GET /compliance/audit-log/verify` → `{ok:true,entriesChecked:3}`), consistent with C-2 leaving the DB clean after its UPDATE/DELETE/TRUNCATE-rejected + tamper-restore test. C-2 proved (app role == table owner) UPDATE/DELETE/TRUNCATE all rejected by the `BEFORE UPDATE/DELETE` row trigger + `BEFORE TRUNCATE` statement trigger; row count unchanged (3). The trigger is the load-bearing control since the app role owns the table (REVOKE is a no-op vs owner) — exactly as the migration design anticipates.
- **Schema/grant:** C-2 DB verification — `audit_log_entries` exists (12 cols, `created_at timestamptz`), grants = INSERT/SELECT only (UPDATE/DELETE/TRUNCATE revoked), triggers enabled (`tgenabled='O'`). Migration 0002 additive-only (no destructive DDL on existing tables).
- jenny note: I could not re-run the raw SQL immutability probe (app DB behind Railway private net; the temporary TCP proxy C-2 used was correctly deleted). The immutability claim is C-2's owned live proof; the still-intact live chain is consistent with it. Karen owns independent source-claim verification.

## Block 2 — HMAC-SHA256 hash-chained append service — **MATCHES**

- **Live chain is HMAC-chained + consistent:** the 3-entry chain (appended through the real `AuditService.appendStandalone()` path, real `node:crypto` HMAC, real tx, real timestamptz round-trip) verifies `ok:true` over the live endpoint — proving genesis anchor + prev_hash linkage + per-entry `entry_hash` recompute all hold against a real pg read-back (the `created_at`-canonicalization fix `f1ec575` proof).
- **Genesis:** verifier asserts entry 1 `prev_hash == GENESIS_PREV_HASH` (source `audit.verifier.ts`); documented.
- **Key-versioned / rotation-ready:** `AuditKeyring.keyFor(chainVersion)` selects the key per entry; `AUDIT_LOG_HMAC_KEY_VERSION` (=1 live) stamps new appends; key read from env (`AUDIT_LOG_HMAC_KEY`, 64 chars set on Railway, value withheld), never DB/logged; fail-fast at boot (Zod `.min(1)`) — api booted clean, so the key was present.
- **Write-atomic:** `append(entry, tx)` composes into the caller's tx (same-tx chosen; outbox documented fallback deferred per addendum item-6). No real async call-site exists this wave — correctly deferred.
- **Threat boundary honest:** keyed HMAC → tampering evident to any keyless/read-only-DB verifier; DB-write+key attacker can re-chain (accepted, documented, HSM/signature upgrade noted). No over-claim.

## Block 3 — chain-integrity verifier + endpoint — **MATCHES** (1 documented gap)

- **Endpoint contract (LIVE):** `GET /compliance/audit-log/verify` → `200 {ok, entriesChecked, firstBreakAt?, reason?}`. Live: intact chain → `{ok:true,entriesChecked:3}`. Empty-log vacuous case → `{ok:true,entriesChecked:0}` (C-2). Response shape matches spec exactly.
- **RBAC matrix (LIVE, real sessions) — all MATCH:**
  | Actor | Expected | Observed |
  |---|---|---|
  | compliance | 200 | **200 `{ok:true,entriesChecked:3}`** |
  | admin | 200 | **200 `{ok:true,entriesChecked:3}`** |
  | advisor | 403 | **403 Forbidden** |
  | analyst | 403 | **403 Forbidden** |
  | unauth | 401 | **401 Unauthorized** |
  Roles resolved from the single `roleRoutes` source (`rolesForRoute('/compliance/audit-log/verify')` → `['compliance','admin']`), fail-closed at boot on empty + at request time on empty `@Roles()`.
- **Tamper-detection genuinely works (LIVE, C-2 privileged path):** disabled the row trigger (owner-level, auditable, NOT the app path), flipped seq=2 `content_hash` → re-verify `{ok:false,entriesChecked:2,firstBreakAt:2,reason:content-hash-mismatch}` at the exact sequence + correct reason; restored → `ok:true`. Verifier source independently confirms it walks seq ASC, recomputes HMAC per entry (key by `chain_version`), and checks prev_hash link + contiguity — returning at first break. This is a real walk-and-recompute, not a cached flag (the live `entriesChecked` tracks real row count: 0 on empty, 3 on the appended chain — not a canned constant).
- **Detects content-tamper + prev-hash-break + mid-chain deletion (sequence-gap):** all three reason codes implemented and reachable per source; content-tamper proven live.
- **GAP (spec-silent, honestly disclosed):** the verifier does NOT detect **tail truncation** (deleting the newest N entries with no successor) — a self-contained walk over the surviving rows is internally consistent with no anchor recording expected length. This is an inherent hash-chain property, not a code defect. The spec block-3 AC frames deletion-detection as "missing sequence_number (non-contiguous) OR broken prev_hash link" — both satisfied for mid-chain deletion. Tail-truncation is explicitly documented as an accepted boundary (`audit.verifier.ts` header, T-8, security.md future high-water-mark note). **No over-claim** on the deployed surface. Tag: gap (spec-silent), non-blocking; flagged for a future external checkpoint (M6+).

## Block 4 — integrity view at /compliance/audit-log — **MATCHES** (per P-4 addendum retarget)

- **Renders the integrity view (LIVE, compliance session, server-rendered):** page shows "Audit Log Integrity" heading, "All entries verified" emerald pill, "Entries checked: **3**" (real live chain count — not mock data), "Chain status: Intact", "Integrity hashes & verification / Required by FINRA profile" panel, and a "Verify now" button — per `design/audit-log-export.html §Integrity Validation`.
- **verify-now works LIVE:** the button's same-origin proxied path `WEB/compliance/audit-log/verify` (compliance cookie) → `200 {ok:true,entriesChecked:3}`. End-to-end functional.
- **RBAC — compliance-only (LIVE):**
  - compliance → page renders (200) + sidebar nav item "Audit Log" (href `/compliance/audit-log`) present — the addendum's B-1 nav fix (previously unreachable route) is LIVE.
  - advisor → 307 redirect to `/`; analyst → 307 redirect to `/`; **admin → 307 redirect to `/`** (page is compliance-only); unauth → 307 redirect to `/login`.
- **INTENTIONAL page-vs-endpoint RBAC split (verified, not a bug):** page = `['compliance']` (human surface + nav); verify endpoint = `['compliance','admin']` (API/ops surface, no nav). Documented in `rbac.ts` with rationale; matches journey row 16 persona=Comp. Admin can machine-verify via API but has no page/nav — journey-faithful.
- **Broken-chain state = persistent, non-dismissible (source-verified):** `BrokenState` renders `role="alert" aria-live="assertive"`, shows `firstBreakAt` + reason code + entries-checked, and the copy states "This panel is persistent and cannot be dismissed." Not a toast. (Could not force a live broken state without DB trigger access — but the render path is unconditional on `result.ok===false`, and tamper-detection proven live at the endpoint feeds it.)
- **Design-system fidelity:** zinc/emerald tokens, 4px grid, inline SVG lucide-equivalent icons, fit-content status pill — matches DESIGN-SYSTEM §10.

## Key intent checks

1. **Genuinely tamper-evident + append-only (not just present)?** YES. Immutability enforced at DB layer (trigger blocks even table owner — proven live U/D/T rejected); keyed HMAC chain verifies live on a real appended chain; tamper-detection flags the exact broken sequence live and recovers.
2. **Integrity view faithful to compliance persona + ONLY compliance?** YES. Live compliance render shows real chain status/count/verify-now per design §Integrity Validation; advisor/analyst/admin(no-compliance) all denied (redirect); nav item compliance-only. verify-now works live.
3. **Thin slice honest?** YES. No export endpoint (`/compliance/audit-log/export` → 404); shipped page contains ZERO export UI (no "Export Data"/"Generate Export"/"Export Package" from the design mock) and no fabricated log-table rows — only the integrity view. Real audited-action call-sites + export + rules engine (`/compliance/settings`) correctly deferred to M6+/later-M2. Nothing falsely claimed as audited or exported.
4. **Drift from security.md §Audit-log intent?** None. INSERT-only + DB-layer defense-in-depth, keyed HMAC-SHA256 hash-chain (not bare hash), canonical serialization versioned (`chain_version`), on-demand compliance/admin verification, key in Railway env never DB. Tail-truncation boundary honestly matches security.md's "future signed high-water-mark" note.

## Findings summary
- Blocks 1/2/3/4: **MATCHES** vs deployed behavior.
- Drift (code-wrong): **0**.
- Gap (spec-silent): **1** — tail-truncation non-detection (inherent hash-chain limit; documented + accepted; non-blocking; future external-checkpoint path noted).

**jenny verdict: APPROVE** (drift 0 / gap 1). Compliance-critical criteria met; no rubber-stamp — every AC traced to a live observed artifact or C-2's owned live DB proof.
