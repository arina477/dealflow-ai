# Buyer Universe — Per-Page Product Description

## Purpose

The Buyer Universe screen is the deal analyst's primary workspace for assembling, refining, and validating the candidate buyer pool for an M&A mandate. It ingests integrated data from connected sources (firmographics, prior deal history, disclosed M&A activity), applies dealmaker-authored criteria filters, enriches decision-maker contact information, flags data gaps that block compliant outreach, and stages the universe for AI-driven ranking via the Matches engine. Success = a curated, enriched, compliant-ready buyer roster that feeds directly into qualified match recommendations without CRM hand-off or manual data scrubbing.

## Audience

**Primary:** Analysts and Associates — task owners for buyer list assembly and criteria refinement; daily users who filter, enrich, and verify before submission.

**Secondary:** Advisors — spot-check universe composition, challenge filter logic, review flagged data gaps, and sign off on submission (gating step before AI matching).

**Gate:** Role-based auth; restricted to users on the active mandate with `analyst` or `advisor` role. Readers-only access for `client_contact` (view-only dashboard, no filters or enrichment triggers).

## Entry Points

1. **From Mandate Overview** — "Build Buyer Universe" or "Edit Universe" CTA on the deal detail page.
2. **Direct route** — `/mandates/:id/buyers`.
3. **From Matching page** — "Back to Universe" breadcrumb or CTA after matching results render (feedback loop for refinement).

## Content Sections

### 1. Header + Metadata
- Mandate name and deal ID.
- Universe status badge: `draft` (in-progress, not submitted), `submitted` (awaiting AI match run), `matched` (matches already computed).
- Timestamp of last modification and last enrichment batch.
- Quick stats: Total candidate count | Enriched % | Data-gap % | Days since last update.

### 2. Candidate Buyer Table
**Columns (default visible):**
- **Company name** (sortable) — linked to detail view; flag company-level dedup match if present.
- **Industry / Sector** (filterable) — mapped to firmographic data.
- **Transaction stage** (sortable; filterable) — "Active buyer," "Passive," "Portfolio hold," "Divested recent," derived from data source signals.
- **Contact status** — icon + label: "Verified" (enrichment complete, key decision-maker identified), "Partial" (some contacts, gaps in coverage), "Pending" (enrichment queued), "Failed" (source outage or invalid record).
- **Data completeness** (visual bar, 0–100%) — firmographics ✓ | Location ✓ | Buyer segment ✓ | Decision-maker ✓ | Email ✓ | Phone ✓.
- **Include / Exclude** — toggle (bulk select via header checkbox) to mark for submission or remove from universe.
- **Actions** — inline: "View detail," "Trigger enrichment," "Flag for review" (sends note to advisor).

**Row states:**
- Standard row: `white` background.
- Enrichment in-flight: `light-blue` tint + spinner badge.
- Data-gap flagged: `light-yellow` tint + warning icon.
- Excluded: `light-gray` tint + strikethrough text.
- Dedup match (secondary record): `bordered` outline, linked to primary.

**Sorting & pagination:**
- Default sort: by inclusion status (included first), then by contact completeness (high to low).
- 50 rows per page; lazy-load on scroll or explicit "Load more."

### 3. Criteria Filters (Sidebar or Collapsible Section)
**Filter groups:**

- **Buyer Segment** (multi-select) — "Financial buyer (PE/Growth)," "Strategic buyer," "Founder-backed," "Family office," "Infrastructure fund," custom segments from mandate Scope doc.
- **Geography** (multi-select) — country / region; default inherited from Scope but user-editable.
- **Transaction Type** (single-select radio or toggle) — "Add-on / Bolt-on," "Platform / Takeout," "Dividend recaps," "All active."
- **Enterprise Value Range** (slider or input pair) — default from Scope; allow tightening for focused outreach.
- **Industry Focus** (multi-select) — aligned to target sector(s); tag-based, searchable.
- **Data Readiness** (toggle group) — "Show only enriched," "Include pending," "Hide data-gaps."
- **Exclusion Rules** (collapsible sub-section) — pre-configured: "Exclude current portfolio cos," "Exclude competitors," "Exclude prior failed engagements" (checkbox list, sourced from prior deals in DB); plus freeform "Block list" textarea for ad-hoc exclusions.

