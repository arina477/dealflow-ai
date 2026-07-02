# Direction Brief — DealFlow AI

## Product one-liner
An AI platform that sources M&A deals, ranks buyer-seller matches, and runs compliant, audited email outreach in one workflow — for a mid-market M&A advisory firm replacing five stitched-together tools.

## Audience tone
Internal users at an M&A advisory firm — advisors/deal leads, analysts, compliance reviewers. Time-pressured professionals working dense financial/deal data all day. They need to feel the tool is **credible, precise, and trustworthy** (it handles regulated outreach and an auditable record), while being **fast and uncluttered** — not an enterprise-bloated CRM. Confidence over flash.

## Emotional anchors
Credible · calm · precise · fast · trustworthy (audit-grade) · no-BS

## Visual references
- **DealCloud (Tier 1):** enterprise deal-management incumbent — match its credibility/structure but BEAT its density/bloat and dated feel. See `command-center/artifacts/competitive-benchmarks/dealcloud.md`.
- **Grata (Tit 1):** modern, clean sourcing UI — instructive for a contemporary, approachable data interface. See `command-center/artifacts/competitive-benchmarks/grata.md`.
- **Affinity (Tier 2):** relationship/CRM clarity — instructive for calm information density. See `command-center/artifacts/competitive-benchmarks/affinity.md`.
- **External — Linear:** for precision, speed, restraint, crisp typography and spacing rhythm.
- **External — Stripe Dashboard:** for credible, legible data presentation and trustworthy financial-grade polish.

## Hard constraints
- **Desktop-first** internal tool: must render cleanly at 1280 and 1440 (primary), usable at 1024; mobile is degraded/secondary (not a phone-first product).
- **Light mode as default** (founder choice). Design tokens should be structured so a future dark mode is feasible, but light is the canonical direction.
- Must render the dashboard with **real-looking M&A content** (real mandate names, buyer firms, fit scores, outreach statuses, a compliance-queue count) — NOT lorem ipsum.
- Must visibly express the three product pillars at a glance: deal sourcing/mandates, AI ranked matching, and compliant outreach + audit/compliance status.
- Clear visual language for **status** (outreach sent/opened/replied; pipeline stages; compliance pending/approved) — this product is status-heavy.

## The page to design
**Dashboard** (`/`) — the role-aware home screen advisors land on after sign-in. Pull content/anatomy from `command-center/product/per-page-pd/dashboard.md`. Should surface: active mandates with status, pipeline snapshot, outreach activity (sent/opened/replied), and the compliance approval queue — laid out so a deal lead grasps "what needs my attention" in seconds. Include the primary navigation (sidebar or top nav) since it frames every other screen.

## Out of scope for this direction pass
- Multi-page consistency (comes in v9)
- Component variants / full token system (comes in v8)
- Edge/empty/error states (comes in v9)
- Dark mode rendering (light is the canonical direction)
