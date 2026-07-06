# Decision needed: turn on live outreach sending (the last step for the compliant-outreach flagship)

**Status:** waiting on you · **Non-blocking** (we kept building — see below) · **Surfaced:** 2026-07-06 (wave 14 close)

## The one-line ask
Give us a transactional email-sending account (an email-provider API key) and we flip the compliant-outreach loop **live end-to-end** — advisors go from "compose + get it approved" to actually **sending**, with opens/replies tracked and buyers auto-advancing through the pipeline.

## Where things stand
The entire compliant-outreach product is built and shipped **except the actual send**:
- ✅ Compliant, versioned message templates
- ✅ Outreach composer with a **non-bypassable pre-send compliance check**
- ✅ A **compliance approval queue** (a second person must approve — the sender can't approve their own message)
- ✅ A tamper-evident **audit log + regulator-ready recordkeeping export**
- ✅ A **deal pipeline** board + timeline
- ⛔ **Actually sending the email + tracking opens/replies + auto-advancing buyers** — this is the only piece left, and it needs your email-sending account.
- ⛔ **AI-assisted drafting** — separate, waiting on your AI-spend go-ahead (see the earlier note on AI matching spend).

Because sending genuinely needs an account only you can provide, we've marked the "Compliant outreach" milestone as **paused-waiting-on-you** rather than pretending it's finished — that honesty is core to a compliance product.

## What we're doing meanwhile (so nothing stalls)
We moved on to **Admin & settings** — user management (invite people, assign roles), firm profile, and the **sending-domain setup** an admin has to complete before real sending can go live anyway. So this is the natural next step, not filler, and it keeps the product moving while you decide.

## What you need to do
1. Pick a transactional email provider (or tell us your preference) and share an API key — this is an account credential only you can issue.
2. Optionally, give us the AI-drafting spend go-ahead if you want AI-assisted message drafting too.

Reply whenever you're ready. The moment we have the email account, the compliant send→track→advance loop goes live.

---
_Internal refs (not founder-facing): product-decision #141 (email-provider key + EMAIL_WEBHOOK_SECRET); founder-decision-llm-matching-spend.md (LLM-spend); M6 a068dc3d → blocked; re_surface_trigger fired at wave-14 close (M6 buildable scope exhausted). Wave-count watchdog: re-surface at each subsequent wave close until answered._
