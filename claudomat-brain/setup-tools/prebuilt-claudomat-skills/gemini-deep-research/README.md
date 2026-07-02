# gemini-deep-research

A lightweight command-line toolkit and Claude Code **Skill** for running
Google Gemini's **Deep Research** and **Deep Research Max** agents from Python.

- `fast` mode — quick one-shot Deep Research via `deep-research-preview-04-2026`.
- `deep` mode — async start+poll Deep Research; `deep-research-preview-04-2026`
  by default, `--max` for `deep-research-max-preview-04-2026`.

Both modes emit markdown with a `## Sources` list suitable for downstream
citation pipelines (e.g. DOI / arXiv → BibTeX).

---

## Why

Gemini Deep Research is only available through the Interactions API; it cannot
be called through `generate_content`. This repo hits
`POST /v1beta/interactions` directly so both modes use the current documented
Deep Research agents.

## Install

This skill ships bundled with **claudomat** under
`claudomat-brain/setup-tools/prebuilt-claudomat-skills/gemini-deep-research/`. You don't
clone it directly — `claudomat init` (and `claudomat sync` thereafter) copies
the bundle wholesale during Phase 4b into your project's
`~/.claude/skills/gemini-deep-research/`, where Claude Code auto-discovers
`SKILL.md`.

Python deps are lazy / first-use. The scripts require Python 3.10+ and import `requests` and `httpx`
(`scripts/resolve_redirects.py`), so before the first invocation install:

```bash
cd ~/.claude/skills/gemini-deep-research
uv venv
uv pip install -r requirements.txt
```

Export an API key (the scripts check `GEMINI_API_KEY` first, then fall back
to `GOOGLE_API_KEY`):

```bash
export GEMINI_API_KEY="YOUR_KEY"
# or
export GOOGLE_API_KEY="YOUR_KEY"
```

Deep Research is billed on paid tiers only.

## Usage

### Fast mode — Deep Research

```bash
python scripts/search_grounded.py "What is the 2024 Nobel Prize in Physics awarded for?" \
    --out fast_report.md
```

Options:
- `--agent deep-research-preview-04-2026` (default).
- `--interval 10` / `--timeout 1800` — polling controls for the background task.

### Deep mode — async start + poll

```bash
# Blocking: start and poll until completion
python scripts/deep_research.py run "Survey recent advances in equivariant neural networks" \
    --out deep_report.md --interval 20 --timeout 3600
```

Split the steps if you want to disconnect and reconnect:

```bash
python scripts/deep_research.py start "Survey ..."            # prints interaction_id
python scripts/deep_research.py poll <interaction_id> --out deep_report.md
```

Flags:
- Default agent: `deep-research-preview-04-2026` (standard — lower cost/latency, ~80 sources).
- `--standard` — `deep-research-preview-04-2026` (the default).
- `--max` — explicitly select `deep-research-max-preview-04-2026` for maximum comprehensiveness (~60 min, up to 160 sources); opt-in.
- `--collaborative-planning` — agent returns a research plan first for multi-turn approval.

## Prompting

Use concise, direct prompts. Deep Research plans, searches, reads, and expands the topic on its own, so the initial prompt should name the topic and the desired output shape, not pre-load a long checklist.

Good default:

```text
Research <topic>. Output a Chinese structured review covering key methods, representative papers, applications, limitations, and citation links.
```

Good deep/max default:

```text
Deeply research <topic>. Output a Chinese structured review covering key methods, representative papers, open-source implementations, applications, technical bottlenecks, future directions, and citation links.
```

Avoid long prompts that enumerate many speculative candidate models, force a rigid outline, or bundle every possible verification question into the first request. Use follow-up focused prompts after the first report when a section needs expansion.

### Extract URLs for downstream BibTeX

```bash
python scripts/extract_urls.py deep_report.md > urls.txt
```

## Use as a Claude Code Skill

`claudomat init` / `claudomat sync` already lands the skill at
`~/.claude/skills/gemini-deep-research/` (Phase 4b wholesale copy), so Claude
Code auto-discovers `SKILL.md` on its own. Then ask Claude things like:

- “让 Gemini 查一下 [topic] 的文献”
- “run a deep research on [topic]”
- “grounded search for [question]”

and it will invoke the scripts with the right arguments.

## Files

| File | Purpose |
|---|---|
| `scripts/search_grounded.py` | Fast mode (REST Interactions API, standard Deep Research agent). |
| `scripts/deep_research.py` | Deep mode (REST Interactions API, standard Deep Research agent by default; `--max` for Deep Research Max). |
| `scripts/extract_urls.py` | Pulls unique URLs out of report markdown. |
| `scripts/run_many.py` | Batch runs multiple queries concurrently. |
| `scripts/resolve_redirects.py` | Resolves `vertexaisearch.cloud.google.com` redirect URLs to the real source domain. |
| `scripts/inspect_interaction.py` | Dumps raw interaction JSON for debugging. |
| `SKILL.md` | Claude Code Skill manifest. |

## License

MIT © 2026 Hongyu Yu
