# Page PD: Audit Log & Recordkeeping Export (Compliance-Defensible Records)

**Route:** `/compliance/audit-log`  
**Personas:** Compliance Reviewer, Compliance Officer, Audit Lead  
**Related flows:** F11 (audit log review & recordkeeping export), F10 (compliance queue review), F3 (outreach send)  
**Features addressed:** #10 (tamper-evident audit log), #13 (recordkeeping export), #15 (auth+RBAC)  
**Modules involved:** audit-log service (append-only, integrity hashes), export module, compliance-rules-engine  

---

## Purpose

The Audit Log & Recordkeeping Export page is the defensible-records wedge that makes DealFlow AI regulatorily air-tight. It surfaces the immutable, cryptographically verified log of every communication decision, compliance review, and outreach event (timestamp, sender, recipient, message content hash, compliance verdict, approval chain). Compliance Reviewers and Audit Leads browse, filter, and verify log integrity (hash chain validation), then export mandate-scoped or time-range-scoped packages in FINRA/SOX-compliant format for internal retention or regulatory response. This separates DealFlow AI from competitors: ungoverned tools (Hunter.io, Apollo.io, RocketReach) leave advisors with scattered Gmail logs and no audit trail; DealFlow's tamper-evident outreach logging tied to the compliance decision engine means every send is defensible by design—auditors see who sent what, to whom, when, with what compliance verdict, approved by whom.

---

## Audience & Access Control

**Authed users only.** Role-gated per RBAC (`#15: auth+RBAC`):
- **Compliance Reviewer** (primary): browse full audit log; filter by mandate/date/sender; verify integrity; export packages for their assigned mandates.
- **Compliance Officer** (primary): browse organization-wide audit log; export for firm-wide retention; respond to regulatory requests.
- **Audit Lead** (secondary): read-only access to audit log; export for internal audit and risk assessment.
- **Advisor/Deal Lead** (secondary): view-only access to audit log entries related to their own outreach (for personal record-keeping); no export rights.
- **Admin**: full access to all logs; can export any mandate; access to integrity diagnostics.

**Deny:** unauthenticated users, roles below analyst tier (except as noted above for limited Advisor visibility), non-compliance personnel.

---

## Entry Points

1. **Primary:** Main nav → "Compliance" → "Audit Log" (routes to `/compliance/audit-log`).
2. **Secondary:** Compliance Queue (F10) → individual campaign/outreach record → "View full audit trail" link (routes to `/compliance/audit-log?campaign_id=<uuid>`).
3. **Tertiary:** Mandate Detail → "Compliance & Records" tab → "View audit log" link (routes to `/compliance/audit-log?mandate_id=<uuid>`).
4. **Regulatory:** Admin → "Regulatory Response" → "Prepare audit export" (routes to `/compliance/audit-log?mode=export` with export panel pre-open).

---

## Content Sections

### 1. **Header & Global Controls**
- **Page title:** "Audit Log & Recordkeeping"
- **Role badge:** "Compliance Reviewer — [Firm Name]" or "Audit Lead" (indicates access scope).
- **Export panel button (primary action):** "Export recordkeeping package" (toggles export panel on the right; see section 7 below).
- **Integrity status indicator (top-right):** Green checkmark "All entries verified" or red alert "X anomalies detected" (linked to integrity diagnostics).
- **Last updated timestamp:** "Log last updated: 2 minutes ago" (shows freshness; polling interval: 30s if log is active).

---

### 2. **Filterable Immutable Log Table**
The centerpiece: a browsable, sortable, filterable log of every compliance-relevant event.

**Columns (desktop; subset on mobile per breakpoints below):**
- **Timestamp** (sortable DESC by default): ISO 8601 format with timezone (e.g., "2026-07-15 13:47:32 UTC"). Shows relative time on hover (e.g., "2 hours ago").
- **Event type** (filterable): pill badges with icons:
  - `outreach_send` (blue): message sent to buyer
  - `outreach_schedule` (light blue): message scheduled for future send
  - `compliance_check` (orange): pre-send compliance check run (PASS/FAIL/WARN verdict)
  - `approval_submit` (yellow): campaign submitted to compliance queue (F10)
  - `approval_decision` (green or red): compliance reviewer approved or rejected
  - `suppression_rule_update` (purple): compliance rules change (e.g., new suppression rule added)
  - `integrity_anomaly_detected` (red, high-priority): log integrity issue flagged (see error state below)
