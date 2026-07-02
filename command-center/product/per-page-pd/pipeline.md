# Pipeline Page — DealFlow AI

## Purpose
The Pipeline page is the nerve center for deal momentum. It provides Advisors and Deal Leads with a unified cross-mandate view of buyer prospects moving through M&A deal stages, coupled with real-time outreach engagement signals (sent/opened/clicked/replied/bounced). The page surfaces the compliance-checked outreach track record for each buyer, enabling advisors to triage inbound replies, advance deal stages based on engagement, and maintain a audit trail of next actions—all within the regulated framework of an M&A advisory workflow.

**Core value:** Turn outreach engagement data into deal velocity without breaking compliance rules.

---

## Audience
- **Primary:** Advisors (deal leads managing client mandates), Deal Leads (triage + stage movement)
- **Secondary:** Compliance Officers (audit view of outreach + replies)
- **Access gating:** Authenticated users only; role-gated visibility by mandate (advisor sees their own mandates + assigned deals; compliance sees all). Profile-based compliance clearance checked on page load.

---

## Entry Points
1. **Dashboard card or global nav link** → `/pipeline`
2. **From a Deal Profile** (e.g., `/deals/:dealId`) → Pipeline context-slice for that deal
3. **From Mandates list** → Tap a mandate to filter pipeline to that mandate's buyers
4. **Direct URL** → `GET /pipeline?mandate_id=xyz&stage=diligence` (optional filtering)

---

## Content Sections

### 1. Mandate Selector & Summary
- **Dropdown / pills** listing active mandates assigned to the logged-in user (auto-pre-selected if only one)
- **Summary stats** (for selected mandate):
  - Total buyers in pipeline
  - Count by stage (Contacted | Interested | NDA | Diligence | Closed)
  - Avg. response rate for this mandate's outreach
  - Days since last outreach batch

### 2. Buyer Pipeline — Kanban or List View
**Kanban layout (preferred for visual stage flow):**
- **Columns:** one per deal stage (Contacted → Interested → NDA → Diligence → Closed / Won)
- **Cards per buyer:**
  - **Buyer name** + **company** (linked to buyer detail)
  - **Outreach status badge** (details below)
  - **Last outreach date** + **days elapsed**
  - **Reply preview** (truncated, if any reply received)
  - **Engagement signal** (opened/clicked if tracked; low-confidence label if signal is uncertain)
  - **Advisor note snippet** (1 line; expand on interaction)
  - **Manual stage label** (e.g., "awaiting NDA signature")

**List layout (alternative for dense tables):**
- **Columns:** Buyer | Company | Current Stage | Outreach Status | Last Action | Days in Stage | Next Action | Signals
- **Sortable** by last action, days in stage, engagement
- **Expandable rows** for notes + reply text

### 3. Outreach Status Badges
Each buyer card shows a pill or icon indicating outreach engagement:
- **Sent** (gray): message in outbound queue or just sent
- **Opened** (blue): recipient opened the email (if tracking enabled)
- **Clicked** (teal): link clicked in email
- **Replied** (green): inbound reply received; count of replies shown (1, 2, 3+)
- **Bounced** (red): email delivery failed
- **No outreach yet** (light gray): buyer in pipeline but no compliant outreach sent
- **Low-confidence signal** (dashed border on badge): engagement signal uncertain (e.g., open happened outside normal business hours, may not indicate genuine interest)

### 4. Filtering & Search
- **Mandate filter** (dropdown; described above)
- **Stage filter** (multi-select; shows only buyers in selected stages)
- **Engagement filter** (e.g., "Show only replied", "Show unopened", "Show bounced")
- **Search by buyer name or company** (inline; filters cards/rows in real-time)
- **Date range filter** (e.g., "Contacted in last 7 days")
- **Saved filters** (optional; advisor can bookmark filter combos)

