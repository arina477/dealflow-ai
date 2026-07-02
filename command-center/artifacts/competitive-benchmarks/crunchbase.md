### Crunchbase

**URL:** https://www.crunchbase.com
**First seen:** 2026-06-29
**Category overlap with us:** LOW-MEDIUM — private-company intelligence + funding data useful as a sourcing input, but no AI buyer-seller matching, no M&A advisory workflow, and no compliance-first outreach. A research database, not an integrated deal-execution platform.

**Business model:** Four-tier SaaS — Free / Starter $29/mo / Pro $49/mo / Enterprise ~$2,000/user/yr (annual). API/data licensing (~$30K+/yr). Targets GTM/sales, VC/PE, corp dev, wealth — M&A advisory is not a named segment. (MARKET_RESEARCH)

**Key UX patterns worth noting:**
1. **Advanced filter search (40+ dims)** — build target lists; 1K–5K row export caps/mo; saved-search email alerts. (HELP_ARTICLE)
2. **Predictive signals ("acquisition prediction")** — 8 prediction categories over ~39B signals (weekly refresh); framed for corp-dev tracking, not sell-side buyer sourcing; claimed 84% funding accuracy. (DIRECT_OBSERVATION of about.crunchbase.com)
3. **Push-to-sequence via Outreach.io (not native)** — Business/Enterprise push contacts to Outreach.io/Salesforce; no native sequencing, no compliance envelope, no audit log. (HELP_ARTICLE)
4. **Public homepage activity feed** — live metrics as social proof; discovery/research-first, no deal pipeline/matching/advisor workspace. (DIRECT_OBSERVATION)
5. **Self-serve mass-market funnel** — annual-only subs, no sales call at Pro and below; broad B2B SaaS, not a configured compliance tool. (MARKET_RESEARCH)

**Pricing structure:** Free / Starter $29 / Pro $49 (per user/mo annual) / Enterprise ~$2,000/user/yr; API ≥~$30K/yr. (MARKET_RESEARCH)

**Strengths / differentiators:** Largest brand + user base (80M+ registered); best-in-class funding-round DB for VC-backed firms; useful acquisition-prediction signal for corp dev; broad integrations (Salesforce/HubSpot/Outreach/Chrome/API); low-friction entry ($49/mo); analyst-validated change data; data-licensing network effects.

**Weaknesses / gaps (where DealFlow AI wins):** No integrated M&A workflow (no mandate mgmt, no buyer-list generation, no ranked matching, no deal-stage pipeline); no compliance-first outreach (Outreach.io bridge is generic; no FINRA 4511 / SOX 802 posture); no AI buyer-seller matching (Boolean filters, market-wide predictions not deal-specific scoring); LMM coverage gap (skews VC-backed tech); export limits + API cost; 15–40% valuation-vs-actual accuracy gap; no audit trail / deal-room.

**Evidence screenshots:** See `screenshots/crunchbase-*.png` (Playwright capture by orchestrator). Subagent evidence is DIRECT_OBSERVATION via WebFetch of crunchbase.com + about.crunchbase.com + MARKET_RESEARCH (RevPilots, SyncGTM, Vendr).

**Suggested tier: T3.** Adjacent data/intelligence layer advisors might use as one sourcing input; not a workflow competitor — no matching, no M&A pipeline, no compliance-first outreach. Watch for moves into sell-side workflow tooling.
