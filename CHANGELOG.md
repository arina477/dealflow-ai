# Changelog

## [0.29.0] — 2026-07-09 — Hand off or step down from the admin role, safely (M7)

Admins can now pass the admin role to a teammate and step themselves down, without ever leaving a firm with no admin in charge. Promoting someone and stepping down happens as one all-or-nothing action, a confirmation step guards these changes so they can't happen by accident, and every role change is written to the firm's tamper-evident record and shown in the admin activity view. This completes the earlier ask to be able to transfer or share the admin role later. Verified live on the deployed product.

### Added
- **Transfer the admin role, or step yourself down.** An admin can promote a teammate to admin and hand over their own admin role in a single move, or simply step themselves down to a regular member — all from within the app.
- **A confirmation step guards role changes.** Stepping down, transferring the role, or deactivating a member now asks you to confirm first, spells out exactly what will happen, and does nothing if you cancel.
- **Role changes show up in the admin activity view.** Every transfer and step-down now appears in the admin activity list — who changed whom, from which role to which, and when — newest first.

### Correctness / compliance
- **A firm can never be left with no admin.** If a role change would remove the last remaining admin, it is refused and nothing changes — even when two admins try to step down at the same moment. Role changes stay admin-only and within each firm.
- **Every role change is recorded, all-or-nothing.** Each successful transfer or step-down writes one entry to the firm's unbroken tamper-evident record; if anything fails partway, the whole change is undone — no half-applied role, no orphaned record.

### Provenance (transparency)
- **No email sent, no AI added.** This adds admin role controls and a confirmation step; nothing in the tamper-evident record is edited or deleted.

## [0.28.1] — 2026-07-09 — Database updates now apply reliably on every deploy

Some database changes were silently being skipped when the app deployed, so a couple of features shipped without their database piece actually in place. The cause was the order the updates were listed in, which let the deploy step report success while applying nothing. That ordering is fixed, and the deploy now applies every pending update reliably going forward. Verified live on the deployed product.

### Fixed
- **Pending database updates are no longer skipped on deploy.** A stale ordering in the update list let three recent database changes be passed over while the deploy still reported success, so they never reached the live database. The ordering is corrected and all three are now applied.
- **The rate-limit protection and the self-serve firm setup are now fully in place on the live database.** Both depended on a skipped update; their missing pieces (a rate-limit tracking table and the firm-setup routine) are now present and confirmed live.
- **Deploys apply database updates through a single reliable path.** A second, broken mechanism that could abort a deploy outright was removed in favour of the one path that works, so future updates apply durably every time.

## [0.28.0] — 2026-07-09 — Set up your own firm and manage admins, all in the app (M7)

A firm can now get started on its own: create its workspace, name the firm, and set up its first admin without anyone provisioning it by hand. Once inside, an admin can promote a teammate to admin from the app. Each new firm lands in its own private workspace, and only admins can change roles. Verified live on the deployed product.

### Added
- **Set up a new firm yourself.** A new "Set up a new firm" link on the sign-in screen opens a short create-workspace flow — enter a firm name, an email, and a password, and you land in the app as that firm's first admin, in a fresh private workspace of your own.
- **Promote a teammate to admin.** An admin can grant admin access to another member from the app; non-admins cannot, and the last remaining admin cannot be removed.

### Correctness / compliance
- **Each new firm gets its own isolated workspace.** A self-created firm lands in a fresh workspace that no other firm can see, confirmed live end-to-end. Only an admin can change a member's role; anyone else is refused.

### Provenance (transparency)
- **No email sent, no AI added.** This adds a self-serve setup flow and an admin control; nothing in the tamper-evident record is edited or deleted.

## [0.27.0] — 2026-07-09 — The full deal loop is proven working, and a site-wide outage is fixed (M6 / H1)

The complete deal loop now works end-to-end on the live app, proven step by step against the deployed product: an advisor gets a ranked shortlist, drafts an outreach, a compliance officer (a different person) approves it, the message becomes send-ready with a permanent tamper-evident record, and the buyer moves through the pipeline. This closes the last core milestone — the product is now complete and its central workflow is verified, not just assumed. While proving it, we found and fixed a serious outage: every page was showing an error for anyone who was logged in.

### Fixed
- **Logged-in users could not use the app at all — now fixed.** For a period, every page loaded an error for signed-in users (the sign-in screen itself worked, but nothing after it). This was a rendering fault that only showed up on the live server, which is why routine automated checks passed it through; a real run-through of the live app caught it. It is fixed and every page has been confirmed loading normally again.

### Added / proven
- **The whole deal loop is verified working on the live app.** Ranked matches with clear scoring, a compliance check that cannot be skipped, an approval that must come from a different person than the sender, a send-ready message backed by an unbroken tamper-evident record, and a buyer advancing through the pipeline — each step was exercised on the deployed product with real evidence, not inferred from passing tests. The core product is complete.

### Correctness / compliance
- **The "different person must approve" rule holds on the live app.** The person who drafts an outreach cannot approve their own — only a compliance officer can, and even an admin cannot self-approve. A message only becomes send-ready after a genuine compliance approval by a separate person, and every approval and send-ready step is written to the tamper-evident record, which was re-verified intact end-to-end.
- **A real run-through of the live app catches faults that passing tests miss.** The outage above passed every automated check yet broke every logged-in page; walking the deployed product by hand is what surfaced it — the same lesson as the earlier live-sync fix, now confirmed a second time.

