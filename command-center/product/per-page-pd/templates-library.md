# Templates Library — Per-Page Product Document

## Purpose
Provide Analysts/Associates a compliance-first interface to create, edit, and manage reusable outreach templates for M&A opportunities. Templates enforce required compliance blocks (disclaimer, opt-out language) before submission to Compliance Reviewers for approval. AI-assisted drafting accelerates template authoring while maintaining regulatory guardrails.

## Audience & Roles
- **Analysts/Associates** (authors): Create and draft templates; insert dynamic merge fields; request compliance approval. Can edit own drafts; cannot approve.
- **Compliance Reviewers** (gatekeepers): Review submitted templates; approve or reject with feedback. Cannot edit templates directly.
- **Guest roles**: Read-only access to approved templates library (if later extended to deal teams).

All authenticated users; role-gating enforced at endpoint level and UI.

---

## Entry Points
1. **Left sidebar** → "Templates" nav link → `/templates` (list view)
2. **+New Template** button → `/templates/new` (editor, new mode)
3. **Template list row** → Click template name → `/templates/:id` (editor, edit mode)
4. **Contextual** (F8): Outreach workflow may link to "Use template" → `/templates/:id?mode=use` (read-only preview before insertion)

---

## Content Sections

### Section 1: Template List (`/templates`)
**Layout:** Table or card grid with filtering/search.

- **Columns/Fields:**
  - Template name (text, clickable → editor)
  - Category/use case (dropdown: "Buyer intro", "Seller warm-up", "Follow-up", "Custom") — optional tag
  - Status badge: **Draft** (pencil icon, yellow), **Approved** (checkmark, green), **Rejected** (X, red), **In Review** (hourglass, orange)
  - Last modified date
  - Author name
  - Actions: Edit (pencil), Duplicate (copy icon), Delete (trash, draft-only), View details (expand)

- **Filters:** Status (Draft / Approved / In Review / Rejected), Category, Author (me / all), Date range
- **Search:** Full-text search on template name + snippet preview
- **Empty state:** "No templates yet. Create your first template to get started." → link to +New Template
- **Loading state:** Skeleton cards (3–5 placeholder rows)

### Section 2: Template Editor (`/templates/new` and `/templates/:id`)
**Split-screen layout:** Left = editor, right = live preview.

#### Left Panel: Editor (60%)
- **Header:**
  - Template name input (required, max 100 chars)
  - Category dropdown (required)
  - Status badge (read-only; e.g., "Draft — saved as draft")
  - Mode indicator: "New" or "Editing" or "Reviewing"

- **Body Editor:**
  - Rich-text input area (supports bold, italic, links; plain text acceptable)
  - Paste or type template body
  - **Merge fields toolbar:** Buttons to insert placeholders: `{{dealName}}`, `{{buyerName}}`, `{{sellerName}}`, `{{companyName}}`, `{{industry}}`, `{{dealValue}}`, `{{yourName}}`, `{{date}}`
  - AI-assist button: "Generate with AI" → opens modal, accepts prompt (e.g., "Draft a warm buyer intro for SaaS M&A, friendly tone")
    - AI generates 2–3 variants; author selects one to seed editor
    - Note: "AI-generated text must be reviewed and edited for accuracy before submission."

- **Required Compliance Blocks (collapsible sections):**
  - **Disclaimer block** (required): Pre-populated template text with editor's ability to customize within guardrails
    - Default: "This communication is for authorized recipients only and may contain confidential information. If you are not the intended recipient, please delete."
    - Toggle: "Use default" / "Customize"
    - Character count; min/max enforced by compliance rules engine
  - **Opt-out block** (required): Pre-populated unsubscribe / do-not-contact language
    - Default: "To unsubscribe from future communications, reply with STOP."
    - Validation: Must include active unsubscribe mechanism (STOP, link, or email)
  - **Visual indicator:** Green checkmark if both blocks present and valid; red warning if missing or invalid
    - Tooltip: "Compliance blocks required before submitting for review"

#### Right Panel: Live Preview (40%)
- Real-time rendering of template as it will appear in outreach (if sent)
- Merge fields shown as placeholders: `[dealName]`, `[buyerName]`, etc.
- Compliance blocks highlighted in light gray box to show they render correctly
- Preview scrollable; matches mobile responsiveness (shown at 375px width)

