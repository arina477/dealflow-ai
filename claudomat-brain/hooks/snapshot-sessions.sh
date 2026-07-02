#!/usr/bin/env bash
# claudomat archive snapshot — push the current session's JSONL plus
# ~/.claude/ global state to an S3 bucket.
#
# Triggered by Stop and SessionEnd hooks that Claude Code fires per session.
# Designed to be cheap (background-forked, exits foreground in <50 ms),
# silent on failure (logs only; always exits 0), and idempotent.
#
# Host-level scope is enforced by where the hook is wired — the hook block
# lives in `~/.claude/settings.json`, installed once per machine via
# `claudomat archive install`. Every Claude Code session on this machine
# fires this script (regardless of project).
#
# To avoid backfilling unrelated session history, this script ONLY pushes the
# JSONL of the current session (read from stdin JSON Claude Code sends to
# every hook). All other sessions on the host are ignored.
#
# Configuration is sourced from ~/.config/claudomat/archive.env:
#   CLAUDOMAT_ARCHIVE          1 to push, 0 (or unset) to no-op.
#   CLAUDOMAT_ARCHIVE_REMOTE   rclone remote name (must exist in rclone.conf).
#   CLAUDOMAT_ARCHIVE_BUCKET   S3-side bucket name (with any provider suffix).
#   CLAUDOMAT_HOST             hostname tag — first path segment under hosts/.
#
# Bucket layout (host-prefixed per design B; scope variant "machine-config + claudomat transcripts"):
#   <bucket>/hosts/<host>/projects/<slug>/<sessionId>.jsonl   ← only current session
#   <bucket>/hosts/<host>/projects/<slug>/memory/...          ← only current project's memory
#   <bucket>/hosts/<host>/projects/<slug>/<sessionId>/subagents/agent-<agentId>.jsonl
#                                                             ← per-subagent transcripts (same sessionId as parent)
#   <bucket>/hosts/<host>/projects/<slug>/<sessionId>/tool-results/<name>.txt
#                                                             ← Claude Code spill files for oversized tool outputs
#   <bucket>/hosts/<host>/{history.jsonl,CLAUDE.md,settings.json}  ← machine "personality"
#
# DELIBERATELY NOT pushed:
#   - ~/.claude/todos/   per-session todo state, mostly empty placeholders, 471+ files,
#                        contents come from non-claudomat sessions too. Adds noise.
#   - ~/.claude/plans/   saved plans, includes ones authored in non-claudomat sessions.
#   - ~/.claude/cache/, paste-cache/, shell-snapshots/, session-env/, statsig/,
#     telemetry/, debug/, ide/, plugins/, backups/, skills/  (transient or huge).
#
# Source of truth: claudomat repo, claudomat-brain/hooks/snapshot-sessions.sh.
# Refreshed onto host at ~/.claude/hooks/snapshot-sessions.sh by `claudomat sync`.

set -uo pipefail
umask 077   # log + lock files end up mode 600 by default

# -------------------------------------------------------- read hook stdin JSON
# Claude Code passes hook context via stdin: {session_id, transcript_path, cwd,
# permission_mode, hook_event_name}. We capture it BEFORE the background fork
# so the child has it.
HOOK_JSON=""
if [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat || true)
fi

# -------------------------------------------------------------- background fork
# Hooks fire on Claude Code's session-end path. Don't block.
# Re-exec self fully detached on the first invocation; the parent exits 0
# instantly. The child (CLAUDOMAT_ARCHIVE_FOREGROUND=1) does the real work.
if [[ "${CLAUDOMAT_ARCHIVE_FOREGROUND:-0}" != "1" ]]; then
  ( CLAUDOMAT_ARCHIVE_FOREGROUND=1 \
    CLAUDOMAT_ARCHIVE_HOOK_JSON="$HOOK_JSON" \
    nohup "$0" "$@" </dev/null >/dev/null 2>&1 & )
  exit 0
fi

