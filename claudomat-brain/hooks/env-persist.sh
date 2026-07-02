#!/usr/bin/env bash
# claudomat env-persist hook (PostToolUse / Bash).
# Captures `export KEY=<literal>` the brain runs and upserts it into
# ~/.config/claudomat/runtime.env on the volume, so the value survives the
# brain's later shells AND a worker redeploy.
#
# CONSUMER (other repo) — keep the on-disk format in sync with the reader:
#   repo `claudomat-studio` -> deploy/worker/server/src/lib/spawn.ts
#        loadRuntimeEnv() parses this file into the claude pane env and sets
#        BASH_ENV to it for in-session visibility.
#   repo `claudomat-studio` -> deploy/worker/server/src/lib/project-paths.ts
#        runtimeEnvPath() defines this path.
#   repo `claudomat-studio` -> deploy/worker/worker-entrypoint.sh
#        installs this hook (`claudomat env-persist install`) on every boot.
# Paths are RELATIVE TO THE `claudomat-studio` REPO ROOT — repos are cloned
# standalone; never use absolute paths or `../`.
#
# File format (one var per line; both sourceable by bash and parseable by TS):
#   export KEY='VALUE'   # VALUE single-quoted; literal ' escaped as '\''
# Captured input may be unquoted, '...'- or "..."-quoted (or a concatenation);
# the value is shell-dequoted WITHOUT expansion and re-emitted single-quoted.
# Upsert: at most one line per KEY (last write wins). Skipped: NEVER-PERSIST
# keys, values holding an unresolved $ or backtick, and multi-line values.
#
# Source of truth: claudomat repo, claudomat-brain/hooks/env-persist.sh.
# Refreshed onto the host at ~/.claude/hooks/env-persist.sh by `claudomat sync`,
# but only WIRED into settings.json on the worker (see header above) — on a
# laptop it sits inert so brain sessions don't get a hook on every Bash call.

# shellcheck disable=SC1003  # the '\' literals below intentionally match/emit a single backslash
set -uo pipefail
umask 077   # runtime.env + lock end up mode 600

# Always exit 0 — a PostToolUse hook must never block the tool that just ran.

