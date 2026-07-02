---
name: gemini-deep-research
description: Query Google Gemini for literature research. Use whenever the user wants Gemini / Google Deep Research / grounded literature exploration, e.g. 让 Gemini 查文献、Deep Research、综述调研、grounded search。Two modes — fast (quick) and deep (async start+poll), both via the Interactions API and defaulting to the standard Deep Research agent `deep-research-preview-04-2026`; pass `--max` for Deep Research Max `deep-research-max-preview-04-2026`. Outputs markdown with citation URLs suitable for feeding into citation-assistant to produce BibTeX.
---

# Gemini Deep Research Skill

## When to use

- User wants literature coverage / state-of-the-art survey on a topic.
- User has `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and wants grounded, cited answers rather than unguided LLM output.
- User has started a review/thesis and needs a first pass of citations before running `citation-assistant` on each claim.

## Two modes

| Mode | Backend | Default model / agent | Latency | Use when |
|---|---|---|---|---|
| `fast` | **Interactions REST API** `POST /v1beta/interactions` with `background=true` | `deep-research-preview-04-2026` | minutes | single-question lookup, quick survey of a narrow topic |
| `deep` | **Interactions REST API** `POST /v1beta/interactions` with `background=true` | `deep-research-preview-04-2026` (`--max` for `deep-research-max-preview-04-2026`) | minutes (≤60 min with `--max`) | async / long-running research, collaborative planning; `--max` for max comprehensiveness |

Both modes use the **official Gemini Deep Research Interactions API**. The standard agent is the low-cost / faster path; the Max agent is the comprehensive path. Gemini Deep Research is not available through `generate_content`.

Both modes read the API key from `GEMINI_API_KEY` first, then fall back to `GOOGLE_API_KEY`.

## Prerequisites

- Python 3.10+ with pinned deps installed from `requirements.txt` (`requests==2.34.2`, `httpx==0.28.1`; `httpx` is used by `scripts/resolve_redirects.py`). The core scripts call the Interactions REST endpoint directly.
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` exported. The `.bashrc` on this machine already exports `GOOGLE_API_KEY`, so no extra setup is needed.
- Deep Research is billed only on paid tiers. Budget: ~900k input / ~80k output tokens per `max` run.

## Scripts

All scripts live under `${CLAUDE_SKILL_ROOT}/scripts/`:

### 1. `search_grounded.py` — fast mode (Deep Research)

> Run from the skill root (`~/.claude/skills/gemini-deep-research/`), or substitute the absolute path. The `scripts/...` paths below are relative to that root.

```
python3 scripts/search_grounded.py "<query>" [--out report.md] [--interval 10] [--timeout 1800]
```

Asynchronous start + poll wrapper around `deep-research-preview-04-2026`. Returns a markdown file with the answer followed by a numbered `## Sources` section (title + URL per citation).

### 2. `deep_research.py` — deep mode (Deep Research agent)

```
# Blocking run (start + poll until completion):
python3 scripts/deep_research.py run "<research prompt>" --out report.md [--interval 20] [--timeout 3600] [--collaborative-planning]

# Or split the two steps:
python3 scripts/deep_research.py start "<research prompt>"                 # prints interaction_id
python3 scripts/deep_research.py poll  <interaction_id> --out report.md
```

Flags:
- Default agent: `deep-research-preview-04-2026` (standard — the lower-cost, lower-latency path).
- `--standard` selects `deep-research-preview-04-2026` (the default).
- `--max` explicitly selects `deep-research-max-preview-04-2026` (Max — opt-in; no longer the default).
- `--collaborative-planning` returns the agent's research plan first instead of executing immediately (multi-turn continuation supported).

### 3. `extract_urls.py` — bridge to citation-assistant

```
python3 scripts/extract_urls.py report.md > urls.txt
```

Pulls every unique URL from the report. Pipe each URL (or its DOI / arXiv id) into `citation-assistant`'s `doi2bibtex.sh` / `s2_search.sh` to produce clean `ref.bib` entries.

## Prompt policy

When invoking this skill, keep the prompt concise, direct, and open-ended. Deep Research performs its own planning, search expansion, reading, and synthesis; do not pre-load it with a long checklist of subquestions or a large list of candidate methods unless the user explicitly asks for those exact constraints.

Default prompt shape:

```
Research <topic>. Output a Chinese structured review covering key methods, representative papers, applications, limitations, and citation links.
```

For deep / max mode, only add one short sentence for the desired depth:

```
Deeply research <topic>. Output a Chinese structured review covering key methods, representative papers, open-source implementations, applications, technical bottlenecks, future directions, and citation links.
```

Good prompts:
- `调研倒空间长程相互作用神经网络势函数，输出中文综述，包含关键方法、代表论文、适用场景、局限和引用链接。`
- `深入调研 reciprocal-space long-range interactions in neural network interatomic potentials，输出中文结构化综述，覆盖主要方法、代表论文、开源实现、应用体系、技术瓶颈和未来方向，并附引用链接。`

Avoid prompts that enumerate many speculative candidate models, force a rigid outline, or bundle every possible verification question into the initial request. Use follow-up focused prompts after the first report if a section needs expansion or correction.

## Recommended workflow

1. Broad topic → `deep_research.py run` with a concise direct prompt ("Deeply research X. Output a Chinese structured review with key methods, papers, applications, limitations, and citation links."). Result: `report.md` with inline `[n]` citations and a numbered sources list.
2. For each `[CITE]` placeholder or claim in your `main_draft.tex`, re-run `search_grounded.py` with a focused query on the standard Deep Research agent.
3. `extract_urls.py report.md` → feed URLs into `citation-assistant` to get BibTeX, merge into `ref.bib`.
4. Let `academic-writing-review` / `bibliography-auditor` agents verify references before committing.

## Cost notes

- standard agent (`deep-research-preview-04-2026`) — fast mode, and the default for deep mode: typical moderate query uses ~80 search queries and can take several minutes.
- Max agent (`deep-research-max-preview-04-2026`) — deep mode with `--max`: up to ~160 search queries and up to 60 min for broad due-diligence style prompts.

## API key safety

- Never hard-code the key in scripts or commit it to git.
- Scripts exit with a clear error if both `GEMINI_API_KEY` and `GOOGLE_API_KEY` are unset.
