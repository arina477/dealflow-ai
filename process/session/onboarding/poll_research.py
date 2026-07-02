#!/usr/bin/env python3
"""Resumable poller for agent-creator research jobs (v12).
Reads .research-jobs.tsv (tag<TAB>iid<TAB>status), fetches each pending
interaction, and for terminal ones extracts the report to the archive path
and flips status to 'done' (or 'failed'). Restart-safe: rerun any time."""
import sys, os
sys.path.insert(0, os.path.expanduser("~/.claude/skills/gemini-deep-research/scripts"))
from deep_research import fetch, _extract, _terminal_status  # patched _extract (steps fallback)

BASE = "/home/claudomat/project"
JOBS = f"{BASE}/process/session/onboarding/.research-jobs.tsv"
ARCH = f"{BASE}/command-center/setup-tools/agent-creator/research"

rows = []
with open(JOBS) as f:
    for line in f:
        line = line.rstrip("\n")
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        rows.append(parts[:3])

changed = False
for r in rows:
    tag, iid, status = r
    if status != "pending":
        print(f"{status:8} {tag}")
        continue
    try:
        inter = fetch(iid)
    except Exception as e:
        print(f"ERR      {tag}: fetch failed: {e}")
        continue
    st = inter.get("status") or "unknown"
    if _terminal_status(st):
        report = _extract(inter)
        wc = len(report.split())
        if st in ("completed", "succeeded") and wc > 500:
            out = f"{ARCH}/{tag}-2026-07-01.md"
            with open(out, "w", encoding="utf-8") as fo:
                fo.write(report)
            r[2] = "done"
            changed = True
            print(f"DONE     {tag}  ({wc} words) -> {out}")
        else:
            r[2] = "failed"
            changed = True
            print(f"FAILED   {tag}  status={st} words={wc}")
    else:
        print(f"running  {tag}  status={st}")

if changed:
    with open(JOBS, "w") as f:
        for r in rows:
            f.write("\t".join(r) + "\n")

# summary
done = sum(1 for r in rows if r[2] == "done")
pend = sum(1 for r in rows if r[2] == "pending")
fail = sum(1 for r in rows if r[2] == "failed")
print(f"\nSUMMARY: {done} done, {pend} pending, {fail} failed, of {len(rows)}")
