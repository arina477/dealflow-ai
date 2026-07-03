# Databases Architecture

## Summary

DealFlow AI uses a single PostgreSQL instance managed by Railway as its system of record. Drizzle ORM provides type-safe schema definition, migration generation, and query building. The schema is partitioned by module: each internal module owns its tables under a dedicated Drizzle schema file; no module reaches directly into another module's tables — cross-module data flows through service-layer APIs.

Compliance is structurally enforced at the database layer, not layered on post-MVP: the audit-log table is append-only by design (no UPDATE or DELETE grants to the application role), with a SHA-256 hash chain linking every row to its predecessor. Tamper detection is verifiable without trusting the application layer.

SuperTokens Core runs against its own Railway-managed Postgres instance (provisioned separately by SuperTokens, not shared with the application DB). The application DB described here is the DealFlow AI application database only.

---

## Inventory

Schema boundaries per module. Each module maps to one Drizzle schema file under `apps/api/src/db/schema/`. The application Postgres user holds standard DML on all tables except `audit_log_entries`, where only INSERT is granted (see Stack-specific decisions).

### mandates

Sell-side engagement objects. One mandate = one seller engagement. Owns the compliance profile attached to each mandate (jurisdiction, required disclaimers, approval-gating flag).

Tables:
- `mandates` — core engagement record (seller profile, status, owner advisor, created_at)
- `mandate_criteria` — structured buyer-filter criteria per mandate (revenue range, sector, geography, deal-type)
- `mandate_compliance_profiles` — per-mandate compliance configuration (jurisdiction codes, disclaimer refs, approval_required bool)

Consuming features: #4, #6, #7, #11

### companies_contacts

Normalized company and contact records with full provenance tracking (which source, when ingested, confidence scores). Entity resolution state is tracked here.

Tables:
- `companies` — normalized company records (name, identifiers, sector, size signals, status: active/archived/suppressed)
- `contacts` — decision-maker contacts linked to companies (name, email, title, verification status)
- `company_data_sources` — provenance join: which source contributed which fields to a company record, with ingested_at + raw_ref
- `contact_data_sources` — same provenance pattern for contacts
- `dedupe_candidates` — pairs flagged for review by the dedupe engine (entity_a_id, entity_b_id, similarity_score, status: pending/merged/rejected)

Consuming features: #2, #3, #5, #9

### buyer_universe

Assembled buyer candidate lists per mandate. Stateful: a buyer candidate has an inclusion status (added, removed, shortlisted) and enrichment state.

Tables:
- `buyer_universe_entries` — (mandate_id, company_id, status, added_by, added_at, enrichment_status)
- `buyer_universe_snapshots` — point-in-time snapshot metadata for export/audit purposes (snapshot_id, mandate_id, created_at, entry_count)

Consuming features: #5, #7

### matches

AI-generated ranked match output per mandate. Immutable once written — scores and rationale are append-only snapshots of model output; a re-run produces a new match_run row rather than overwriting.

Tables:
- `match_runs` — one row per matching engine invocation (mandate_id, model_ref, run_at, status: pending/complete/failed)
- `match_results` — individual buyer scores within a run (match_run_id, company_id, score, rationale_json, rank)
- `match_reviews` — advisor accept/reject/flag decisions on individual results (match_result_id, reviewer_id, decision, reviewed_at, note)

Consuming features: #6, #7, #26

### templates

Outreach template library. Templates carry required compliance block slots; AI-assisted drafting outputs are saved as template drafts before advisor adoption.

Tables:
- `templates` — template records (name, subject_template, body_template, merge_fields_json, compliance_blocks_json, status: draft/active/archived, created_by)
- `template_versions` — immutable version history (template_id, version_num, snapshot_json, created_at, created_by) — supports audit trail for template changes

Consuming features: #8, #11

### outreach_campaigns

Per-mandate outreach campaigns. An outreach send is tracked at campaign + recipient level. Email events (opens, clicks, replies, bounces) are written by the webhook processor.

Tables:
- `campaigns` — campaign record (mandate_id, template_id, status: draft/pending_approval/approved/sending/sent/paused, created_by, approved_by, approved_at)
- `campaign_recipients` — one row per (campaign, contact) pair (campaign_id, contact_id, company_id, personalization_json, send_status, sent_at, provider_message_id)
- `email_events` — inbound webhook events (recipient_id, event_type: open/click/reply/bounce/unsubscribe, occurred_at, provider_event_id, metadata_json)

