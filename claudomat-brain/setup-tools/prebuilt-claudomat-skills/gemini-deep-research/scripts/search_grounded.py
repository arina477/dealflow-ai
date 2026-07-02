"""Fast Gemini Deep Research call through the Interactions API.

Fast mode intentionally uses the standard Deep Research agent
(`deep-research-preview-04-2026`) rather than `generate_content`. Gemini's
Deep Research agent is not available through `generate_content`, and the
official API requires background Interactions polling.
"""
from __future__ import annotations

import argparse
import sys
import time
from typing import Optional

from deep_research import (
    STANDARD_AGENT,
    _extract,
    _terminal_status,
    create,
    fetch,
)


DEFAULT_AGENT = STANDARD_AGENT


def poll_until_done(iid: str, interval: int, timeout: int) -> dict:
    deadline = time.time() + timeout
    last_status: Optional[str] = None
    while time.time() < deadline:
        inter = fetch(iid)
        status = inter.get("status") or "unknown"
        if status != last_status:
            print(f"[fast] {iid} status={status}", file=sys.stderr)
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
    ap.add_argument("query")
    ap.add_argument("--out", default=None, help="Write markdown to file")
    ap.add_argument("--agent", default=DEFAULT_AGENT,
                    help=f"Agent id (default {DEFAULT_AGENT})")
    ap.add_argument("--interval", type=int, default=10)
    ap.add_argument("--timeout", type=int, default=1800)
    ap.add_argument("--collaborative-planning", action="store_true")
    args = ap.parse_args()

    iid = create(args.query, args.agent, args.collaborative_planning)
    print(f"interaction_id={iid} agent={args.agent}", file=sys.stderr)
    inter = poll_until_done(iid, args.interval, args.timeout)
    status = inter.get("status")
    write_output(inter, args.out)
    if status not in ("completed", "succeeded"):
        print(f"[fast] ended with status={status}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