### 5. Quick Actions (per buyer card/row)
- **Advance Stage** (arrow icon or button) → modal/popover:
  - Select target stage
  - Required: reason for advance + date (pre-filled as today)
  - Optional: internal note (compliance-logged)
  - On submit: stage updated in DB; audit entry created
- **Triage Reply** (envelope icon if reply exists) → modal:
  - Show full reply text + sender email
  - Advisor options: "Mark interested", "Request NDA", "Schedule call", "Defer", "Not a fit"
  - Creates next-action record + updates stage suggestion
  - Logs reply handling in audit trail
- **Add Note** (note icon) → inline textarea or modal:
  - Free-form note, visible to mandate team + compliance
  - Auto-logs timestamp + editor
- **View Outreach History** (link/icon) → slide-out panel:
  - Timeline of all outreach to this buyer (messages sent, bounces, opens/clicks, replies)
  - Compliance-stamp on each event

---

## Data Requirements

### Placeholder Endpoints
```
GET /api/v1/mandates
  → { mandates: [ { id, name, buyer_count, active }, ... ] }

GET /api/v1/mandates/{mandateId}/pipeline
  → { 
      mandate: { id, name, stats: { total, by_stage } },
      buyers: [
        {
          id, name, company,
          current_stage, days_in_stage,
          last_outreach_date, outreach_status,
          engagement_signal, signal_confidence,
          reply_count, latest_reply_preview,
          latest_note
        }, ...
      ]
    }

POST /api/v1/buyers/{buyerId}/stage-advance
  Body: { target_stage, reason, date, note }
  → { buyer: { id, current_stage, ... }, audit_log_id }

POST /api/v1/buyers/{buyerId}/reply-triage
  Body: { action: "interested"|"request_nda"|"schedule_call"|"defer"|"not_fit", note }
  → { buyer: { id, ... }, next_action: {...} }

POST /api/v1/buyers/{buyerId}/notes
  Body: { text, visibility: "team"|"compliance" }
  → { note: { id, created_at, ... } }

GET /api/v1/buyers/{buyerId}/outreach-history
  → { events: [ { type: "sent"|"opened"|"clicked"|"replied"|"bounced", timestamp, data }, ... ] }
```

---

## Interactions

### Advance Stage
1. Advisor clicks "Advance Stage" on a buyer card
2. Modal appears: dropdown list of valid next stages (derived from deal stage machine)
3. Advisor selects stage + enters reason ("NDA signed", "Demo scheduled", etc.)
4. Optional: notes field
5. On submit: API call; card moves to new column (Kanban) or row refreshes (List); audit logged; compliance notified if stage triggers compliance action (e.g., NDA-to-Diligence → flag for legal review)

### Triage Reply
1. Advisor sees "Replied (1)" badge on buyer card
2. Clicks to open reply triage modal
3. Modal shows: sender email, full reply text, timestamp
4. Advisor chooses action: "Interested" (auto-suggest move to Interested), "Request NDA" (create task), "Schedule Call" (create event + task), "Defer" (set snooze + reason), "Not a fit" (remove from pipeline, log reason)
5. On submit: buyer updated, next-action created, advisor notified of follow-up task

### Add Note
1. Advisor clicks note icon on buyer card
2. Inline text area appears (or modal opens)
3. Advisor types note (e.g., "Called—interested in secondary round, prefers Q3 close")
4. On save: note appended to buyer record, timestamped, logged for audit

### Filter & Search
1. Advisor selects mandate from dropdown → Kanban/list re-renders to show only that mandate's buyers
2. Advisor multi-selects stage filter (e.g., "Contacted" + "Interested") → Kanban hides other columns or list filters rows
3. Advisor enters search term → live filter on buyer name/company across all visible buyers
4. Advisor toggles "Replied" engagement filter → shows only buyers with inbound replies
5. Results update in <200ms (client-side for name/stage; server-side for complex filters)

---

## Content & State Management

