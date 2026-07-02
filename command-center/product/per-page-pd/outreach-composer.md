# Page PD: Outreach Composer & Campaign (Compliance-First Send)

**Route:** `/mandates/:id/outreach`  
**Personas:** Advisor/Deal Lead (primary), Analyst (secondary)  
**Related flows:** F3 (approve & launch compliant outreach), F8 (templates)  
**Features addressed:** #9 (compliant email outreach send+tracking), #8 (templates), #11 (outreach compliance gate), #10 (audit log)  
**Modules involved:** Outreach engine, compliance rules engine, audit-log service  

---

## Purpose

The Outreach Composer is where Deal Leads and their Analysts assemble and send compliant outreach to shortlisted buyers. The page is the compliance-first wedge: it enforces pre-send checks (disclaimers, suppression lists, recordkeeping flags) before any message leaves the system, blocking non-compliant sends and optionally routing to a compliance queue for human review. Every send, whether approved immediately or queued for review, writes an immutable audit-logged entry. This differentiates DealFlow AI from ungoverned point tools (Hunter.io, Apollo.io, RocketReach) that send email without integrated governance.

---

## Audience & Access Control

**Authed users only.** Role-gated per RBAC (`#15: auth+RBAC`):
- **Advisor/Deal Lead** (primary): create/edit/send campaigns, review compliance flags, submit for approval if gated.
- **Analyst/Associate** (secondary): draft/personalize templates, run compliance checks, submit (not approve-send directly).
- **Compliance Reviewer**: read-only access to compliance-check results and pre-send decisions; approves via F10 (separate compliance-queue page) if gating is enabled.
- **Admin**: read-only audit trail access; no send rights.

**Deny:** unauthenticated users, roles below analyst tier.

---

## Entry Points

1. **Primary:** Mandate detail page → "Matches" / shortlist tab → "Start outreach" button (routes to `/mandates/:id/outreach`).
2. **Secondary:** Dashboard → card for in-progress campaigns → "Edit" or "Resume" (routes to `/mandates/:id/outreach?campaign_id=<uuid>`).
3. **Return flow:** Compliance-queue approval (F10) → "Return to campaign" link (routes back to in-progress composer with gating status updated).

---

## Content Sections

### 1. **Campaign Header & Metadata**
- Mandate name (read-only).
- Campaign name (editable text field; auto-populated: "[seller] → [buyer count] buyers" on init).
- Shortlist summary (e.g., "35 buyers selected from 127 matches").
- Campaign state indicator (draft/in-review/sent/scheduled/paused).
- Timestamp of last edit / last save.

### 2. **Recipient List Panel**
- **Source:** the shortlist from F2 (match-review).
- **Display table:**
  - **Buyer name** (company).
  - **Contact name** (decision-maker).
  - **Contact email**.
  - **Match score** (read-only, from AI engine; _e.g._ "87% fit").
  - **Suppression status** (green checkmark if clear; red alert + reason if on blocklist; orange warning if missing verified email).
  - **Personalization draft** (preview icon; full text in modal on click).
  - **Compliance check result** (per-recipient: pass/fail; click to expand reason).
  - **Action column** (remove from list, reassign to different template, flag for manual review).
- **Bulk actions:**
  - Remove recipients matching filter (e.g., "all flagged for review").
  - Re-run suppression check on entire list (useful after rules update per F12).
  - Export recipient list (CSV, incl. suppression status).
- **Empty state:** "No shortlisted buyers. Go back to Matches and accept buyers to outreach."
- **Loading state:** "Fetching recipient list…" (skeleton placeholder for table).

### 3. **Template Picker & Selection**
- **Template library** (dropdown or modal card picker):
  - List of available templates (from F8; analyst-drafted + compliance-approved).
  - Each template card shows: name, subject-line preview, merge fields (e.g., `{buyer_name}`, `{deal_thesis}`), compliance blocks status (green if all required disclaimers present).
  - Filter/search: by template name, by use case (e.g., "strategic buyer intro").
  - **Create new template** button (routes to F8 template composer, returns on save).
  - **Use template** button: selects template and populates the personalization panel below.
- **Selected template display:**
  - Template name (with optional "edit" pencil for analyst-tier; opens a modal copy of the template for this campaign only, does NOT edit the library version).
  - Subject line (fully personalized on first preview, see below).

