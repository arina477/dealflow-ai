# Wave 11 — T-6 layout (active)
- Unauth guard: /outreach-templates, /outreach-composer, /compliance-queue all render 200 → client-redirect /login, zero console errors (ui-comprehensive-tester, desktop+mobile captures under blocks/T/screenshots/).
- Authed page structure: C-2 fetched the real authed HTML (composer 76KB, compliance-queue 22KB, templates 22KB — full pages, not the login shell) — pages render with content, correct CTA, AC-STRIP clean.
## Residual gap (non-blocking)
- Authed VISUAL screenshots (design-system fidelity zinc/emerald + lucide, mobile 375px overflow, gate-verdict panel legibility) not captured as authed screenshots (fresh tester lacked the invite→signup flow). Design fidelity was adopted at D-3 (design/templates-library.html, outreach-composer.html, compliance-queue.html) + built to spec; unit/component tests green. Flag for V-1 authed visual pass if needed.
```yaml
test_pattern: active
findings:
  - {severity: LOW, layout, description: "authed visual screenshots (mobile/design-fidelity) not captured on deployed prod; structure verified via authed HTML + D-3 adoption + component tests"}
```
