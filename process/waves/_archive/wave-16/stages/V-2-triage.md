# Wave 16 — V-2 Triage
Both V-1 reviewers APPROVE (0 spec-drift, 0 fabricated claims) → **ZERO blocking**. Fast-fix queue EMPTY. No B re-entry.
## Non-blocking → 3 tasks INSERTed under M7 (+ sibling-raw-params noted)
- G-1 (Low): invite advisory-lock hashtext 32-bit collision — throughput-only, correctness unaffected (SELECT-live-check under lock filters exact email). P-2: widen key-space if invite volume grows.
- G-2 (Low): admin-activity exposes monotonic sequenceNumber (pagination cursor) to admins — not secret/PII, but exposes audit volume/order. P-2: decide opaque/encoded cursor.
- G-3 (Low, security-adjacent): config fieldMapping values are bounded-length (≤128) but free-value — a short secret could technically pass the whitelist into plaintext config. The no-DEDICATED-free-text intent is met (fieldMapping = provider field-names), but a format-regex on values would fully close P-4 Finding 2. P-2: add value format constraint.
## Noise (suppressed): jenny "disclaimer derived not inherited" (correct posture, documented — not a defect); the pre-existing sibling deactivate/role raw-param debt (INFO, pre-wave, not net-new).
## Fast-fix queue: [] | B re-entry: []
```yaml
findings_input_count: 6
findings_blocking: []
findings_non_blocking: [{id: G-1, milestone_id: M7}, {id: G-2, milestone_id: M7}, {id: G-3, milestone_id: M7}]
findings_noise: [disclaimer-derived-posture, sibling-raw-params-preexisting]
fast_fix_queue: []
b_block_re_entry_required: []
```