### 4. **Personalization & Merge Panel**
- **Merge-field reference table** (collapsible):
  - List of available merge fields: `{buyer_name}`, `{buyer_industry}`, `{deal_thesis}`, `{decision_maker_name}`, `{contact_title}`, custom fields from the mandate (e.g., `{seller_summary}`).
  - Each field shows: field name, data type, sample value.
- **Draft personalization toggle:**
  - **Per-recipient drafting mode** (default): each buyer gets a personalized version; Advisor can hand-edit or approve auto-drafts.
    - Editor with syntax highlight for merge fields.
    - Auto-fill button: "Personalize all" → runs merge on all recipients in the list; shows a before/after preview.
    - Undo: reverts auto-personalization for all.
  - **Single template mode:** all recipients get identical message (merge fields not expanded, or expansion is preview-only).
- **AI-assisted drafting** (H1 MVP; optional "AI suggest" button):
  - "Tone" preset (formal, conversational, urgent).
  - "Prompt" field: "What would you like to emphasize about this buyer?"
  - Runs on the template subject + body; shows diff; accept/reject/edit.
- **Compliance-block lock indicator:**
  - Disclaimer, opt-out language, any required compliance text is visually marked (gray bg / badge) as non-editable.
  - Hovering shows: "This block is required by your compliance profile and cannot be edited."

### 5. **Per-Message Preview Panel**
- **Carousel/list view:**
  - One recipient per preview card (paginated or scrollable; "1 of 35" indicator).
  - Shows: **To:** contact email, **From:** sending identity (from workspace settings, F15), **Subject:** fully expanded merge fields, **Body:** rendered HTML (including compliance blocks), **Timestamp:** (when this specific message will be sent if scheduled).
  - **Navigation:** prev/next buttons; jump-to-recipient dropdown.
  - **Quick actions on preview:**
    - Remove this recipient from campaign.
    - Copy this message (for manual send or external review).
    - Compliance-check status for this recipient (pass/fail; click to expand reason).
    - Scheduling: "Send immediately" vs "Schedule for [date+time]" (per recipient or bulk).

### 6. **Pre-Send Compliance Check Panel** (the core wedge)
- **Panel layout:**
  - Heading: "Compliance check required before send."
  - **Campaign-level checks:**
    - [ ] All recipients cleared by suppression list (count of blocked; list link).
    - [ ] All required disclaimers present (by jurisdiction; e.g., "California CID disclaimer present").
    - [ ] Sending identity verified and authorized (domain in SPF/DKIM; check against workspace settings).
    - [ ] Recordkeeping enabled for this campaign (audit-log receiver configured).
    - [ ] Approval gating policy satisfied (if policy says "all campaigns need compliance review," button to route to F10).
  - **Per-recipient checks** (summary):
    - Count of recipients passing all checks.
    - Count of recipients flagged (reason per recipient).
    - Expandable list of flagged recipients (suppressed, missing email, non-compliant personalization, etc.).
  - **Run compliance check** button:
    - Disabled until template is selected + personalization is locked (or submitted for approval).
    - On click: backend call to compliance-rules-engine (see Data requirements below).
    - Returns: pass/fail verdict + reason list (structured: `[{recipient_id, reason_code, human_text}]`).
  - **Compliance verdict display:**
    - **PASS (green):** ✓ All checks cleared. "You're good to send."
    - **FAIL (red):** ✗ One or more checks failed. Block send and list reasons (e.g., "3 recipients on suppression list," "Disclaimer X missing"). User must fix (remove suppressed recipients, add disclaimer) and re-run check.
    - **WARN (yellow):** ⚠ No blockers, but flagged for review (e.g., "New suppression rule added today; recommend review"). Send allowed but recommended for compliance queue.
  - **Suppress/unblock actions** (conditional):
    - If check shows "contact on suppression list": "Remove from suppression?" (requires analyst+ or compliance approval).
    - "Add exception?" (rare; requires compliance override; logs to audit trail with reason).
- **Approval-gating controls** (conditional, based on F12 policy):
  - If compliance policy requires approval: after PASS verdict, show "Submit for compliance review" button (instead of send/schedule).
  - Routes to F10 compliance-queue; returns here when approved.
  - Status badge: "Pending approval" (with "View queue" link).