#### Bottom Actions:
- **Save Draft** button (always available): Saves template as "Draft" without compliance review
- **Submit for Approval** button (enabled only if both compliance blocks valid): Moves template to "In Review" status; notifies Compliance Reviewer queue
- **Discard** button (new templates only, or drafts): Discards unsaved changes / deletes draft
- **Cancel** button: Returns to `/templates` without saving

#### Validation & Error States:
- Template name empty: "Template name required"
- Disclaimer missing: "Disclaimer block is required. Add or restore the default."
- Opt-out missing: "Opt-out block is required. Add or restore the default."
- Compliance block validation failed (e.g., opt-out without active unsubscribe): Red inline error, explains fix
- Cannot submit while errors present: "Submit for Approval" button disabled, tooltip explains blockers

---

## Interactions & User Flows

### Create New Template
1. Click "+New Template" → `/templates/new`
2. Populate name, category, body text
3. Click "Insert merge field" → select placeholder → auto-inserted at cursor
4. (Optional) "Generate with AI" → prompt modal → select variant → seeds editor
5. Confirm both compliance blocks present (auto-seeded with defaults)
6. Edit compliance text if needed
7. Click "Submit for Approval" → template transitions to "In Review"; confirmation toast; redirects to `/templates`

### Edit Approved Template (to create variant)
1. `/templates/:id` (approved template)
2. "Edit" button disabled for approved templates; instead: "Duplicate" button creates a draft copy
3. Edit copy; submit as new template

### Resubmit After Rejection
1. `/templates/:id` (rejected template)
2. "Edit" button enabled; shows rejection feedback in collapsible section above editor
3. Author revises; clicks "Resubmit for Approval"

### Compliance Reviewer Approval Workflow
1. Reviewer sees "In Review" templates in list (or dedicated review queue at `/compliance/review`)
2. Opens template → `/templates/:id?role=reviewer` (editor read-only; approval panel on right)
3. Reviews body, merge fields, compliance blocks
4. Approves → template transitions to "Approved"; all team members can now use
5. Rejects with reason → author notified; template reverts to "Draft" (can re-edit)

### Use Template (from F8 Outreach Workflow)
1. Outreach flow opens template picker
2. Author selects approved template → `/templates/:id?mode=use` (read-only preview)
3. Template renders with merge fields still as placeholders
4. Author clicks "Use This Template" → template body + compliance blocks auto-populated in outreach draft (F8 forms merge fields with deal context)

---

## Data Requirements & Endpoints

### Key Entities
```
Template {
  id: UUID
  name: string (max 100)
  category: enum ("Buyer intro" | "Seller warm-up" | "Follow-up" | "Custom")
  body: string (rich text / markdown)
  complianceBlocks: {
    disclaimer: { text: string, customized: boolean }
    optOut: { text: string, customized: boolean, validationStatus: "valid" | "invalid" }
  }
  status: enum ("Draft" | "In Review" | "Approved" | "Rejected")
  rejectionReason?: string
  aiGenerated: boolean
  authorId: UUID
  createdAt: ISO8601
  updatedAt: ISO8601
  submittedForReviewAt?: ISO8601
  reviewedBy?: UUID (reviewer ID)
  reviewedAt?: ISO8601
}
```

### Placeholder Endpoints (to be mocked/stubbed in F8 implementation)
- `GET /api/templates` — List all templates; filter by status, category, author
- `POST /api/templates` — Create draft template
- `GET /api/templates/:id` — Fetch single template + related approvals
- `PATCH /api/templates/:id` — Update template (body, compliance blocks, name)
- `POST /api/templates/:id/submit-for-review` — Transition "Draft" → "In Review"
- `POST /api/templates/:id/approve` — Compliance Reviewer approves (→ "Approved")
- `POST /api/templates/:id/reject` — Compliance Reviewer rejects with reason (→ "Draft" + feedback)
- `POST /api/templates/:id/duplicate` — Clone approved template as new draft
- `DELETE /api/templates/:id` — Delete draft or rejected template (not approved)
- `POST /api/templates/ai-generate` — AI-assist endpoint; accepts prompt, returns 2–3 variant texts
- `POST /api/templates/:id/compliance-validate` — Validate compliance blocks; returns status + errors

