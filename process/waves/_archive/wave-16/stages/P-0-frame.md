# Wave 16 — P-0 Frame

## Discover
- wave_db_id: 737f2b22-47fc-48b3-938e-6dfa57bd8f50 (wave_number 16, milestone M7)
- Prior-work: wave-15 shipped the M7 admin vertical LIVE @f5455d6; these 5 tasks are its V-1-jenny follow-ups (F-1/F-3/F-4/F-5/F-6). Delta-only wave.
- Roadmap milestone: M7 — Admin & settings (in_progress, Class product-feature, Tier T3). Success metric NOT yet met (sending-domain-verify #141-gated; cascade defect makes compliance defaults inert).
- Spec-contract short-circuit: **no-prior-spec** (V-2 prose rows, no YAML head) → full P-1..P-3.
- Product decisions: sending-domain DKIM/SPF/DMARC verify stays deferred (#141 founder email-provider credential) — surfaced to founder digest at N-block, NOT built in-wave. Not a new Tier-3 decision.

## Reframe
### Original framing
5 admin-hardening follow-ups from wave-15's jenny review: (seed) wire firm compliance-default cascade into mandate-create; admin-nav for /admin/integrations; invite duplicate-handling; reactivate path; config-JSONB secret guard.

### problem-framer — PROCEED
All 5 are root-cause fixes forming a coherent "finish + harden M7 admin" slice. VERIFIED task 1 is a real defect: MandateService.createAsActor never reads workspace_settings → firm compliance defaults are genuinely inert. 2 P-2 notes (non-blocking): (a) frame task-5 config-secret guard as a TYPED-BOUNDARY fix routing secrets to the encrypted credential field, not a runtime content-scanner (avoids validation-theater); (b) task-3 invite-dedup AC must cover BOTH already-registered-user AND already-pending-invite (not demo-path).

### ceo-reviewer — SELECTIVE-EXPANSION
Keep the 5-task bundle; elevate the cascade seed (904a3c25) to the mvp-critical spine with an END-TO-END inherited-default proof (a compliance-first product whose admin-set compliance defaults are silently inert falsifies the core bet). Other 4 stay as-is. M7-hardening is the right next move over M8 (metric still founder-TBD) / M5 / M6 (both externally blocked). Reactivate-path NOT premature (soft-delete without undo = incomplete primitive). Sending-domain verify stays #141-gated → founder digest, not in-wave.

### mvp-thinner — OK (floor_constraint_active: true)
Trace test WOULD split F-4/F-5/F-6 as nice-to-haves (SEED cascade + F-3 nav = mvp-critical core), BUT the mandatory floor pre-check refuses: the ~230–450 LOC / 2-task residual sits 3–6x under the single-spec floor → would force RESCOPE-AUTO-MERGE. So the cheap same-surface hardening stays batched. FLAG (non-deferrable): F-5's embedded prod-cleanup obligation (restore advisor1@example.com; WORM-safe purge of the 3 KAREN-V1-SENTINEL throwaway prod records) is live prod-hygiene debt — must ride with whichever wave executes, never deferred.

### Mediation (ceo-reviewer vs mvp-thinner)
No real conflict: ceo's SELECTIVE-EXPANSION is DEPTH on the seed (end-to-end proof), not new tasks; mvp-thinner OK keeps all 5 batched. Both agree: keep the 5-task bundle. Precedence n/a (no THIN vs EXPANSION tie).

### Disposition: PROCEED
Final framing carried into P-1: 5-task M7-hardening wave (multi-spec, 5 claimed tasks). Cascade seed is the mvp-critical spine and gets an end-to-end mandate-inherits-firm-default test (T-block must assert it). P-2 incorporates problem-framer's 2 notes. F-5 prod-cleanup rides non-deferrable. sending-domain-verify remains #141-deferred.

claimed_task_ids: [904a3c25-ab46-4050-8122-d998e5a6f2a1 (seed), 6f1a96da-d96f-4bdc-b572-5255b493653c, c54db02d-c531-4292-a246-6ba984166ce9, 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1, 2560fecc-bb12-483d-8f63-a801db6c71b1]
