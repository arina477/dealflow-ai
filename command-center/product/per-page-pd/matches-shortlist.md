# Matches & Shortlist

## Purpose
The **Matches & Shortlist** screen is DealFlow AI's core value delivery mechanism. For a given mandate, it presents AI-ranked buyer candidates with transparency-first matching rationale, enabling advisors to confidently build shortlists that feed compliant outreach. The page bridges deal sourcing and buyer identification with explainable AI ranking, turning algorithmic confidence into actionable trust.

---

## Audience
- **Primary:** Advisors and Deal Leads managing active mandates
- **Role-gating:** Authenticated users with `role: advisor` or `role: deal_lead` + mandate read permission (`mandates.id` must match authenticated user's assigned mandate scope)
- **Secondary access:** Engagement managers (view-only; no shortlist edit)
- **Guest/unauthenticated:** Blocked; redirect to login

---

## Entry Points
1. **From Mandates list** (`/mandates`) → click mandate card → route to `/mandates/:id/matches`
2. **From mandate detail** (`/mandates/:id`) → "View Matches" tab or button
3. **Deep link** (e.g., from email or saved shortcut): `/mandates/:id/matches?tab=ranked` or `/mandates/:id/matches?filter=fitness:high`
4. **From outreach prep** (compliance workflow) → "Back to matches" if shortlist needs revision

---

## Content Sections

### 1. Page Header & Context
- **Mandate identifier** (company name, deal type, deal value range if disclosed)
- **Status badge** (e.g., "Active", "Paused", "Pre-launch")
- **Last refresh timestamp** + "Refresh matches" button (re-runs AI ranking for current mandate + criteria)
- **Criteria summary chip-strip** (acquirer geography, industry focus, deal size, strategic intent) — clickable to drill into full mandate brief

### 2. Ranked Buyer List (Primary Content)
Core table/card layout (switch between table & card views):

**Per-buyer row displays:**
- **Fit Score** (0–100, visual bar + numeric label; positioned left for quick scan)
- **Buyer name & profile thumbnail**
- **Buyer segment** (e.g., "Strategic Buyer – Tech", "PE Firm – Lower Mid Market")
- **Recent deal velocity** (e.g., "3 acquisitions in past 18 months")
- **Rationale badge** (e.g., "Strategic fit", "Financial capacity", "Track record") — clicking opens rationale drawer
- **Quick-action icons:**
  - Expand rationale (chevron/eye icon)
  - Accept/approve (checkmark; adds to shortlist)
  - Flag/investigate (flag icon; marks for deeper diligence)
  - Reject (X or decline; removes from further consideration)
- **Secondary badge** (if applicable): "Flagged for follow-up", "Previously contacted", "Competitive risk"

**Sorting options:**
- Default: Fit score (descending)
- Alternative: Recency (most recently added to AI corpus), Deal velocity (highest activity first), Alphabetical

**Filtering:**
- Fit score range (high: 75–100, medium: 50–74, low: <50)
- Buyer segment (Strategic, PE, Sponsor, Corporate VC, etc.)
- Geography (match to mandate preference)
- Deal-size capability (align to mandate transaction size)
- Prior contact status (never contacted, previously contacted, in pipeline)

**Pagination/virtualization:**
- Load first 20 rows; lazy-load on scroll or "Load more" button
- For large candidate pools (100+), indicate total count and offer "View all" toggle

### 3. Rationale Evidence Drawer
**Triggered by clicking "rationale badge" or expand icon on a buyer row:**

**Drawer layout (right-side slide-in or modal):**
- **Buyer name + segment** (header)
- **Match score** (large, prominent)
- **Primary match drivers** (bulleted list, 3–5 key factors):
  - Example: "Portfolio company overlap: 40% of mandate target industry matches buyer's historical investments"
  - Example: "Geographic alignment: Buyer's recent deals cluster in mandate's target region"
  - Example: "Deal-size fit: Median acquisition size $150M–$500M matches mandate valuation band"
  - Example: "Strategic intent: Buyer's public guidance emphasizes platform add-on strategies"
- **Supporting evidence** (collapsible sections):
  - "Recent acquisition activity" (list: company name, date, valuation, industry)
  - "Public disclosures" (quotes from earnings calls, investor presentations)
  - "Advisor network signals" (e.g., "Flagged by 2 other advisors in Q2 as active buyer")
- **Data freshness indicator** (e.g., "Last updated 14 days ago; latest data: Q2 earnings, 3 recent announcements")
- **Suggest alternative rationale** link (if advisor disputes ranking) → logs feedback for model retraining

**Close drawer:** Click X or click outside drawer; preserve state if switching between buyers

### 4. Shortlist Panel (Right Sidebar / Bottom Sheet Mobile)
**Live shortlist summary:**
- **Header:** "Your shortlist" + count (e.g., "3 of 20 buyers selected")
- **Shortlist member cards** (compact, draggable for prioritization):
  - Buyer name
  - Fit score
  - Remove button (X)
- **Sort shortlist by:**
  - Fit score (descending, default)
  - Custom rank (drag-to-reorder for outreach priority)
- **Shortlist actions:**
  - "Review & confirm" button (takes advisor to confirmation screen before outreach prep)
  - "Export shortlist" (CSV: buyer name, fit score, contact info if available)
  - "Clear all" (with confirmation modal)
- **Visual feedback:** Green highlight on table row when buyer is in shortlist; prevent duplicate adds

### 5. Bulk Actions Bar (Optional, if >2 buyers selected)
- **Checkbox to select multiple rows**
- **Bulk actions dropdown:**
  - "Add selected to shortlist"
  - "Flag selected for diligence"
  - "Remove selected from consideration"
- **Selected count indicator** (e.g., "3 selected")

---

## Interactions

### Accept / Add to Shortlist
- **Trigger:** Click checkmark or "Add" button on buyer row; or drag buyer from list to shortlist panel
- **Behavior:** 
  - Buyer card highlights green; moves to shortlist panel (or appends if already loaded)
  - Toast confirmation: "Added [Buyer Name] to shortlist"
  - If shortlist reaches mandate's target count (e.g., 10), optional notification: "Target shortlist size reached"
  - State persists (local + API save) until advisor confirms or session ends

### Flag / Investigate
- **Trigger:** Click flag icon on buyer row
- **Behavior:**
  - Buyer card badge shifts to "Flagged for follow-up"
  - Opens small inline modal: "Why are you flagging this buyer?" (required free-text field, max 500 chars; options: "Needs deeper diligence", "Competitive risk", "Secondary interest", "Custom")
  - State persists; flagged buyers remain ranked but grouped under "Flagged" filter/tab option

### Reject / Remove from Consideration
- **Trigger:** Click X or "Decline" icon on buyer row
- **Behavior:**
  - Confirmation tooltip or inline: "Remove [Buyer Name] from consideration? This cannot be undone in this session."
  - On confirm: buyer row grayed out or removed from list; shortlist updated if buyer was selected
  - Toast: "Removed [Buyer Name]"
  - Rejected buyers excluded from future refresh unless advisor resets filters

### Open Rationale Drawer
- **Trigger:** Click "rationale badge", chevron icon, or buyer name
- **Behavior:**
  - Right sidebar or modal slides in with full rationale (see Content Sections)
  - Keeps main list in view (sidebar mode preferred)
  - Drawer remains open as advisor clicks through multiple buyers (no re-open needed)
  - Close: X button or click outside

### Confirm Shortlist
- **Trigger:** "Review & confirm" button in shortlist panel or dedicated confirmation screen
- **Behavior:**
  - Takes advisor to shortlist confirmation page (`/mandates/:id/shortlist/confirm`)
  - Shows final shortlist member list, allows final edits (add/remove)
  - Advisor reviews compliance flags (if any buyers trigger auto-compliance checks, e.g., sanctions list, conflict of interest)
  - Confirm button: locks shortlist, triggers mandate state transition to "shortlist_locked", routes to outreach prep
  - Option to save as draft and return later

### Refresh Matches
- **Trigger:** "Refresh matches" button in page header
- **Behavior:**
  - Loading spinner; message: "Re-ranking buyers based on latest data..."
  - Re-runs matching engine on current mandate + criteria (blocks if advisor hasn't yet selected any shortlist, optional)
  - Toast on complete: "Matches refreshed. 2 new high-fit buyers added." (if applicable)
  - Preserves shortlist if already confirmed; reorders ranked list if not

### Sort & Filter Changes
- **Trigger:** Dropdown selections or chip toggles in filter/sort controls
- **Behavior:**
  - List re-orders or filters in real-time (no page reload)
  - Active filters highlighted in chip-strip
  - Count updates (e.g., "Showing 12 of 48 buyers")
  - Preserve sort/filter state in URL params (`?sort=fitness:desc&filter=segment:strategic`) for shareable links

---

## Data Requirements

### API Endpoints (Placeholder; to be defined in B-block)

**GET /api/mandates/:mandateId/matches**
- Query params: `sort` (enum: score_desc, velocity_desc, alphabetical), `filter` (JSON object: fit_range, segment, geography, deal_size, contact_status)
- Response schema:
  ```json
  {
    "mandateId": "string",
    "mandateName": "string",
    "matchList": [
      {
        "buyerId": "string",
        "buyerName": "string",
        "buyerSegment": "enum",
        "fitScore": "number (0-100)",
        "rationale": {
          "primary_drivers": ["string"],
          "supporting_evidence": {}
        },
        "lastRefresh": "ISO8601",
        "isInShortlist": "boolean",
        "isFlagged": "boolean",
        "isRejected": "boolean"
      }
    ],
    "shortlist": ["buyerId"],
    "totalCount": "number",
    "lastRefreshTimestamp": "ISO8601"
  }
  ```

**GET /api/mandates/:mandateId/matches/:buyerId/rationale**
- Response: full rationale object (drivers, evidence, data freshness, alternative suggestions)

**POST /api/mandates/:mandateId/shortlist**
- Body: `{ "action": "add_buyer" | "remove_buyer" | "flag_buyer" | "reject_buyer", "buyerId": "string", "flagReason": "string (if flag)" }`
- Response: updated shortlist state + buyer card state

**POST /api/mandates/:mandateId/matches/refresh**
- Optional body: `{ "forceFullRank": "boolean" }`
- Response: re-ranked matches + delta summary (new high-fit buyers, dropped low-fit buyers)

**POST /api/mandates/:mandateId/shortlist/confirm**
- Body: `{ "shortlistMembersIds": ["buyerId"] }`
- Response: confirmation status, compliance check results, next-step URL (to outreach prep)

**GET /api/mandates/:mandateId/compliance-check**
- Checks selected shortlist buyers against sanctions lists, conflict checks, etc.
- Response: `{ "passed": "boolean", "flags": [{ "buyerId", "flagType", "severity" }] }`

### Data Freshness & Caching
- Match scores cached for 7 days; refresh available on-demand
- Buyer profile data (recent deals, segments) updated daily via external data feed
- Rationale evidence data pulled from: internal CRM, public disclosures (SEC filings, earnings calls), advisor network signals (crowdsourced via prior deals)

---

## Empty / Error / Loading States

### Loading State
- **Trigger:** Page first loads or refresh in progress
- **Content:**
  - Skeleton card rows (6 cards, gray placeholder bars for name, score, rationale)
  - Shortlist panel: "Loading shortlist..."
  - Header: "Fetching matches..." message
- **Duration estimate:** "Typically <3 seconds"

### No Matches Found
- **Trigger:** Mandate criteria too restrictive; no buyers meet thresholds
- **Content:**
  - Centered illustration (gears, funnel, or search icon)
  - Headline: "No matching buyers found"
  - Body text: "Your mandate criteria are narrowly defined. Try loosening one or more filters:"
    - Suggest specific actions: "Increase fit score tolerance to 50+", "Expand target geography", "Broaden deal-size range"
  - Button: "Adjust criteria" (routes to mandate brief editor) or "Refresh & try again"
- **Impact:** Prevents accidental shortlist confirmation on empty result

### Thin Matches (< 5 buyers)
- **Trigger:** Matching returns small result set
- **Content:**
  - Warning banner: "Few matching buyers found (3 candidates). You may want to review your criteria or extend your market search."
  - Suggestion: "View similar buyers by relaxing one filter" (dropdown)
  - Allow proceed but with confirmation: "Continue with 3-buyer shortlist?" before lock

### Stale Data Warning
- **Trigger:** Matching data >14 days old (no recent refreshes)
- **Content:**
  - Amber info banner at top: "This ranking is based on data from [date]. Refresh for latest buyer activity."
  - "Refresh matches" button highlighted
  - Timestamp in header links to info: "Data refreshed [date]; [count] recent changes in buyer activity"

### Network / Server Error
- **Trigger:** API call fails
- **Content:**
  - Error message: "Unable to load matches. Please try again." (generic, non-technical)
  - Retry button
  - If persists: "Contact support" link + error code (for support team only, e.g., in browser console)
  - Page in degraded state: shortlist panel still visible if previously loaded; advise to save work

### Permission Denied
- **Trigger:** User lacks mandate read permission
- **Content:**
  - Error message: "You don't have access to this mandate. Contact your engagement manager for permissions."
  - Option to return to mandates list

---

## Responsive Breakpoints

### Desktop (≥1024px)
- **Layout:** Ranked list (left, 60–70% width) + shortlist panel (right sidebar, 30–40%, sticky)
- **List:** Table view with all columns visible; 20 rows per view with lazy-load
- **Rationale drawer:** Right-side modal (full height, 40% width)
- **Interactions:** Hover states on buyer rows (subtle highlight); icon buttons visible

### Tablet (768–1023px)
- **Layout:** Full-width ranked list; shortlist panel toggles as bottom sheet (dismiss/expand)
- **List:** Card view (one per row, horizontal scroll disabled)
- **Rationale drawer:** Full-width modal, center-positioned
- **Interactions:** Tap targets enlarged; swipe to dismiss rationale drawer

### Mobile (< 768px)
- **Layout:** Single-column stack; ranked list full-width; shortlist as persistent bottom sheet
- **List:** Card view, stacked; fit score + buyer name + quick-action buttons only; rationale badge tappable
- **Rationale drawer:** Full-screen modal (bottom-up slide-in); close button prominent
- **Shortlist panel:** Bottom sheet, max height 40% viewport; swipe down to minimize
- **Filters:** Collapsed under "Filter" button; opens modal
- **Sorting:** Dropdown menu, tappable
- **Page header:** Sticky, abbreviated (mandate name + refresh button)

---

## Success Metrics

### Primary (Outcome)
1. **Shortlist completion rate:** % of advisors who lock shortlist after viewing matches (target: 85%+)
2. **Average shortlist size:** target 8–12 buyers per mandate (informed by compliance team's outreach capacity)
3. **Advisor confidence in AI ranking:** post-session survey: "How confident are you in the buyer ranking?" (NPS-style, target: 8+/10)
4. **Time to shortlist:** median session duration from matches-page load to confirmation (target: <8 minutes for straightforward mandates)

### Secondary (Engagement)
5. **Rationale drawer open rate:** % of sessions where advisor opens ≥1 rationale drawer (target: 75%+; high rate validates explainability value)
6. **Refresh rate:** % of sessions where advisor refreshes matches >1 time (target: <25%; too-high refresh may signal uncertainty)
7. **Rejection rate:** % of buyers in initial ranked list that advisor rejects (target: 10–30%; too-high may signal poor ranking)
8. **Filter/sort interactions:** avg # of filter changes per session (track whether advisors find default ranking sufficient or require heavy customization)

### Tertiary (Quality)
9. **Post-shortlist buyer contact success rate:** % of shortlisted buyers who respond to outreach or proceed past first contact (tracked in C-block outreach module; target: 40%+)
10. **Buyer duplicate detection:** % of shortlists containing overlapping buyer profiles (should be 0% if matching engine deduplicates correctly)
11. **Compliance flag rate:** % of shortlist confirmations that trigger compliance checks (target: <5% for well-curated matching)

### Technical
12. **Page load time:** P75 <2s on desktop, <3s on mobile (metrics: API response time + rendering)
13. **Rationale drawer open latency:** P50 <500ms (drawer must feel instant when tapping)
14. **Refresh matches latency:** P50 <5s (re-ranking should be quick enough to not feel blocked)

---

## Competitor Comparison

### Cyndx (Buyer Intelligence Platform)
- **Cyndx approach:** Filter-driven buyer search (geography, industry, deal size); advisors manually cross-reference buyer profiles & historical deals; no explicit AI ranking
- **DealFlow AI edge:**
  - AI-ranked list (single-mandate fit score, transparent rationale)
  - Mandate-aware matching (tie scoring to specific deal parameters, not just buyer profiles)
  - Explainability focus (rationale drawer with evidence; Cyndx requires manual interpretation)
  - Outreach integration (shortlist feeds directly into compliant outreach; Cyndx is discovery-only)

### Grata (Buy-Side AI Acquisition Scoring)
- **Grata approach:** AI-scores targets for acquirers (buy-side); heavy on acquisition profile matching; no sell-side shortlist workflow
- **DealFlow AI edge:**
  - Sell-side focus (matches buyers to a specific mandate, not vice versa)
  - Shortlist-to-outreach workflow (seamless handoff to compliance-aware outreach; Grata stops at scoring)
  - Transparent rationale (Grata's scores are often black-box; DealFlow explains *why* a buyer ranks high)
  - Advisor-owned confirmation (advisor locks shortlist before outreach, not system auto-selection)

### Custom Advisory Workflows (No AI)
- **Manual approach:** Advisors build shortlists from experience, industry networks, proprietary databases; no algorithmic ranking
- **DealFlow AI edge:**
  - Speed (matches in minutes, not weeks of manual sourcing)
  - Comprehensiveness (AI scans entire buyer universe, not just known contacts)
  - Consistency (same mandate criteria applied uniformly across all candidates)
  - Auditability (rationale is recorded; useful for post-deal review & model improvement)

---

## Accessibility & Usability Notes
- **Screen reader compatibility:** Table/card content properly marked up; alt text on fit score badges ("75% fit: Strategic alignment with platform acquisitions")
- **Keyboard navigation:** Full tab order through list, buttons, and drawer; escape key closes modals
- **Color contrast:** Fit score bars use accessible color palette (green/yellow/red with distinct saturation); no color-only differentiation
- **Motion:** All transitions (drawer slide, list reorder) have `prefers-reduced-motion` fallback (instant, no animation)
- **Focus indicators:** Visible focus ring on all interactive elements
- **Touch-friendly:** Button/icon targets ≥44px on mobile; no hover-only actions

---

## Design System References
- **Component library:** Matches list (table variant or card grid), modal drawer, badge (fit score, status), button (primary, secondary, icon), filter chip, badge, skeleton loader
- **Color palette:** Primary (brand blue), success (green for accepted), warning (amber for flagged), neutral (gray for rejected)
- **Typography:** Heading 3 for buyer name, body for rationale, caption for metadata (timestamps, secondary info)
- **Icons:** Checkmark (accept), flag (investigate), X (reject), eye/chevron (expand), refresh (reload)


---
**Approved design (v9):** `design/matches-shortlist.html`
