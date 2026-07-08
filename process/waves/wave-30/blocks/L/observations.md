# Wave 30 L-2 Observations — M9 Affinity DataSourceAdapter

Wave: 30 | Topic: external-SDK CRM adapter (Affinity DataSourceAdapter, dormant)
Promotion this wave: NONE (0 of 4 consecutive clean waves; bar is high; honest judgment below)

---

## OBS-W30-1 (NEW — HOLD)

**Observation:** An external-data adapter must validate its own output against the normalized contract (e.g., `normalizedSourceRecordSchema.safeParse`) before returning, matching the discipline the sibling fixture adapter already applies. The Affinity adapter skips this step; the fixture adapter does it. A malformed external record (bad email, missing required field) can flow into the platform undetected.

**Candidate principle (if promoted):**
```
Every external-data adapter must safeParse its own output against the normalized output schema before returning.
   Why: Skipping self-validation lets malformed external records flow into the platform undetected.
```

**Honest judgment — NOT promoting this wave:**
- 1-wave sighting only; BUILD-PRINCIPLES requires 2+ waves.
- This is a "match the existing sibling pattern" gap (fixture adapter already does it), not a novel architectural lesson. A reviewer catching it is correct; a principle for it is premature until a second wave exposes the same omission independently.
- Being fixed pre-live-hookup (before real Affinity data flows), so no shipped defect materializes.
- Hold: promote on second sighting in any subsequent external-adapter or ingestion-boundary wave.

---

## HELD QUEUE (carried forward unchanged)

**OBS-W27-1** (held 3 waves): HTTP-boundary producer-vs-consumer tautology — a client-side test that re-encodes from the same spec it implements cannot catch the encoding bug. Strong, generalizable. No recurrence this wave (clean adapter wave, no HTTP-client test-tautology exposure). Carry to wave 31.

**Relationship check — OBS-W27-1 vs OBS-W30-1:** Different classes. W27-1 is a test-design problem (tautological coverage); W30-1 is a missing runtime safeParse call. Adjacent (both "boundary") but distinct failure modes and distinct fixes. Not the same principle.

**OBS-W29-1** (held 1 wave): Assert-by-type over assert-by-value — asserting a property exists rather than asserting its exact value leaves the wrong value undetected. No recurrence this wave. Carry to wave 31.

**OBS-W27-4** (held 3 waves): carry to wave 31.

**OBS-W25-2** (held): carry to wave 31.

**readTail-RLS-exempt** (held): carry to wave 31.

**RLS-on-new-table (gate-enforced)** (held): carry to wave 31.

**MG1-guard-freeze** (held): carry to wave 31.

**boot-safety** (held): carry to wave 31.

---

## Promotion decision

Promotions this wave: **0**

Reasoning: P2-a (OBS-W30-1) is a 1-wave "follow the sibling pattern" nit, not yet a cross-wave pattern. No held observation recurred this wave. The bar is high (12 principles promoted this session; 4 consecutive clean waves); honesty requires 0 promotions.
