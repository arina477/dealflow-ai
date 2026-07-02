# User Flows — DealFlow AI

Persona-anchored, end-to-end flows. One flow = one user goal. Source: v1 vision + v2 competitive scan + founder-stage (`pilot-customer`, compliance-first). Feeds v4 page map, v6 architecture, v7–v9 design.

> **Scope note (MVP):** Single firm = the founder's M&A advisory firm. A near-term external **design partner** (pilot) is accommodated via a lightweight separate workspace at H2 — NOT full multi-tenant SaaS (that is the H3 vision, out of MVP scope per the brief).

---

## Personas

1. **Advisor / Deal Lead** — senior M&A advisor (the founder + colleagues). Owns mandates, reviews ranked buyer matches, approves and launches outreach, works the pipeline. Primary decision-maker.
2. **Analyst / Associate** — junior staff. Sources deals, builds/cleans the buyer universe, drafts outreach, maintains data quality. Heaviest day-to-day operator.
3. **Compliance Reviewer** — reviews and approves outreach before send, audits the communication log, manages suppression/disclaimer rules and recordkeeping exports. May be the founder wearing a compliance hat early on; a distinct role because compliance-first is a core bet.
4. **Admin** — connects data sources, manages users/roles and workspace settings. Founder/ops initially.

---

## Advisor / Deal Lead flows

### F1 — Create & configure a sell-side mandate
- **Persona:** Advisor · **Entry:** "New mandate" button on dashboard
- **Steps:** open new-mandate form → enter target/seller profile (industry, size, geography, financials, deal thesis) → set buyer criteria (strategic vs financial, check size, sector fit) → set compliance profile (disclaimers, suppression list, jurisdiction) → save → mandate appears in pipeline as "Sourcing".
- **Success:** mandate persisted with criteria + compliance profile; matching can run against it.
- **Failure modes:** incomplete required fields; conflicting criteria; duplicate mandate → warn.
- **Handoffs:** → Analyst (F6/F7 sourcing & buyer universe), → matching engine (F2).

### F2 — Review ranked buyer matches & build shortlist
- **Persona:** Advisor · **Entry:** mandate → "Matches" tab
- **Steps:** view AI-ranked buyer list with fit scores + rationale → filter/sort → open a buyer to see evidence (why ranked) → accept / reject / flag each → accepted buyers form the shortlist → confirm shortlist.
- **Success:** a curated, ranked shortlist ready for outreach.
- **Failure modes:** thin matches (too-narrow criteria) → suggest loosening; stale buyer data → flag.
- **Handoffs:** → Analyst (refine universe), → Compliance (F10 approval), → outreach (F3).

### F3 — Approve & launch a compliant outreach campaign
- **Persona:** Advisor · **Entry:** shortlist → "Start outreach"
- **Steps:** pick/assemble outreach template → personalize per buyer (merge fields) → preview each message → run pre-send compliance check (disclaimers present, suppression honored, recordkeeping enabled) → if compliance approval required, submit for review (F10) → on approval, schedule/send → every send written to the tamper-evident audit log.
- **Success:** campaign sent (or scheduled); each message logged immutably with timestamp, sender, content hash.
- **Failure modes:** compliance check fails (missing disclaimer / suppressed contact) → block send with reason; send-provider error → retry/queue.
- **Handoffs:** → Compliance (F10 if approval gated), → tracking (F4).

### F4 — Monitor responses & work the pipeline
- **Persona:** Advisor · **Entry:** dashboard / mandate "Pipeline" tab
- **Steps:** view outreach status (sent/opened/clicked/replied/bounced) per buyer → triage replies → advance buyers through deal stages (contacted → interested → NDA → diligence) → add notes → next actions.
- **Success:** live, accurate pipeline reflecting engagement.
- **Failure modes:** tracking false-positives (privacy proxies) → label as low-confidence; missed replies → inbox sync gap flag.
- **Handoffs:** → Analyst (follow-ups), → Compliance (log of all comms).

---

## Analyst / Associate flows

### F6 — Source deals / import targets from data sources
- **Persona:** Analyst · **Entry:** "Sourcing" workspace
- **Steps:** run a sourcing search across connected data sources → review candidate companies → import selected into the target/company store → dedupe against existing → tag to a mandate or the general pool.
- **Success:** new targets ingested, deduped, enriched.
- **Failure modes:** source rate-limit/outage → partial results + retry; duplicate explosion → dedupe review queue.
- **Handoffs:** → matching engine, → Advisor (F1/F2).

