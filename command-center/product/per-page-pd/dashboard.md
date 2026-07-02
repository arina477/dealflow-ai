# Dashboard (/) — Per-Page Product Description

---

## Purpose

The Dashboard is the role-gated home screen that surfaces the user's current work at a glance: active mandates (for Advisors), queued sourcing tasks (for Analysts), pending compliance reviews (for Compliance), and system health (for Admins). It is the single point of entry after login, replacing the need to navigate deep into the app to answer "what's my next action?" — every role sees their priorities first, with drill-down links to detail pages for action. The Dashboard is the system's nervous system: it surfaces the compliance approval queue (the H1 differentiator) alongside outreach and pipeline status, reinforcing that compliance is embedded in the core deal workflow, not bolted on.

---

## Audience

**Primary personas (auth state: authed, role-gated):**
- **Advisor / Deal Lead:** sees mandates, matches count, outreach status, pipeline stage distribution, and any blocked sends awaiting compliance approval. Primary CTA: review matches or work the pipeline.
- **Analyst / Associate:** sees current sourcing tasks, enrichment queue status, data gaps flagged for review, and upcoming mandate assignments. Primary CTA: pick next sourcing target or start universe building.
- **Compliance Reviewer:** sees pending compliance queue (templates and campaigns awaiting review), recent audit log activity, and rule/suppression status. Primary CTA: approve or request changes on queued items.
- **Admin:** sees workspace health (data-source sync status, user count, API health), license/seat usage, and any configuration gaps (unverified domain, missing settings). Primary CTA: fix configuration issues or invite users.

**Secondary:**
- All roles see a minimal "What's new?" banner (outages, feature releases, urgent alerts).
- All roles can quickly navigate to their primary surfaces (mandates, sourcing, compliance queue, settings) via persistent sidebar.

---

## Entry Points

- **Primary:** Direct navigation after successful login (OAuth or email/password). Route: `/`.
- **Secondary:** 
  - Sidebar navigation (persistent, visible from all pages): Dashboard link always available.
  - Email alert / in-app notification link: "Return to dashboard" CTA.
  - Shortcut key (optional, H2): `Cmd+H` (home).

**Auth requirement:** Fully authenticated, valid session token required; `401 Unauthorized` redirects to login. Redirect back to dashboard post-login via session state.

---

## Content Sections

All sections use consistent empty / loading / error states (see below). Layouts are responsive; mobile stacks vertically; tablet shows 2-column grid; desktop shows 3–4 columns.

### 1. Header / user context (global, all roles)
- **Logged-in user name** (first + last, or email fallback)
- **Current firm/workspace** (e.g., "Acme M&A Partners"), with workspace selector if multi-workspace is enabled (H2)
- **Breadcrumb / page title:** "Dashboard"
- **Quick search** (global): search mandates by name, buyer by company, outreach by recipient, or audit log by date range. Debounced, displays top 5 recent results + "View all" link per entity type.
- **Settings / admin link** (top-right): user dropdown → "Profile" / "Settings" / "Logout"
- **Notification bell** (top-right): opens slide-over with unread alerts (compliance blocks, replies, sync errors, audit anomalies); mark read.

### 2. Role-specific hero section (all roles)

**Advisor / Deal Lead:**
- **Active mandates count** (big number, e.g., "3")
- **Subtext:** "3 mandates in active sourcing / matching / outreach"
- **CTA buttons:** 
  - "New mandate" → F1 (create mandate form)
  - "View all mandates" → mandate list page
- **Status distribution chart** (pie or bar): mandates by stage (Sourcing / Matching / In outreach / Closed-won / Closed-lost). Click slice to filter mandate list.

**Analyst / Associate:**
- **Sourcing task count** (e.g., "5 targets to enrich")
- **Subtext:** "Data quality issues: 2 duplicates, 3 missing contacts"
- **CTA buttons:**
  - "Start sourcing" → F6 (sourcing workspace)
  - "Review flagged data" → company/contact review queue
- **Progress bar:** enrichment queue depth (e.g., "12 / 20 records enriched").

**Compliance Reviewer:**
- **Compliance queue count** (prominently red/orange if any): "2 campaigns pending approval"
- **Subtext:** "0 urgent, 1 high-priority, 1 routine"
- **CTA buttons:**
  - "Review compliance queue" → F10 (approval dashboard)
  - "View audit log" → F11 (communication log)
