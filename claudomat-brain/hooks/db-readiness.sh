#!/usr/bin/env bash
# claudomat db-readiness — SessionStart guard that refuses to let a brain
# session start without CLAUDOMAT_DB_URL set to a postgres-shaped URL.
#
# Triggered by the SessionStart hook event. Wired into ~/.claude/settings.json
# automatically by `claudomat sync` (see _db_readiness_install in lib/claudomat/commands/hooks/permanent_hooks.bash).
# No uninstall — the guard is a permanent part of claudomat.
#
# Project scope: walks up from the session's cwd to find a directory
# containing claudomat-brain/. Outside brain projects, exits 0 silently so
# non-claudomat sessions on the host are unaffected. Inside a brain project,
# CLAUDOMAT_DB_URL is required; missing / empty / non-postgres URL → exit 2
# with a sentinel-prefixed stderr message.
#
# Sentinel: the first stderr line begins with `[claudomat-db-readiness-FAIL]`.
# Claude Code wraps SessionStart stderr in a system-reminder; the brain's
# CLAUDE.md rule 13 obligates an immediate STATUS=BLOCKED write on seeing
# the sentinel. Exit 2 is belt-and-suspenders: it's the documented hard-fail
# signal and (in versions of Claude Code that honour it) blocks session start
# entirely; the sentinel covers versions that don't.
#
# Source of truth: claudomat repo, claudomat-brain/hooks/db-readiness.sh.
# Refreshed onto host at ~/.claude/hooks/db-readiness.sh by `claudomat sync`.

set -uo pipefail

# -------------------------------------------------------- read hook stdin JSON
# Claude Code passes {session_id, transcript_path, cwd, hook_event_name, ...}
# via stdin to every hook. We need .cwd to find the project root.
HOOK_JSON=""
if [[ ! -t 0 ]]; then
  HOOK_JSON=$(cat || true)
fi

HOOK_CWD=""
if [[ -n "$HOOK_JSON" ]] && command -v jq >/dev/null 2>&1; then
  HOOK_CWD=$(printf '%s' "$HOOK_JSON" | jq -r '.cwd // ""' 2>/dev/null || printf '')
fi
# Fall back to PWD if stdin JSON was absent / unparseable. Reject non-absolute
# values — walk-up below loops on dirname() and a relative path would never
# terminate at "/".
[[ "$HOOK_CWD" == /* ]] || HOOK_CWD="$PWD"
[[ "$HOOK_CWD" == /* ]] || exit 0

# -------------------------------------------------- project scope: brain only
# Walk up from cwd looking for a sibling claudomat-brain/ directory. Without
# one, this is not a brain session and the gate does not apply.
in_brain=0
dir="$HOOK_CWD"
while [[ -n "$dir" && "$dir" != "/" ]]; do
  if [[ -d "$dir/claudomat-brain" ]]; then
    in_brain=1
    break
  fi
  dir="$(dirname "$dir")"
done

[[ "$in_brain" -eq 1 ]] || exit 0

# --------------------------------------------------- env-var + URL-shape check
URL="${CLAUDOMAT_DB_URL:-}"

emit_fail() {
  local headline="$1"
  cat >&2 <<EOF
[claudomat-db-readiness-FAIL] ${headline}
Brain refuses to start without a configured database.

This env var is normally injected by claudomat-studio when it spawns
the brain process. Studio constructs it from its own DATABASE_URL +
CLAUDOMAT_BRAIN_PASSWORD with role=claudomat_brain.

If you are running the brain outside studio, export
CLAUDOMAT_DB_URL=postgresql://claudomat_brain:<password>@<host>/<db>
yourself before starting the session.

Run \`claudomat doctor\` for the full [db-readiness] diagnostic.
EOF
  exit 2
}

[[ -n "$URL" ]] || emit_fail "CLAUDOMAT_DB_URL is not set."

case "$URL" in
  postgresql://*|postgres://*) : ;;
  *)
    emit_fail "CLAUDOMAT_DB_URL is set but does not start with postgresql:// or postgres://."
    ;;
esac

# ----------------------------------------- project-context readiness (fail-soft)
# After the URL is shape-valid, sanity-check that the DB resolves a project for
# this connection's role: request_project_id() (shipped by studio's multi-tenant
# keystone) exists and returns a non-empty id. This is a HEADS-UP only — a
# missing function (pre-keystone DB), an empty result (role not yet mapped to a
# project), or a brief connection hiccup must NOT block the session: project_id
# is applied by a column DEFAULT, so brain SQL keeps working. So emit a WARNING
# (deliberately NOT the [claudomat-db-readiness-FAIL] sentinel — that is a
# hard-stop per claudomat-brain/CLAUDE.md rule 13) and exit 0. Skipped entirely
# when psql is unavailable (e.g. running outside a worker image).
if command -v psql >/dev/null 2>&1; then
  pid="$(PGCONNECT_TIMEOUT=5 psql "$URL" -tAXc "SELECT request_project_id()" 2>/dev/null | tr -d '[:space:]')"
  if [[ -z "$pid" ]]; then
    cat >&2 <<'WARN'
[claudomat-db-readiness-WARN] project context not resolvable yet
request_project_id() returned no project id for this connection. The session
continues (project_id is filled by a column DEFAULT, so brain SQL still works).
Causes: a pre-keystone database without the resolver, a connection role not yet
mapped to a project, or a brief unreachable DB. If later writes fail with a
permission or row-security error, check CLAUDOMAT_DB_URL's role and its
brain_role_projects mapping. Run `claudomat doctor` for the [db-readiness] check.
WARN
  fi
fi

exit 0
