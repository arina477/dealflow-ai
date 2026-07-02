# Mandates List Page

## Purpose

The Mandates list serves as the operational hub for M&A advisors and analysts to manage sell-side engagements end-to-end. It displays all active and archived mandates with real-time visibility into sourcing progress, matching outcomes, and outreach performance—enabling deal leaders to prioritize high-momentum opportunities and spot bottlenecks at a glance. The page consolidates status, KPIs, and next-action entry points to reduce context switching and accelerate mandate lifecycle progression.

## Audience

**Primary personas:**
- **Advisor / Deal Lead** — owns mandate strategy, reviews buyer match quality, approves outreach, monitors deal velocity
- **Analyst** — executes mandate sourcing, filters by status, tracks buyer responses, logs meetings and objections

**Access:** Authenticated users with role assignment (Advisor ≥ read, Analyst ≥ edit own mandate data; permissions enforced server-side per mandate ownership and team scope).

## Entry Points

1. **Navigation sidebar** — "Mandates" link in main left nav (always visible, active when on `/mandates` route)
2. **Dashboard card** — CTA "View all mandates" from user dashboard; routes to `/mandates` with optional `?filter=active`
3. **Onboarding flow** — First-time users land on empty state → "Create your first mandate" CTA
4. **Deep links** — `/mandates?status=matching` (filter preset); `/mandates?team=<team-id>` (team scope)

## Content Sections

### Header & Controls
- **Page title:** "Mandates"
- **Quick stats banner** (optional, above table): total active mandates, average days in sourcing, total buyers matched this month
- **Primary CTA:** "+ New mandate" button (right-align, opens mandate creation form in modal or navigates to `/mandates/create`)
- **Filter & sort row:**
  - Status filter: All / Sourcing / Matching / Outreach / Pipeline / Archived (multi-select or single dropdown)
  - Search by mandate name / seller name / industry (text input with debounced live search)
  - Sort: Last updated (default desc), Created date, Buyer count, Reply rate
  - Team filter (if multi-team org): My team / All teams (dropdown)

### Mandate Table / Card Grid
**Display format:** responsive grid (cards on mobile / tablet; table on desktop ≥1024px)

**Columns / card fields:**
1. **Mandate name** (link to detail page `/mandates/:id`) — primary label, bold, left-align
2. **Seller / Industry** — secondary label, smaller type, gray (e.g., "TechVenture Inc. | SaaS")
3. **Status badge** — color-coded pill:
   - Sourcing (amber/yellow) — in initial buyer discovery phase
   - Matching (blue) — AI matching in progress or candidates identified
   - Outreach (orange) — personalized reach-outs sent or in queue
   - Pipeline (green) — active buyer interest / meetings scheduled
   - Archived (gray) — closed deal or discontinued mandate
4. **Days in stage** — e.g., "12d sourcing" (right-align, gray); updates dynamically
5. **Key metrics row** (on cards; sub-rows on table):
   - Buyers matched: count + sparkline trend (7-day)
   - Outreach sent: count + reply rate % (e.g., "24 sent, 8% replied")
   - Next milestone: hover tooltip or expandable row showing immediate next action
6. **Last activity** — timestamp (e.g., "Updated 2h ago") or agent (e.g., "Sourcing agent running…")
7. **Owner avatar + name** — small pill, right side (facilitates team filtering / accountability)

**Sorting interaction:** Click column header to sort ascending / descending (visual indicator: arrow + bold header). Persist sort pref in localStorage.

### Empty State
**No mandates exist:**
- Large centered icon (briefcase or handshake)
- Headline: "No mandates yet"
- Body: "Create a new mandate to begin sourcing buyers and matching AI." (2 lines max)
- Primary CTA: "+ New mandate" button
- Secondary text: "Need help? [Link to mandate-creation guide]" (soft gray link)

### Loading State
- Skeleton cards (5 rows) or pulse animation while fetching mandate list
- Preserve filter/search params in UI (show "Filtered by: Sourcing" even while loading)

### Error State
- Icon + headline: "Failed to load mandates"
- Body: "Please try again or contact support if the issue persists."
- Retry button; support contact link

## Interactions

### Open Mandate
- Click mandate name (or anywhere on row/card) → navigate to `/mandates/:id` (detail page; scope: not covered in this spec)
- Keyboard: Enter key on focused row also navigates

### Create New Mandate
- Click "+ New mandate" button → open modal form or navigate to `/mandates/create` with step-by-step wizard
  - Steps: seller info (name, industry, target sale price), sourcing parameters (buyer profile, geographies, deal size thresholds), approval chain
  - On submit, POST to `/api/mandates` and redirect to new mandate detail page
  - On cancel, return to list (no navigation side effect)

### Filter & Search
- **Status filter:** Click filter icon or dropdown; multi-select or single-choice (UX TBD by design block). Apply immediately; URL updates to reflect query param (e.g., `?status=sourcing,outreach`). Persist filter state across session in localStorage.
- **Search:** Type in mandate name / seller name field; debounce 300ms and filter client-side OR server-side (TBD by architecture). Show "No results" if no matches; clear search with ✕ button in input.
- **Sort:** Click column header; toggle ascending ↑ / descending ↓. URL param `?sort=created_date&order=asc` optional (design preference).

### Responsive Behavior
- **Desktop (≥1024px):** full-width table with horizontal scroll if needed; filter controls in sticky header
- **Tablet (768–1023px):** stacked cards (2 columns); filter controls collapse to drawer or sidebar; table becomes card view
- **Mobile (<768px):** single-column card stack; filter button opens bottom sheet; sort/search in action bar; swipe to reveal owner/actions on each card (optional)

