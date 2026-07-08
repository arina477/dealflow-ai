# Founder request — Twenty CRM credentials (for the live hookup)
**Date:** 2026-07-08 | **Context:** You chose Twenty (twenty.com) for CRM. I'm building the Twenty adapter now (Twenty is open-source, so I have full API docs) — no creds needed for the build/tests. Two things activate the LIVE connection:
1. **Instance URL** — are you on **twenty.com cloud** (app.twenty.com) or a **self-hosted** Twenty (your URL)?
2. **API key** — in Twenty: **Settings → Developers (APIs & Webhooks) → generate an API key**. Share it (I store it as a platform secret, never committed).
## Until then: I build + unit-test the adapter (fetch companies/people → normalize → sourcing search) autonomously; only the live end-to-end (real Twenty data) waits for the URL + key.