### Provenance (transparency)
- **No new database change, no email sent, no AI added.** This release proves existing behavior and fixes a rendering fault; nothing in the tamper-evident record is edited or deleted. By design, the loop ends at a compliant, approved, send-ready record plus its audit entry — actually transmitting the email to the outside world is a deliberately separate, later step, not part of this milestone.

## [0.26.0] — 2026-07-09 — Connect your CRM: self-hosted Twenty sourcing (M9)

You can now connect a self-hosted Twenty CRM as a sourcing source, and the companies in it flow into your sourcing workspace automatically. It's the first CRM connection to go fully live end-to-end — set it up once, and your CRM's companies show up as sourced companies you can work from, without any copy-paste.

### Added
- **Connect a self-hosted Twenty CRM and pull its companies into sourcing** — add a Twenty connection in the sourcing area and sync it; the companies from your CRM are ingested and appear as sourced companies in your workspace, scoped to your firm. Re-syncing brings in the current set. This is the first sourcing integration that is live and verified from your CRM all the way through to the companies you see.

### Correctness / compliance
- **Your CRM's companies land only in your firm's workspace** — ingested companies are scoped to your firm and no other, and a fresh sync was verified end-to-end against a real running CRM to confirm the companies that come back are exactly the ones that flow in.
- **The connection was proven against the real service, not a stand-in** — the sync was corrected and re-verified against a live CRM instance so the request it makes is one the CRM actually accepts, closing a mismatch that automated tests alone could not surface.

### Provenance (transparency)
- **No new database change, no email, no AI.** This connects an outside CRM you host yourself and reads companies from it; nothing in the audit trail is edited or deleted, no email is sent, and no AI is used. Setting up the CRM itself is a one-time step you do in the CRM's own sign-up screen; everything after that is automatic.

## [0.25.0] — 2026-07-08 — In-app records browser (M10 — recordkeeping suite complete)

A firm admin or compliance officer can now browse and filter its own firm's deal and pipeline activity records directly in the product, read-only, on the compliance records page. It's the third and final light-recordkeeping feature, and it completes the set: with export, a retention policy, and now an in-app browser all live, the firm can hold, bound, hand over, and now read back its own compliance records without leaving the product.

### Added
- **Browse and filter your firm's deal activity records in-app** — a new "Deal activity" scope on the compliance records page lets an admin or compliance officer read and filter their own firm's deal and pipeline activity, paginated, without exporting first. It's read-only: there is no create, edit, or delete control anywhere on the view, and it never writes to the immutable audit log (browsing a record is not itself a recorded event).

### Correctness / compliance
- **You only ever browse your own firm's records** — the browse is scoped to your firm and no other, enforced inside the database itself (per-firm isolation on the read path), and proven by a test that runs as the restricted app account and confirms one firm cannot read another firm's deal activity. Only admins and compliance officers can open the view; advisors and analysts are refused server-side, and signed-out requests are rejected.
- **Reading is not writing** — the view is strictly read-only and paginated (not an export), so it carries no row cap to truncate and leaves the tamper-evident audit trail byte-for-byte unchanged.

### Provenance (transparency)
- **No database change, no email, no AI, no new permission to grant.** This adds a read-only view over records you already have; nothing in the audit trail is edited or deleted, no migration ships, no email is sent, and no AI is used.
- **The light recordkeeping suite is now complete.** Export (0.23.0), a configurable retention policy (0.24.0), and this in-app browser together deliver the firm's on-demand, workspace-scoped, integrity-verifiable recordkeeping at a light posture. Actual deletion on retention expiry, formal regulator certification, and a named-regime (SOX/FINRA) review posture remain deliberately deferred until the founder raises the compliance classification.

## [0.24.0] — 2026-07-08 — Firm records retention policy (M10)

A firm admin or compliance officer can now set how long the firm keeps its records — its retention window, with a sensible ~7-year default — on a new settings page, and see at a glance which records are old enough to be eligible under that window. It's the second of the recordkeeping features and a compliance-trust point: setting a retention policy is a routine part of a firm's recordkeeping obligations, and here it is deliberately safe — it configures the policy only and never deletes or alters anything.

### Added
- **Set your firm's records retention window** — a new retention settings page (/compliance/retention) lets an admin or compliance officer choose how long the firm keeps its records (defaulting to about seven years), with a read-only display of the resulting cutoff ("records older than <date> are eligible") so the effect of the setting is always visible. Every change is recorded in the tamper-evident audit trail with who changed it and the before/after values, so there is a durable history of the firm's retention decisions.

### Correctness / compliance
- **Setting a policy never deletes or alters a record** — this release configures the retention window only; there is no purge control anywhere in the page or the API, nothing is removed from the immutable audit log, and the audit log's whole-chain integrity still verifies after a retention change (proven by a test that changes the policy and confirms the tamper-evidence is intact). Actually deleting records on retention expiry is deliberately deferred to a later, separately-gated decision.
- **You only ever read or change your own firm's retention policy** — the policy is scoped to your firm and no other, enforced inside the database itself (per-firm isolation on the new table), and proven by a test that runs as the restricted app account and confirms one firm cannot read or write another firm's policy. Only admins and compliance officers can change it; advisors and analysts are refused, signed-out requests are rejected, and out-of-range windows are refused rather than stored.

