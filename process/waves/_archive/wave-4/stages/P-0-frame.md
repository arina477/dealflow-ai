# Wave 4 — P-0 Frame

## Discover section
- **wave_db_id:** 71dddb0b-5a10-41d6-9d08-2349d4995136 (wave_number 4, milestone_id backfilled M2)
- **Prior-work:** M1 Foundation DONE (waves 1-3: scaffold + auth + AppShell/RBAC, all live). No prior audit-log work. architecture/security.md specifies the audit-log hash-chain + append-only design (HMAC-SHA256, AUDIT_LOG_HMAC_KEY + rotation/version); .env.example has AUDIT_LOG_HMAC_KEY placeholder.
- **Roadmap milestone:** M2 (Compliance backbone, in_progress, platform-foundation). This bundle = the audit-log SERVICE slice (table + HMAC hash-chain service + verifier + integrity-view screen); rules engine + pre-send gate deferred to a later M2 bundle.
- **Spec-contract short-circuit:** no-prior-spec → full P-1..P-3.
- **Product-decisions:** #6/#7 (additive/append-only) apply. Security-scope tightened gate WILL fire at P-4 (audit log = compliance/security surface) + T-8 Security runs.

## Reframe section
- **Original framing:** tamper-evident audit_log_entries (INSERT-only grant+trigger — DB-layer immutability) + HMAC-SHA256 hash-chained append service (each entry chains prior, keyed) + chain-integrity verifier + endpoint + compliance-settings integrity-view screen.
- **problem-framer:** PROCEED. Cause-level: DB-layer immutability (INSERT/SELECT-only grant + BEFORE UPDATE/DELETE trigger blocking even privileged roles), keyed HMAC-SHA256 chain (secret key, not forgeable bare hash), transactional write (no silent-fail), audit-before-rules sequencing right, verifier genuinely detects tampering (hash mismatch/sequence gap). No antipattern. **4 P-2 sharpening notes:** (1) symmetric-key threat-model boundary (HMAC detects app-layer/most tampering but a DB+key attacker could re-chain — document the boundary; consider it acceptable for the compliance-recordkeeping threat model, or note signature upgrade path); (2) key-storage AC (key in Railway env, NEVER in DB); (3) genesis + gap ACs (chain genesis entry; verifier detects deletions/gaps not just content edits); (4) write-path atomicity AC (audit write transactional with / reliably after the audited action — not fire-and-forget-that-can-silently-drop).
- **ceo-reviewer:** PROCEED (HOLD-SCOPE). The audit log IS the durable-wedge mechanism (bet #2); correctly sequenced ahead of M6 outreach (SoD + defensible records); appropriately ambitious (a lighter log is the bet's falsifier + can't be retrofitted); right thin slice (service + integrity view now; rules engine/pre-send gate deferred).
- **mvp-thinner:** n/a — skipped (M2 platform-foundation).
- **Disposition:** PROCEED.
- **Final framing:** Build the tamper-evident audit-log backbone — append-only DB table (grant+trigger, immutable even to the app role) + HMAC-SHA256 hash-chain append service (keyed, genesis-anchored, transactional write) + chain-integrity verifier + endpoint + compliance-settings integrity-view. Carry the 4 problem-framer sharpening notes into P-2 (threat-model boundary, key-storage, genesis/gap detection, write atomicity). Security-scope gate + T-8 apply.
