# Wave 12 — T-6 layout (active)
- **C-2 deployed authed:** the /pipeline board (31.6KB authed HTML) renders all 7 FIXED stage columns in order (the P-4 build-note requirement — NOT design/pipeline.html's illustrative labels). Board pattern per design/pipeline.html adapted to the 7-stage taxonomy. Zero send/AI affordances.
- Unauth guard: /pipeline redirects to /login (auth-guarded).
## Residual (non-blocking)
- Authed visual screenshots (mobile 375px, per-card detail drawer/timeline panel legibility) not captured as authed screenshots (invite→signup flow; recurring test-cred registry gap). Structure verified via C-2's authed HTML + D-3-era pipeline.html mockup + web component tests (board 7 columns + timeline panel + error-state tests).
```yaml
test_pattern: active
findings:
  - {severity: LOW, layout, description: "authed mobile/detail visual screenshots not captured (structure verified via authed HTML + component tests)"}
```