Consuming features: #9, #11, #14

### audit_log

**Append-only. No UPDATE. No DELETE. Application role has INSERT only.**

Every compliance-relevant event, communication, and decision is written here. Integrity is maintained via a SHA-256 hash chain: each row stores `prev_hash` (the `entry_hash` of the immediately preceding row by `sequence_number`) and `entry_hash` = SHA-256(sequence_number || event_type || actor_id || subject_ref || payload_hash || prev_hash || created_at). The sequence is global and monotonically increasing (Postgres SEQUENCE, set on INSERT, never client-provided).

Tables:
- `audit_log_entries` — (sequence_number BIGINT GENERATED ALWAYS, entry_hash TEXT NOT NULL, prev_hash TEXT NOT NULL, event_type TEXT NOT NULL, actor_id UUID NOT NULL, subject_type TEXT, subject_id TEXT, payload_hash TEXT, payload_json JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now())
- `audit_log_integrity_checks` — results of periodic hash-chain verification runs (check_id, checked_at, verified_through_sequence, status: ok/tamper_detected, first_bad_sequence, checked_by)

The `payload_json` field stores the full event payload for FINRA/SOX export. `payload_hash` = SHA-256(payload_json::text) so payload integrity is independently verifiable against the hash chain.

Consuming features: #10, #11, #13, #25

### compliance_rules_suppression

Compliance configuration: pre-send check rules, suppression lists, per-jurisdiction disclaimers, and content-bound approval snapshots. The four tables below are **standard-DML (mutable)** config — INSERT / UPDATE / DELETE are all permitted to the app role. They are explicitly NOT subject to the immutability controls on `audit_log_entries` (no REVOKE/GRANT restriction, no BEFORE UPDATE/DELETE trigger, no TRUNCATE guard). Their audit trail is provided by appending to the immutable `audit_log_entries` table inside every mutation transaction — enforced at the service layer, not the DB. Every FK to `users.id` is `ON DELETE SET NULL` so a config row survives its author's deletion (the role/actor is preserved in the audit log).

Shapes below are the as-built shapes (schema file `apps/api/src/db/schema/compliance-rules.ts`), reconciled from an earlier stale design sketch. Enums are Drizzle `pgEnum` mirrored 1:1 by Zod enums in `packages/shared`.

Tables:
- `compliance_rules` — the rule registry (id UUID PK, rule_type ENUM[blocklist_check | disclaimer_required | approval_required | jurisdiction_check], jurisdiction TEXT NULLABLE [NULL = global], config JSONB NOT NULL [rule-type-specific params], enabled BOOL DEFAULT true, created_at, created_by UUID NULLABLE FK→users.id SET NULL, updated_at TIMESTAMPTZ NULLABLE via Drizzle `.$onUpdateFn`)
- `suppression_list` — email/domain suppression entries (id UUID PK, match_type ENUM[email | domain], value TEXT NOT NULL [normalized lower-case at the service layer], reason TEXT NULLABLE, created_at, created_by UUID NULLABLE FK→users.id SET NULL). Index `(match_type, value)` — the gate's suppression lookup path.
- `disclaimer_templates` — versioned, jurisdiction-scoped disclaimer bodies (id UUID PK, jurisdiction TEXT NOT NULL [no global rows], body TEXT NOT NULL, version INT NOT NULL [monotonic per jurisdiction, service-managed], active BOOL DEFAULT true [at most one active per jurisdiction], created_at, created_by UUID NULLABLE FK→users.id SET NULL). Append-style versioning: an edit inserts version+1 and deactivates the prior row. Index `(jurisdiction, active)` — the gate reads the active row per jurisdiction.
- `compliance_approvals` — per-resource approval snapshots (id UUID PK, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, content_hash TEXT NOT NULL [SHA-256 hex of content at approval time; the gate recomputes and compares, so any post-approval edit invalidates the approval], approver_user_id UUID NULLABLE FK→users.id SET NULL, approver_role TEXT NOT NULL [role snapshot at approval time, unconstrained text for forward-compat], status ENUM[approved | revoked] [revocation is a soft-delete DML UPDATE], created_at). Index `(resource_type, resource_id)` — the gate's active-approval lookup.

