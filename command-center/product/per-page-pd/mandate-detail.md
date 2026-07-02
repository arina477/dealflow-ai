# Mandate Detail — Product Description

## Purpose

The Mandate Detail page is the operational hub for a single sell-side engagement in DealFlow AI. It surfaces the complete context of an M&A mandate — from target and seller profile through buyer matching strategy and compliance governance — and serves as the central dispatch point for the matching and outreach workflows. Users navigate here to configure buyer criteria, review AI-generated matches, manage compliance flags, and track the mandate's progress through the Sourcing → Matching → Outreach → Pipeline lifecycle.

---

## Audience

**Primary:** Advisor / Deal Lead (mandate owner; full read + write access)
- Initiates mandate; sets buyer criteria and compliance policy; reviews and shortlists matches; approves outreach
- Entry point: usually from F1 (configure mandate) or F2 (review matches) or from a saved mandate link

**Secondary:** Analyst (read-heavy, limited edit)
- Supports research, populates seller/target data fields, reviews match quality and compliance flags
- Entry point: linked by Deal Lead; read access to all sections, write access to research fields only

**Tertiary:** Compliance Officer (view-only, advisory)
- Spot-checks compliance profiles and exclusion flags before outreach batch
- Entry point: audit/reporting; read-only access to mandate compliance tab

---

## Entry Points

- **From F1 (Configure Mandate):** POST creates a new mandate ID; browser redirects to `/mandates/:id` with empty/skeleton content
- **From F2 (Review Matches):** breadcrumb or "Back to mandate" link in the matches tab
- **From F4 (Pipeline):** deal-pipeline view includes "View mandate" link for context
- **Direct URL:** user pastes `/mandates/m_abc123` (requires auth + role-gate)
- **From mandates list:** index page `/mandates` shows active/recent mandates; click to detail
- **Email/mobile:** deep link in outreach summary or deal-progress digest

---

## Content Sections

### Page Header & Status Strip
- **Mandate title** (editable): e.g., "ABC Corp - Strategic Buyer Search"
- **Status badge:** one of `Sourcing | Matching | Outreach | Pipeline | Paused | Completed`
- **Seller/target** summary line: e.g., "Seller: Acme Inc (SaaS) | Industry: B2B Enterprise | Est. Revenue: $50–75M"
- **Timeline:** "Initiated: Mar 15, 2026 | Expected close: Dec 2026"
- **Quick actions:** `Edit mandate` (Deal Lead), `Add compliance note` (Advisor), `View audit log` (Compliance Officer only)

### Seller & Target Profile (collapsible section)
- **Seller name, description, industry, geography**
- **Target company profile:** legal entity, revenue, EBITDA, vertical, growth stage, recent news/filings
- **Strategic rationale / investment thesis** (free text)
- **Key assets / differentiators** (e.g., IP, customer base, growth trajectory)
- **Edit affordance:** Analyst can populate, Deal Lead can refine; timestamp last modified

### Buyer Criteria & Strategy (collapsible section)
- **Buyer profile template:** hardcoded facets (company size, geography, industry, growth stage, deal experience)
- **Custom criteria:** free-text buyer persona, deal structure preferences, strategic fit notes
- **Exclusions:** geographies, industries, buyer types to avoid
- **Match tuning:** slider for match sensitivity (strict → balanced → permissive); weights for industry proximity vs. financial fit
- **Edit flow:** Deal Lead updates; changes trigger re-run prompt for the matching engine
- **Timestamp:** last modified by whom and when

### Compliance & Governance Profile (tab or mini-section)
- **Seller sanctions/PEP flags:** auto-populated from data provider; flagged if any hit; editable note field
- **Buyer exclusion rules:** hard-coded OFAC, export-control, competitive conflicts (reads from system policy + mandate-level overrides)
- **Approval chain:** "Compliance approval pending" / "Approved on [date]" / "Flagged for escalation"
- **Notes & mitigations:** Advisor can document any exceptions or risk mitigations reviewed with Legal
- **Compliance sign-off:** Compliance Officer toggles "Approved for outreach" (read-only to Deal Lead until toggled)
- **Status indicator:** green (clean) / yellow (review in progress) / red (blocked pending escalation)

### Tabbed Sub-sections (4 tabs: Buyer Universe, Matches, Outreach, Pipeline)

#### Tab 1: Buyer Universe
- **Curated buyer list:** subset of all known buyers matching the criteria above
- **List view:** buyer name, estimated size/stage, geography, recent M&A activity
- **Actions:** "Save to shortlist" (→ Matches tab), "View company profile" (modal)
- **Count badge:** "127 buyers match these criteria"
- **Filtering:** by geography, stage, sector, deal experience
- **Lazy load:** pagination or infinite scroll (50 per view)