- **Mandate name** (filterable): linked to mandate detail; text field for search.
- **Campaign ID** (sortable): truncated UUID with copy-to-clipboard icon; linked to campaign detail (if accessible by role).
- **Sender / Actor** (filterable): name + email of user who initiated action (e.g., "Alice Chen <alice@advfirm.com>"); for system actions, shows "System".
- **Recipient / Target** (filterable): for outreach events, email of recipient (e.g., "sarah.chen@techcorp.io"); for approval events, "Compliance Queue"; for rule updates, "All outreach".
- **Message / Action summary** (sortable, clickable for detail): truncated text describing the action:
  - Outreach send: "Email sent to [recipient]: '[subject line]'" (truncated to ~60 chars)
  - Compliance check: "Check run: PASS" / "Check run: FAIL (3 recipients flagged)" / "Check run: WARN"
  - Approval decision: "Approved by Jane Liu" / "Rejected: Message too broad"
  - Suppression update: "Added 2 emails to blocklist (GDPR)"
- **Content hash / Integrity stamp** (sortable, clickable): displayed as truncated SHA-256 hash (e.g., "a3f7b2...") with checkmark or warning icon:
  - ✓ Green checkmark: hash verified; entry matches signed chain.
  - ⚠ Yellow warning: hash unverified (older log entries pre-hash migration; no block, but flagged).
  - ✗ Red alert: hash mismatch; entry tampered or corrupted (high-priority; linked to integrity diagnostics).
- **Metadata / Notes** (clickable for detail): system-generated compliance metadata:
  - Outreach send: "Approved by compliance? yes/no" (if gating enabled)
  - Compliance check: "Pass verdict" or "Fail reasons: [list]" (truncated; full on expand)
  - Approval decision: "Reviewer notes: [text]" (truncated; full on expand)

**Sorting:**
- Default: Timestamp (DESC; newest first)
- Sortable: Timestamp, Event type (grouped), Sender, Message/Action, Content hash

**Expandable rows (click anywhere to expand):**
- **Full content detail panel (on expand):**
  - Full timestamp + timezone
  - Full sender identity (email + user ID)
  - Full recipient email (if applicable)
  - Full message subject + body (if outreach event; HTML-rendered)
  - Full compliance verdict details (if check event): per-recipient flags, blocking reasons, rule matches
  - Full reviewer notes (if approval event)
  - Full rule change description (if suppression event)
  - **Integrity detail section (expandable within row detail):**
    - Full SHA-256 hash of this entry
    - Previous entry's hash (for chain validation)
    - Signature / verification status (✓ Valid | ✗ Invalid)
    - "Verify integrity chain" link (runs crypto check; see section 6 below)
  - **Audit metadata:**
    - Entry ID (UUID)
    - Source system (e.g., "outreach-engine", "compliance-rules-engine", "web-ui")
    - IP address of actor (if applicable; masked for privacy)

---

### 3. **Smart Filters & Search**

**Filter panel (sidebar or collapsible):**

