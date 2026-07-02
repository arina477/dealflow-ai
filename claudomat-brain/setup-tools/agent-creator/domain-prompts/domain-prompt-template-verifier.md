<!-- Replace all {{...}} placeholders before sending to Gemini Deep Research. -->

# Research Brief — Verifier Sub-Agent: {{VERIFIER_NAME}}

You are a research analyst preparing a knowledge brief for a Claude sub-agent that will VERIFY {{VERIFICATION_DOMAIN}} in an autonomous SDLC pipeline. The agent does NOT build; it gates (output: `PASS | REWORK | ESCALATE` + reasons). Output is consumed by an automated distillation pass that extracts five fixed sections. Sections missing from your output will fail distillation.

## Project Context
- Backend: {{backend}}
- Database: {{database}}
- Frontend: {{frontend}}
- Deploy: {{deploy_platform}}
- Scale: {{scale}}
- SDKs: {{sdk_list}}
- Product: {{product_description}}

## Domain
Verifier: **{{VERIFIER_NAME}}**
Verifies: **{{VERIFICATION_DOMAIN}}**
Sits at: **{{stage_or_block}}**

{{domain_description}}

## Role Focus
Weight research toward: production verification heuristics from people who have shipped and investigated post-mortems; false-positive AND false-negative patterns; independent-evidence techniques (cross-checking, source-of-truth comparison); adversarial framings that resist being gamed.

De-prioritize: construction patterns; persona/leadership content; generic QA process methodology.

## Required Output

Five sections, in order, each clearly headed (`§1`..`§5`). `§6` optional (overflow only).

### §1 VERIFICATION DOCTRINE — 200-400 words
What separates "verified" from "claimed" in {{VERIFICATION_DOMAIN}}? What counts as evidence; what doesn't? What's the verifier's stance toward the artifact's author (adversarial / independent)? What does this verifier explicitly NOT verify (where do other gates pick up)?

### §2 VERIFICATION HEURISTICS (always-check) — 12-25 checks; HARD CAP 25
Per check:
- `<Single-sentence check the verifier always performs.>`
  Why: `<Single-sentence — concrete defect class this catches.>`
  Source: `<link>`

Each check must be operationally executable on artifacts the verifier can access (deployed code, logs, deploy hash, spec doc, test output). Vibe checks rejected.

`[STABLE]` marker (mandatory): for checks sourced from material >5 years old that describe verification fundamentals which have not changed (e.g., comparing build SHAs to deployed bundles, parsing query plans, reading session logs), prefix the check with `[STABLE] ` (with the trailing space).

### §3 FALSE-POSITIVE PATTERNS — 8-15 patterns
Claims/artifacts that LOOK right but aren't.
Per pattern:
- Name: `<short>`
  Looks-like: `<what makes it appear correct on surface>`
  Actually-is: `<what's actually wrong underneath>`
  Independent-evidence test: `<the check that disambiguates>`

### §4 FALSE-NEGATIVE PATTERNS — 8-15 patterns
Real defects that LOOK acceptable.
Per pattern:
- Name: `<short>`
  Surface signal: `<why the surface looks fine>`
  Underlying defect: `<what's actually broken>`
  Discriminator: `<the check that exposes it>`

### §5 AUTHORITATIVE REFERENCES — 10-20 sources
Tag each: `[PRACTITIONER]` | `[BOOK]` | `[OFFICIAL]` | `[VENDOR]`
Format: `[TAG] <link or title> — <what this covers>`
Exclude: SEO content, content farms, AI summaries, sources >5 years old for fast-moving domains.

### §6 ADDITIONAL — optional, only if §2 hits the 25 cap
Same format as §2. Distiller may discard.

## Source Quality
Practitioner content from people who have actually investigated post-mortems and written disambiguators is the highest-value signal. Prioritize:
1. **PRACTITIONER** — SRE essays and post-mortem corpora (Google SRE Book public chapters, public incident write-ups), QA-leadership writing, security-research disclosure write-ups, audit-engagement retrospectives.
2. **BOOK** — books authored by people whose job has been verification (Google SRE Book; "Software Engineering at Google"; Charity Majors / Cindy Sridharan on observability; James Bach / Michael Bolton on Rapid Software Testing).
3. **OFFICIAL** — verification-tool documentation relevant to this verifier (Postgres `EXPLAIN`, Playwright assertions, OpenTelemetry semantic conventions).
4. **VENDOR** — spec-level RFCs of what a "correct" outcome looks like.

## Recency
Default last 3 years. Older sources allowed only when the check they support is marked `[STABLE]`.

## Length
6,000-12,000 words total.

## Deliverable
Single markdown document, headed `§1`..`§5` (and `§6` if used), formatted exactly as specified. No preamble, no closing summary, no human-facing commentary — consumed by an automated pass.
