# Stage v2 — Competitive Scan: 360° Agent-Ranked Tier 1/2/3

## Purpose
Produce the baseline competitive intelligence that v3 features, v7 design direction, v10 milestone framing, and the long-term wave loop (P-0 Frame, refresh ritual) all read from. Agent-ranked tiers prevent flat-list benchmarking that over-weights minor competitors.

## Prerequisites
- v1 complete (Vision + target user known — scopes the competitor set).
- READ `claudomat-brain/rules/sub-agent-invocation.md`.
- READ `command-center/AGENTS.md` for `competitive-analyst` agent card.
- READ `claudomat-brain/management/default-mode.md` § Competitive intelligence pre-decision benchmark — Playwright live-browsing mandate; WebSearch-only is insufficient (help articles describe intended behavior, not actual UX).

## Actions

### 1. Build candidate list — options-and-custom

Sources the orchestrator consults autonomously:

- v0 docs — competitors the founder named.
- v1 extracted differentiation notes — competitors implied by the wedge.
- WebSearch — additional candidates in the product category.

Inclusion criteria:

- Direct competitor (same user category).
- Substitute / adjacent (target user also uses).
- Market leader (even if pricing/positioning differs).
- Fast-growing challenger (even if sub-scale today).

Build a draft candidate list (5–10). Fire `AskUserQuestion`:

> "I drafted a candidate list of <N> competitors for the competitive scan. Pick how to proceed:"
>
> 1. **Approve as-is** — scan all <N>: <list names>.
> 2. **Approve subset** — I'll show you the list; you pick which to scan.
> 3. **Add to list** — your candidates plus mine. Tell me who to add.
> 4. **Replace list** — you provide the names; I'll discard mine.
> 5. **Skip the scan** — truly category-creating product with no priors. INDEX.md still written documenting the skip rationale.
> 6. **Custom** — tell me how to source the candidate list.

<5 candidates after founder review = market research too shallow; loop back with WebSearch expansion. >10 = ask founder to prune.

### 2. Spawn `competitive-analyst` — live browsing, parallel

Spawn `Agent(subagent_type=competitive-analyst)` with the approved candidate list. Per `claudomat-brain/management/default-mode.md`, the agent uses Playwright live browsing (dedicated MCP instance per competitor) — NOT WebSearch-only.

For >5 candidates, spawn multiple agents in parallel, one per Playwright instance (`playwright-3` through `playwright-10` — verify presence in `process/session/.capability-sheet.md` § MCP servers first).

Per-agent prompt MUST include:

```
## CRITICAL RULES
1. You MUST navigate to the live competitor site before reporting.
2. You MUST take screenshots as evidence for each material finding.
3. Document what requires auth (signup wall, checkout gate) — note "requires auth — could not verify past this point".
4. Do NOT invent UX behaviors you haven't directly observed.
5. Output EVIDENCE_QUALITY per finding: DIRECT_OBSERVATION | HELP_ARTICLE | MARKET_RESEARCH | COULD_NOT_VERIFY.

## OUTPUT FORMAT per competitor
### <Competitor name>
**URL:** <primary URL>
**Category overlap with us:** <high / medium / low + 1 sentence>
**Business model:** <how they make money>
**Key UX patterns worth noting:** <3-5 observations with screenshots>
**Pricing structure:** <if observable>
**Strengths / differentiators:** <what they're good at>
**Weaknesses / gaps:** <where we could win>
**Evidence screenshots:** <local paths>

## TIER RANKING
Rank ALL competitors you scanned into:
- **Tier 1 — Primary benchmark** (direct competitor, must-match-or-beat on core surfaces)
- **Tier 2 — Secondary / informative** (adjacent, worth studying for patterns but not feature-for-feature parity)
- **Tier 3 — Context only** (distant but useful for category education)

Justify each ranking in one sentence.
```

### 3. Write per-competitor files

Each competitor gets:

```
command-center/artifacts/competitive-benchmarks/<competitor-kebab-case>.md
```

Format follows the per-competitor output block from step 2: metadata + screenshot paths + tier ranking + first-seen timestamp + evidence quality.

### 4. Write INDEX.md

Populate `command-center/artifacts/competitive-benchmarks/INDEX.md`:

```markdown
# Competitive Benchmarks Index

Per-feature competitor evidence files live in this directory as `<kebab-case>.md`. Files persist across conversations so the same question is never re-researched.

Written by:
- v2 (this stage) — initial population of the competitor set
- `competitive-analyst` during P-0 Frame (per-wave deepening)
- `claudomat-brain/ROADMAP/roadmap-refresh-ritual.md` Step 1a (refresh)

Freshness: benchmarks older than 60 days should be re-verified at the next refresh ritual.

---

## Tier ranking (<YYYY-MM-DD>, v2 onboarding scan)

### Tier 1 — Primary benchmark (match-or-beat)
- `<competitor-1>.md` — <one-line rationale>
- `<competitor-2>.md` — <one-line rationale>

### Tier 2 — Secondary / informative
- `<competitor-3>.md` — <one-line rationale>

### Tier 3 — Context only
- `<competitor-4>.md` — <one-line rationale>

---

## Freshness log

| Competitor | Last scan | Evidence quality |
|---|---|---|
| <competitor-1> | <YYYY-MM-DD> | DIRECT_OBSERVATION |
| ... |
```

If step 1 selected **Skip the scan**, INDEX.md still writes — with a `## Skip rationale` section explaining why and what alternate signals (founder intuition, primary research) the project will rely on.

### 5. Cross-reference into `founder_bets`

If any v1 bet's "why I believe" prose section cites a competitive observation, UPDATE the bet's `description` (append a `## Competitive evidence` section referencing the relevant competitor file path). Keeps the bet auditable.

```sql
UPDATE founder_bets
SET description = description || E'\n\n## Competitive evidence\n- <competitor-name>: command-center/artifacts/competitive-benchmarks/<competitor-kebab-case>.md'
WHERE id = '<bet-id>';
```

(Idempotency: if the bet's `description` already contains a `## Competitive evidence` section, append a bullet under the existing heading instead of writing a duplicate heading. The brain never parses `key: value` lines from `description` — `## Section` prose is the only convention per `claudomat-brain/db/SCHEMA.md` § top notes on the description-bucket purge.)

## Deliverable

- `command-center/artifacts/competitive-benchmarks/<competitor-kebab-case>.md` × 5–10 files (or 0 + skip rationale).
- `command-center/artifacts/competitive-benchmarks/INDEX.md` — populated with tier ranking + freshness log (or skip rationale).
- (If applicable) `founder_bets` rows updated with appended `## Competitive evidence` prose section (per `claudomat-brain/db/SCHEMA.md` § founder_bets) cross-referencing competitor files.

## Exit criteria

- ≥5 competitors researched with `DIRECT_OBSERVATION` evidence for Tier 1 entries (Tier 2/3 may have weaker evidence). Or: skip option taken with rationale.
- Every Tier 1 competitor has ≥3 screenshots / Playwright captures in evidence.
- INDEX.md tier ranking is complete and coherent (no competitor left un-tiered).
- No unresolved `COULD_NOT_VERIFY` blockers in Tier 1 — auth-walled flows note "requires auth" but do not block the stage.

## Next

→ Return to `../onboarding-loop.md` → Stage v3 (product-scope).
