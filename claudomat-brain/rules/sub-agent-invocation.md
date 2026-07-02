# Sub-Agent Workflow

How to utilize the project's bespoke sub-agent catalog efficiently. Plan-authoring rules live in `command-center/principles/PRODUCT-PRINCIPLES.md`; code-execution rules in `command-center/principles/BUILD-PRINCIPLES.md`.

---

## Before every sub-agent spawn

Two-step gate. Do not skip Step 1 — silent-fail is the failure mode this gate prevents.

1. **Consult the capability sheet.** Open `process/session/.capability-sheet.md` (§ "Agents at ~/.claude/agents/") and confirm the target name appears. If absent: (a) install per `claudomat-brain/setup-tools/agent-creator/agent-creator.md` and regenerate the sheet, or (b) pick the closest substitute from the catalog and record the swap in the spawn context.

2. **Pick the best domain match per `command-center/AGENTS.md`.** Cross-reference the task against the catalog's `expertise` and `routing` columns: the best match is the most-specific tag whose lens covers the work. For technical errors, route through `command-center/dev/triage-routing-table.md` (symptom → domain tag) before reading AGENTS.md (tag → agent). Examples: a DB-heavy query routes to `postgres-pro`, not `backend-developer`; a CSS regression routes to `react-specialist`, not generic `frontend-developer`. Never invent agent names — only spawn agents that exist in the catalog.

**Hard rule:** if no agent in `AGENTS.md` is a defensible domain match, route through `claudomat-brain/setup-tools/agent-creator/agent-creator.md` to install one. Do not substitute silently with a generic agent.

---

## Spawn discipline

### 1. Scope every spawn to a specific well-bounded task with explicit file paths and a clear deliverable format.
Why: sub-agents have limited context — broad "review everything" asks waste tokens and produce noise.

### 2. Launch independent agents in parallel; never let two agents own overlapping scope.
Why: overlap means one agent's output will contradict or overwrite the other's.

### 3. Name each spawn descriptively so the user can track what each is doing.

---

## Cross-cutting rules

### 4. After 2 failed fix attempts, immediately escalate to a domain specialist.
Why: domain experts (`websocket-engineer`, `react-specialist`, `security-engineer`, `database-administrator`, `ultrathink-debugger`) diagnose in seconds what self-iteration with `console.log` takes hours to find.

### 5. Pair `architect-reviewer` with `security-engineer` on every auth / middleware / session / CSRF / rate-limit wave.
Why: architect-reviewer reasons about what SHOULD exist; security-engineer reads what DOES exist — either alone misses the gap between spec and codebase.

### 6. Give Reviewer-stage Agents (Karen, jenny, head-agents) specific source claims to verify (line numbers, method names, field shapes, exact spec text) — not open-ended "review the plan" asks.
Why: catch rate scales with prompt specificity; for boolean-logic or comparison-direction specs, paste the exact spec text to catch inverted logic.

### 7. Default every implementer spawn to the six-constraint exec brief.
Why: file paths + section count + platform facts + LOC/non-goals + placement + test-gate commands together produce one-pass zero-round-trip delivery; removing any single category predictably triggers clarification loops.

---

## Six-constraint exec brief

Use in this order for implementer-class spawns:

1. **Template/target file paths** with absolute paths and line/symbol anchors — never abstract structure descriptions.
2. **Section count + exact pattern to mirror** — enumerated change targets plus a before→after snippet or in-repo reference.
3. **Platform-specific facts to inject verbatim** — schema enums, Zod constraints, brand names, contract fields, guard/role module paths.
4. **LOC target range OR explicit non-goals list** — LOC ceiling (content waves) or prohibition list (code waves).
5. **Placement directive** — ordering for framing UI or explicit add/remove/consolidate rules for imports.
6. **Negative constraint / test+build gate commands** — antipattern prohibitions (content) or `pnpm biome check --write` + typecheck + build (code).

Per-agent authoritative briefs live in each agent's card at `~/.claude/agents/<agent>.md`. New implementer agent types default to this six-constraint format.

---

## Observations carve-out

Observations are L-block only. `knowledge-synthesizer` writes to `process/waves/wave-<N>/blocks/L/observations.md` at L-1; `karen` reads it at L-2 distill for principle promotion. Do not read or inject observations at spawn time — all prompt-shaping intelligence lives in the agent's card after L-2 promotion.

---

## Tool inheritance

Agent cards omit the `tools:` frontmatter field. Every spawned sub-agent inherits the parent's full tool set.