### Empty States
- **No mandate selected:** "Select a mandate to view pipeline" (with mandate dropdown highlighted)
- **No buyers in selected filters:** "No buyers match your filters. Try adjusting stage, engagement, or date range."
- **No outreach sent yet:** Buyer card shows "No outreach yet" + action button "Send intro" (links to outreach editor)

### Loading States
- **Mandate data loading:** skeleton placeholders for stage columns; spinner in header
- **Pipeline data loading:** kanban columns appear empty with shimmer placeholders until buyers load

### Error States
- **API error:** "Unable to load pipeline. Please refresh or contact support."
- **Compliance block:** "You don't have permission to view this mandate." (if role/profile check fails)
- **Outreach service unavailable:** Outreach status badges show "?" with tooltip "Outreach data unavailable; refresh to try again."

### Low-Confidence Signals
- **Scenario:** Open event recorded but no SMTP provider timestamp or outside typical business hours
- **Display:** Engagement badge (e.g., "Opened") has **dashed border** + **info icon**
- **Hover tooltip:** "Low confidence: open signal may not reflect genuine engagement."
- **Advisor action:** Can override signal as "false positive" in reply-triage modal (logs override reason for compliance review)

---

## Responsive Breakpoints

| Breakpoint | Layout | Adjustments |
|---|---|---|
| **Desktop (≥1200px)** | Kanban (multi-column) | Full stage visibility; side panel for notes/history |
| **Tablet (768–1199px)** | Kanban (2–3 visible columns) + scroll | Swipe between columns; side panel compact |
| **Mobile (<768px)** | List view (cards in single column) | Swipeable stage selector at top; quick-action menu (three-dot) per row; modal for details |

---

## Success Metrics

1. **Pipeline velocity:** Avg. days per stage (target: <14 days from Contacted → NDA)
2. **Reply engagement rate:** % of outreach replies to sent messages (target: >15% for compliant outreach; segment by buyer quality)
3. **Stage advancement:** # of buyers advanced per week per advisor (track for workload balance)
4. **Triage accuracy:** % of triage actions that result in next milestone hit (scheduled call → attended, NDA request → signed)
5. **Compliance audit trail:** 100% of stage advances + notes logged with timestamp + editor (non-repudiation)
6. **False-positive rate:** % of low-confidence signals that advisor marks as "not genuine interest" (tracks outreach engine tuning)
7. **Time to first action:** Avg. time from reply received to advisor triage action (target: <4 hours during business hours)
8. **Cross-mandate deal flow:** % of buyers that cross mandate boundaries or have secondary-opportunity tags (signals lead quality)

---

## Competitive Comparison

| Feature | DealFlow AI | Affinity | DealCloud |
|---|---|---|---|
| **Deal stage kanban** | ✓ | ✓ | ✓ |
| **Outreach engagement tracking** | ✓ (compliance-first; bounces/opens/clicks) | ✓ (limited; email-only) | ✓ (basic) |
| **Compliant reply triage** | ✓ (audit-logged; integrates with outreach rules) | ✗ (generic notes) | ✗ (generic notes) |
| **Mandate-gated visibility** | ✓ (per M&A regulatory req.) | ✗ (account-level sharing) | ~ (limited by role) |
| **False-positive signal flagging** | ✓ (low-confidence tagging + override) | ✗ (raw engagement data) | ✗ (raw engagement data) |
| **Audit trail per action** | ✓ (stage advance, triage, notes logged) | ~ (partial; no triage metadata) | ~ (partial) |
| **Next-action auto-suggestion** | ✓ (from triage choice + engagement) | ✗ (manual task creation) | ~ (basic workflow) |

**Differentiation:** DealFlow AI's pipeline ties **real-time outreach engagement** (opened, clicked, replied, bounced) directly to **stage progression** and **compliance-logged actions**, eliminating the manual CRM busy-work advisors hate. Competitors show engagement but don't integrate it into deal workflow or compliance machinery.


---
**Approved design (v9):** `design/pipeline.html`
