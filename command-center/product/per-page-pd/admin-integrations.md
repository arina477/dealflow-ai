# Page: Admin · Data Sources / Integrations

**Route:** `/admin/integrations`  
**Audience:** Admin (authed, role-gated)  
**Flows:** F13 (connect & configure data sources)  
**Core Features:** #17 data-source connection management; supports #1 sourcing, #3 enrichment, #9 outreach send  
**Modules:** data ingestion, secrets management

---

## Purpose

Centralize inbound deal-sourcing data APIs, enrichment providers (contact/company data), and outreach send providers in a single secure credential vault. Admin configures connections once, tests connectivity, sets sync cadence, and enables/disables per-source—eliminating per-user credential friction and enforcing single source of truth for provider credentials.

---

## Audience

**Primary:** Admin  
- Role-gated access (post-auth, role check against `user.role == 'admin'`)  
- No sharing or delegation (credentials are org-wide; single admin point of control)  
- Typical session: onboarding new provider (e.g., first deal-sourcing API), credential rotation, sync troubleshooting

---

## Entry Points

1. **Left sidebar:** Admin menu → Integrations
2. **Setup wizard:** On first platform launch, onboarding flow includes "Connect your first data source" shortcut to this page
3. **Operator feedback loop:** When Sourcer reports "No new deals syncing," Operator escalates to Admin; Admin checks sync status on this page
4. **Credential expiry alert:** System sends Admin an email 7 days before API key/OAuth token expires; email links to `/admin/integrations` with focus on the expiring source

---

## Content Sections

### 1. Connected Sources List
- **Header:** "Active Integrations" with count badge (e.g., "5 connected")
- **Table columns:**
  - Provider name (e.g., "Crunchbase", "Apollo", "SendGrid", "Custom Deal-Source API")
  - Connection type (enum: `api_key`, `oauth`, `custom_webhook`)
  - Status indicator (green dot: `Connected` + last sync timestamp; orange: `Sync stalled` + duration; red: `Auth failed` + error details)
  - Last sync time (absolute timestamp, e.g., "2026-06-29 14:32 UTC")
  - Sync cadence (e.g., "Every 6 hours", "On demand", "Daily at 2 AM UTC")
  - Actions column: "Configure" | "Test" | "Rotate credential" | "Disable" | "Delete"
- **Sorting:** By status (failures first), then alphabetically by provider name
- **Filtering:** Filter by provider category (all, deal-sourcing, enrichment, outreach, custom)
- **Bulk actions:** (Disabled for now; future: bulk enable/disable, bulk re-test)

### 2. Add Integration Flow

#### 2a. Provider Picker
- **Grid of provider cards** (4 per row on desktop)
  - Card shows provider logo, name, category tag (Deal Sourcing / Enrichment / Outreach)
  - Example pre-built integrations: Crunchbase, PitchBook, Apollo, Hunter.io, ZoomInfo, SendGrid, Gmail (OAuth), Salesforce
  - "Custom API" card at end (for in-house or bespoke provider APIs)
- **Search box** (top, full-width): Filter by provider name or category

