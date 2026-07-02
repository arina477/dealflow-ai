# Page: Compliance Settings

**Route:** `/compliance/settings`  
**Audience:** Compliance Reviewer (authed, role-gated)  
**Flows:** F12 (manage compliance rules)  
**Core Feature:** #12 compliance rules engine (suppression, disclaimers, approval-gating)  
**Module:** compliance rules engine

---

## Purpose

Centralize enforceable compliance rules to eliminate outreach violations and operator overhead. Compliance Reviewer defines suppression lists, jurisdiction-specific disclaimers, and send-time approval gates; the outreach composer enforces them at send-time (pre-send check blocks violating campaigns).

---

## Audience

**Primary:** Compliance Reviewer  
- Role-gated access (post-auth, role check against `user.role == 'compliance'`)  
- No sharing or delegation within this page (rules are firm governance, not collaborative)  
- Typical session: quarterly review + ad-hoc edits when new deal sourcing campaign launches

---

## Entry Points

1. **Left sidebar:** Compliance menu → Settings
2. **Alert override workflow:** Compliance Reviewer clicks "Set rules" from suppression conflict dialog (escalated outreach composer issue)
3. **Campaign approval workflow:** When a Sourcer/Operator marks a campaign "Ready for send," system redirects to Settings if gating policy is "Requires review"

---

## Content Sections

### 1. Suppression / Blocklist Manager
- **Left panel:** Tree of suppression lists (default: "Global block list", "OFAC", "Industry (Healthcare)", user-created lists)
- **Entry form:** "Add suppression entry"
  - Entity name (text input)
  - Reason code (dropdown: `Competitor_Block`, `Legal_Hold`, `OFAC`, `Geographic_Restriction`, `Custom`)
  - Jurisdiction scope (multi-select: US, EU, APAC, Global; defaults to Global)
  - Active toggle (defaults to true; allows "soft delete")
  - Notes field (optional, internal only)
- **List view (main panel):** Sortable/filterable table
  - Columns: Entity name | Reason | Scope | Added by | Date | Status (Active/Inactive)
  - Bulk actions: Archive, Export as CSV
  - Inline edit (click row to edit) or delete button

### 2. Disclaimer-per-Jurisdiction Editor
- **Selector:** Jurisdiction picker (US, EU, UK, APAC, custom region)
- **Content editor:** Rich-text (bold, italic, links allowed; plain text acceptable)
  - Template text: "Outreach message must include: [mandatory text]"
  - Preview pane: Shows how disclaimer renders in outreach email (sample context)
  - Character counter (max 500 chars suggested, no hard limit)
  - Version history toggle: Show prior edits (read-only; shows date, editor, change diff)
- **Save button** triggers validation (no empty disclaimers for active jurisdictions)

### 3. Approval-Gating Policy Config
- **Policy mode selector (radio):**
  - `Off` — no approval required, campaigns send immediately
  - `Campaigns over X recipients` — auto-gate campaigns with > N targets (configurable N, default 500)
  - `All campaigns` — all campaigns require explicit Compliance Reviewer sign-off
- **Approval SLA input:** "Approvals must be granted within X hours" (default 24h; sets expectation for Sourcer/Operator, optional email reminder)
- **Auto-decline rule:** Campaigns that exceed suppression matches by > Y% are auto-declined (default 5%; reviewable, not overrideable)

---

## Interactions

### Flow: Add Suppression Entry
1. Reviewer clicks "Add suppression entry"
2. Modal opens: entity name, reason, jurisdiction, active toggle, notes
3. Reviewer fills, clicks "Save"
4. System validates: entity name must be ≥ 3 chars, reason is required, scope ≥ 1 jurisdiction
5. On success: Entry appended to chosen list; toast "Suppression added"; row animates in
6. On conflict (entity already in list): Toast "Entry already exists in [list name]. Edit the existing entry?" with "View" link

### Flow: Edit Disclaimer
1. Reviewer selects jurisdiction
2. Editor loads current text (or placeholder if empty)
3. Reviewer types/pastes; auto-save on blur (saves every 5s of inactivity)
4. Validation: On save, system checks disclaimer is non-empty for active gating
5. On success: Toast "Disclaimer saved"; version history appends entry
6. On error (empty + gating active): Toast "Jurisdiction has active approval-gating; disclaimer required. Add text or disable gating first."

### Flow: Set Approval Policy
1. Reviewer selects policy mode (radio)
2. If mode = `Campaigns over X recipients`, input field appears (slider or numeric input, 50–5000 range)
3. If mode != `Off`, SLA field appears (numeric hours, 1–168 range)
4. Reviewer clicks "Save policy"
5. System validates: no contradictions (e.g., auto-decline % ≥ 0 and ≤ 100)
6. On success: Toast "Approval policy updated"; system re-evaluates pending campaigns against new policy (background async; no modal wait)

---

## Data Requirements