# After fork dispatch: child receives HOOK_JSON via env; direct-foreground (test
# mode) has it in local HOOK_JSON. Merge into one variable for the parser below.
CLAUDOMAT_ARCHIVE_HOOK_JSON="${CLAUDOMAT_ARCHIVE_HOOK_JSON:-$HOOK_JSON}"

# ------------------------------------------------------------------ paths & env
ARCHIVE_ENV="${HOME}/.config/claudomat/archive.env"
LOG="${HOME}/.config/claudomat/archive.log"
LOG_MAX_BYTES=5242880   # 5 MB

[[ -f "$ARCHIVE_ENV" ]] || exit 0
# Validate syntax before sourcing — a partial-write or hand-edit can leave
# the file with parse errors that would silently pollute env vars otherwise.
bash -n "$ARCHIVE_ENV" 2>/dev/null || exit 0
# shellcheck disable=SC1090
source "$ARCHIVE_ENV"

# Required vars (silently no-op if any missing).
[[ "${CLAUDOMAT_ARCHIVE:-0}" == "1" ]]   || exit 0
[[ -n "${CLAUDOMAT_ARCHIVE_REMOTE:-}" ]] || exit 0
[[ -n "${CLAUDOMAT_ARCHIVE_BUCKET:-}" ]] || exit 0
[[ -n "${CLAUDOMAT_HOST:-}" ]]           || exit 0

mkdir -p "$(dirname "$LOG")"

# Required CLI: rclone. Missing → log once and exit.
if ! command -v rclone >/dev/null 2>&1; then
  printf '[%s] WARN rclone not installed; see https://rclone.org/install/ or your OS package manager (brew/apt/dnf/pacman)\n' \
    "$(date -u +%FT%TZ)" >> "$LOG"
  exit 0
fi

# Parse hook JSON (passed through env from foreground stage).
TRANSCRIPT_PATH=""
SESSION_ID=""
HOOK_CWD=""
HOOK_EVENT=""
if [[ -n "${CLAUDOMAT_ARCHIVE_HOOK_JSON:-}" ]] && command -v jq >/dev/null 2>&1; then
  IFS=$'\t' read -r TRANSCRIPT_PATH SESSION_ID HOOK_CWD HOOK_EVENT < <(
    printf '%s' "$CLAUDOMAT_ARCHIVE_HOOK_JSON" \
      | jq -r '[.transcript_path // "", .session_id // "", .cwd // "", .hook_event_name // ""] | @tsv' \
        2>/dev/null || printf '\t\t\t'
  )
fi

# Defense-in-depth: SESSION_ID is composed into bucket key paths below. Claude
# Code generates UUIDs, so we hard-validate the format and silently exit if a
# malformed value ever sneaks through. Empty SESSION_ID is allowed here —
# downstream TRANSCRIPT_PATH guards handle the no-session case.
# Keep `-` last in the char class so it stays literal, not a range.
if [[ -n "$SESSION_ID" && ! "$SESSION_ID" =~ ^[a-zA-Z0-9_-]{1,128}$ ]]; then
  exit 0
fi

# --------------------------------------------------------------------- locking
# flock(1) is preinstalled on Linux but NOT on macOS. With it, serialise
# concurrent Stop + SessionEnd runs. Without it, accept rare overlap (rclone
# sync is tolerant; collisions at most cause one redundant PUT).
LOCK_FILE="${HOME}/.config/claudomat/snapshot.lock"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || exit 0
else
  WARN_FLAG="${HOME}/.config/claudomat/.flock-fallback-warned"
  if [[ ! -f "$WARN_FLAG" ]]; then
    touch "$WARN_FLAG"
    printf '[%s] WARN flock(1) not found; concurrent snapshots may overlap. Install via `brew install flock` to silence.\n' \
      "$(date -u +%FT%TZ)" >> "$LOG"
  fi
fi

# ---------------------------------------------------------------- log rotation
if [[ -f "$LOG" ]]; then
  size=$(wc -c < "$LOG" | tr -d ' ')
  if (( size > LOG_MAX_BYTES )); then
    mv -f "$LOG" "$LOG.1"
  fi
