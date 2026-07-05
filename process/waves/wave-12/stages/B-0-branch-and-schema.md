# Wave 12 — B-0 Branch & schema
- Branch: wave-12-pipeline-tracking. Claimed 3 tasks (07989285/d1940142/45b259e1 → in_progress).
- Schema (backend-developer, efbcfad): apps/api/src/db/schema/pipeline.ts — pipeline + pipeline_events tables + 2 distinct pgEnums (pipeline_stage 7 fixed values, pipeline_event_type 3). Idempotent-enroll: 2 partial unique indexes (outreach_id / match_candidate_id each unique-where-not-null). XOR CHECK (exactly one deal target). Append-only pipeline_events + (pipeline_id, created_at) index. FK targets verified uuid PKs (mandates/outreach/match_candidates/users).
- Migration 0011_brainy_the_liberteens.sql + .down.sql (child-first drop). **BUILD rule 4:** generator emitted stale when 1783268980210 < 0010 → developer CORRECTED to 1783728000000 > 0010's 1783641600000 in _journal.json idx 11 (Ghost-Green avoided).
- typecheck clean; biome 0 net-new.
```yaml
branch: wave-12-pipeline-tracking
schema_skipped: false
migrations: [0011_brainy_the_liberteens.sql]
distinct_enums: [pipeline_stage, pipeline_event_type]
journal_when_gt_prev: true
commit: efbcfad