**Filter behavior:**
- Real-time row filtering; no "Apply" button (instant feedback).
- Active filter chip count displayed in header (e.g., "4 filters active").
- "Reset filters" button to restore mandate defaults.
- "Save filter preset" button to store custom combos for reuse.

### 4. Enrichment Status Panel
**Display:**
- Progress summary: "Enriching 12 of 45 records..." with estimated time-to-completion (e.g., "~4 min remaining").
- Enrichment log: expandable list of recent batches (timestamp, count, status: "Complete," "Partial," "Failed").
- "Trigger full enrichment" button — batches all pending + partial records; requires advisor sign-off if >20 new records or data-gap rate >30%.
- "View enrichment details" link — opens modal showing which fields were filled, which failed, and why (contact not found in LinkedIn, firmographic API timeout, etc.).

### 5. Data-Gap Flag & Review Queue
**Display:**
- Summary badge: "3 records flagged for review" (links to filtered view: `Data-gap == true`).
- Flagged row indicators: yellow warning icon + tooltip explaining the gap (e.g., "No decision-maker email; enrichment timed out").
- "Flag for review" bulk action — mark selected rows as needing advisor sign-off before outreach (creates a notification for the advisor).
- Modal: "Review flagged records" — shows all flagged rows with gap reason, suggested remediation (try enrichment again, manual lookup link, skip this buyer).

### 6. Submit to Matching Action
**Button state & behavior:**
- Disabled until: (a) universe has ≥10 candidate rows, (b) ≥70% are enriched, (c) no flagged-for-review rows remain or advisor has reviewed.
- On click: confirmation modal — "You are about to submit [45] buyers for AI matching. After submission, the universe is locked for editing. OK?" (plus option to continue editing).
- On confirm: POST `/mandates/:id/buyers/submit` → sets status to `submitted`, triggers async match-job, redirects to Matches page with link "Back to Universe."

## Interactions

### Add / Bulk-add Buyers
- **"Add buyer" button** (top-right) — opens modal with two tabs:
  - **Search & add** — search box queries the data store (firmographics DB, prior deal partners). Results display company name + quick preview (location, sector, last deal). Click to add; bulk-add via checkboxes.
  - **Upload CSV** — paste or upload CSV (columns: company name, location, industry, optional: contact email). System auto-matches against firmographics and flags ambiguous matches for manual review.
- After add: rows appear in table as "Pending enrichment" (grayed, spinner); enrichment is triggered automatically after 5-second debounce or on manual trigger.

### Remove / Exclude Buyers
- Inline "Remove" action or toggle "Exclude" — marks row for removal (grayed out); can be undone via "Restore" link until submission.
- Bulk remove via header checkbox + "Remove selected" button.

### Filter & Search
- **Global search box** (top of table) — searches company name, location, contact name; results highlight matching text.
- **Sidebar criteria filters** — real-time multi-select / slider interactions; filter pills appear in header.
- **Saved filter presets dropdown** — quick switch between "All active," "PE only," "Geographic focus," etc.

### Trigger Enrichment
- Inline "Enrich" button (per row) — re-runs enrichment for that buyer; spinner badge replaces button during flight.
- "Enrich all pending" button (enrichment panel) — batches all pending records; shows progress bar + ETA.
- Post-enrichment: row contact-status updates to "Verified" (if successful) or "Partial" / "Failed" (if gaps persist).

### Flag & Review
- Inline "Flag for review" icon (three-dot menu on each row) — marks row + adds optional note ("CEO email not found—use LinkedIn?"). Advisor receives notification.
- Advisor workflow: notification links to Buyer Universe, filtered to "flagged" rows; modal review of each flag + decision to "Approve for outreach" or "Remove from universe."

### Dedup & Merge
- If system detects likely duplicate (same firmographics + location) during enrichment or import, shows "Potential match: [other company]" alert in row.
- On click, modal shows side-by-side comparison; user selects primary record, other is marked as duplicate link (appears with `dedup-match` badge).

## Data Requirements

### Placeholder Endpoints

