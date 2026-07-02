# Per-Page PD: Companies & Contacts (Data Management)

## Purpose

Central hub for maintaining company and contact master data quality in the M&A deal pipeline. Analysts and associates browse, search, verify, enrich, and deduplicate company and contact records—preserving data provenance for compliance audits while feeding downstream matching and outreach modules with clean, trustworthy inputs.

**Routes served:** `/companies` (list) and `/companies/:id` (detail).

---

## Audience

- **Primary:** Analysts, Associates (deal sourcing + operations)
- **Secondary:** Compliance reviewers (audit trail access)
- **Access:** Authenticated; role-gated by team/org (deal access patterns inherited from admin config)

---

## Entry Points

1. **From navbar:** "Companies" → lands on list view
2. **From deal detail (`/deals/:id`):** Company card includes "View company" link → detail view
3. **From matching results:** Matched buyer/seller company names link → detail view
4. **From deduplication task:** Pending merge review → detail view (compare mode)
5. **Direct URL:** `/companies` or `/companies/:id`

---

## Content Sections

### List View (`/companies`)

#### Header & controls
- Page title: "Companies"
- Search bar (full-text: name, ticker, domain, CRN) with autosuggest dropdown (powered by `/api/companies/search`)
- Filter sidebar (toggleable on mobile):
  - **Industry:** multiselect (auto-populated from active data)
  - **Region:** multiselect (countries / states)
  - **Data quality:** dropdown (All, Flagged for review, Verified, Unverified)
  - **Merge status:** toggle (Include pending merges)
  - **Linked to:** dropdown (My deals, All deals)
- Sort: Name (A-Z, Z-A), Recently updated, Confidence score
- Pagination: 25 / 50 / 100 per page; total count in header

#### Data quality badge system
Each company row displays inline badge:
- **Verified** (green checkmark) — human-confirmed fields
- **Flagged** (orange warning) — enrichment conflict OR missing critical field (domain, CRN, revenue range)
- **Enriched** (blue info) — updated from external source in last 30 days
- **Duplicate candidate** (red) — flagged by deduplication engine; review button links to merge dialog

#### Table columns (responsive: collapse to card layout on mobile)
- Company name (bold link to detail)
- Ticker / CRN (if exists)
- Industry
- HQ location
- # of contacts (linked contact count; clickable → show contacts sublist)
- Last updated (date + "by: [First name]")
- Data quality badge(s)
- Actions menu: View detail, Edit inline (name/industry/location), Merge, Delete (soft, requires confirmation)

#### Empty state
- Illustration + copy: "No companies yet. [Import companies] or [Add manually]."
- Actions: "Import CSV" button, "New company" button (see Data Ingestion flow)

### Detail View (`/companies/:id`)

#### Header section
- Company name (h1)
- Ticker / CRN (subtitle; copyable)
- Data quality status badge + "Last verified: [date] by [name]" link (→ audit log)
- Actions menu: Edit, Merge, Link to deal, Share, Delete

#### Left column (Core fields)

**Identifiers**
- Legal name (text; required)
- Ticker (text; optional; validates against exchanges or stored ticker catalog)
- CRN / Tax ID (text; optional; country-specific)
- Website domain (text; validates format + reachability status indicator)

**Classification**
- Industry (single-select from taxonomy; required)
- Sub-industry (auto-populated from taxonomy; optional)
- Company stage (Seed / Early / Growth / Late / Public / Acquired / Exited; optional)
- Revenue range (dropdown; e.g. <$1M, $1-10M, $10-100M, $100M+)

**Location**
- HQ country (required)
- HQ state/province (if applicable)
- Additional offices (repeating: city, country; displays up to 3 inline, "View all" link expands)

**Metadata**
- Founded year (year picker)
- Employee count range (dropdown or text; e.g. 1-10, 11-50, 51-500, 500+)
- Description (long text; ~500 char max; auto-populated from external sources or manual entry)

#### Right column (Provenance & confidence)

**Data source & verification**
- Each field shows provenance tag in muted text: "(from Crunchbase, verified Jan 2024)" or "(manual entry, Dec 2024)"
- Confidence score per field (numeric 0–100, not displayed to user but drives sort/filter logic)
- Conflicting values: if enrichment engine disagrees with existing value, display both in expandable compare block (e.g. "Industry: Tech (verified) vs. SaaS (Crunchbase)")
  - User can accept/reject enrichment; preserves both in audit log