### F7 — Build & refine the buyer universe
- **Persona:** Analyst · **Entry:** mandate → "Buyer universe"
- **Steps:** generate candidate buyers (from data sources + prior deals) → apply criteria filters → enrich contacts (decision-makers, emails) → flag data gaps → submit universe for matching/ranking.
- **Success:** a clean, enriched buyer universe feeding F2 ranking.
- **Failure modes:** missing contact data → enrichment queue; out-of-scope buyers → exclude.
- **Handoffs:** → Advisor (F2), → Compliance (suppression check).

### F8 — Draft outreach templates
- **Persona:** Analyst · **Entry:** "Templates" library
- **Steps:** create/edit template with merge fields + required compliance blocks (disclaimer, opt-out) → AI-assisted drafting → save as draft → submit to Compliance for approval (F10).
- **Success:** reusable, compliance-complete template available to Advisors.
- **Failure modes:** template missing required compliance blocks → cannot submit.
- **Handoffs:** → Compliance (F10), → Advisor (F3).

### F9 — Maintain company & contact data quality
- **Persona:** Analyst · **Entry:** "Data" / company-or-contact record
- **Steps:** review flagged records → merge duplicates → correct/enrich fields → mark verified.
- **Success:** higher data accuracy feeding matching + outreach.
- **Failure modes:** conflicting merges → review; enrichment source disagreement → keep provenance.
- **Handoffs:** → matching, → outreach (accurate sends).

---

## Compliance Reviewer flows

### F10 — Review & approve outreach (templates & campaigns)
- **Persona:** Compliance Reviewer · **Entry:** "Compliance queue"
- **Steps:** open pending template/campaign → check disclaimers, claims, suppression, jurisdiction → approve / request changes / reject with notes → decision logged.
- **Success:** only compliant outreach proceeds; decision is auditable.
- **Failure modes:** ambiguous claim → request changes; urgent campaign → priority flag.
- **Handoffs:** → Analyst/Advisor (revise or send).

### F11 — Audit log review & recordkeeping export
- **Persona:** Compliance Reviewer · **Entry:** "Audit log"
- **Steps:** browse/filter immutable communication + decision log → verify integrity (tamper-evident hashes) → export a recordkeeping package (date range / mandate) for FINRA/SOX retention.
- **Success:** complete, verifiable export of who-sent-what-when, integrity-checked.
- **Failure modes:** integrity check anomaly → alert; export too large → chunk.
- **Handoffs:** external retention / regulator-ready archive.

### F12 — Manage compliance rules (suppression, disclaimers, blocklists)
- **Persona:** Compliance Reviewer · **Entry:** "Compliance settings"
- **Steps:** edit suppression/blocklist entries → manage required disclaimer text per jurisdiction → set approval-gating policy (which campaigns need review) → save.
- **Success:** outreach engine enforces current rules at send time.
- **Failure modes:** rule conflict → validation; overly broad suppression → confirm.
- **Handoffs:** → outreach engine (F3 enforcement).

---

## Admin flows

### F13 — Connect & configure data sources
- **Persona:** Admin · **Entry:** "Integrations / data sources"
- **Steps:** add a data-source connection (API key / OAuth) → test connection → configure sync cadence → enable.
- **Success:** source feeding sourcing/enrichment.
- **Failure modes:** invalid credentials → guided fix; provider downtime → status surfaced.
- **Handoffs:** → Analyst (F6/F7).

### F14 — Manage users & roles
- **Persona:** Admin · **Entry:** "Users"
- **Steps:** invite user → assign role (advisor/analyst/compliance/admin) → set permissions → deactivate when needed.
- **Success:** correct least-privilege access per person.
- **Failure modes:** last-admin removal → block; role conflict → warn.
- **Handoffs:** → all personas (access).

### F15 — Workspace & system settings
- **Persona:** Admin · **Entry:** "Settings"
- **Steps:** configure firm profile, sending identity/domain, default compliance profile, (H2) separate pilot-partner workspace.
- **Success:** firm-wide defaults in place; (H2) pilot partner isolated.
- **Failure modes:** unverified sending domain → block outreach; misconfig → validation.
- **Handoffs:** → outreach (sending identity), → Compliance (default profile).

---

## Cross-persona handoff map (core loop)

`F1 mandate (Advisor)` → `F6/F7 sourcing + buyer universe (Analyst)` → `matching engine` → `F2 ranked shortlist (Advisor)` → `F8 template + F10 compliance approval (Analyst/Compliance)` → `F3 compliant send + audit log (Advisor)` → `F4 pipeline + F11 recordkeeping (Advisor/Compliance)`.

This loop is the H1 MVP. Every step writes to the tamper-evident audit log (compliance-first).