- **Mandate filter** (multi-select dropdown):
  - List of all mandates in system (or mandates accessible to current user's role).
  - Search-within-dropdown to find mandate by name.
  - Counts next to each mandate: "(45 events)" showing # of audit log entries for that mandate.
  - Default: all mandates (unrestricted for compliance officers; restricted to user's mandates for reviewers).

- **Date range filter** (required for export, optional for browse):
  - Start date (picker) + End date (picker).
  - Shortcuts: "Last 24 hours", "Last 7 days", "Last 30 days", "This month", "This quarter", "Custom range".
  - Default on page load: "Last 30 days".

- **Event type filter** (multi-select checkboxes):
  - [ ] Outreach sends
  - [ ] Compliance checks
  - [ ] Approval decisions
  - [ ] Suppression rule updates
  - [ ] Integrity anomalies
  - Default: all selected.

- **Sender filter** (text search or dropdown):
  - Search by name or email.
  - Autocomplete suggestions (from recent senders in visible date range).
  - Option to filter to "Current user only" (quick filter for personal review).

- **Verdict filter** (radio buttons or multi-select):
  - ◉ All verdicts
  - ◉ PASS (compliance checks only)
  - ◉ FAIL (compliance checks only)
  - ◉ WARN (compliance checks only)
  - ◉ Approved (approval decisions only)
  - ◉ Rejected (approval decisions only)

- **Recipient / Email filter** (text search):
  - Search by recipient email or company domain.
  - Autocomplete suggestions from log.

- **Integrity status filter** (radio buttons):
  - ◉ All entries
  - ◉ Verified entries only (✓ hash match)
  - ◉ Anomalies detected (✗ hash mismatch or ⚠ unverified)

- **Search box (global, at top):**
  - Free-text search across: mandate name, sender email, recipient email, message content (subject line), reviewer notes.
  - Real-time autocomplete suggestions.
  - Clears all filter state on clear; persists date range + mandate filter.

**Apply/Reset buttons:**
- "Apply filters" (sticky at bottom of filter panel; disabled if no changes).
- "Reset filters" (clears all filters back to default).

---

### 4. **Integrity Status Indicator & Anomaly Alerts**

**Top-of-page integrity badge (section 1):**
- **Normal state:** Green checkmark + "All entries verified" + count "(1,247 entries verified in last 30 days)"
- **Warning state:** Yellow warning icon + "X entries unverified" + explanation "Pre-migration entries lack hashes; no action needed."
- **Critical state:** Red alert icon + "X anomalies detected" + action link "View integrity report"

**Anomaly detail (linked from badge):**
- **Modal / side panel:** "Integrity Diagnostics"
  - Breakdown of anomaly types:
    - Unverified entries (hash missing; historical; non-blocking): count + date range
    - Hash mismatches (entry tampered): count + linked list of entry IDs + "Export for forensics" button
    - Chain breaks (integrity chain severed): count + explanation
  - Action buttons:
    - "View entries with anomalies" (filters log to show only anomalies)
    - "Export forensic report" (includes crypto details + chain state for investigation)
    - "Contact support" (for critical anomalies; pre-fills ticket with diagnostics)

---

### 5. **Per-Record Detail Panel**

When user clicks on any log row, an expandable detail panel slides out (or modal opens on mobile):

**Detail panel layout:**
- **Timestamp + Event type badge** (header)
- **Full record data:**
  - Sender identity (name, email, user_id)
  - Recipient (if applicable; linked to buyer/company detail)
  - Full event description (subject, body, compliance verdict, etc.)
  - Associated mandate + campaign (linked)
- **Message content (if outreach event):**
  - **From:** sender email (from workspace settings)
  - **To:** recipient email
  - **Subject:** full subject line (with merge fields resolved)
  - **Body:** full HTML message (rendered; links clickable in read-only mode)
  - **Send timestamp:** when message was sent / scheduled for
- **Compliance verdict (if check event):**
  - Verdict: PASS / FAIL / WARN (with badge color)
  - Campaign-level checks: list of checks run + status (e.g., "✓ Suppression list: clear", "✗ Disclaimer: missing")
  - Per-recipient results: table of recipients with their check status + flags
  - Blocking reasons (if FAIL): list of reasons
- **Approval metadata (if approval event):**
  - Reviewer name + email (linked to user profile if available)
  - Approval decision: Approved / Rejected (with badge)
  - Reviewer notes (full text)
  - Approval timestamp
- **Integrity detail section (always present):**
  - Full SHA-256 hash of this entry
  - Hash of previous entry (for chain validation)
  - Signature / verification status: ✓ Valid (hash chain intact) | ✗ Invalid (mismatch detected)
  - Link to "Verify integrity chain" action (see section 6)
- **System metadata:**
  - Entry ID (UUID; copy button)
  - Source system (outreach-engine, compliance-rules-engine, etc.)
  - IP address of actor (masked: 192.168.*.*)
  - API call ID (if applicable; for tracing)

**Action buttons in detail panel:**
- **Copy entry JSON** (copies full entry as JSON for external tools/compliance systems)
- **View in full audit trail** (jumps to this entry in the main log; closes detail panel)
- **Export this entry** (single-entry CSV or JSON for compliance review)
- **Verify integrity chain** (runs crypto validation; see section 6)

---

### 6. **Integrity Verification & Hash Chain Validation**

**"Verify integrity chain" action (triggered by detail panel or anomaly report):**

When user clicks this button:
1. Backend runs cryptographic validation:
   - Retrieves entry + previous N entries
   - Validates hash of current entry against stored hash
   - Validates chain: current entry's prev_hash == previous entry's hash
   - Re-computes hash from entry's data; checks if matches stored hash
2. Frontend shows **Verification modal:**
   - **Result:** ✓ Valid | ✗ Invalid | ⚠ Unverified (pre-migration)
   - **Chain state:** ASCII art visual of chain (boxes for entries, arrows for hashes):
     ```
     Entry N-1 [hash: a3f7...] ──→ Entry N [hash: b2c1...] ──→ Entry N+1 [hash: e8d4...]
     ✓ Valid            ✓ Valid            ✗ MISMATCH
     ```
   - **Details:**
     - Current entry's hash: [full SHA-256]
     - Computed hash from entry data: [full SHA-256]
     - Match? ✓ Yes | ✗ No
     - Previous entry's hash stored in current entry: [full SHA-256]
     - Actual previous entry's hash: [full SHA-256]
     - Match? ✓ Yes | ✗ No
   - **Action buttons:**
     - "Copy chain details" (copies verification result as JSON)
     - "Export forensic report" (exports full chain + verification details for external audit)
     - "Close"

---

### 7. **Export Panel (Recordkeeping Package)**

**Sticky export panel (right sidebar or modal; triggered by "Export recordkeeping package" button at top):**

**Purpose:** Prepare a time-range / mandate-scoped export for FINRA/SOX retention, regulatory response, or internal audit.

**Export configuration form:**

- **Export scope (required):**
  - ◉ Mandate-scoped (select one or more mandates from dropdown)
  - ◉ Date-range-scoped (select start + end date from pickers)
  - ◉ Both (mandate + date range; most restrictive)
  - Scope summary: "Exporting 347 audit log entries (mandate: Acme Inc. deal, date range: Jul 1 – Jul 15, 2026)"

- **Compliance mandate / Regulation (optional but recommended):**
  - Dropdown: "FINRA Rule 4512 (M&A outreach record retention)", "SOX Section 302 (financial records)", "GDPR (communications + consent)", "Internal audit", "Other (specify below)"
  - Text field (if "Other"): custom mandate name (e.g., "Regulatory inquiry from SEC")
  - Help text: "Selecting a mandate ensures the export includes all required fields per that regulation."

- **Export format (required):**
  - ◉ CSV (tabular; best for spreadsheet review or FINRA submission)
  - ◉ JSON (structured; best for integration with compliance systems)
  - ◉ PDF report (human-readable summary + detailed log; best for archival or board reporting)

- **Include options (checkboxes; pre-checked by default):**
  - [x] Full event details (all columns shown in log table)
  - [x] Message content (for outreach sends: full subject + body)
  - [x] Compliance verdicts (PASS/FAIL/WARN + reasons)
  - [x] Integrity hashes & verification (SHA-256 hashes + chain validation result)
  - [x] Reviewer notes & approval chain (who approved what + when)
  - [x] Sender identity & audit metadata (name, email, IP, source system)
  - [ ] Recipient personal data (email + name; disable if exporting for external regulatory body to minimize PII leakage)

- **File naming & metadata:**
  - Suggested filename: "[Mandate]_audit-export_[DateRange]_[Format]" (e.g., "Acme-Inc_audit-export_2026-07-01-to-2026-07-15_FINRA_csv")
  - Checkbox: [ ] Include export timestamp + exporter name in metadata (for regulatory submission; recommended)

- **Size warning (real-time):**
  - "This export will be ~2.4 MB (348 entries). [Download] [Split into multiple files] [Adjust filters]"
  - If >10 MB, show warning: "Large export. Consider splitting by date range or mandate to avoid file size limits."
  - "Split by..." button (if size >10 MB):
    - Dropdown: "Split by mandate" (exports one file per mandate) or "Split by week" (exports one file per week in date range)
    - Auto-generates split exports; user downloads a ZIP file with all segments + manifest.json (lists files + checksums)

- **Action buttons:**
  - **"Download export" (primary action):** begins download; shows progress bar "Generating export (this may take up to 1 minute for large datasets)..."
    - On complete: file downloaded; toast "Export ready: [filename]"
  - **"Preview export" (secondary):** shows sample of first 10 rows in a modal (helps user verify they're exporting the right data before commit)
  - **"Save export template"** (optional): saves current filter + export config for reuse (e.g., "Monthly FINRA submission")
  - **"Cancel":** closes export panel

- **Export history (collapsible section at bottom of panel):**
  - Recent exports (list): [Filename] [Date] [User] [Size] [Download link] [Delete button (24h only)]
  - Helps compliance officer re-download or verify what was exported when (audit trail for the audit trail)

---

### 8. **Empty / Error / Loading States**

### **Empty states:**

1. **No log entries (date range or mandate filters return zero results):**
   ```
   📋 No audit log entries found
   
   Try adjusting your filters:
   • Expand date range (currently: Last 30 days)
   • Include more event types
   • Clear mandate filter (currently: Acme Inc. deal only)
   
   [Reset filters]
   ```

2. **No access to audit log (role-based denial):**
   ```
   🔒 You don't have permission to view the audit log
   
   Audit log access is restricted to Compliance Reviewers and above.
   Contact your Compliance Officer if you need access.
   
   [Contact support]
   ```

3. **User has not exported before (empty export history):**
   ```
   No previous exports. Create your first recordkeeping package using the export panel above.
   ```

### **Loading states:**

1. **Fetching log entries:** skeleton table (10 rows, muted); spinner in header.
2. **Running integrity verification:** spinner + "Verifying hash chain… (this may take a few seconds)"
3. **Generating export:** progress bar "Generating export (X%)" with size estimate "~1.2 MB of 2.4 MB"

### **Integrity anomaly alert (high-priority error state):**

```
🚨 INTEGRITY ANOMALY DETECTED

Entry ID: 550e8400-e29b-41d4-a716-446655440000
Timestamp: 2026-07-10 09:15:00 UTC
Event: outreach_send

Hash mismatch detected. The hash stored in this entry does not match the computed hash of its data.

Stored hash:      a3f7b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
Computed hash:    b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c

This may indicate:
• Entry was tampered with after creation (unauthorized modification)
• System error during hash computation (rare)

⚠️ ACTION REQUIRED: Contact your Compliance Officer and support team.

[View full integrity diagnostics] [Export forensic report] [Contact support]
```

### **Export-size warning (when export >10 MB):**

```
⚠️ Large export detected

Your export will be ~12.5 MB (1,247 entries). This may take several minutes to generate and could exceed file size limits on some email systems.

Options:
1. [Split by mandate] (exports 3 separate files)
2. [Split by week] (exports 4 separate files for each week in the range)
3. [Adjust filters] (reduce date range or mandate scope) and re-export

[Continue with large export] [Split & download] [Adjust filters]
```

### **Export completed:**

```
✅ Export ready

Filename: Acme-Inc_audit-export_2026-07-01-to-2026-07-15_FINRA_csv.zip
Size: 2.4 MB
Entries: 348
Exported: 2026-07-15 14:35:00 UTC
Exporter: Jane Liu

[Download again] [View export history] [Close]
```

---

## Responsive Breakpoints

**Mobile (< 768px):**
- Filter panel: collapsible sidebar (hamburger menu top-left); closes on filter apply.
- Log table: collapse to card view (one entry per card with key fields: timestamp, event type, sender, message summary).
- Expandable row detail: full-screen modal (not side panel).
- Export panel: full-screen modal on mobile; form fields stack vertically.
- Integrity verification modal: full-screen with scrollable chain visualization.
- Header controls: "Export recordkeeping package" and "Integrity status" badges stack vertically.

**Tablet (768–1024px):**
- Filter panel: sticky left sidebar (narrower; ~220px).
- Log table: subset of columns visible; "more" menu for hidden columns (Match score, Metadata).
- Expandable row detail: side panel (narrower; ~300px) with scrollable content.
- Export panel: right sidebar (narrower; ~350px).

**Desktop (> 1024px):**
- Full layout: filter sidebar (left, ~250px) | log table (center, main) | export panel (right, ~400px; collapsed by default; opens on button click).
- All table columns visible.
- Side panels side-by-side with main content.

---

## Success Metrics

**Primary (compliance):**
1. **Audit log completeness:** 100% of outreach sends logged with timestamp + sender + recipient + message hash (non-negotiable for regulatory defense).
2. **Integrity verification pass rate:** % of log entries with valid hash chain (goal: 100%; any mismatch triggers investigation).
3. **Export compliance:** 100% of exports include required fields per selected regulation (FINRA, SOX, GDPR, etc.).
4. **No unverified entries in exports (post-migration):** % of exported entries with valid integrity hashes (goal: 100%).

**Secondary (user):**
5. **Export generation time:** median time to generate + download export package (goal: < 30 seconds for standard scope; < 2 min for large datasets).
6. **Filter effectiveness:** % of log queries that return <500 entries after applying filters (goal: >80%; indicates filters are helping users narrow scope).
7. **Integrity anomaly detection latency:** time from anomaly write to detection + alerting (goal: < 5 minutes).
8. **Export audit trail:** 100% of exports logged (who exported what, when) for regulatory auditing of the auditing system.

**Operational:**
9. **False-positive rate on integrity alerts:** % of "anomalies detected" that resolve as system noise or pre-migration entries (goal: < 5%; high rate suggests overly sensitive detection).
10. **Compliance officer time-to-response:** avg time from export request to delivery of recordkeeping package (goal: < 1 hour for standard scope; < 4 hours for regulatory response).
11. **Audit log storage cost:** cost per GB of stored audit log (track to ensure integrity hashing overhead doesn't explode costs).

---

## Competitor Comparison

| **Dimension** | **Hunter.io / Apollo.io / RocketReach** | **Existing M&A CRM (Affinity, DealCloud)** | **DealFlow AI (Audit Log & Export)** |
|---|---|---|---|
| **Immutable audit log** | None (email scattered in Gmail) | Basic activity log; not tamper-evident | ✓ Cryptographically verified, append-only log with SHA-256 hashing per entry |
| **Compliance-first recordkeeping** | None; users manually archive emails | Manual exports; no regulatory template | ✓ Mandate-scoped / regulation-scoped export (FINRA/SOX/GDPR templates) |
| **Integrity verification** | N/A | None; no integrity checks | ✓ Hash chain validation; anomaly detection; forensic report export |
| **Outreach traceability** | No integration; email logs separate | Partial; doesn't tie to outreach decision engine | ✓ Every send logged with compliance verdict + approval chain |
| **Approval chain audit trail** | None | Generic notes; no approval metadata | ✓ Full chain: who approved what, when, with what notes + signature |
| **Regulatory response package** | Not possible | Manual; time-consuming | ✓ One-click export scoped to mandate/date/regulation + integrity proof |
| **Hash chain validation** | N/A | None | ✓ Tamper-detection; forensic report for external audit |
| **FINRA / SOX ready** | No | Partial; not integrated with outreach | ✓ Integrated; export format matches regulatory filing requirements |
| **Advisor visibility (limited)** | N/A | All activities visible to all; no privacy | ✓ Advisor sees only own outreach log; compliance sees all; role-gated audit trail |

**Why this matters:** M&A advisory is heavily regulated (FINRA Rule 4512 mandates records of all written communications; SOX Section 302 requires attestation of records). When regulators investigate or auditors inspect, firms need defensible proof of what was communicated, to whom, when, and what compliance decision was made. Competitors leave advisors holding email printouts; DealFlow's tamper-evident audit log + one-click regulatory export means compliance officers have auditor-ready records at their fingertips—and the hash chain proves no one altered the record after the fact. This is a moat: once a firm relies on DealFlow for compliance defense, switching cost is astronomical.

---

## Wireframe-Ready Specification (Layout Pseudocode)

```
[Page: Audit Log & Recordkeeping Export]

Header:
  [← Compliance] [Page title: Audit Log & Recordkeeping]
  [Right side: Integrity status badge: "All entries verified" OR "3 anomalies detected"]
  [Button: "Export recordkeeping package"] [Timestamp: "Updated: 2 min ago"]

[3-col layout on desktop; 1-col on mobile]

Left column (filter panel, sticky):
  [Section: Filters]
    [Mandate: dropdown, multi-select, searchable]
    [Date range: pickers + shortcuts]
    [Event type: checkboxes]
    [Sender: search / autocomplete]
    [Verdict: radio buttons]
    [Recipient email: search]
    [Integrity status: radio buttons]
  [Search box: global text search]
  [Buttons: Apply, Reset]

Center column (main log table):
  [Table header: Timestamp | Event type | Mandate | Campaign | Sender | Recipient | Message/Action | Content hash | Metadata]
  [Rows: expandable; click to open detail panel]
    [Row 1: 2026-07-15 13:47 | outreach_send | Acme Inc | ... | Alice Chen | sarah.chen@... | Email sent to ... | a3f7b2... | ✓]
    [Row 2: 2026-07-15 13:40 | compliance_check | Acme Inc | ... | System | All outreach | Check run: PASS | b2c1d4... | ✓]
    ... [N rows, paginated or infinite scroll]
  [Pagination / infinite scroll: "Showing 20 of 347 entries"]

Right column (export panel; collapsed by default; opens on button click):
  [Section: Export recordkeeping package]
    [Export scope: radio (mandate-scoped, date-range-scoped, both)]
    [Scope summary: "347 entries"]
    [Regulation: dropdown]
    [Export format: radio (CSV, JSON, PDF)]
    [Include options: checkboxes (all pre-checked)]
    [Filename: text field, pre-filled]
    [Size warning: "~2.4 MB (348 entries)"]
    [Buttons: Download export, Preview, Save template, Cancel]
  
  [Section: Export history (collapsible)]
    [List: previous exports with download links]

Detail panel (on row click; side panel on desktop, modal on mobile):
  [Header: Timestamp | Event type badge]
  [Sender identity]
  [Recipient (if applicable)]
  [Full event data: subject, body, verdict, notes, etc.]
  [Integrity detail: hash, chain state, verification status]
  [System metadata: entry ID, source, IP, API call ID]
  [Action buttons: Copy JSON, Export, Verify integrity chain]

Verification modal (on "Verify integrity chain"):
  [Result: ✓ Valid | ✗ Invalid | ⚠ Unverified]
  [ASCII chain visualization]
  [Details: stored hash, computed hash, match status]
  [Buttons: Copy chain, Export forensic report, Close]
```

---

## Notes for Design & Dev

- **Hash display:** Truncate SHA-256 to 8 characters in main table (e.g., "a3f7b2..."); full hash in detail panel + verification modal.
- **Timestamp timezone:** Allow user to toggle display between UTC and local timezone (store preference in local storage).
- **Expandable row animation:** Smooth slide-out / fade-in for detail panels; no jarring reflows.
- **Filter state persistence:** Save filter state in URL query params (e.g., `?mandate_id=xyz&event_type=outreach_send,compliance_check&date_start=2026-07-01&date_end=2026-07-15`) so filters persist across page reload or sharing via link.
- **Large export handling:** For exports >10 MB, generate in background (on server) and email user a download link (expires in 24h) instead of blocking on browser download.
- **Integrity hashing scheme:** 
  - Hash input: JSON serialization of entry fields (excluding entry_id, created_at timestamps) in canonical order (alphabetical by key).
  - Algorithm: SHA-256.
  - Storage: stored in `content_hash` column of audit_log table; previous entry's hash stored in `prev_hash` column.
  - Migration: existing entries pre-hash pre-migration are marked with `hash_status: 'unverified'`; new entries auto-compute hash on INSERT.
- **Regulatory export templates:** Store as JSON configs in `export_templates` table; allows adding new regulations without code change (e.g., add "CFTC 39.10 record retention" template).
- **Accessibility:** All filters, modals, detail panels pass WCAG 2.1 AA (screen reader support for table headers, form labels, error messages).
- **Performance:**
  - Log table: paginate or lazy-load (index on (mandate_id, timestamp DESC) for fast queries).
  - Filter application: debounce search input (300ms); live-count facets (count of results per filter value) updated async.
  - Export generation: queue large exports (>5 MB) as background jobs; return job ID + polling URL; client polls for completion.
  - Integrity verification: cache verification results (5 min TTL) to avoid re-computing hash chain on every click.


---
**Approved design (v9):** `design/audit-log-export.html`
