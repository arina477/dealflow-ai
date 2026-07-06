# Update — Admin milestone wrapped, moving to workspace isolation (2026-07-06)

## What just shipped and what's next

The **Admin & Settings** work is now functionally complete for what we can build without you. Firms can connect a data source, invite teammates, and assign roles — all live in production. We're moving the next round of work to **isolated workspaces for your first outside partner firm**, so their confidential deal information can never be seen by any other firm. That's a make-or-break trust requirement in M&A and the right thing to have ready before your design partner arrives.

## Two things need a quick decision from you (nothing is blocked waiting — we're building around them)

1. **Sending compliant outreach emails is still on hold.** To let the product actually send verified outreach on a firm's behalf, we need an email-provider account key (and one webhook secret). This is the same item we flagged before — it's the only thing keeping both the outreach feature and the "verify your sending domain" step from going live. Everything else around it is already built and waiting. When you're ready, send us the email-provider credentials and we'll switch it on.

2. **How should we measure "workspace isolation is done"?** We know the goal — the partner firm operates in its own isolated space with zero visibility into other firms' data — and we're building to exactly that, proven with an automated test that tries (and fails) to read across firms. If you have a specific success bar in mind beyond "no cross-firm visibility," tell us and we'll lock it in; otherwise we proceed with that target.

## Why we didn't just polish the admin screens

There were three small, low-risk cleanup items left on the admin work. We chose not to spend a whole build cycle on near-invisible polish while your incoming partner needs data isolation first. The cleanup items are logged and will be picked up later; they're not going anywhere.
