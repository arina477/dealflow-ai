# Login Page — DealFlow AI

**Route:** `/login`  
**Module:** Auth & RBAC  
**Feature:** #15 Auth & RBAC  
**Status:** Pilot phase (financial data; security-critical)

---

## Purpose

Entry point for all DealFlow AI users — Advisors, Analysts, Compliance officers, and Admins. Authenticates identity and establishes secure session before role-aware dashboard routing. No public self-signup; all accounts are admin-invited via email with temporary credentials or SSO link.

---

## Audience

- **Anonymous users** (unauthenticated, at `/login` or redirected from protected routes)
- **Primary personas:** Advisor (deal-sourcing lead), Analyst (diligence detail), Compliance (outreach sign-off), Admin (user + account mgmt)
- **Entry state:** No session token; no browser auth context

---

## Entry Points

1. **Direct navigation** — User bookmarks or types `/login` in browser
2. **Redirect from protected route** — User lands on any guarded page without valid session; UI redirects to `/login` with `?next=/requested-route` query param for post-auth resume
3. **Session expiry** — Session timeout or token refresh failure; user bounced to `/login` with dismissible alert ("Session expired; please sign in again")
4. **Admin invite** — User clicks email link (one-time invite token); lands at `/login` with `?token=<invite_token>` (pre-fills email, prompts password creation if first-time)

---

## Content Sections

### Branded Sign-In Card

- **Logo & branding** — DealFlow AI wordmark + tagline ("AI-Driven Deal Intelligence for M&A")
- **Card layout** — Centered, max-width 400px, white background, subtle shadow, rounded corners (8px radius)
- **Typography** — H1 "Welcome to DealFlow"; body copy "Sign in to access deal intelligence and compliance tools"
- **Responsive** — Stacks full-width on mobile (<640px); 90% width with side margins on tablet; fixed 400px + centered on desktop

### Email / Password Form

- **Email field**
  - Label: "Email address"
  - Placeholder: "your@email.com"
  - Type: `email`
  - Validation: required, valid email format
  - Pre-fill from `?email=` query param if present
  - Pre-fill from `?token=` invite if present (extracts email from invite JWT)

- **Password field**
  - Label: "Password"
  - Placeholder: "••••••••"
  - Type: `password`
  - Auto-complete: `current-password`
  - Validation: required, min 8 chars shown only in error state (not inline)

- **"Remember me" checkbox** (optional; flagged for later implementation if auth cookie preference needed)
  - Label: "Keep me signed in for 30 days"
  - Default: unchecked (security first for pilot phase; MFA users may toggle)

- **Submit button**
  - CTA: "Sign in" (blue, primary color)
  - Width: 100% of form
  - Disabled state: when form invalid or submission in flight
  - Loading indicator: spinner inside button during submission

### Forgot Password Link

- **Placement** — Right-aligned below password field, subtle text link (gray, 12px)
- **Behavior** — Routes to `/auth/forgot-password` (separate page; see password-reset.md if needed)
- **Label** — "Forgot password?"

### SSO / Alternative Auth (Placeholder)

- **Divider** — "Or" centered between form and SSO options (faint gray line)
- **SSO button** (if configured; admin toggles via settings)
  - Label: "Sign in with Google" or "Sign in with [Provider]"
  - Icon: provider logo (Google, Okta, etc.)
  - Behavior: OAuth redirect to `/auth/callback` with session establishment
- **Note** — SSO fully optional for pilot; email/password is mandatory auth method

### Error Display Area

- **Placement** — Above email field
- **Style** — Alert box, red/warning background, bold error icon, black text
- **Messages & states** — See "Empty / Error / Loading States" below

---

## Interactions

### Form Submit

- **On "Sign in" click:**
  1. Validate email + password locally (format check)
  2. Disable button, show loading spinner
  3. POST to `/api/auth/login` with JSON body: `{ "email": "...", "password": "..." }`
  4. On 200 OK: receive `{ "token": "JWT", "user": { "id", "email", "role", "name" }, "next": "/dashboard" }`
  5. Store token in secure, HTTP-only cookie (or memory if SPA; no localStorage for secrets)
  6. Redirect to `?next=` param value or role-aware dashboard default
  7. Clear form

- **On 401 Unauthorized:**
  1. Show error: "Invalid email or password" (generic, no account-existence leak)
  2. Re-enable button
  3. Focus email field
  4. Log failed attempt (for audit + rate-limiting backend)

- **On 403 Forbidden (account locked / disabled):**
  1. Show error: "This account is temporarily locked. Contact support."
  2. Disable form
  3. Show support contact link

- **On 429 Too Many Requests (rate-limited):**
  1. Show error: "Too many sign-in attempts. Try again in 5 minutes."
  2. Disable form for 5 min (countdown timer optional)
  3. Clear form

- **On network error / timeout (>10s):**
  1. Show error: "Connection error. Please check your internet and try again."
  2. Re-enable button
  3. Do NOT auto-retry

### Forgot Password Flow

- Click "Forgot password?" → `/auth/forgot-password` (email entry page, separate design doc)
- User enters email, receives reset link via email
- Clicking reset link → `/auth/reset-password?token=<reset_token>` (password creation page, separate design doc)

### Invite Token Flow (Admin-invited first-time user)

- **Scenario:** Admin invites user; user clicks email link with `?token=<invite_jwt>`
- **On page load with valid token:**
  1. Decode token (client-side, verify format only; full validation on backend)
  2. Extract email + pre-fill email field
  3. Show prompt: "Set your password to get started"
  4. Password field focuses by default
  5. Submit button label: "Create account" (instead of "Sign in")

