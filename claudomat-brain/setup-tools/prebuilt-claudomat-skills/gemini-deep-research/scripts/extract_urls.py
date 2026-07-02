"""Extract unique URLs from a markdown report for downstream BibTeX lookup."""
import re
import sys

URL_RE = re.compile(r"https?://[^\s)\]}>,]+")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: extract_urls.py <report.md>", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        text = f.read()
    seen = set()
    for m in URL_RE.findall(text):
        u = m.rstrip(".,")
        if u not in seen:
            seen.add(u)
            print(u)
    return 0


if __name__ == "__main__":
    sys.exit(main())
