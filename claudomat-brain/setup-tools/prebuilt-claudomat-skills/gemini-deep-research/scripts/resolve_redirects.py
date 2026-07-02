"""Resolve Google grounding-api-redirect URLs to canonical DOIs / arXiv IDs.

Usage: resolve_redirects.py <urls.txt> [--out resolved.tsv]

Input: one URL per line.
Output: TSV with columns: original_url, final_url, doi_or_arxiv_id.
"""
import argparse
import re
import sys
from urllib.parse import urlparse

import httpx

ARXIV_RE = re.compile(r"arxiv\.org/(abs|pdf)/([0-9]{4}\.[0-9]{4,5})")
DOI_RE = re.compile(r"(10\.\d{4,9}/[-._;()/:A-Z0-9]+)", re.I)


def resolve(url: str, timeout: float = 15.0) -> tuple[str, str]:
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout) as c:
            r = c.head(url)
            final = str(r.url)
    except Exception:
        return url, ""
    doi = ""
    m = ARXIV_RE.search(final)
    if m:
        doi = f"arXiv:{m.group(2)}"
    else:
        m = DOI_RE.search(final)
        if m:
            doi = m.group(1).rstrip(".,;")
    return final, doi


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls_file")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    with open(args.urls_file, encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip()]

    rows = []
    for u in urls:
        final, doi = resolve(u)
        rows.append((u, final, doi))
        print(f"{doi or '?'}\t{final}", file=sys.stderr)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write("original\tfinal\tdoi_or_arxiv\n")
            for r in rows:
                f.write("\t".join(r) + "\n")
    else:
        for r in rows:
            print("\t".join(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