### Provenance (transparency)
- **One additive database change, no purge, no email, no AI.** This adds one new configuration table (additive migration 0020, with its per-firm isolation switched on explicitly) and no new permission to grant; nothing in the audit trail is edited or deleted, no email is sent, and no AI is used.
- **Scope is honest — this is the retention half of the recordkeeping milestone.** An in-app browser for the firm's retained records is still to come; actual deletion on retention expiry and formal regulator certification are deliberately held at a light posture until the founder raises the compliance classification.

## [0.23.0] — 2026-07-07 — Firm recordkeeping export (M10)

A firm admin or compliance officer can now export the firm's complete records for its own workspace, and independently prove the export was not tampered with. It's the first of the recordkeeping features and a compliance-first selling point — the record you hand an auditor or regulator, on demand, in a format they can open anywhere.

### Added
- **Export your firm's audit trail and deal activity as CSV or JSON** — a new export page (/compliance/export) lets an admin or compliance officer download their own firm's complete tamper-evident audit log plus deal and pipeline activity in a standard, portable format, with the download's integrity result shown so it can be re-verified independently. The export is itself recorded in the audit trail, so there's a record of who exported what and when.
- **Honest about size limits** — if an export would exceed the safe row cap, the download is clearly flagged as truncated rather than silently cut short, so you never mistake a partial record for a complete one.

### Correctness / compliance
- **You only ever export your own firm's records** — the export is scoped to your firm and no other, enforced inside the database itself (per-firm isolation), and proven by a test that runs as the restricted app account and confirms one firm's export contains zero rows from any other firm. Only admins and compliance officers can export; everyone else is refused server-side.
- **The record you export is the tamper-evident one** — the export carries a whole-chain integrity result computed over the immutable audit log, and each firm's entries are numbered locally so no firm-wide counter can leak between firms.

### Provenance (transparency)
- **Extends the existing recordkeeping export — no new database change, no new setup step, no new permission to grant.** No email is sent and no AI is used; nothing in the audit trail is edited or deleted.
- **Scope is honest — this is the export half of the recordkeeping milestone.** A configurable retention window and an in-app records browser are still to come; formal regulator certification is deliberately held at a light posture until the founder raises the compliance classification.

## [0.22.0] — 2026-07-07 — Auth hardening (M10)

Sign-in, sign-up, and password-reset are now protected against automated password-guessing, and a confusing error on a bad invite link now reads correctly. Invisible in normal day-to-day use; it matters most as the product opens up to outside users.

### Changed
- **Automated guessing attacks on the login, sign-up, and password-reset screens are now throttled** — repeated rapid attempts from the same source are turned away with a clear "try again shortly" response once a short limit is crossed, then automatically allowed again after a brief cool-off. This is the standard brute-force protection expected of a compliance-first product before external users come on board; it does not affect normal use.
- **Signing out now re-checks that the request is genuine** — logout verifies the same anti-forgery protection the rest of the app already uses, so a signed-in session cannot be ended by a forged request.

### Fixed
- **A broken or already-used invite link now shows a clear "invalid invite" message** instead of a generic server error.

## [0.21.0] — 2026-07-07 — Seller-intent scoring (M9)

### Added
- **See which of your deals are heating up and which are going cold** — the insights dashboard (/insights) now gives advisors and admins, for their own firm, a seller-intent score from 0 to 100 on each live mandate along with a plain direction — heating, cooling, or flat — sorted hottest-first, so the deals worth a call today rise to the top instead of getting lost in the list. Each score comes with a three-part breakdown (outreach engagement, pipeline velocity, and match disposition) so you can see why a mandate scored the way it did.
- **The score is a rule, not a black-box guess** — it's computed by a fixed, published formula over signals you already have (outreach touches, pipeline progression, match dispositions); the same inputs always produce the exact same score, with no AI, no hidden model, and no dependence on what time it runs. That makes every score reproducible and auditable — the right call for a compliance-first product — and AI-based intent inference is deliberately held back for a separate founder decision.
- **Honest numbers, no filler dimension** — a low-signal factor that would only have broken ties was deliberately left out rather than shown as if it meant something, so the three factors you see are the three that actually move the score.

### Correctness / compliance
- **You only ever see your own firm's scores** — every score is scoped to your firm and no other, built on the existing per-firm isolation so one firm's intent scores can never draw on or appear in another firm's data; this was proven by a test that deliberately breaks isolation and confirms the cross-firm case is impossible.
- **Nothing was written or changed to produce these scores** — the feature only reads existing records; it writes nothing, sends no email, uses no AI, adds no database change and no deploy migration, and leaves the immutable audit trail untouched. Access is limited to advisors and admins.

### Provenance (transparency)
- **Read-only over data you already had.** No database change, no new setup step, and no new permission to grant. Additive-only: turning the section off removes nothing from your data.
- **Scope is honest — this is the deterministic read, not AI intent.** It scores intent from your existing internal signals; AI-based intent inference and the founder-gated connection that would sync an outside CRM's signals in are still to come and depend on a founder decision. The specific numeric success target for this area is still to be set by the founder.

## [0.20.0] — 2026-07-07 — Outreach activity log (M9)

