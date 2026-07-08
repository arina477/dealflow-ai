# Founder request — Affinity API key (for the live CRM hookup)
**Date:** 2026-07-08 | **Context:** You chose Integrations → Affinity. I'm building the Affinity adapter now (against Affinity's public REST API, with mocked tests) — no key needed for that. The key is needed only for the LIVE connection (pulling your firm's real Affinity data) at deploy/verify time.
## What I need from you (2 min, whenever convenient):
1. In Affinity: **Settings → API** → generate an **API key**.
2. Share it with me (or add it directly). I'll store it as a **platform secret** (never committed to code) and wire the live connection.
## Until then:
- I build + unit-test the adapter (fetch deals/contacts/orgs → normalize → upsert into DealFlow) autonomously.
- The end-to-end LIVE verification (real Affinity data) is the only step that waits for the key — I'll gate that on it, not the whole wave.

---
## C-2 status (wave-30 deploy complete — 2026-07-08)
The Affinity adapter is now **LIVE in production but DORMANT** (deployed @ commit a6ad02c on dealflow-api).
Without your key it is a safe no-op (returns nothing, never crashes) — the app boots clean and the
existing sourcing search keeps working on the built-in data source. **Nothing is blocked.**

**When you share the Affinity API key, the live hookup is a 3-step, no-new-code activation:**
1. Set it as a platform secret `AFFINITY_API_KEY` on the `dealflow-api` service (Railway env — never committed).
2. Redeploy `dealflow-api` (same commit a6ad02c) so the new container picks up the secret.
3. Verify: the sourcing search now returns real Affinity companies (paginated live fetch), `/health` still ok.

This is the ONLY remaining step for M9 to be fully live. It waits on your key, not on any further build.
