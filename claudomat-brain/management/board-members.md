# BOARD Members

7 specialists that form the decision body. Fresh contexts, parallel spawn, no cross-talk until votes land. Composition is fixed (no per-decision reshuffle); thresholds and tie-breaks live in `conflict-resolution.md`.

Each card is **project-bespoke** — generated at `claudomat init` via `claudomat-brain/setup-tools/agent-creator/` with the project's domain context, failure-mode library, and reading-list paths baked in. Cards land at `~/.claude/agents/<member>.md`. The brain ships role definitions; agent-creator renders project-tuned versions.

## Composition

| Member | Lens | Card |
|---|---|---|
| **strategist** | Bet alignment, direction, strategic position | `~/.claude/agents/strategist.md` |
| **industry-expert** | Prior art + pattern library across tech, product, and organizational patterns the project's industry has converged on | `~/.claude/agents/industry-expert.md` |
| **realist** | Evidence, data, assumed-unverified claims, "show the proof" | `~/.claude/agents/realist.md` |
| **user-advocate** | User-experienced impact: in-product UX + retention + trust + brand signal | `~/.claude/agents/user-advocate.md` |
| **risk-officer** | Tech-risk only — failure modes, escape routes, operational stability, performance/scale, vendor + architectural lock-in, schema/migration risk | `~/.claude/agents/risk-officer.md` |
| **counter-thinker** | Steel-manned alternatives, inversion, "what's the smartest opposing case?" | `~/.claude/agents/counter-thinker.md` |
| **founder-proxy** | Founder voice via product-decisions.md + founder_bets | `~/.claude/agents/founder-proxy.md` |

All members must be present in `command-center/AGENTS.md`. Any missing → BOARD cannot convene; route through `claudomat-brain/setup-tools/agent-creator/agent-creator.md` to install before retrying.

## Reading list per member

Each card embeds its reading list at generation time. The lists below are the **canonical seed**; bespoke generation extends each with project-tuned paths and pattern libraries.

### strategist
- `founder_bets` table (via `Bet — list live` recipe in `claudomat-brain/db/SCHEMA.md`)
- `command-center/product/product-decisions.md`
- `milestones` table (via `Milestone — list todo` + `SELECT … WHERE status='in_progress'`)
- `command-center/principles/PRODUCT-PRINCIPLES.md`
- Decision context

### industry-expert
- Industry pattern library baked into the card body at install (tech patterns, product patterns, organizational patterns the industry has converged on)
- `command-center/artifacts/competitive-benchmarks/INDEX.md` + Tier 1 benchmark files
- `founder_bets` table — differentiation notes in the bet's `description` prose (`SELECT * FROM founder_bets WHERE status='live'`)
- Decision context

### realist
- Project metrics surface (analytics dashboards, success-criteria docs)
- Last 3 wave L-1 docs' "Plan-authoring defects" + "Reality-check findings"
- `command-center/product/product-decisions.md` for prior-assumption tracking
- Decision context

### user-advocate
- `command-center/artifacts/user-journey-map.md`
- Relevant `command-center/product/per-page-pd/<page>.md` files (if present)
- `design/DESIGN-SYSTEM.md` + relevant mockups
- Trust + retention signals (churn dashboards, support tickets, user-research notes if present)
- Decision context

### risk-officer
- Project's architecture docs (root README + any `command-center/dev/architecture/` material)
- `command-center/principles/BUILD-PRINCIPLES.md`
- `claudomat-brain/rules/external-sdk-integration-rules.md` (vendor lock-in registry)
- Last 3 wave L-1 docs' "Plan-authoring defects" + L-2 distilled tech-risk lessons
- Relevant module/code paths per decision topic
- Decision context

### counter-thinker
- Inversion / steel-man pattern library baked into the card body at install
- `command-center/product/product-decisions.md` for "what we already considered and rejected" prior art
- Last 3 wave L-2 distillations for known dogmatic patterns
- Decision context

### founder-proxy
- Last 10 entries in `command-center/product/product-decisions.md` + full-text search for the decision topic
- `founder_bets` table (via `Bet — list live` recipe in `claudomat-brain/db/SCHEMA.md`); retired bets via `WHERE status='retired'`
- Decision context

## Spawn protocol (orchestrator)

1. Identify decision class:
   - Tier 3 product decision (P-0)
   - Scope conflict / RECONSIDER / monolith (P-0 / P-1)
   - Design-gap 3-cap (D-2 / D-3)
   - Tech-product-impact (schema-breaking migration, breaking API change, third-party SDK adoption, model/cost step-change, data retention / PII change, OSS release / license commit)
   - Cross-block decision (single decision spans multiple blocks)
   - Head-ESCALATE under autonomous (head-X gate emits `ESCALATE`)
   - V-3 fast-fix retry-cap exhaustion
   - daily-checkpoint resolution

2. Construct decision packet: decision-slug (kebab case), question/framing, context files, options or "open question" framing, escalation source.

3. Per member, build a spawn prompt:
   - Invoke via `Agent` tool with `subagent_type` matching the agent-card name.
   - The card already embeds the reading list; refresh project-state file pointers in the spawn prompt.
   - Append the decision packet.
   - Output contract: `APPROVE` / `REJECT` / `ABSTAIN` + rationale + hard-stop flag if any.

4. Spawn all 7 in parallel, single message.

5. Collect votes. Apply `conflict-resolution.md` voting rules.

6. Write `process/waves/wave-<N>/escalations/board-<decision-slug>.md` with 7 votes + consolidated decision + dissent notes.

## Vote output format (per member)

```markdown
# BOARD vote — <member-name> — <decision-slug>

## Vote
[APPROVE <option-A> | REJECT | ABSTAIN]

## Rationale (≤150 words)
<Grounded in reading list + decision context. Cite evidence paths.>

## Hard-stop?
[none | "HARD-STOP: must be human — <concrete reason>"]

## Dissent note (only if APPROVE with concerns)
<One-line caveat>
```

## founder-proxy — special role

The founder's seat. Full-text-searches `command-center/product/product-decisions.md` (last 10 entries + topic search) and cross-references live + retired `founder_bets` rows, then simulates the founder's likely call from that documented evidence.

If neither product-decisions nor founder_bets yields applicable precedent: founder-proxy MUST emit `HARD-STOP: must be human — no founder precedent in product-decisions or founder_bets` rather than guess. Circuit breaker for genuinely novel calls.
