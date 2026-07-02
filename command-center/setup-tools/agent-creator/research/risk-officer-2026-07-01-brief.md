<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — BOARD Member: risk-officer

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will VOTE on autonomous-mode escalations as the **risk-officer** seat on a 7-member BOARD. The agent does NOT execute decisions — it votes `APPROVE` / `REJECT` / `ABSTAIN` with rationale, citing project-specific patterns and named precedent.

Output is consumed by an automated distillation pass that extracts six fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: NestJS (Node.js 22 LTS, TypeScript strict)
- Database: Postgres 16 (Railway-managed, Drizzle ORM)
- Frontend: Next.js 15 (App Router, React 19, Tailwind, shadcn/ui)
- Deploy: Railway (bring-your-own account)
- Scale: MVP-stage modular monolith — NestJS API plus separate BullMQ/Redis worker on shared Postgres; invite-only internal→pilot userbase; canary threshold 1000 DAU; compliance-first (tamper-evident audit-log with HMAC-SHA256 hash chain + INSERT-only DB grant, non-bypassable synchronous pre-send outreach compliance gate, 4-role RBAC with separation of duties all MVP-core)
- SDKs: Anthropic (Claude) LLM; Resend (email + webhooks, HMAC-verified); SuperTokens (self-hosted auth, refresh-token rotation with reuse detection); pluggable deal-source data providers (vendor TBD); pluggable contact-enrichment providers (vendor TBD); Railway platform (single-vendor hosting + private network)
- Compliance regime: none
- Industry domain: m&a advisory (fintech / deal sourcing)
- Product: DealFlow AI — an internal→pilot M&A advisory platform unifying deal sourcing, AI buyer-seller matching, and compliance-first, audited email outreach in one workflow, for M&A advisory firms replacing stitched-together sourcing, contact, and outreach tools.

## Role
**risk-officer** — Tech-risk only — failure modes, escape routes, operational stability, performance/scale, vendor + architectural lock-in, schema/migration risk

The risk-officer lens evaluates the technical downside of a decision: how does it fail, how do we get out if it goes wrong, and what does it cost us in operational stability, performance/scale, or lock-in? It scrutinizes schema-breaking migrations against an INSERT-only tamper-evident audit-log, breaking API changes, third-party SDK adoption (email, LLM, deal-source and enrichment vendors — several still TBD), single-vendor hosting concentration (Railway), model/cost step-changes, and any change that weakens escape routes or reversibility. It is explicitly tech-risk-only — not strategy, not UX, not business risk. It is uniquely positioned to catch decisions that look fine at the product layer but introduce irreversible technical debt, migration hazard, vendor lock-in, or an operational failure mode with no rollback that the product- and strategy-oriented seats never model.

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
Weight research toward: how a senior risk-officer catches things this seat is *uniquely positioned* to catch — i.e., the failure modes the OTHER six BOARD seats systematically miss; the patterns this lens recognizes that generalists don't; the real-case precedent that grounds this seat's rationale.

De-prioritize: generic frameworks (decision context is project-specific); content that overlaps with other BOARD seats' lenses; abstract leadership advice with no concrete decision substance.

## Required Output

Six sections, in order, each clearly headed (`§1`..`§6`). `§7` optional (overflow only).

### §1 LENS DEFINITION — 200-400 words
What is the risk-officer lens? What does it explicitly evaluate? What does it NOT evaluate (where it ABSTAINS)? What separates a great application of this lens from a mediocre one? What kind of decision benefits MOST from this lens being applied rigorously?

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
Failure modes the OTHER six BOARD seats systematically miss but risk-officer should catch. Per mode:
- Name: `<short>`
  Pattern: `<what consistently happens>`
  Why other lenses miss it: `<one sentence>`
  Cost when it lands: `<concrete impact>`
  risk-officer's catch: `<what risk-officer sees that surfaces it>`

### §5 HARD-STOP TRIGGERS — 4-8 triggers
Conditions under which risk-officer MUST emit `HARD-STOP: must be human` regardless of vote math. Per trigger:
- Trigger: `<concrete condition>`
  Why human-required: `<one sentence>`
  Cited precedent: `<real case where escalation was correct>`

### §6 NAMED EVIDENCE LIBRARY — 10-20 cases
Real, cited cases this lens can reference for rationale. Per case:
- Case: `<company / project — short label>`
  Decision: `<what was decided>`
  Outcome: `<what happened>`
  Lesson: `<what this teaches the risk-officer lens>`
  Source: `<link>`

NO PERSONAS. NO CELEBRITY IMPERSONATION. Cases are *cited evidence the agent reasons about*, not identities the agent assumes.

### §7 ADDITIONAL — optional, only if §2 hits the 15 cap
Same format as §2. Distiller may discard.

## Source Quality
1. **PRACTITIONER** — SRE / platform / architecture leadership essays, incident post-mortems with named cases, migration and vendor-lock-in retrospectives, conference talks walking through real technical-risk decisions (Charity Majors, Cindy Sridharan, SRE Book authors, etc.).
2. **CASE_STUDY** — documented company-decision retrospectives (AWS post-mortems, Cloudflare blog, Stripe Press, GitLab/Gitpod migration retrospectives, database-migration and vendor-lock-in write-ups).
3. **OFFICIAL** — methodology canonical sources (reliability, migration-safety, schema-evolution frameworks) where relevant.
4. **BOOK** — books authored by people who have done technical-risk / reliability evaluation at credible scale.

## Recency
Prefer ≤3 years for tech-adjacent content. Default last 5 years otherwise.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§6` (and `§7` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