### 7. **Send / Schedule Controls**
- **Send button (primary action):**
  - Enabled only if compliance check passes (or is waived/approved).
  - Label: "Send now" (if no scheduling selected) or "Send [count] emails" (if bulk).
  - On click: confirmation modal. "Send [N] messages now? This action is logged and cannot be undone."
  - Confirmation button: "Yes, send now" (red/danger style).
- **Schedule button (secondary action):**
  - Allows setting a future send time (per-recipient or bulk).
  - Picker: date + time + timezone.
  - "Schedule [N] sends for [date]" label.
  - On confirm: messages queued; recipients removed from draft, added to "scheduled" tab.
- **Save draft button:**
  - Persists current campaign state (template, personalization, recipients) without sending.
  - Label: "Save draft."
  - On success: toast "Campaign saved. You can resume editing later."
- **Cancel button:**
  - Confirmation: "Discard changes?" (unless no edits made).
  - Routes back to mandate detail.

---

## Interactions & User Flows

### Primary flow (Advisor):
1. **Enter:** "Start outreach" from shortlist → composer opens with recipients pre-populated.
2. **Select template:** pick from library (or create new via F8).
3. **Personalize:** bulk-personalize all or hand-edit per-recipient.
4. **Preview:** carousel through messages, spot-check subject/body.
5. **Compliance check:** run check → if PASS, unlock send buttons.
6. **Send or schedule:** click "Send now" or "Schedule" → confirm → messages queued to outreach engine + audit log.
7. **Exit:** dashboard redirects to mandate view (with outreach campaign now in "sent"/"scheduled" state).

### Secondary flow (Analyst):
1. **Enter:** edit existing draft (via resume link or home-page card).
2. **Personalize:** tweak merge fields, use AI-assist.
3. **Compliance check:** submit to run (may fail if required blocks missing).
4. **Submit for approval:** if policy requires, route to compliance queue (F10).
5. **Exit:** compliance reviewer takes over (F10).

### Compliance-gating flow (if F12 policy enables):
1. After Advisor passes compliance check, show "Submit for compliance review" button (not "Send").
2. On submit: campaign moves to state "in-review"; Advisor sees "Pending compliance approval" badge.
3. Compliance Reviewer (F10) opens campaign, reviews, approves/rejects with notes.
4. If approved: return to Advisor's composer page with "Send now" button enabled.
5. If rejected: return with failure reasons; Advisor fixes and re-submits.

### Bulk operations (analyst/lead):
- **Re-run suppression:** if suppression rules change (F12), button to re-check entire recipient list.
- **Remove flagged:** bulk-remove all suppressed or low-confidence recipients.
- **Export:** download recipient list (CSV) with suppression + compliance check status (for external audit or manual follow-up).

---

## Data Requirements & Placeholder Endpoints

### **Fetch / Initialize Campaign**

```yaml
GET /mandates/:id/outreach?campaign_id=<uuid>
# Returns:
#   mandate: {id, name, seller_profile, buyer_criteria, compliance_profile_id}
#   shortlist: [{buyer_id, buyer_name, contact_id, contact_name, email, match_score}, ...]
#   templates: [{id, name, subject, body, merge_fields[], required_compliance_blocks[]}, ...]
#   campaign: (if campaign_id provided) {id, name, template_id, personalization_draft, recipients[], status, created_at, updated_at}
#   compliance_rules: {suppression_list: [{email, reason}], required_disclaimers: {jurisdiction: [text]}, approval_gating_policy: bool}
#   workspace_identity: {sending_domain, verified_domain_auth}
```

### **Template Fetch (on picker selection or create)**

```yaml
GET /templates/:id
# Returns:
#   id, name, subject, body, merge_fields[], required_compliance_blocks, status

POST /templates
# Body:
#   {name, subject, body, merge_fields[], required_compliance_blocks}
# Returns:
#   template object

PUT /templates/:id
# (Edit a library template; or POST a copy for this campaign only)
```

### **Personalization / Merge**

```yaml
POST /outreach/personalize
# Body:
#   {
#     template_id,
#     recipients: [{recipient_id, merge_data: {buyer_name, decision_maker_name, ...}}, ...],
#     mode: "bulk" | "per_recipient"
#   }
# Returns:
#   {personalized_messages: [{recipient_id, subject, body}, ...]}
```

### **Compliance Check (the core endpoint)**

