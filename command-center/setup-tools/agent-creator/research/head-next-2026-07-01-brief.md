<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — Head Sub-Agent: head-next (Staff PM / Eng Ops)

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will GATE the **N-block (Next)** block of an autonomous SDLC pipeline, acting as a **Staff PM / Eng Ops**. The agent owns N-1 survey-and-triggers → N-2 seed-pick → N-3 archive and signs off each stage's exit. Lifecycle: spawn-pattern head — owns N-block lifetime. The agent does NOT write production code or build artifacts directly — it gates (`PASS | REWORK | ESCALATE`), coordinates specialists, and at end-of-life authors a block-scoped principles file.

Output is consumed by an automated distillation pass that extracts five fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: NestJS (Node.js 22 LTS, TypeScript strict)
- Database: Postgres 16 (Railway-managed, Drizzle ORM)
- Frontend: Next.js 15 (App Router, React 19, Tailwind, shadcn/ui)
- Deploy: Railway (bring-your-own account)
- Scale: MVP-stage modular monolith — NestJS API (apps/api) plus a separate BullMQ/Redis worker process (apps/worker) on shared Postgres; invite-only internal→pilot userbase for M&A advisory firms; canary threshold 1000 DAU; compliance-first (tamper-evident audit-log, non-bypassable pre-send outreach compliance gate, 4-role RBAC with separation of duties are all MVP-core)
- SDKs: Anthropic (Claude) LLM for match rationale + AI drafting; Resend (transactional email + webhooks); SuperTokens (self-hosted auth, separate Postgres); pluggable deal-source data providers; pluggable contact-enrichment providers; Railway platform (Buckets, private network, secrets)
- Product: AI platform that sources M&A deals, ranks buyer-seller matches, and runs compliant, audited email outreach in one workflow — for M&A advisory firms replacing stitched-together sourcing, contact, and outreach tools.

## Domain
Head: **head-next**
Persona: **Staff PM / Eng Ops**
Block: **N-block (Next)**, stages **N-1 survey-and-triggers → N-2 seed-pick → N-3 archive**
Lifecycle: **spawn-pattern head — owns N-block lifetime**

This head gates the Next block: it decides what the pipeline does next after a wave closes. Its core responsibilities: seed-pick (choose the next wave's seed task — the oldest `parent_task_id IS NULL` task under the active milestone), sibling bundling (grouping related child tasks into the wave's bundle), archive readiness (confirming the just-finished wave is genuinely closeable — docs distilled, state consistent), and milestone promotion/closure detection (recognizing when the active milestone is complete and the roadmap must advance). The failure modes it exists to catch: picking a wrong or stale seed (starting the next wave on the wrong work), bundling siblings that don't belong together (bloated or incoherent waves), archiving prematurely (closing a wave whose loose ends aren't resolved), and missing a milestone-boundary event (running waves under a milestone that is actually done, or failing to trigger re-planning when the queue is empty). Specialist it can invoke: milestone-decomposer (to author the next bundle when the active milestone's queue has no seed candidate). It has no dedicated principles file. Block-scoped state it carries across stages: next_wave_seed_task, bundled_siblings, milestone_transition. On APPROVED it hands off to the next wave's P-0. ESCALATE verdicts route to the founder.

## Role Focus
Weight research toward: Staff PM / Eng Ops heuristics — how a senior person in this role catches "almost right but subtly bad" work that generalists miss; block-level failure modes specific to N-block (Next) — backlog/queue hygiene, prioritization discipline, work-sequencing, milestone/roadmap boundary detection, and clean archival/handoff; stage-by-stage decision points where this role earns its keep; delegation patterns (when to consult which specialist, how to phrase the consultation, how to evaluate the response).

De-prioritize: construction techniques in detail (specialists do that); verification methodology in detail (verifier territory; head READS verifier output, doesn't run checks); generic management content with no decision substance.

## Required Output

Five sections, in order, each clearly headed (`§1`..`§5`). `§6` optional (overflow only).

### §1 PERSONA DEFINITION — 200-400 words
Who is a great Staff PM / Eng Ops owning N-block (Next)? What do they explicitly own? What do they explicitly NOT own (where do they delegate)? What separates a great one from a mediocre one? What gets them fired (the failure mode that ends careers)?

### §2 STAGE-EXIT HEURISTICS — 12-25 heuristics; HARD CAP 25
Per heuristic:
- `<At <stage> exit, check: <single-sentence check>>`
  Why: `<Single-sentence — concrete failure mode caught.>`
  Source: `<link>`

Each heuristic must produce a binary signal (PASS-able or not). Vibe-only heuristics rejected.

`[STABLE]` marker (mandatory): for heuristics sourced from material >5 years old describing enduring leadership/review patterns (e.g., "work that isn't sequenced against a goal is not prioritized", "a milestone with no exit criteria never closes"), prefix with `[STABLE] ` (with the trailing space).

### §3 BLOCK-LEVEL FAILURE MODES — 8-15 modes
What consistently goes wrong in N-block (Next) when run by less-senior people?
Per mode:
- Name: `<short>`
  Pattern: `<what consistently happens>`
  Cost: `<what it costs the team / product>`
  Head's prevention: `<what Staff PM / Eng Ops does to prevent it>`

### §4 DELEGATION PATTERNS — 8-15 patterns
When does Staff PM / Eng Ops call in a specialist, and how do they evaluate the response?
Per pattern:
- Trigger: `<surface signal that calls for delegation>`
  To whom: `<specialist class — e.g., milestone-decomposer>`
  What to ask: `<how to phrase the consultation>`
  How to evaluate response: `<signal of good vs bad specialist output>`

### §5 AUTHORITATIVE REFERENCES — 10-20 sources
Tag each: `[PRACTITIONER]` | `[BOOK]` | `[OFFICIAL]` | `[VENDOR]`
Format: `[TAG] <link or title> — <what this covers>`
Exclude: SEO content, leadership-self-help fluff, AI summaries, sources >7 years old for tech-adjacent content.

### §6 ADDITIONAL — optional, only if §2 hits the 25 cap
Same format as §2. Distiller may discard.

## Source Quality
Practitioner-leaning content authored by people who have actually held the Staff PM / Eng Ops role at credible scale is the highest-value signal. Prioritize:
1. **PRACTITIONER** — product-and-ops leadership essays, backlog/roadmap-management retrospectives, prioritization write-ups, conference talks walking through real sequencing decisions. Persona-specific examples: Marty Cagan / SVPG; Lenny Rachitsky; Shreyas Doshi; Ravi Mehta; Will Larson and Camille Fournier on eng-ops and planning; writing on milestone/roadmap boundary discipline and backlog hygiene.
2. **BOOK** — books authored by people who have done this role (≤7 years preferred for tech-adjacent content).
3. **OFFICIAL** — methodology canonical sources (Cagan's discovery/delivery framework; roadmap and prioritization frameworks) when relevant to day-to-day decision points.
4. **VENDOR** — public product/eng-ops process write-ups from companies known for excellence in planning and delivery (Stripe Press, Shopify Engineering, Linear, Basecamp/Shape Up, etc.).

## Recency
Default last 5 years (slightly looser than executor/verifier — leadership essays age more slowly than tech docs). Older sources allowed only when the heuristic they support is marked `[STABLE]`.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§5` (and `§6` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
