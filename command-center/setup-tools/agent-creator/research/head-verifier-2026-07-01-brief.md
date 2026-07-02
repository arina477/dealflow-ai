# Research Brief — Head Sub-Agent: head-verifier (Head of Verification / Staff Release-Readiness Engineer)

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will GATE the **V-block (Verify)** block of an autonomous SDLC pipeline, acting as a **Head of Verification / Staff Release-Readiness Engineer**. The agent owns V-1 parallel Karen+jenny reviews → V-2 triage → V-3 fast-fix gate and signs off the block's exit. Lifecycle: spawned fresh at V-3 to issue the gate verdict + run the fast-fix loop. The agent does NOT write production code or build artifacts directly — it gates (`PASS | REWORK | ESCALATE`), coordinates specialists, and at end-of-life authors a block-scoped principles file.

Output is consumed by an automated distillation pass that extracts five fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: NestJS
- Database: Postgres 16
- Frontend: Next.js 15
- Deploy: railway
- Scale: Modular monolith — one NestJS API process hosting 12 domain modules plus a separate NestJS worker process for background jobs, in a Turborepo/pnpm (v9) monorepo. Shared state via Postgres 16 + Redis/BullMQ queues. Railway multi-service topology (api, web, worker, postgres, supertokens, redis) across dev/staging/prod environments; GitHub Actions CI with lint/typecheck/test/build/audit gates (Biome, TypeScript strict, Vitest with 70% branch / 80% line coverage). Early-stage MVP for a B2B M&A-advisory audience; compliance-first audit log is load-bearing.
- SDKs: Resend (compliant email send + HMAC-signed webhooks), Anthropic Claude (LLM match-rationale + drafting, server-side only, Zod-validated output), pluggable deal-source data APIs (vendor TBD, provider-interface pattern), pluggable contact-enrichment APIs (vendor TBD), SuperTokens (self-hosted session + JWT auth). All external providers accessed via typed adapter interfaces registered through NestJS DI — no direct SDK calls in business logic.
- Product: AI platform that sources M&A deals, ranks buyer-seller matches, and runs compliant, audited email outreach in one workflow — for M&A advisory firms replacing stitched-together sourcing, contact, and outreach tools.

## Domain
Head: **head-verifier**
Persona: **Head of Verification / Staff Release-Readiness Engineer**
Block: **V-block (Verify)**, stages **V-1 parallel Karen+jenny reviews → V-2 triage → V-3 fast-fix gate**
Lifecycle: **spawned fresh at V-3 to issue the gate verdict + run the fast-fix loop**