```yaml
POST /compliance/check-outreach
# Body:
#   {
#     mandate_id,
#     campaign_id,
#     template_id,
#     recipients: [{recipient_id, email, personalized_body}, ...],
#     sending_domain,
#     compliance_profile_id
#   }
# Returns:
#   {
#     verdict: "PASS" | "FAIL" | "WARN",
#     campaign_level: [
#       {check: "suppression_list", status: "pass|fail", count_flagged: 3, details: [...]},
#       {check: "disclaimers", status: "pass", required_by: ["CA", "NY"], ...},
#       {check: "sending_domain", status: "pass|fail", ...},
#       {check: "recordkeeping_enabled", status: "pass|fail", ...},
#       {check: "approval_gating", status: "pass|pending_approval", ...}
#     ],
#     per_recipient: [
#       {recipient_id, email, status: "pass|fail|warn", flags: ["suppressed", "missing_email", ...], reason_text}
#     ],
#     blocking_reasons: ["string", ...] # if FAIL
#   }
```

### **Send / Schedule Campaign**

```yaml
POST /outreach/send
# Body:
#   {
#     mandate_id,
#     campaign_id,
#     recipients: [{recipient_id, email, personalized_subject, personalized_body}, ...],
#     send_mode: "immediate" | "scheduled",
#     scheduled_time: "2026-07-15T14:00Z" (if scheduled),
#     sending_identity: {from_email, from_name, reply_to},
#     compliance_approved: bool (true if submitted via F10 approval)
#   }
# Returns:
#   {
#     campaign_id,
#     status: "sent" | "scheduled",
#     send_count: 35,
#     audit_log_entries: [{entry_id, timestamp, ...}, ...],
#     failed_sends: [{recipient_id, reason}, ...] (if any)
#   }
```

### **Submit for Compliance Review** (conditional, if F12 policy enabled)

```yaml
POST /compliance/submit-for-approval
# Body:
#   {
#     mandate_id,
#     campaign_id,
#     submitted_by: advisor_id,
#     compliance_check_result: {verdict, per_recipient, ...}
#   }
# Returns:
#   {
#     status: "pending_approval",
#     queue_position: 2,
#     compliance_queue_url: "/compliance/queue"
#   }
```

### **Re-run Suppression Check**

```yaml
POST /compliance/re-check-suppression
# Body:
#   {campaign_id, recipients: [{recipient_id, email}, ...]}
# Returns:
#   {
#     campaign_id,
#     re_checked_count: 35,
#     newly_flagged: [{recipient_id, email, reason}, ...],
#     verdict: "clear" | "has_flagged"
#   }
```

### **Audit Log Write** (automatic, on send)

```yaml
POST /audit-log (called internally by outreach-send)
# Body:
#   {
#     mandate_id,
#     campaign_id,
#     action: "outreach_send" | "outreach_schedule" | "compliance_check" | "approval_submit",
#     sender_id,
#     recipients: [{recipient_id, email}, ...],
#     message_content_hash: "sha256(personalized_subject + body)" (for integrity),
#     compliance_verdict: {pass|fail|warn},
#     timestamp: "2026-07-15T13:47:32Z",
#     metadata: {approval_required, approved_by, ...}
#   }
# Returns:
#   {
#     entries: [{entry_id, timestamp, integrity_verified: true}, ...]
#   }
```

---

## Empty / Error / Loading States

### **Empty states:**

1. **No template selected:** "Pick a template to get started. Choose from the library or create a new one."
2. **No recipients:** "No shortlisted buyers. Go back to Matches and accept buyers to outreach."
3. **No saved campaigns (on entry via dashboard card):** "No draft campaigns. Start a new outreach from a mandate."

### **Loading states:**

1. **Fetching recipients:** skeleton table (5 rows, muted).
2. **Fetching templates:** skeleton card grid (3 items).
3. **Running compliance check:** spinner + "Checking compliance… (this may take a few seconds)."
4. **Sending campaign:** spinner + progress bar "Sending 35 emails…" with count updates (e.g., "Sent 12/35").

### **Compliance check FAIL (blocking):**