**GET /mandates/:id/buyers**
```yaml
Response:
  universe:
    mandate_id: string
    status: "draft" | "submitted" | "matched"
    created_at: timestamp
    last_modified: timestamp
    last_enrichment_at: timestamp
    candidates: array of {
      buyer_id: string
      company_name: string
      sector: string
      location: string (country code)
      transaction_stage: string
      firmographic_profile: object (location, HQ, size, etc.)
      decision_makers: array of {
        id: string
        name: string
        title: string
        email: string (nullable)
        phone: string (nullable)
        linkedin_url: string (nullable)
        enrichment_status: "verified" | "partial" | "pending" | "failed"
      }
      data_completeness: int (0–100)
      contact_status: "verified" | "partial" | "pending" | "failed"
      enrichment_error: string (nullable)
      dedup_match_id: string (nullable, if duplicate)
      included: boolean
      flagged_for_review: boolean
      review_note: string (nullable)
    }
    enrichment_batch:
      status: "idle" | "in-flight" | "complete"
      pending_count: int
      progress: int (%, if in-flight)
      estimated_completion_sec: int (nullable)
      last_batch_timestamp: timestamp
      last_batch_error: string (nullable)
```

**POST /mandates/:id/buyers/add**
```yaml
Request:
  source: "search" | "csv_upload"
  companies: array of { company_name, location?, industry? }
Response:
  added_count: int
  conflicts: array of { company_name, existing_buyer_id } (duplicates flagged)
  status: "ok" | "partial" (some rows failed to match in DB)
```

**POST /mandates/:id/buyers/:buyer_id/enrich**
```yaml
Response:
  buyer_id: string
  decision_makers: array (updated)
  firmographics: object (updated)
  completeness: int (new %)
  status: "ok" | "partial" | "failed"
  error: string (nullable)
```

**POST /mandates/:id/buyers/enrich-batch**
```yaml
Request:
  buyer_ids: array (optional; if null, enrich all pending)
Response:
  enqueued_count: int
  job_id: string (for polling progress)
  estimated_completion_sec: int
```

**GET /mandates/:id/buyers/enrich-batch/:job_id**
```yaml
Response:
  status: "pending" | "in-progress" | "complete" | "failed"
  progress: int (%)
  processed_count: int
  success_count: int
  failed_count: int
  errors: array of { buyer_id, reason }
```

**POST /mandates/:id/buyers/submit**
```yaml
Request:
  (no body; submission is idempotent)
Response:
  status: "submitted"
  match_job_id: string
  estimated_match_completion_sec: int
  redirect_url: "/mandates/:id/matches"
```

**PUT /mandates/:id/buyers/:buyer_id**
```yaml
Request:
  included: boolean (optional)
  flagged_for_review: boolean (optional)
  review_note: string (optional)
Response:
  buyer: object (updated row)
```

**GET /mandates/:id/buyers/filters/preset**
```yaml
Response:
  presets: array of {
    id: string
    label: string
    filters: object { segment, geography, ev_range, etc. }
    created_at: timestamp
  }
```

## Empty / Error / Loading States

### No Candidates
- Empty state illustration + heading: "No buyers yet. Start by searching our data store or uploading a list."
- Two CTAs: "Search data store" and "Upload CSV."
- Hidden sections: filters, enrichment status (show on first add).

### Enrichment Pending
- Table rows display; rows marked "Pending enrichment" have light-blue tint + spinner badge in contact-status column.
- "Enrichment in progress..." banner at top: "Enriching 12 records. You can leave this page; we'll notify you when complete." (No hard block, UX remains responsive.)
- Progress bar in enrichment panel.

### Enrichment Failed (Partial)
- Affected rows show `light-yellow` tint + warning icon.
- Contact-status column displays "Partial (5/8 fields)." Hover shows which fields failed.
- "View enrichment details" link opens modal listing errors.
- Retry button available (triggered enrichment does not auto-retry; user must click).

### Source Outage or API Timeout
- Banner alert: "Enrichment unavailable right now (API timeout). Retry in a few minutes or proceed with current data." (Non-blocking; submission still possible if ≥70% already enriched.)
- Affected rows display "enrichment_error" in tooltip; contact-status remains "partial" or "pending."
- "Retry enrichment" button retries via background job when source recovers (no user action required after first attempt).