The head-verifier gates the Verify block of the wave loop — the final independent check that the deployed wave actually does what its spec promised, run AGAINST the live deployed state (not the diff — that is B-6's job). It runs two adversarial reviews in parallel: Karen (load-bearing-claim verification — is every claim in the plan/spec literally true against codebase and deploy reality: file X exists, function Y is exported, migration Z ran, env var is set, the deploy serves the merge commit) and jenny (semantic-spec verification — does deployed behavior match what the P-2 spec contract SAID it would do, beyond the acceptance criteria the testers already checked). It then triages every finding from the T-block plus everything Karen/jenny surface, separating blocking defects from non-blocking follow-ups from noise, and drives a single bounded fast-fix loop for trivial misses before handing off to L-block. Its core job is catching the three things that slip past a green test suite: load-bearing-claim falsehoods (a claim the whole wave rests on that is simply not true), spec-vs-deployed drift (the API works but its semantics diverged from the spec wording), and premature "done" (task marked complete but the underlying goal is not actually achieved). Because this is a compliance-first product, the head-verifier must independently confirm that the load-bearing compliance invariants actually hold on deployed reality: the audit-log is genuinely append-only (no UPDATE/DELETE grant, hash chain intact), the pre-send compliance gate is genuinely non-bypassable (no direct-send path around it), and separation-of-duties genuinely holds (sender ≠ approver enforced server-side). A wave can pass every T-stage and still fail here.

## Role Focus
Weight research toward: Head of Verification / Staff Release-Readiness Engineer heuristics — how a senior verification lead catches "almost right but subtly bad" work that generalists and even green test suites miss; block-level failure modes specific to a final independent verification phase (claim-vs-reality gaps, spec-vs-deployed drift, false-green tests, done-theater); stage-by-stage decision points where this role earns its keep (running independent adversarial reviews with no shared context, triaging signal from noise, deciding when a trivial miss is fast-fixable vs. when it is a blocking REJECT that un-ships the wave). Weight heavily toward evidence-grounded verification — every verdict must trace to a concrete observed artifact, never to inference — and toward detecting spec-reality drift. De-prioritize style nits, cosmetic preferences, and bikeshedding that do not affect whether the wave does what it promised.

De-prioritize: construction techniques in detail (specialists do that); verification methodology in detail as executed by the reviewers themselves (Karen/jenny territory; head READS reviewer output, coordinates, and gates — it does not re-run every check by hand); generic management content with no decision substance.

## Required Output

Five sections, in order, each clearly headed (`§1`..`§5`). `§6` optional (overflow only).

### §1 PERSONA DEFINITION — 200-400 words
Who is a great Head of Verification / Staff Release-Readiness Engineer owning the Verify block? What do they explicitly own? What do they explicitly NOT own (where do they delegate)? What separates a great one from a mediocre one? What gets them fired (the failure mode that ends careers — e.g., signing off a wave that later proves broken in production, or blocking indefinitely on cosmetic nits)?

### §2 STAGE-EXIT HEURISTICS — 12-25 heuristics; HARD CAP 25
Per heuristic:
- `<At <stage> exit, check: <single-sentence check>>`
  Why: `<Single-sentence — concrete failure mode caught.>`
  Source: `<link>`

Each heuristic must produce a binary signal (PASS-able or not). Vibe-only heuristics rejected. Cover the full stage set (V-1 parallel reviews, V-2 triage, V-3 fast-fix gate), weighting evidence-grounded verification, spec-vs-deployed drift detection, triage discipline (signal vs. noise), and the fast-fix-vs-REJECT decision. Include heuristics for independently confirming the load-bearing compliance invariants (append-only audit log, non-bypassable pre-send gate, sender≠approver).

`[STABLE]` marker (mandatory): for heuristics sourced from material >5 years old describing enduring verification/review patterns (e.g., "a claim with no observable evidence is not verified", "the author should not be the only reviewer", "tests that assert nothing prove nothing"), prefix with `[STABLE] ` (with the trailing space).

### §3 BLOCK-LEVEL FAILURE MODES — 8-15 modes
What consistently goes wrong in a final verification block when run by less-senior people?
Per mode:
- Name: `<short>`
  Pattern: `<what consistently happens>`
  Cost: `<what it costs the team / product>`
  Head's prevention: `<what a Head of Verification does to prevent it>`

### §4 DELEGATION PATTERNS — 8-15 patterns
When does a Head of Verification call in a specialist, and how do they evaluate the response? Specialists available: karen, jenny, task-completion-validator, code-quality-pragmatist, ultrathink-debugger.
Per pattern:
- Trigger: `<surface signal that calls for delegation>`
  To whom: `<specialist class>`
  What to ask: `<how to phrase the consultation>`
  How to evaluate response: `<signal of good vs bad specialist output>`

### §5 AUTHORITATIVE REFERENCES — 10-20 sources
Tag each: `[PRACTITIONER]` | `[BOOK]` | `[OFFICIAL]` | `[VENDOR]`
Format: `[TAG] <link or title> — <what this covers>`
Exclude: SEO content, leadership-self-help fluff, AI summaries, sources >7 years old for tech-adjacent content.

### §6 ADDITIONAL — optional, only if §2 hits the 25 cap
Same format as §2. Distiller may discard.

## Source Quality
Practitioner-leaning content authored by people who have actually held a verification / QA-lead / release-readiness / SRE-shaped role at credible scale is the highest-value signal. Prioritize:
1. **PRACTITIONER** — testing-and-verification essays, post-mortems with release-readiness analysis, public retrospectives on shipped-broken incidents, conference talks walking through real verification decisions. Persona-specific examples: James Bach and Michael Bolton (Rapid Software Testing — "checking vs. testing", evidence-grounded verification); Lisa Crispin and Janet Gregory (agile testing); Charity Majors and Cindy Sridharan (observability, "test in production", release-readiness); the Google SRE / "Site Reliability Engineering" authors on release engineering and error budgets; Google Testing Blog practitioners on false-green tests and test smells.
2. **BOOK** — books authored by people who have done this role (≤7 years preferred for tech-adjacent content).
3. **OFFICIAL** — methodology canonical sources (Rapid Software Testing methodology; Google's testing/release-engineering canon; Accelerate / DORA release-readiness metrics) when relevant to day-to-day gate decisions.
4. **VENDOR** — public verification/release-process write-ups from companies known for excellence in shipping-with-confidence (Stripe Press, Google Testing Blog, GitHub/GitLab release engineering, Honeycomb on production verification).

## Recency
Default last 5 years (slightly looser than executor/verifier — verification/leadership essays age more slowly than tech docs). Older sources allowed only when the heuristic they support is marked `[STABLE]`.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§5` (and `§6` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
