# Founder request — Affinity API key (for the live CRM hookup)
**Date:** 2026-07-08 | **Context:** You chose Integrations → Affinity. I'm building the Affinity adapter now (against Affinity's public REST API, with mocked tests) — no key needed for that. The key is needed only for the LIVE connection (pulling your firm's real Affinity data) at deploy/verify time.
## What I need from you (2 min, whenever convenient):
1. In Affinity: **Settings → API** → generate an **API key**.
2. Share it with me (or add it directly). I'll store it as a **platform secret** (never committed to code) and wire the live connection.
## Until then:
- I build + unit-test the adapter (fetch deals/contacts/orgs → normalize → upsert into DealFlow) autonomously.
- The end-to-end LIVE verification (real Affinity data) is the only step that waits for the key — I'll gate that on it, not the whole wave.