- **Recent activity snapshot:** "Last 3 days: 47 messages sent, 0 integrity checks failed"

**Admin:**
- **Workspace health summary** (3 KPIs):
  - Data-source sync status (e.g., "3/3 sources synced in last 24h")
  - Active users (e.g., "12 users, 3 seats available")
  - Domain verification (e.g., "DKIM/SPF/DMARC ✓" or "⚠ Domain not verified")
- **CTA buttons:**
  - "Configure settings" → F15 (workspace/domain settings)
  - "Manage users" → F14 (user management)
  - "Data sources" → F13 (source integration)

### 3. Shared widget: mandate summary list (Advisor, Analyst, Compliance)

Visible by all roles (each role sees a filtered view).

- **Horizontal scrolling card list** (mobile) or **compact table** (tablet/desktop)
- **Per-mandate card / row shows:**
  - **Mandate name** (e.g., "TechCorp acquisition")
  - **Stage badge** (color-coded: Sourcing / Matching / In outreach / Closed)
  - **Seller profile summary:** target company name + size (e.g., "$150M ARR, West Coast SaaS")
  - **Key metrics (role-dependent):**
    - Advisor: matched buyers count, sent outreach count, replied count, next action
    - Analyst: universe size, enrichment %
    - Compliance: approval status (✓ Approved / ⏳ Pending / ✗ Changes requested)
  - **Contextual CTAs:**
    - Advisor: "Review matches" → F2 | "Work pipeline" → F4
    - Analyst: "Build universe" → F7
    - Compliance: "Review & approve" (if pending) → F10
  - **Last updated timestamp** (e.g., "Updated 2 hours ago")
- **Link each card** to mandate detail page (deep link to `/mandates/{id}`)
- **Show up to 5 most recent; add "View all" link** to full mandate list
- **Sort by:** default = most recent; secondary sort = by stage (Sourcing > Matching > In outreach)

### 4. Widget: outreach & pipeline status (Advisor)

Displays the live pulse of outreach campaigns and deal progression.

- **Sent this week:** count of messages (e.g., "23 sent")
- **Engagement snapshot (sparkline + mini bar):**
  - Sent | Opened (%) | Clicked (%) | Replied (%) | Bounced (%)
  - E.g., "23 sent / 15 opened (65%) / 8 clicked (35%) / 3 replied (13%) / 0 bounced"
- **Pipeline stage waterfall** (bar chart, horizontal):
  - Contacted | Interested | NDA | Diligence | Advanced talks (showing count per stage)
  - Click a bar to filter pipeline list by that stage
- **CTA:** "View full pipeline" → mandate detail → Pipeline tab

### 5. Widget: compliance queue (Compliance, visible to Advisor if approval-gated)

Surfaces the approval bottleneck.

- **Pending review count** (large, red if >0): e.g., "2 awaiting approval"
- **Breakdown (chips):**
  - e.g., "1 template · 1 campaign · 0 urgent"
- **Recent pending item (card):**
  - Item type (template / campaign)
  - Name / subject
  - Submitted by (user name)
  - Submitted date
  - Status badge (Pending / Changes requested)
  - CTA: "Review now" → F10 detail view
- **Link at bottom:** "View full compliance queue" → F10 dashboard

### 6. Widget: data quality summary (Analyst)

Shows enrichment and data-gap health.

- **Enrichment progress:** "451 / 523 records enriched (86%)"
  - Animated progress bar
- **Recent flags (list, max 4):**
  - "12 duplicate company records" — Link: "Review duplicates"
  - "8 contacts missing verified email" — Link: "Enrich now"
  - "3 records out of sync (Affinity)" — Link: "Sync (H2)"
- **CTA:** "View data dashboard" → data quality page

### 7. Widget: system status & alerts (all roles, especially Admin)

Minimal, non-intrusive.

- **Data-source sync health** (all roles): 
  - Last sync time (e.g., "Last updated 4 hours ago")
  - Any source in error state: "⚠ CompaniesDB rate-limited; retrying" with Link: "View details"