#### Tab 2: Matches & Shortlist
- **AI match results:** ranked list of buyer candidates, sorted by match score (98%, 95%, 87%, …)
- **Match card:** buyer logo, name, match score, top 3 matching attributes, compliance flag (if any)
- **Shortlist indicators:** checkboxes + "Added to shortlist: [date]" badges
- **Actions per match:** "View detail", "Add to shortlist", "Remove from shortlist", "Flag for review", "View compliance note"
- **Pagination/scroll:** 10–20 per view; "Load more" or infinite scroll
- **Empty state:** "No matches yet. Click 'Re-run matching' to generate results based on updated criteria."
- **Compliance overlay:** any match flagged shows red badge + tooltip; Deal Lead can override with documented reason

#### Tab 3: Outreach
- **Outreach status:** "Ready to send" / "Pending approval" / "In flight" / "Responses received"
- **Campaign summary:** template chosen, personalization level, sending schedule
- **Batch view:** list of buyers in this outreach wave (status per recipient)
- **Actions:** "Send batch", "Preview message", "Schedule send", "View response status", "Download response log"
- **Compliance gate:** cannot send until Compliance Officer approves (status shows "Blocked: Compliance sign-off required")
- **Response tracking:** links to message tracking (opens, replies, bounces)

#### Tab 4: Pipeline
- **Deal pipeline:** cards/rows for each buyer who responded or was moved to active negotiation
- **Deal status:** first-contact → preliminary interest → LOI stage → negotiation → won
- **Quick actions:** "View deal detail" (→ F4), "Add note", "Update status"
- **Empty state:** "No deals in pipeline yet. Outreach responses will appear here."

---

## Interactions

### Edit Workflow
- **Inline editing** for mandate title, seller description, and buyer criteria
- **Modal dialogs** for complex multi-field updates (e.g., "Edit buyer criteria" opens a guided form)
- **Save/Cancel:** changes committed on Save; unsaved changes trigger "Discard changes?" on nav away
- **Optimistic updates:** input reflected immediately; spinner on submit; rollback on error

### Matching Engine Trigger
- **"Re-run matching" button** in Buyer Criteria section
- **Confirmation dialog:** "Update buyer criteria and re-match? This will generate a fresh ranked list."
- **Progress:** modal spinner ("Matching in progress…") or background task (e.g., toast notification "Matching queued; refresh in 1 min")
- **Result:** Matches tab auto-refreshes; new scores displayed with change indicators (↑ / ↓ / —)

### Outreach Initiation
- **"Send outreach" button** in Outreach tab (disabled if Compliance not approved)
- **Confirmation:** shows buyer list, template preview, sending schedule; "Approved for outreach? [Approve/Cancel]"
- **Post-send:** navigate to tracking view or return to mandate detail with success toast

### Compliance Sign-Off
- **Compliance Officer workflow:** toggle "Approved for outreach" + optional note field
- **Deal Lead view:** greyed-out toggle until Compliance Officer approves; status message ("Awaiting compliance review") shown
- **Audit log:** all compliance actions logged (who, when, note)

### Navigation & Breadcrumbs
- **Breadcrumb:** `DealFlow AI > Mandates > [Mandate Title]`
- **Back button** or "← Back to mandates" link (returns to mandate index)
- **Tab navigation:** clicking a tab updates URL fragment (e.g., `/mandates/:id#matches`)

---

## Data Requirements

### Endpoints (Placeholder)

**GET /api/v1/mandates/:id**
- Returns mandate summary, seller profile, buyer criteria, compliance status, and tab counts
- Response schema includes `mandate_id`, `title`, `seller_id`, `seller_profile{}`, `buyer_criteria{}`, `compliance_status{}`, `stage`, `created_at`, `updated_at`

**PUT /api/v1/mandates/:id**
- Update mandate title, seller description, buyer criteria, compliance notes
- Requires Deal Lead role

**GET /api/v1/mandates/:id/matches**
- Returns ranked list of matches with scores and compliance flags
- Query params: `page`, `limit`, `sort_by` (score, date added, etc.)
- Response includes `match_id`, `buyer_id`, `buyer_profile{}`, `match_score`, `matching_attributes[]`, `compliance_flags[]`

**GET /api/v1/mandates/:id/buyer-universe**
- Returns curated buyer list matching the mandate's criteria
- Query params: `filter[geography]`, `filter[stage]`, `page`, `limit`
- Response includes `buyer_id`, `name`, `size`, `geography`, `sector`, `recent_deals[]`

**GET /api/v1/mandates/:id/outreach**
- Returns outreach campaign status and recipient list
- Response includes `campaign_id`, `status`, `template_name`, `recipients[]`, `send_schedule`, `approval_status`

**GET /api/v1/mandates/:id/pipeline**
- Returns deals in active negotiation for this mandate
- Response includes `deal_id`, `buyer_id`, `buyer_name`, `stage`, `value_estimate`, `updated_at`

