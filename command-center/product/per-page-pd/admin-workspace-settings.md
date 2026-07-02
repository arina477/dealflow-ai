# Admin · Workspace Settings (`/admin/settings`)

## Purpose

Centralized hub for workspace administrators to configure the firm's identity, outreach sending domain, and default compliance posture. The page serves as the security and brand perimeter for DealFlow AI: no outreach can originate from the workspace until the sending domain is verified (DKIM/SPF/DMARC), ensuring deliverability and compliance from first message. Default compliance profile configuration cascades to all new mandates, reducing friction for deal teams while maintaining firm-wide baseline rigor.

---

## Audience

**Role-gated:** Admin only (workspace administration permission required).
**Authed state:** Must be a workspace member with `admin` role.
**Session scope:** All actions scoped to the active workspace.

---

## Entry Points

1. **Top navigation:** Settings gear icon → "Workspace settings" (or direct `/admin/settings`).
2. **Onboarding flow:** Mandatory step during workspace setup (F15 workspace & system settings).
3. **Guided banner:** "Sending domain not verified" alert on Deal List / Outreach views when status is incomplete.

---

## Content Sections

### 1. Firm Profile

**Purpose:** Configure the organization's brand identity across all outreach.

**Fields:**
- **Firm Name** (text, required): Legal name of the advisory firm.
- **Logo** (image upload, optional): Square PNG/JPG (200×200–1024×1024px); appears in email headers and platform UI.
- **Headquarters Location** (autocomplete, required): City, country; used in compliance checks and metadata.
- **Website** (URL, optional): Firm's public website; linked in email signatures and metadata.
- **Description** (textarea, optional, max 500 chars): Brief tagline for internal reference and email footer.

**Validation:**
- Firm Name: non-empty, ≤120 chars.
- Logo: max 5MB, min 100×100px.
- Website: valid URL format.

**Interactions:**
- Edit inline; save triggers `PATCH /api/admin/firm-profile`.
- Logo upload: client-side preview before confirm.
- On save: success toast; no redirect.

---

### 2. Sending Identity & Domain Verification

**Purpose:** Establish the verified domain for all outreach; block sending until verification is complete.

**Subheading:** "Outreach Sending Domain"

**Status indicator:**
- ⏳ **Unverified** (default): Red badge; outreach composer shows alert "Domain verification required before sending."
- ✓ **Verified** (DKIM + SPF + DMARC passing): Green badge; outreach enabled.
- ⚠ **Partial** (some records failing): Orange badge; detail view lists failing checks.

**Primary field:**
- **Sending Domain** (email domain input): e.g., `outreach@dealflow.acmecorp.com` → domain extracted as `dealflow.acmecorp.com`.
- Validation: must be a valid domain (regex: `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`); suggest firm website domain if available.

**Verification workflow:**

1. **Input & Save Domain** → Trigger DNS record generation.
   - API: `POST /api/admin/sending-domain` → returns DNS records.
   
2. **Display DNS Records** (copyable, syntax-highlighted):
   - **DKIM Record:** TXT record with signing key (copy-to-clipboard button).
   - **SPF Record:** TXT record (e.g., `v=spf1 include:sendgrid.net ~all`).
   - **DMARC Record:** TXT record at `_dmarc.<domain>` (policy enforcement).
   - Each record includes: record type, hostname (FQDN), value, and TTL recommendation (3600).

3. **Add to DNS:**
   - Provide step-by-step instructions with screenshots (generic provider-agnostic flow + provider-specific tabs for Route53, Cloudflare, GoDaddy, etc.).
   - Copy-to-clipboard for each record value.

4. **Auto-check or Manual Verify:**
   - **Auto-check (recommended):** Poll `GET /api/admin/sending-domain/verify` every 30s for up to 10 min after domain input (with user notification: "Checking DNS records...").
   - **Manual Verify Button:** User clicks "Verify Now" to trigger immediate check.
   - On success: green checkmark per record; "Domain verified" toast; enable outreach.
   - On partial failure: list failing records; suggest retry or support contact.

5. **Verification State Storage:**
   - DB: `workspaces.sending_domain`, `workspaces.sending_domain_verified_at`, `workspaces.dkim_status`, `workspaces.spf_status`, `workspaces.dmarc_status` (enum: `unverified | pending | verified | failed`).

