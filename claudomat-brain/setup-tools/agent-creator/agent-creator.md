# agent-creator — Sub-Agent Authoring Pipeline

**Purpose.** Generate a research-grounded Claude Code sub-agent card from scratch. Three stages, each with a hard gate: research → distill → synthesize-and-register. No curated agent packs ship with claudomat; every agent on a target project is generated locally so it's tailored to the project's stack, scale, and constitution.

**When it runs.**
- **Onboarding.** Once per `tag-template.yaml` active tag — bulk-author the project's full agent catalog. **At onboarding the BOARD bench is also generated** (7 members: `strategist`, `industry-expert`, `realist`, `user-advocate`, `risk-officer`, `counter-thinker`, `founder-proxy`). 6 go through the full pipeline; `founder-proxy` uses a fixed seed (skips Stage 1+2). See `claudomat-brain/management/board-members.md` for composition contract.
- **Mid-project.** When a retro signal at L-2 (or a founder request) adds a new tag to `tag-template.yaml`, agent-creator runs once for the new tag. BOARD members are not regenerated mid-project unless `--refresh` is invoked explicitly per member.
- **Refresh.** `claudomat sync` re-runs Stage 1+2 only (Stage 3 re-synthesizes from the new pack) when the research archive is older than `refresh_threshold` (default: 6 months) or the tag config has changed. `founder-proxy` cannot be refreshed via this path — its seed is brain-shipped and updated by `claudomat sync`.

**Who runs it.** A spawned `agent-creator` sub-agent or the orchestrator directly. Fully automatic — no founder gate per claudomat policy. Tightened generation rules + research-grounded packs compensate for the missing review gate.

---

## Stage sequence

```
Stage 1: Research → Stage 2: Distill → Stage 3: Synthesize & Register
```

| Stage | Responsibility | Halt-on-failure |
|---|---|---|
| **1** | Render brief from `domain-prompts/domain-prompt-template-<role_class>.md`, fire Gemini Deep Research, archive raw report | Yes — research is non-negotiable; no fallback to skeleton-only |
| **2** | Strip Gemini grounding artifacts, drop reference-only sections, validate caps, write distilled domain-pack | Yes — cap violation forces re-distill |
| **3** | Concatenate Tier 1 skeleton + Tier 2 pack into agent card, validate frontmatter, write to agent registry, register in `command-center/AGENTS.md` | Yes — schema validation failure rejects the card |

---

## Inputs

Required:
- `<tag>` — the agent's name (e.g., `head-product`, `postgres-pro`, `payment-integration`, `strategist`, `industry-expert`)
- `<role_class>` — one of `head` | `executor` | `verifier` | `board`
- Project context from `project.yaml` (auto-loaded): `stack.backend`, `stack.database` (includes version), `stack.frontend`, `stack.deploy_platform`, `description` (as `product_description`). The `{{scale}}` + `{{sdk_list}}` placeholders in `domain-prompts/domain-prompt-template-*.md` are populated from `command-center/dev/architecture/_library.md`: `{{sdk_list}}` from the `## SDKs` section; `{{scale}}` distilled from `## Stack` (mirrored from `stack-decisions.md`) + scale assumptions in `## Services` / `## DevOps`. If `_library.md` is absent (e.g., agent-creator fires before v6b completes), substitute the literal string `not-yet-architected` for both — **never render `{{scale}}` / `{{sdk_list}}` literally into an agent brief**. For `board` class, also: `stack.industry_domain`, `stack.compliance_regime`.

