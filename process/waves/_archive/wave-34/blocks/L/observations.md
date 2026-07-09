# Wave 34 — L-block observations (reality-checked, systemic)

Source of truth: `process/waves/wave-34/stages/T-journey-e2e.md` (two-pass E2E proof) + `T-journey-fix1.md` (P0 fix).
Vetted by `knowledge-synthesizer` (retro/distill) + `karen` (reality-check). Each observation traces a symptom to a **systemic gap** (a missing verification layer / missing safeguard), never to human error. Wave-specific until a second wave confirms, per each `*-PRINCIPLES.md` "Contract for new rules" authoring discipline.

---

## OBS-4 (STRONGEST this wave — NEW, single-wave confirmation, HELD) — A green unit/integration suite does not certify the deployed build renders; only a real E2E pass against the deployed origin catches deploy-only render faults

**Symptom.** Pass-1 of the E2E proof against the deployed web app found **100% of authenticated routes returning HTTP 500** (`/`, `/mandates`, `/matches`, `/pipeline`, `/outreach`, `/compliance/audit-log`) — the entire logged-in UI was dead. The login page rendered and login succeeded; the moment a session existed, every route 500'd with a Next.js `__next_error__` shell (browser digests e.g. `2577716916`, `1684222324`). The API was fully healthy throughout. The unit and integration suites were green; the deploy was green.

**Root cause (verified by reading the fixed source + re-render).** `AppShell.tsx` — a Server Component that wraps every authenticated route — carried `onFocus`/`onBlur` event handlers on a skip-link `<a>`. Next.js 14 **hard-errors** on event-handler props in Server Components at server render time. The fault therefore exists ONLY in the real server-render path of the deployed build; no unit or integration test renders through the production Next.js server, so none could observe it. Fix (`b557ac7`): extracted the skip-link to a dedicated client component (`SkipLink.tsx`); redeployed (`bbbd7e5b`); browser-re-verified all authenticated routes render **HTTP 200** (pass-2).

**Systemic gap (not human error).** No verification layer between "green unit/integration suite + green deploy" and "a human can actually use the deployed app" existed for the server-render path. The blind spot is structural: mocked/component-level tests certify component logic, not the deployed Next.js server render of the composed route tree. The E2E pass against the deployed origin caught it in the first authenticated navigation — the counterfactual proof (every authed page 500 → every authed page 200 on one extracted component).

**Distinctness.** This is NOT the wave-33 held rule (OBS-1, external-API adapter request-contract). There is no external service, no outbound request, no mocked-fetch adapter here — it is a server-component render fault. It is also distinct from VERIFY rule 1 (DB wire-format serialization) and rule 3 (compliance-invariant mocking). It shares only the meta-theme "green-in-isolation ≠ green-against-reality" with OBS-1 — a theme, not a codifiable rule.

**Impact.** Critical — the whole product UI was unusable for every logged-in user, behind a fully green test + deploy signal. Everything reported healthy; users saw nothing but errors. The worst failure class.

**Recurrence status — SINGLE-WAVE CONFIRMATION (held).** The *deployed-render* failure class has manifested exactly once (this wave). Wave-33's deploy-only misses were an external-API request contract (OBS-1) and infra-authoring faults (OBS-2/3) — a different verification-layer gap, caught by live REST sync / live provisioning, not by a deployed-frontend E2E render. Under the same 2-wave discipline wave-33 imposed on its own candidate, this NEW distinct observation must hold for a second confirmation before promotion. → HELD.

**Pre-loaded second site.** The next wave whose deployed frontend either (a) manifests a server-render / build-only fault that green isolated tests passed, or (b) is proven clean only because a deployed-origin E2E pass was run, = second-wave confirmation. On that confirmation, promote the drafted rule below (head-verifier approval still required).

**Drafted rule (Contract-format, HELD — do not append until 2nd-wave confirmation):**
```
5. Run one full end-to-end pass against the deployed build every wave, not only green unit and integration suites.
   Why: A server-render or deploy-only fault passes every isolated test yet 500s every authenticated page live.
```
(rule 111 chars ≤120; why 96 chars ≤100; 2 lines; no wave refs, no war stories, no em-dash, no we/our/the-team — pre-verified against the VERIFY Contract.)

---

## OBS-5 — No reachable role-provisioning path on the deployed app blocked the multi-role SoD proof until roles were created directly

**Symptom.** The M6 core (compliance gate + sender≠approver separation of duties) is deliberately split across four roles; the only available login (admin) is excluded from every M6-core action by design (`403` on compose, approve, pipeline transition). The token-returning invite endpoint `POST /auth/invite` returned `500` on the deployed app; the working `POST /admin/users/invite` deliberately never returns the token; no email delivery exists. So no advisor/compliance session could be obtained through any product surface — the binding M6 metric was un-exercisable until advisor + compliance role-users were created directly to enable the proof.

**Systemic gap.** For a product whose core value is a role-split, non-bypassable workflow, there was no reachable, testable path to provision the non-admin roles the workflow requires. A verification harness for an SoD-gated flow needs a way to stand up each distinct role; without it, the most important invariant is unprovable end-to-end on deployment.

**Recurrence status — single-wave. Held.** Infra/provisioning gap, adjacent to but distinct from OBS-4. Not promotion-eligible.

---

## OBS-6 (POSITIVE, confirmatory) — The M6 compliance spine is genuinely non-bypassable and SoD-correct against deployed state

**Observation.** Pass-2 proved the full loop against the deployed app with live evidence: ranked matching (integer fit-scores 0–100 + per-buyer `scoreBreakdown`) → non-bypassable multi-layer compliance gate (`composeAsActor` ALWAYS evaluates; compose-before-approval = `blocked` code `version-binding`; missing disclaimer = `blocked` code `missing-disclaimer`) → sender≠approver SoD (advisor self-approve `403`, admin approve `403`, compliance approve `201` with `approvedBy` ≠ composer) → `send_eligible` only on a fully-passing verdict → immutable audit log (`verify {ok:true, entriesChecked:350}`, unbroken hash chain, `actorRole` distinguishes compliance-approval from advisor-compose) → pipeline enroll + advisor stage transitions (compliance `403`-blocked), UI-confirmed.

**Why recorded (not a rule).** This confirms the compliance-first architecture holds under real deployed state — a durable health signal for N-block and future waves, not a codifiable defect. Documented boundary (NOT a gap): no real outbound email dispatch exists; M6 terminates at `send_eligible` + audited record by design (compliance-first). This is the M6 definition-of-done as specified, not a shortfall.

---

## Cross-wave note (system health)

The strongest lesson this wave (OBS-4) confirms the standing meta-pattern from wave-33: **green-in-isolation is not green-against-reality.** Wave-33's live-verify discipline surfaced an external-API request-contract miss and two infra-authoring faults; wave-34's deployed-origin E2E discipline surfaced a total server-render outage — all behind green test + green deploy signals. The durable asset is the *deployed-origin E2E pass itself*; OBS-4 is its formal single-wave candidate. Both OBS-4 (this wave) and the wave-33 OBS-1 adapter rule remain HELD, each awaiting its own second-wave confirmation at its own specificity. **Zero rules promoted this wave.**
