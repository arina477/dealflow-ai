# Page: Admin · Users

**Route:** `/admin/users`  
**Audience:** Admin (authed, role-gated)  
**Flows:** F14 (manage users & roles)  
**Core Features:** #18 user management, #15 Auth & RBAC  
**Module:** Auth & RBAC

---

## Purpose

Centralize user provisioning, role assignment, and lifecycle management for DealFlow AI. Admins invite new users, assign roles (Advisor / Analyst / Compliance / Admin), grant least-privilege permissions, and deactivate/reactivate accounts. All user changes are audit-logged and reflect immediately in role-aware access controls across the platform.

---

## Audience

**Primary:** Admin  
- Role-gated access (post-auth, role check against `user.role == 'admin'`)  
- Typically 1–3 admins per firm (firm-wide account managers)
- Typical session: onboarding new users (bulk invites), quarterly access review, ad-hoc deactivations when team changes
- Least-privilege model: Admins can invite any role but cannot grant permissions beyond their own; system enforces admin-count minimum (cannot demote/deactivate last admin)

---

## Entry Points

1. **Left sidebar:** Admin menu → Users
2. **Account settings:** Admin clicks "Manage team" button (from top-right profile menu or account settings page)
3. **Audit log review:** Compliance / Admin reviews role change history and clicks "View user details" on user row

---

## Content Sections

### 1. Active Users Table

- **Main view:** Sortable, filterable table of all active users (status = "active")
- **Columns:**
  - Name (text, sortable)
  - Email (text, sortable)
  - Role (badge: "Advisor", "Analyst", "Compliance", "Admin"; color-coded; sortable)
  - Status (text: "Active" / "Pending invite"; sortable)
  - Permissions (text pill-stack, e.g., "Deal sourcing, Compliance review"; truncated; hover tooltip shows full list)
  - Invited by (text, user name; sortable)
  - Date added (date, ISO 8601; sortable; default sort descending)
  - Actions (fixed rightmost column)
    - "Edit" button (pencil icon; opens role/permission editor modal)
    - "Deactivate" button (trash icon; red/warning on hover)
    - "Resend invite" button (email icon; only visible if status = "Pending invite")

- **Filters (above table):**
  - Role filter (multi-select: Advisor, Analyst, Compliance, Admin; defaults to all)
  - Status filter (toggle or select: Active, Pending, or both; defaults to Active only)
  - Search box (filters name + email, real-time, case-insensitive)

- **Bulk actions (if rows selected):**
  - Checkbox column (header checkbox selects all visible, respect filters)
  - "Deactivate selected" button (batch action; confirms via modal)
  - "Resend invites" button (batch action; send pending-invite reminders to all selected)

### 2. Invite User Panel (Collapsible / Modal)

- **Trigger:** "Invite user" button (primary CTA, top-right or inline below table)
- **Layout:** Slide-in panel (right side, 400px fixed width) or modal overlay
- **Form fields:**
  - Full name (text input, required)
  - Email address (email input, required, must be unique; validate format + domain)
  - Role selector (dropdown or radio group: Advisor, Analyst, Compliance, Admin; required; defaults to none)
  - Permissions (multi-checkbox list, auto-populated based on role; see below; user can grant additional permissions if needed)
  - Notes (optional textarea, internal-only; e.g., "Sourcing lead for XYZ sector")
  - Send invite now? (checkbox, default true; if unchecked, save user as "draft" without sending email)

- **Role ↔ Permissions mapping (auto-populated, user-editable):**
  - **Advisor:** View deals, source targets, manage outreach, view compliance status (can initiate but not approve; read pipelines, mandates, competitors, contacts)
  - **Analyst:** View deals (read-only), view diligence, contribute research notes (view + comment on mandates, no send outreach)
  - **Compliance:** View outreach queue, approve/reject campaigns, edit compliance rules, export audit logs (read all outreach, deals, approvals; no deal sourcing)
  - **Admin:** All permissions + user management, account settings, audit log export, team billing

- **Submit button:** "Send invite" (or "Save as draft" if send-now unchecked)
  - Disabled until name + email + role filled
  - Loading spinner on submission

### 3. Role / Permission Editor Modal

