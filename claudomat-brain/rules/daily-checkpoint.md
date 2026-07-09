# Daily Checkpoint

Daily batch of founder-facing items: Tier 3 product decisions deferred by P-0, milestone-assignments made since the last checkpoint, and tasks that stayed in the unassigned queue after the most recent P-0 walk. Single `AskUserQuestion` session under non-autonomous modes; BOARD or ceo-agent under autonomous. Keeps the founder in the loop without interrupting wave execution.

Lightweight by design — typical duration under 5 minutes if buckets are small.

---

## Mandatory cross-references

- **Roadmap schema (for any assignment changes):** `claudomat-brain/ROADMAP/roadmap-lifecycle.md`
- **3-tier autonomy rubric:** `claudomat-brain/management/default-mode.md`
- **Automatic-mode BOARD routing:** `claudomat-brain/management/automatic-mode.md`
- **Degenerate-mode ceo-agent fallback:** `claudomat-brain/management/degenerate-mode.md` + `claudomat-brain/management/communication/ceo-communication-rules.md`
- **P-0 (source of assignments + Tier 3 deferrals):** `claudomat-brain/blocks/product/stages/P-0-frame.md`
- **Canonical data:** `milestones` and `tasks` tables in Postgres (per `claudomat-brain/db/SCHEMA.md`); `command-center/product/product-decisions.md`, `process/session/updates/pending.md`, `process/session/checkpoint-ledger.yaml` on FS

---

## Scope

**Does:** batch 3 founder-facing surfaces into one session — Tier 3 decisions, milestone-assignments-for-review, stayed-unassigned-for-override. Writes founder decisions back to the `tasks.milestone_id` FK (assignment changes), `command-center/product/product-decisions.md` (decision log), and `process/session/checkpoint-ledger.yaml` (what was surfaced when, who resolved).

**Does NOT:**
- Populate or restructure the roadmap — that's `claudomat-brain/ROADMAP/roadmap-planning-ritual.md`
- Replenish atomic backlog — that's `roadmap-planning-ritual.md` fired with reason `backlog-stockout` (N-1 detects)
- INSERT pre-authored tasks under a milestone — that's `roadmap-planning-ritual.md` Step 5b
- Run P-0 assignment — that happens per-wave; this ritual consumes its output

**Relationship:** the daily checkpoint is the downstream consumer of P-0 Frame. P-0 makes per-wave assignment decisions (via `UPDATE tasks SET milestone_id`) and defers Tier 3 decisions; the checkpoint resolves the deferrals and reviews the assignments.

```
P-0 Frame (per wave)              ← assigns tasks (milestone_id), defers Tier 3 to ledger
      │
      ▼
daily-checkpoint                  ← founder/BOARD/ceo resolves (this file)
      │
      ▼
tasks table + product-decisions.md + checkpoint-ledger.yaml  ← final writeback
```

---

## How state is tracked

- **`tasks.milestone_id`** — the assignment is the real column. `NULL` = unassigned; non-NULL = assigned to a milestone.
- **`process/session/checkpoint-ledger.yaml`** — append-only FS ledger. P-0 writes a deferral entry for each Tier 3 task and each assignment it made; the checkpoint records "surfaced at" / "resolved at" timestamps and the resolver (founder / BOARD / ceo-agent). Prevents re-surfacing a task whose state hasn't changed.
- **`process/session/updates/pending.md`** — founder can drop ad-hoc questions here; the checkpoint folds them into bucket 1a.

Ledger schema:

```yaml
last_checkpoint_at: <ISO timestamp>
entries:
  - task_id: <uuid>
    surfaced_at: <ISO>
    bucket: tier3 | assignment | unassigned
    resolved_at: <ISO or null>
    resolved_by: founder | board | ceo-agent | null
    outcome: <free text — assignment delta, decision summary>
```

---

## When this ritual fires

- Founder phrase trigger: "daily checkpoint" / "checkpoint" / "what's pending?"
- **N-1 Survey & triggers** auto-proposes the ritual when the next claimable task is null AND the unassigned queue depth > 0 (see `claudomat-brain/blocks/next/stages/N-1-survey-and-triggers.md` Action 9).

Under autonomous modes (`automatic` / `degenerate`), the ritual fires on the same N-1 trigger and resolves through BOARD / ceo-agent without founder presence.

---

## The ritual — 4 steps

### Step 1 — Gather the 3 buckets

Orchestrator queries the `tasks` table + reads the checkpoint ledger.

**1a. Tier 3 pending.** Tasks the ledger lists as `bucket: tier3 AND resolved_at IS NULL`. Union with manually-added entries in `process/session/updates/pending.md`.

**1b. Assigned this cycle.** Tasks whose `milestone_id` changed from NULL to non-NULL since `last_checkpoint_at` (the ledger records each such transition with `bucket: assignment`). Includes the prior NULL state + new milestone + P-0's one-line reasoning from the ledger entry.

**1c. Stayed unassigned.**

```sql
SELECT id, title, description, created_at
FROM tasks
WHERE status = 'todo'
  AND milestone_id IS NULL
  AND created_at >= now() - interval '<X days>';
```

