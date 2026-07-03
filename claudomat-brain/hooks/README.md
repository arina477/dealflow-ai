# claudomat-brain/hooks

Shell hooks that ship through claudomat's brain → host sync.

When `claudomat sync` runs in any consumer project, every executable script in
this directory is mirrored to `~/.claude/hooks/<name>` mode 0755 (only if the
content differs — no churn). Same pattern `cmd_sync` already uses for
`~/.claude/agents/` and `~/.claude/skills/`.

Host-level `~/.claude/settings.json` references hooks by **command name**, not
absolute path:

```json
{
  "hooks": {
    "Stop": [
      { "matcher": "",
        "hooks": [
          { "type": "command",
            "command": "claudomat archive snapshot",
            "_claudomat_archive": true }
        ] }
    ]
  }
}
```

The `claudomat archive snapshot` subcommand `exec`s the corresponding script
under `~/.claude/hooks/`. This indirection keeps settings.json portable across
machines (no `$HOME` hard-coded) and guarantees every host runs the script
version its brain was synced to.

Exact hook behavior lives in each script's header comments and implementation.
Exact settings.json merge behavior lives in
`lib/claudomat/commands/hooks/permanent_hooks.bash`,
`lib/claudomat/commands/hooks/env_persist.bash`, or
`lib/claudomat/commands/archive/host_hooks.bash`.

## Currently shipped

| Script | Triggered by | Purpose |
| ------ | ------------ | ------- |
| `snapshot-sessions.sh` | Stop + SessionEnd via `claudomat archive snapshot` | Optional archive snapshot. Installed by `claudomat archive install`; command behavior lives in `archive.bash`. |
| `autonomous-guard.sh` | Stop via `claudomat autonomous-guard` | Permanent autonomous-mode stop guard. Auto-wired by `claudomat sync`. |
| `db-readiness.sh` | SessionStart via `claudomat db-readiness` | Permanent project-scoped DB readiness guard. Auto-wired by `claudomat sync`. |
| `railway-guard.sh` | PreToolUse(Bash) via `claudomat railway-guard` | Blocks installing or invoking the Railway CLI, redirects to the GraphQL API. Auto-wired by `claudomat sync`. |
| `env-persist.sh` | PostToolUse(Bash) via `claudomat env-persist hook` | Worker-only env persistence hook. Wired by `claudomat env-persist install`, not by `claudomat sync`. |

## Adding a new hook

1. Drop `claudomat-brain/hooks/<name>.sh` here, chmod +x, executable.
2. Next `claudomat sync` mirrors it to `~/.claude/hooks/<name>.sh`.
3. Add a CLI subcommand in the claudomat CLI modules that `exec`s the script (so
   `~/.claude/settings.json` can refer to a stable command name). For
   auto-synced hooks this is the only user-visible CLI surface; for
   CLI-installed hooks, add install/uninstall sub-subcommands per step 4.
4. Wire it into host settings. Three patterns are in use:
   - **CLI-installed hooks** (e.g. archive): ship a dedicated `install` / `uninstall`
     pair on the CLI that idempotently jq-merges hook entries into
     `~/.claude/settings.json`, tagging entries with a marker (e.g.
     `_claudomat_archive: true`) so `uninstall` removes only what claudomat
     added. Pattern reference: Phase 6g (archive hook).
   - **Manual-snippet hooks** (e.g. SessionStart drift detector): document a manual
     JSON snippet that the user pastes into `~/.claude/settings.json` once.
     No install subcommand, no marker. Pattern reference: Phase 6f.
   - **Auto-synced hooks** (e.g. autonomous-guard / db-readiness): `claudomat sync` calls an
     internal `_<name>_install` function that idempotently jq-merges the
     entry. No user-facing install / uninstall — the hook is a permanent
     part of claudomat that every project gets on every sync. Use this
     pattern only for hooks that should never be optional. Pattern reference:
     `_autonomous_guard_install` and `_db_readiness_install` in
     `lib/claudomat/commands/hooks/permanent_hooks.bash`.

   For CLI-installed and manual-snippet hooks, document the setup steps as a
   new section in `claudomat-brain/setup-tools/install.md`. For auto-synced hooks, add a
   one-line cross-reference in `install.md` noting the hook is auto-installed
   by `claudomat sync` with no manual step required.
5. Add a row to the table above.

Hooks come in two classes; rules differ:

**Side-effect hooks** (e.g. `snapshot-sessions.sh`) — fire-and-forget work
that must never gate the session lifecycle:

- Exit `0` unconditionally — never block Claude Code's session lifecycle.
- Detach to background if the work is non-trivial (target ~50 ms foreground
  budget). The standard pattern is at the top of `snapshot-sessions.sh`.

**Decision hooks** (e.g. `autonomous-guard.sh`) — synchronous hooks that enforce
a contract by returning JSON:

- Exit `0` always — "decision: block" is the JSON return path, not a
  non-zero exit. Non-zero exit is reserved for genuine errors.
- Emit `{"decision":"block","reason":"<text>"}` to stdout to inject
  `reason` as a system message and re-prompt the orchestrator. Emit
  nothing (or a literal allow payload) to permit the stop.
- Stay synchronous — no background fork (the decision IS the output).
- Fail open on unexpected tooling conditions unless the script's own header
  documents a deliberate hard-fail sentinel.

Both classes must also:

- Be portable bash (`bash 3.2+`, no GNU-only flag assumptions).
- Tolerate missing dependencies cleanly (`command -v rclone || exit 0`,
  one-line WARN to log).
- Log to `~/.config/claudomat/<hook>.log` with size-based rotation.
