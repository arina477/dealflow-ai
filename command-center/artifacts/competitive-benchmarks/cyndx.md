### Cyndx

**URL:** https://www.cyndx.com
**First seen:** 2026-06-29
**Category overlap with us:** HIGH — AI deal sourcing + buyer/investor matching is their core product, and they market an explicit "Investment Banking Solutions" vertical to the same buyer DealFlow AI targets. Gap: no integrated compliance-first outreach or tamper-evident audit layer.

**Business model:** Annual SaaS subscription, quote-only enterprise pricing (market estimates $20K–$50K+/yr). ~$5.7M ARR (2024, +54% YoY). ~37–51 employees, founded 2013, ~$10M raised (2017). "Trusted by 100+ organizations." (EVIDENCE_QUALITY: MARKET_RESEARCH)

**Key UX patterns worth noting:**
1. **Cyndy platform-wide chatbot** — conversational AI across all products; plain-language queries ("find healthcare investors in CA investing in pre-revenue startups") over 33M+ company records; routes to Finder/Raiser/Acquirer/Scholar. (MARKET_RESEARCH — site returns 403 to fetch; sourced from press releases + ACG interview)
2. **Ranked acquisition-target lists** — Acquirer scores companies on acquisition likelihood and outputs ranked prospect lists; "Projected to Raise" predicts capital-seeking in next 6mo (79% acc, 86%+ US). Explicitly "reduces wasted outreach." (MARKET_RESEARCH)
3. **Connector warm-path** — upload LinkedIn/CRM contacts; surfaces mutual connections at targets; notification engine times alerts to news. No native email send/tracking observed. (MARKET_RESEARCH)
4. **Scholar gen-AI research** — 15–30pp reports + PPT decks from a query, with fact-checking + citations; targets bankers/analysts. (MARKET_RESEARCH)
5. **Five-product suite on a shared 33M-company / 80M-contact data layer** — Finder (sourcing), Acquirer (buy-side ranking), Raiser (investor ID), Valer (AI valuation), Scholar (research). Workflow terminates at identification + research; no outreach execution. (MARKET_RESEARCH)

**Pricing structure:** No public tiers; quote-only / demo-wall. Third-party benchmark $20K–$50K+/yr; reviewers call it "heavy and expensive." (MARKET_RESEARCH)

**Strengths / differentiators:** Global coverage moat (33M companies, 80M contacts, 195 countries, 7 languages); NLP semantic matching that understands what companies do; proprietary "Projected to Raise" signal; continuously-refreshed ranked Acquirer lists; Scholar produces board-ready deliverables in-platform; explicit IB vertical; Dealsuite EU partnership (2025); 54% YoY growth.

**Weaknesses / gaps (where DealFlow AI wins):** No integrated compliant outreach (workflow ends at identification + CRM export); no tamper-evident audit log / FINRA-supervision / SEC 17a-4 retention — a hard disqualifier for regulated advisory; buy-side oriented (sell-side ranked buyer-list for a mandate isn't the primary flow); price excludes lower-middle-market boutiques; G2 flags broad-range filters, data inaccuracy, learning curve, fragmented multi-product UX; limited capital to build compliance as a priority.

**Evidence screenshots:** See `screenshots/cyndx-*.png` (captured via Playwright by orchestrator where the site rendered). cyndx.com returns HTTP 403 to programmatic WebFetch; subagent findings are MARKET_RESEARCH from press releases (EIN Presswire), ACG/Middle Market Growth CEO interview, Latka revenue data, G2, DealOrb, SourceCodeDeals, Tracxn.

**Suggested tier: T1 — Direct competitor.** Covers DealFlow AI steps 1 (sourcing) and 2 (AI ranked matching) with a mature, growing product explicitly aimed at IB/M&A advisors. The decisive gap is step 3 (compliant outreach + audit log). The single most important positioning foil — proof the segment exists and is growing, and the reference for "the workflow completes where Cyndx stops."
