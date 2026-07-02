# PD: New / Edit Mandate

**Page:** `/mandates/new` (also `/mandates/:id/edit`)  
**Module:** Mandate Service  
**Feature:** #4 Mandate Management  
**Personas:** Advisor, Deal Lead  
**Primary Flow:** F1 (Create & Configure Sell-Side Mandate)

---

## Purpose

Enable advisors to rapidly create and configure sell-side mandates—defining the asset (target company), buyer criteria, and compliance guardrails in a single workflow. On save, the mandate enters "Sourcing" status and becomes eligible for AI buyer-seller matching. This page is the entry point for all sell-side engagement setup in DealFlow.

---

## Audience

**Authentication & Role Gating:**
- Authenticated users only (JWT required)
- Role gating: `advisor` or `deal-lead` roles
- Team-scoped access (user can only create/edit mandates within their assigned firm/team)
- Suppress page for read-only users and non-advisor roles

**Entry Points:**
1. **New:** Sidebar / main nav "New Mandate" button → `/mandates/new` (blank form)
2. **Edit:** Mandate detail page "Edit" button or inline edit trigger → `/mandates/:id/edit` (pre-populated form, unlocked if mandate not in "Closed" or "Won" terminal status)
3. **Template flow:** Post-creation offer "Start another mandate" → `/mandates/new?template=<mandate_id>` (pre-fills buyer criteria & compliance profile from selected template)

---

## Content Sections

### Section 1: Seller / Target Profile

**Purpose:** Define the asset being sold.