### Endpoints (Placeholders)

**GET /api/compliance/settings**
- Returns: `{ suppressions: [list], disclaimers: { [jurisdiction]: text }, approval_policy: { mode, threshold, sla_hours, auto_decline_pct } }`

**POST /api/compliance/suppressions**
- Body: `{ entity_name, reason_code, jurisdictions: [string], active: bool, notes: string }`
- Returns: `{ id, created_by, created_at, list_id }`

**PATCH /api/compliance/suppressions/:id**
- Body: `{ active: bool, notes: string }` (or full entity re-send)
- Returns: updated entry object

**DELETE /api/compliance/suppressions/:id**
- Returns: `{ success: bool }`

**PUT /api/compliance/disclaimers/:jurisdiction**
- Body: `{ text: string }`
- Returns: `{ jurisdiction, text, updated_by, updated_at, version }`

**GET /api/compliance/disclaimers/history/:jurisdiction**
- Returns: `[{ text, updated_by, updated_at }, ...]`

**POST /api/compliance/approval-policy**
- Body: `{ mode: "off" | "threshold" | "all", threshold_recipients?: number, sla_hours?: number, auto_decline_pct?: number }`
- Returns: updated policy object

---

## Empty / Error / Loading States

### Empty Suppression List
- **Display:** "No suppression entries yet. Add one to get started."
- **Action:** "Add first entry" button (same as form in main flow)

### Empty Disclaimer for Active Jurisdiction
- **Display:** Yellow alert banner: "Disclaimer for [Jurisdiction] is empty. Outreach to [Jurisdiction] will be blocked unless disclaimer is set."
- **Action:** "Edit disclaimer" link (scrolls to editor)

### Rule Conflict Validation
- **Scenario:** Reviewer tries to set approval-gating `mode=all` while auto-decline % = 0 (contradictory: all campaigns pending review, but none auto-declined)
- **Error:** Toast "Approval-gating mode 'All campaigns' requires auto-decline % > 0. Set a threshold or switch to threshold-based gating."

### Overly Broad Suppression Warning
- **Scenario:** Reviewer adds suppression with jurisdiction = Global, entity name = "Bank" (too generic)
- **Warning dialog:** "This suppression will block any entity matching 'Bank' across all jurisdictions. This may block 100+ targets. Continue?"
- **Actions:** "Refine (edit)" | "Continue" | "Cancel"

### Loading State
- **Spinner:** Centered, with text "Loading compliance rules…"
- **Fallback:** Disable all buttons; show skeleton loaders for list/editor sections

### Network Error
- **Display:** Red banner: "Failed to load compliance settings. Please try again in a moment."
- **Action:** "Retry" button (re-fetches; dismisses banner on success)

---

## Responsive Breakpoints

- **Desktop (1024px+):** Two-column layout: left panel (list picker/controls, 300px fixed) + right panel (editor/table)
- **Tablet (768–1023px):** Single column; list picker collapses to dropdown; editor and table stack vertically
- **Mobile (<768px):** Full-width stacked; modals for add/edit; approve button fixed at bottom

---

## Success Metrics

1. **Rules Enforced at Send-Time:** 100% of outreach campaigns match suppression/disclaimer/gating policy before send (tracked via `outreach_composer.pre_send_checks.compliance_passed`)
2. **Policy Adoption:** ≥80% of compliance reviewers enable at least one approval-gating mode within first month post-launch
3. **Suppression Hit Rate:** Track % of campaigns that hit suppression (trigger "review override" flow); if >15%, alert reviewer to overly broad rules
4. **Disclaimer Coverage:** 100% of active jurisdictions have non-empty disclaimers within 7 days of approval-policy activation
5. **Operator Compliance:** 0 campaigns bypass policy (system prevents send if rule violated); 0 suppression bypasses via UI
6. **Audit Trail:** Every suppression add/edit, disclaimer update, and policy change logged with user + timestamp (reviewer visible in version history)

---

## Competitive Comparison

| **Dimension** | **DealFlow AI** | **Generic Outreach Tools (e.g., HubSpot, Salesforce)** |
|---|---|---|
| **Suppression Rules** | Centralized, role-gated, m2m (entity → multiple jurisdictions), version-tracked | Distributed across user lists; no audit; easy to bypass |
| **Disclaimer Enforcement** | Per-jurisdiction, auto-injected at send-time, edit history | Manual text insertion; user-error prone; no enforcement |
| **Approval Gating** | Policy-driven (threshold, all, off); auto-decline overly broad matches; SLA alerts | Manual approval workflows; no policy guardrails |
| **Compliance-First** | Pre-send validation blocks violating campaigns; no operator override | Post-send corrections; compliance-officer must audit logs |
| **M&A Context** | Rules reflect deal-sourcing constraints (OFAC, geographic gating, competitor blocks) | Generic outreach (no deal context) |


---
**Approved design (v9):** `design/compliance-settings.html`
