# Competitive Benchmarks Index

Per-competitor evidence files live in this directory as `<kebab-case>.md`. Files persist across conversations so the same question is never re-researched.

Written by:
- v2 (onboarding) — initial population of the competitor set
- `competitive-analyst` during P-0 Frame (per-wave deepening)
- `claudomat-brain/ROADMAP/roadmap-refresh-ritual.md` Step 1a (refresh)

Freshness: benchmarks older than 60 days should be re-verified at the next refresh ritual.

---

## Tier ranking (2026-06-29, v2 onboarding scan)

Tiering is judged against DealFlow AI's thesis: **integrated deal sourcing + AI buyer-seller matching + compliance-first outreach for M&A advisory, in one workflow.** Tier 1 = a competitor building toward that same integrated workflow (match-or-beat). Tier 2 = adjacent platform overlapping one or two pillars. Tier 3 = context-only / generic point tool overlapping a single narrow slice.

### Tier 1 — Primary benchmark (match-or-beat)
- `cyndx.md` — Closest direct competitor: AI deal sourcing + ranked buyer/investor matching with an explicit Investment Banking vertical. Covers our steps 1–2; gap is step 3 (compliant outreach + audit). The primary positioning foil.
- `grata.md` — Market-leading deal-sourcing data layer + buyer-list building; filter-driven (not AI-ranked) matching; no outreach execution, no compliance audit. Now Datasite-owned (with SourceScrub).
- `sourcescrub.md` — Deal-sourcing data layer for the exact LMM IB/PE segment; conference intelligence is its edge; no matching, no outreach, no compliance. Acquired by Datasite (Aug 2025) and folding into Grata — the consolidation is the key watch-item.
- `dealcloud.md` — Incumbent M&A deal/relationship-management platform with real (process-level) compliance + AI-assisted outreach, but no automated ranked matching and priced/scoped out of boutique/LMM advisory. Enterprise-feature benchmark + boutique displacement opportunity.

### Tier 2 — Secondary / informative
- `affinity.md` — Relationship-intelligence CRM for dealmakers; nascent Affinity Sourcing; email tracking but no compliance audit, no AI buyer-seller matching. Watch Affinity Sourcing.
- `pitchbook.md` — Dominant upstream private-market data/research terminal (now with Navigator AI); a sourcing input, not a workflow competitor; no matching, no outreach, no compliance.
- `apollo-io.md` — Most capable general-purpose sales-intelligence + outreach platform (sourcing + AI lead-scoring + multi-channel sequences); no M&A workflow, no FINRA/SOX outreach compliance.

### Tier 3 — Context only
- `crunchbase.md` — Private-company + funding data; acquisition-prediction signal; generic Outreach.io bridge; no M&A workflow/matching/compliance.
- `hunter-io.md` — Email-discovery + outreach point tool; overlaps only the delivery layer; no sourcing/matching/compliance depth.
- `rocketreach.md` — Contact-data utility (emails/phones) + basic 2026 sequences; no deal pipeline, no matching, no compliance.

---

## Strategic read (for v3 / v7 / v10)

1. **The white space is real.** No scanned competitor combines automated sourcing + AI ranked buyer-seller matching + compliance-first outreach in one workflow. Sourcing leaders (Cyndx/Grata/SourceScrub) stop at the list/CRM hand-off; the incumbent workflow tool (DealCloud) has compliance but no automated matching and is enterprise-priced; outreach tools (Apollo/Hunter/RocketReach) are generic and uncompliant.
2. **Compliance-first outreach is the defensible wedge** — zero competitors offer tamper-evident, FINRA/SOX-minded outreach audit logging tied to the matching loop. This validates founder bet #2.
3. **The boutique / lower-middle-market price point is open** — every direct competitor is five-figure-plus annually and demo-walled, excluding the smaller advisory shops that are DealFlow AI's pilot cohort.
4. **Consolidation watch:** Datasite now owns both Grata and SourceScrub ($500M backing). If their combined buyer-list + matching matures at enterprise scale in 12–18 months, DealFlow AI's moat narrows to compliance-first outreach + the mid-market price point — reinforcing the urgency of shipping the H1 integrated loop.

---

## Freshness log

| Competitor | Last scan | Evidence quality | Notes |
|---|---|---|---|
| cyndx | 2026-06-29 | MARKET_RESEARCH | Site 403 to fetch; press releases + analyst interviews + Latka/G2 |
| grata | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public product/pricing pages reachable |
| sourcescrub | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public pages reachable; Datasite acquisition confirmed |
| dealcloud | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public pages reachable; deeper UX behind auth |
| affinity | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public + help-center pages reachable |
| pitchbook | 2026-06-29 | MARKET_RESEARCH | Site 403 to fetch; press releases + review aggregators |
| apollo-io | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public + trust-center pages reachable |
| crunchbase | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public + about pages reachable |
| hunter-io | 2026-06-29 | DIRECT_OBSERVATION (WebFetch) | Public + help pages reachable |
| rocketreach | 2026-06-29 | MARKET_RESEARCH | Public homepage reachable; product behind auth |

---

## Evidence note — screenshot limitation (INFRA GAP)

The v2 methodology mandates Playwright live-browsing with screenshot capture for Tier 1 entries. **No screenshots could be captured in this environment: the Playwright browser binary is not installed** (`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`) and installation requires root privileges unavailable to the brain. Both the `competitive-analyst` swarm and the orchestrator's direct attempts failed for this reason.

Mitigation: all findings are grounded in `WebFetch` retrieval of live public pages (tagged `DIRECT_OBSERVATION` per finding) or, where sites return HTTP 403 / sit behind auth/demo walls (Cyndx, Pitchbook), in dated `MARKET_RESEARCH` from press releases, analyst interviews, and review aggregators (tagged accordingly). No UX behavior was invented.

**Action required before the first UI wave:** this same missing-browser gap will block T-5 (E2E), T-6 (layout), and any Playwright-driven testing. It must be resolved host-side (install Chrome for Playwright) and is flagged here so the v11 install-audit surfaces it. v9 page-design generation uses the aidesigner REST API (not Playwright) and is unaffected.
