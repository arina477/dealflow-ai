### Pitchbook

**URL:** https://pitchbook.com
**First seen:** 2026-06-29
**Category overlap with us:** MEDIUM — deep private-market data that powers sourcing, plus AI-assisted research (Navigator), but no buyer-seller matching engine, no built-in outreach, no outreach compliance layer, no tamper-evident audit logs. A research/data terminal, not an integrated M&A advisory workflow.

**Business model:** Annual B2B subscription (Morningstar subsidiary). Quote-only; market-verified ~$12–20K/user/yr (solo), $20–32K/yr (3-seat), $70–124K+/yr (enterprise). Modular add-ons (PE/VC/M&A, LCD debt, API, CRM, Premium Connectors). (MARKET_RESEARCH)

**Key UX patterns worth noting:**
1. **Research terminal / screener-first** — filtered company/deal/investor lists over 3.5M+ companies, 2.8M+ deals; search-then-export, not workflow-native. (MARKET_RESEARCH; site 403 to fetch)
2. **PitchBook Navigator (GA Nov 2025)** — generative-AI + natural-language query layer (AI+HI); MCP/OpenAI connector + Harvey (June 2026). (DIRECT_OBSERVATION of press releases)
3. **CRM integration via export/API** — pushes data to Salesforce/HubSpot/Dynamics; no native outreach/sequencing/send/tracking. Contact export limits ~10/day, 25/month. (MARKET_RESEARCH)
4. **Excel/PowerPoint plugins + Chrome extension** — IB comp-table/pitch workflow inside Office; optimized for research, not execution/communication. (HELP_ARTICLE)
5. **Email alerts (monitoring, not outreach)** — saved-search notifications to the user; inbound, not outbound compliance-tracked comms. (HELP_ARTICLE)

**Pricing structure:** Quote-only; ~$12–20K/user/yr → $70–124K+/yr enterprise; annual only; add-ons priced separately; 8–15% annual escalation common. (MARKET_RESEARCH)

**Strengths / differentiators:** Industry-leading private-market DB (3.5M companies, 2.8M deals, 4.7M contacts); Morningstar stability + cross-dataset; Navigator AI; Premium Connectors (OpenAI, Harvey); 100K+ subscribers; deeply embedded Office plugins (switching cost); gold-standard historical transaction/comps data.

**Weaknesses / gaps (where DealFlow AI wins):** No outreach execution; no compliance-first outreach (zero audit trail / FINRA-SOX email tracking); no AI buyer-seller ranked matching; lower-middle-market data gaps (40–60% of sub-$50M-rev firms missing/stale); strict export limits hamper buyer-list building; prohibitive cost for boutique advisory; siloed workflow (research in PitchBook, outreach in CRM/email, compliance elsewhere) — exactly the fragmentation DealFlow AI collapses.

**Evidence screenshots:** pitchbook.com returns HTTP 403; subagent evidence is MARKET_RESEARCH (G2/Gartner/TrustRadius, Vendr pricing) + DIRECT_OBSERVATION of BusinessWire/PitchBook press releases. Orchestrator Playwright capture attempted; see `screenshots/pitchbook-*.png` if present (may be blocked).

**Suggested tier: T2.** Dominant upstream data/research terminal advisors use as a source, but not a direct competitor on the integrated sourcing+matching+compliant-outreach workflow.
