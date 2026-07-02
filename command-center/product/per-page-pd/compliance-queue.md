# Per-Page PD: Compliance Queue (`/compliance/queue`)

## Purpose

The Compliance Queue is the mandatory approval gateway for all outreach campaigns and templates before they reach targets. Every template, disclaimer, claim, and suppression rule is reviewed and logged. This page embodies DealFlow AI's compliance-first differentiator—no other M&A platform gates outreach at pre-send review. Only after explicit approval can advisors deploy campaigns.

**Core value:** Eliminates regulatory drift in outreach; creates auditable proof of review for every campaign sent; reduces legal risk for the advisory firm.

---

## Audience

**Primary persona:** Compliance Reviewer (in-house legal/compliance officer or designated partner)
- Auth: Requires `role: compliance_reviewer` token
- Permissions: View pending queue, open review detail, approve/reject/request-changes, prioritize
- Scope: All templates and campaigns across all advisors

**Secondary persona:** Advisor (sees status only)
- Auth: Requires `role: advisor` token
- Permissions: View status of own submissions (approved/rejected/in-review), receive rejection notes
- Scope: Own templates/campaigns only

---

## Entry Points

1. **Dashboard navigation:** Sidebar menu → "Compliance" → "Queue"
2. **Workflow callback:** Advisor submits template/campaign → system redirects to queue (reviewer view) or "awaiting review" status card (advisor view)
3. **Direct URL:** `/compliance/queue?tab=pending` (filters by pending status)
4. **Email notification:** Compliance reviewer receives digest email of new submissions (batch once daily or per-threshold trigger)

---

## Content Sections

### 1. Header & Filter Bar
- **Title:** "Compliance Queue"
- **Status summary line:** "{X} pending · {Y} approved today · {Z} rejected (7d)" (live counter)
- **Filter & sort controls:**
  - Status dropdown: All / Pending / In Review / Approved / Rejected
  - Priority toggle: All / Urgent (due within 24h)
  - Advisor filter: All advisors / [Advisor name dropdown]
  - Date range: Last 7 days / Last 30 / All time
  - Search: Campaign name / template ID / advisor name
- **Sort options:** Newest first / Oldest first / Highest priority / Due date (ascending)

### 2. Pending Queue Table
Displays all pending submissions in a sortable, filterable table.

**Columns:**
- **Priority flag:** Visual indicator (red "Urgent" badge for >24h old or marked urgent by advisor)
- **Submission type:** "Template" or "Campaign"
- **Name:** Campaign/template name (clickable → open review detail)
- **Submitted by:** Advisor name + avatar
- **Submitted date:** ISO date + relative time ("2 days ago")
- **Risk level:** Auto-calculated badge (Low / Medium / High) based on:
  - Count of unique claims
  - Jurisdiction count
  - Presence of financial claims or performance benchmarks
  - Suppression rule violations flagged by engine
- **Compliance rule hits:** Count badge (e.g., "3 rule flags") — click to expand inline preview
- **Status:** "Awaiting Review" (default)
- **Actions menu:** "Review" button (primary CTA, opens side panel)

**Empty state:**
- Illustration: Empty inbox icon
- Message: "All clear! No pending reviews. New submissions will appear here."
- Secondary action: Link to "Approved templates" for reference

### 3. Review Detail Panel (Side Panel / Modal)
Opens when reviewer clicks "Review" on a queue item. Shows full template/campaign + all compliance checks.

**Header:**
- Submission title + type badge ("Template" / "Campaign")
- Close button (X)
- Submitted by [Advisor] · [Date] · Risk level badge

**Tabbed sections:**

#### Tab: Content
- **Full template/campaign text** (read-only, syntax-highlighted if HTML)
- **Metadata sidebar:**
  - Jurisdiction(s): [Select dropdown list]
  - Compliance rules version: [e.g., "v2.4 Q2 2026"]
  - Related templates: [Link(s) if applicable]

