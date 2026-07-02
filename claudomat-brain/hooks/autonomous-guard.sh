#!/usr/bin/env bash
# claudomat autonomous-guard — Stop hook that enforces the autonomous-mode
# contract. While process/session/.autonomous-session contains
# `mode: automatic` or `mode: degenerate`, this hook emits
# {"decision":"block","reason":"..."} to Claude Code, preventing the
# orchestrator from ending the turn until the founder clears the flag or
# raises a documented halt signal.
#
# Triggered by the Stop hook event. Wired into ~/.claude/settings.json
# automatically by `claudomat sync` (see _autonomous_guard_install in
# lib/claudomat/commands/hooks/permanent_hooks.bash). No uninstall — the guard is a permanent
# part of claudomat.
#
# Decision tree (foreground budget <50 ms; no background fork — must return
# JSON synchronously on stdout):
#
#   1. parse stdin hook JSON
#   2. walk up from cwd to find a directory containing claudomat-brain/
#   3. read <project_root>/process/session/.autonomous-session
#   4. parse `mode:` value
#   5. mode ∈ {automatic, degenerate} only — else exit 0
#   6. halt-signal short-circuits (3 model-side signals): STATUS=DONE,
#      STATUS=BLOCKED, ceo-blocklist.md empty (degenerate only)
#   7. emit {"decision":"block","reason":"<rules-of-game>"} on stdout
#   8. log every decision to ~/.config/claudomat/autonomous-guard.log
#
# Hook-bypass paths (the 2 founder-side ways out, both bypass this hook
# entirely so they are not signals we evaluate above):
#   - ESC + chat in the Claude Code session: interrupts the current turn
#     and bypasses Stop hooks per Claude Code's interactive-mode docs.
#   - Mode flag change: rewriting/deleting process/session/.autonomous-session
#     to flip `mode:` out of {automatic, degenerate} drops the hook to
#     step 5's "else exit 0" branch on the next Stop.
#
# Fail-open policy: tooling failures (missing jq, no cwd, non-claudomat
# session, jq runtime error) → exit 0, allow stop. Exception: when the
# flag file is present but the strict parser can't unambiguously read
# `mode:` (multiple lines / no line / empty value / unknown value), the
# hook emits a diagnostic BLOCK with rewrite/delete instructions, since
# the file IS the contract — silently guessing on a broken file is worse
# than blocking until it's fixed. Defensive parsing tolerates a leading
# UTF-8 BOM, YAML inline comments on the `mode:`/`STATUS:` lines, and
# rejects non-absolute cwd up front; hook-JSON string fields are stripped
# of control characters before they reach the log.
#
# stop_hook_active is DELIBERATELY ignored: the guard keeps blocking until
# the flag changes or a halt signal fires. The reason text states this
# explicitly so the model understands it's a contract, not a bug.
#
# Source of truth: claudomat repo, claudomat-brain/hooks/autonomous-guard.sh.
# Refreshed onto host at ~/.claude/hooks/autonomous-guard.sh by `claudomat sync`.

set -uo pipefail
umask 077

LOG="${HOME}/.config/claudomat/autonomous-guard.log"
LOG_MAX_BYTES=5242880   # 5 MB

mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