**Fields:**
- **Company Name** (text, required)
  - Placeholder: "Acme Manufacturing Inc."
  - Real-time: check duplicates (within user's team, last 90 days) → show `[!] Mandate for this company exists: [Mandate ID] [View]` warning inline
- **Industry / Sector** (dropdown + autocomplete, required)
  - Source: controlled taxonomy (Tech, Health, Finance, Industrials, Consumer, Energy, Real Estate, etc.)
  - Allow freetext entry with "Add custom" option (marked `[Custom]` in list)
- **Geography** (multi-select dropdown, required)
  - Preset: North America, Europe, APAC, select countries
  - Allow multi (company has ops in multiple regions)
- **Company Size** (radio or dropdown, required)
  - Options: < $10M revenue | $10M–$50M | $50M–$250M | $250M–$1B | $1B+ | Unknown
- **Target Financial Profile** (optional free-form / structured)
  - Collapsible: Revenue ($ range), EBITDA ($ range), Headcount, Growth rate (YoY %), Profitability (Yes/No)
  - Optional; used for AI buyer matching refinement
- **Deal Thesis** (textarea, optional)
  - Placeholder: "Family-owned, profitable, seeking liquidity. Strong margins, recurring revenue, de-risked customer base."
  - Max 500 chars; visible to all authorized users on mandate detail
- **Contact Name & Email** (text fields, optional)
  - Primary seller contact on the engagement
  - Email validation (on blur)

**State:** Collapsible / stepper-style UI; Section 1 is always visible on load; proceed to Section 2 only after all required fields in Section 1 are filled (visual cue: button highlights on completion).

---

### Section 2: Buyer Criteria

**Purpose:** Define who can be matched to this mandate.

**Fields:**
- **Buyer Type** (checkboxes, required; at least one)
  - Strategic Buyer (corporate)
  - Financial Buyer (PE, growth equity, hedge fund)
  - Institutional Buyer (family office, sovereign fund)
  - Mixed / Agnostic (allow all types)
- **Ideal Check Size** (optional range slider or text inputs)
  - Min / Max: $1M–$5B+
  - Format: $ millions or billions
- **Sector Focus / Strategic Fit** (multi-select dropdown, optional)
  - Options: adjacent to seller's sector, vertically integrated, horizontal rollup, financial engineering, operational consolidation
  - Free-text field: "Notes on buyer fit" (textarea, max 300 chars)
- **Geography Restrictions** (multi-select, optional)
  - Default: unrestricted
  - Options: Must be based in [region], Prefer [region], Exclude [region/country]
- **Deal Complexity Tolerance** (radio, optional; defaults to "Medium")
  - Introductory (simple add-on, no synergies needed)
  - Medium (bolt-on roll-up, routine DD)
  - Complex (turnaround, integration-heavy, cross-border)

**State:** Collapsible / Step 2; becomes enabled after Section 1 is complete. Display summary of buyer criteria as a readable pill/tag block on the right side of the form (live preview as user checks/selects).

---

### Section 3: Compliance Profile

**Purpose:** Embed compliance guardrails before AI sourcing runs.

**Fields:**
- **Jurisdiction(s)** (multi-select, required)
  - Options: US (federal), State-level (CA, NY, TX, etc.), EU, UK, Canada, APAC, Custom
  - Used to filter buyers by domicile and scope legal diligence workflows
- **Suppression List / Conflict Check** (multi-select or file upload, optional)
  - Preset lists: (tie to firm's internal conflict DB if available)
    - Company names to exclude
    - Buyer families / affiliated entities to exclude
    - Specific buyer names to flag (yellow warning, not block)
  - Option: Upload CSV of blocked companies / buyers
  - Validation: If upload, parse CSV and show `[N] rows parsed. [M] conflicts already in DB. [X] new entries added.`
- **Disclaimers & Risk Acknowledgments** (checkboxes, required)
  - [ ] I confirm this engagement is lawfully authorized by the seller.
  - [ ] I understand buyer-matching results are AI-generated and must be validated before outreach.
  - [ ] I acknowledge [firm's] data handling and privacy policy (link to firm's policy).
  - [ ] I have reviewed the suppression list and conflict flags above.
  - All checkboxes must be ticked to enable Save
- **Notes to Compliance Team** (textarea, optional)
  - Free-form field; visible only to advisor + firm's compliance officer
  - Max 500 chars
  - Example: "Cross-border regulatory approval required; expect 60-day lag."

**State:** Collapsible / Step 3; becomes enabled after Section 2. Compliance errors (missing checkboxes, invalid jurisdiction) block Save.

---

### Section 4: Review & Save

**Purpose:** Final review before mandate entry.

**Content:**
- **Read-only summary card** (scrollable if needed):
  - Seller / Target: Company Name | Industry | Geography | Size | Thesis snippet
  - Buyer Criteria: Buyer types | Check size range | Sector fit | Geography fit
  - Compliance: Jurisdiction(s) | Suppression count | Conflict flags
- **Action buttons:**
  - **[Save & Activate Mandate]** (primary, full width)
    - Disabled until all required fields filled + all checkboxes ticked
    - Loading state: spinner + "Saving mandate..."
    - On success: toast "Mandate [Name] created successfully. Sourcing will begin shortly." → redirect to mandate detail (`/mandates/:id`) with status badge "Sourcing [In Progress]"
  - **[Save as Draft]** (secondary; only in new flow, not edit)
    - Saves mandate in "Draft" status (not eligible for matching until activated)
    - Confirmation: "This mandate will not appear to buyers until activated. Activate later from mandate detail."
  - **[Cancel]** (tertiary)
    - On new: return to mandates list
    - On edit: return to mandate detail (discard unsaved changes)

---

## Interactions

**Form Behavior:**
- **Progressive disclosure:** Sections collapse/expand; Section 1 always visible; Sections 2–3 unlock after prior section completion
- **Real-time validation:**
  - Required fields: on blur, show `[Required field]` if empty (red text)
  - Email: on blur, validate format → show error if invalid
  - Duplicate mandate: on blur of Company Name, check server; show inline warning if found
- **Autosave drafts:** Every 30 seconds, silently autosave form state to localStorage; on return to page, offer "Resume draft: [Company Name] last saved [timestamp]?" with buttons [Resume] / [Start Fresh]
- **Conflicting criteria detection:** If buyer criteria contradicts target profile (e.g., "Exclude North America" but target is NA-only), show yellow warning: `[!] Buyer criteria may exclude all suitable buyers given target geography. Review?`
- **Mobile behavior:** Stack sections vertically; condense buyer criteria summary to a badge count ("4 buyer types selected"); modal-style Save confirm on small screens

---

## Data Requirements

**Endpoints (Placeholder):**
- `POST /api/mandates` (create new)
- `GET /api/mandates/:id` (fetch for edit, pre-populate form)
- `PUT /api/mandates/:id` (save edit)
- `GET /api/mandates/check-duplicate?company_name=X&team_id=Y` (real-time duplicate check)
- `GET /api/compliance/suppression-lists?jurisdiction=X` (fetch default suppression lists)
- `POST /api/mandates/:id/activate` (convert Draft → Sourcing, trigger matching job)

**Request body (POST / PUT):**
```yaml
mandate:
  company_name: string
  industry: string
  geography: [string]
  company_size: enum
  financial_profile: {revenue_range, ebitda_range, headcount, growth_rate}
  deal_thesis: string
  contact_name: string
  contact_email: string
  buyer_type: [enum]
  check_size_min_usd: number
  check_size_max_usd: number
  sector_focus: [string]
  buyer_geography: [string]
  complexity_tolerance: enum
  jurisdiction: [string]
  suppression_list: [string] # company names or buyer IDs
  compliance_notes: string
  status: enum # "draft" | "sourcing" | "paused" | "closed" | "won"
  created_at: timestamp
  updated_at: timestamp
```

---

## Empty / Error / Loading States

**Blank new mandate:**
- Page loads with all sections collapsed except Section 1
- Heading: "New Mandate"
- Subheading: "Step 1: Target Company Profile"
- Section 1 fully expanded, other sections grayed out with label "Complete Section 1 to proceed"
- Save buttons disabled with tooltip "Fill all required fields to continue"

**Incomplete required field:**
- Field border turns red on blur (if empty)
- Error text below field: `[!] This field is required`
- Save button remains disabled; tooltip updates to "Fill all required fields in [Section X]"

**Duplicate mandate warning:**
- On blur of Company Name, if duplicate found: yellow alert box in Section 1
  - `[!] A mandate for Acme Manufacturing was created on June 15, 2026 [View existing] | [Continue anyway]`
  - "View existing" opens existing mandate in new tab
  - "Continue anyway" dismisses warning, allows save

**Conflicting buyer criteria:**
- Yellow warning banner in Section 2 (appears after buyer geography set)
  - `[!] Buyer criteria may exclude all suitable buyers. You've set "Exclude North America" but target is 100% NA. Review?`
  - Dismiss button or auto-dismiss on edit

**API error on save:**
- Toast error (top-right, 4s timeout): "Error saving mandate. Please try again or contact support."
- Button reverts to enabled state; form data retained
- If server returns 409 (conflict), show: `[!] This mandate was recently modified. [Reload] to see latest version.`

**Compliance checkpoint (missing checkbox):**
- Before Save, if checkbox unchecked, prevent submit
- Error banner: `[!] Please acknowledge all compliance terms before saving.` (point to unchecked box with red highlight)

**Loading state (on Save click):**
- Save button: spinner icon + "Saving mandate..."
- Form inputs disabled (grayed out)
- Modal overlay (semi-transparent, non-dismissible)
- If save takes >3s, show additional message: "Still saving... This may take a moment."

**Empty suppression list:**
- If user uploads CSV with 0 rows or all invalid: toast "CSV is empty or all rows invalid. Please check format and try again."
- Field retains focus for re-upload

---

## Responsive Breakpoints

**Desktop (1024px+):**
- Two-column layout: Form (70%) on left, Live Preview / Summary card (30%) on right
- Sections expand inline; buyer criteria summary updates in real-time on right panel
- Tooltips on hover over field labels

**Tablet (768–1023px):**
- Single column, stacked sections
- Live Preview card collapses into a summary toggle ("View summary")
- Dropdowns and checkboxes full-width

**Mobile (< 768px):**
- Single column, full-width stacked sections
- Collapsible section headers with expand/collapse icons
- Save / Cancel buttons fixed at bottom (sticky footer)
- Buyer criteria summary is badge-count ("4 selected") tappable to expand inline
- File upload for suppression list: simplified ("Attach file" button, no preview until uploaded)

---

## Success Metrics

- **Mandate creation rate:** # mandates created / week (goal: 15+ new mandates/week per firm)
- **Form completion time:** Median time from page load to Save (target: < 8 min for first mandate, < 4 min repeat)
- **Abandonment rate:** # sessions starting new mandate / # completed saves (target: < 30%)
- **Duplicate prevention:** # duplicate-mandate warnings shown / # dismissed vs. caught (measure efficacy of real-time check)
- **Compliance checkpoint success:** # mandates saved with all checkboxes ticked / # submissions (target: 100%)
- **Mandate activation (Draft → Sourcing):** % mandates activated within 24h of creation (target: > 85%)
- **Buyer match quality:** % mandates receiving 5+ qualified buyer matches within 48h of activation (target: > 70%)
- **Form field error rate:** # form validation errors per session (track which fields trip up advisors)

---

## Competitor Comparison

| Aspect | **DealFlow** | **Typical M&A SaaS** (e.g., Datasite / Intralinks) |
|---|---|---|
| **Mandate setup** | Single integrated form (seller profile + buyer criteria + compliance in one flow); AI-driven buyer matching auto-triggers on save | Multi-step wizards or document uploads; manual buyer list configuration |
| **Real-time validation** | Duplicate mandate check, conflict detection, suppression list validation inline as user types | Batch checks on submission; often generates conflict reports post-upload |
| **Compliance integration** | Checkboxes + jurisdiction scoping + conflict-aware suppression; baked into form flow | Separate compliance review step; requires manual approval layer |
| **Template support** | Reuse buyer criteria + compliance from past mandate to bootstrap new ones | Limited or requires manual copy-paste |
| **Mobile experience** | Full-featured on tablet / mobile; sticky action buttons, collapsible sections | Often desktop-first; mobile is view-only or limited |
| **Speed to mandate activation** | <5 min for experienced advisor; AI matching starts immediately on save | 15–30 min (including doc assembly, conflict review, signoff) |



---
**Approved design (v9):** `design/mandate-new.html`