fi

# -------------------------------------------------------------------- push
START_TS=$(date -u +%FT%TZ)
DEST_BASE="${CLAUDOMAT_ARCHIVE_REMOTE}:${CLAUDOMAT_ARCHIVE_BUCKET}/hosts/${CLAUDOMAT_HOST}"

printf '[%s] snapshot start host=%s event=%s session=%s\n' \
  "$START_TS" "$CLAUDOMAT_HOST" "${HOOK_EVENT:-manual}" "${SESSION_ID:-unknown}" \
  >> "$LOG"

# --- per-session push (only when we know which session) -----------------------
# Push ONLY the current session's JSONL plus the project's memory/ subdir.
# This is the single most important behaviour: never sweep ~/.claude/projects
# wholesale (that would backfill unrelated sessions from non-claudomat
# projects on this machine).
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
  PROJECT_DIR=$(dirname "$TRANSCRIPT_PATH")
  SLUG=$(basename "$PROJECT_DIR")

  rclone copy "$TRANSCRIPT_PATH" "$DEST_BASE/projects/$SLUG/" \
    --log-file="$LOG" --log-level INFO 2>>"$LOG" || true

  if [[ -d "$PROJECT_DIR/memory" ]]; then
    rclone sync "$PROJECT_DIR/memory/" "$DEST_BASE/projects/$SLUG/memory/" \
      --transfers 4 --checkers 4 \
      --log-file="$LOG" --log-level INFO 2>>"$LOG" || true
  fi

  # Subagent transcripts: Claude Code writes <sessionId>/subagents/agent-<id>.jsonl
  # per spawned subagent (same sessionId as parent, isSidechain:true on every line).
  # Without these, `Agent` tool_use blocks in the parent jsonl reference work that
  # has no archived record. `rclone copy` (append-only) — these files are
  # write-once / immutable; we never want a local cleanup to delete the archive.
  if [[ -n "$SESSION_ID" && -d "$PROJECT_DIR/$SESSION_ID/subagents" ]]; then
    rclone copy "$PROJECT_DIR/$SESSION_ID/subagents/" \
      "$DEST_BASE/projects/$SLUG/$SESSION_ID/subagents/" \
      --transfers 4 --checkers 4 \
      --log-file="$LOG" --log-level INFO 2>>"$LOG" || true
  fi

  # Tool-result spill files: when a tool's output exceeds Claude Code's inline
  # threshold (Bash, Grep, large Read), the body lands in
  # <sessionId>/tool-results/<name>.txt and the parent jsonl references it by
  # path. Without these the parent transcript is incomplete. `rclone copy`
  # (append-only) — same immutability rationale as the subagents block above.
  if [[ -n "$SESSION_ID" && -d "$PROJECT_DIR/$SESSION_ID/tool-results" ]]; then
    rclone copy "$PROJECT_DIR/$SESSION_ID/tool-results/" \
      "$DEST_BASE/projects/$SLUG/$SESSION_ID/tool-results/" \
      --transfers 4 --checkers 4 \
      --log-file="$LOG" --log-level INFO 2>>"$LOG" || true
  fi
fi

# --- global state push (every run) -------------------------------------------
# These files/dirs are global to ~/.claude/, not per-project. Pushing them on
# every snapshot keeps the bucket's view of "machine state" reasonably fresh.
for f in history.jsonl CLAUDE.md settings.json; do
  src="${HOME}/.claude/$f"
  [[ -f "$src" ]] || continue
  rclone copy "$src" "$DEST_BASE/" \
    --log-file="$LOG" --log-level INFO 2>>"$LOG" || true
done

END_TS=$(date -u +%FT%TZ)
printf '[%s] snapshot done  host=%s session=%s\n' \
  "$END_TS" "$CLAUDOMAT_HOST" "${SESSION_ID:-unknown}" >> "$LOG"
exit 0