#### 2b. Credential Entry Modal
- **Provider name** (auto-filled from picker)
- **Connection type selector** (radio):
  - `API Key`: Single text input, masked on input (show/hide toggle for copy)
  - `OAuth`: "Authorize with [Provider]" button (redirects to provider's OAuth consent screen; returns auth code + refresh token to DealFlow)
  - `Custom (Basic Auth)`: Username + password inputs, masked
  - `Custom (Headers)`: Key-value pairs for custom headers (e.g., `X-API-Key`, `Authorization`)
- **Connection name** (optional, user-friendly label for multiple connections to same provider; defaults to provider name)
- **Enable sync toggle** (defaults to true)
- **Sync cadence selector:**
  - Radio options: `Disabled`, `On demand (manual trigger only)`, `Every 6 hours`, `Every 12 hours`, `Daily (specify time)`, `Weekly (specify day + time)`, `Custom cron expression`
  - Time pickers appear for daily/weekly (timezone auto-detected from browser, editable)
  - Cron input (optional, advanced users; with link to cron validator)
- **Scope/permissions selector** (appears for OAuth + multi-scope providers):
  - Checkboxes for each scope (e.g., "Read contacts", "Read deals", "Read company profiles")
  - Default recommended scopes pre-checked
- **Rate limit override** (optional, advanced):
  - Max requests per minute (for providers with strict throttling)
  - Default placeholder: "Recommend: [provider's default]"
- **Test button** (enabled once credential fields populated)
- **Save button** (enabled after successful test or on manual override)

#### 2c. Test Connection Flow
- **On "Test" click:** Spinner modal: "Testing connection to [Provider]…"
- **Success case:** Green checkmark + "Connection successful. [N] records fetched in [duration]ms."
- **Failure case:** Red error + machine-readable error code (e.g., `INVALID_API_KEY`, `OAUTH_EXPIRED`, `RATE_LIMIT_EXCEEDED`, `NETWORK_UNREACHABLE`) + human-readable guidance (e.g., "Your API key is invalid. Check it in the [Provider] dashboard and paste again.") + "Retry" button
- **Partial success:** Yellow warning: "Connection successful but [X] scopes missing. Recommend re-authorizing to enable [Feature]." + "Re-authorize" button

### 3. Connected Source Detail / Configure Panel
- **Layout:** Modal or inline panel (appears when Admin clicks "Configure" on a source row)
- **Sections:**
  - **Connection info** (read-only): Provider, connection type, created by + created at, last tested at
  - **Credential status:** Countdown timer to expiry (if applicable); "Expires in X days" (green if >30d, yellow if 7–30d, red if <7d)
  - **Sync status dashboard:**
    - Last sync time
    - Next scheduled sync time (or "On demand")
    - Records synced (lifetime count)
    - Records synced this month
    - Last 5 sync attempts (table: timestamp | status | record count | errors)
    - If stalled: "Last sync was X hours ago. [Retry] or [contact support]?"
  - **Edit sync cadence:** Same controls as add flow (can re-configure on the fly)
  - **Enable/disable toggle:** When disabled, sync pauses but credential is retained
  - **Rotate credential button:** Opens "Rotate API key / Re-authorize" flow (see Interactions below)

### 4. Data Mapping & Field Customization (Advanced)
- **Collapsible section:** "Field mapping" (appears for deal-sourcing and enrichment integrations)
- **Grid:** Shows provider's outbound fields → DealFlow internal field mappings
  - Example row: Provider field "company_name" → maps to DealFlow field "target_company" (green checkmark if recognized, orange warning if custom)
  - Allow Admin to manually remap fields (dropdown picker for each row)
  - Custom field support: "Create new field" option for provider fields not in DealFlow schema
- **Save mapping button** (if changes made)

---

## Interactions

### Flow: Add New Data Source (Happy Path)
1. Admin clicks "Add Integration" button (top-right)
2. Provider picker grid appears
3. Admin searches or clicks provider (e.g., "Crunchbase")
4. Credential entry modal opens
5. Admin pastes API key into masked text input
6. Admin selects sync cadence "Every 6 hours"
7. Admin clicks "Test connection"
8. Spinner: "Testing…"
9. Success toast: "Connection successful. 2,847 records fetched."
10. "Save" button now enabled; Admin clicks it
11. Modal closes; new row appears in Connected Sources list with green status dot
12. Toast: "Crunchbase integration enabled. First sync scheduled in 10 minutes."

### Flow: Test Connection on Existing Source
1. Admin clicks "Test" on a source row
2. Modal: "Testing connection to [Provider]…"
3. If success: Green checkmark + result summary + "Close" button
4. If failure: Red error + guidance + "Retry" button
5. On retry, same modal repeats test
6. After success, modal auto-closes after 2s; source row updates with new "Last tested" timestamp

### Flow: Rotate API Key (Credential Refresh)
1. Admin clicks "Rotate credential" on a source row
2. Modal: "Rotate [Provider] API key"
   - Current key (masked): "••••••••••••[last 4 chars]" with "Copy old key" button (for documentation)
   - New key field (empty, masked input)
   - Explanation: "New key will be tested and become active immediately. Old key is revoked."
3. Admin pastes new key
4. Admin clicks "Test & rotate"
5. System tests new key (same test flow as add)
6. On success: "Rotation successful. [Provider] is now using the new key. Old key has been revoked."
7. Source row refreshes; "Last rotated" timestamp updates; credential expiry countdown resets

### Flow: Disable a Source (Pause Sync)
1. Admin toggles "Enabled" off on a source row
2. Confirmation dialog: "Disabling [Provider] will pause all syncs. Resume anytime from this page. Continue?"
3. On confirm: Toggle switches off; source row dims slightly; status changes to "Disabled"
4. Toast: "[Provider] sync paused. You can re-enable it anytime."
5. Sourcer/Operator views reflect no new data from this source until Admin re-enables

### Flow: Delete a Source
1. Admin clicks "Delete" on a source row
2. Modal: "Delete [Provider] integration?"
   - Warning: "Synced data from [Provider] will remain in DealFlow. Future syncs will stop."
   - Checkbox: "I understand this cannot be undone" (must check to enable delete)
3. On confirm: Source removed from list; toast "Integration deleted."
4. Source and all stored credentials permanently removed; system logs deletion with Admin user + timestamp

### Flow: Handle Auth Failure (e.g., Expired OAuth Token)
1. System detects OAuth token expired during scheduled sync
2. Sync status updates to red: "Auth failed" + error "OAuth token expired"
3. Admin visits `/admin/integrations`; sees source with red status
4. Admin clicks source; detail panel shows "OAuth token expired. [Re-authorize] or [rotate credential]?"
5. Admin clicks "Re-authorize"
6. Browser redirects to provider's OAuth consent screen
7. Admin clicks "Authorize"
8. Browser returns to DealFlow with new auth code
9. System stores new token; retests connection
10. Status flips to green; next sync scheduled immediately

### Flow: Configure Sync Cadence Change
1. Admin clicks "Configure" on a source
2. Detail panel opens; "Sync cadence" shows current setting (e.g., "Every 6 hours")
3. Admin changes to "Daily at 2 AM UTC"
4. Clock picker appears; Admin confirms time
5. Admin clicks "Save"
6. Toast: "Sync cadence updated. Next sync scheduled for 2 AM UTC tomorrow."
7. Panel closes; source row refreshes with new cadence

---

## Data Requirements

### Endpoints (Placeholders)

**GET /api/admin/integrations**
- Returns: `{ sources: [{ id, provider_name, connection_type, status, last_sync, next_sync, sync_cadence, enabled, credential_expires_at }], available_providers: [{ name, category, auth_type, recommended_scopes }] }`

**POST /api/admin/integrations**
- Body: `{ provider_name, connection_type, credential: { api_key | oauth_code | username/password | headers }, connection_label?, sync_cadence, enabled, rate_limit_override? }`
- Returns: `{ id, provider_name, status, created_at }`

**GET /api/admin/integrations/:id**
- Returns: `{ id, provider_name, connection_type, status, last_sync, next_sync, sync_cadence, enabled, created_by, created_at, last_tested_at, credential_expires_at, sync_history: [{ timestamp, status, record_count, error }], field_mapping? }`

**PATCH /api/admin/integrations/:id**
- Body: `{ enabled?, sync_cadence?, rate_limit_override?, field_mapping? }`
- Returns: updated source object

**POST /api/admin/integrations/:id/test**
- Returns: `{ success: bool, message, record_count?, error_code?, error_detail? }`

**POST /api/admin/integrations/:id/rotate**
- Body: `{ new_credential: { api_key | oauth_code | ... } }`
- Returns: `{ success: bool, message, new_expires_at? }`

**POST /api/admin/integrations/:id/sync**
- Returns: `{ success: bool, sync_job_id, estimated_duration_ms }`

**DELETE /api/admin/integrations/:id**
- Returns: `{ success: bool, message }`

**GET /api/admin/integrations/:id/sync-history**
- Returns: `{ sync_attempts: [{ timestamp, status, record_count, error_code, error_detail }] }` (paginated, last 20)

**POST /api/admin/integrations/oauth/callback**
- Query: `code=[auth_code], state=[csrf_token], provider=[provider_name]`
- Returns: Redirect to `/admin/integrations` with toast (success or error)

---

## Empty / Error / Loading States

### No Integrations Connected
- **Display:** Empty state illustration + "No data sources connected yet."
- **Subtext:** "Connect your first deal-sourcing API, enrichment provider, or outreach tool to get started."
- **Action:** "Add Integration" button (same as main flow)

### Sync Stalled (No Recent Sync)
- **Status indicator:** Orange dot + "Sync stalled" in Connected Sources list
- **Detail panel:** Yellow banner: "[Provider] has not synced in [X hours]. This may indicate a connectivity issue or auth failure."
- **Actions:** "Test connection" | "Retry now" | "Contact support"

### Credential Expiring Soon
- **Status indicator (if <7 days):** Red dot + "Credential expiring"
- **Alerts:**
  - Email sent to Admin 7 days before expiry: "Your [Provider] API key expires in 7 days. [Rotate key]"
  - On `/admin/integrations`: Red banner at top of page (if any source expiring <7d): "[N] credential(s) expiring soon. Review integrations."
- **Action:** Click source → "Rotate credential" button

### Invalid Credentials
- **Test result (failure case):**
  - Red error banner: "[Provider] returned: Invalid API key. Please check your credentials."
  - Error code displayed (machine-readable for support)
- **Actions:** "Edit credential" button (re-opens add modal) | "View [Provider] docs" (external link)

### Rate Limit Exceeded
- **Test result:** Orange warning: "[Provider] is rate-limiting requests (429). Consider increasing the delay between syncs or contacting [Provider] support for higher limits."
- **Action:** "Increase rate-limit buffer" (adjusts sync cadence or requests-per-minute config)

### Network Unreachable / Timeout
- **Test result:** Red error: "Cannot reach [Provider] API. Check your network or [Provider]'s status page."
- **Action:** "Retry" button | "Check [Provider] status" (external link)

### Loading State (Initial Page Load)
- **Display:** Skeleton loaders for source list rows (8 rows)
- **Spinner:** Centered message "Loading integrations…"

### Loading State (During Test)
- **Modal spinner:** "Testing connection to [Provider]…" with 30s timeout
- **On timeout:** Error "Test took too long. [Provider] may be experiencing issues. [Retry]?"

---

## Responsive Breakpoints

- **Desktop (1024px+):** Full-width table with 6 columns; modals centered; credentials shown with copy button
- **Tablet (768–1023px):** Table collapses to card layout (one per source); credential fields stack; modals full-width
- **Mobile (<768px):** Card layout, full-width; "Add Integration" fixed at bottom; credential input hidden behind show/hide toggle; test/rotate actions in action menu (three-dot icon)

---

## Success Metrics

1. **Integration Adoption:** ≥3 data sources connected per tenant within first month post-launch (tracked via `integration.count > 2` across orgs)
2. **Sync Reliability:** ≥99% of scheduled syncs complete without auth/network errors (tracked via sync-attempt success rate in sync_history)
3. **Credential Rotation:** 100% of expiring credentials rotated before expiry (0 failed syncs due to expired creds; measured via error log)
4. **Admin Time Savings:** <5 min to add new data source (onboarding survey); <2 min to debug sync failure via this page
5. **Operator Satisfaction:** ≥80% of Operators report "Data syncing reliably" (post-integration feature survey)
6. **Sync Volume:** Average records synced per source per month; detect underutilized sources (e.g., <100 records/month) for Admin review
7. **Audit Trail:** 100% of credential operations (add, rotate, test, delete) logged with Admin user, timestamp, and outcome (tracked in audit table)

---

## Competitor Comparison

| **Dimension** | **DealFlow AI** | **Generic Integration Platforms (e.g., Zapier, Make)** |
|---|---|---|
| **Role-Based Access** | Admin-only; role-gated; single org-wide credential vault | User-level; distributed zaps; credentials scattered across user accounts |
| **Credential Security** | Never shown plaintext after save; encrypted at rest; audit log on every touch | Credentials visible in UI; stored in user accounts; no rotation tracking |
| **Sync Status Visibility** | Real-time status dashboard (Connected/Stalled/Failed); error details logged + actionable guidance | Webhook logs only; generic error messages; requires technical debugging |
| **Test Connection** | Built-in; 1-click test with result summary; error diagnosis | Manual trigger via execution; slow feedback loop |
| **Credential Rotation** | One-click rotate; old key revoked; countdown timers before expiry | Manual; user must update zap; risk of forgotten rotations |
| **Sync Cadence Control** | Flexible (on-demand, every N hours/days, custom cron) + timezone support | Fixed intervals per automation; limited granularity |
| **Field Mapping** | Visual mapping UI; detect unrecognized fields; custom field creation | Requires manual JSON editing or plugin development |
| **Deal-Sourcing Context** | Integrations tied to deal workflows (sourcing, enrichment, outreach); sync failures surface in deal pipeline | Generic integrations; no domain-specific context |
| **Rate-Limit Handling** | Adaptive backoff; Admin can override per-source; retries are transparent | No built-in handling; executions fail and notify user |


---
**Approved design (v9):** `design/admin-integrations.html`