# --------------------------------------------------------------- parsing helpers
# _dequote: shell-dequote one assignment RHS token (no expansion — $/backtick
# values are filtered out before this is called). Concatenates the literal
# contents of '...' and "..." runs and unquoted runs, applying backslash
# escapes outside single quotes, exactly how the shell builds the value.
_dequote() {
  local s="$1"
  local n=${#s} i=0 c d nx out=""
  while (( i < n )); do
    c="${s:i:1}"
    if [[ "$c" == "'" ]]; then
      ((i++))
      while (( i < n )); do
        d="${s:i:1}"
        [[ "$d" == "'" ]] && { ((i++)); break; }
        out+="$d"; ((i++))
      done
    elif [[ "$c" == '"' ]]; then
      ((i++))
      while (( i < n )); do
        d="${s:i:1}"
        [[ "$d" == '"' ]] && { ((i++)); break; }
        if [[ "$d" == '\' ]] && (( i+1 < n )); then
          nx="${s:i+1:1}"
          case "$nx" in
            '"'|'\') out+="$nx"; ((i+=2));;     # only \" and \\ are escapes here
            *)       out+='\'; ((i++));;        # other backslashes stay literal
          esac
        else
          out+="$d"; ((i++))
        fi
      done
    elif [[ "$c" == '\' ]] && (( i+1 < n )); then
      out+="${s:i+1:1}"; ((i+=2))
    else
      out+="$c"; ((i++))
    fi
  done
  printf '%s' "$out"
}

# _collect_exports: tokenise a Bash command line quote-aware (no expansion) and
# append every `export KEY=VALUE` assignment to the KEYS/VALS arrays. Mirrors
# the shell's own tokenisation: split into commands on unquoted ; && || | &
# newline, split each command into words on unquoted whitespace, and treat each
# KEY=word arg of an `export` command as an assignment. Values with an
# unresolved $ / backtick / newline are skipped — we only see command text, not
# the runtime value, and the on-disk format is one line per var.
_collect_exports() {
  local s="$1"
  local n=${#s} i=0 c
  local q="" word="" seen=0 pending_newcmd=1 word_newcmd=0
  local -a WORDS=() NEWCMD=()

  while (( i < n )); do
    c="${s:i:1}"
    if [[ -n "$q" ]]; then
      (( seen )) || { seen=1; word_newcmd=$pending_newcmd; pending_newcmd=0; }
      word+="$c"
      if [[ "$q" == '"' && "$c" == '\' ]] && (( i+1 < n )); then
        word+="${s:i+1:1}"; ((i+=2)); continue   # keep escaped char inside "..."
      fi
      [[ "$c" == "$q" ]] && q=""
      ((i++)); continue
    fi
    case "$c" in
      \'|\")
        (( seen )) || { seen=1; word_newcmd=$pending_newcmd; pending_newcmd=0; }
        q="$c"; word+="$c"; ((i++));;
      '\')
        (( seen )) || { seen=1; word_newcmd=$pending_newcmd; pending_newcmd=0; }
        word+="$c"
        if (( i+1 < n )); then word+="${s:i+1:1}"; ((i+=2)); else ((i++)); fi;;
      ' '|$'\t')
        (( seen )) && { WORDS+=("$word"); NEWCMD+=("$word_newcmd"); word=""; seen=0; }
        ((i++));;
      ';'|$'\n')
        (( seen )) && { WORDS+=("$word"); NEWCMD+=("$word_newcmd"); word=""; seen=0; }
        pending_newcmd=1; ((i++));;
      '&'|'|')
        (( seen )) && { WORDS+=("$word"); NEWCMD+=("$word_newcmd"); word=""; seen=0; }
        pending_newcmd=1; ((i++))
        [[ "${s:i:1}" == "$c" ]] && ((i++));;    # collapse && / ||
      '#')
        if (( seen )); then
          word+="$c"; ((i++))                    # mid-word '#': literal (e.g. a URL fragment)
        else
          # '#' at a word boundary starts a comment — skip to the next newline
          # (which then ends the command), matching how bash ignores it.
          while (( i < n )) && [[ "${s:i:1}" != $'\n' ]]; do ((i++)); done
        fi;;
      *)
        (( seen )) || { seen=1; word_newcmd=$pending_newcmd; pending_newcmd=0; }
        word+="$c"; ((i++));;
    esac
  done
  (( seen )) && { WORDS+=("$word"); NEWCMD+=("$word_newcmd"); }

  local j=0 w nc k raw in_export=0
  while (( j < ${#WORDS[@]} )); do
    w="${WORDS[$j]}"; nc="${NEWCMD[$j]}"
    if (( nc )); then
      [[ "$w" == "export" ]] && in_export=1 || in_export=0
    elif (( in_export )) && [[ "$w" == *=* ]]; then
      k="${w%%=*}"; raw="${w#*=}"
      if [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] \
         && [[ "$raw" != *'$'* && "$raw" != *'`'* && "$raw" != *$'\n'* ]]; then
        case "$k" in
          ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|PATH|HOME|PWD|OLDPWD|SHLVL|IFS|BASH_ENV) ;;
          *) KEYS+=("$k"); VALS+=("$(_dequote "$raw")");;
        esac
      fi
    fi
    ((j++))
  done
}

# ----------------------------------------------------- read hook stdin JSON
HOOK_JSON=""
if [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat || true)
fi
[[ -n "$HOOK_JSON" ]] || exit 0

# Hot path: the vast majority of Bash calls set no env var. A cheap bare-word
# substring test skips jq entirely for them. We match "export" WITHOUT a
# trailing space on purpose — in the JSON a tab/newline after the keyword is
# encoded as \t / \n, so requiring a literal space here would drop those. Any
# false positive just falls through to the precise checks below.
[[ "$HOOK_JSON" == *export* ]] || exit 0

command -v jq >/dev/null 2>&1 || exit 0

# tool_name + a single failed/interrupted flag in one jq pass (both scalars).
# PostToolUse generally does not fire for failed Bash commands, but guard
# anyway; the exit-code field spelling has varied across Claude Code versions,
# so accept either and treat "absent" as success.
TOOL_NAME=""
FAILED="0"
IFS=$'\t' read -r TOOL_NAME FAILED < <(
  printf '%s' "$HOOK_JSON" | jq -r '
    [ (.tool_name // ""),
      ( if (.tool_response.interrupted == true)
          or ((.tool_response.exitCode // .tool_response.exit_code // 0) != 0)
        then "1" else "0" end )
    ] | @tsv' 2>/dev/null || printf '\t'
)
[[ "$TOOL_NAME" == "Bash" ]] || exit 0
[[ "$FAILED" == "0" ]] || exit 0

# Command text on its own — may contain newlines/tabs that would break the
# @tsv read above.
COMMAND=$(printf '%s' "$HOOK_JSON" | jq -r '.tool_input.command // ""' 2>/dev/null || printf '')
# Require the WORD `export` followed by whitespace (space, tab, or newline) so a
# tab-separated `export<TAB>KEY=val` is not missed, while `myexport` / `exports`
# are. The tokenizer below is still authoritative; this only gates jq-parsed work.
[[ "$COMMAND" =~ (^|[^[:alnum:]_])export[[:space:]] ]] || exit 0

# --------------------------------------------------------------- parse exports
RUNTIME_ENV="${HOME}/.config/claudomat/runtime.env"
LOCK_FILE="${HOME}/.config/claudomat/runtime.env.lock"

declare -a KEYS=()
declare -a VALS=()
_collect_exports "$COMMAND"

[[ ${#KEYS[@]} -gt 0 ]] || exit 0

# --------------------------------------------------------------------- upsert
mkdir -p "$(dirname "$RUNTIME_ENV")"

# Serialise concurrent writers (rare — Bash calls are sequential within a
# session). flock is always present on the Linux worker; if absent, proceed.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -w 5 9 || exit 0
fi

# Self-heal: if the live file is not sourceable (e.g. an external writer left a
# broken line), set it aside so one bad line can neither wedge every future
# upsert nor keep breaking the consumer that sources it. A forensic copy stays
# at runtime.env.corrupt; the hook only ever writes balanced lines, so this can
# only be triggered by outside corruption.
if [[ -f "$RUNTIME_ENV" ]] && ! bash -n "$RUNTIME_ENV" 2>/dev/null; then
  mv -f "$RUNTIME_ENV" "${RUNTIME_ENV}.corrupt" 2>/dev/null || rm -f "$RUNTIME_ENV"
fi

i=0
while [[ $i -lt ${#KEYS[@]} ]]; do
  key="${KEYS[$i]}"
  val="${VALS[$i]}"
  i=$((i + 1))

  # POSIX single-quote escaping for the single-quoted file format:  ' -> '\''
  esc=${val//\'/\'\\\'\'}

  # Temp adjacent to the target so mv is an atomic same-filesystem rename.
  tmp=$(mktemp "${RUNTIME_ENV}.XXXXXX") || continue
  if [[ -f "$RUNTIME_ENV" ]]; then
    grep -v "^export ${key}=" "$RUNTIME_ENV" > "$tmp" || true   # drop old line for KEY
  fi
  printf "export %s='%s'\n" "$key" "$esc" >> "$tmp"

  # Keep the live file always valid for `source` / BASH_ENV. Belt-and-suspenders
  # after the self-heal above: drop this single write rather than poison the file.
  if bash -n "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$RUNTIME_ENV"
    chmod 600 "$RUNTIME_ENV" 2>/dev/null || true
  else
    rm -f "$tmp"
  fi
done

exit 0
