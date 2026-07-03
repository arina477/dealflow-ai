#!/usr/bin/env bash
# claudomat railway-guard — PreToolUse(Bash) hook that HARD-BLOCKS any attempt
# to install OR invoke the Railway CLI, redirecting the model to the Railway
# GraphQL API. Railway is GraphQL-only in claudomat brains; there is no
# `railway` CLI installed and the brain must not rely on one
# (see claudomat-brain/monitors/railway-deploy.md).
#
# Triggered by the PreToolUse hook event for the Bash tool. Wired into
# ~/.claude/settings.json automatically by `claudomat sync` (see
# _railway_guard_install in lib/claudomat/commands/hooks/permanent_hooks.bash).
# No uninstall — the guard is a permanent part of claudomat.
#
# Decision hook (foreground budget <50 ms; no background fork — must return
# JSON synchronously on stdout):
#
#   1. parse stdin hook JSON, extract .tool_input.command
#   2. ALLOWLIST FIRST: strip the approved GraphQL host, the RAILWAY_* env
#      vars, and file-path/arg tokens that merely CONTAIN "railway" — the
#      whole risk is a false positive on the approved API path.
#   3. BLOCKLIST: Railway-CLI install (@railway/cli, package-manager add,
#      brew, official installer) or invocation ("railway" in command position).
#   4. On a block, emit the PreToolUse deny payload on stdout; else exit 0.
#
# Fail-open policy: missing jq or an unparseable payload → emit nothing, exit 0
# (one WARN to the log). A PreToolUse hook must never trap the tool on tooling
# failure. exit 0 always — "deny" is the JSON return path, not a non-zero exit.
#
# Self-test: pass `--selftest` to run the block/allow cases and exit non-zero on
# any mismatch. This path is kept entirely separate from the exit-0 hook path.
#
# Source of truth: claudomat repo, claudomat-brain/hooks/railway-guard.sh.
# Refreshed onto host at ~/.claude/hooks/railway-guard.sh by `claudomat sync`.

# shellcheck disable=SC2016  # single-quoted $RAILWAY_* / backtick text below is INTENTIONALLY literal (log strings + selftest fixtures), never expanded
set -uo pipefail
umask 077

# ---------------------------------------------------------------------- logging
LOG="${HOME}/.config/claudomat/railway-guard.log"
LOG_MAX_BYTES=5242880   # 5 MB

mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

# Size-based log rotation. Concurrent PreToolUse events race on the rename;
# flock(1) is preinstalled on Linux but NOT on macOS — same opportunistic
# pattern as autonomous-guard.sh: acquire a non-blocking lock when flock is
# available; on missing flock, fall through with a one-shot warning.
if [[ -f "$LOG" ]]; then
  size=$(wc -c < "$LOG" 2>/dev/null | tr -d ' ')
  if [[ -n "$size" ]] && (( size > LOG_MAX_BYTES )); then
    ROTATE_LOCK="${HOME}/.config/claudomat/railway-guard.rotate.lock"
    if command -v flock >/dev/null 2>&1; then
      exec 9>"$ROTATE_LOCK"
      if flock -n 9; then
        # Re-check size under the lock — another event may have already rotated.
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

# Canonical block message — the hook's decision reason, used VERBATIM.
BLOCK_REASON="Railway CLI is forbidden in claudomat brains. Do NOT install or run the 'railway' CLI. Use the Railway GraphQL API instead: POST https://backboard.railway.com/graphql/v2 with header 'Project-Access-Token: \$RAILWAY_TOKEN' (NOT 'Authorization: Bearer'); the project id is in \$RAILWAY_PROJECT_ID. See claudomat-brain/monitors/railway-deploy.md."

