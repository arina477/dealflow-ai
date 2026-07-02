---
name: aidesigner
description: |
  Generate single-file HTML mockups from a design brief by calling aidesigner.ai's REST API. Use whenever a stage asks for `/aidesigner` — D-2 Variants (initial generation), D-3 Review-and-adopt (bounded refine loop, cap 3 iterations), and v7/v8/v9 onboarding stages (design direction, design system, page designs). Input: design brief + DESIGN-SYSTEM.md + target output path. Output: a complete `.html` file at the target path (one file per variant per gap).

  Use when: "/aidesigner", "/aidesigner refine_design", D-2 / D-3 of the design block, v7 / v8 / v9 of onboarding.
preamble-tier: 2
version: 1.0.0
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - Bash(curl*)
  - Bash(jq*)
  - Bash(test*)
---

# /aidesigner — HTML mockup generator (aidesigner.ai REST)

Generate single-file HTML mockups by calling [aidesigner.ai's](https://www.aidesigner.ai/docs/api) `POST /api/v1/generateDesign` endpoint. claudomat-bundled; ships via `claudomat sync` to `~/.claude/skills/aidesigner/`. **No MCP** — pure REST with API-key auth.

## When to use

- **D-2 Variants** (`claudomat-brain/blocks/design/stages/D-2-variants.md`) — for each gap in the brief, generate one HTML variant per chosen direction. Output: `design/staging/<feature>.html`.
- **D-3 Review & adopt back-edge** (`claudomat-brain/blocks/design/stages/D-3-review-and-adopt.md`) — when D-3 returns REVISE, re-invoke with `--mode=refine` to iterate against the SAME staging path. Cap: 3 iterations per gap (D-3 enforces).
- **Onboarding v7 / v8 / v9** — design direction proposal, design system primitives, per-page mockups. Same flow as D-2.

## Prerequisites

- **`AIDESIGNER_API_KEY` exported** — see `~/.config/claudomat/shared.env`. Obtain from aidesigner.ai → Settings → API Keys. If unset, **stop and surface the gap** — do NOT attempt the call. The brain's `doctor` (`claudomat doctor`) verifies this; if you got here without the key, something upstream is broken.
- **A design brief** — Markdown content describing the gap, constraints, references, anti-references. D-1 produces this at `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md`. For onboarding stages, the brief is written in `process/session/onboarding/v<N>-direction-brief.md` or similar.
- **`design/DESIGN-SYSTEM.md`** — passed alongside the brief so the generator respects existing tokens / components.

## Pre-flight check

Run this first. If it prints `MISSING`, stop and tell the operator to set the key in `~/.config/claudomat/shared.env` and source it (or fix Railway env var on remote workers).

```bash
[[ -n "${AIDESIGNER_API_KEY:-}" ]] && echo "OK" || echo "MISSING"
```

## Recipe 1 — Initial generation (D-2, v7 direction, v8 primitives, v9 pages)

Inputs:
- `BRIEF_PATH` — path to the markdown brief
- `DESIGN_SYSTEM_PATH` — usually `design/DESIGN-SYSTEM.md` (may be absent at v7 — pass `/dev/null` then)
- `OUT_PATH` — target HTML path, e.g. `design/staging/<feature>.html`

```bash
BRIEF_PATH="process/waves/wave-3/stages/D-1-brief/checkout-brief.md"
DESIGN_SYSTEM_PATH="design/DESIGN-SYSTEM.md"
OUT_PATH="design/staging/checkout.html"

# Assemble the prompt: brief + design system inline as one user message.
PROMPT=$(cat <<EOF
$(cat "$BRIEF_PATH")

---

## Existing design system (respect tokens, components, conventions)

$(cat "$DESIGN_SYSTEM_PATH" 2>/dev/null || echo "(no design system yet — propose one consistent with the brief)")
EOF
)

# Call aidesigner.ai. `streaming: false` returns the full HTML in one JSON body
# instead of SSE chunks. `mode` left unset (default = generate from scratch).
RESP=$(jq -n --arg p "$PROMPT" '{prompt: $p, streaming: false}' \
  | curl -sS -w "\n%{http_code}" \
      -X POST https://api.aidesigner.ai/api/v1/generateDesign \
      -H "Authorization: Bearer $AIDESIGNER_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-)

HTTP=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')

if [[ "$HTTP" != "200" ]]; then
  echo "aidesigner.ai returned HTTP $HTTP:" >&2
  echo "$BODY" >&2
  exit 1
fi

# Response shape: JSON `{"success": true, "content": "<!DOCTYPE html>...", "usage": {...}}`.
# Extract `.content` (the HTML body) and write. If the response is malformed
# (jq parse fails, or `.content` absent), fall through to writing the raw body
# to disk + stderr so the operator can see what actually came back.
HTML=$(jq -r '.content // empty' <<<"$BODY" 2>/dev/null)
if [[ -z "$HTML" ]]; then
  echo "aidesigner.ai response missing .content field — writing raw body:" >&2
  printf '%s' "$BODY" >&2
  HTML="$BODY"
fi

mkdir -p "$(dirname "$OUT_PATH")"
printf '%s\n' "$HTML" > "$OUT_PATH"
echo "✓ wrote $OUT_PATH ($(wc -c < "$OUT_PATH") bytes)"
```

## Recipe 2 — Refine (D-3 back-edge)

Inputs: same as Recipe 1, plus:
- `PREV_HTML_PATH` — the previous variant at `$OUT_PATH` (which we'll overwrite)
- `FEEDBACK` — aggregated reviewer comments from D-3 (single string; structure freely)

Sends the conversation as `messages[]` so aidesigner.ai treats this as a continuation, not a restart.

```bash
BRIEF_PATH="process/waves/wave-3/stages/D-1-brief/checkout-brief.md"
DESIGN_SYSTEM_PATH="design/DESIGN-SYSTEM.md"
OUT_PATH="design/staging/checkout.html"
PREV_HTML_PATH="$OUT_PATH"
FEEDBACK="Reviewer feedback (D-3 iteration 2):
- Hero CTA contrast fails AA — make button background #1A1A1A on cream
- Form labels are too small (12px) — bump to 14px per design system body-small
- Move secondary 'Continue as guest' link below primary checkout — current placement competes"

USER_INITIAL=$(cat <<EOF
$(cat "$BRIEF_PATH")

---

## Existing design system

$(cat "$DESIGN_SYSTEM_PATH" 2>/dev/null || echo "(no design system yet)")
EOF
)

PREV_HTML=$(cat "$PREV_HTML_PATH")

# messages[] shape: user (initial brief) → assistant (previous HTML) → user (feedback)
RESP=$(jq -n \
    --arg u1 "$USER_INITIAL" \
    --arg a1 "$PREV_HTML" \
    --arg u2 "$FEEDBACK" \
    '{messages: [
       {role: "user",      content: $u1},
       {role: "assistant", content: $a1},
       {role: "user",      content: $u2}
     ], streaming: false}' \
  | curl -sS -w "\n%{http_code}" \
      -X POST https://api.aidesigner.ai/api/v1/generateDesign \
      -H "Authorization: Bearer $AIDESIGNER_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-)

HTTP=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')

if [[ "$HTTP" != "200" ]]; then
  echo "aidesigner.ai returned HTTP $HTTP:" >&2
  echo "$BODY" >&2
  exit 1
fi

HTML=$(jq -r '.content // empty' <<<"$BODY" 2>/dev/null)
if [[ -z "$HTML" ]]; then
  echo "aidesigner.ai response missing .content field — writing raw body:" >&2
  printf '%s' "$BODY" >&2
  HTML="$BODY"
fi

printf '%s\n' "$HTML" > "$OUT_PATH"
echo "✓ refined $OUT_PATH ($(wc -c < "$OUT_PATH") bytes)"
```

## Recipe 3 — Direction / inspire mode (optional)

aidesigner.ai supports `mode: "inspire"` / `mode: "clone"` / `mode: "enhance"` with a `url` parameter — extracts tokens from a reference site and uses them as the design direction. Useful at v7 (design direction proposal) when the founder provides a reference URL.

```bash
REFERENCE_URL="https://linear.app"
PROMPT="Propose a design direction for our app following Linear's clarity and pacing — but tuned for [project's vertical, e.g. healthcare ops]."

RESP=$(jq -n --arg p "$PROMPT" --arg u "$REFERENCE_URL" \
    '{prompt: $p, mode: "inspire", url: $u, streaming: false}' \
  | curl -sS -w "\n%{http_code}" \
      -X POST https://api.aidesigner.ai/api/v1/generateDesign \
      -H "Authorization: Bearer $AIDESIGNER_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-)
# (parsing same as Recipe 1)
```

## Output contract

- One `.html` file per invocation. Self-contained: inline `<style>`, no external assets (or only CDN-hosted ones). aidesigner.ai's default output respects this.
- Path is **always** chosen by the caller (the stage file), never by the skill. D-2 writes to `design/staging/<feature>.html`; v7/v8/v9 write under `design/staging/direction.html` / `design/staging/design-system.html` / `design/staging/<page>.html`.
- Overwrites the target path on refine (no version history at the file level — D-3 keeps prior iterations in its review notes).

## Error handling

- **HTTP 401** — `AIDESIGNER_API_KEY` is invalid or revoked. Rotate via aidesigner.ai dashboard, update `~/.config/claudomat/shared.env`, re-push to Railway env on remote workers, restart worker.
- **HTTP 429** — rate-limited. Back off (operator decides; D-2 / D-3 do not auto-retry in this iteration).
- **HTTP 5xx** — aidesigner.ai transient error. Retry once after ~10s; on second failure, escalate to operator (D-block hard-stop, do not silently degrade).
- **Empty / malformed body** — print raw body to stderr and fall through to writing it; the operator inspects the staging file to see what came back.

## API key safety

- Never hard-code the key in scripts or commit it to git.
- The skill exits with a clear error if `AIDESIGNER_API_KEY` is unset (see Pre-flight check above).
- On remote workers (brain-worker on Railway) the key is injected via Railway env vars, provisioned at deploy time by `claudomat-studio/deploy/new-client.mjs` from `~/.config/claudomat/shared.env`. The boot-time preflight in `worker-entrypoint.sh` refuses to start if the key is missing.

## Why REST and not the MCP server

aidesigner.ai also offers an OAuth-backed hosted MCP server at `https://api.aidesigner.ai/api/v1/mcp`. We deliberately **do not** use it — OAuth requires an interactive browser sign-in per worker, which breaks our hands-off `--yes` provisioning flow. The REST endpoint accepts the same input shape (prompt or messages[]) and returns the same HTML, with stable API-key auth that fits our `shared.env → Railway env vars` secret pipeline.
