# D-1 Brief — Create-firm onboarding screen (wave-37)
## Gap: no self-serve "create your firm workspace" screen exists (signup is invite-only today). NEW page/flow.
## Second (minor) gap: grant-admin control — an ADDITION to the EXISTING members UI (apps/web/.../admin/users AdminUsersClient.tsx already has a role-change control per P-4 karen). Design = ensure 'admin' is a selectable role + a friendly "can't demote the last admin" (409) message. NO new page — reuse the existing members table + role-select pattern.
## Create-firm screen — success criteria:
- A new user (no workspace) lands here to CREATE their firm: a single clear form — **Firm name** input + **Create workspace** primary CTA. Optionally a one-line "you'll be the admin" note.
- Matches the existing auth/onboarding aesthetic (the login page + any welcome pattern) + design/DESIGN-SYSTEM.md tokens (zinc/emerald, the app font, 4px grid, one primary CTA).
- An entry point from the login page: "Set up a new firm" / "Create a firm" link (for someone without an invite).
- Accessible: labeled input, keyboard, focus ring, one primary CTA, error state (e.g. empty name, or a name conflict).
- Compliance-first, professional M&A tone (not consumer-playful).
- Reuse the existing auth-card layout / component if one exists — do NOT invent a new visual language.
## Reference: design/ existing auth/login pages + DESIGN-SYSTEM.md. Target: design/staging/create-firm.html (D-2) → design/create-firm.html (D-3).