**GET /api/v1/mandates/:id/compliance**
- Returns full compliance profile: seller/buyer sanctions, export controls, exclusion rules, approval status
- Response includes `seller_sanctions{}`, `buyer_exclusions{}`, `approved_by`, `approved_at`, `notes`

**POST /api/v1/mandates/:id/rerun-match**
- Triggers matching engine with current criteria
- Response includes `job_id` (for polling) or immediate results if fast

**POST /api/v1/mandates/:id/compliance-approve**
- Compliance Officer approves mandate for outreach
- Requires `compliance_officer_id`, optional `notes`

---

## States & Transitions

### Page States
- **Loading:** skeleton screens for all sections while `/api/v1/mandates/:id` fetches
- **Loaded:** full page rendered; data displayed
- **Editing:** modal or inline form open (title, criteria, notes)
- **Matching in progress:** Matches tab shows spinner; "Matching in progress…" banner
- **Error:** if fetch fails, show "Failed to load mandate. [Retry]" + log error details
- **Empty tabs:** Matches tab is empty until matching runs; Pipeline tab is empty until outreach responses received

### Empty States
- **First-time mandate (no matches yet):** Matches tab shows "No matches yet. Click 'Re-run matching' to generate results."
- **No pipeline deals:** Pipeline tab shows "No deals in pipeline yet. Outreach responses will appear here."
- **Compliance review pending:** Outreach tab shows "Compliance review in progress. Outreach will be available once approved."

### Error States
- **API errors (5xx):** "Something went wrong. [Retry] or contact support."
- **Permission denied:** "You don't have permission to edit this mandate. Contact the deal owner."
- **Matching failed:** "Matching encountered an error. [Retry] or contact support."
- **Outreach send failed:** "Failed to send outreach batch. [Retry] or [View error details]."

---

## Responsive Breakpoints

- **Desktop (1200px+):** two-column layout (left: profile/criteria, right: tabbed content)
- **Tablet (768–1199px):** single column, collapsible sections, tabs maintain full width
- **Mobile (< 768px):** stack all sections vertically, tabs display as horizontal scrollable carousel or dropdown, modal for complex forms

---

## Success Metrics

- **Time to first match:** average time from mandate creation to first match review
- **Match utilization:** % of mandates that proceed to shortlist and outreach
- **Compliance approval SLA:** average time to Compliance Officer sign-off (target: ≤ 2 business days)
- **Outreach send rate:** % of shortlisted buyers that receive outreach (target: > 80%)
- **Pipeline conversion:** % of outreach recipients that advance to LOI or deal stage
- **User satisfaction:** NPS for Advisor/Deal Lead workflow; error rate / support tickets from this page
- **Data completeness:** % of mandates with all required fields (seller, criteria, compliance notes) populated before outreach

---

## Competitor Comparison

| Aspect | DealCloud (Incumbent) | DealFlow AI (Ours) |
|--------|----------------------|-------------------|
| **Organization** | Deal-centric; buyers/relationships as navigation root | Mandate-centric; deal-sourcing + matching loop at hub |
| **Matching** | Manual list building; no AI ranking | AI-powered buyer matching with ranked, explainable scores |
| **Compliance** | Compliance notes attached to deals | Compliance profile baked into mandate; gated outreach approval |
| **Workflow** | Seller → deal pipeline (buyer contact separate) | Seller → buyer criteria → AI matches → shortlist → outreach → pipeline (linear, integrated) |
| **Outreach** | Email templates; manual send; no integration | Templated, batch-capable, compliance-gated, response-tracked |
| **Data** | CRM + manual uploads | CRM + automated data providers + AI enrichment |

**Our advantage:** mandate-centric design ties sourcing, compliance, and outreach into one operational loop; AI matching + compliance gatekeeping reduce manual research and risk; end-to-end visibility from criteria through pipeline close.

---

## Technical Dependencies

- **Modules:** Mandate service, Buyer universe module, Matching engine, Pipeline module, Outreach service, Compliance service
- **Features:** #4 (mandate management), #5 (buyer universe), #6/#7 (matching + shortlist), #10 (outreach), #14 (pipeline)
- **Flows:** F1 (configure mandate), F2 (review matches), F4 (pipeline)
- **Auth/RBAC:** role-gated access (Deal Lead full, Analyst read + research fields, Compliance Officer read + compliance tab only)

---

## Notes

- **Compliance gatekeeping** is non-negotiable; Compliance Officer approval must be visible and enforced before any outreach send
- **Match explainability** is key to adoption; each match score should include top 3–5 matching attributes (e.g., "Similar sector, matching size, growth stage")
- **Timeline transparency:** show estimated deal close, sourcing stage, days elapsed since mandate creation
- **Audit trail:** all edits to criteria, compliance notes, and approvals logged for audit/reporting


---
**Approved design (v9):** `design/mandate-detail.html`
