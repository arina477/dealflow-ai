# Wave 29 — L-2 Distill
## Task close: 3 -> done (d573e7bf + 2 siblings).
## Observations: 1 emitted, **0 promoted** (honest — 3rd clean wave of restraint; bar high).
- **OBS-W29-1 assert-error-by-TYPE (instanceof) not message-string: HELD (1-wave)** — a C-1 test asserted 403 by matching /forbidden|403/i on the exception MESSAGE, but the service throws a typed ForbiddenException (message lacked 403) → false-RED (caught by CI, fixed to .rejects.toBeInstanceOf). NOT promoted: 1-wave only (BUILD contract: broke-once stays in observations until a 2nd wave); severity low (false-RED not false-GREEN — CI caught it, no prod defect); standard Jest practice (toBeInstanceOf vs message-regex) not a recurring codebase gap (absent waves 20-28). If a 2nd wave shows a false-RED OR (worse) a false-GREEN from message-matching typed exceptions → clears the bar.
- Held forward (unchanged): OBS-W27-1 (HTTP-boundary-tautology, strong), OBS-W29-1 (assert-by-type), OBS-W27-4, OBS-W25-2, readTail-RLS-exempt, auth-security-integration-probe, MG1-guard-freeze, boot-safety, RLS-on-new-table (gate-enforced).
## Promotion applied: NONE (correct restraint — clean reuse wave, no lesson cleared multi-wave + generalizable + not-already-covered).
l_stage_verdict: COMPLETE
tasks_marked_done: d573e7bf, 6f86b594, 770ab1c4
promotions_applied: none (12 total this session)