### Added
- **Log and track your manual outreach touches in one place** — a new Outreach Log (/outreach/activity) lets advisors and admins record the calls, follow-up emails, and LinkedIn messages they run against a deal target, each with a channel, a status (planned, completed, or cancelled), an optional due date, and an optional link to the deal it relates to. There's a create form and a "my open touches" list so nothing you meant to follow up on gets lost. It's the first place in the product to capture and schedule those manual touches instead of tracking them in your head or a spreadsheet.
- **This logs your touches — it does not send anything** — the log records that you made (or plan to make) a call, email, or LinkedIn message; it does not place the call or send the message. Actually sending on your behalf stays a separate, deliberate decision, so nothing leaves the product without you.

### Correctness / compliance
- **You only ever see your own firm's outreach log** — every record is scoped to your firm and no other, built on the existing per-firm isolation so one firm's touches can never appear in another firm's log; the write side of that guarantee was proven by a test that deliberately breaks isolation and confirms the record cannot land in the wrong firm.
- **Every create, edit, and status change is recorded in the tamper-evident trail** — logging a touch, updating it, or moving it between planned, completed, and cancelled all write to the immutable audit trail, and only advisors and admins can write to the log. This is the first outreach feature that creates new records, and it exercises that audit trail on the write path.

### Provenance (transparency)
- **Additive-only, no new setup.** The log is a new internal record type added alongside your existing data — no new setup step and no new permission to grant. Turning it off removes nothing from your data.
- **Scope is honest — this is the touch-tracking half, not sending or scoring.** It captures what you did; actually sending outreach, a seller-intent signal read, and the specific numeric success target for this area are still to come and depend on a founder decision.

## [0.19.0] — 2026-07-07 — Match-score calibration (M9)

### Added
- **See whether the AI match score actually predicts your decisions** — the insights dashboard (/insights) now shows advisors and admins, for their own firm, how often they accept introductions at each match-score band (does a higher score really mean you accept more?), plus which underlying score factors — sector fit, contact completeness — track your acceptances. It turns the match score from a number you take on faith into one you can check against your own history.
- **Honest numbers, not confident-looking noise** — a factor that is a random tie-breaker by design was deliberately left out of the "which factors predict acceptance" view, because it correlates with nothing and showing it would invite reading meaning into noise; small samples now display their size "(n=X)" and are visually muted instead of showing a confident "100%" off a single data point, and a band with no decided matches reads "n/a" rather than a misleading "0%".

### Correctness / compliance
- **You only ever see your own firm's calibration** — every calibration figure is scoped to your firm and no other, built on the existing per-firm isolation so one firm's data can never appear in another firm's numbers; this was proven by a test that confirms the cross-firm case is impossible.
- **Nothing was written or changed to produce these numbers** — the calibration view only reads existing match records; it writes nothing, sends no email, uses no AI, retrains no scorer, and leaves the immutable audit trail untouched. Access is limited to advisors and admins.

### Provenance (transparency)
- **Read-only over data you already had.** No database change, no new setup step, and no new permission to grant. Additive-only: turning the section off removes nothing from your data.
- **Scope is honest — this is the calibration read, not a smarter scorer.** It measures how well the current score predicts your decisions; actually retraining the scorer on that feedback, and the specific numeric success target for this area, are still to come and depend on a founder decision.

## [0.18.0] — 2026-07-07 — Advisor insights analytics (M9)

### Added
- **See your firm's activity at a glance** — a new insights dashboard (/insights) gives advisors and admins read-only analytics on their own firm's live data across four areas: mandate throughput (drafts vs active), how outreach drafts fared at the compliance gate, per-advisor activity, and how introductions were dispositioned (accepted, rejected, still pending). It's numbers you can read, not a report you have to run.
- **Honest outreach metric, not a vanity number** — the outreach measure shows compliance-gate outcomes (how many drafts cleared the gate vs were blocked), not a "response rate," because the product doesn't send email yet. We report what actually happens, not a number we can't stand behind.

### Correctness / compliance
- **You only ever see your own firm's numbers** — every figure on the dashboard is scoped to your firm and no other, built on the existing per-firm isolation so one firm's analytics can never include another firm's data; this was proven by a test that confirms the cross-firm case is impossible.
- **Nothing was written or changed to produce these numbers** — the dashboard only reads existing records; it writes nothing, sends no email, uses no AI, and leaves the immutable audit trail untouched. Access is limited to advisors and admins.

### Provenance (transparency)
- **Read-only over data you already had.** No database change, no new setup step, and no new permission to grant. Additive-only: turning the page off removes nothing from your data.
- **Scope is honest — this is the analytics half of the milestone.** Syncing your existing CRM into DealFlow AI, multi-channel outreach, seller intent signals, and a matching feedback loop are still to come, and the CRM connection depends on a founder decision on which provider to use. The specific numeric success target for this area is still to be set by the founder.

## [0.17.0] — 2026-07-06 — Pilot-partner workspace data-isolation (M8)

### Added
- **A firm can only ever see its own data** — every firm's records (deals, mandates, contacts, the audit trail, everything) now live in a private workspace, and the platform guarantees one firm can never read or change another firm's data. The guarantee is enforced inside the database itself (deny-by-default row-level security), not just in application code, and it was proven by a test that confirms one firm literally cannot read another firm's rows. The pilot firm's existing data was moved into its own default workspace with no loss.
- **New teammates land in the right firm automatically** — an invited user joins the inviting firm's workspace, so they see exactly that firm's data and nothing else.