**Separation-of-duties enforcement is application-layer, not a DB CHECK.** `approver_role` is unconstrained text at the DB; the pre-send gate's SoD evaluator ONLY accepts `approver_role = 'compliance'` (admin is excluded — "no super-role shortcut around separation of duties" per `security.md` §RBAC-SoD), and requires the approver to be a different person than the sender, with the approver identity read only from the persisted row (never client-supplied). Settings-CRUD `@Roles` on these four tables is `compliance, admin` (admin MANAGES config — a distinct authority from APPROVING a send); only the send-approval path is compliance-only.

Consuming features: #11, #12

### users_roles

Application user records and role assignments. SuperTokens manages authentication credentials and sessions; this schema stores the application-side user profile and RBAC bindings that SuperTokens does not own.

Tables:
- `users` — application user profiles (id UUID matching SuperTokens user_id, email, full_name, status: active/suspended, created_at)
- `user_roles` — role assignments (user_id, role: advisor/analyst/compliance/admin, assigned_by, assigned_at, revoked_at NULLABLE)
- `invitations` — pending user invites (token_hash, email, role, invited_by, expires_at, accepted_at NULLABLE)

Consuming features: #15, #18

### data_source_connections

Configuration for external deal-source and enrichment integrations. Credentials are never stored in this table — they are stored in Railway environment variables and referenced by a stable `provider_key`. This table stores connection metadata and sync state only.

Tables:
- `data_source_connections` — (id, provider_key: e.g. "grata" / "cyndx", display_name, status: active/paused/error, last_sync_at, sync_frequency_minutes, config_json [non-secret config: field mappings, filters], created_by, created_at)
- `sync_runs` — per-connection sync job history (connection_id, started_at, completed_at, status: running/ok/partial/failed, records_ingested, records_updated, error_summary)

Consuming features: #1, #17

### pipeline_stages

Deal pipeline tracking. Buyers advance through advisor-defined stages within a mandate's pipeline. Notes and next actions attach to pipeline entries.

Tables:
- `pipeline_stage_definitions` — per-mandate stage configuration (mandate_id, stage_order, stage_name, is_terminal bool)
- `pipeline_entries` — buyer position in a pipeline (mandate_id, company_id, current_stage_id, entered_at, updated_at, owner_id)
- `pipeline_events` — stage transitions + notes (pipeline_entry_id, event_type: stage_advance/note/next_action_set, from_stage_id NULLABLE, to_stage_id NULLABLE, note_text NULLABLE, next_action_text NULLABLE, next_action_due NULLABLE, actor_id, created_at)

Consuming features: #14

---

## Conventions

### Drizzle schema layout

Each module above maps to exactly one file:

```
apps/api/src/db/schema/
  mandates.ts
  companies-contacts.ts
  buyer-universe.ts
  matches.ts
  templates.ts
  outreach-campaigns.ts
  audit-log.ts
  compliance-rules-suppression.ts
  users-roles.ts
  data-source-connections.ts
  pipeline-stages.ts
  index.ts          ← re-exports all tables; consumed by drizzle() config
```

`apps/api/src/db/index.ts` initializes the Drizzle client using the `DATABASE_URL` env var (Railway injects this at runtime). All query code imports the db client and table references from this module — never constructs raw SQL except where noted in Stack-specific decisions.

### Migration policy

- Drizzle Kit generates migrations via `pnpm db:generate` (alias for `drizzle-kit generate`).
- Migrations live in `apps/api/src/db/migrations/` and are committed to source control.
- `pnpm db:migrate` runs `drizzle-kit migrate` (applies pending migrations against `DATABASE_URL`).
- Migrations run in CI before integration tests; in production they run as a Railway deploy hook before the new revision receives traffic (zero-downtime: additive-only in MVP; destructive changes require an explicit migration window noted in the PR).
- **Never edit a committed migration file.** Generate a new migration for corrections.
- The audit-log table migration must include the column-level GRANT restriction (see Stack-specific decisions) as a raw SQL statement within the migration file — Drizzle Kit does not generate GRANTs natively; embed as `sql\`REVOKE UPDATE, DELETE ON audit_log_entries FROM <app_role>; GRANT INSERT, SELECT ON audit_log_entries TO <app_role>;\`` in the migration.

### Naming conventions