- **Security/compliance alerts** (Compliance + Admin):
  - e.g., "Audit log integrity check passed on 2 of 2 recent checks" ✓
  - e.g., "⚠ 1 recordkeeping export pending (due in 5 days)"
- **Feature announcements** (dismissible banner, top of dashboard):
  - e.g., "New: AI-assisted template drafting. Learn more" (Link)

### 8. Footer / secondary nav (all roles)

- **Quick links:** Dashboard / Mandates / Sourcing / Compliance Queue / Settings
- **Help / support:** "?" link → help modal or knowledge base
- **Logout** (also in user dropdown header)

---

## Interactions

### Clickable elements & destinations

| Element | Destination | Side effect | Role gating |
|---------|-------------|------------|------------|
| Mandate card | `/mandates/{id}` (detail page) | Loads mandate detail + tabs (Matches / Pipeline / Outreach / Audit) | All |
| "New mandate" CTA | `/mandates/new` (create form) | Opens F1 form | Advisor |
| "View all mandates" | `/mandates` (list page) | Loads full mandate list; filters available | All (role-filtered view) |
| "Review matches" link | `/mandates/{id}?tab=matches` | F2 flow; jumps to match list for that mandate | Advisor |
| "Work pipeline" link | `/mandates/{id}?tab=pipeline` | F4 flow; jumps to pipeline stage tracking | Advisor |
| "Start sourcing" CTA | `/sourcing` (workspace) | F6 flow; sourcing UI | Analyst |
| "Review flagged data" | `/data/flags` (flag review queue) | Shows duplicates, missing fields, sync issues | Analyst |
| Stage distribution chart (slice click) | `/mandates?filter=stage:{stage}` | Filters mandate list by selected stage | All |
| Compliance queue card | `/compliance-queue/{id}` (detail view) | Opens template or campaign for review; F10 flow | Compliance |
| "Review now" (queue card) | `/compliance-queue/{id}` | Same as above | Compliance |
| "View full compliance queue" | `/compliance-queue` (dashboard) | F10 full dashboard | Compliance |
| Pipeline waterfall (bar click) | `/mandates/{id}?tab=pipeline&filter=stage:{stage}` | Filters pipeline within that mandate by stage | Advisor |
| "View full pipeline" | `/mandates/{id}?tab=pipeline` | As above | Advisor |
| Data quality link (e.g., "Review duplicates") | `/data/duplicates` (dedupe queue) | Shows company records flagged as duplicates | Analyst |
| Quick search field | (live dropdown) → result click | Navigates to result detail (mandate / company / audit log entry) | All |
| Notification bell → alert | Varies (e.g., `/compliance-queue/123` for a compliance block) | Clears unread flag on that alert | All |
| User dropdown → "Settings" | `/settings` (workspace settings) | Admin view (role-gated) | Admin |
| "Configure settings" CTA | `/settings` | Same as above | Admin |
| "Manage users" CTA | `/settings/users` (user management) | F14 flow | Admin |
| "Data sources" CTA | `/settings/integrations` (data-source management) | F13 flow | Admin |
| Workspace selector | (dropdown) → workspace pick | Switches workspace (H2); reloads dashboard for new workspace | All |
| Help link (?) | Help modal / external KB link | Opens modal or new tab | All |

### Non-clickable UI patterns

- **Progress bars** (enrichment, sync health): visual feedback only; no interaction.
- **Badge status** (stage, approval status): visual only; color-coded for quick scan.
- **Chart slices** (mandate stage distribution, pipeline waterfall): click-able; show hover state + cursor: pointer.
- **Toast notifications** (top-right): auto-dismiss after 5s, or dismiss button. E.g., "Campaign sent: 23 messages. View pipeline →" (link).

---

## Data Requirements

### API endpoints (placeholder names; v6 architecture reconciles)

All endpoints require:
- Request header: `Authorization: Bearer {token}`
- Request header: `X-Workspace-ID: {workspace_id}` (implicit from session if single-workspace)

**Core dashboard queries (GET):**

1. **`GET /api/v1/dashboard/summary`** — Current user's role-gated dashboard state (hero + widget counts).
   - Response: `{ user_role, mandate_count, active_mandate_count, sourcing_tasks_pending, compliance_queue_count, data_flags_count, workspace_name, last_sync_time, domain_verified }`
   - Used by: all roles (response shape varies by role via `user_role` field)