**Linked entities**
- **Contacts:** List/grid toggle; shows 5 primary contacts inline, "View all" expands or links to `/companies/:id/contacts`
  - Each contact card: name, title, email (masked until user clicks "reveal"), last interaction date
  - Add contact button → inline form or modal
- **Deals:** Badges showing linked deals (buyer/seller/advisor roles)
  - Links to deal detail or deal-list-filtered-by-company

**Audit trail** (collapsible)
- Timeline: last 10 changes (field, old → new, date, author)
- "View full history" link → modal or separate route

#### Tabs (below main content)

**"Contacts"** tab (embedded)
- Mini contact list (see *Contacts section* below)
- Add contact button

**"Enrichment history"** tab
- Chronological log of all enrichment attempts
- Each entry: source, fields attempted, date, acceptance/rejection status
- Filter by: accepted, rejected, pending

**"Compliance"** tab
- Data classification (Public / Internal / Restricted)
- Audit log (who accessed, when)
- Data share status (with external match engines, approval by compliance officer)

---

## Interactions

### Search & filter
- **Full-text search:** name, ticker, CRN, domain via `/api/companies/search?q=...`
- **Auto-suggest** dropdown (top 10 matches + recent searches)
- **Filters apply instantly** (no "Apply" button); URL updates to reflect state
- **Saved filters:** users can save filter presets (e.g. "High-confidence tech VCs in APAC")

### Data quality review workflow

**Flagged record:** User sees warning badge → clicks "Review" → modal opens:
- Issue summary (e.g. "Enrichment conflict: Revenue")
- Conflicting values side-by-side with sources
- User selects: "Keep existing", "Accept enrichment", or "Flag for manual review"
- Decision logged to audit trail

### Duplicate detection & merge

**Trigger:** Deduplication engine flags potential duplicates (similar name, domain, ticker, region) → badge on list view and detail view.

**Merge flow:**
1. Click "Merge" button → comparison modal opens
2. Display two company records side-by-side with field-level merge strategy
3. For each field, user chooses which value to keep (or enter new merged value)
4. Preview merged result
5. Confirm merge → soft-delete non-primary record, redirect to merged company detail
6. Audit log: "Merged [ID2] into [ID1]" + show merged fields

**Conflicting merges:** If two users attempt to merge the same pair simultaneously, system locks the secondary record and alerts the first user to pending review.

### Inline editing

**Quick edit mode:**
- Click pencil icon on any field (or double-click field value)
- Field becomes editable inline (text, dropdown, date picker)
- Save/Cancel buttons appear below field
- On save: field value updates, provenance tag resets to "manual edit [date]", audit log entry created
- Batch edit: checkbox to select multiple companies → bulk actions (assign industry, add tag, update contact count)

### Contact management

**From company detail, "Contacts" tab or section:**
- List all linked contacts (name, title, email masked, last interaction)
- Search/filter contacts within this company
- Add contact: 
  - Quick add form (name, title, email) → creates contact + links to company
  - Or match to existing contact via `/api/contacts/search` → link to this company
- View contact detail: click contact card → modal or navigate to `/contacts/:id`
- Unlink contact: hover contact card, click unlink icon → confirm

### Verification workflow

**Mark as verified:**
- Button in header: "Mark as verified"
- Confirmation modal: list which fields are being verified
- After confirmation: "Verified by [user] on [date]" displays in detail view
- Resets timer for re-verification (e.g. 6 months)

### Responsive & mobile considerations

- **Mobile list view:** Stack to card layout; filter sidebar collapses into drawer; search bar stays sticky top
- **Mobile detail view:** Tabs convert to horizontal scroll or stacked accordion
- **Breakpoints:**
  - Desktop (1024px+): sidebar filters visible, two-column detail layout
  - Tablet (768px–1023px): filters in drawer, single-column detail, tabs as accordion
  - Mobile (<768px): full-screen card stack, filter drawer, tabs vertical

---

## Data Requirements

### API endpoints (placeholder; implement per `/api/` spec)

**List & search**
- `GET /api/companies` — list with pagination, filters, sort
  - Query: `page`, `limit`, `search`, `industry`, `region`, `quality_status`, `sort`
  - Response: `{ companies: [...], total: number, has_next: boolean }`

- `GET /api/companies/search` — full-text autosuggest
  - Query: `q`, `limit` (default 10)
  - Response: `{ results: [{ id, name, ticker, match_type }] }`

**Detail**
- `GET /api/companies/:id` — full company record + provenance + linked entities
  - Response: `{ company: {...}, contacts: [...], deals: [...], audit_log: [...], enrichment_history: [...] }`