---

## Empty, Error & Loading States

### Empty States
- **No templates**: "No templates yet. Start by creating your first template." → +New Template button
- **No approved templates** (in use picker): "No approved templates available. Ask your team lead to create one." (if user is non-author)
- **No drafts** (author view): "You haven't created any templates yet." (still shows approved templates authored by others, read-only)

### Loading States
- **List loading**: Skeleton cards (3–5 rows) with pulsing shimmer
- **Template loading** (editor): Skeleton form with placeholder text fields
- **AI generation in progress**: Spinner + "Generating variants..." + ability to cancel
- **Compliance validation**: Inline spinner on block (when user edits compliance text)

### Error States
- **Missing required compliance block**:
  - Visual: Red border around compliance section
  - Message: "Disclaimer and opt-out blocks are required. Add them before submitting."
  - Action: "Restore default" button restores pre-filled text for that block
- **Invalid opt-out** (e.g., no unsubscribe mechanism):
  - Message: "Opt-out block must include a way to unsubscribe (STOP reply, link, or email)."
  - Suggestion: "Example: 'Reply STOP to unsubscribe.'"
- **Cannot submit while editing** (if compliance just added):
  - Button disabled, tooltip: "Compliance blocks must be finalized before submission."
- **Network error on save**: Toast + "Saving failed. Retry?" (auto-retry after 3s)
- **Rejection feedback**: Shown in orange callout when template re-opened after rejection
  - "Rejection reason: Missing unsubscribe link in opt-out block. Please revise and resubmit."

---

## Responsive Breakpoints

- **Desktop (1024px+)**: Split-screen editor (60% left, 40% right preview), full toolbar
- **Tablet (768px–1023px)**: Stacked editor above preview; preview collapses to tab ("Live Preview")
- **Mobile (< 768px)**: Full-width editor; preview hidden (link to "Show preview"); toolbar icons only (labels on hover)
- **Preview pane (all breakpoints)**: Always renders at 375px width (mobile email standard) to show responsive rendering

---

## Success Metrics
- **Adoption**: % of active users who create or use ≥1 template within 30 days (target: 60%)
- **Compliance gate**: % of submitted templates approved on first review (target: >80%; indicates effective default blocks + AI assist guidance)
- **Time-to-submit**: Avg time from template creation to submission (target: <10 min; AI-assist reduces this)
- **Template reuse**: Avg uses per approved template per quarter (target: >3 uses/template, indicating utility)
- **Rejection rate**: % of submissions rejected by Compliance (target: <20%; high rejections → refine defaults or AI prompt engineering)
- **Engagement**: Templates created by Analysts vs. Compliance-authored defaults (target: >40% user-created)

---

## Competitor Comparison

| Feature | DealFlow AI | Generic Email Tools | Specialized Deal Software |
|---------|------------|-------------------|------------------------|
| **Reusable templates** | ✓ | ✓ | ✓ |
| **Merge fields** | ✓ M&A-specific | ✓ Generic | ✓ Deal-aware |
| **Required compliance blocks** | ✓ Enforced (disclaimer + opt-out) | ✗ Optional/none | ~ Optional/weak |
| **Compliance approval gate** | ✓ Reviewer workflow | ✗ | ~ Manual review only |
| **AI-assisted drafting** | ✓ M&A tone + templates | ✓ Generic AI | ~ Limited |
| **Audit trail** | ✓ Who created, who approved, when | ~ Basic | ✓ |
| **Role-based editing** | ✓ Author/Reviewer split | ✗ | ✓ |
| **Pre-filled defaults** | ✓ Compliance-first baseline | ✗ | ✓ |
| **Rejection feedback loop** | ✓ Author can revise in-app | ~ Email-based | ✓ |

**Competitive moat**: DealFlow enforces compliance blocks as a **must-have before outreach**, not an afterthought. AI assists authoring, but reviewers control final approval. This eliminates compliance risk in outreach while accelerating deal sourcing.


---
**Approved design (v9):** `design/templates-library.html`
