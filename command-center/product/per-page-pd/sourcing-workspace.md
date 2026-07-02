# Sourcing Workspace — `/sourcing`

## Purpose

Enable analysts and associates to discover, evaluate, and import M&A deal candidates from multiple connected data sources into DealFlow's centralized target repository in a single workflow. The workspace reduces manual sourcing overhead, prevents duplicate companies from polluting the target pool, and connects sourced candidates directly to deal mandates for instant matching and outreach eligibility assessment.

---

## Audience

**User roles:** Analyst, Associate, Senior Analyst (with data-connector read-write permissions).

**Auth & Gating:**
- Requires `sourcing:read` permission to view the workspace and run searches.
- Requires `sourcing:write` to import candidates into the target store.
- Requires `data-connectors:read` to see available source integrations.
- Firm-scoped: all imported candidates are visible only within the authenticated firm's organization.

---

## Entry Points

1. **Primary nav:** Sidebar menu > *Sourcing*.
2. **Mandate builder:** *New deal sourcing task* card in the mandate detail view (quick-start search + import form with mandate pre-selected).
3. **Deep link:** `/sourcing?mandate_id=<id>` (enter sourcing workspace with a mandate pre-selected for tagging).

---

## Content Sections

### 1. Source Connectors & Query Builder

**Top navigation/header:**
- **Active sources dropdown:** Toggle enabled data sources on/off (e.g., PitchBook, Crunchbase, industry-specific databases, internal deal logs).
- **Search type selector:** *By Company Name*, *By Sector/SIC*, *By Revenue Range*, *By Geography*, *By Custom Criteria* (chained filters).
- **Query builder:** Sticky/collapsible panel on left (desktop) or modal on mobile; allows multi-field filtering:
  - Company name (substring match, fuzzy).
  - Industry/sector (dropdown, multi-select).
  - Geography (country, state, metro; multi-select).
  - Revenue range (slider or text input, $M).
  - Headcount range (optional).
  - Growth rate / profitability flags (optional; source-dependent).
  - Custom tagging (if importing from internal sourcing pool).

**Source status indicator:** Icon/badge per source showing connectivity status (green = live, yellow = rate-limited, red = outage/error).

### 2. Candidate Results Table

**Primary view:** Paginated table (20–50 rows/page) displaying sourced candidates across all active sources.

**Columns (sortable, filterable per column):**
- **Company Name** (linked to detail drawer).
- **Source** (badge: PitchBook, Crunchbase, etc.).
- **Industry / Sector**.
- **Geography** (HQ country/city).
- **Revenue** (if available; $ or revenue band).
- **Headcount / Employee Range**.
- **Founded Year**.
- **Last Data Update** (per source; helps surface stale records).
- **Match Score** (optional; pre-calculates relevance to active mandates; low-salience to UX, high-value to data layer).
- **Actions:** Select checkbox, preview icon, import/tag icon.

**Sorting:** Default is source then company name (alphabetic); users can click column headers to sort by any field.

**Inline preview:** Hover company name → tooltip or mini-card showing website link, executive team snippet, recent funding/M&A, next action hint.

### 3. Candidate Detail Drawer

**Triggered by:** Clicking a company row or preview icon.

**Content:**
- Company name, logo (sourced or fallback), HQ location.
- One-line description/elevator pitch.
- **Core metrics:** Revenue, headcount, founded, last funding round, growth rate, profitability status (if available).
- **Operational data:** Key executives (name + title; links to LinkedIn snippets if available), website, primary contact email/phone (if sourced).
- **Source lineage:** Which data source provided this record; timestamp; link to original record on source platform (for verification).
- **Internal enrichment notes:** Any prior notes from the firm (read-only in drawer; editable after import).
- **Action buttons:**
  - *Select for Import* (checkbox; bulk action also available in table header).
  - *View on Source* (external link to source platform).
  - *Skip / Don't Import* (soft-marks for dedupe context).

### 4. Import & Dedupe Review Panel

**Triggered by:** Select ≥1 candidate and click *Review Selected for Import* button (sticky footer on desktop, modal on mobile).