**Error handling:**
- **Domain already in use:** "This domain is registered to another workspace. Contact support."
- **DNS lookup failed:** "Cannot resolve domain. Check spelling and DNS propagation (up to 24h)."
- **Records missing:** List which records failed; highlight the missing ones.
- **Records present but incorrect:** Suggest copy-paste error; link to provider guide.

**Support escalation:**
- Link: "Having trouble? Contact support" (opens support form prefilled with domain + verification status).

---

### 3. Default Compliance Profile

**Purpose:** Set the baseline compliance posture applied to all new mandates; reduces setup friction while maintaining firm-wide rigor.

**Field:**
- **Default Compliance Profile** (dropdown, required):
  - Options: "Standard (EU/UK focused)" | "High (GDPR + FCA strict)" | "Custom" | "None".
  - Each option shows tooltip: rules applied, jurisdictions covered, outreach restrictions.

**Linked to Feature #12 (Compliance Profiles):**
- Clicking a profile name links to `/admin/compliance-profiles` to view/edit shared profiles.
- Profile edits cascade to all mandates using that profile (with audit log entry).

**Validation:**
- At least one profile must exist before saving "None" (prevent workspace with zero compliance).
- On save: `PATCH /api/admin/default-compliance-profile`.

---

### 4. Pilot Workspace (H2 Future Note)

**Type:** Informational callout (gray box, collapsed by default).

**Content:**
> **Coming soon:** Separate isolated workspace for pilot-partner firm. Allows parallel testing of DealFlow AI workflows while keeping production mandates in the main workspace. Contact us to enable.

**Purpose:** Set expectations for MVP; placeholder for roadmap H2 feature.

---

## Interactions

### Edit Firm Profile
- User clicks pencil icon next to field.
- Field becomes editable inline (or modal for image upload).
- Save: `PATCH /api/admin/firm-profile` (autosave after 2s inactivity or explicit save button).
- Success: toast "Firm profile updated"; no hard refresh.

### Verify Sending Domain
- User enters domain, presses Tab or clicks "Continue".
- System generates DNS records, displays them.
- User copies records and adds them to DNS provider.
- User clicks "Verify Now" or waits for auto-check.
- On success: badge turns green; toast "Domain verified"; outreach views clear alert.
- On failure: toast "Verification failed" with reason; offer support link.

### Set Default Compliance Profile
- User opens dropdown, selects profile.
- Tooltip shows profile rules and jurisdictions.
- User clicks "Save."
- Confirmation: "Default profile applied to all future mandates. Existing mandates retain their current profile."
- On save: `PATCH /api/admin/default-compliance-profile`.

### Bulk Actions
- None at MVP; future: bulk domain migration, profile re-assignment.

---

## Data Requirements

### Endpoints

**GET /api/admin/workspace**
- Returns: workspace ID, firm name, logo URL, location, website, sending domain, sending domain verification status, default compliance profile ID.
- Auth: Admin role required.

**PATCH /api/admin/firm-profile**
- Body: `{ firm_name?, logo_url?, headquarters_location?, website?, description? }`
- Returns: updated profile + 200 OK.
- Auth: Admin.

**POST /api/admin/sending-domain**
- Body: `{ domain: "example.com" }`
- Returns: DNS records (DKIM, SPF, DMARC as copyable strings) + record type (TXT, MX, etc.) + polling URL.
- Auth: Admin.
- **Rate limit:** 1 per hour per workspace (prevent spam).

**GET /api/admin/sending-domain/verify**
- Query: `?domain=example.com`
- Returns: `{ verified: bool, dkim: "verified|failed|pending", spf: "verified|failed|pending", dmarc: "verified|failed|pending", details: "..." }`
- Auth: Admin.
- **Polling:** Client polls every 30s for up to 10 min; server caches DNS lookup for 5 min to avoid rate limits.

**PATCH /api/admin/default-compliance-profile**
- Body: `{ compliance_profile_id: "<uuid>" }`
- Returns: updated profile + 200 OK.
- Auth: Admin.

### Data Model
- **Workspaces table:** `sending_domain`, `sending_domain_verified_at`, `dkim_status`, `spf_status`, `dmarc_status`, `default_compliance_profile_id`.
- **Audit log:** Log all changes to workspace settings (firm name, domain, compliance profile).

---

## Empty / Error / Loading States

### Unverified Sending Domain
- **Page state:** "Sending domain not verified" callout (red background, italic text).
- **Outreach impact:** Banner on Deal List, Outreach composer: "Sending domain verification required. [Go to settings]" — link to this page.
- **Verification section:** Expanded, with CTA "Add domain to get started."

