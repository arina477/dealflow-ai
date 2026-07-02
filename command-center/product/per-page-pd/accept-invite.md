# Accept Invite & Set Password

**Route:** `/invite/:token`  
**Features:** #15 Auth & RBAC, #18 User Management  
**Related Flows:** F14 (User Onboarding via Admin Invite)

---

## Purpose

Enable newly invited users to securely onboard by validating their invite token, establishing credentials (name + password), and gaining immediate access to the DealFlow dashboard. This is the gated entry point for all new users — no public self-signup exists.

---

## Audience

**Primary:** Invited user (pre-authentication)
- Has received an email with an invite link
- Not yet created an account or set a password
- No session active; no auth context

**Secondary:** Invited user (post-password-set)
- Successfully validated token and submitted credentials
- System has created auth session
- Redirects to authenticated dashboard post-completion

---

## Entry Points

1. **Email link** — `/invite/:token` embedded in invite email (sent by admin via #18 User Management)
2. **Deep link / manual URL** — User pastes or retypes the full URL (edge case; token becomes the security boundary)

---

## Content Sections

### Token Validation & Page Load

**Header:** "Welcome to DealFlow"
- Subtitle: "[Company Name] has invited you to collaborate on M&A deals."

**Load behavior:**
- On page load, client validates `:token` against `/api/auth/validate-token` (GET)
- Synchronous validation during page render (prevent UX flicker); display loading spinner until response
- Token passed as path param; no query string exposure

**Token validity states:**
- **Valid:** Page loads full onboarding form (see below)
- **Invalid / expired / already-used:** Show error state (see "Empty/error/loading states")

---

### Credential Setup Section

**Form fields (in order):**

1. **Full Name** (text input)
   - Placeholder: "Your full name"
   - Label: "Full Name"
   - Required; no length limit enforced client-side (backend validates ≤255 chars)
   - Auto-focus on valid token load

2. **Email Display** (read-only text)
   - Pre-filled from invite record; user cannot edit
   - Label: "Email"
   - Clarifies which account is being activated

3. **Password** (password input with visibility toggle)
   - Placeholder: "Create a strong password"
   - Label: "Password"
   - Show/hide toggle (eye icon, right side of field)
   - Required; inline strength indicator (see below)

4. **Password Strength Indicator** (real-time, client-side)
   - Beneath password field
   - Color-coded meter: Red (weak) → Yellow (fair) → Green (strong)
   - Text label: "Weak" / "Fair" / "Strong"
   - Rules display (inline, collapsible or persistent):
     - Minimum 12 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character (e.g. `!@#$%^&*`)
   - All rules highlighted as met/unmet in real-time

5. **Confirm Password** (password input with visibility toggle)
   - Placeholder: "Re-enter your password"
   - Label: "Confirm Password"
   - Matches primary password field; client-side validation shows mismatch error inline

**CTA Button:**
- Label: "Accept & Create Account"
- Disabled until all fields valid (name non-empty, password strong, passwords match)
- On click: POST `/api/auth/set-password` with `{ token, name, password }`

---

## Interactions

**Submit flow:**
1. User fills form
2. Clicks "Accept & Create Account"
3. Client validates:
   - Token still valid (optional re-check; backend is authoritative)
   - Name non-empty
   - Password meets strength rules
   - Passwords match
4. On validation pass: POST request; button enters loading state (spinner, disabled)
5. **Success response (201):**
   - Backend creates user record + auth session
   - Client receives session token (cookie or Bearer)
   - Redirect to `/dashboard` (authenticated)
   - Optional: brief toast "Welcome to DealFlow" on dashboard
6. **Error responses:**
   - `400 Bad Request` (validation failure): Inline field errors (e.g. "Password must contain a special character")
   - `409 Conflict` (user already exists / token already used): Error state below
   - `401 Unauthorized` (token expired): Error state below
   - `500 Server Error`: Generic error state; contact support CTA

---

## Data Requirements

**Placeholder endpoints:**

- **GET `/api/auth/validate-token?token=:token`**
  - Response: `{ valid: boolean, email: string, invited_by: string | null, expires_at: ISO8601 }`
  - Used on page load to show/hide form

- **POST `/api/auth/set-password`**
  - Body: `{ token: string, name: string, password: string }`
  - Response: `{ session_token: string, user_id: string, email: string }`
  - Creates user, invalidates token, establishes session

**Data lifecycle:**
- Invite token (issued by admin, expires after 7 days or on first use)
- User record (created on password set; fields: id, email, name, password_hash, created_at, role)
- Session (issued post-password-set; httpOnly cookie recommended for web clients)

---

## Empty / Error / Loading States

### Loading State (page load)
- Full-screen spinner centered
- Heading: "Verifying your invite…"
- Blocks form rendering

### Invalid Token Error
- Heading: "Invite Link Expired or Invalid"
- Message: "This invite link has already been used, has expired, or does not exist. Contact your admin for a new invite."
- CTA: "Request a new invite" (link/button to support form or email address)
- No form fields displayed

### Already-Used Token Error
- Heading: "Account Already Activated"
- Message: "Your account has already been created. Please sign in with your credentials."
- CTA: "Go to Sign In" (link to `/login`)

### Expired Token Error
- Heading: "Invite Expired"
- Message: "This invite expired on [date]. Contact your admin to request a new one."
- CTA: "Request a new invite"

### Password Strength Validation Error
- Inline, beneath password field (real-time)
- Red text: List unmet password requirements
- Button remains disabled until all rules pass

### Password Mismatch Error
- Inline, beneath "Confirm Password" field
- Red text: "Passwords do not match"
- Button remains disabled

### Server Error (generic 5xx)
- Heading: "Something went wrong"
- Message: "We encountered an error while creating your account. Please try again in a moment, or contact support at [email]."
- CTA: "Contact Support"
- Optional retry button (re-submits POST if user wishes)

### Rate Limit Error (429)
- Heading: "Too many attempts"
- Message: "You've attempted to set your password too many times. Please wait a few minutes and try again."
- Temporarily disable submit button with countdown timer

---

## Responsive Breakpoints

**Mobile (320px–767px):**
- Single-column form, full width with 16px gutters
- Input fields stack vertically, 100% width
- Password strength indicator rules collapse/expand toggle (space constraint)
- CTA button full-width
- Font: 16px base (prevent auto-zoom on iOS; 16px+ on input fields)
- Spacing: 24px section gaps, 16px field gaps

**Tablet (768px–1023px):**
- Single-column form, max-width 480px, centered
- Visible password strength indicator with full rules list
- CTA button at 100% width of form

**Desktop (1024px+):**
- Single-column form, max-width 480px, centered
- Email display and password strength indicator side-by-side (optional; or stack for consistency)
- CTA button at 100% width of form
- Decorative sidebar card (optional): "Why invite-only?" / security message

---

## Success Metrics

1. **Invite acceptance rate:** % of sent invites resulting in completed account creation (target: >85%)
2. **Time to completion:** Median time from invite click to password set (target: <3 min)
3. **Password strength quality:** % of new users meeting "Strong" criteria (target: >90%)
4. **Error recovery rate:** % of users who encounter an error and successfully retry/resolve (target: >80%)
5. **Mobile completion:** % of invite acceptances on mobile vs. desktop (establish baseline; optimize UX parity)
6. **Token expiry friction:** % of invites expired before use (monitor; may indicate send-to-accept timing issue)

---

## Competitor Comparison

**Standard patterns (invite acceptance flows):**
- **Slack, Notion, GitHub:** Token-based validation; combined password + profile fields; real-time strength feedback; redirect to product dashboard post-signup
- **Common UX:** Loading spinner, inline validation, disabled CTA until all fields valid, clear error states

**DealFlow differentiation:**
- **Read-only email field:** Pre-populated from invite (no re-entry risk in enterprise context)
- **Higher password entropy:** 12-char minimum + mixed case + number + special char (vs. typical 8-char minimum) reflects M&A advisory data-sensitivity compliance expectations
- **One-shot token:** Token invalidated after successful use (prevents account takeover via token reuse)
- **Named invite source:** Display "Invited by [admin name]" for transparency (optional; builds trust in pilot phase)

---

## Notes

- **No "back" link:** User is committing to account creation; no escape path mid-flow
- **Browser session persistence:** After successful password set, user should not need to log in again on this device for 7+ days (refresh token lifecycle)
- **Accessibility:** Form labels linked to inputs; password strength rules keyboard-navigable; error messages announced to screen readers; WCAG AA compliance
- **Security:** All endpoints require HTTPS; password hashing uses bcrypt or argon2; token transmitted only in URL (not logged/cached); POST response does not echo password


---
**Approved design (v9):** `design/accept-invite.html`
