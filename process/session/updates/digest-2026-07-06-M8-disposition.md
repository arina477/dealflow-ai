# Founder digest — 2026-07-06 · M8 closed, moving to integrations & insight

## What shipped and what we decided

**Pilot-partner data isolation is done and live.** The external design-partner firm now operates in its own isolated workspace with no cross-firm data visibility. We built this as deny-by-default database-level access control, and — importantly — we proved it works by running the app under a locked-down, non-privileged database account (not an admin shortcut) and confirming it can only ever see its own firm's data. That was the whole goal of this milestone, and it's shipped and running in production.

We called this milestone **complete** and moved on to the next one: **integrations & insight** (M9) — CRM sync and productivity analytics for advisors.

Your virtual board reviewed this call unanimously (7 of 7 in favor, no objections) before we advanced.

## One thing to keep on your radar (not urgent, but important later)

There's a real hardening item we deliberately deferred: making the app **refuse to save data when it can't tell which firm it belongs to** (today it falls back to the default firm). For the current single-firm pilot this is harmless — there's only one firm, so nothing can land in the wrong place, and reads are already locked down. But it **must be fixed before you ever onboard a second firm.** We've tied it to the future multi-tenant milestone as a hard prerequisite that cannot be skipped, so it won't get lost. No action needed from you now.

## Decisions waiting on you (all non-blocking — we're building around them)

1. **Deal-source data vendor** — to pull real company data (vs. sample data), we need you to pick a provider (e.g. a deal-sourcing data service) and supply its API key. This is a spending + account-setup decision only you can make. Until then, we're building the analytics/insight features that run on data we already have.
2. **Email sending credential** (still open) — needed to actually send compliant outreach and verify the sending domain.
3. **AI spending** (still open) — needed for the AI-written matching rationale and outreach drafts.

## What we're building next (wave 18)

An **advisor insights dashboard**: analytics on mandate throughput, outreach response rates, advisor productivity, and match accept/reject rates — computed entirely from data we already have, no new vendor or spend required. A new `/insights` page, its data service, and a secure role-scoped API behind it.
