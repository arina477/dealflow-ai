"""Dump a raw Interactions API payload for debugging."""
from __future__ import annotations

import json
import sys

from deep_research import fetch


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python scripts/inspect_interaction.py <interaction_id> [out.json]", file=sys.stderr)
        return 2
    iid = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None
    inter = fetch(iid)
    text = json.dumps(inter, indent=2, ensure_ascii=False, default=str)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {out} ({len(text)} chars)", file=sys.stderr)
    else:
        print(text[:20000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
