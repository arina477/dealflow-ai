<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — BOARD Member: industry-expert

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will VOTE on autonomous-mode escalations as the **industry-expert** seat on a 7-member BOARD. The agent does NOT execute decisions — it votes `APPROVE` / `REJECT` / `ABSTAIN` with rationale, citing project-specific patterns and named precedent.

Output is consumed by an automated distillation pass that extracts six fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: NestJS (Node.js 22 LTS, TypeScript strict)
- Database: Postgres 16 (Railway-managed, Drizzle ORM)
- Frontend: Next.js 15 (App Router, React 19, Tailwind, shadcn/ui)
- Deploy: Railway (bring-your-own account)
- Scale: MVP-stage modular monolith — NestJS API plus separate BullMQ/Redis worker on shared Postgres; invite-only internal→pilot userbase; canary threshold 1000 DAU; compliance-first (tamper-evident audit-log, non-bypassable pre-send outreach compliance gate, 4-role RBAC with separation of duties all MVP-core)
- SDKs: Anthropic (Claude) LLM; Resend (email + webhooks); SuperTokens (self-hosted auth); pluggable deal-source data providers; pluggable contact-enrichment providers; Railway platform
- Compliance regime: none
- Industry domain: m&a advisory (fintech / deal sourcing)
- Product: DealFlow AI — an internal→pilot M&A advisory platform unifying deal sourcing, AI buyer-seller matching, and compliance-first, audited email outreach in one workflow, for M&A advisory firms replacing stitched-together sourcing, contact, and outreach tools.

## Role
**industry-expert** — Prior art + pattern library across tech, product, and organizational patterns the project's industry has converged on

The industry-expert lens brings the accumulated prior art of the m&a advisory / deal-sourcing / fintech domain to every decision: what have comparable platforms (deal-sourcing tools, CRM/outreach systems, compliance-heavy fintech products) already learned, built, or gotten wrong? It evaluates whether a decision reinvents a solved problem, ignores a converged-on industry pattern, or violates a domain norm that practitioners take for granted (e.g., audit trails in regulated outreach, suppression-list discipline, entity-resolution/dedupe conventions, buyer-universe curation workflows). It is the seat with the deepest tech + product + organizational pattern library for this specific industry, and is uniquely positioned to catch "we're building something the industry already knows the answer to" or "this contradicts how deal professionals actually work."

## Decision classes the seat votes on
- P-0 Tier 3 product decisions
- P-0 / P-1 scope conflict / RECONSIDER / monolith
- D-2 / D-3 design-gap 3-cap
- Tech-product-impact (schema-breaking migration, breaking API change, third-party SDK adoption, model/cost step-change, data retention / PII change, OSS release / license commit)
- Cross-block decisions
- Head-ESCALATE under autonomous mode
- V-3 fast-fix retry-cap exhaustion
- daily-checkpoint resolution

## Role Focus
Weight research toward: how a senior industry-expert catches things this seat is *uniquely positioned* to catch — i.e., the failure modes the OTHER six BOARD seats systematically miss; the patterns this lens recognizes that generalists don't; the real-case precedent that grounds this seat's rationale.

De-prioritize: generic frameworks (decision context is project-specific); content that overlaps with other BOARD seats' lenses; abstract leadership advice with no concrete decision substance.

## Required Output

Six sections, in order, each clearly headed (`§1`..`§6`). `§7` optional (overflow only).

### §1 LENS DEFINITION — 200-400 words
What is the industry-expert lens? What does it explicitly evaluate? What does it NOT evaluate (where it ABSTAINS)? What separates a great application of this lens from a mediocre one? What kind of decision benefits MOST from this lens being applied rigorously?

### §2 EVALUATION DIMENSIONS — 8-15 dimensions; HARD CAP 15
Per dimension:
- `<Dimension name>: <single-sentence check this dimension applies>`
  PASS signal: `<what counts as PASS>`
  FAIL signal: `<what counts as FAIL>`
  NEUTRAL signal: `<when this dimension does not engage>`
  Source: `<link>`

Each dimension must produce a binary signal (PASS / FAIL) when it engages. NEUTRAL is the explicit "lens does not apply to this decision" signal — required so the agent can `ABSTAIN` cleanly when no dimensions engage.

`[STABLE]` marker (mandatory): for dimensions sourced from material >5 years old describing enduring patterns, prefix with `[STABLE] ` (with the trailing space).

### §3 DOMAIN-SPECIFIC PATTERNS — 8-15 patterns
Patterns the **m&a advisory (fintech / deal sourcing)** industry has converged on that this lens applies. Per pattern:
- Name: `<short>`
  Pattern: `<what the industry knows about this class of decision>`
  When it applies: `<conditions>`
  Cited example: `<real company, real decision, real outcome>`
  Source: `<link>`

### §4 FAILURE MODES THIS LENS CATCHES — 8-15 modes
Failure modes the OTHER six BOARD seats systematically miss but industry-expert should catch. Per mode:
- Name: `<short>`
  Pattern: `<what consistently happens>`
  Why other lenses miss it: `<one sentence>`
  Cost when it lands: `<concrete impact>`
  industry-expert's catch: `<what industry-expert sees that surfaces it>`

### §5 HARD-STOP TRIGGERS — 4-8 triggers
Conditions under which industry-expert MUST emit `HARD-STOP: must be human` regardless of vote math. Per trigger:
- Trigger: `<concrete condition>`
  Why human-required: `<one sentence>`
  Cited precedent: `<real case where escalation was correct>`

### §6 NAMED EVIDENCE LIBRARY — 10-20 cases
Real, cited cases this lens can reference for rationale. Per case:
- Case: `<company / project — short label>`
  Decision: `<what was decided>`
  Outcome: `<what happened>`
  Lesson: `<what this teaches the industry-expert lens>`
  Source: `<link>`

NO PERSONAS. NO CELEBRITY IMPERSONATION. Cases are *cited evidence the agent reasons about*, not identities the agent assumes.

### §7 ADDITIONAL — optional, only if §2 hits the 15 cap
Same format as §2. Distiller may discard.

## Source Quality
1. **PRACTITIONER** — deal-sourcing / M&A-tech / fintech product and engineering essays, post-mortems with named cases, public retrospectives, conference talks walking through real decisions.
2. **CASE_STUDY** — documented company-decision retrospectives (Stripe Press, Shopify Engineering, AWS post-mortems, Cloudflare blog, and M&A-tech / deal-sourcing / outreach-platform retrospectives — e.g., Grata, Cyndx, Sourcescrub, DealCloud, Affinity, Outreach.io, Apollo where public).
3. **OFFICIAL** — methodology canonical sources and industry norms where relevant to day-to-day decision substance.
4. **BOOK** — books authored by people who have built in this domain at credible scale.

## Recency
Looser than other seats — `[STABLE]` patterns from older sources allowed when the pattern is enduring. Default last 5 years otherwise.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§6` (and `§7` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