```
❌ Compliance check failed. Fix the issues below and try again.

• Suppression list blocks 3 recipients:
  - sarah.chen@techcorp.io (rule: GDPR consent not obtained)
  - mark.williams@equityholdings.com (rule: prior opt-out)
  - info@innovatorsventures.com (rule: generic inbox)
  
  [Remove from list] [Request exception] [Edit suppression rules]

• Required disclaimer missing:
  - California M&A advisor disclaimer (for 2 CA-based recipients)
  
  [Add to template] [Edit compliance rules]

• Approval gating policy requires review before send.
  
  [Submit for compliance review]

[← Back] [Re-run check]
```

### **Compliance check WARN (optional approval):**

```
⚠ Compliance check flagged for review (no blockers).

Your compliance rules were updated 2 hours ago. We recommend review before sending to 35 recipients.

[Submit for compliance review] [Send anyway] [← Back]
```

### **Compliance check PASS:**

```
✓ Compliance check passed.

• All 35 recipients cleared by suppression list.
• All required disclaimers present.
• Sending domain verified.
• Recordkeeping enabled.

[Send now] [Schedule] [Save draft] [← Back]
```

### **Provider error (send fails mid-batch):**

```
❌ Send failed for 3 recipients.

• sarah.chen@techcorp.io – Email provider rate limit (retry in 1 hour)
• mark.williams@equityholdings.com – Invalid recipient address

32 messages sent successfully and logged.

[Retry failed sends] [Remove failed & send rest] [Save draft & retry later] [← Back]
```

### **Approval gating: pending compliance review:**

```
⏳ Campaign submitted for compliance review.

Position in queue: 2
Expected review time: < 4 hours

Your compliance team will review and approve before sending. You'll be notified when approved.

[View compliance queue] [Edit campaign] [← Back]
```

### **Approval gating: rejected by compliance:**

```
❌ Compliance rejected this campaign.

Reviewer: Jane Liu (Compliance Reviewer)
Reason: "Claim 'leading M&A advisory firm' is too broad without support. Please add specifics."
Submitted: 2026-07-15 13:42 UTC
Rejected: 2026-07-15 14:15 UTC

[Edit campaign & resubmit] [View reviewer's notes] [← Back]
```

---

## Responsive Breakpoints

**Mobile (< 768px):**
- Recipient list table: collapse to card view (buyer name → contact name / email, suppression status as badge).
- Template picker: modal + searchable dropdown (not inline grid).
- Preview carousel: full-width cards, swipe navigation.
- Compliance panel: collapsible sections (one expanded at a time).
- Send/Schedule buttons: full-width, stacked.

**Tablet (768–1024px):**
- Recipient table: horizontal scroll or breakpoint column hiding (match score, action column visible via "more" menu).
- Template picker: grid of 2 columns.
- Preview carousel: side-by-side prev/next nav.
- Compliance panel: 2-column layout (checks on left, per-recipient list on right).

**Desktop (> 1024px):**
- Full table layout; all columns visible.
- Template grid: 3+ columns.
- Compliance panel: expanded; all checks visible at once.

---

## Success Metrics

**Primary (product):**
1. **Campaign completion rate:** % of outreach campaigns that reach "sent" or "scheduled" (goal: >80%).
2. **Compliance check pass-on-first-run:** % of campaigns that pass pre-send compliance on first attempt (goal: >75%; measures template quality + rule clarity).
3. **Approval workflow throughput (if gating enabled):** avg time from submission to approval/rejection (goal: < 4 hours for 95th percentile).
4. **Audit log coverage:** 100% of outreach sends logged with integrity hash (non-negotiable; controls attestation).

**Secondary (user):**
5. **Time-to-send:** median time from shortlist approval to campaign sent (goal: < 20 min for Advisor + Analyst pair).
6. **Compliance rejection rate:** % of campaigns rejected by compliance reviewer (goal: < 10%; if higher, investigate template/rule clarity).
7. **Suppression override rate:** % of suppressed contacts that are removed vs. overridden (goal: >90% removed; high override rate suggests over-aggressive suppression rules).
8. **Message personalization adoption:** % of campaigns using per-recipient personalization vs. bulk template (goal: >60%).

**Operational (compliance):**
9. **No sending-domain failures:** 0 sends with unverified/mismatched domain (blocks at compliance check).
10. **Recordkeeping export audit trail:** every export includes a tamper-evident hash of the log contents; 100% verifiable by compliance team.

---

## Competitor Comparison