**Mutations**
- `POST /api/companies` — create company
- `PATCH /api/companies/:id` — update company (fields + provenance tracking)
- `DELETE /api/companies/:id` — soft-delete
- `POST /api/companies/:id/merge/:target_id` — merge two companies
- `POST /api/companies/:id/verify` — mark verified
- `POST /api/companies/:id/contacts` — add/link contact
- `DELETE /api/companies/:id/contacts/:contact_id` — unlink contact
- `POST /api/companies/:id/enrichment/:attempt_id/accept|reject` — accept/reject enrichment

**Related resources**
- `GET /api/contacts?company_id=...` — list contacts for company
- `GET /api/deals?company_id=...` — list deals linked to company

---

## States & Error Handling

### Loading states
- List view: skeleton cards (5 placeholders)
- Detail view: skeleton detail panel + contact list skeleton
- Search: spinner in search input; dropdown shows "Searching…"

### Empty states
- **No companies:** "Get started by [Importing CSV] or [Adding manually]"
- **No contacts linked:** "No contacts yet. [Add contact]"
- **No deals linked:** "Not yet linked to any deals"
- **Search no results:** "No companies match '[query]'. [Clear filters] or [Create new company]"

### Error states
- **Enrichment disagreement:** Display compare block; preserve both values; user selects which to keep
- **Merge conflict:** If merge sources have diverged since merge was initiated, display summary of divergences + option to cancel or auto-resolve (keeps most recent change per field)
- **Duplicate merge attempt:** "This company is already pending merge into [other company]. [View pending merge] or [Cancel]"
- **Offline/slow load:** "Unable to load companies. [Retry]"
- **Permission denied:** "You don't have access to view this company"

### Success feedback
- Field updated: toast "Company updated"
- Contact added: toast "Contact added"; card animates in
- Verified: banner "Company marked verified through [date]"
- Merge completed: redirect to merged company + toast "[Company A] merged into [Company B]"

---

## Responsive Breakpoints

| Breakpoint | Layout | Key changes |
|---|---|---|
| Desktop (1024px+) | Two-column: filters left, main content right | Sidebar filters always visible; detail view shows metadata right column |
| Tablet (768–1023px) | Single column with filters drawer | Filter sidebar toggles in/out; detail tabs horizontal scroll |
| Mobile (<768px) | Full-screen card stack | Filters drawer; tabs vertical accordion; all actions in action menus |

---

## Success Metrics

- **Data quality score:** % of companies with all critical fields (name, industry, CRN/ticker, location) ≥ 90%
- **Verification rate:** % of companies verified in past 6 months (target: ≥ 70% for active deal sources)
- **Duplicate detection accuracy:** % of auto-flagged merges confirmed by users (target: ≥ 85%)
- **Enrichment acceptance rate:** % of enrichment suggestions accepted by users (target: ≥ 60%, indicates good external data alignment)
- **Time to clean data:** avg. time from import → verified across critical fields (target: <10 min per company)
- **Audit trail integrity:** 100% of field changes tracked + loggable; no unattributed changes

---

## Competitor Comparison

| Capability | DealFlow AI | RocketReach | Hunter | Notes |
|---|---|---|---|---|
| Contact data store | ✓ M&A-contextualized | ✓ Sales/outreach focus | ✓ Email-first | Our edge: provenance + compliance audit trail |
| Deduplication engine | ✓ Manual review + auto-merge | ✗ | ✗ | Ours is native; competitors expect external CRM dedupe |
| Data provenance tracking | ✓ Field-level source + date | ✗ | ✗ | Compliance + transparency differentiator |
| Company master data | ✓ Industry, stage, revenue | ✓ Limited (focus on contacts) | ✗ | RocketReach covers similar scope but no M&A lens |
| Enrichment conflict resolution | ✓ Side-by-side compare + accept/reject | ✗ | ✗ | DealFlow unique: preserve both + log choice |
| Role-gated access | ✓ Team/deal inheritance | ✗ (org-level only) | ✗ (org-level only) | Finer granularity for deal teams |
| Integration with deal pipeline | ✓ Native (links to matching + outreach) | ✗ (webhooks only) | ✗ (webhooks only) | End-to-end workflow |

---

## Modules & Feature Mapping

- **#2 Data store:** Underlying company + contact records; enriched via external APIs
- **#3 Dedupe & enrichment:** Merge detection + conflict resolution UI
- **#9 Data quality:** Flags, verification workflow, audit trail
- **Related modules:** Matching engine (consumes clean data), Outreach engine (calls via contact detail)



---
**Approved design (v9):** `design/companies-contacts.html`