# ---------------------------------------------------------------- log rotation
# Concurrent Stop events race on the rename. flock(1) is preinstalled on
# Linux but NOT on macOS — same opportunistic pattern as snapshot-sessions.sh:
# acquire a non-blocking lock when flock is available; on missing flock,
# fall through with a one-shot warning. Concurrent rotation is opportunistic
# — if two processes both pass the size gate, the second `mv -f` may clobber
# `$LOG.1` with the (already-rotated, possibly empty) `$LOG`. Acceptable for
# an opportunistic best-effort rotation; flock prevents this when available.
if [[ -f "$LOG" ]]; then
  size=$(wc -c < "$LOG" 2>/dev/null | tr -d ' ')
  if [[ -n "$size" ]] && (( size > LOG_MAX_BYTES )); then
    ROTATE_LOCK="${HOME}/.config/claudomat/autonomous-guard.rotate.lock"
    if command -v flock >/dev/null 2>&1; then
      exec 9>"$ROTATE_LOCK"
      if flock -n 9; then
        # Re-check size under the lock — another Stop may have already rotated.
        size=$(wc -c < "$LOG" 2>/dev/null | tr -d ' ')
        if [[ -n "$size" ]] && (( size > LOG_MAX_BYTES )); then
          mv -f "$LOG" "$LOG.1"
        fi
      fi
    else
      WARN_FLAG="${HOME}/.config/claudomat/.flock-fallback-warned"
      if [[ ! -f "$WARN_FLAG" ]]; then
        touch "$WARN_FLAG"
        printf '[%s] WARN flock(1) not found; concurrent log rotations may race. Install via `brew install flock` to silence.\n' \
          "$(date -u +%FT%TZ)" >> "$LOG"
      fi
      mv -f "$LOG" "$LOG.1"
    fi
  fi
fi

log_line() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG" 2>/dev/null || true
}

# Allow-stop helper: exit 0 with no stdout. Optionally log a reason.
allow_stop() {
  local why="${1:-}"
  [[ -n "$why" ]] && log_line "allow: $why"
  exit 0
}

# -------------------------------------------------------- read hook stdin JSON
HOOK_JSON=""
if [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat || true)
fi

# jq is required to both parse input and emit output. Missing → fail open.
if ! command -v jq >/dev/null 2>&1; then
  allow_stop "jq not installed; cannot construct JSON response"
fi

HOOK_CWD=""
SESSION_ID=""
STOP_HOOK_ACTIVE="false"
HOOK_EVENT=""
if [[ -n "$HOOK_JSON" ]]; then
  IFS=$'\t' read -r HOOK_CWD SESSION_ID STOP_HOOK_ACTIVE HOOK_EVENT < <(
    printf '%s' "$HOOK_JSON" \
      | jq -r '[.cwd // "", .session_id // "", (.stop_hook_active // false | tostring), .hook_event_name // ""] | @tsv' \
        2>/dev/null || printf '\t\tfalse\t'
  )
  # Defense against log-line injection via hook-JSON string fields:
  # strip C0 control bytes (CR, LF, TAB, NUL, ESC, etc.) so a malicious or
  # malformed payload can't fabricate log lines. Note: this removes the ESC
  # byte of an ANSI escape sequence but leaves the trailing CSI parameter
  # bytes (e.g. "[31m") as printable ASCII — it is NOT a full ANSI-sequence
  # sanitizer, just a control-byte stripper. STOP_HOOK_ACTIVE goes through
  # the same sanitizer — though `tostring` of a bool returns "true"/"false"
  # for WELL-FORMED input, a malformed payload (e.g. .stop_hook_active set
  # to a string with control chars) could slip through if jq's `// false`
  # branch isn't taken. HOOK_CWD is sanitized for the same reason — it's
  # interpolated into log lines and into the project-root walk-up.
  HOOK_CWD=$(printf '%s' "$HOOK_CWD" | tr -d '[:cntrl:]')
  SESSION_ID=$(printf '%s' "$SESSION_ID" | tr -d '[:cntrl:]')
  STOP_HOOK_ACTIVE=$(printf '%s' "$STOP_HOOK_ACTIVE" | tr -d '[:cntrl:]')
  HOOK_EVENT=$(printf '%s' "$HOOK_EVENT" | tr -d '[:cntrl:]')
fi

if [[ -z "$HOOK_CWD" ]]; then
  allow_stop "no cwd in hook input"
fi