- **Trigger:** "Edit" button on user row (or "Edit permissions" link in user detail view)
- **Modal content:**
  - User name (heading, non-editable)
  - User email (text, non-editable)
  - Current role (displayed, non-editable in v1; future: allow role change)
  - Permissions checkbox grid (3 columns on desktop, 1 on mobile)
    - Checkbox per permission (e.g., "View deals", "Manage outreach", "Approve campaigns", "Export audit logs")
    - Label + description (1-line hint text, e.g., "View deals — read-only access to mandates and sourcing pipeline")
    - Checked state reflects role defaults + any custom grants
    - User can toggle individual permissions on/off (e.g., grant "Export audit logs" to Analyst for special project)
  - Warning banner (if user tries to grant Admin-only permissions to non-admin): "Permissions exceed role scope. User role may be out of sync."
  - Submit button: "Save permissions" (disabled until changes detected; show diff on hover: "Removes: X, Adds: Y")
  - Cancel button (reverts unsaved changes)

### 4. Inactive Users Section (Collapsible)

- **Toggle:** "Show inactive users" (checkbox or accordion header; defaults to hidden)
- **Display:** Same table structure as active users, grayed out or dimmed
- **Actions column:**
  - "Reactivate" button (primary; changes status to active)
  - "Delete permanently" button (destructive red; only visible if >90 days inactive; bypasses soft-delete for GDPR/compliance)
  - No "Deactivate" button (already inactive)

---

## Interactions

### Flow: Invite New User

1. Admin clicks "Invite user"
2. Slide-in panel opens (or modal, depending on breakpoint)
3. Admin fills name, email, role; permissions auto-populate
4. Admin optionally adjusts permissions (checkboxes)
5. Admin optionally adds notes (internal, not shown to user)
6. Admin clicks "Send invite"
7. System validates:
   - Email unique (across active + pending + inactive; warn if reactivating deleted user: "User previously removed; inviting will create new account. Continue?")
   - Email format valid
   - Role ≠ empty
8. On success:
   - User status set to "Pending invite"
   - Invite email sent to email address (contains one-time link to `/login?token=<invite_jwt>`, expires 24h)
   - Toast: "Invite sent to [email]"
   - Panel closes; table refreshes
   - New user row appears with status "Pending invite"
9. On error (email taken, invalid format, etc.):
   - Toast or inline error: "User with email [email] already exists. Edit existing user or use different email."
   - Form remains open, focus on email field

### Flow: Assign Role / Edit Permissions

1. Admin clicks "Edit" on user row
2. Modal opens: user name, email (read-only), role (read-only in v1), permissions checkboxes (current state reflected)
3. Admin clicks/unchecks permission boxes
4. Submit button becomes enabled (only if changes detected)
5. Admin clicks "Save permissions"
6. System validates:
   - No contradictions (e.g., granting "Approve campaigns" without "View campaigns")
   - If removing last "View deals" permission from sole Admin, error: "Cannot revoke all access from only Admin. Promote another Admin first or assign different permissions."
7. On success:
   - Toast: "Permissions updated for [user name]"
   - Modal closes
   - Table refreshes; permissions column updates inline
   - Audit log entry created: `admin_id` → `target_user_id`, `action: permissions_changed`, `details: {old_permissions, new_permissions}`
8. On error:
   - Toast: "[Error details]"
   - Form remains open; focus on conflicting permission

### Flow: Deactivate User

1. Admin clicks "Deactivate" on user row (or selects multiple rows + "Deactivate selected")
2. Confirmation modal appears:
   - "Deactivate [user name]?" (or "Deactivate [N] users?")
   - Consequences listed: "User will be signed out. They cannot access DealFlow until reactivated. Active sessions expire immediately."
   - If last admin: Red error banner (see "Error states" below); no deactivate button shown
   - "Cancel" / "Deactivate" buttons
3. Admin confirms
4. System:
   - Sets `user.status = 'inactive'`
   - Invalidates all active sessions for user (force logout)
   - Revokes API tokens (if applicable)
5. On success:
   - Toast: "[User name] deactivated"
   - Table refreshes; user moves to "Inactive" section if table is filtered to active-only
   - Audit log: `admin_id` → `target_user_id`, `action: user_deactivated`, `timestamp`
6. On error (user is last admin):
   - Toast: "Cannot deactivate. [User name] is the last Admin. Promote another user to Admin first."
   - Deactivate button disabled (grayed out with tooltip)

### Flow: Reactivate User

