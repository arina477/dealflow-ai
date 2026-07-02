<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — Head Sub-Agent: {{HEAD_NAME}} ({{PERSONA}})

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will GATE the **{{BLOCK}}** block of an autonomous SDLC pipeline, acting as a **{{PERSONA}}**. The agent owns {{BLOCK_STAGES}} and signs off each stage's exit. Lifecycle: {{LIFECYCLE}}. The agent does NOT write production code or build artifacts directly — it gates (`PASS | REWORK | ESCALATE`), coordinates specialists, and at end-of-life authors a block-scoped principles file.

Output is consumed by an automated distillation pass that extracts five fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: {{backend}}
- Database: {{database}}
- Frontend: {{frontend}}
- Deploy: {{deploy_platform}}
- Scale: {{scale}}
- SDKs: {{sdk_list}}
- Product: {{product_description}}

## Domain
Head: **{{HEAD_NAME}}**
Persona: **{{PERSONA}}**
Block: **{{BLOCK}}**, stages **{{BLOCK_STAGES}}**
Lifecycle: **{{LIFECYCLE}}**

{{domain_description}}

## Role Focus
Weight research toward: {{PERSONA}} heuristics — how a senior person in this role catches "almost right but subtly bad" work that generalists miss; block-level failure modes specific to {{BLOCK}}; stage-by-stage decision points where this role earns its keep; delegation patterns (when to consult which specialist, how to phrase the consultation, how to evaluate the response).

De-prioritize: construction techniques in detail (specialists do that); verification methodology in detail (verifier territory; head READS verifier output, doesn't run checks); generic management content with no decision substance.

## Required Output

Five sections, in order, each clearly headed (`§1`..`§5`). `§6` optional (overflow only).

### §1 PERSONA DEFINITION — 200-400 words
Who is a great {{PERSONA}} owning {{BLOCK}}? What do they explicitly own? What do they explicitly NOT own (where do they delegate)? What separates a great one from a mediocre one? What gets them fired (the failure mode that ends careers)?

### §2 STAGE-EXIT HEURISTICS — 12-25 heuristics; HARD CAP 25
Per heuristic:
- `<At <stage> exit, check: <single-sentence check>>`
  Why: `<Single-sentence — concrete failure mode caught.>`
  Source: `<link>`

Each heuristic must produce a binary signal (PASS-able or not). Vibe-only heuristics rejected.

`[STABLE]` marker (mandatory): for heuristics sourced from material >5 years old describing enduring leadership/review patterns (e.g., "the author should not be the only reviewer", "a stage with no observable output is not a stage"), prefix with `[STABLE] ` (with the trailing space).

### §3 BLOCK-LEVEL FAILURE MODES — 8-15 modes
What consistently goes wrong in {{BLOCK}} when run by less-senior people?
Per mode:
- Name: `<short>`
  Pattern: `<what consistently happens>`
  Cost: `<what it costs the team / product>`
  Head's prevention: `<what {{PERSONA}} does to prevent it>`

### §4 DELEGATION PATTERNS — 8-15 patterns
When does {{PERSONA}} call in a specialist, and how do they evaluate the response?
Per pattern:
- Trigger: `<surface signal that calls for delegation>`
  To whom: `<specialist class — e.g., postgres-pro, security-auditor>`
  What to ask: `<how to phrase the consultation>`
  How to evaluate response: `<signal of good vs bad specialist output>`

### §5 AUTHORITATIVE REFERENCES — 10-20 sources
Tag each: `[PRACTITIONER]` | `[BOOK]` | `[OFFICIAL]` | `[VENDOR]`
Format: `[TAG] <link or title> — <what this covers>`
Exclude: SEO content, leadership-self-help fluff, AI summaries, sources >7 years old for tech-adjacent content.

### §6 ADDITIONAL — optional, only if §2 hits the 25 cap
Same format as §2. Distiller may discard.

## Source Quality
Practitioner-leaning content authored by people who have actually held the {{PERSONA}} role at credible scale is the highest-value signal. Prioritize:
1. **PRACTITIONER** — engineering-leadership essays, post-mortems with leadership analysis, public retrospectives, conference talks walking through real decisions. Persona-specific examples:
   - Staff Engineer: Will Larson, Tanya Reilly, Camille Fournier; Patrick McKenzie's engineering essays.
   - VP Product: Marty Cagan / SVPG; Lenny Rachitsky; Shreyas Doshi; Ravi Mehta.
   - QA Lead: James Bach; Michael Bolton (Rapid Software Testing); Lisa Crispin.
   - Senior Designer: Julie Zhuo; Jared Spool; Pavel Samsonov.
   - Reality-check Engineer (SRE-shaped): Charity Majors; Cindy Sridharan; SRE Book authors.
2. **BOOK** — books authored by people who have done this role (≤7 years preferred for tech-adjacent content).
3. **OFFICIAL** — methodology canonical sources (Cagan's discovery framework; Beck/Fowler on engineering practices) when relevant to day-to-day decision points.
4. **VENDOR** — public engineering-process write-ups from companies known for excellence in this role (Stripe Press, Shopify Engineering, Discord Engineering, etc.).

## Recency
Default last 5 years (slightly looser than executor/verifier — leadership essays age more slowly than tech docs). Older sources allowed only when the heuristic they support is marked `[STABLE]`.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§5` (and `§6` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