Required for `<role_class> == head`:
- `<persona>` — e.g., "VP Product / Staff Product Manager"
- `<block>` — e.g., "P-block (Product)"
- `<block_stages>` — e.g., "P-0 Frame → P-1 Decompose → ... → P-4 Gate"
- `<lifecycle>` — e.g., "persistent across the P-block only — spawned at P-0 entry, dies at P-4 exit"
- `<domain_description>` — 1-3 paragraphs framing the role's specific failure modes (consumed verbatim by the brief)
- `<role_focus>` — 1 paragraph on what to weight up vs. de-prioritize (e.g., "Weight toward Staff-PM heuristics … de-prioritize technical architecture detail")
- `<specialist_roster>` — comma-separated list of specialist agents this head can invoke at gate-time (e.g., `problem-framer, ceo-reviewer, business-analyst, architect-reviewer, Karen, jenny, gemini, task-completion-validator, product-manager`)
- `<block_principles_file>` — name of the block's principles file (e.g., `PRODUCT-PRINCIPLES.md`, `DESIGN-PRINCIPLES.md`)
- `<block_state_fields>` — comma-separated list of cross-stage block-scoped state fields (e.g., `claimed_task_ids, design_gap_flag, fast_path, escalation_log, reviewer_verdicts`)
- `<next_block_handoff>` — block to hand off to on `APPROVED` (e.g., `D-block` if `design_gap_flag: true`, `B-block` otherwise)
- `<escalation_target>` — who receives `ESCALATE` verdicts (e.g., `founder`, `ceo-agent`)

Required for `<role_class> == executor`:
- `<tech_surface>` — e.g., "PostgreSQL 15+ tuning, replication, and HA"
- `<sdk_or_api>` — if applicable (e.g., "Stripe SDK v15", "AWS SDK v3")
- `<specialist_roster>` — comma-separated list of agents this executor commonly collaborates with (e.g., `database-optimizer, data-engineer, security-auditor`)

Required for `<role_class> == verifier`:
- `<verification_target>` — e.g., "load-bearing claims in plan files (paths, signatures)"
- `<verdict_shape>` — e.g., "binary APPROVE | REJECT with line-by-line failure list"
- `<specialist_roster>` — comma-separated list of agents to consult during cross-verification (e.g., `task-completion-validator, code-quality-pragmatist`)
- `<consultation_sequence>` — ordered consultation steps (e.g., "1. @task-completion-validator, 2. @code-quality-pragmatist") — defaults to roster-in-order if omitted
- `<severity_rating_scheme>` — defaults to `Critical | High | Medium | Low`
- `<verdict_template>` — Markdown block specifying the exact emit shape; see karen.md for canonical example