#### Tab: Compliance Checks
Runs real-time compliance engine checks (reads Feature #12: rules engine). Displays pass/fail results:

- **Disclaimer presence:** ✓ Pass / ✗ Fail
  - If fail: Show recommended disclaimer text (templated per jurisdiction)
  
- **Claims validation:** ✓ Pass / ✗ Fail
  - Lists all detected claims (e.g., "Expected returns exceed 15%", "Deal success rate 80%")
  - Flags: unsubstantiated / high-value / jurisdiction-restricted
  - Recommendation: Proof required / Toned / Removed

- **Suppression rules:** ✓ Pass / ✗ Fail
  - Lists contacts flagged by suppression engine (prior opt-outs, known litigants, competitors)
  - Count + preview

- **Jurisdiction compliance:** ✓ Pass / ✗ Fail
  - Maps submission to declared jurisdiction(s)
  - Flags any jurisdiction-specific rule violations

- **Financial claim substantiation:** ✓ Pass / ✗ Fail
  - All performance claims must link to underlying deal data
  - Shows attached data source or flags as missing

#### Tab: Audit Trail
- List of all prior reviews/decisions on this template (if resubmitted)
- Previous rejection notes (if applicable)
- Previous approver + date + notes

### 4. Decision Panel
Positioned at bottom of review panel or as sticky footer. Reviewer makes final decision.

**Options (mutually exclusive radio group):**

1. **Approve**
   - Text: "Approve for deployment"
   - Action: Template/campaign moves to "Approved" status; advisor gets green notification; audit log entry written (Feature #10)
   - Optional notes field: Free-text comments (e.g., "Approved as-is, 3 claims substantiated")

2. **Request Changes**
   - Text: "Request changes from advisor"
   - Action: Opens text area for detailed feedback
   - Placeholder: "e.g., Remove unsubstantiated claim, add disclaimer per CA Rule X, suppress 12 flagged contacts"
   - Auto-email: Advisor receives notification with change summary
   - Status: Template moves to "In Review – Changes Requested"
   - Advisor can resubmit; does not reset queue priority

3. **Reject**
   - Text: "Reject submission"
   - Action: Opens text area for mandatory feedback
   - Placeholder: "e.g., Claims fail substantiation test, not compliant with applicable jurisdiction"
   - Auto-email: Advisor receives rejection with reasons
   - Status: Template moves to "Rejected"
   - Advisor must resubmit from scratch (no auto-carry-forward)

**All options:**
- Primary submit button: "Confirm [Decision]"
- Cancel button: Return to queue without saving

---

## Interactions

### Workflow: Approve
1. Reviewer opens queue item → review detail opens
2. Reviewer scans compliance checks (all tabs)
3. Reviewer selects "Approve" → optional notes
4. Reviewer clicks "Confirm Approve"
5. **System actions:**
   - Template/campaign status → "Approved"
   - Audit log entry written: `{ reviewer_id, template_id, decision: 'approve', timestamp, notes }`
   - Advisor notified: Email + in-app notification (green banner: "Your [Template Name] was approved")
   - Queue item removed from "Pending" list, moves to "Approved" filter view
   - Advisor can now deploy template in campaign builder

### Workflow: Request Changes
1. Reviewer selects "Request Changes" → feedback text area
2. Reviewer types specific change instructions
3. Reviewer clicks "Confirm Request Changes"
4. **System actions:**
   - Template/campaign status → "In Review – Changes Requested"
   - Audit log entry written: `{ reviewer_id, template_id, decision: 'request_changes', timestamp, notes }`
   - Advisor notified: Email + in-app notification + side-by-side diff view (original vs. requested changes)
   - Queue item remains in "Pending" list, flagged with "Awaiting Advisor Revision"
   - Advisor revises and resubmits
   - Re-submission re-triggers compliance checks; goes back to queue (no auto-approval)

### Workflow: Reject
1. Reviewer selects "Reject" → mandatory feedback text area
2. Reviewer provides rejection reason
3. Reviewer clicks "Confirm Reject"
4. **System actions:**
   - Template/campaign status → "Rejected"
   - Audit log entry written: `{ reviewer_id, template_id, decision: 'reject', timestamp, notes }`
   - Advisor notified: Email + in-app notification (red banner: "Your [Template Name] was rejected")
   - Queue item removed from pending, archived to "Rejected" filter
   - Advisor must create new submission (cannot copy rejected template)

### Priority/Urgency Interaction
- Reviewer can flag queue item as "Urgent" (manual toggle) → moves to top of list, adds "Urgent" badge
- System auto-flags items >24h old as urgent (red "Urgent" badge)
- Keyboard shortcut (optional): `u` key to toggle urgent on focused row

### Bulk Actions (Optional Phase 2)
- Checkbox column on queue table
- Bulk approve/reject (if compliance rules identical across subset)
- Bulk download (compliance report / audit trail export)

---

## Data Requirements

### Endpoints (Placeholder)

**GET /api/compliance/queue**
```
query params:
  status: 'pending' | 'in_review' | 'approved' | 'rejected' (default: pending)
  priority: 'urgent' | 'all' (default: all)
  advisor_id: [UUID] (optional)
  sort: 'newest' | 'oldest' | 'priority' | 'due_date' (default: newest)
  limit: 50, offset: 0 (pagination)

response:
  {
    items: [
      {
        id: UUID,
        type: 'template' | 'campaign',
        name: string,
        advisor_id: UUID,
        advisor_name: string,
        submitted_at: ISO8601,
        risk_level: 'low' | 'medium' | 'high',
        rule_hits_count: number,
        status: 'pending' | 'in_review' | 'approved' | 'rejected',
        urgent_flag: boolean
      }
    ],
    summary: {
      total_pending: number,
      total_approved_today: number,
      total_rejected_7d: number
    }
  }
```

**GET /api/compliance/queue/:id**
```
response:
  {
    id: UUID,
    type: 'template' | 'campaign',
    name: string,
    advisor_id: UUID,
    advisor_name: string,
    submitted_at: ISO8601,
    content: string (HTML/plaintext),
    jurisdictions: [string],
    compliance_checks: {
      disclaimer: { status: 'pass' | 'fail', message: string, recommendation: string },
      claims: { status: 'pass' | 'fail', detected_claims: [{ text: string, type: string, substantiated: bool }], flags: [string] },
      suppression: { status: 'pass' | 'fail', suppressed_count: number, preview: [{ name: string, reason: string }] },
      jurisdiction: { status: 'pass' | 'fail', violations: [string] },
      financial_claims: { status: 'pass' | 'fail', unsubstantiated: [string] }
    },
    audit_trail: [
      {
        reviewer_id: UUID,
        reviewer_name: string,
        decision: 'approve' | 'request_changes' | 'reject',
        timestamp: ISO8601,
        notes: string
      }
    ]
  }
```

**POST /api/compliance/queue/:id/decision**
```
body:
  {
    decision: 'approve' | 'request_changes' | 'reject' (required),
    notes: string (optional for approve, required for reject),
    reviewer_id: UUID (auto-populated from auth token)
  }

response:
  {
    status: 'success',
    template_id: UUID,
    new_status: 'approved' | 'in_review' | 'rejected',
    audit_log_id: UUID
  }
```

**GET /api/compliance/audit-log** (Feature #10)
```
query params:
  template_id: UUID (optional)
  reviewer_id: UUID (optional)
  date_range: 'today' | '7d' | '30d' | 'custom' (with start_date, end_date)

response:
  [
    {
      id: UUID,
      template_id: UUID,
      reviewer_id: UUID,
      reviewer_name: string,
      decision: string,
      timestamp: ISO8601,
      notes: string
    }
  ]
```

---

## Empty & Error States

### Empty State: No Pending Items
- **Visual:** Centered, large inbox icon (outline style)
- **Headline:** "All clear!"
- **Body text:** "No pending reviews right now. New submissions from advisors will appear here."
- **CTA button:** "View Approved Templates" (links to approval history or template library)

### Error State: Compliance Engine Timeout
- **Visual:** Warning triangle icon
- **Message:** "Compliance checks timed out. Please refresh or contact support."
- **Action:** "Retry" button (attempts re-check) + "Contact Support" link

### Error State: Advisor Not Found
- **Message:** "Advisor [name] not found. This template may have been deleted or submitted by a user who no longer has access."
- **Action:** "Archive Item" button (removes from queue)

### Loading State: Review Detail
- **Skeleton loader:** Placeholder blocks for content section, compliance checks, audit trail
- **Message:** "Running compliance checks..." (appears while checks execute)
- **Timeout:** If checks take >10s, show "This is taking longer than usual. Continue waiting?" + "Load Partial Results" option

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| **Desktop (>1200px)** | Queue table full width, review side panel (right-slide, 40% width), details visible inline |
| **Tablet (768–1200px)** | Queue table full width (columns stack: name/advisor/priority visible, type/risk/rule hits in collapse menu), review opens full-width modal (overlay on queue) |
| **Mobile (<768px)** | Queue as vertical card stack (one item per card, swipe to see more), review opens full-screen modal, decision buttons stack vertically at bottom |

---

## Success Metrics

1. **Review SLA met:** % of queue items reviewed within 24h (target: 95%)
2. **Approval rate:** % of submissions approved on first review (target: 75%, indicates advisor education working)
3. **Rejection rate:** % requiring resubmission (target: <10%)
4. **Audit completeness:** 100% of decisions logged to audit trail (compliance requirement; monitor for missing entries)
5. **Reviewer throughput:** Avg items reviewed per reviewer per day (target: 8–12, depends on complexity)
6. **Time-to-decision:** Median time from submission to final approval/rejection (target: <12h)
7. **Change-request effectiveness:** % of advisors who re-submit successfully after feedback (target: 80%)

---

## Competitor Comparison

| Feature | DealFlow AI | Typical M&A Platforms | Specialized Compliance Tools |
|---|---|---|---|
| **Pre-send outreach approval gate** | ✓ Yes (core) | ✗ No (risk check, not approval) | ✓ Yes (secondary; main product is risk scoring) |
| **Template-level compliance review** | ✓ Yes | ✗ Rarely; static library only | ✓ Yes (primary) |
| **Real-time compliance rule engine** | ✓ Yes (Feature #12) | ✗ None; manual checklist | ✓ Yes (domain-specific) |
| **Auditable decision trail** | ✓ Yes (every decision logged) | ✗ No; compliance is offline | ✓ Yes (required by regulation) |
| **Jurisdiction-aware suppression** | ✓ Yes (integrated w/ suppression engine) | ✗ Basic contact suppression only | ✓ Yes (if included in tool) |
| **Integrated within deal workflow** | ✓ Yes (gate before campaign deploy) | ✗ Separate tool; manual handoff | ✗ Standalone; no deal context |
| **Advisor visibility (status only)** | ✓ Yes (separate view) | ✓ Limited (email notification) | ✗ No visibility; output-only |
| **Bulk/batch operations** | ✓ Phase 2 (planned) | ✗ Rare | ✓ Depends on tool |

**Wedge:** DealFlow AI's compliance-first gate is unique in the M&A advisory space. No competitor offers pre-send approval + audit trail + integrated suppression in a single workflow. This reduces legal exposure and creates institutional compliance proof—directly reducing firm risk.


---
**Approved design (v9):** `design/compliance-queue.html`