### Correctness / compliance
- **The isolation cannot be bypassed by misconfiguration** — the app connects to the database under a restricted (non-superuser) account so the isolation rules always apply, and every request carries the user's workspace so the database returns only that workspace's rows. If the app were ever wired up to connect with an over-privileged account, it refuses to start rather than silently expose data (fail-closed).
- **The immutable audit trail stayed intact** — all 328 existing audit entries were tagged with their workspace without breaking their tamper-evidence; the audit hash-chain still verifies after the change (confirmed live).

### Provenance (transparency)
- No new user-facing screens — isolation is invisible to users and adds no new setup step. No email is sent and no AI is used; no audit record is edited or deleted. Additive-only database migrations (0014–0017); the only operational change is the restricted database connection, an internal deploy detail.
- **Scope is honest — this is the pilot firm, one workspace today.** The plumbing that keeps firms apart is live, but standing up many firms as a full multi-tenant product is a later milestone. Three follow-up hardening items (a fail-closed check on one write path, a standing test for audit-table migrations, and documenting the split database connection) are tracked and non-blocking.

## [0.16.0] — 2026-07-06 — Admin hardening & compliance-default cascade (M7)

### Added
- **Firm compliance defaults now actually apply** — when an admin creates a new mandate and leaves a compliance field unset, it inherits the firm's default (the jurisdiction, and the disclaimer and suppression scope derived from it); any value set explicitly on the mandate still wins. This closes the write-only gap noted last release, where firm defaults were saved but never used. Existing mandates are never changed retroactively.
- **Admin oversight of who did what** — a new read-only activity view (/admin/activity) lets an admin see recent admin actions — who invited, deactivated, reactivated, or changed the role of whom, plus settings and data-source changes — read straight from the immutable audit trail. It writes nothing and shows no secrets.
- **Reversing a deactivation** — an admin can reactivate someone who was deactivated, restoring their access and prior role; the action is audited.
- **Reachable admin section** — an admin-only navigation section now links the admin pages, fixing the previously-unreachable connections page.

### Correctness / compliance
- **Re-inviting an existing or pending person is safely refused** — a second invite to an email that is already registered or already invited is rejected with a clear conflict response, race-safe under two simultaneous requests; an expired invite can still be re-sent.
- **The connection-config field rejects secret-shaped values** — secrets belong in the encrypted credential field only, so the plain config field now refuses values that look like secrets, without ever echoing the value back.
- No schema change and no new secret this release — the one new admin action (reactivate) is additive to the existing audit trail.

### Provenance (transparency)
- Admin plumbing only — no email is sent and no AI is used; no audit record is edited or deleted, and the activity view is read-only.
- **Still founder-gated:** verifying a firm's sending domain (the last step before compliant outreach can go out) remains blocked on the outside email-provider setup, so this piece of the admin milestone is not yet shippable.

## [0.15.0] — 2026-07-06 — Admin & settings (M7)

### Added
- **Admin console** (M7) — three admin-only pages let a firm run itself: **user management** (/admin/users) to invite teammates (invite-only), assign their role, and deactivate people who leave; **workspace & firm settings** (/admin/settings) for the firm profile and default compliance fields (jurisdiction, disclaimer, suppression); and **data-source connections** (/admin/integrations) to add, edit, enable, and disable the outside data feeds the product pulls from. Advisors and signed-out visitors are refused.
- Shell polish — the app navigation now has real placeholder pages for Matches and Outreach (no more dead links), and the top bar shows the correct page title.

### Correctness / compliance
- **The firm can never lock itself out of administration** — a race-safe guard blocks removing or demoting the last remaining admin, even under two simultaneous requests (refused with a clear conflict response). Every admin action — invite, role change, deactivation, settings change, connection change — is written to the immutable audit trail. Deactivation is a reversible soft-disable, not a delete.
- **Data-source credentials are encrypted at rest** (AES-256-GCM, per-record random IV + auth tag, key-id prefix for rotation, fail-closed if the key is missing). The credential form is write-only: the secret is never returned or echoed back, and reads expose only whether a credential is set. The audit hash-chain still verifies after this wave's additive schema change (confirmed live: 314 entries, integrity intact).

### Provenance (transparency)
- Admin plumbing only — no email is sent, no AI is used, and no audit record is edited or deleted. This wave adds one additive database migration (0013) and one new production-only secret (CREDENTIALS_ENC_KEY, self-generated, never committed).
- **Known gap, tracked as a follow-up:** the firm's default compliance settings are saved but not yet applied when a new mandate is created — they are write-only for now. Reactivating a deactivated user, duplicate-invite handling, and an in-app link to the connections page are also deferred to follow-up tasks.

## [0.14.0] — 2026-07-06 — Compliance hardening (audit mandate-attribution + recordkeeping fidelity)

### Added
- **Mandate-attributable compliance decisions** — the pre-send compliance gate now stamps each allow/block decision with the mandate it belongs to, so a mandate-scoped recordkeeping export includes the gate decisions for that mandate. A new read-only **compliance oversight** view (/compliance/oversight) lets compliance/admin see each outreach's gate outcome, mandate, and separation-of-duties status at a glance (distinct from the version-approval queue).

### Correctness / compliance
- The mandate stamp is recorded as tamper-evidence-neutral metadata — it is NOT part of the audit log's hash chain, so adding it left every existing entry's integrity hash byte-identical and the chain still verifies (confirmed live on the production chain of 310 entries after the change). The pre-send gate's non-bypassable allow/block behaviour is unchanged. A real-database test now proves the mandate-scoped export captures every mandate-derivable record — including gate decisions — and correctly isolates one mandate's records from another's even when they share a template, lifting the prior hold on relying on the scoped export for a regulator request.