# Reject non-absolute cwd: a relative path would make the walk-up loop's
# `-d "$dir/claudomat-brain"` check run against the script's exec-time cwd,
# not the project. Fail open with a logged reason.
if [[ "$HOOK_CWD" != /* ]]; then
  allow_stop "cwd is not absolute: $HOOK_CWD"
fi

# -------------------------------------------- walk up cwd to find project root
# A claudomat project root is any directory that contains a `claudomat-brain/`
# subdirectory. The brain itself owns the templates; project state
# (`process/`, `command-center/`) lives alongside it at the project root.
# The loop also checks `/` once at the end so a brain at filesystem root
# (`/claudomat-brain`) is still matched — defensive edge case.
PROJECT_ROOT=""
dir="$HOOK_CWD"
while [[ -n "$dir" ]]; do
  if [[ -d "$dir/claudomat-brain" ]]; then
    PROJECT_ROOT="$dir"
    break
  fi
  [[ "$dir" == "/" ]] && break
  parent=$(dirname "$dir")
  [[ "$parent" == "$dir" ]] && break
  dir="$parent"
done

if [[ -z "$PROJECT_ROOT" ]]; then
  # Non-claudomat session. Silent (no log entry — would spam every Stop
  # everywhere on the host).
  exit 0
fi

# Sanitize PROJECT_ROOT for log lines: a directory name with control
# characters (technically possible on POSIX FS) would corrupt the log.
PROJECT_ROOT=$(printf '%s' "$PROJECT_ROOT" | tr -d '[:cntrl:]')

FLAG_FILE="$PROJECT_ROOT/process/session/.autonomous-session"
STATUS_FILE="$PROJECT_ROOT/process/session/status-check.yaml"
CHARTER_FILE="$PROJECT_ROOT/command-center/management/ceo-blocklist.md"

# Flag absent → founder-review baseline. No block.
[[ -f "$FLAG_FILE" ]] || exit 0

# ----------------------------------------------------------------- parse mode:
# Strict parser. The flag file is the contract; if we can't read the mode
# unambiguously, the contract is broken and we MUST block the stop with a
# diagnostic so the orchestrator (or the founder) fixes the file. Silently
# guessing — e.g. taking the first of multiple `mode:` lines — would let
# wrong-mode behavior slip through.
#
# Accepted: exactly one top-level `^mode:` line whose value (after stripping
# whitespace and surrounding single/double quotes) is one of the four known
# values from claudomat-brain/management/mode-switching.md:9-17.

# Read the file once, stripping a leading UTF-8 BOM (\xEF\xBB\xBF) if present
# so editors that prepend one don't break the `^mode:` regex. The raw file is
# still read directly for the emit_malformed_block diagnostic dump, so an
# operator sees the BOM if it's there.
#
# Cap the read at 64 KB. The canonical flag file is <500 bytes, so any input
# beyond that is by definition malformed (or hostile — a 1 GB flag file would
# otherwise slurp into memory). If truncation removes the `mode:` line or
# breaks the parse, the malformed-block path fires, which is the desired
# behavior for a broken contract.
FLAG_CONTENT=$(head -c 65536 "$FLAG_FILE" 2>/dev/null | sed $'1s/^\xEF\xBB\xBF//' || true)

# grep -c exits 1 when count is 0, which makes `... || X` produce double-output
# ("0" from grep + X). awk is cleaner: always exits 0, always prints exactly one
# integer (defaulting to 0 via `c+0` when no lines matched).
MODE_LINE_COUNT=$(printf '%s' "$FLAG_CONTENT" | awk '/^mode:/{c++} END{print c+0}' 2>/dev/null)
MODE_LINE_COUNT=${MODE_LINE_COUNT:-0}

# emit_block: print {"decision":"block","reason":$1} on stdout, log $2, exit 0.
# Shared by both the normal autonomous-mode block and the malformed-file block.
emit_block() {
  local reason="$1" log_tag="$2"
  if ! jq -n --arg reason "$reason" '{decision:"block", reason:$reason}' 2>/dev/null; then
    log_line "ERROR: jq failed to construct block JSON; failing open ($log_tag)"
    exit 0
  fi
  log_line "block($log_tag): project_root=$PROJECT_ROOT session=${SESSION_ID:-unknown} stop_hook_active=$STOP_HOOK_ACTIVE event=${HOOK_EVENT:-unknown}"
  exit 0
}

# emit_malformed_block: block with a diagnostic the orchestrator can act on.
# Inlines the file contents (truncated) and the canonical schema so the
# model has everything it needs to rewrite the file in one turn.
emit_malformed_block() {
  local diagnosis="$1"
  local file_size file_dump
  file_size=$(wc -c < "$FLAG_FILE" 2>/dev/null | tr -d ' ')
  # Pipe through `iconv -c -f UTF-8 -t UTF-8` to drop invalid byte sequences.
  # A multi-byte UTF-8 codepoint split by `head -c 2000` would otherwise reach
  # jq's --arg and trigger an "Invalid string" error → fail-open exit 0 → guard
  # silently bypassed via crafted file content. iconv -c is portable across
  # macOS BSD and Linux GNU. Apply to both branches: a small file can still
  # contain crafted invalid UTF-8.
  #
  # NUL byte handling: iconv -c does NOT strip NUL (it's valid UTF-8), but
  # jq's --arg treats NUL as a C-string terminator, silently truncating the
  # dump and hiding crafted-payload content past the NUL. `tr -d '\000'`
  # removes them. Applied to both branches.
  # Forward-compat: if a new sentinel byte (\x02 etc.) is introduced for placeholder
  # substitution, extend this strip to cover it.
  if [[ "$file_size" =~ ^[0-9]+$ && "$file_size" -gt 2000 ]]; then
    file_dump="$(head -c 2000 "$FLAG_FILE" 2>/dev/null | iconv -c -f UTF-8 -t UTF-8 2>/dev/null | tr -d '\000\001')
... [truncated; file is $file_size bytes total]"
  else
    file_dump="$(iconv -c -f UTF-8 -t UTF-8 < "$FLAG_FILE" 2>/dev/null | tr -d '\000\001')"
  fi
  local reason
  # Placeholder sentinel: a single SOH (\x01) byte wraps each placeholder name
  # so user-controlled content (MODE, the file dump) cannot collide with the
  # placeholder string. MODE is post-sanitized through `tr -d '[:cntrl:]'`, and
  # the file dump is post-sanitized through `tr -d '\000\001'` above, so neither
  # can carry a literal \x01 into the substitution.
  local _PH=$'\x01'
  # Multi-line text via `read -r -d '' <<EOF`, NOT `$(cat <<EOF ...)`.
  # Bash 3.2 (the /bin/bash macOS ships) has a parser bug where ANY single
  # quote, backtick, or escaped backtick inside a heredoc inside `$(...)`
  # confuses its paren-tracker, even when the heredoc terminator is quoted
  # to disable expansion. Body text below contains all of those characters
  # for legitimate documentation reasons. `read -r -d ''` lives outside
  # `$(...)`, so the parser never enters that buggy state. The exit status
  # is non-zero (read didn't find a NUL terminator before EOF), so `|| true`
  # keeps the script from tripping when callers run with `set -e`. The
  # variable is still fully assigned. The heredoc is UNQUOTED so the
  # ${_PH} placeholder sentinels expand at read-time; every literal `$` and
  # backtick in the body is escaped (\` for backticks; there are no other
  # `$` characters). The SOH-wrapped sentinels (\x01NAME\x01) cannot collide
  # with user-controlled content because MODE is post-stripped of all
  # control characters and the file dump is post-stripped of \x00/\x01.
  IFS='' read -r -d '' reason <<EOF || true
The Stop guard hook cannot determine your autonomous mode from
process/session/.autonomous-session — the file is present but malformed.

What's wrong: ${_PH}DIAGNOSIS${_PH}

File contents (process/session/.autonomous-session):
---
${_PH}FILE_DUMP${_PH}
---

Canonical schema (from claudomat-brain/management/mode-switching.md § Flag):

    started_at: <ISO-timestamp>
    mode: founder-review | default | automatic | degenerate
    reason: <one-line quote of user's phrasing>
    expires_on: user-says-stop | orchestrator-finishes-all-work
    # degenerate only:
    charter: command-center/management/ceo-blocklist.md
    notify_to: <value of CEO_NOTIFY_EMAIL_TO env var>

Exactly one top-level \`mode:\` line is required, and its value must be one
of: founder-review, default, automatic, degenerate.

How to fix (model-side, one of these):

1. Rewrite the file with the canonical schema. Use the activation-sequence
   bash block in claudomat-brain/management/<MODE>-mode.md § Entry conditions
   as the template (\`cat > process/session/.autonomous-session <<EOF ...\`).
   Pick the mode the founder actually intended — read the flag file's
   current contents, the recent conversation, and
   process/session/.last-wave-completed.yaml if present.

2. If you cannot determine the founder's intended mode, delete the file:
       rm process/session/.autonomous-session
   This reverts the project to founder-review (the baseline when the flag
   file is absent), the guard will allow the next stop, and the founder
   will re-set the mode on their next interaction.

Founder-side recovery (out-of-band):
- If the model is stuck in a re-prompt cycle and can't act, the founder
  can intervene directly:
  - Press ESC in the Claude Code session (interrupts the current turn
    and bypasses Stop hooks entirely per Claude Code's interactive-mode
    docs).
  - Or delete the flag file from the shell:
        rm process/session/.autonomous-session
- The autonomous-guard does NOT honor halt signals (STATUS=DONE,
  STATUS=BLOCKED) while the flag file is unparseable, because the strict
  parser hasn't validated which mode the project is in. Fix or delete
  the flag file first; halt signals are then respected on the next Stop.

In your next response, state explicitly which path you took (rewrite vs
delete) and why you chose it. The guard re-reads the file on the next
Stop event — once it parses cleanly, normal behavior resumes.

This block IS the contract: there is no way to stop while the flag file
is unparseable. Repeatedly trying to stop without fixing the file will
produce the same error block.
EOF
  reason="${reason//${_PH}DIAGNOSIS${_PH}/$diagnosis}"
  reason="${reason//${_PH}FILE_DUMP${_PH}/$file_dump}"
  emit_block "$reason" "malformed:$diagnosis"
}

if [[ "$MODE_LINE_COUNT" -eq 0 ]]; then
  # Hint for UTF-16-encoded flag files: the strict parser only reads UTF-8,
  # so a UTF-16 file shows no `^mode:` matches. Peek at the first two bytes
  # for a UTF-16 BOM (FF FE = LE, FE FF = BE) and prepend a one-line note so
  # the operator can re-save the file as UTF-8 immediately instead of
  # debugging a phantom missing-mode-line.
  diagnosis_msg="no top-level \`mode:\` line found in the flag file"
  bom_bytes=$(head -c 2 "$FLAG_FILE" 2>/dev/null | od -An -tx1 | tr -d ' \n')
  if [[ "$bom_bytes" == "fffe" || "$bom_bytes" == "feff" ]]; then
    diagnosis_msg="file appears to be UTF-16 encoded — re-save as UTF-8; $diagnosis_msg"
  fi
  emit_malformed_block "$diagnosis_msg"
fi

if [[ "$MODE_LINE_COUNT" -gt 1 ]]; then
  emit_malformed_block "found $MODE_LINE_COUNT top-level \`mode:\` lines; expected exactly one"
fi

# Exactly one mode line. Extract its value, stripping whitespace, CR,
# inline YAML comments (` #...` to end of line), and surrounding single- or
# double-quotes. Comment-strip runs before quote-strip so that
# `mode: "automatic" # comment` resolves to `automatic`.
MODE=$(printf '%s' "$FLAG_CONTENT" | grep '^mode:' 2>/dev/null \
        | head -1 \
        | sed -E 's/^mode:[[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/' \
        | tr -d '\r')

# Sanitize MODE before any further use. A malicious flag file can embed
# control characters (ANSI escapes, NUL, CR/LF) in the mode value; jq's
# --arg handles them safely, but the log-tag and any other shell-string
# interpolation would not. Cap length at 64 chars too — canonical values
# are <15 chars, so 64 is generous slack for diagnostic display.
MODE=$(printf '%s' "$MODE" | tr -d '[:cntrl:]' | cut -c1-64)

if [[ -z "$MODE" ]]; then
  emit_malformed_block "\`mode:\` line is present but has no value after stripping whitespace, quotes, inline comments, and control characters"
fi

case "$MODE" in
  automatic|degenerate)
    : # block path below
    ;;
  founder-review|default)
    exit 0
    ;;
  *)
    emit_malformed_block "\`mode:\` value \`$MODE\` is not a known mode (expected one of: founder-review, default, automatic, degenerate)"
    ;;
esac

# ------------------------------------------------------------- halt signals
# Each is a documented exit path for the autonomous loop:
#   - status-check.yaml STATUS=DONE    — natural loop end
#   - status-check.yaml STATUS=BLOCKED — human action required (terminal, no auto-resume)
#   - charter empty (degenerate)       — degenerate-mode.md § Exit conditions
# (Founder ESC + chat message in the Claude Code session is the primary
# halt path; it interrupts the current turn and bypasses the Stop hook
# entirely per Claude Code's interactive-mode docs, so it is not a
# short-circuit we evaluate here.)

if [[ -f "$STATUS_FILE" ]]; then
  # Strip a leading UTF-8 BOM defensively, matching the pattern used for the
  # flag file. Then grep the canonical uppercase `STATUS:` key (template ships
  # uppercase; recognized halt values are `STATUS: DONE` and `STATUS: BLOCKED`).
  STATUS_STATE=$(sed $'1s/^\xEF\xBB\xBF//' "$STATUS_FILE" 2>/dev/null \
                  | grep '^STATUS:' \
                  | head -1 \
                  | sed -E 's/^STATUS:[[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/' \
                  | tr -d '\r' || true)
  case "$STATUS_STATE" in
    DONE) allow_stop "halt-signal: status-check.yaml STATUS=DONE (loop already finished)" ;;
    BLOCKED) allow_stop "halt-signal: status-check.yaml STATUS=BLOCKED (human action required — terminal, no auto-resume)" ;;
  esac
fi

if [[ "$MODE" == "degenerate" ]]; then
  # `-s` only catches zero-byte files. Most editors save with a trailing
  # newline when a user clears the file, leaving 1 byte → `-s` returns
  # true → halt would not fire. Strip Markdown/YAML comments (`#...` to
  # end-of-line, inline or full-line) and then all whitespace; treat as
  # empty when nothing remains. A charter containing only `# TODO:` placeholder
  # comments has no actionable content and must trigger the halt. `sed`/`tr`
  # failing on missing file return empty too, so the halt still triggers.
  CHARTER_TRIMMED=$(sed 's/#.*$//' "$CHARTER_FILE" 2>/dev/null | tr -d '[:space:]' || true)
  if [[ -z "$CHARTER_TRIMMED" ]]; then
    allow_stop "halt-signal: ceo-blocklist.md missing or empty/whitespace-only/comment-only (degenerate charter)"
  fi
fi

# ----------------------------------------------------------------------- block
# Build the reason text. Paths are project-root-relative — the orchestrator's
# cwd is the project root, so it can act on them directly.
MODE_FILE="claudomat-brain/management/${MODE}-mode.md"

# Use `read -r -d '' <<EOF` instead of `$(cat <<EOF ...)` because bash 3.2
# (the /bin/bash macOS ships) misparses heredocs containing backticks/quotes
# inside $(...). See emit_malformed_block for the longer comment. `|| true`
# is required because read returns non-zero when no NUL is found before EOF;
# the variable is still fully assigned. The heredoc is UNQUOTED so the
# ${_PH} placeholder sentinels expand at read-time; every literal `$` and
# backtick in the body is escaped. SOH-wrapped sentinels (\x01NAME\x01)
# cannot collide with user-controlled MODE because MODE is post-stripped of
# all control characters before substitution.
_PH=$'\x01'
IFS='' read -r -d '' REASON <<EOF || true
You are in autonomous mode and the Stop guard hook is blocking this stop.

Active mode: ${_PH}MODE${_PH}   (read from process/session/.autonomous-session)
Mode contract:        See ${_PH}MODE_FILE${_PH}.
                      Under ${_PH}MODE${_PH}, the founder has authorized you to keep
                      the wave loop running without interactive checkpoints.

Why you were blocked:
The flag file process/session/.autonomous-session contains \`mode: ${_PH}MODE${_PH}\`.
While that value is set, ending a turn without continuing the loop violates
the contract the founder set. You may not stop in this state.

How to actually stop, if you genuinely should:
1. Confirm stopping is consistent with the rest of your instructions:
   the preemptive-pause prohibition (always-on rule #13), the STATUS routing
   table, and the halt-signal list in ${_PH}MODE${_PH}-mode.md.
2. If you have a real reason to stop, use one of these three escape paths:
   (a) Founder ESC + chat message in the Claude Code session. This is the
       primary halt path — it interrupts the current turn and bypasses the
       Stop hook entirely (per Claude Code's interactive-mode docs), so
       this hook never runs. Only the founder can do this; the model
       cannot trigger it.
   (b) Write \`STATUS: DONE\` (loop finished) or \`STATUS: BLOCKED\` (human
       action required — terminal, no auto-resume) to
       process/session/status-check.yaml.
   (c) Change \`mode:\` in process/session/.autonomous-session to
       \`founder-review\` (or delete the file). The orchestrator exits the
       autonomous contract on the next response (within this Stop-block
       re-prompt cycle).

**Note on legacy STATUS values.** If your process/session/status-check.yaml
currently has STATUS set to:
- HANDOFF (legacy from claudomat <0.31.0), or
- BLOCKED-FOUNDER-STOP or STOP (legacy from claudomat <0.32.0)

— those are legacy values that this hook no longer recognizes as halt
signals. That's why you see this block. Rewrite STATUS to the appropriate
canonical value for your situation:
- BLOCKED (if human action is still required)
- DONE (if work is complete)

(The full canonical enum is RUNNING | IDLE | BLOCKED | DONE; orchestrator-
side wave state takes the other two on its own — they're not migration
targets from legacy halt values.) The migration paragraph in
${_PH}MODE_FILE${_PH} § Legacy STATUS values explains the mapping in full.

3. In your next response, state the concrete reason for stopping
   explicitly — cite which trigger from rule #13 (b, d, e, f) fired, or which
   halt signal you raised, and why.
4. Then end the turn. The guard will see the cleared flag (or the halt
   signal) on the next Stop and allow it.

If stopping is NOT justified, continue the loop instead:
- Check process/session/status-check.yaml and route per the STATUS table
  in ${_PH}MODE${_PH}-mode.md.
- Context overflow is handled transparently by Claude Code's harness
  auto-compact — do NOT write STATUS=BLOCKED yourself to escape "context
  full"; BLOCKED is reserved for situations where a human MUST act
  before the loop can continue, and writing it terminates the loop.
- End the turn ONLY if Task — next claimable returns no row (write
  STATUS=IDLE + ScheduleWakeup(1800s)) OR a hard-stop fired (write
  STATUS=BLOCKED — no ScheduleWakeup; terminal until founder unblocks
  via ESC + chat or by editing status-check.yaml). Per-turn completion
  ("I've done what I planned this turn") is NOT by itself a reason to
  end the turn — continue to the next claimable task or resume the wave
  block you were in.

This guard will keep blocking every Stop attempt until the flag changes
or a halt signal is raised. There is no other way out — trying to stop
again without changing state will produce the same block, repeatedly.
EOF
REASON="${REASON//${_PH}MODE_FILE${_PH}/$MODE_FILE}"
REASON="${REASON//${_PH}MODE${_PH}/$MODE}"

emit_block "$REASON" "mode=$MODE"