### Unverified Domain with Missing Records
- **Display:** List failing records (DKIM, SPF, DMARC) with explanatory text.
- **Call-to-action:** "Retry verification" button + "View provider guide" (context-aware link).
- **Polling UI:** During auto-check: spinner + "Checking DNS records... (est. 1–5 min)."

### Network Error During Verification
- **Message:** "Could not reach DNS servers. Check your internet connection and retry."
- **Retry button:** Enabled.
- **Support link:** "Contact support if the issue persists."

### Loading State (Page Load)
- Skeleton loaders for firm profile fields, domain status badge, compliance profile dropdown.
- No interactions enabled until data loads.
- **Timeout:** After 5s, show "Retry" button + error message.

### Compliance Profile Not Configured
- **Message:** "No default compliance profile set. New mandates will have no default rules. [Select profile]"
- **Resolution:** Dropdown pre-expanded on first load.

### No Firm Logo Uploaded
- **Display:** Placeholder icon (building or gear icon) in logo field.
- **Allow:** User can upload anytime; optional.

---

## Responsive Breakpoints

### Desktop (1200px+)
- Two-column layout:
  - **Left:** Firm Profile + Compliance Profile (sidebar, sticky).
  - **Right:** Sending Domain (full width, scrollable if tall).
- DNS records: table layout (hostname, record type, value in monospace, copy button).

### Tablet (768px–1199px)
- Single column, sections stack.
- DNS records: collapsible rows (hostname visible, value hidden until expanded).
- Copy buttons remain accessible.

### Mobile (< 768px)
- Full-width single column.
- DNS records: card layout (one record per card, value in scrollable code block, copy button sticky).
- Firm profile logo: preview at 120×120px.
- Buttons: full-width, stacked.

---

## Success Metrics

1. **Sending domain verification completion rate:** % of workspaces that complete domain verification within 7 days of workspace creation. Target: ≥85%.
2. **Time-to-verified:** Median time from workspace creation to domain verification. Target: ≤2h (including DNS propagation wait).
3. **Support escalation rate:** % of verification attempts that result in support contact. Target: <5%.
4. **First outreach enabled:** % of workspaces sending their first outreach within 24h of verification. Target: ≥70%.
5. **Compliance profile adoption:** % of mandates using the default compliance profile (vs. custom). Target: ≥80%.
6. **Page load time:** <2s on 3G; <500ms on desktop. Target: 100% of sessions <2s.
7. **Form abandonment:** % of sessions that load the page but do not complete any settings change. Target: <15%.

---

## Competitor Comparison

### Mailchimp / HubSpot (Email Settings)
- **Strength:** Step-by-step DNS wizard with provider-specific guides (Route53, Godaddy tabs). ✓ Implement similar.
- **Weakness:** Auto-verify can take hours; users often unaware. ✓ Mitigate with clear polling UI + in-page notification.

### Slack (Workspace Settings)
- **Strength:** Sidebar navigation to sub-settings (billing, members, apps); firm-wide defaults obvious. ✓ Pattern: future left nav for compliance, team, audit.
- **Weakness:** Settings page is dense; no search. ✓ Keep this page focused (firm + domain + compliance only); spin out billing, members, audit later.

### Salesforce (Email Setup)
- **Strength:** Inline validation; instant feedback. ✓ Auto-verify polling is similar.
- **Weakness:** Domain verification buried in admin > Email > deliverability; hard to find. ✓ Surface domain status prominently; alert on other pages when unverified.

### Unique to DealFlow AI
- **Compliance profile integration:** No competitor (Mailchimp, HubSpot don't tie default email compliance to outreach rules). ✓ Emphasize in onboarding + success metrics.
- **Outreach blocking:** Sending domain verification is hard stop to outreach (not soft warning). ✓ Reduces delivery failures + improves sender reputation from day 1.

---

## Notes

- **Pilot partner workspace (H2):** Placeholder callout; do not build interactive UI yet.
- **Email preview / testing:** Out of scope for MVP; future: "Send test email" button.
- **DNS validation timeouts:** Recommend 24h max wait; after that, escalate to support (DNS may be misconfigured or propagation stuck).
- **Audit log:** Track all changes; link to `/admin/audit` in future.


---
**Approved design (v9):** `design/admin-workspace-settings.html`