2. **`GET /api/v1/mandates?limit=5&sort=updated_desc`** — Most recent 5 mandates for card list.
   - Response: `[ { id, name, seller_profile_summary, stage, buyer_count, sent_count, replied_count, updated_at, compliance_status } ]`
   - Used by: Advisor, Analyst (filtered by assigned mandate), Compliance (all)

3. **`GET /api/v1/mandates/{id}/matches/count`** — Total matched buyers for a mandate.
   - Response: `{ mandate_id, match_count, accepted_count }`
   - Used by: Mandate card (Advisor)

4. **`GET /api/v1/outreach/stats?date_range=week`** — Outreach engagement stats for the past week.
   - Response: `{ sent_count, opened_count, clicked_count, replied_count, bounced_count, opened_pct, clicked_pct, replied_pct }`
   - Used by: Engagement widget (Advisor)

5. **`GET /api/v1/pipeline/stages?mandate_id={id}`** — Pipeline stage distribution for a mandate.
   - Response: `[ { stage_name, buyer_count }, ... ]` (ordered: Contacted > Interested > NDA > Diligence > Advanced)
   - Used by: Pipeline waterfall chart (Advisor)

6. **`GET /api/v1/compliance-queue`** — Pending template & campaign reviews.
   - Response: `[ { id, item_type ('template'|'campaign'), name, submitted_by, submitted_at, status ('pending'|'changes_requested'), priority } ]`
   - Limit: 5 (for widget); full list at `/compliance-queue` page
   - Used by: Compliance queue widget (Compliance)

7. **`GET /api/v1/data/flags?type=dedupe|missing_contact|sync_error&limit=4`** — Recent data-quality flags.
   - Response: `[ { id, flag_type, description, record_count, created_at } ]`
   - Used by: Data quality widget (Analyst)

8. **`GET /api/v1/workspace/health`** — Sync status, user count, domain verification.
   - Response: `{ last_sync_time, source_sync_status: [ { name, status, last_sync } ], active_user_count, seat_limit, domain_verified, dkim_valid, spf_valid, dmarc_valid }`
   - Used by: Admin hero section; system status widget (all)

9. **`GET /api/v1/notifications?limit=10&unread=true`** — User's recent unread alerts.
   - Response: `[ { id, type ('compliance_block'|'reply'|'sync_error'|'audit_anomaly'|'feature'), message, entity_link, created_at, read } ]`
   - Used by: Notification bell dropdown (all)

10. **`GET /api/v1/audit-log/recent?limit=5`** — Recent audit-log entries (Compliance row).
    - Response: `[ { timestamp, action, actor, entity, status } ]`
    - Used by: Compliance recent activity (Compliance)

**Secondary endpoints (invoked on action):**

- **`PATCH /api/v1/notifications/{id}/read`** — Mark notification as read.
- **`GET /api/v1/search/global?q={query}`** — Global search (mandates, companies, contacts, audit entries).

### Data freshness & caching

- Dashboard summary data: **5-second client-side cache** (re-fetch on focus, or manual "Refresh" button)
- Mandate list & widget counts: **cached 2 minutes** or refresh on action (new mandate, send outreach)
- Audit log (Compliance): **10-second cache** (near real-time, given compliance sensitivity)
- System status (sync health): **30-second cache** (background polling)

---

## Empty / Error / Loading States

### Empty state (no mandates, no outreach, etc.)

**Advisor (first login):**
```
┌─────────────────────┐
│  Active Mandates    │
│  (0 found)          │
│                     │
│  Get started:       │
│  [Create mandate]   │
│                     │
│  → Learn about F1   │
└─────────────────────┘
```
- Message: "No active mandates yet. Create one to get started with deal sourcing and buyer matching."
- CTA: "Create mandate" button

**Analyst (first login):**
```
┌─────────────────────┐
│ Sourcing Queue      │
│ (empty)             │
│                     │
│ Waiting for your    │
│ first mandate...    │
│                     │
│ [← Check mandates]  │
└─────────────────────┘
```

**Compliance (no pending reviews):**
```
┌─────────────────────┐
│ Compliance Queue    │
│ (0 pending)         │
│                     │
│ All clear! ✓        │
│ No items awaiting   │
│ approval.           │
└─────────────────────┘
```

