"""Gemini Deep Research via the Interactions REST API.

Defaults to the standard Deep Research agent
(`deep-research-preview-04-2026`) — the lower-cost, lower-latency path. Pass
`--max` to select the comprehensive Deep Research Max agent
(`deep-research-max-preview-04-2026`) only when a run genuinely needs it.

The official Deep Research agent is only available through the Interactions API,
so this script calls `POST /v1beta/interactions` and polls
`GET /v1beta/interactions/{id}` directly.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Optional, List, Tuple, Set

import requests

STANDARD_AGENT = "deep-research-preview-04-2026"
MAX_AGENT = "deep-research-max-preview-04-2026"
DEFAULT_AGENT = STANDARD_AGENT
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
API_REVISION = "2026-05-20"


def _api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("ERROR: neither GEMINI_API_KEY nor GOOGLE_API_KEY is set", file=sys.stderr)
        sys.exit(2)
    return key


def _http(method: str, url: str, body: Optional[dict] = None, timeout: int = 120) -> dict:
    headers = {
        "x-goog-api-key": _api_key(),
        "Content-Type": "application/json",
        "Api-Revision": API_REVISION,
    }
    resp = requests.request(method, url, headers=headers, json=body, timeout=timeout)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    return resp.json()


def create(prompt: str, agent: str, collaborative_planning: bool) -> str:
    agent_config = {
        "type": "deep-research",
        "thinking_summaries": "none",
        "visualization": "auto",
        "collaborative_planning": collaborative_planning,
    }
    body = {
        "input": prompt,
        "agent": agent,
        "agent_config": agent_config,
        "background": True,
        "store": True,
    }
    resp = _http("POST", BASE_URL, body)
    iid = resp.get("id") or resp.get("name")
    if not iid:
        raise RuntimeError(f"No interaction id in response: {resp}")
    return iid


def fetch(interaction_id: str) -> dict:
    url = f"{BASE_URL}/{interaction_id}?include_input=true"
    return _http("GET", url)


def _terminal_status(status: str) -> bool:
    return status in {"completed", "succeeded", "failed", "cancelled", "canceled"}


def _extract(inter: dict) -> str:
    outputs = inter.get("outputs") or []
    body_parts: List[str] = []
    sources: List[Tuple[str, str]] = []
    seen_urls: Set[str] = set()

    for out in outputs:
        if out.get("type") and out["type"] != "text":
            continue
        text = out.get("text") or ""
        annos = out.get("annotations") or []
        inserts: List[Tuple[int, str]] = []
        for a in annos:
            url = a.get("url") or a.get("uri")
            title = a.get("title") or url or ""
            if not url:
                continue
            if url not in seen_urls:
                seen_urls.add(url)
                sources.append((title, url))
            idx = next(i + 1 for i, (_, u) in enumerate(sources) if u == url)
            end = a.get("end_index")
            if isinstance(end, int) and end >= 0:
                inserts.append((end, f"[{idx}]"))
        if inserts:
            inserts.sort(key=lambda x: x[0], reverse=True)
            buf = list(text)
            for pos, tag in inserts:
                buf.insert(min(pos, len(buf)), tag)
            text = "".join(buf)
        if text:
            body_parts.append(text)

    body = "\n\n".join(body_parts).strip() or "(empty response)"
    lines = [body, "", "## Sources", ""]
    if sources:
        for i, (title, url) in enumerate(sources, 1):
            lines.append(f"{i}. [{title}]({url})")
    else:
        lines.append("_(No grounding sources returned.)_")
    return "\n".join(lines)


def poll_until_done(iid: str, interval: int, timeout: int) -> dict:
    deadline = time.time() + timeout
    last_status = None
    while time.time() < deadline:
        inter = fetch(iid)
        status = inter.get("status") or "unknown"
        if status != last_status:
            print(f"[deep] {iid} status={status}", file=sys.stderr)
            last_status = status
        if _terminal_status(status):
            return inter
        time.sleep(interval)
    raise TimeoutError(f"Timed out after {timeout}s waiting for {iid}")


def write_output(inter: dict, out_path: Optional[str]) -> None:
    md = _extract(inter)
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"Wrote {out_path}", file=sys.stderr)
    else:
        print(md)


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    for name in ("run", "start"):
        p = sub.add_parser(name)
        p.add_argument("prompt")
        p.add_argument("--out")
        p.add_argument("--agent", default=DEFAULT_AGENT,
                       help=f"Agent id (default {DEFAULT_AGENT})")
        p.add_argument("--standard", action="store_true",
                       help=f"Shortcut for --agent {STANDARD_AGENT} (default)")
        p.add_argument("--max", action="store_true",
                       help=f"Shortcut for --agent {MAX_AGENT}")
        p.add_argument("--interval", type=int, default=20)
        p.add_argument("--timeout", type=int, default=3600)
        p.add_argument("--collaborative-planning", action="store_true")

    pp = sub.add_parser("poll")
    pp.add_argument("interaction_id")
    pp.add_argument("--out")
    pp.add_argument("--interval", type=int, default=20)
    pp.add_argument("--timeout", type=int, default=3600)

    args = ap.parse_args()

    if args.cmd in ("run", "start"):
        agent = STANDARD_AGENT if getattr(args, "standard", False) else args.agent
        if getattr(args, "max", False):
            agent = MAX_AGENT
        iid = create(args.prompt, agent, args.collaborative_planning)
        print(f"interaction_id={iid} agent={agent}", file=sys.stderr)
        if args.cmd == "start":
            print(iid)
            return 0
        inter = poll_until_done(iid, args.interval, args.timeout)
        status = inter.get("status")
        if status not in ("completed", "succeeded"):
            print(f"[deep] ended with status={status}", file=sys.stderr)
            write_output(inter, args.out)
            return 1
        write_output(inter, args.out)
        return 0

    if args.cmd == "poll":
        inter = poll_until_done(args.interaction_id, args.interval, args.timeout)
        status = inter.get("status")
        write_output(inter, args.out)
        return 0 if status in ("completed", "succeeded") else 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
