# BOARD digest — 2026-07-07 (wave-25 close / N-block)

## Clean decisions (1) — 7/7 unanimous
| decision-slug | outcome | wave |
|---|---|---|
| N-1-M10-recordkeeping-integrity-wave-25 | APPROVE disposition (c): put the real "compliance recordkeeping" decision in your hands (non-blocking), ship one final safety-cleanup wave in the meantime, and hard-pause the next wave if the decision isn't made | 25 |

## Close splits (0)
_none — 7/7, no dissent on direction._

## Vetoes & escalations routed back to founder (0)
_none — no hard-stop veto._

## ⚑ NEEDS YOUR INPUT — this one now gates the next wave

**The "advanced compliance recordkeeping" theme has a problem, and I stopped the machine from papering over it.**

We started this theme to build formal SOX/FINRA compliance features — things like locked retention policies, on-demand regulator-ready attestation reports, and recordkeeping exports. But three waves in a row have only *hardened the plumbing underneath* (rate-limiting, migration safety checks, database-permission separation) — none of the actual recordkeeping features have been built. That's because two things only you can decide are still open:

1. **What does "done" look like here?** The success target for this theme is still "to be set by you." The intended target is: *a regulator-ready attestation package can be produced on demand.* I need you to confirm or refine that so we can define the actual features.
2. **Do we formally raise our compliance level?** At launch you chose to keep the formal compliance classification light. The real SOX/FINRA features (especially a formal regime-review posture) only make sense if you decide to raise that bar — likely triggered by a specific customer or regulator requirement. That's your call to make, not the machine's.

**What I did instead of guessing:** the board voted 7/7 to (a) put this decision to you now without stopping the loop, and (b) ship one last, genuinely useful cleanup wave — documenting and safety-testing how the app connects to the database with least privilege, which is the foundation every future recordkeeping feature sits on. **After that wave, if you haven't scoped the recordkeeping features, the loop will pause and wait for you** — no fourth cleanup wave will sneak through.

**What I need from you:** the target for the recordkeeping theme, and a yes/no on raising the formal compliance level (and if yes, which customer/regulator need is driving it). The moment you answer, we build the real features.

## ⚑ ALSO WAITING ON YOU (non-blocking — carried from prior digests)
- **Two other "done" targets to set:** the finished **integrations & insight** theme (analytics, calibration, outreach logging, seller-intent all live — setting its target lets us formally mark it complete; waiting since we started that theme).
- **Four parked items** (can't build until you decide): **CRM sync** (pick a data vendor + API key — last piece of the integrations theme, high advisor demand), **email/outreach sending** (email-provider domain setup), **AI matching model spend** (budget go-ahead).

## ⚑ RECOMMENDATION — permanent CI budget raise
GitHub Actions ran out of build minutes **three separate times in one day** during this wave, each time stalling shipping until you raised the limit. This will keep recurring. **Recommendation: set a permanent higher monthly Actions spending limit** so the build pipeline stops hitting the wall. This is a recurring money commitment, so it's your call — but it's the single biggest source of avoidable stalls right now.

## Summary
- Total decisions: 1 | Clean: 1 | Close: 0 | Escalated: 0
- Wave completed: wave-25 — compliance auth-hardening (rate-limiting, input validation, anti-CSRF) shipped LIVE @987ebb4.
- Now building: wave-26 — the final compliance-plumbing cleanup (database least-privilege documentation + safety checks). **After this, the loop pauses for your recordkeeping decision.**
- Top item waiting on you: the **advanced compliance recordkeeping** scope + compliance-level decision (now gates wave-27).
