#!/usr/bin/env python3
"""
gemini-cross-review.py — single-shot, NON-AGENTIC cross-model review for the P-4 gate.

Reads the concatenated P-block spec (P-0/P-1/P-2/P-3) on stdin, sends ONE
generateContent request to the Gemini API (request carries NO `tools`, so the
model cannot enter an agentic tool loop), and prints an adversarial review.

Contract:
  exit 0  -> stdout is the review text (CONCERN / EVIDENCE / SUGGESTION)
  exit 3  -> stdout is "UNAVAILABLE: <reason>"  (no key / timeout / API error
             after one retry). Caller MUST degrade gracefully, never block.

Auth precedence matches the gemini-deep-research skill: GEMINI_API_KEY first,
then GOOGLE_API_KEY; header is x-goog-api-key. Stdlib only.

Env overrides (all optional):
  CLAUDOMAT_GEMINI_REVIEW_MODEL       default "gemini-2.5-pro"
  CLAUDOMAT_GEMINI_REVIEW_TIMEOUT     per-attempt seconds, default 45
  CLAUDOMAT_GEMINI_REVIEW_MAX_TOKENS  output-token ceiling, default 2048
"""
import json, os, sys, urllib.request, urllib.error


def _int_env(name: str, default: int) -> int:
    # Optional numeric overrides fall back to the default on a non-integer
    # value, so a misconfigured env var degrades to sane behavior instead of
    # crashing the helper with a traceback (which would break its exit-code
    # contract before main() ever runs).
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


MODEL      = os.environ.get("CLAUDOMAT_GEMINI_REVIEW_MODEL", "gemini-2.5-pro")
TIMEOUT    = _int_env("CLAUDOMAT_GEMINI_REVIEW_TIMEOUT", 45)
MAX_TOKENS = _int_env("CLAUDOMAT_GEMINI_REVIEW_MAX_TOKENS", 2048)
ATTEMPTS   = 2  # initial + one retry

PROMPT = (
    "You are an adversarial reviewer from a different model family than the author. "
    "Review ONLY the spec text provided below. Do NOT use tools, do NOT attempt to "
    "read files, do NOT run commands — everything you need is in the text below. "
    "Find the ONE thing most likely to be the wrong solution to a right problem, the "
    "wrong primitive, or a missing edge case. Focus: symptom-vs-cause, metric "
    "misalignment, band-aid over root cause, workaround becoming permanent feature, "
    "solving for the demo, over-engineering for one-off, missing failure mode. "
    "If nothing serious: say so explicitly. Output: max 200 words. "
    "Format: CONCERN (1-2 sentences) + EVIDENCE (quote from the spec) + SUGGESTION (1 sentence)."
)


def main() -> int:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("UNAVAILABLE: neither GEMINI_API_KEY nor GOOGLE_API_KEY is set")
        return 3
    spec = sys.stdin.read().strip()
    if not spec:
        print("UNAVAILABLE: empty spec on stdin")
        return 3

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    payload = json.dumps({
        "contents": [{"parts": [{"text": PROMPT + "\n\n---\nSPEC:\n" + spec}]}],
        # maxOutputTokens is a ceiling that must cover BOTH the model's internal
        # thinking budget AND the bounded (~200-word) answer: Gemini 2.5 Pro is a
        # thinking model and thinking tokens count against this limit. Too low and
        # thinking starves the answer -> empty text -> the helper degrades on every
        # call. The model stops at finishReason=STOP long before the ceiling, so a
        # generous value costs nothing on the happy path and stays inside TIMEOUT.
        # Tunable via CLAUDOMAT_GEMINI_REVIEW_MAX_TOKENS if a model needs more room.
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": MAX_TOKENS},
    }).encode()

    last = "unknown error"
    for attempt in range(1, ATTEMPTS + 1):
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = json.load(resp)
            # Defensive parse: a thinking model can return a candidate whose
            # `parts` is absent, [], or null (e.g. finishReason MAX_TOKENS/SAFETY).
            # Concatenate every text part; an empty result degrades with a clear
            # reason instead of letting an IndexError/TypeError become the reason.
            candidates = data.get("candidates") or []
            content = candidates[0].get("content", {}) if candidates else {}
            parts = content.get("parts") or []
            text = "".join(part.get("text", "") for part in parts).strip()
            if text:
                print(text)
                return 0
            last = f"no text in response (attempt {attempt})"
        except urllib.error.HTTPError as e:
            detail = e.read()[:200].decode(errors="replace")
            last = f"HTTP {e.code}: {detail}"
            if 400 <= e.code < 500 and e.code != 429:
                break  # bad key / bad model / bad request — a retry won't help
        except Exception as e:  # timeout, URLError, JSON decode, unexpected shape
            last = f"{type(e).__name__}: {e}"

    print(f"UNAVAILABLE: {last}")
    return 3


if __name__ == "__main__":
    sys.exit(main())