### Secondary Actions (Ellipsis Menu)
Right-click or ellipsis (⋮) on each mandate row:
- Edit mandate parameters (for Advisor)
- Archive mandate
- Duplicate as template (for bulk onboarding)
- View audit log / activity feed
- Share with team member (if collaboration / RBAC scope defined)

## Data Requirements

### API Endpoints (Placeholders)
- **GET `/api/mandates`** — fetch paginated list
  - Query params: `?page=1&limit=20&status=sourcing,matching&search=acme&sort=created_date&order=desc&team_id=<team-id>`
  - Response: `{ mandates: [], total_count: 42, page: 1 }`
  - Each mandate object: `{ id, name, seller_name, industry, status, created_at, updated_at, days_in_stage, buyers_matched, outreach_sent, reply_count, owner_id, owner_name, owner_avatar_url, ... }`

- **POST `/api/mandates`** — create new mandate (used by New mandate modal)
  - Payload: `{ seller_name, industry, target_price_min, target_price_max, geographies[], buyer_profile, ... }`
  - Response: newly created mandate object + 201 status; redirect to detail page

- **GET `/api/mandates/:id`** — fetch single mandate (for detail page, out of scope here)

### Cache & Refresh
- Cache mandate list for 30s; refresh on:
  - Page return from detail view
  - Manual refresh button (⟲ icon, top-right)
  - Filter/sort change
  - Interval poll (optional): every 60s if user is on list page (detect tab visibility)

### Permissions (Backend Enforced)
- Analyst can view all mandates in their team; create, edit, delete only own records
- Advisor can view all team mandates; approve, archive, move between statuses
- Admin can view all mandates across org; full CRUD

## Empty / Loading / Error States

### Empty State (No Data)
*Shown when mandate list is empty and no filters applied.*
- Centered card with briefcase icon (or custom illustration)
- Headline: "No mandates yet"
- Body: "Create your first mandate to begin sourcing and matching buyers. Our AI will identify qualified candidates based on your criteria."
- Primary CTA: "+ Create mandate"
- Secondary help link: [Setup guide](/#)

### Loading State (Fetching List)
*Shown while GET /api/mandates is pending.*
- 5–7 skeleton card placeholders (match card layout for visual consistency)
- Pulse animation (opacity 0.6 → 1.0 over 1.5s loop)
- Preserve current filter/sort labels above skeletons (e.g., "Filtered by: Sourcing")
- Timeout: if load takes >10s, replace with error state

### No Results (Filtered)
*Shown when filters match zero mandates.*
- Icon + headline: "No mandates match your filters"
- Body: "Try adjusting status, search term, or team scope."
- Quick action: "Clear filters" button (resets to default view)

### Error State (Load Failure)
*Shown if GET /api/mandates fails (5xx, network error, auth timeout).*
- Icon + headline: "Failed to load mandates"
- Body: "An error occurred while fetching your mandates. Please try again."
- Primary CTA: "Retry" button (re-triggers fetch)
- Secondary: [Contact support](#)

## Responsive Breakpoints

| Breakpoint | Layout | Behavior |
|---|---|---|
| **Mobile** (<768px) | Single-column card stack | Filter button opens bottom sheet; sort inline or in popover; swipe/long-press for actions |
| **Tablet** (768–1023px) | 2-column grid or simplified table | Sidebar filter drawer; responsive header; hide tertiary columns (Days in stage) |
| **Desktop** (≥1024px) | Full-width table, sticky header | All columns visible; horizontal scroll if needed; filter row always visible |

## Success Metrics

1. **Engagement:**
   - % of advisors who visit Mandates list ≥1x per week
   - Avg time on list page (target: >30s, indicating review vs. quick pass-through)
   - Filter/sort usage rate (indicator of feature discoverability and need)

2. **Adoption:**
   - # of mandates created per advisor per month (trend over time)
   - % of mandates progressing from Sourcing → Matching → Outreach within target timelines
   - Reactivation: % of users who return to list >7 days after first visit

3. **Operational:**
   - Avg days in each status (Sourcing, Matching, Outreach, Pipeline) — track bottlenecks
   - Reply rate on outreach (KPI visibility, proxy for AI match quality)
   - Mandate conversion rate (Outreach → Pipeline → closed deal)

4. **Product Quality:**
   - Error rate on list page load / filter / sort (<0.5%)
   - 95th percentile page load time (<2s on 4G)
   - Zero missing data renders (all metrics populated, no null displays)

## Competitor Comparison

### DealCloud
- **Strength:** Flexible "deals view" with customizable columns; deep filtering and bulk actions
- **Weakness:** Mandates are implicit (derived from deal state), not first-class; requires navigation depth to see engagement status
- **Our advantage:** Mandate is the primary object; sourcing→outreach lifecycle is transparent and actionable at a glance; AI match quality (reply rate) surfaces immediately, enabling advisor to spot weak matches early

### Intralinks / Anacomp
- **Strength:** Audit-trail rigor; role-based column visibility
- **Weakness:** Table-centric, slow to load; no real-time KPI badges; advisor must drill to detail page for progress visibility
- **Our advantage:** Card + table dual view; real-time metric rollup (buyers matched, reply %); quick status badges reduce cognitive load

### Pitchbook
- **Strength:** Integrated market data; rich seller profiling
- **Weakness:** Mandate management is secondary feature; no outreach workflow integration; no AI buyer matching
- **Our advantage:** Purpose-built for sourcing + matching + compliance outreach loop; AI-powered match quality surfaced in list view; compliance-first approach (not an afterthought)

### Our Positioning
"Mandates list is your deal command center—see every engagement's AI-matched buyer candidates and outreach velocity in one view, no drilling required. Unlike generic CRMs, our list is built for the M&A advisor workflow: source, match, vet, and reach out—all tracked transparently."



---
**Approved design (v9):** `design/mandates-list.html`
