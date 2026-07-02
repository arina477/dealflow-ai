# Reset Password — DealFlow AI

## Purpose
Enable all users (M&A advisory staff, deal leads, analysts, executives) to securely reset forgotten passwords via email-verified token flow. Supports both the initial password reset request and the token-confirmation reset-and-login sequence.

## Audience
- **Primary:** Logged-out users who forgot their password
- **Secondary:** Active users who request a manual password reset for security
- **Tertiary:** Admins resetting user passwords on behalf (future; out of scope for v0)

## Entry Points
- Login page: "Forgot password?" link below submit button
- Direct navigation: `/reset-password` (unauthenticated)

## Content Sections

### Request Form (`/reset-password?step=request`)
- **Heading:** "Reset your password"
- **Subheading:** "Enter your email address and we'll send a reset link."
- **Email input field:** Placeholder "your.email@firm.com"; required, email-validated
- **Submit button:** "Send reset link" (disabled until valid email)
- **Help text:** "Check your inbox and spam folder. Links expire in 24 hours."
- **Back link:** "Remember your password? Sign in"

### Confirm-with-Token Form (`/reset-password?token=<JWT>`)
- **Heading:** "Create a new password"
- **Subheading:** "You're 1 step away from regaining access."
- **Password input:** Placeholder "New password"; show strength meter (weak/fair/strong); require ≥12 chars, 1 uppercase, 1 number, 1 special char
- **Confirm password input:** Placeholder "Confirm new password"; real-time match validation
- **Submit button:** "Reset password" (disabled until both fields match and meet strength)
- **Help text:** "Passwords are encrypted and never stored in plain text."

## Interactions

### Request Link
1. User enters email address and clicks "Send reset link"
2. Backend validates email exists in `users` table (silent success on unknown email — no enumeration risk)
3. Backend generates 24-hour JWT token + creates reset record in `password_resets` table with hash + expiry
4. Backend sends email to address with `/reset-password?token=<JWT>` link
5. Frontend shows confirmation: "Check your email for reset instructions"
6. User navigates to emailed link or re-enters manually via `/reset-password?token=<JWT>`

### Set New Password
1. Backend validates JWT signature + expiry (fail gracefully if expired or invalid)
2. User enters new password; frontend validates strength and match in real time
3. User clicks "Reset password"
4. Backend hashes password, updates `users` table, invalidates all existing reset tokens + sessions for that user
5. Frontend redirects to login with success message: "Password reset successful. Sign in with your new password."
6. User logs in with new credentials

## Data Requirements

### Endpoints
- `POST /auth/reset-password/request` — submit email; return `{ success: true, message: "..." }`
- `POST /auth/reset-password/confirm` — submit token + new password; return `{ success: true, redirect: "/login" }` or error
- `GET /auth/reset-password/validate-token` — optional: frontend validates token on page load (optional; backend validates on submit)

### Database Tables
- `users` — lookup by email; update `password_hash`
- `password_resets` — store `user_id`, `token_hash`, `created_at`, `expires_at`, `used=false` (or soft-delete on use)

## Empty / Error / Loading States

| Scenario | Behavior | Message |
|----------|----------|---------|
| **Unknown email** | Silent success (no enumeration); email not sent | "If an account exists, we'll send a reset link." |
| **Expired token** | Redirect to request form; clear token from URL | "Reset link expired. Request a new one below." |
| **Invalid token** | Redirect to request form | "Invalid reset link. Request a new one." |
| **Weak password** | Inline validation; disable submit | "Password must be ≥12 chars, 1 uppercase, 1 number, 1 special char" |
| **Passwords don't match** | Inline validation; disable submit | "Passwords do not match." |
| **Network error on request** | Show retry button | "Unable to send reset link. Check your connection." |
| **Network error on confirm** | Show retry button; preserve entered password | "Unable to reset password. Check your connection." |
| **Loading (sending email)** | Submit button shows spinner; disabled | "Sending reset link..." |
| **Loading (confirming)** | Submit button shows spinner; disabled | "Resetting password..." |

## Responsive Breakpoints
- **Mobile (<640px):** Single-column form; full-width inputs; 16px min font (prevent auto-zoom on iOS); ~80-char line length
- **Tablet (640–1024px):** Centered form, max-width 400px, 24px margins
- **Desktop (>1024px):** Centered form, max-width 400px, 32px margins; focus-visible ring on all inputs

## Success Metrics
- **Completion rate:** % of password reset requests that result in successful login within 24h
- **Time-to-reset:** Median time from request to confirmed password reset
- **Token expiry rate:** % of issued tokens that expire unused (monitor for UX friction)
- **Error recovery rate:** % of users who successfully retry after a network error
- **Email delivery:** % of reset emails reaching inbox (monitor via email service provider)

## Competitor Comparison

### Standard Industry Patterns
- **Request form is simple:** Email-only entry; no secondary verification (security questions rarely used in 2026)
- **Token delivery via email:** Gold standard for async, non-phishing-prone reset (beats SMS in B2B advisory context)
- **24h token expiry:** Balances security and UX; aligns with Okta, Auth0, GitHub
- **Silent success on unknown email:** Prevents user enumeration; standard for security-conscious platforms
- **Password strength enforcement:** 12+ chars, mixed case, number, special char is current baseline (stripe, AWS, Slack)
- **Real-time validation:** UX best practice; prevents user frustration from submit-time failures

**DealFlow AI differentiation:** None required v0; standard secure reset is table-stakes and trust signal for advisory firms handling sensitive M&A data.


---
**Approved design (v9):** `design/reset-password.html`