### Provenance (transparency)
- Compliance hardening only — no email send, no AI, no edit/delete of audit records. The mandate stamp is a filterable attribution field, not a tamper-evident one (documented in the audit architecture notes); a distinct control would be needed if mandate-attribution integrity itself became a regulatory requirement.

## [0.13.0] — 2026-07-06 — Audit-log & recordkeeping export (M6 compliance-defensibility)

### Added
- **Verifiable recordkeeping export** (M6 recordkeeping wedge) — the /compliance/audit-log page is now the full compliance-defensibility surface: a filterable, paginated view of the immutable audit trail (mandate/event-type/actor/date), a hash-chain **integrity badge** (tamper-evidence at a glance), and a **recordkeeping export** — a mandate/time-scoped, self-contained package (in-scope entries + per-entry hashes + a full-chain integrity result + a manifest) that a regulator or auditor can independently re-verify offline. No schema change (reads the existing audit log).
- Endpoints: `GET /compliance/audit-log` (filtered read), `GET /compliance/audit-log/verify` (chain integrity), `POST /compliance/audit-log/export` (verifiable package). Compliance/admin see org-wide and can export; advisors see their own outreach and cannot export.

### Correctness / compliance
- The audit log stays immutable: the read and verify paths write nothing to it; only the export action records itself — exactly one entry, last in its transaction (proven live: an export moved the verified chain from 309 to 310 entries). The integrity check is the real tamper-evidence verifier over the whole chain. Export is restricted server-side (advisors are refused). Bad filter input is rejected (not run as an unbounded query). The mandate-scoped view honestly documents which records it derives (it does not overclaim completeness — the full-chain export is the complete record).

### Provenance (transparency)
- Recordkeeping only — no email is sent, no AI drafting, no edit or delete of audit rows. Formal PDF/multi-regulation export formats and producer-side mandate-tagging of every gate decision are deferred to later bundles.

## [0.12.0] — 2026-07-05 — Pipeline / deal-stage tracking (M6 pipeline)

### Added
- **Deal-pipeline tracking** (M6 pipeline half) — an advisor enrolls an eligible deal (a send-eligible outreach or an accepted match) into a fixed-stage pipeline and moves it through the stages on a stage-columned board at `/pipeline`: **shortlisted → contacted → engaged → diligence → offer → closed → withdrawn** (fixed for now; configurable stages deferred). Each deal carries a per-deal event timeline — enrollment, every stage transition, and advisor free-text notes — as an immutable, chronological record. Migration 0011 (pipeline + pipeline_events).
- Endpoints: `GET /pipeline` (board, grouped by stage), `POST /pipeline` (enroll), `PATCH /pipeline/:id/stage` (transition), `POST /pipeline/:id/notes` (add note), `GET /pipeline/:id/events` (timeline). RBAC: advisor moves deals; advisor + compliance read and add notes; every mutation audited.

### Correctness / compliance
- Every enroll, stage transition, and note is written to the immutable audit log **last in its transaction** — if the audit write fails, the whole change rolls back, so a pipeline record can never exist without its audit entry (proven end-to-end against a real database). Enrolling the same deal twice is refused; illegal stage moves and unauthorized roles are rejected on the server; a deal can only be enrolled under the mandate it actually belongs to (no mis-attributed deals); pipeline notes are append-only (no edit or delete).

### Provenance (transparency)
- The pipeline is **tracking only** — no email is sent and no AI drafting is offered here (the board carries no "Send" or "AI" affordance). Automated stage advancement from replies/opens, actual email send, and AI-assisted drafting remain deferred to later M6 bundles.

## [0.11.0] — 2026-07-05 — Compliant-outreach foundation (M6 first bundle)

