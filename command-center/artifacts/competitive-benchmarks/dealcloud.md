### DealCloud (by Intapp)

**URL:** https://www.intapp.com/dealcloud/
**First seen:** 2026-06-29
**Category overlap with us:** MEDIUM-HIGH — the incumbent deal/relationship-management platform for M&A advisory and IB, with embedded compliance workflows and AI-assisted outreach. Closest existing platform to DealFlow AI's target context, but no automated buyer-seller ranked matching and no unified sourcing → matching → compliant-outreach experience.

**Business model:** Enterprise SaaS, custom pricing (undisclosed; market est. $50K–$200K+/yr). Owned by Intapp (NASDAQ: INTA). Enterprise sales, demo-first, professional-services implementation. Positioned as the industry standard for mid-to-large PE/IB.

**Key UX patterns worth noting:**
1. **Zero-entry Outlook activity capture** — emails/meetings auto-logged to deal/contact records; firm-wide shared engagement record. Outlook-centric (no Gmail documented). (DIRECT_OBSERVATION via WebFetch)
2. **Embedded compliance + ethical walls** — role-based permissions, audit trails, confidentiality controls, configurable approval routing; "built for regulated markets." Compliance is process-level (workflow enforcement, access governance), NOT outreach-level (no tamper-evident email logs / off-channel archival). (DIRECT_OBSERVATION)
3. **AI company recommendations (Aug 2024)** — suggests targets from investment thesis using relationship scores + data; "smart tags" classify data; Intapp Assist drafts intro emails with relationship context. AI-assisted suggestions, not systematic ranked buyer matching. (DIRECT_OBSERVATION + MARKET_RESEARCH)
4. **Deep third-party data integrations** — native PitchBook/FactSet/Preqin/Intralinks/Datasite/SourceScrub; proprietary Intapp Data 14M+ companies / 200M+ contacts. (DIRECT_OBSERVATION)
5. **Agentic AI (Intapp Celeste / Assist)** — plain-English queries over deal data, AI summarization, pre-built agentic playbooks; deeper UX behind auth wall. (DIRECT_OBSERVATION landing + COULD_NOT_VERIFY past auth)

**Pricing structure:** No public pricing; enterprise custom (~$50K–$200K+/yr per market research); sales + professional-services engagement; high switching costs post-implementation. (MARKET_RESEARCH)

**Strengths / differentiators:** De-facto standard for mid-to-large IB/PE advisory (Raymond James, Hamilton Lane named); broadest data integrations in category; 14M-company / 200M-contact proprietary data; embedded compliance (ethical walls, RBAC, approval workflows, audit trails); industry blueprints; SOC 1/2, ISO 27001 family, CSA STAR, GovRAMP; Intapp Assist drafts outreach; native deal-room integrations.

**Weaknesses / gaps (where DealFlow AI wins):** No automated buyer-seller ranked matching (relationship-path discovery, not criteria→ranked buyer list); sourcing is network-centric (thin for lower-middle-market where networks are sparse); high implementation cost/complexity excludes small-to-mid advisory (DealFlow AI's segment); compliance is workflow-level not outreach-level (no tamper-evident email audit / FINRA communication archival designed for buyer outreach); Outlook-only capture; AI is general-purpose, not purpose-built for the LMM advisory loop; no self-serve; demo/auth required to evaluate.

**Evidence screenshots:** See `screenshots/dealcloud-*.png` (Playwright capture by orchestrator). Subagent evidence is DIRECT_OBSERVATION via WebFetch of intapp.com/dealcloud (+ /investment-banking, /advisory, /private-capital), /products/ai, /compliance + MARKET_RESEARCH (rings.ai, skywork.ai, pricing estimates).

**Suggested tier: T1.** Serves the exact buyer and is the incumbent CRM/deal-management platform in the segment, with real compliance infrastructure and some AI-assisted sourcing — but does not unify automated sourcing + ranked matching + compliance-first outreach as one workflow, and is priced/scoped out of the boutique/LMM advisory segment. Benchmark on enterprise features; displacement opportunity in boutique advisory.
