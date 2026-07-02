### Grata

**URL:** https://grata.com
**First seen:** 2026-06-29
**Category overlap with us:** HIGH on sourcing — Grata is the strongest deal-sourcing data layer in the market and has a buyer-list-building layer that approximates matching, but has no compliance-first outreach automation or tamper-evident audit logging.

**Business model:** SaaS subscription, three tiers (Growth / Scale / Alpha) for PE, IB, corp dev, advisory. No success fees. Add-ons: API, Data Warehouse. Demo/sales-gated pricing. Self-reported 1,000+ customers incl. 35 of top 40 PE firms. (Now owned by Datasite, which also owns SourceScrub — see sourcescrub.md.)

**Key UX patterns worth noting:**
1. **AI agentic search** — semantic read of company websites (not SIC/NAICS); conversational queries over 21M+ private companies, 50M monthly updates, 1.2B web pages. Genuine data moat. (DIRECT_OBSERVATION via WebFetch of /platform, /features/deal-sourcing)
2. **Buyer list building (Define/Discover/Analyze/Target)** — 100K+ sponsors filterable by deal recency/sector/behavior/size; export to CSV/CRM. Matching is user-configured filter logic, not AI-ranked fit. (DIRECT_OBSERVATION)
3. **Grata Deal Network** — vetted live deal teasers (min $1M EBITDA / $3M rev); only FINRA-registered bankers/licensed brokers admitted; buyers contact advisors off-platform. No sequencing/tracking. (DIRECT_OBSERVATION)
4. **CRM as the de-facto outreach layer** — no native email; bidirectional sync to Salesforce/HubSpot/DealCloud (Scale+). Grata is data+discovery, not outreach execution. (DIRECT_OBSERVATION)
5. **Seller intent signals (Alpha only)** — 6–12mo pre-market signals (departures, hiring spikes, ownership changes, founder-age). Gated to the highest tier. (DIRECT_OBSERVATION + MARKET_RESEARCH)

**Pricing structure:** Growth / Scale / Alpha; no success fees; demo-only, no public pricing. Alpha adds seller intent + API. (DIRECT_OBSERVATION of /pricing)

**Strengths / differentiators:** 21M+ companies, 10M+ exec contacts, 50M monthly updates; semantic search surfaces founder-owned/bootstrapped firms traditional DBs miss; seller intent (Alpha); FINRA-vetted deal network; SOC 2 (claimed); no success fees; 35/40 top PE firms.

**Weaknesses / gaps (where DealFlow AI wins):** No integrated outreach execution (hands off to CRM → fragmentation); no compliance-first outreach / tamper-evident audit (absent across all pages); buyer-seller matching is filter-driven not AI-ranked; Deal Network is passive/browse-only; seller intent locked behind Alpha pricing (excludes lower-middle-market boutiques); no native email tracking/engagement analytics; broad multi-segment platform dilutes advisory-specific focus.

**Evidence screenshots:** See `screenshots/grata-*.png` (Playwright capture by orchestrator). Subagent evidence is DIRECT_OBSERVATION via WebFetch of grata.com, /pricing, /platform, /solutions/investment-banking, /features/deal-sourcing, /features/grata-deal-network, /features/buyer-list-building, /grata-vs-axial.

**Suggested tier: T1.** Direct competitor on sourcing, partial on matching (buyer-list building), zero on compliant outreach. Appears on every prospect's shortlist. Differentiation narrative: "Grata finds the companies; DealFlow AI completes the deal workflow."