### Added
- **Compliant outreach foundation** (M6 first bundle) — an advisor builds versioned outreach templates and drafts immutable versions (each content-hashed); a compliance officer grants or rejects each version in a **compliance approval queue** (`/compliance-queue`), with Segregation-of-Duties enforced (the approver is recorded; a template's composer cannot be its own approver). In the **outreach composer** (`/outreach-composer`), an advisor picks an approved template + a shortlisted buyer and runs a **non-bypassable pre-send compliance gate** ("Run Compliance Gate & Create Record") that reuses the M2 compliance authority and returns **send-eligible** or **blocked (+reason)**. Migration 0010 (outreach_templates + outreach_template_versions + outreach).
- Endpoints: `POST /outreach-templates` (+ `/:id/versions`, `/request-approval`, `/approve`, `/reject`), `POST /outreach` (compose → gate → send_eligible|blocked), `GET` list/detail. RBAC: advisor/analyst draft, compliance-only approve, advisor compose; every mutation audited.

### Correctness / compliance
- The pre-send gate is genuinely non-bypassable: a record can become **send-eligible only through a passing compliance verdict** — proven end-to-end by an un-mocked integration test against a real Postgres (an approved, SoD-clean, hash-matching template version passes; no-approval, self-approval, and content-drift are each blocked). Version-binding: editing an approved template mints a new pending version that is not send-eligible until re-approved. Approval is compliance-role-only; a deleted approver fails closed (blocked).

### Provenance (transparency)
- **No email is sent and no AI drafting is offered in this bundle** — the composer produces a *send-eligible record* and states plainly "No email has been sent". The shipped UI carries no "Send", "Schedule Send", or "AI Drafting" affordance (verified on the deployed authenticated pages), so the product never implies a capability it does not perform. Actual email send, tracking, pipeline, and AI-assisted drafting are deferred to later M6 bundles.

## [0.10.0] — 2026-07-04 — Buyer-seller matching (M5 deterministic)

### Added
- **Deterministic buyer-seller matching** (M5 first bundle) — for a mandate whose buyer universe is submitted (ready-to-rank), an advisor runs a match: a deterministic, rule-based fit score (integer 0-100 from the mandate's buyer criteria + contact completeness, with a per-dimension score breakdown) produces a ranked buyer list at `/matches-shortlist`; the advisor accepts/rejects/flags to build a shortlist and hands it off as ready-for-outreach. Reached from the mandate detail's "Ranked Candidates" panel. Migration 0009 (match_run + match_candidates).
- Endpoints: `POST /matches` (run; idempotent per buyer universe), `PATCH /matches/:id/candidates/:cid` (accept/reject/flag), `POST /matches/:id/handoff` (ready-for-outreach), `GET /matches`. RBAC advisor-primary; every mutation audited.

### Correctness / compliance
- The fit score is a pure deterministic function with a meaningfully-discriminating ranking; re-running a match preserves the advisor's existing accept/reject decisions; the run is guarded (a buyer universe must be submitted; a shortlist must have at least one accepted buyer before handoff); dimensions the underlying company data can't support are shown as "not applied" rather than silently scored.

### Provenance (transparency)
- The score is presented as a **rule-based fit score with a per-dimension breakdown — NOT an AI-generated rationale**. There is no LLM/AI in this bundle. The AI-assisted ranking + explainable rationale is a later, separately-gated M5 bundle. No AI-capability is claimed on the page that the system does not perform.

### Boundary
- Matching + shortlist + ready-for-outreach handoff only — this bundle does not send outreach (that is Milestone M6).

## [0.9.0] — 2026-07-04 — Buyer universe (M4 complete)

### Added
- **Buyer-universe builder** (M4 final bundle) — for a sell-side mandate, an analyst assembles a candidate buyer set from the canonical companies store, filters it by the mandate's buyer criteria (per-candidate include/exclude with provenance), enriches included candidates with their contacts, flags gaps, and submits the universe as ready-to-rank. Reached from the mandate detail's "Buyer Engine" panel at `/buyer-universe`. Migration 0008 (buyer_universe + buyer_universe_candidates; one universe per mandate). This **completes Milestone M4 — Mandates & buyer universe** (create a configured mandate → assemble + enrich a buyer universe ready to rank).
- Endpoints: `POST /buyer-universe` (assemble; idempotent per mandate), `POST /:id/filter`, `POST /:id/enrich`, `GET /:id/gaps`, `POST /:id/submit`, `GET /buyer-universe`, `PATCH /:id/candidates/:cid`. RBAC analyst-primary (advisor/admin permitted); every mutation audited.

### Compliance / correctness
- Idempotent assembly (a mandate has exactly one buyer universe; concurrent-safe); submit is guarded (rejects a universe with no included candidates or any un-triaged candidate); the criteria filter is honest about dimensions it cannot yet apply (geo/size/deal-type are recorded as not-applied and surfaced in provenance + the audit trail, rather than silently claiming a full filter).

### Boundary
- Assembly + filtering + enrichment + submission only — no fit-scoring, ranking, or AI matching here; ranked buyer-seller matching is the next milestone (M5).

## [0.8.0] — 2026-07-04 — Mandate spine (M4 create/list/detail)

### Added
- **Mandate management** (M4 first bundle) — an advisor creates a fully-configured sell-side mandate at `/mandates/new`: seller/target profile (name, industry, regions, size band, deal type) + buyer criteria (industry / geo / size-band / deal-type) + compliance guardrails (legal jurisdiction → disclaimer template derived server-side; suppression scope; three required acknowledgments). Persisted in one transaction (mandate + buyer_criteria + compliance_profile), audited (M2 hash-chain), and viewable at `/mandates/:id` (SSR-hydrated detail) and `/mandates` (list + status filter). Migration 0006 (3 mandate tables) + 0007 (one-active-disclaimer-per-jurisdiction unique index).
- **Compliance capture** at mandate creation — the jurisdiction, disclaimer template, suppression scope, and three attestations are captured and stored for the later pre-send compliance gate (enforcement remains in that gate; captured-not-enforced here). Endpoints: `POST /mandates`, `PATCH /mandates/:id` (advisor/admin, audited), `GET /mandates` + `GET /mandates/:id` + `GET /mandates/jurisdictions` (advisor/admin/analyst read).

### Compliance / safety
- One-transaction atomic mandate write (no partial mandate); audit-last-in-transaction (a create that can't be audited doesn't commit); all three acknowledgments strictly required; disclaimer template derivation is deterministic and rejects ambiguous compliance config; active mandates are locked against reconfiguration and illegal state reversion.

### Deferred
- The buyer-universe builder (assemble/filter/enrich candidate buyers → submit to matching) — the next M4 bundle; the mandate-detail page renders labelled placeholders for it.

## [0.7.0] — 2026-07-04 — Sourcing workspace (M3 search entry)

### Added
- **Sourcing workspace** at `/sourcing` (analyst) — the M3 search entry point: search over the deduped canonical company universe (in-memory over the SSR-loaded set), a source facet across connected data sources, a results matrix with per-company source badges (from real connection displayNames), a company detail drawer (contacts + provenance), and a per-connection "sync now" trigger that reuses the wave-6 idempotent ETL→dedupe pipeline. Hand-off to `/sourcing/companies` (the dedupe review queue). Completes M3's success metric — "search across ≥2 connected sources" — verifiable on ≥2 fixture connections.
- **Connection management**: `POST /sourcing/connections` (create; analyst/admin; audited via the M2 hash-chain; providerKey validated against the adapter registry → 400 on unknown; `UNIQUE(display_name)` → 409 on dup) + `GET /sourcing/connections` (list, per-connection company counts). Migration 0005 (UNIQUE display_name). Per-company `connectionIds` on the companies list (source badges).

### Fixed
- Web SSR/client render hardening across the sourcing + compliance surfaces: shared read-schema timestamps accept the PostgreSQL wire format (were rejecting real API data → empty lists); `companySchema` accepts the API `connectionIds`/`sourceCount` fields; the company detail page SSR-hydrates (no Server→Client function-prop violation, no client fetch colliding with the page route).

### Deferred
- The first REAL data-source provider adapter (awaits a founder vendor choice + account-issued API key); an in-page per-candidate dedupe modal; advanced search facets / saved searches.

All notable changes to DealFlow AI are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

## [0.6.0] — 2026-07-04

Deal sourcing goes live: connect data sources, pull in companies and contacts, and automatically fold duplicates into one clean record that remembers where every detail came from.

### Added
- Pluggable data-source connectors with an on-demand sync that pulls company and contact records into a staging area without touching the clean data set.
- Deterministic de-duplication that promotes staged records into canonical companies and contacts, collapsing the same company seen across sources into one record.
- Source provenance on every canonical company and contact, so each record traces back to every source and connection it came from.
- A review queue for uncertain matches that never auto-merges, plus a companies-and-contacts screen to view, filter, and resolve them.

## [0.5.0] — 2026-07-03

The compliance gate goes live: a single, non-bypassable check that every outreach must pass before it can be sent, with each decision recorded in the tamper-evident audit log.

### Added
- Configurable compliance rules engine: suppression lists, per-jurisdiction disclaimers, and approval policies, all managed by compliance and admin roles.
- A single non-bypassable pre-send compliance check that blocks any send failing suppression, separation-of-duties, required-disclaimer, or approval-binding rules — no path can skip it.
- Separation of duties: an outreach can only be sent if a different person in the compliance role has approved it; the sender can never approve their own send, and admins cannot stand in as approver.
- Approval is bound to the exact approved content, so any edit after approval automatically re-blocks the send until re-approved.
- Compliance settings management screen for maintaining rules, suppression entries, and disclaimers, with every change written to the audit log.

## [0.4.0] — 2026-07-03

The tamper-evident audit log: a cryptographic, append-only record of who did what, that no one — not even a database administrator — can silently alter or delete.

### Added
- Append-only audit log: every entry is chained to the one before it with a cryptographic signature, so any edit, deletion, or reordering breaks the chain and is detectable.
- Database-level immutability that blocks updates, deletes, and table truncation outright, so the record cannot be rewritten even by a privileged account.
- Chain-integrity verification endpoint (`GET /compliance/audit-log/verify`), restricted to compliance and admin roles, that confirms the full record is intact or pinpoints where it was tampered.
- Compliance integrity view at `/compliance/audit-log` showing the live record and its verification status.

## [0.3.0] — 2026-07-03

The authenticated shell: a shared app frame, a role-aware landing dashboard, and access control that enforces who can reach what.

### Added
- Shared application shell (sidebar + top bar) rendered once and used by every signed-in page, with a role-aware landing dashboard on `/`.
- Per-route access control (RBAC): every protected API and web route now checks the signed-in member's role and blocks anyone without permission, failing closed by default.
- Role-based navigation that shows each member only the sections their role can open, driven by the same source of truth as access control so the menu can never offer a link the rules would deny.
- Roles are read from the server-verified session on every request, so access reflects a member's current role rather than a stale sign-in claim.



Invite-only user accounts and sign-in: the platform's first authenticated surface, with a role-aware data model and hardened sessions.

### Added
- Invite-only email/password authentication (SuperTokens): login, accept-invite, and reset-password screens wired end-to-end to the API. (#2)
- User/role/invite data model with four seeded roles (advisor, analyst, compliance, admin); each account maps 1:1 to a SuperTokens identity and its session carries a role claim.
- Auth API — signup, `GET /auth/me`, logout, and password reset — plus a role-aware guard primitive (per-route RBAC deferred to a later wave).
- Session hardening: HttpOnly + Secure cookies (SameSite=Lax) with CSRF protection, constant-time reset responses (no user-enumeration), and no account creation without a valid invite.

## [0.1.0] — 2026-07-02

Walking skeleton: the monorepo foundation, a database-aware health endpoint, CI, and a first live deploy.

### Added
- Turborepo + pnpm monorepo with `api` (NestJS), `web` (Next.js 15), and a shared package.
- `GET /health` endpoint returning `{status, db, version}` — 200 when Postgres is reachable, 503 when it is not.
- Postgres schema managed by Drizzle with an idempotent first migration.
- GitHub Actions CI (lint, typecheck, build, integration test against real Postgres) green on `main`. (#1)
- Live deploy on Railway — API and web reachable in production.
