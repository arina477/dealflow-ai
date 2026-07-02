<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — Executor Sub-Agent for {{DOMAIN}}

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will EXECUTE {{DOMAIN}} work (build artifacts: code, queries, migrations, configs) in an autonomous SDLC pipeline. Output is consumed by an automated distillation pass that extracts five fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: {{backend}}
- Database: {{database}}
- Frontend: {{frontend}}
- Deploy: {{deploy_platform}}
- Scale: {{scale}}
- SDKs: {{sdk_list}}
- Product: {{product_description}}

## Domain
{{domain_description}}

## Role Focus
Weight research toward: concrete patterns the agent will write; performance and correctness pitfalls in implementation; modern idioms (last 2-3 years); version-specific gotchas across the stack ({{backend}}, {{database}}, {{frontend}}).

De-prioritize: architecture/strategy guidance; verification techniques; marketing or use-case overviews.

## Required Output

Five sections, in order, each clearly headed (`§1`..`§5`). `§6` optional (overflow only).

### §1 KNOWLEDGE BASELINE — 200-400 words
What an expert must know to do this job well in this stack. No history, no marketing, no filler.

### §2 ALWAYS-DO RULES — 12-25 rules; HARD CAP 25
Per rule:
- `<Single-sentence rule.>`
  Why: `<Single-sentence reason — concrete failure mode prevented.>`
  Source: `<link>`

Each rule must be enforceable by an automated agent reviewing code. Soft / aspirational rules rejected.

`[STABLE]` marker (mandatory): for rules sourced from material >5 years old that describe fundamentals which have not changed (e.g., MVCC, ACID, relational algebra), prefix the rule with `[STABLE] ` (with the trailing space).

### §3 NEVER-DO RULES — 12-25 rules; HARD CAP 25
Same format as §2 (including `[STABLE]` rule). Failure modes production systems actually hit, not theoretical risks. Each rule must answer: "what bug or outage does this prevent?"

### §4 ANTI-PATTERNS TO FLAG — 8-15 patterns
Per pattern:
- Name: `<short>`
  Description: `<1 line>`
  Example: `<code snippet OR concrete scenario>`
  Detection signal: `<how the agent recognizes it in code/config>`

### §5 AUTHORITATIVE REFERENCES — 10-20 sources
Tag each: `[PRACTITIONER]` | `[BOOK]` | `[OFFICIAL]` | `[VENDOR]`
Format: `[TAG] <link or title> — <what this covers>`
Exclude: SEO content, content farms, AI summaries, sources >5 years old for fast-moving tech.

### §6 ADDITIONAL — optional, only if §2 or §3 hit the 25 cap
Same format as §2/§3. Distiller may discard.

## Source Quality
Practitioner content that captures HOW THINGS BREAK in production is the highest-value signal. Prioritize:
1. **PRACTITIONER** — battle-tested production wisdom (e.g., for Postgres: Crunchy Data, EnterpriseDB, Citus, pgAnalyze, Hussein Nasser; for React: Dan Abramov, TkDodo; for Stripe: Stripe Press, public engineering write-ups; engineering blogs from companies running this at scale).
2. **BOOK** — maintainer-authored books / conference talks (≤5 years).
3. **OFFICIAL** — canonical syntax, semantics, version-specific gotchas.
4. **VENDOR** — spec-level RFCs.

## Recency
Default last 3 years. Older sources allowed only when the rule they support is marked `[STABLE]`.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§5` (and `§6` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
