### Apollo.io

**URL:** https://www.apollo.io
**First seen:** 2026-06-29
**Category overlap with us:** MEDIUM — contact database + AI lead scoring + email sequencing in one platform; sourcing/outreach layers overlap, but built for general B2B sales, not M&A advisory, and has no FINRA/SOX compliance or tamper-evident audit logs.

**Business model:** Freemium per-seat SaaS, credit-metered enrichment. Basic $49/user/mo (annual) → Professional $79 → Organization $119 (3-seat min) → Enterprise custom. (MARKET_RESEARCH)

**Key UX patterns worth noting:**
1. **Integrated source→sequence→track dashboard** — search 275M+ contacts (65+ filters), push to multi-step sequences, monitor engagement, auto CRM sync. (DIRECT_OBSERVATION + MARKET_RESEARCH)
2. **AI lead scoring (Apollo Scores)** — ranks prospects by fit+timing vs configured ICP; buying-group scoring (2026); agentic GTM launch (Oct 2025). Generic ICP scoring, not deal-characteristic matching. (MARKET_RESEARCH)
3. **Multi-channel sequences** — email + call tasks + LinkedIn tasks + conditional branching + A/B testing (Pro+). (MARKET_RESEARCH)
4. **Inbound enrichment + visitor ID** — form enrichment, anonymous visitor identification, auto lead routing. (DIRECT_OBSERVATION)
5. **Trust center** — SOC 2 Type II, ISO 27001, GDPR, CASA Tier 2, EU-US DPF; no FINRA/SOX-specific certs. (DIRECT_OBSERVATION of trust.apollo.io)

**Pricing structure:** Free / Basic $49 / Pro $79 / Org $119 (per user/mo annual) / Enterprise custom; credits expire monthly (no rollover); per-seat cost scales linearly. (MARKET_RESEARCH)

**Strengths / differentiators:** Largest public B2B contact DB (275M contacts / 30M companies); genuine AI lead scoring + agentic GTM; multi-channel sequences in one builder; strong security posture; inbound+outbound unified; deep CRM sync; MCP/ChatGPT ecosystem; 4.7/5 G2 (9K+ reviews), 600K+ companies.

**Weaknesses / gaps (where DealFlow AI wins):** No M&A workflow (no sell/buy-side mandates, no deal pipeline, no LOI/NDA tracking); no FINRA/SOX compliance (SOC2/ISO covers data security, not outreach-conduct compliance; no tamper-evident outreach records); ~73% email accuracy (1-in-4 bounce risk); single-source enrichment, weak provenance for compliance documentation; credit expiry + per-seat cost pressure; EU/APAC data quality issues; topic-level intent only (no funding/exec-movement signals); steep config overhead vs a purpose-built M&A tool.

**Evidence screenshots:** See `screenshots/apollo-*.png` (Playwright capture by orchestrator). Subagent evidence is DIRECT_OBSERVATION via WebFetch of apollo.io, /product/security, trust.apollo.io + MARKET_RESEARCH (Salesmotion, Warmly, SyncGTM).

**Suggested tier: T2.** The most capable general-purpose sales-intelligence + outreach platform; overlaps on sourcing/scoring/outreach but lacks M&A workflow specificity and regulated-outreach compliance. A current workaround advisory firms stitch in — and an argument for DealFlow AI's existence.
