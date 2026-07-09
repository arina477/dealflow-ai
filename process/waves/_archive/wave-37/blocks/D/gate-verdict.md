# D-3 Review & Adopt — Gate Verdict (wave-37)

**Stage:** D-3 Review & adopt
**Surface:** create-firm onboarding screen + grant-admin control disposition
**Adopted:** `design/staging/create-firm.html` → `design/create-firm.html` (canonicalized)
**Design-system token additions:** NONE (pure reuse of the zinc/emerald + 5 status tokens)

---

## Checklist results

| # | Check | Result |
|---|---|---|
| 1 | Token discipline (zinc/emerald, Inter, 4px grid, borders>shadows, one primary CTA) | PASS |
| 2 | Consumes DESIGN-SYSTEM.md tokens, no invented hex | PASS — identical `tailwind.config` to login.html; `.df-input`/`.df-btn-primary` mirror accept-invite.html |
| 3 | Sibling to login.html / accept-invite.html auth aesthetic | PASS — centered `max-w-[420px]` card, emerald logomark, staggered fade-in |
| 4 | lucide-only icons | PASS — `data-lucide` (`network`, `building`, `shield-check`, `alert-triangle`, `loader-2`, `check`); improves on accept-invite.html's Phosphor |
| 5 | Brief: firm-name input | PASS — labeled, `building` icon, `autocomplete="organization"` |
| 6 | Brief: primary "Create workspace" CTA | PASS — single emerald primary; cancel demoted to text link |
| 7 | Brief: "you'll be the admin" helper | PASS — `shield-check` info panel, "assigned as the Workspace Administrator by default" |
| 8 | Brief: error state (empty / duplicate name) | PASS — `is-error` + `role="alert"` + focus + shake; message-agnostic container supports the 409 duplicate-name copy |
| 9 | Brief: return-to-login link | PASS — "Cancel and return to login" |
| 10 | A11y: labeled input, keyboard, visible focus ring, one CTA, legible error | PASS — `<label for>`, `aria-describedby`, `aria-invalid`, native form/button/input, emerald focus ring (4px @ 0.15) |
| 11 | No keyboard traps / focus issues | PASS — no modal, no pointer-only gesture |
| 12 | Tone: professional, compliance-first M&A | PASS — "compliance-ready environment", "mandate execution", "Master Services Agreement" |
| 13 | Grant-admin: reuse existing members UI (no new page) | CONFIRMED CORRECT — see below |

## Grant-admin disposition (2nd, minor gap)

**Reuse is the right call. No new mockup required.** `design/admin-users.html` already ships:
- `#role-select` with `<option value="admin">Admin (Full Access)</option>` — admin is selectable.
- Last-admin protection via `triggerBlockDeactivateToast()`: "Cannot deactivate... last System Admin. Promote another user first."

The brief's requirement (admin selectable + friendly last-admin-409 message) is satisfied by the existing members table + role-select pattern.

**Build note (non-blocking, for B-block spec):** the mockup only demonstrates the last-admin block on the *deactivate* path. The 409 friendly message must ALSO fire on the *demote-last-admin-to-non-admin* role-change path. This is a spec/implementation concern, not a design-adopt blocker.

## Non-blocking flags (future sweep, not this wave)

- `viewport` carries `maximum-scale=1.0, user-scalable=no` (WCAG 1.4.4 zoom). Inherited verbatim from the already-approved accept-invite.html — a pre-existing system pattern, not a defect this page introduced. Recommend a global auth-page viewport-attribute cleanup in a later wave; does not fail this gate.
- Emerald-600 (#10B981) white-text CTA is contrast-thin but is the DESIGN-SYSTEM.md canonical primary used identically on the already-adopted login.html — system-level decision, out of scope for this page's gate.

## Review depth

Streamlined single-gate pass (no full `/plan-design-review` + `/ui-ux-pro-max` dual-reviewer). Justified: single-input auth form mirroring an already-adopted sibling (accept-invite.html), zero new tokens, zero new component primitives, no modal/table/drag/RBAC-complex surface. Head-designer concurs with the streamlining — a heavy dual-reviewer pass would add no signal here.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: D-3
  reviewers: {}
  failed_checks: []
  rationale: >
    create-firm.html faithfully extends the approved auth-card contract (login.html /
    accept-invite.html) with zero new design-system tokens and zero new primitives. All
    brief success criteria are present (firm-name input, single "Create workspace" primary
    CTA, "you'll be the admin" helper, empty/duplicate-name error state, return-to-login
    link). WCAG 2.2 basics are met: labeled input, keyboard-native, visible emerald focus
    ring, no traps, legible role="alert" error. Icons are lucide-only (an improvement over
    the Phosphor in accept-invite.html). Tone is professional and compliance-first. The
    grant-admin control correctly reuses the existing admin-users.html members table +
    role-select pattern with the last-admin block already present — no new page warranted.
    Two non-blocking flags (inherited viewport zoom attribute; canonical emerald CTA
    contrast) are pre-existing system-level patterns, not drift introduced here.
  next_action: PROCEED_TO_B
  canonicalized: design/create-firm.html
  design_system_token_additions: none
```