Required for `<role_class> == board`:
- `<tag>` must be one of the 7 fixed BOARD member names: `strategist` | `industry-expert` | `realist` | `user-advocate` | `risk-officer` | `counter-thinker` | `founder-proxy`. Composition is fixed per `claudomat-brain/management/board-members.md`; agent-creator does NOT generate arbitrary BOARD members.
- `<role_lens_oneliner>` — one-line lens definition (lifted from `board-members.md` § Composition table). E.g., for `strategist`: `"Bet alignment, direction, strategic position"`.
- `<role_description_paragraph>` — 1-2 paragraphs (lifted from `board-members.md` and the role's spec) framing the lens's specific evaluation surface — consumed verbatim by the brief as `{{ROLE_DESCRIPTION_PARAGRAPH}}`.
- `<reading_list_base>` — the canonical reading-list seed paths from `board-members.md § Reading list per member` for this role. Substitutes `{{READING_LIST}}` in the skeleton.
- **`founder-proxy` carve-out:** when `<tag> == founder-proxy`, the only inputs needed are `<role_lens_oneliner>` and `<reading_list_base>`. Stages 1+2 are skipped — see § Stage 1 founder-proxy carve-out.

Optional flags:
- `--refresh` — bypass the "archive exists" short-circuit and regenerate
- `--dry-run` — render brief and stop (no Gemini call, no card written)
- `--keep-sources` — skip the `Source:` strip in Stage 2 (default: strip)

Environment:
- `GEMINI_API_KEY` — verified at Stage 1 entry; halt if missing.

---

## Stage 1 — Research

### founder-proxy carve-out (board class only)

When `<role_class> == board` AND `<tag> == founder-proxy`:

1. Read `claudomat-brain/setup-tools/agent-creator/founder-proxy-seed.md` (ships pre-filled with §1 LENS DEFINITION + §2 EVALUATION DIMENSIONS + §3 DOMAIN PATTERNS + §4 FAILURE MODES + §5 HARD-STOP TRIGGERS + §6 NAMED EVIDENCE LIBRARY).
2. Copy verbatim to `command-center/domain-packs/founder-proxy.md` (the seed is already distilled — no Stage 2 pass needed).
3. Skip directly to Stage 3 with `<pack_path> = command-center/domain-packs/founder-proxy.md`.

Rationale: `founder-proxy`'s domain layer is "read product-decisions.md + founder_bets", not industry research. No Gemini call needed.

### Prerequisites
- Inputs validated (Stage 0).
- `GEMINI_API_KEY` set (`echo $GEMINI_API_KEY` non-empty).
- `gemini-deep-research` host skill available (`/gemini-deep-research --help` resolves).
- Existing archive check: if `command-center/setup-tools/agent-creator/research/<tag>-*.md` exists and `--refresh` is not set → short-circuit to Stage 2 using newest archive.

### Actions

**1. Load template.**
Read `claudomat-brain/setup-tools/agent-creator/domain-prompts/domain-prompt-template-<role_class>.md`. Halt if missing.

**2. Render brief.**
Substitute every `{{...}}` placeholder with the input value. Required placeholders depend on role class (see Inputs above). Halt if any required placeholder is unsubstituted.

Save rendered brief to `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>-brief.md`.

**3. Fire Gemini Deep Research.**
Invoke the `gemini-deep-research` host skill in **fast** mode (asynchronous background job, a few minutes):

```
/gemini-deep-research --mode=fast --brief=<rendered-brief-path> --output=<archive-path>
```

Where `<archive-path>` = `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>.md`.

**Mode = `fast` (cost-bounded default).** `fast` (`deep-research-preview`, ~80 grounded search queries) researches the role at a fraction of the cost of `deep`/Max (`deep-research-max-preview`, ~160 queries, up to 60 min). The generated agents are still research-grounded — they just don't carry Max-depth due-diligence, which the generic roles (the block Heads + BOARD) never needed; re-running Max from scratch per project was the main onboarding cost driver. Max is now opt-in everywhere (explicit `--max`) — reserve it for a bespoke executor that genuinely needs exhaustive vendor/SDK due-diligence.

Block on completion (or poll if backgrounded). Gemini API failure → halt the entire pipeline (research is non-negotiable, no fallback).

**4. Validate raw report.**
- File exists and non-empty.
- Contains `§1`, `§2`, `§3`, `§4` section headers (`§5`/`§6` optional).
- Total length 6,000–12,000 words (warn if outside range; do not halt).

### Deliverable
- `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>-brief.md` — rendered brief, retained for audit.
- `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>.md` — raw Gemini report, never overwritten on subsequent runs (each refresh creates a new dated file; old reports retained for diff).

### Exit criteria
- Validation passed.
- Both brief and report archived.

---

## Stage 2 — Distill

### Prerequisites
- Stage 1 archive exists and validated.
- Tier 2 cap rules in effect: target ≤500 lines, hard cap ≤800 lines.

### Actions

**1. Strip Gemini grounding artifacts.**
- Remove all `[cite: N]`, `[cite: N, M, ...]` patterns (regex: `\s*\[cite:\s*[\d,\s]+\]`).
- Remove bare `[N]`, `[N][M]`, `[N][M][O]` chains where the bracket-number is NOT followed by `(` (regex: `(?:\[\d+\])+(?!\()`).
- Collapse double-spaces introduced by stripping.

**2. Strip per-heuristic `Source:` lines.**
Agent card consumes heuristics as gating rules, not citations. Drop every line matching `^\s*Source:\s*\`<...>\``.

Skip this step only if `--keep-sources` is set.

**3. Drop the `§5 AUTHORITATIVE REFERENCES` section wholesale.**
Distillation target is the agent prompt, not a literature review. Strip everything from `§5` to `§6` (or EOF if no `§6`).

**4. Drop the trailing `**Sources:**` URL footer.**
Gemini emits a list of redirect URLs at the bottom of every report. Strip it.

**5. Validate structure.**

For `head` | `executor` | `verifier` classes:
- Section headers `§1`, `§2`, `§3`, `§4` present after strip.
- §1 word count ∈ [200, 400]. Warn if outside.
- §2 heuristic count ≤ 25 (hard cap from brief). Halt if over.
- §3 failure-mode count ≤ 15. Halt if over.
- §4 delegation-pattern count ≤ 15. Halt if over.

For `board` class (non-founder-proxy):
- Section headers `§1` LENS DEFINITION, `§2` EVALUATION DIMENSIONS, `§3` DOMAIN-SPECIFIC PATTERNS, `§4` FAILURE MODES THIS LENS CATCHES, `§5` HARD-STOP TRIGGERS, `§6` NAMED EVIDENCE LIBRARY present after strip.
- §1 word count ∈ [200, 400]. Warn if outside.
- §2 dimension count ≤ 15 (hard cap). Halt if over.
- §3 pattern count ∈ [8, 15]. Warn if outside.
- §4 failure-mode count ∈ [8, 15]. Warn if outside.
- §5 hard-stop trigger count ∈ [4, 8]. Warn if outside.
- §6 evidence-case count ∈ [10, 20]. Warn if outside.

**6. Quarantine fabricated sources (only if `--keep-sources` is set).**
Verify every `Source:` URL resolves. For each unreachable URL or URL whose host is suspicious (e.g., generic blogs, government meeting agendas, non-existent arxiv IDs), replace with `[QUARANTINED: <reason>]`. Otherwise no-op since sources were already stripped at action 2.

**7. Prepend cleanup-notes header.**
HTML comment block summarizing what was stripped, archive path, and section counts. Format:

```html
<!--
DISTILLATION NOTES (agent-creator Stage 2, applied <ISO-date>):
  1. Stripped [cite: N] artifacts and bare [N] chains.
  2. Stripped per-heuristic Source: lines.
  3. Removed §5 AUTHORITATIVE REFERENCES wholesale.
  4. Removed trailing **Sources:** URL footer.
  5. Final structure: §1 (~<N> words), §2 (<N> heuristics), §3 (<N> modes), §4 (<N> patterns).
  6. Source archive: <archive-path>
-->
```

**8. Write distilled pack.**
Write the cleaned content to `command-center/domain-packs/<tag>.md`. Verify line count ≤ 800 (hard cap). Overflow → halt with `RE-DISTILL` verdict; agent-creator must re-run Stage 2 with tighter compression rules (or escalate to founder).

### Deliverable
`command-center/domain-packs/<tag>.md` — distilled domain pack, ≤500 lines target, ≤800 hard cap.

### Exit criteria
- All artifacts stripped.
- Section caps satisfied.
- File written and within line-cap.

---

## Stage 3 — Synthesize & Register

### Prerequisites
- Stage 2 pack exists and validated.
- Tier 1 skeleton exists at `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-<role_class>.md`. Halt if missing — agent-creator does not derive the skeleton on the fly. Skeletons are a separate authoring concern (see *Tier 1 skeleton authoring* below).

### Actions

**1. Load Tier 1 skeleton.**
Read `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-<role_class>.md`. Skeleton has named insertion points (e.g., `{{KNOWLEDGE_BASELINE}}`, `{{STAGE_EXIT_CHECKLIST}}`, `{{ANTI_PATTERNS}}`, `{{DELEGATION_TABLE}}`).

**2. Map Tier 2 sections → Tier 1 insertion points.**

Body insertion points (sourced from the distilled pack):

For `head` | `executor` | `verifier` classes:

| Tier 2 source | Tier 1 insertion point | Treatment |
|---|---|---|
| §1 Persona Definition | `{{KNOWLEDGE_BASELINE}}` | Verbatim, lightly tightened to ≤3 paragraphs |
| §2 Stage-Exit Heuristics | `{{STAGE_EXIT_CHECKLIST}}` (head) / `{{ALWAYS_DO}}` (executor/verifier) | Reorganized by stage (head) or flat checklist (executor/verifier); strip the `Why:` subline; keep `[STABLE]` markers |
| §3 Block-Level Failure Modes | `{{ANTI_PATTERNS}}` | One-line-per-mode: `**<Name>** — <Pattern>. *Cost*: <Cost>. *Prevention*: <Head's prevention>.` |
| §4 Delegation Patterns | `{{DELEGATION_TABLE}}` | Markdown table with columns: # / Trigger / Specialist / What to ask / Good response signal |

For `board` class:

| Tier 2 source | Tier 1 insertion point | Treatment |
|---|---|---|
| §1 LENS DEFINITION (first sentence / one-liner) | `{{LENS_ONELINER}}` | Lifted from `<role_lens_oneliner>` input; if §1 carries a sharper one-line synthesis, prefer that |
| §1 LENS DEFINITION (body, 200-400 words) | `{{KNOWLEDGE_BASELINE}}` | Verbatim, lightly tightened to ≤3 paragraphs |
| §2 EVALUATION DIMENSIONS | `{{EVALUATION_DIMENSIONS}}` | Bullet list per dimension; keep `[STABLE]` markers; strip the `Source:` subline (per Stage 2 default) |
| §3 DOMAIN-SPECIFIC PATTERNS | `{{DOMAIN_PATTERNS}}` | Bullet list with Name + Pattern + When-it-applies + Cited example |
| §4 FAILURE MODES THIS LENS CATCHES | `{{FAILURE_MODES}}` | Bullet list with Name + Pattern + Why-other-lenses-miss + Cost + {{ROLE}}'s catch |
| §5 HARD-STOP TRIGGERS | `{{HARD_STOP_TRIGGERS}}` | Bullet list with Trigger + Why-human-required + Cited precedent |
| §6 NAMED EVIDENCE LIBRARY | `{{NAMED_EVIDENCE_LIBRARY}}` | Bullet list with Case + Decision + Outcome + Lesson |

Persona / context insertion points (sourced from the per-tag inputs declared in § Inputs):

| Insertion point | Role classes | Source |
|---|---|---|
| `{{NAME}}`, `{{DESCRIPTION}}`, `{{MODEL}}` | all | inputs + Stage 3 action 3 (description synthesized from §1) |
| `{{FRAMEWORK_VERSION}}`, `{{ISO_DATE}}`, `{{TAG}}`, `{{SKELETON_FILENAME}}@{{SKELETON_SHA}}`, `{{ARCHIVE_PATH}}`, `{{PACK_FILENAME}}@{{PACK_SHA}}` | all | computed at synthesis time |
| `{{PERSONA}}`, `{{BLOCK}}`, `{{BLOCK_STAGES}}`, `{{LIFECYCLE}}` | head | input |
| `{{BLOCK_PRINCIPLES_FILE}}`, `{{BLOCK_STATE_FIELDS}}`, `{{NEXT_BLOCK_HANDOFF}}`, `{{ESCALATION_TARGET}}` | head | input (see § Inputs — head extras below) |
| `{{TECH_SURFACE}}` | executor | input |
| `{{CONTEXT_QUERY_PAYLOAD}}`, `{{PROGRESS_METRICS_JSON}}`, `{{DELIVERY_NOTIFICATION_TEMPLATE}}` | executor | synthesized from §1 + tag context (small JSON snippets) |
| `{{VERIFICATION_TARGET}}`, `{{VERDICT_SHAPE}}` | verifier | input |
| `{{SEVERITY_RATING_SCHEME}}`, `{{VERDICT_TEMPLATE}}`, `{{CONSULTATION_SEQUENCE}}` | verifier | input (default to standard scheme `Critical | High | Medium | Low` if not provided) |
| `{{ROLE}}` | board | input `<tag>` (the BOARD member name) |
| `{{LENS_ONELINER}}` | board | input `<role_lens_oneliner>` |
| `{{READING_LIST}}` | board | input `<reading_list_base>` |
| `{{SPECIALIST_ROSTER}}` | all (head/executor/verifier only — board has no specialist roster) | input |
| `{{INTEGRATION_LIST}}` | all | bullet list — synthesized from §4 specialist mentions |
| `{{CLOSING_PRINCIPLE}}` | all | one-line closer — synthesized from §1 (the line about what gets the persona fired or what to prioritize) |

**3. Synthesize frontmatter.**

```yaml
---
name: <tag>
description: "<one-paragraph use-case description, ≤500 chars>"
model: opus
generated_by: agent-creator@<framework_version>
generated_at: <ISO-date>
triggered_by_tag: <tag>
template_version: <skeleton_filename>@<sha-of-skeleton>
research_archive: command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>.md
pack_version: <pack_filename>@<sha-of-pack>
---
```

**Frontmatter rules** (claudomat policy):
- **No `tools:` field.** Per project policy, every claudomat-authored sub-agent inherits the parent's full tool set. Do NOT whitelist or restrict.
- `model: opus` for `head`, `verifier`, and `board` classes; `model: sonnet` for `executor` unless the tag's `tag-template.yaml` entry overrides.
- Provenance fields are mandatory. Auditable.
- For `board` class: frontmatter additionally carries `role_class: board-member` (per `agent-skeletons/agent-prompt-template-board.md`). For `founder-proxy`, `pack_version` points at the brain-shipped seed (`founder-proxy-seed.md@<sha>`), and `research_archive` is omitted (no Gemini run produced an archive).

**4. Validate the assembled card.**
- YAML frontmatter parses cleanly.
- Every Tier 1 insertion point was substituted (no remaining `{{...}}`).
- Total line count ≤ 600 (soft target; warn if over).
- Self-test gate (per spec §3.1.1): the card's `description` clearly answers "when do I invoke this agent?" without ambiguity.

**5. Write agent card.**
Target path:
- Project-scoped (preferred): `~/.claude/agents/<tag>.md`
- Or, if the project uses local agents: `.claude/agents/<tag>.md`

Detect via presence of `.claude/agents/` in the project root; default to project-local if both exist.

**6. Register in `command-center/AGENTS.md`.**
AGENTS.md is a thin index for *finding* agents (humans + orchestrators), not an audit dump. Provenance lives in each card's frontmatter; AGENTS.md only carries what `/agents` doesn't surface.

Append (or update existing entry by tag) a row in the catalog table with this schema:

```markdown
| <tag> | <expertise> | <routing> | [research](command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>.md) · [pack](command-center/domain-packs/<tag>.md) |
```

Field rules:
- **`<tag>`** — must match the card filename and `name:` field exactly.
- **`<expertise>`** — one line, lifted from the card's `description` (≤120 chars). Trim to the capability, drop "Use this agent when..." preamble.
- **`<routing>`** — when/where to invoke:
  - `head` class → the block code: `P` | `D` | `B` | `C` | `T` | `V` | `L` | `N`
  - `executor` class → tag-class trigger phrase, e.g. `postgres tasks`, `stripe integration`, `react component work`
  - `verifier` class → stage anchor, e.g. `V-1 reality check`, `P-4 reviewer pool`
- **`<collateral>`** — exactly two markdown links separated by ` · `: research archive and distilled pack. No SHAs — those live in the card frontmatter.

If `command-center/AGENTS.md` doesn't exist, create from `templates/command-center/AGENTS.md` (template scaffold ships with claudomat).

**7. Verify host registration.**
Optional sanity check: shell out to `claude /agents` (or equivalent) and confirm the new agent appears in the host's registry. Warn (do not halt) on mismatch — host-side caching may delay visibility.

### Deliverable
- `~/.claude/agents/<tag>.md` (or `.claude/agents/<tag>.md`) — final agent card.
- Updated `command-center/AGENTS.md` row.

### Exit criteria
- Card written, frontmatter valid, all insertion points substituted.
- AGENTS.md updated.
- Self-test gate passed.

---

## Tier 1 skeleton authoring

The Tier 1 skeleton (`claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-<role_class>.md`) is **not authored by agent-creator**. It is a hand-curated template, derived once per role-class from the canonical exemplar in the existing agent catalog (per spec §3.1.3):

| Role class | Canonical exemplar | Skeleton path |
|---|---|---|
| `verifier` | `~/.claude/agents/karen.md` | `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-verifier.md` |
| `executor` | `~/.claude/agents/postgres-pro.md` | `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-executor.md` |
| `head` | `~/.claude/agents/payment-integration.md` | `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-head.md` |
| `board` | n/a (skeleton authored from `claudomat-brain/management/board-members.md` spec, not from a single exemplar — every BOARD member shares one skeleton) | `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-board.md` |

Authoring procedure (out-of-band, one-time per skeleton):
1. Copy the exemplar.
2. Replace domain-specific content with `{{INSERTION_POINT}}` placeholders matching the Stage 3 mapping table.
3. Strip the exemplar's frontmatter and replace with the `agent-creator` frontmatter template (above).
4. Commit to `claudomat-brain/setup-tools/agent-creator/agent-skeletons/`.

agent-creator halts at Stage 3 if the matching skeleton doesn't exist. Building skeletons is tracked separately in the roadmap.

---

## Failure modes & escalation

| Failure | Stage | Action |
|---|---|---|
| `GEMINI_API_KEY` missing | 1 | Halt; surface to founder. |
| Gemini API unreachable | 1 | Halt; do NOT fall back to skeleton-only. Resume on connectivity. |
| Brief placeholder unsubstituted | 1 | Halt; surface missing input. |
| Section header missing in raw report | 1 | Halt; offer `--refresh` to retry Gemini. |
| Section cap violation (e.g., §2 has 27 heuristics) | 2 | Halt with `RE-DISTILL`; tighten compression rules and re-run Stage 2. |
| Pack > 800 lines after distill | 2 | Halt with `RE-DISTILL`; same as above. |
| Tier 1 skeleton missing for role class | 3 | Halt; queue skeleton authoring as a separate ticket. |
| Frontmatter validation failure | 3 | Halt; reject card; log gap to `WAVE-<N>-OBSERVATIONS.md`. |
| Self-test gate fails (description ambiguous) | 3 | Halt; rewrite description; re-validate. |
| Host `/agents` doesn't see new card | 3 | Warn only; disk-written cards register only at session start — relaunch (`claude --continue` preserves context). No in-session reload exists for `~/.claude/agents/` cards. |

---

## Provenance & audit trail

Every run leaves three durable artifacts:

1. `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>-brief.md` — rendered brief.
2. `command-center/setup-tools/agent-creator/research/<tag>-<ISO-date>.md` — raw Gemini Deep Research report.
3. `command-center/domain-packs/<tag>.md` — distilled domain pack.

Plus the agent card itself with `research_archive` and `pack_version` SHAs in frontmatter. End-to-end traceable: a heuristic in a deployed agent can be traced back to the exact research paragraph it was distilled from.

---

## References (read on demand)

- **Brief templates** — `claudomat-brain/setup-tools/agent-creator/domain-prompts/domain-prompt-template-{verifier,executor,head,board}.md` (read at Stage 1).
- **Tier 1 skeletons** — `claudomat-brain/setup-tools/agent-creator/agent-skeletons/agent-prompt-template-{verifier,executor,head,board}.md` (read at Stage 3; out-of-band authored).
- **founder-proxy seed** — `claudomat-brain/setup-tools/agent-creator/founder-proxy-seed.md` (read at Stage 1 for the founder-proxy carve-out; bypasses Gemini Deep Research).
- **BOARD composition contract** — `claudomat-brain/management/board-members.md` (canonical 7-seat composition + per-role lens definitions + per-role reading-list seeds).
- **Sub-agent tools policy** — every claudomat-authored agent omits the `tools:` frontmatter field; full parent inheritance is mandatory.
- **Gemini Deep Research host skill** — `gemini-deep-research` (declared as required host skill in `claudomat-brain/onboarding/md-matching-file.md`).
- **Refresh path** — `claudomat sync`.