1. Admin toggles "Show inactive users"
2. Admin clicks "Reactivate" on inactive user row
3. Simple confirm dialog (no consequences): "Reactivate [user name]?"
4. Admin confirms
5. System:
   - Sets `user.status = 'active'`
   - Sends new invite email (to re-establish login; password resets, session refreshed)
6. On success:
   - Toast: "[User name] reactivated"
   - Table refreshes; user moves back to active list
   - Audit log: `admin_id` → `target_user_id`, `action: user_reactivated`

### Flow: Resend Invite

1. Admin clicks "Resend invite" on pending user row (or bulk action if multiple pending selected)
2. Simple confirmation: "Resend invite to [email]?"
3. Admin confirms
4. System:
   - Generates new invite token (24h expiry)
   - Sends email with new link
5. On success:
   - Toast: "Invite resent to [email]"
   - Table updates (last-email-sent timestamp visible in hover detail, optional)

---

## Data Requirements

### Endpoints (Placeholders)

**GET /api/admin/users**
- Query params: `?role=advisor|analyst|compliance|admin` (optional, multi), `?status=active|pending|inactive` (optional), `?search=name_or_email` (optional)
- Returns: `{ users: [{ id, name, email, role, status, permissions: [string], invited_by, created_at, last_login, last_email_sent? }], total_count }`

**POST /api/admin/users/invite**
- Body: `{ name, email, role: "advisor"|"analyst"|"compliance"|"admin", permissions?: [string], notes?: string, send_now?: bool }`
- Returns: `{ id, email, status, invite_token, invite_expires_at }`

**PATCH /api/admin/users/:user_id**
- Body: `{ role?: string, permissions?: [string], name?: string, notes?: string }`
- Returns: updated user object

**POST /api/admin/users/:user_id/deactivate**
- Body: `{}`
- Returns: `{ id, status: "inactive" }`

**POST /api/admin/users/:user_id/reactivate**
- Body: `{}`
- Returns: `{ id, status: "active", invite_token, invite_expires_at }`

**POST /api/admin/users/:user_id/resend-invite**
- Body: `{}`
- Returns: `{ id, invite_token, invite_expires_at }`

**GET /api/admin/users/:user_id/audit**
- Returns: `{ user_id, changes: [{ action, changed_by, timestamp, old_value, new_value }] }`

---

## Empty / Error / Loading States

### Empty User List

- **Display:** "No users yet. Invite your first team member to get started."
- **Action:** "Invite user" button (prominent)

### No Active Users (all inactive)

- **Display:** "All users are currently inactive. Reactivate team members or invite new users."
- **Action:** Toggle "Show inactive users" + "Reactivate" button OR "Invite user" button

### Last Admin Deactivation Blocked

- **Scenario:** Admin tries to deactivate the only active Admin
- **Display:** 
  - Deactivate button grayed out (cursor: not-allowed)
  - Tooltip on hover: "Cannot deactivate. This is the last Admin on the account. Promote another user to Admin first."
  - If modal force-opened by keyboard/accessibility: Red error banner in modal: "This user is the last Admin. Deactivation blocked."
- **Consequence:** User must promote another user to Admin role before this deactivation is allowed

### Role / Permission Conflict Warning

- **Scenario:** Admin tries to grant "Approve campaigns" (Compliance-only permission) to Advisor
- **Display:** Yellow warning banner in edit modal: "Permission 'Approve campaigns' is outside the Advisor role scope. Consider changing role to Compliance or removing permission."
- **Action:** User can dismiss warning and proceed (v1), or system auto-removes conflicting permission (v2)

### Duplicate Email on Invite

- **Scenario:** Admin tries to invite a user with an email already in the system (active, pending, or inactive)
- **Display:** Toast: "User with email [email] already exists. Edit existing user or use a different email."
- **Action:** "Edit user" link in toast (optional; opens edit modal for existing user)

### Invite Email Failure

- **Scenario:** Outgoing email service fails (temporary or permanent)
- **Display:** Toast: "Invite created but email delivery failed. [User] will not receive link. Retry sending from user detail page."
- **Action:** Retry via "Resend invite" button; status remains "Pending invite" (not "Active" until user completes signup)

### Permission Save Conflict

- **Scenario:** Admin grants permissions that contradict the user's role (or tries to remove all permissions)
- **Display:** Toast or inline error: "Permission mismatch detected. [Permission X] requires role [Role Y]. Adjust role or permissions and retry."
- **Consequence:** Save blocked; form remains open for correction

