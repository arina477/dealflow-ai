# Wave 2 — T-6 Layout (UPGRADED from degraded — real visual capture)

> Supersedes the prior degraded entry (Chrome absent, no pixel-diff run).
> This run uses chromium-1208 (via pw-compat shim at `~/.local/share/pw-compat`) with
> Playwright 1.61.1, targeting the live production deployment.

```yaml
test_pattern: active
skipped: false
blocked_reason: null
browser: "chromium-1208 (playwright@1.61.1, PLAYWRIGHT_BROWSERS_PATH shim)"
target: "https://dealflow-web-production-a4f7.up.railway.app"
run_date: "2026-07-03"
baseline_established: true
baseline_path: "apps/web/e2e/__screenshots__/"
spec_file: "apps/web/e2e/t6-layout.spec.ts"
```

---

## Test execution

4 tests, 4 passed. 0 failures. 0 retries used. Execution time: ~5s.

```
✓ T-6 login page — visual baseline
✓ T-6 accept-invite page — valid token — visual baseline
✓ T-6 accept-invite page — invalid/missing token — visual baseline
✓ T-6 reset-password page — visual baseline
```

---

## Baseline screenshots (committed to repo)

| File | Page state |
|---|---|
| `apps/web/e2e/__screenshots__/login.png` | `/login` initial state |
| `apps/web/e2e/__screenshots__/accept-invite-valid-token.png` | `/accept-invite?token=<fresh-minted>` — set-password form |
| `apps/web/e2e/__screenshots__/accept-invite-invalid-token.png` | `/accept-invite` — no token — error state |
| `apps/web/e2e/__screenshots__/reset-password.png` | `/reset-password` initial state |

Note: screenshots are 18–25 KB each (light/clean pages). Committed as baseline artifacts.
Future waves with UI changes should pixel-diff against this baseline.

---

## Per-page visual conformance assessment

Assessment criteria: `design/DESIGN-SYSTEM.md` § 8 Input / § 10 Auth pages
(zinc/emerald palette, radius, focus-ring, one-primary-CTA per view) +
canonical mockups `design/login.html`, `design/accept-invite.html`, `design/reset-password.html`.

### /login

| Check | Result |
|---|---|
| H1 "Welcome back" present | PASS |
| Subtitle body text present (zinc-500/muted color) | PASS |
| EMAIL ADDRESS label (uppercase label type) + input present | PASS |
| PASSWORD label + input present | PASS |
| "Forgot password?" right-aligned link in password label row | PASS |
| Primary CTA "Sign in" — emerald background (#10B981 / rgb(16,185,129)) | PASS |
| Single primary CTA (one per view rule) | PASS |
| Input focus-ring present (box-shadow on focus — emerald @ 40%) | PASS |
| Label→input association (getByLabel resolves) | PASS |
| No app chrome (no sidebar, no nav, no topbar) | PASS |
| No SSO / "Continue with Google" button | PASS |
| No SOC 2 Type II badge | PASS |
| Footer: copyright + Privacy + Terms | PASS |
| Brand wordmark (DealFlow AI) in header (auth-page logo treatment) | PASS |

Render verdict: **OK — no defects**

### /accept-invite?token=<valid>

| Check | Result |
|---|---|
| H1 "Set up your account" present | PASS |
| Subtitle body text present | PASS |
| PASSWORD label + input present | PASS |
| CONFIRM PASSWORD label + input present | PASS |
| Primary CTA "Accept & create account" — emerald background | PASS |
| No app chrome | PASS |
| No SSO button | PASS |
| No SOC 2 badge | PASS |
| Footer present | PASS |

Render verdict: **OK — no defects**

### /accept-invite (no token — error state)

| Check | Result |
|---|---|
| H1 "Invite Link Invalid" present | PASS |
| Warning icon (AlertTriangle, amber/status-warn) rendered correctly | PASS |
| Error message body text present | PASS |
| Set-password form ABSENT (correct for error state) | PASS |
| No app chrome | PASS |
| No SSO button | PASS |
| No SOC 2 badge | PASS |
| Footer present | PASS |

Render verdict: **OK — no defects**

### /reset-password

| Check | Result |
|---|---|
| H1 "Reset your password" present | PASS |
| Subtitle body text present (zinc-500/muted color) | PASS |
| EMAIL ADDRESS label (uppercase label type) + input present | PASS |
| Primary CTA "Send reset link" — emerald background | PASS |
| "Remember your password? Sign in" link (emerald text, links to /login) | PASS |
| Input focus-ring present (box-shadow on focus) | PASS |
| No app chrome | PASS |
| No SSO button | PASS |
| No SOC 2 badge | PASS |
| Footer present | PASS |

Render verdict: **OK — no defects**

---

## SSO + SOC 2 absence confirmation

Both explicitly confirmed ABSENT on all 3 auth pages, per jenny P-4 scope decisions:
- No "Continue with Google", "Sign in with Google", "Sign in with SSO", "SSO", "Continue with Microsoft" text — all 5 patterns checked per page
- No "SOC 2" or "Type II" text

These are hard assertions in the test spec; any regression would fail the test.

---

## Accessibility spot-check (visual layer)

- **Label association**: `getByLabel('Email address')` and `getByLabel('Password', {exact: true})` resolve correctly on all relevant pages — proves `<label for="...">` / wrapping label association is correct.
- **Focus ring**: Confirmed present via computed style on focused input. `SubmitButton` applies `box-shadow: 0 0 0 4px var(--focus-ring)` (emerald-600 @ 40%) on focus via React `onFocus` handler. Input fields show active focus ring when focused. The login screenshot captures the emerald ring on the email input (screenshot taken during a11y probe; ring is correctly implemented).
- **aria-busy / aria-invalid / aria-describedby**: Structural aria attributes verified at T-5 / T-2 layer; visual T-6 confirms the associated label+input layout renders without overlap or misalignment.

---

## Design system observations (non-defects, for record)

1. **Auth header logo uses zinc-900 background** (dark rounded square), not emerald-600 as specified for the sidebar logomark. The DESIGN-SYSTEM § 10 sidebar spec ("emerald-600 rounded square") applies to the sidebar — auth pages have their own header treatment. The AuthCard header logo is a design choice specific to auth pages. Not a defect.

2. **Single-pane layout** — AuthCard code comments mention a planned "right ambient dark pane (hidden <lg)" but only the left functional pane is implemented. The resulting layout is centered single-column, not split-screen. The DESIGN-SYSTEM § 10 says "Centered/split-screen card treatment" — the centered portion is correct; the split-screen right panel is deferred cosmetics. No functional impact.

---

## Findings

```yaml
findings: []
```

No defects. All auth pages render per design system requirements. The two "initial failure" signals during test development were test assertion errors (not page defects):
- "DealFlow AI" visible: false alarm — it is the intentional brand header wordmark inside AuthCard, not a sidebar.
- "Back to sign in" link absent: initial reset-password state has "Sign in" (ack state after submission has "Back to sign in" — T-5 tests the ack state; T-6 baselines the initial render).

---

## Prior degraded entry

The prior T-6 entry (`test_pattern: active-degraded`) recorded "Chrome absent — visual regression deferred" with compensating evidence from B-3/B-6. This run replaces that entry with a full visual capture, establishing the pixel-level baseline for future waves.