**Dedupe flow:**
- System runs candidates against the firm's existing target repository using company-name fuzzy match, domain matching, and normalized address comparison.
- **No matches found:** Candidate proceeds directly to import; user sees green checkmark + can proceed to next step.
- **Potential matches detected:** System flags with confidence score (High / Medium / Low); shows matched company card (name, source, import date, existing mandate tags). User selects:
  - *Import as new* (add to targets; can re-tag after if needed).
  - *Merge with existing* (only if dedupe confidence is High; merges sourcing record into existing candidate; triggers enrichment update).
  - *Skip* (do not import; hidden from future searches until filter changes).
- **Batch review:** Show count of duplicates, count approved for new import, count to merge.

**Dedupe error state:** If duplicate resolution fails (DB lock, network error), show retry button + allow user to skip that batch.

### 5. Tag-to-Mandate Assignment

**After dedupe approval:**
- Modal/form: *Assign to Mandate* (multi-select dropdown; shows active firm mandates with target count).
- **General pool option:** "Add to general sourcing pool" (unassigned; can be matched later).
- **Bulk tag:** Apply single mandate tag to all approved imports at once, or assign each candidate individually.
- **Submit & confirm:** Shows summary ("Importing 3 new + 1 merge; tagging to 'TechCo Acquisition' mandate").

---

## Interactions

### Primary flows:

1. **Search → Review → Import → Tag**
   - User builds query in builder → hits *Search* → table populates → user selects rows → *Review Selected* → dedupe flow → *Assign to Mandate* → *Confirm Import*.

2. **Quick re-source (mandate-triggered)**
   - From mandate detail: *Find more targets* → sourcing workspace loads with mandate ID pre-filled → dedupe comparison favors existing candidates already tagged to that mandate → import new candidates, auto-tag to mandate.

3. **Bulk import from list**
   - User pastes company names or CSV of targets → system parses → runs multi-source search → shows results with source confidence (if from multiple sources, lowest-lag data wins column order) → dedupe + import as above.

### Secondary interactions:

- **Toggle source on/off:** Clicking source badge in results refines to that source only.
- **Infinite scroll / pagination:** Load more results without page reload.
- **Export results:** *Download as CSV* (for offline review or external data system).
- **Save search:** *Save this query* → stored as named filter; user can re-run later.
- **Undo import:** Within 24h of import, *Undo* link in import confirmation toast allows rollback (soft-delete; re-importable).

---

## Data Requirements

### Endpoints (placeholder):

**Source connectors (read):**
- `GET /api/v1/data-sources` — list enabled sources + connectivity status.
- `POST /api/v1/data-sources/{source_id}/search` — query a single source (body: `{ query_type, filters }`) → returns paginated candidates.

**Target store (write):**
- `GET /api/v1/targets?mandate_id={id}` — fetch existing targets for dedupe.
- `POST /api/v1/targets/dedupe-check` — batch dedupe (body: array of candidate objects) → returns match confidence + matched_target_id.
- `POST /api/v1/targets/import` — insert dedupe-cleared candidates (body: array of candidates + mandate_id) → returns import_id + count.

**Data enrichment (read):**
- `GET /api/v1/companies/{company_id}/enrichment` — fetch optional enrichment data (executives, recent news, M&A history) for drawer.

**Audit & dedupe log:**
- `GET /api/v1/imports/{import_id}` — fetch import transaction details (source, dedupe matches, count).
- `POST /api/v1/imports/{import_id}/undo` — soft-delete import + restore duplicate marks.

---

## State Handling

### Loading States

- **Initial page load:** Skeleton loaders for search builder + empty results table.
- **Source search in-flight:** Spinning indicator per source; partial results from fast sources appear first; slow/rate-limited sources show *pending* badge.
- **Dedupe check in-flight:** Checkmarks appear per row as dedupe completes; modal footer shows progress (3 of 5 checked).
- **Import in-flight:** Bulk insert progress bar; cancel option if >30s.

### Empty States