### Network Error / Timeout

- **Display:** Red banner: "Failed to update users. Please try again."
- **Action:** "Retry" button (re-fetches or re-submits)

### Loading State

- **Spinner:** Centered, with text "Loading users…"
- **Skeleton loaders:** Placeholder rows in table (5 rows, shimmer animation)
- **Fallback:** Disable all buttons; show "Loading" state until users loaded

---

## Responsive Breakpoints

| **Breakpoint** | **Width** | **Layout** |
|---|---|---|
| **Mobile** | 320–639px | Single-column table; columns: Name, Role, Actions (stacked). Filters collapse to dropdown or bottom drawer. Invite panel becomes full-screen modal. Edit modal full-screen. |
| **Tablet** | 640–1023px | Two-column table; Name, Email, Role, Actions visible. Date added, Permissions hidden or in detail row expansion. Invite panel 90% width side-in. Edit modal centered, 90% width. |
| **Desktop** | 1024px+ | Full table, all columns visible. Horizontal scroll if >8 columns. Invite panel 400px fixed right-side slide-in. Edit modal centered, 500px width. |

---

## Success Metrics

1. **User onboarding time:** Median time from invite send to first login (target: <1h for 80% of new users; indicates invite clarity)
2. **Deactivation compliance:** 100% of deactivated users logged out within 1s (tracked via session-invalidation logs)
3. **Permission audit trail:** 100% of role/permission changes logged with admin ID + timestamp + old/new values (tracked via audit log rows)
4. **Last Admin protection:** 0 incidents of last Admin being deactivated (system prevents; metric = false-positive blocks caught in testing)
5. **Invite resend rate:** % of pending-invite users who receive retry invites (target: <30%; high rate indicates initial invite delivery issue)
6. **Bulk action adoption:** % of invites done via bulk modal vs. single invites (target: >50% for firms with 10+ users; indicates power-user efficiency)
7. **Permission conflict resolution:** % of permission-save errors auto-resolved without manual support (target: >90%; low % indicates UX clarity gap)

---

## Competitive Comparison

| **Dimension** | **DealFlow AI** | **Generic SAAS (e.g., Slack, Stripe Dashboard)** |
|---|---|---|
| **Invite workflow** | Single-step form (name, email, role, permissions auto-populated); sends 24h invite token | Multi-step (email entry, role selection, wait for SAML config); or auto-signup with email verification |
| **Role/permission sync** | Pre-defined role → auto-populate permissions; user can customize; system validates conflicts | Flat role list (admin, member, etc.); minimal permission granularity |
| **Last Admin protection** | System enforces minimum-one-admin; blocks deactivation with clear UX messaging | Many SAAS allow last admin removal (support burden) |
| **Audit trail** | All role/permission changes logged with admin ID, timestamp, change diff | Limited; log viewer may be separate (compliance add-on) |
| **Permissions scope** | M&A-specific (deal sourcing, outreach, compliance review, audit export) | Generic (read, write, delete, admin) |
| **Bulk actions** | Invite, deactivate, resend multiple users at once | Invite bulk; deactivate usually single-user |
| **Permission UI** | Checkbox grid with descriptions + auto-role-mapping; clearer for new admins | Nested toggles or dropdown; less discoverable |

---

## Technical Implementation Notes

- **Session invalidation:** On deactivate, query all active sessions for user, revoke tokens, send logout signal to all open browser tabs (via WebSocket or polling)
- **Audit logging:** Create `audit_log` row for every invite, role change, deactivate, reactivate, and permission edit; include `admin_id`, `target_user_id`, `action`, `old_state`, `new_state`, `timestamp`
- **Email template:** Invite email includes firm name, inviter name ("Invited by John Smith"), role ("You've been invited as Analyst"), and one-time link with token (no password in email; user creates password on first login via invite link)
- **Permission validation:** Server validates permission grants against role; for v1, admin can grant _additional_ permissions beyond role defaults, but cannot revoke permissions required by role
- **Unique email enforcement:** Case-insensitive, across all user statuses (active, pending, inactive); allow re-invite of same email after deletion (>90 days), but warn admin
- **Role hierarchy:** No implicit hierarchy in v1 (all roles are peers); Admin role is special only for user-management access control


---
**Approved design (v9):** `design/admin-users.html`
