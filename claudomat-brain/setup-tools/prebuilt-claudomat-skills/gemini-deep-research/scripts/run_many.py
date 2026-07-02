"""Launch many Deep Research jobs concurrently, poll all, write reports.

Usage:
    python run_many.py <prompts_dir> <output_dir> [--interval 30] [--timeout 7200]

Each file matching <prompts_dir>/*.prompt.txt becomes one Deep Research job.
Report is written to <output_dir>/<slug>.md (slug = filename stem without .prompt).
Status log appended to <output_dir>/_jobs.log.
"""
import argparse
import sys
import time
from pathlib import Path

from deep_research import DEFAULT_AGENT, _extract, create, fetch

AGENT = DEFAULT_AGENT


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("prompts_dir")
    ap.add_argument("output_dir")
    ap.add_argument("--interval", type=int, default=30)
    ap.add_argument("--timeout", type=int, default=7200)
    args = ap.parse_args()

    prompts_dir = Path(args.prompts_dir)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "_jobs.log"

    def log(msg: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    prompt_files = sorted(prompts_dir.glob("*.prompt.txt"))
    if not prompt_files:
        log(f"No *.prompt.txt in {prompts_dir}")
        return 1

    jobs: dict[str, dict] = {}
    for pf in prompt_files:
        slug = pf.stem.replace(".prompt", "")
        prompt = pf.read_text(encoding="utf-8").strip()
        out_path = out_dir / f"{slug}.md"
        if out_path.exists() and out_path.stat().st_size > 500:
            log(f"SKIP {slug} (report already exists, >500 bytes)")
            continue
        try:
            iid = create(prompt, AGENT, collaborative_planning=False)
            jobs[slug] = {"id": iid, "out": out_path, "done": False}
            log(f"STARTED {slug} id={iid} agent={AGENT}")
        except Exception as e:
            log(f"FAILED to start {slug}: {e}")

    if not jobs:
        log("No jobs started.")
        return 1

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        pending = [s for s, j in jobs.items() if not j["done"]]
        if not pending:
            log("All jobs finished.")
            return 0
        for slug in pending:
            j = jobs[slug]
            try:
                inter = fetch(j["id"])
                status = inter.get("status")
                log(f"{slug} status={status}")
                if status in ("completed", "succeeded", "done"):
                    md = _extract(inter)
                    j["out"].write_text(md, encoding="utf-8")
                    log(f"WROTE {j['out']}")
                    j["done"] = True
                elif status in ("failed", "cancelled", "canceled", "error"):
                    log(f"{slug} ended with status={status}")
                    j["done"] = True
            except Exception as e:
                log(f"{slug} poll error: {e}")
        time.sleep(args.interval)

    log("Timeout reached.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