- Table names: `snake_case`, plural nouns (`companies`, `match_results`, `audit_log_entries`).
- Column names: `snake_case`.
- Primary keys: `id UUID DEFAULT gen_random_uuid()` on all application tables. Exception: `audit_log_entries.sequence_number` is a `BIGINT GENERATED ALWAYS AS IDENTITY` (the surrogate PK for ordering; a UUID `id` column may coexist for external reference if needed).
- Foreign keys: `<referenced_table_singular>_id` (e.g., `mandate_id`, `company_id`).
- Timestamps: `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ` managed via Drizzle `.$onUpdateFn(() => new Date())` where applicable. The audit-log table has `created_at` only — no `updated_at` (rows are immutable).
- Soft-delete: use a `status` enum column with an `archived` or `revoked_at` value; do not use a `deleted_at` boolean pattern. Hard deletes are never used on compliance-relevant tables.
- Boolean columns: `is_<adjective>` prefix (e.g., `is_required`, `is_terminal`).
- Enum types: defined as Drizzle `pgEnum` in the owning schema file; exported and re-used across files where shared.

---

## Reusability principles

1. **Service-layer ownership of cross-module reads.** No module's Drizzle schema file imports another module's table definitions for join queries. Cross-module data is fetched by the NestJS service layer via sequential or parallel queries, then composed in application code. This prevents circular imports between schema files and keeps module boundaries explicit.

2. **Audit-log writes are always the last operation in a transaction.** Any application code that writes to `audit_log_entries` does so as the final statement in the database transaction covering the associated business operation, so a failed audit write rolls back the business write. This is enforced by convention at the service layer and verified in integration tests.

3. **Provenance columns are non-nullable on ingest tables.** Every row in `company_data_sources` and `contact_data_sources` must have a non-null `source_connection_id` and `ingested_at`. Drizzle schema definitions mark these `notNull()`; the application never omits them.

4. **No direct table access from the API controllers.** Controllers call NestJS services; services own Drizzle queries. This keeps query logic testable in isolation and allows the audit-log write convention (principle 2) to be enforced at a single layer.

5. **JSONB for variable/extensible payloads, typed columns for queried fields.** Fields that are filtered, sorted, or joined on are typed columns. Fields that are stored-and-retrieved (AI rationale, event payloads, personalization blobs, raw config) are JSONB. Index JSONB paths only when a query pattern is demonstrated; do not pre-index speculatively.

6. **Sequence numbers are DB-generated, never application-generated.** `audit_log_entries.sequence_number` uses `BIGINT GENERATED ALWAYS AS IDENTITY`. The application never supplies this value; the DB enforces strict monotonicity. This prevents gap injection attacks on the hash chain.

---

## Cross-references

- `stack-decisions.md` — PostgreSQL on Railway + Drizzle ORM selection rationale; SuperTokens auth DB note; Railway Buckets for document/export storage.
- `feature-list.md` — features #10, #11, #12, #13 (compliance wedge, H1 by founder override) drive the audit-log and compliance-rules schema designs in this document.
- `tools-modules-map.md` — internal modules listed there map 1:1 to schema files in the Inventory above. The "Audit-log service (append-only, tamper-evident)" and "Compliance rules engine" modules are structurally enforced here, not left to runtime convention.
- `user-journey-map.md` — pages 15 (Compliance queue), 16 (Audit log & export), 17 (Compliance settings) rely on the compliance-heavy schemas; page 12 (Sourcing workspace) and 13 (Companies & contacts) rely on `data_source_connections` and `companies_contacts`.
- Security architecture branch (to be authored) — will detail the Postgres role/grant matrix, SSL-in-transit configuration for the Railway private network, and row-level security considerations for H3 multi-tenancy.
- Background jobs architecture branch (to be authored) — will detail the integrity/verification job that walks `audit_log_entries` in sequence-number order and writes results to `audit_log_integrity_checks`.

---

## Stack-specific decisions

### Drizzle migrations

Drizzle Kit is the sole migration authority. The migration workflow is:

1. Developer edits a schema file in `apps/api/src/db/schema/`.
2. `pnpm db:generate` computes the diff and writes a new `.sql` file to `apps/api/src/db/migrations/`.
3. Developer reviews the generated SQL before committing.
4. CI runs `pnpm db:migrate` against a test database before running integration tests.
5. The Railway deploy hook runs `pnpm db:migrate` against the production database before the new service revision is activated.

The `drizzle.config.ts` at the repo root (or `apps/api/`) specifies `dialect: "postgresql"`, `schema: "./src/db/schema/index.ts"`, `out: "./src/db/migrations"`, and reads `DATABASE_URL` from the environment.

### Append-only audit table design and integrity hashing

The `audit_log_entries` table is structurally append-only via Postgres permissions:

- A dedicated application role (e.g., `dealflow_app`) is granted `INSERT` and `SELECT` on `audit_log_entries`. `UPDATE` and `DELETE` are explicitly revoked (and never granted). This is enforced in the migration as raw SQL (see Migration policy above).
- A separate read-only reporting role (e.g., `dealflow_readonly`) holds `SELECT` only; used by the recordkeeping export module.
- No application code path opens a superuser or table-owner connection; Railway's managed Postgres superuser credentials are held only by Railway for migrations.

Hash chain construction:

- `entry_hash` = `encode(sha256(convert_to( sequence_number::text || '|' || event_type || '|' || actor_id::text || '|' || coalesce(subject_type,'') || '|' || coalesce(subject_id,'') || '|' || coalesce(payload_hash,'') || '|' || prev_hash || '|' || created_at::text, 'UTF8')), 'hex')`.
- `prev_hash` for `sequence_number = 1` is the well-known genesis string `'0000000000000000000000000000000000000000000000000000000000000000'` (64 hex zeros).
- Hash computation is performed in the NestJS audit-log service before the INSERT, not inside the DB. This keeps the logic version-controlled and testable. A Postgres trigger is not used (triggers can be disabled by superusers; application-layer computation is independently auditable from the codebase).
- The `audit_log_integrity_checks` table records the result of periodic verification runs (background job: walks all rows in sequence order, recomputes each `entry_hash` from stored fields, compares to stored value, detects any break in `prev_hash` linkage). Verification runs are idempotent and non-destructive.

### Data retention for FINRA/SOX recordkeeping