Exclude tasks the ledger already marked `surfaced_at >= last_checkpoint_at` (re-surfacing happens only when state changes, i.e. founder didn't decide last time and the task is still here).

**Empty-bucket short-circuit:** if all three buckets are empty, report "nothing to surface today" and exit. No `AskUserQuestion` call. No ledger write.

---

### Step 2 — Format for founder

Concise, scannable, one plain line per item (always-on rule 16, `CLAUDE.md`) — say what each item means for the product, not the mechanics behind it. Lead with the decision; keep reasoning and evidence out of the default view — if the founder wants the "why" behind an item, they ask. Template:

```
## Daily checkpoint — <YYYY-MM-DD>

### Decisions that need your call (N)
- #<id> <title> — <the call + what I'd do>. Why you: <money | security | user experience | drops a feature>.

### Assigned this cycle (N) — FYI, reversible
- #<id> <title> → <where it went>

### Stayed unassigned (N) — override or leave
- #<id> <title> — <one plain phrase on why it's parked>
```

---

### Step 3 — Resolution (mode-aware)

Read active mode from `process/session/.autonomous-session` per `claudomat-brain/management/mode-switching.md`. Branch on mode:

**Under `founder-review` or `default`** — AskUserQuestion batch.

One interactive session. For each Tier 3 item the recommendation is pre-filled; founder confirms, overrides, or defers. For assignments and unassigned, founder can override any item by task ID ("Move #57 to M2" / "Kill #94" / "Confirm all assignments").

**Batch-accept:** if the founder answers "approve all" with no overrides, every Tier 3 item adopts its recommendation, every assignment stands, every unassigned stays unassigned. Single answer closes the session.

**Skip:** founder can skip any bucket. Skipped items stay in their bucket for the next checkpoint.

**Under `automatic`** — BOARD resolves all three buckets.

Per Tier 3 item: spawn BOARD with decision-slug `checkpoint-tier3-<task-id>`, strict 6+/7 threshold. If 6+/7 met → apply decision; record outcome in ledger; if material, append to `product-decisions.md`. If threshold not met → leave in bucket (next cycle re-evaluates).

Per assignment: BOARD "confirm assignment" vote with default 4+/7 threshold. 4+ APPROVE → assignment stands (no DB change needed; P-0 already wrote `milestone_id`). 4+ REJECT → revert with `UPDATE tasks SET milestone_id = NULL WHERE id = $1`; record reasoning in ledger.

Per stayed-unassigned: BOARD "map or leave" vote. 4+ APPROVE with a named target milestone → `UPDATE tasks SET milestone_id = $milestone_id WHERE id = $1`. Otherwise stays unassigned.

All BOARD decisions append to `process/session/updates/board-digest-<YYYY-MM-DD>.md` grouped by bucket.

**Under `degenerate`** — BOARD resolves first (same thresholds and logic as `automatic`). Any bucket item BOARD can't resolve (threshold miss or HARD-STOP) routes to **ceo-agent**:

Per unresolved item: spawn `ceo-agent` with the BOARD vote file + bucket context. ceo-agent reads `command-center/management/ceo-blocklist.md` for relevant restrictions. ceo-agent decides; entry appended to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md` grouped by bucket.

daily-checkpoint under `degenerate` effectively never blocks — every item resolves within the same tick. Results appear in the following day's digest.

---

### Step 4 — Apply and commit

Orchestrator writes the founder's / BOARD's / ceo-agent's decisions atomically:

**4a. Tier 3 resolutions:**
- Append decision text to the task's description prose (free-form append).
- If material (money / security / vendor / feature removal): append entry to `command-center/product/product-decisions.md`.
- Remove resolved entries from `process/session/updates/pending.md`.
- Update the ledger entry: `resolved_at`, `resolved_by`, `outcome`.

**4b. Assignment overrides:**
- `UPDATE tasks SET milestone_id = $new_id WHERE id = $1` (or `NULL` to revert).
- Update the ledger entry.

**4c. New assignments for stayed-unassigned:**
- `UPDATE tasks SET milestone_id = $new_id WHERE id = $1`.
- Append a new ledger entry: `bucket: assignment`, `resolved_by: founder|board|ceo-agent`, `outcome: "assigned to <milestone title>"`.

**4d. Surface marker:** every task that appeared in ANY bucket this session gets a ledger entry (or its existing entry updated) with `surfaced_at = <ISO>`. Prevents re-surfacing until state changes (founder didn't decide AND the task is still in the bucket).

**4e. Update timestamp:** rewrite `process/session/checkpoint-ledger.yaml` top-of-file `last_checkpoint_at: <ISO>`.

**4f. Commit — single:**
```
chore(pm): daily checkpoint <YYYY-MM-DD>

- Tier 3: N resolved, M deferred
- Assignments: N confirmed, M overridden
- Unassigned: N mapped, M stayed
```

---

## Deliverables

- `tasks.milestone_id` UPDATEs (per Steps 4b–4c).
- `command-center/product/product-decisions.md` — append entries for material Tier 3 resolutions.
- `process/session/checkpoint-ledger.yaml` — updated with `last_checkpoint_at` + new/updated entries per Step 4.
- `process/session/updates/pending.md` — resolved entries removed.
- `process/session/updates/board-digest-<DATE>.md` — under `automatic` / `degenerate`, BOARD votes appended.
- `process/session/updates/ceo-digest-<DATE>.md` — under `degenerate`, ceo-agent fallback decisions appended.
- One git commit.

---

## Anti-patterns

| Never | Why |
|---|---|
| Surface the same task twice in one checkpoint. | The ledger `surfaced_at` is the guard; re-appearance means state changed materially. |
| Tier-3-escalate mid-wave. | P-0 defers and queues; this ritual resolves. Waves ship on the recommendation. |
| Auto-apply founder silence. | Skipped buckets stay in their buckets. Applying defaults on silence destroys the audit chain. |
| Author milestones at the checkpoint. | New milestones come from `claudomat-brain/ROADMAP/roadmap-planning-ritual.md`. The checkpoint overrides assignments, not the milestone set. |
| Batch-apply material Tier 3 answers without individual `product-decisions.md` entries. | Each material answer needs its own decision-log entry; batch writes destroy traceability. |
| Forget to write the ledger entry. | Without it, the next checkpoint re-surfaces resolved items and floods the founder. |