- **No search executed:** Prompt *"Select data sources and filters above, then click Search to discover targets."*
- **No results found:** *"No candidates matched your filters across [source_1, source_2]. Try broadening the query or checking source connectivity."* + link to source status.
- **No mandates available:** (In tag-to-mandate modal) *"Create a mandate first to tag imported candidates."* + link to mandate builder.

### Error States

- **Source outage / rate-limit:** Badge turns red; results from that source show red label + *"Data temporarily unavailable. Partial results from [source_2, source_3] shown."* + *Retry* button.
- **Dedupe service failure:** *"Duplicate check failed. Retry or import without dedupe (not recommended)."* — user must confirm override.
- **Import conflict (target already imported):** *"This candidate was already imported on [date] by [user]. Merge or skip."*
- **Network error on import:** Toast error + *Retry* button; imported candidates are queued in localStorage until confirmed.

### Responsive Breakpoints

- **Desktop (>1024px):**
  - Left sidebar: query builder (sticky, 280px).
  - Main: results table (full width), detail drawer on right overlay.
  - Modal: dedupe + tag-to-mandate as modals.

- **Tablet (768–1024px):**
  - Query builder: collapsible panel above results.
  - Results: full-width table (horizontal scroll if needed).
  - Drawer: full-width modal.

- **Mobile (<768px):**
  - Query builder: modal, opens from header *Filters* button.
  - Results: stacked card list (compact mode; tap to expand detail drawer).
  - Actions: sticky footer with *Review Selected* button; count badge.

---

## Success Metrics

**Engagement:**
- **Sourcing searches per analyst per month** (target: >15).
- **Import rate** (% of searched candidates imported; target: >40%).
- **Median time-to-import** per candidate (target: <3min from search start).
- **Source coverage** (% of mandates assigned ≥1 sourced candidate; target: >75%).

**Quality:**
- **Dedupe false-negative rate** (duplicate targets imported as new; target: <2%).
- **Sourced candidate match rate** (% of imported targets that match to an active deal post-matching; target: >60%).
- **Mandate assignment accuracy** (% of sourced candidates tagged to mandate where they actually fit; target: >85%).

**Efficiency:**
- **Bulk import time** (avg seconds per 10-candidate batch; target: <45s including dedupe).
- **Undo rate** (% of imports reversed within 24h; target: <5% — indicates low regret).

---

## Competitive Comparison

| Dimension | Grata / SourceScrub | Cyndx | DealFlow AI |
|---|---|---|---|
| **Multi-source connectors** | Yes (10+) | Yes (8+) | Yes; prioritize lower-mid-market sources (regional DBs, industry vertical feeds) |
| **Dedupe & enrichment** | Built-in; high accuracy | Built-in | Built-in; dedupe feeds directly into matching engine |
| **Compliance-first outreach** | No; sourcing only | No; sourcing only | **Yes — sourced candidates are pre-validated for mandate + compliance before outreach** |
| **Price point** | $50k–$150k/yr (enterprise) | $100k+/yr | Included in DealFlow platform; targets boutiques <$50k annual | 
| **Integration to deal workflow** | Standalone; export to CRM | Standalone; integration toolkit | **Native** — sourcing → matching → compliant outreach in one UI |
| **Lower-middle-market fit** | Limited (priced for upper-mid) | Limited | **Primary** — sourcing cadence + match velocity match boutique deal velocity |

**DealFlow advantage:** Sourcing is not a separate tool; it feeds directly into the matching engine (no export/re-import friction) and compliance-checked outreach. Boutiques can run 2–4 sourcing → matching → outreach workflows in parallel per mandate without switching tools. Pricing is all-in-one, not per-seat or per-connector.

---

## Notes for Implementation

- **Data freshness:** Source data latency varies; clearly label *Last Updated* per source per row to set expectations.
- **Dedupe at scale:** Firm's target repository can grow to 5k+ candidates; dedupe queries must be indexed on company name + domain hash for <500ms response at 10k targets.
- **Connector reliability:** Plan for source API rate-limits + outages; queue partial results and allow user to retry failed sources independently.
- **Audit trail:** Log all imports, merges, and undos for compliance review (audit trail required by most M&A advisory compliance regimes).


---
**Approved design (v9):** `design/sourcing-workspace.html`