| **Dimension** | **Hunter.io / Apollo.io / RocketReach** | **DealFlow AI (Outreach Composer)** |
|---|---|---|
| **Template system** | Generic email templates; no M&A compliance blocks | M&A-aware templates with required disclaimers + merge fields locked by compliance policy |
| **Pre-send compliance check** | None; users send ungoverned | Mandatory: suppression list, disclaimers, domain verification, recordkeeping flag, before send allowed |
| **Approval gating** | None | Conditional: if F12 policy enables, routes to compliance queue; only approved sends proceed |
| **Audit logging** | Basic send/open logs; not tamper-evident | Immutable, cryptographically verified log of every send + decision (hash + timestamp) |
| **Suppression lists** | User-maintained; no integration with compliance rules | Integrated with compliance-rules-engine; updates broadcast to all active campaigns |
| **Recordkeeping export** | None | F13: date/mandate-filtered FINRA/SOX-compliant export with integrity verification |
| **Advisor/Analyst workflow** | Single role; no separation of concerns | Advisor owns send decision; Analyst personalizes; Compliance reviews if gated |
| **M&A-specific** | Generic; not buyer-seller scoped | Mandate-aware: merge fields reflect deal thesis, seller/buyer profile, jurisdiction disclaimers |
| **Cost to implement compliance** | External compliance tools + manual oversight | Built in; no separate tool needed for outreach governance |

**Why this matters:** M&A outreach is regulated (FINRA Rule 4512, SOX recordkeeping). Competitors force firms to bolt on external compliance tooling or rely on manual review. DealFlow's compliance-first wedge bakes governance into the send workflow, making it impossible to send ungoverned email — and every send is audit-ready by design.

---

## Wireframe-Ready Specification (Layout Pseudocode)

```
[Page: Outreach Composer & Campaign]

Header:
  [← Mandate Name] [Campaign name (edit)] [State badge: Draft|In-Review|Sent|Scheduled]

[2-col layout on desktop; stacked on mobile]

Left column (wider):
  [2.1: Recipient List Panel]
    Table: Buyer | Contact | Email | Match% | Suppression | Personalization | Compliance | Actions
    [Bulk actions dropdown: Remove flagged, Re-check suppression, Export CSV]
    
  [2.5: Per-Message Preview Carousel]
    [1 of 35] → To/From/Subject/Body (rendered) → [Prev] [Next] [Jump-to dropdown]
    [Remove] [Copy] [Compliance status for this recipient]

Right column (narrower):
  [2.3: Template Picker]
    [Dropdown / modal card grid]
    [Selected: Template Name | Subject preview | Merge fields]
    
  [2.4: Personalization Panel]
    [Merge field reference (collapsible)]
    [Personalization mode: Bulk | Per-recipient] [AI-assist button]
    [Editor for merge / text]
    
  [2.6: Compliance Check Panel]
    [Campaign-level checks: suppression, disclaimers, domain, recordkeeping, approval gating]
    [Per-recipient summary: N pass, M flagged]
    [Run compliance check button]
    [Verdict: ✓ PASS | ✗ FAIL | ⚠ WARN]
    [Blocking reasons (if FAIL)]
    [Submit for approval button (if gating enabled)]
    
  [2.7: Send / Schedule Controls]
    [Send now button (primary)]
    [Schedule button (secondary)]
    [Save draft button]
    [Cancel button]

Footer:
  [Progress: 3 of 7 steps complete] [← Back]
```

---

## Notes for Design & Dev

- **Compliance lock visual:** Gray background + lock icon on required blocks (disclaimer, opt-out); tooltip on hover: "This text is required by your compliance profile and cannot be edited."
- **Merge-field syntax:** `{field_name}` in template; auto-completed in editor (autocomplete dropdown on `{`).
- **Error detail levels:** 
  - High-level: "Compliance check failed. 3 recipients flagged."
  - Medium: Per-recipient reason (on click/expand).
  - Deep: Compliance rules matched (in a `<details>` sidebar or modal).
- **Scheduling:** Store in outreach-queue table with `scheduled_send_time`; background job picks up at time and sends via provider.
- **Audit log schema:** one row per send action, incl. mandate_id, campaign_id, recipient, message hash, verdict, timestamp, sender_id. Indexed by (mandate_id, campaign_id, timestamp) for export queries.


---
**Approved design (v9):** `design/outreach-composer.html`