### Loading state (fetching dashboard data)

- **Skeleton loaders** for each widget: grey placeholder bars (4 lines for mandate list, chart placeholder for waterfall, etc.)
- **Spinner** in top-right (next to notifications); visible for <2 seconds typically
- **Text:** "Loading dashboard..." (optional, only if load time exceeds 1s)

### Error state (API failure)

**Transient error** (network glitch, retry-able):
```
┌──────────────────────────────┐
│ ⚠ Loading dashboard failed   │
│                              │
│ We had trouble connecting.   │
│ [Retry] [Home]               │
└──────────────────────────────┘
```

**Persistent error** (auth failure, user not in workspace, etc.):
```
┌──────────────────────────────────┐
│ ✗ Dashboard unavailable          │
│                                  │
│ You may not have access to this  │
│ workspace, or your session       │
│ expired.                         │
│ [Log out] [Contact support]      │
└──────────────────────────────────┘
```

**Single widget error** (e.g., compliance queue fetch fails, but rest of dashboard loads):
```
┌─────────────────────────────┐
│ Compliance Queue            │
│                             │
│ ⚠ Failed to load queue      │
│   [Retry] [View on page]    │
└─────────────────────────────┘
```
- Retry: refetch that widget only; other widgets remain visible.
- "View on page": link to `/compliance-queue` (full page, which may have better error handling).

### Slow-load state (data taking >3s)

- **Skeleton + status message:** "Syncing data from sources..." (if sourcing data is slow)
- **Stale-data flag** (if data older than expected): "Dashboard last updated 2 hours ago. [Force refresh]"

---

## Responsive Breakpoints

### Mobile (< 768px)

- **Layout:** Single column, full-width widgets stacked vertically
- **Hero section:** Condensed (big number, subtext, 1 primary CTA + "More" dropdown for secondary CTAs)
- **Mandate list:** Horizontal-scroll card carousel (one card visible; swipe to see next); click card for detail
- **Charts:** Full-width, simplified (pie chart becomes badge + count; waterfall becomes vertical bar chart)
- **Header:** Sticky, compact (user name, notification bell); logo on left; search hidden (show search icon in header that expands a modal)
- **Sidebar:** Hidden by default; hamburger menu (top-left) expands modal nav overlay

### Tablet (768px – 1024px)

- **Layout:** 2-column grid
  - Left column: hero + mandate list
  - Right column: outreach/pipeline + compliance/data quality widgets
- **Charts:** Medium size, semi-responsive (pie chart visible; waterfall fits)
- **Sidebar:** Collapsible vertical sidebar (narrow icons mode; expand on hover or toggle)
- **Header:** Same as mobile, but search expands inline (not modal)

### Desktop (> 1024px)

- **Layout:** 3–4 column grid
  - Column 1 (left): Sidebar + hero
  - Column 2: Mandate list
  - Column 3: Outreach + pipeline
  - Column 4 (optional, if screen width > 1400px): Compliance + data quality
- **Charts:** Full resolution, interactive hover states
- **Sidebar:** Persistent, expanded (text labels visible)
- **Header:** Fully expanded search + notifications + user menu

---

## Success Metrics

A successful Dashboard implementation:

1. **Load time:** <2s on 4G (p95); <500ms on desktop broadband (p50)
2. **Error rate:** <0.1% of dashboard load attempts fail (transient or persistent)
3. **Time to action:** User can identify their next action within 10 seconds of landing on dashboard
   - Measured via session replay or heatmap: track clicks on primary CTAs (New mandate, Review matches, Compliance queue, etc.) within 10s of page load
4. **Role-specific widget visibility:** Correct role sees correct widgets (no data leakage; Analyst doesn't see compliance queue; Advisor doesn't see admin settings)
5. **Data freshness:** 
   - Advisor sees outreach sent within the past hour reflected in engagement stats within 2 minutes
   - Compliance queue reflects new pending items within 1 minute (via polling + optional websocket push, H2)
6. **User satisfaction:** 
   - NPS on dashboard UX (in-app survey post-first-login): ≥ 7/10
   - "I can quickly find my next action" (Likert scale, in-app survey): ≥ 80% agree
