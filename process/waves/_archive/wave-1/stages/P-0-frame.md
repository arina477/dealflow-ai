# Wave 1 — P-0 Frame

## Discover section
- **wave_db_id:** c086d358-e754-4982-b427-1f0f3a9adf11 (wave_number 1; started 2026-07-02T11:20:13Z)
- **Prior-work citation:** none — first build wave (greenfield).
- **Roadmap milestone:** M1 — Foundation: auth, roles, app shell, data model, CI (`platform-foundation`, Tier T1, required-by all). Seed task `e83584db-6387-4567-916c-aacba5c5dede` pre-assigned to M1; wave row backfilled `milestone_id = M1`. (M1 left `status='todo'` — promotion is N-1's job.)
- **Spec-contract short-circuit verdict:** `no-prior-spec` (seed carries prose ## What / ## Why / ## Acceptance, no fenced YAML head). Full P-1..P-3 will run.
- **Product-decision resolutions:** none — platform-foundation scaffold; no money/security/major-UX Tier-3 signal.

## Reframe section
- **Original task framing:** "Project scaffold + walking skeleton + CI" — monorepo (Turborepo/pnpm) + NestJS API + Next.js 15 web + Postgres/Drizzle + first migration + /health + @dealflow/shared (Zod) + Biome/strict TS + GitHub Actions CI green + deploy skeleton to Railway dev. No product features.
- **problem-framer verdict:** PROCEED. Walking-skeleton-first is the textbook-correct first-wave pattern; full vertical slice (web→api→db→CI→deploy), right layer, no symptom/cause inversion, no antipattern match. The bundled items are one indivisible vertical slice — do NOT auto-split. Two sequencing notes (not framing defects): (1) the "Railway dev deploy" rung is credential-gated (bring-your-own RAILWAY_TOKEN at C-2) — P-3 should let scaffold+CI-green reach done independently of the deploy rung; (2) "CI green on main" is a genuine C-block hard-stop risk (GitHub token currently invalid) — P-3 acceptance should treat CI-green as credential-gated so the C-block routes the token gap rather than reporting a false green.
- **ceo-reviewer verdict:** PROCEED (HOLD-SCOPE). Correctly ambitious — not gold-plated, not thin. Foundation-first is disciplined, not timid; the wedge (M2 compliance backbone / M6 outreach proof) is unbuildable without this platform. Notably the skeleton already includes the disproportionate enabler — the real-Postgres CI test job — which pre-provisions M2's audit-grant tests without premature build. No scope change. Traces to bet (1) integrated platform + enables bet (2) compliance-first wedge.
- **mvp-thinner verdict:** n/a — skipped (M1 is `platform-foundation`, not `product-feature`).
- **Mediation outcome:** n/a — both PROCEED, no disagreement.
- **Sibling task IDs created:** none.
- **Disposition:** PROCEED.
- **Final framing:** Build the DealFlow AI walking skeleton (monorepo + API + web + Postgres/Drizzle + /health + shared Zod + Biome/strict TS + CI green). Deploy-to-Railway-dev and CI-green-on-main are credential-gated rungs (Railway token at C-2; GitHub token currently invalid) — P-3 authors acceptance so the scaffold+skeleton reaches done independently, and the C-block routes any credential gap as an infra-readiness hard-stop rather than a false green. No product features this wave.

## Carried into gate (open items)
- GitHub token invalid → C-1 PR/CI is a live C-block hard-stop risk (infra-readiness).
- Railway deploy needs bring-your-own token at C-2 (normal in-wave founder ask).
- Playwright Chrome binary not installed → T-5/T-6 gated host-side (this wave has no UI features to E2E yet, but T-block will note it).