- Audit log rows are retained indefinitely within the application database for MVP. The `sequence_number` + `created_at` range supports time-bounded export queries.
- The recordkeeping export module (feature #13) produces a verifiable export package: a JSONL file of `audit_log_entries` rows for the requested date/mandate range, plus a manifest containing the `entry_hash` of the first and last included row and the SHA-256 of the full JSONL file. The package is written to Railway Buckets (S3-compatible object storage) as an immutable object.
- Email communications stored in `campaign_recipients` and `email_events` are retained for a minimum of 3 years in the application database; archival beyond that is an H2 task (`feature-list.md` #25).
- A formal retention schedule with automated purge jobs is deferred to H2 (#25). For MVP, no rows are deleted from compliance-relevant tables (`audit_log_entries`, `campaigns`, `campaign_recipients`, `email_events`, `compliance_approvals`).

### Backup strategy on Railway-managed Postgres

Railway's managed Postgres provides automatic daily backups with point-in-time recovery (PITR) via continuous WAL archiving. Specific capabilities depend on the Railway Postgres plan active on the founder's account.

DealFlow AI's backup obligations for MVP:

- **Daily automated backup:** provided by Railway; no additional configuration required.
- **PITR window:** target minimum 7-day PITR window (Railway Postgres plans vary; the founder must confirm the active plan provides this at deploy time — noted as an open item below).
- **Backup verification:** Railway does not expose automated restore-test tooling. As a compensating control, a manual restore-test to a staging instance is performed monthly and documented in `process/session/updates/` as a compliance checkpoint. Automated restore testing is an H2 operational improvement.
- **Offsite / export backup:** the recordkeeping export packages written to Railway Buckets serve as a secondary compliance-data backup. For the full application DB, Railway Buckets-based pg_dump export (scheduled nightly via a background job) is an H2 item; not in-scope for MVP given Railway's native PITR.
- **RTO / RPO targets:** RPO < 24 hours (Railway daily backup baseline for MVP; narrowed to < 5 min via PITR if Railway plan supports WAL archiving). RTO < 4 hours for a full restore from Railway backup (Railway-dependent; to be validated at first production deploy).

### Local-dev seed entry-point

The seed entry-point is declared at `apps/api/src/db/seed.ts` (Drizzle). This file is the single executable that populates a local or CI development database with reference data (roles, demo mandates, test users, sample companies, fixture compliance rules). It is invoked via `pnpm db:seed`.

**Seed content is not authored here.** The entry-point convention is declared now so that all wave build tasks referencing test data, CI setup, and local-dev onboarding have a stable target path. Content is authored in the wave that implements the first feature requiring it.

---

## Risk / open items

| # | Item | Owner | Urgency |
|---|---|---|---|
| 1 | **Railway Postgres plan PITR confirmation** — the backup strategy above assumes WAL-based PITR is available; must confirm the founder's Railway account plan provides a PITR window of ≥7 days before first production deploy. If not, a pg_dump export job must be added earlier than H2. | Founder (account access) + infra setup wave | Before first production deploy |
| 2 | **Application role name and grant migration** — the specific Postgres role name (`dealflow_app`) must be established in the first DB migration. Railway managed Postgres creates a default user; the migration-author must verify whether a separate least-privilege role can be created on Railway's managed offering or whether the default user is the application user (in which case the REVOKE approach for `audit_log_entries` is the primary control, not role separation). | DBA / infra setup wave | Wave 1 / DB setup |
| 3 | **Hash-chain genesis row** — the first `audit_log_entries` row uses a hardcoded `prev_hash` genesis value. This value and the exact hash-input serialization format must be locked in code and documented before any compliance export is produced; changing either after data exists invalidates the chain. | Audit-log service implementation wave | Before first audit event write |
| 4 | **Payload retention and PII in `payload_json`** — `audit_log_entries.payload_json` may contain PII (contact names, email addresses) embedded in communication payloads. A data minimization policy (what goes in payload vs. what is referenced by ID) must be decided before implementation to avoid GDPR/CCPA exposure on retained immutable rows that cannot be deleted. | Compliance + legal review | Before audit-log service implementation |
| 5 | **Multi-tenant schema isolation (H3)** — the current schema design has no `tenant_id` / `workspace_id` column on most tables. H3 multi-tenancy (feature #27) will require either a `workspace_id` column added to every table (additive migrations, large surface) or a Postgres schema-per-tenant approach. This decision is deferred but should be flagged at H2 design time to avoid a costly retroactive migration. | Architecture review at H2/H3 boundary | H2 planning |
| 6 | **Background job queue tech not yet decided** — the integrity verification job and enrichment/outreach queues reference a background job system that has not been selected (noted in `stack-decisions.md` as "likely Redis-backed, evaluated at v6"). The `sync_runs` and `audit_log_integrity_checks` tables above are queue-tech-agnostic; no schema change is anticipated, but the job invocation mechanism will drive additional tables (e.g., a `jobs` queue table) if a DB-backed queue (pg-boss / Graphile Worker) is chosen over Redis/BullMQ. | Architecture — background jobs branch | Background jobs architecture wave |
| 7 | **SuperTokens Postgres instance isolation** — SuperTokens Core uses its own Postgres instance on Railway (separate from the application DB). Connection strings must never be cross-wired. The `users` table in `users_roles` schema holds the application-side user profile; the canonical `user_id` UUID is issued by SuperTokens and treated as an opaque foreign key in the application DB. This coupling must be documented in the auth architecture branch. | Auth architecture branch | Auth implementation wave |

---

## As-built reconcile — §companies_contacts + §data_source_connections (wave 6, deal-sourcing data spine)
The wave-6 deal-sourcing spine implemented an as-built schema that supersedes the earlier pre-implementation sketch in these two modules (same reconcile pattern as the compliance-tables note above). As-built shapes:
- **data_source_connections** — `provider_key` (Railway-env credential NAME; NO secret column), `display_name`, `enabled boolean`, `config jsonb`, `created_at/by`. (Sketch's `status/last_sync_at/sync_frequency_minutes` DEFERRED with scheduled sync — this wave is on-demand-only; `status:error` surfaced at the ETL boundary, not persisted.)
- **raw_companies** (NEW staging tier — the sketch had none) — source-of-record, `UNIQUE(connection_id, source_record_id)` idempotent upsert; ingest writes here only.
- **companies / contacts** (canonical, deduped truth) — `companies.normalized_domain` carries a partial-unique `WHERE normalized_domain IS NOT NULL` (DB-level dedup backstop).
- **company_provenance** + **contact_provenance** — canonical←raw source lineage (non-null source_connection_id + ingested_at per reusability principle 3, preserved at BOTH company and contact level). (Supersedes the sketch's `company_data_sources`/`contact_data_sources` naming; same invariant.)
- **dedupe_candidates** — keyed `(raw_company_id, matched_company_id)` (staging-vs-canonical review; supersedes the sketch's canonical-pair `(entity_a_id, entity_b_id)`), `status[pending|merged|rejected]`.
- **DEFERRED (not dropped):** `sync_runs` history (open-item #6, returns with scheduled sync); real provider adapters (fixture adapter this wave); contact enrichment; sourcing-workspace page.