# ---------------------------------------------------------------- decision core
# _railway_verdict: pure decision function. Prints "block" or "allow" for a
# command string. ALLOWLIST FIRST, then blocklist — the whole risk is a false
# positive on the approved GraphQL path, so approved references are neutralised
# before any blocklist match runs.
_railway_verdict() {
  local cmd="$1"

  # Neutralise the approved references so a blocklist regex can't fire on them:
  #   - the approved GraphQL host backboard.railway.com
  #   - the RAILWAY_* env vars ($RAILWAY_TOKEN / ${RAILWAY_...} brace form etc.)
  # Replace each with a neutral token that contains no "railway" substring.
  local scrubbed="$cmd"
  scrubbed="${scrubbed//backboard.railway.com/BACKBOARD_HOST}"
  # $RAILWAY_... and ${RAILWAY_...} — env-var references, never a CLI call.
  scrubbed=$(printf '%s' "$scrubbed" \
    | sed -E 's/\$\{?RAILWAY_[A-Za-z0-9_]*\}?/RAILWAY_ENVVAR/g')

  # ---- BLOCK: install of the Railway CLI --------------------------------
  # @railway/cli anywhere (npm i -g @railway/cli, pnpm/yarn add, npx ...).
  if [[ "$scrubbed" == *"@railway/cli"* ]]; then
    printf 'block'; return
  fi
  # package-runner launcher of the railway package (npx / pnpm dlx / yarn dlx /
  # npm exec) — `npx railway up`, `npm exec railway up`, `pnpm dlx @railway/cli`.
  if printf '%s' "$scrubbed" \
       | grep -Eq '(^|[^[:alnum:]_])(npx|pnpm[[:space:]]+dlx|yarn[[:space:]]+dlx|npm[[:space:]]+exec)([[:space:]]+[^;&|]*)?[[:space:]](-[-[:alnum:]]+[[:space:]]+)*(@railway/cli|railway)([[:space:]@]|$)'; then
    printf 'block'; return
  fi
  # package-manager install/add of a `railway` package.
  if printf '%s' "$scrubbed" \
       | grep -Eq '(^|[^[:alnum:]_])(npm|pnpm|yarn)([[:space:]]+[^;&|]*)?[[:space:]](install|add|i)([[:space:]]+[^;&|]*)?[[:space:]]railway([[:space:]]|$|[/@])'; then
    printf 'block'; return
  fi
  # brew install ...railway (incl. the tap railwayapp/railway/railway).
  if printf '%s' "$scrubbed" \
       | grep -Eq '(^|[^[:alnum:]_])brew[[:space:]]+(install|reinstall|upgrade)[[:space:]][^;&|]*railway'; then
    printf 'block'; return
  fi
  # Official installer endpoints + railway-host .../install.sh piped to a shell.
  if printf '%s' "$scrubbed" \
       | grep -Eq 'railway\.(app|com)/install|sh\.railway\.app|railway[^[:space:]]*/install\.sh'; then
    printf 'block'; return
  fi
  # bash <(curl ... railway ...) / curl ... railway ... | sh — installer piped in.
  if printf '%s' "$scrubbed" \
       | grep -Eq '(curl|wget)[^;&|]*railway[^;&|]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash)([[:space:]]|$)'; then
    printf 'block'; return
  fi
  if printf '%s' "$scrubbed" \
       | grep -Eq '(sh|bash)[[:space:]]+<\([^)]*railway[^)]*\)'; then
    printf 'block'; return
  fi

  # ---- BLOCK: invocation — "railway" in COMMAND POSITION ----------------
  # Command position = string start OR immediately after a shell separator
  # ( ; && || | newline ( ` $( ), optionally preceded by `sudo`, `command`, or
  # KEY=val env-assignment prefixes. WORD-BOUNDARY match on the command token,
  # NOT a bare substring, so `ls railway/` and `grep railway` stay allowed.
  #
  # Normalise separators to newlines, then check each segment's first word.
  local normalized
  normalized=$(printf '%s' "$scrubbed" \
    | sed -E 's/(\|\||&&|[;&|`]|\$\()/\n/g' \
    | tr '(' '\n')
  local line first
  while IFS= read -r line; do
    # Strip leading whitespace, then leading sudo / command / KEY=val prefixes.
    line="${line#"${line%%[![:space:]]*}"}"
    while :; do
      first="${line%%[[:space:]]*}"
      case "$first" in
        sudo|command)
          line="${line#"$first"}"
          line="${line#"${line%%[![:space:]]*}"}"
          ;;
        *=*)
          # env-assignment prefix (KEY=val) — only if KEY is a valid identifier.
          if [[ "${first%%=*}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            line="${line#"$first"}"
            line="${line#"${line%%[![:space:]]*}"}"
          else
            break
          fi
          ;;
        *)
          break
          ;;
      esac
    done
    first="${line%%[[:space:]]*}"
    # Match a bare `railway` OR a path whose basename is `railway`
    # (/usr/local/bin/railway, ./node_modules/.bin/railway, ~/.railway/bin/railway).
    if [[ "$first" == "railway" || "$first" == */railway ]]; then
      printf 'block'; return
    fi
  done <<EOF
$normalized
EOF

  printf 'allow'
}

# --------------------------------------------------------------------- selftest
if [[ "${1:-}" == "--selftest" ]]; then
  fails=0
  _expect() {
    local want="$1" cmd="$2" got
    got=$(_railway_verdict "$cmd")
    if [[ "$got" != "$want" ]]; then
      printf 'FAIL: expected %-5s got %-5s for: %s\n' "$want" "$got" "$cmd" >&2
      fails=$((fails + 1))
    fi
  }
  # BLOCK cases.
  _expect block 'npm install -g @railway/cli'
  _expect block 'npx @railway/cli up'
  _expect block 'npx railway up'
  _expect block 'npx railway@latest up'
  _expect block 'npm exec railway up'
  _expect block 'pnpm dlx @railway/cli up'
  _expect block 'pnpm add @railway/cli'
  _expect block 'yarn add railway'
  _expect block 'brew install railwayapp/railway/railway'
  _expect block 'curl -fsSL https://railway.app/install.sh | sh'
  _expect block 'curl -fsSL https://railway.com/install | bash'
  _expect block 'bash <(curl -fsSL https://sh.railway.app)'
  _expect block 'railway up'
  _expect block '/usr/local/bin/railway up'
  _expect block './node_modules/.bin/railway up'
  _expect block 'railway login'
  _expect block 'railway link'
  _expect block 'railway variables'
  _expect block 'sudo railway link'
  _expect block 'RAILWAY_TOKEN=abc railway variables'
  _expect block 'ls && railway up'
  _expect block 'echo hi; railway deploy'
  # ALLOW cases (approved GraphQL path / env vars / file-path tokens).
  _expect allow 'curl -sS https://backboard.railway.com/graphql/v2 -H "Project-Access-Token: $RAILWAY_TOKEN" -d "{}"'
  _expect allow 'echo $RAILWAY_PROJECT_ID'
  _expect allow 'echo ${RAILWAY_SERVICE_ID}'
  _expect allow 'cat claudomat-brain/monitors/railway-deploy.md'
  _expect allow 'grep -rn railway claudomat-brain/'
  _expect allow 'ls railway/'
  _expect allow 'cat railway-deploy.md'
  if (( fails > 0 )); then
    printf '%d selftest case(s) failed\n' "$fails" >&2
    exit 1
  fi
  printf 'railway-guard selftest OK\n'
  exit 0
fi

# ----------------------------------------------------- read hook stdin JSON
HOOK_JSON=""
if [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat || true)
fi
[[ -n "$HOOK_JSON" ]] || exit 0

# jq is required to parse the payload. Missing → fail open (one WARN).
if ! command -v jq >/dev/null 2>&1; then
  log_line "WARN jq not installed; failing open (cannot parse hook payload)"
  exit 0
fi

# Cheap pre-filter: the vast majority of Bash calls never mention railway. A
# bare substring test skips jq entirely for them. Any false positive falls
# through to the precise verdict below.
[[ "$HOOK_JSON" == *railway* ]] || exit 0

COMMAND=$(printf '%s' "$HOOK_JSON" | jq -r '.tool_input.command // ""' 2>/dev/null || printf '')
if [[ -z "$COMMAND" ]]; then
  # Unparseable payload or no command field → fail open (one WARN).
  log_line "WARN could not extract .tool_input.command; failing open"
  exit 0
fi

VERDICT=$(_railway_verdict "$COMMAND")
if [[ "$VERDICT" != "block" ]]; then
  exit 0
fi

# ----------------------------------------------------------------------- block
# Emit the PreToolUse deny payload. If jq fails to construct it, fail open.
if ! jq -n --arg reason "$BLOCK_REASON" \
     '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$reason}}' \
     2>/dev/null; then
  log_line "WARN jq failed to construct deny JSON; failing open"
  exit 0
fi
# Log a sanitized one-liner (strip control chars so a crafted command can't
# fabricate log lines).
CMD_SAFE=$(printf '%s' "$COMMAND" | tr -d '[:cntrl:]' | cut -c1-200)
log_line "block: $CMD_SAFE"
exit 0