- **On submit:**
  1. POST to `/api/auth/register-from-invite` with `{ "email": "...", "password": "...", "token": "..." }`
  2. Backend verifies token, creates user account, returns JWT
  3. Same success flow as normal sign-in (redirect to dashboard)

- **On token expired / invalid:**
  1. Show error: "Invitation expired or invalid. Contact your administrator for a new link."
  2. Clear form, hide create-account button

---

## Data Requirements

### Request Payload (to `/api/auth/login`)

```json
{
  "email": "user@firm.com",
  "password": "plaintext_password"
}
```

### Response Payload (200 OK)

```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "usr_abc123",
    "email": "user@firm.com",
    "role": "advisor|analyst|compliance|admin",
    "name": "John Doe",
    "avatar_url": "https://api.dealflow.local/avatars/usr_abc123.png"
  },
  "next": "/dashboard"
}
```

### Error Response (4xx / 5xx)

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS | ACCOUNT_LOCKED | RATE_LIMITED | INTERNAL_ERROR",
    "message": "User-facing error text"
  }
}
```

---

## Empty / Error / Loading States

| **State** | **Trigger** | **UI Behavior** |
|---|---|---|
| **Empty (initial load)** | User lands at `/login` with no prior context | Form is blank, all fields empty, button enabled, no alerts |
| **Loading** | User submits form | Button shows spinner, fields disabled, no error alerts |
| **Invalid credentials (401)** | POST returns 401 + `code: INVALID_CREDENTIALS` | Red alert: "Invalid email or password" (generic); button re-enabled, focus email |
| **Account locked (403)** | POST returns 403 + `code: ACCOUNT_LOCKED` | Red alert: "This account is locked. Contact support@dealflow.local"; form disabled, support link clickable |
| **Rate limited (429)** | POST returns 429 after 5+ failed attempts in 15 min | Red alert: "Too many attempts. Try again in 5 minutes" (show countdown timer); form disabled for duration |
| **Network error** | Fetch timeout (>10s) or network unreachable | Yellow alert: "Connection error. Check your internet and try again"; button re-enabled |
| **Server error (5xx)** | POST returns 500+ | Red alert: "Service error. Our team has been notified. Try again in a few moments"; button re-enabled; contact support link |
| **Invalid invite token** | Page load with `?token=...` that is expired / tampered / revoked | Red alert: "Invitation expired or invalid. Ask your administrator for a new link"; form hidden or disabled |
| **Session expired** | User redirected to `/login` after session timeout | Dismissible info alert: "Your session ended. Sign in again to continue"; form ready for new login |

---

## Responsive Breakpoints

| **Breakpoint** | **Width** | **Layout** |
|---|---|---|
| **Mobile** | 320–639px | Form card 90% width, vertical stack, full-height viewport, no padding below form |
| **Tablet** | 640–1023px | Form card 70% width or max 450px, centered, footer links below |
| **Desktop** | 1024px+ | Form card 400px, fixed width, horizontally/vertically centered, footer links (Terms / Privacy) bottom-right corner |

---

## Success Metrics

1. **Sign-in success rate** — % of login attempts that reach post-auth redirect (target: >95%, exclude rate-limited attempts)
2. **Average time to sign-in** — Median time from form load to post-auth redirect (target: <2s, excluding network latency outliers)
3. **Password reset usage** — % of users who click "Forgot password?" in first session (target: <5% in pilot; indicates onboarding clarity issue if higher)
4. **Failed login error clarity** — Qualitative: do users understand "invalid email/password" vs account-locked vs rate-limit? (feedback from pilot cohort; adjust messaging if >20% re-attempt immediately)
5. **SSO adoption (if enabled)** — % of sign-ins via OAuth vs email/password (target: >30% if SSO configured; helps measure user preference + IT alignment)
6. **Session timeout compliance** — % of sessions lasting <8 hours (target: >85%; validates "remember me" isn't bypassing security)

---

## Competitor Comparison

**Standard Secure Sign-In Baseline**

- **Stripe, Slack, GitHub** — Email + password, optional "remember me", forgot-password link, branded card, 400–500px width, ~2s latency on typical connection
- **DealFlow differentiation** — None at login layer (auth is table-stakes); differentiation is downstream in dashboard, deal sourcing, and compliance workflows. **Competitive advantage lives in role-aware post-auth routing and speed of advisor reaching first deal.**
- **Pilot security requirement** — Financial data + near-term partner sensitivity mandate HTTP-only token storage, sub-5-minute session timeout, rate-limiting (max 5 attempts per IP per 15 min), and optional IP whitelisting for admin accounts (configured server-side, not visible in UI)

---

## Accessibility & Compliance

- **WCAG 2.1 AA** — Form labels linked to inputs, keyboard navigation (Tab through fields, Enter to submit), error messages announced to screen readers
- **SOC 2 / Financial data** — HTTPS-only, CSP headers to block mixed content, no credential logging, rate-limiting logged (audit trail for compliance review)

---

## Technical Implementation Notes

- **Client validation** — Email format + password required (min 8 chars shown only on error)
- **Server validation** — Full rate-limiting, account-status check, password verification (bcrypt or equivalent), JWT signing with 1h TTL
- **Token storage** — Secure, HTTP-only, SameSite=Strict cookie; no localStorage (XSS vector)
- **Redirect logic** — Parse `?next=` parameter, validate against whitelist of safe routes (prevent open-redirect), fallback to role-based dashboard default
- **Invite flow** — JWT token embedded in email link, validated server-side, one-time use, 24h expiry


---
**Approved design (v9):** `design/login.html`