7. **Engagement:**
   - % of users navigating from dashboard to primary flows (F1, F2, F3, F4, F10) within session: ≥ 60% of users
   - Bounce rate (dashboard → logout, no actions): < 15%
8. **Compliance-specific:**
   - Compliance Reviewer sees pending queue count within 30 seconds of login: 100% (no errors)
   - "Compliance queue is visible on my dashboard" (Compliance role, in-app survey): 100% see it; ≥ 80% find it immediately obvious

---

## Competitor Comparison

### DealCloud Dashboard

**DealCloud's approach:**
- Relationship-centric: primary widgets are recent activities (meetings, calls, emails), contact-list summaries, and deal/opportunity pipeline
- Secondary: workspace settings, user activity feed
- Compliance-related data (audit log, approval queues) is tucked in a separate "Compliance" menu section, not surfaced on the home screen

**DealFlow AI's differentiator:**
- **Compliance-first integration:** The compliance queue is a **primary widget** (same visual weight as pipeline), not a secondary menu. This reinforces that compliance is part of the core workflow, not an afterthought. Compliance Reviewer's role is centered on the dashboard, not peripheral.
- **Role-aware hero section:** Each role (Advisor, Analyst, Compliance, Admin) sees a tailored hero + relevant task count, not a generic recent-activity feed. This reduces cognitive load and clarifies roles within the team.
- **Outreach + audit-log on one screen:** Advisor sees "sent/opened/replied" engagement alongside "compliance blocks on this campaign", bridging the gap between business and compliance concerns. DealCloud separates these.
- **Data quality surfacing:** Analyst's enrichment progress + flagged records are on the home screen, not buried in a separate data-mgmt page. This makes it the team's shared responsibility, not a hidden problem.

### Affinity Lens

**Affinity's approach:**
- Very relationship-focused (who you know, recent interactions, deal map, network view)
- Deal stage tracking secondary to relationship browsing
- No explicit compliance features (Affinity operates in lower-regulation verticals)

**DealFlow AI's differentiator:**
- **Compliance workflow integration:** Affinity's dashboard is deal + relationship agnostic. DealFlow AI's dashboard is deal + compliance coupled. For M&A advisory, this is table stakes.
- **Mandate-centric (not relationship-centric):** DealFlow AI surfaces mandates (sell-side engagement bundles with buyer criteria + compliance profile) as the primary unit, not individual relationships. This is a structural difference that maps to M&A workflows.
- **Outreach compliance approval queue:** Affinity doesn't have a built-in compliance approval workflow. DealFlow AI's dashboard surfaces this because it's part of the H1 MVP.

### Cyndx / Grata (Deal-sourcing platforms)

**Cyndx/Grata's approach:**
- Sourcing dashboard (targets, intent signals, company data)
- Limited outreach (they're primarily sourcing tools)
- No compliance controls built-in (buyers source; they don't send outreach)

**DealFlow AI's differentiator:**
- **End-to-end workflow:** Cyndx/Grata stop at "source targets". DealFlow AI continues through matching, outreach, and compliance into pipeline management. The dashboard reflects this continuity.
- **Compliance audit trail:** DealFlow AI's dashboard surfaces the audit log and compliance queue. Cyndx/Grata don't (different use case).

---

## Design & Content Decisions

- **Typography:** Role-specific CTAs use clear, short verbs (e.g., "Review matches", "Start sourcing", "Review now"). No ambiguous calls like "Manage" or "Configure" unless it's an admin action.
- **Color coding:** 
  - Stage badges follow a consistent palette (Sourcing = blue, Matching = purple, In outreach = green, Closed = grey)
  - Compliance queue: red badge if any pending (high visual priority)
  - Data quality flags: orange (warning)
- **Whitespace:** Widgets are separated by at least 16px vertical gap; modal/drawer CTAs are right-aligned (mobile) or centered (desktop).
- **Accessibility:**
  - All interactive elements are keyboard-navigable (Tab order: top-to-bottom, left-to-right)
  - Color is never the only indicator (icons + text labels always accompany colored badges)
  - Loading skeletons have `aria-busy="true"` for screen readers
  - "Refresh" button is labeled clearly; no ambiguous spinner-only affordance


---
**Approved design (v9):** `design/dashboard.html`