### Approval Gate Failure (≤10 buyers, <70% enriched, flagged rows)
- Submit button disabled with tooltip: "Unlock: need ≥10 buyers, ≥70% enriched, and ≤0 flagged records. Current: [N] buyers, [X]% enriched, [Y] flagged."
- CTA suggests remediation: "Add [Z] more buyers" or "Enrich [Y] pending records."

### Submission In-Flight
- Submit button shows spinner, label changes to "Submitting...," disabled state.
- Modal remains open until POST completes.
- On success: auto-redirect to Matches page with banner: "Universe submitted. AI matching in progress..." (polling UI shows match-job progress, cf. Matches PD).

## Responsive Breakpoints

### Desktop (1200px+)
- Sidebar filters on left (fixed, ~300px width); table fills remaining space.
- Enrichment status panel fixed on right sidebar or above table.
- 50 rows per page; horizontal scroll for minor overflow.

### Tablet (768px–1199px)
- Sidebar filters collapse to hamburger menu (side drawer on open).
- Enrichment status panel moves below table (collapsible accordion).
- 30 rows per page.

### Mobile (< 768px)
- Single-column layout: filters at top (drawer), then table, then enrichment panel.
- Table shows essential columns only: company name, contact status (icon), include/exclude (toggle).
- Secondary columns (sector, transaction stage, completeness bar) accessible via row expand or detail view.
- 15 rows per page.

## Success Metrics

1. **Time to submit** (tier: analyst engagement) — median time from page load to "submit to matching" confirmation, across cohorts. Target: < 8 min for 45-record universe (includes 1–2 enrichment cycles).

2. **Enrichment success rate** (tier: data quality) — % of candidate records reaching ≥70% completeness after enrichment run. Target: ≥85%.

3. **Universe reuse rate** (tier: process efficiency) — % of new universes that reuse a saved filter preset. Target: >40% (indicates learnable buyer-profile patterns).

4. **Submission approval rate** (tier: advisor trust) — % of universes submitted without advisor flag escalation (i.e., ≤5 flagged records pre-submission). Target: ≥75%.

5. **Matches engagement** (tier: downstream value) — % of submitted universes that result in ≥1 match with confidence ≥65% and outreach attempt. Target: ≥60% (validates universe quality feeds AI ranking).

6. **Data-gap detection rate** (tier: compliance) — avg % of records flagged for review due to missing decision-maker email before first outreach attempt. Target: <20% (lower is better; indicates enrichment coverage).

7. **Manual override frequency** (tier: system trust) — % of analyst edits to auto-enriched fields (e.g., overwriting a contact name or phone). Target: <5% (high trust in enrichment accuracy).

## Competitor Comparison

### SourceScrub, Grata
- **Build list:** keyword / firmographic filters (similar to our criteria filters).
- **Data:** Third-party append (similar enrichment philosophy).
- **Output:** CSV or CRM sync (SourceScrub → Salesforce; Grata → email list).
- **Workflow:** Filter → export → external tool (CRM, email platform, manual outreach).

### DealFlow AI Differentiation
1. **Integrated matching:** Universe feeds directly into AI-driven buyer ranking (no export; no CRM hand-off needed). Analyst sees AI confidence scores + reasoning for each match in next step, closing the feedback loop.
2. **Compliance-first design:** Contact enrichment includes regulatory flags (sanctions screening, data-privacy consent signals) baked into the contact detail (future T9 gate); SourceScrub / Grata flag at export time (too late for refinement).
3. **Mandate-scoped context:** Buyers are filtered and enriched within deal-specific Scope (EV range, geography, buyer segment); external tools require manual scope enforcement via email rules or CRM field values.
4. **Dedup & link intelligence:** System recognizes buyer profile variants (e.g., PE firm flagship + new SPV) and surfaces as dedup matches; analysts can link or exclude in one action. SourceScrub / Grata surface as separate rows.
5. **Real-time advisor loop:** Flagged records trigger async advisor notification + in-page review modal; bottleneck is visible and resolved without leaving the platform. Grata / SourceScrub require async email or Slack for feedback.

**Net:** DealFlow's universe is a live, feedback-enabled input to the matching engine, not a static export artifact. Analysts ship faster because enrichment, matching, and compliance gating are threaded into one workflow.


---
**Approved design (v9):** `design/buyer-universe.html`
