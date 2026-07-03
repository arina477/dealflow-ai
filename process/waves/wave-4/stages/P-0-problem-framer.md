```yaml
verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  The tamper-EVIDENT design is correct at cause level, not symptom level. The wave
  fixes immutability at the DB layer (INSERT/SELECT-only grant PLUS a BEFORE UPDATE/
  DELETE trigger that raises even for privileged roles) rather than trusting the app
  to "not mutate" — this is the right layer and defeats the app-can-silently-mutate
  antipattern. Tamper-evidence uses a KEYED HMAC-SHA256 chain (Railway-secret key),
  not a bare hash, so an attacker with DB write access alone cannot forge a valid
  continuation — defeating the "hash chain without a key / forgeable" antipattern.
  Chain genesis, chain_version (key/format rotation), transactional write (audit in
  the same tx as the audited action per security.md §78), and content-hashing of
  payload (not raw PII) are all specified. Sequencing (audit substrate before the
  rules engine / pre-send gate) is correct because the gate must WRITE audit events,
  so the log is the dependency. The UI slice (integrity view + read-only recent
  entries, deferring full browse/export UI) is the right thin slice. Verifier is not
  decorative: acceptance for e6a4cbfe requires a simulated tamper (hash mismatch OR
  sequence gap) be reliably detected with the failing sequence_number reported.

symptom_vs_cause_check: |
  MANDATORY CHECK — PASS. The problem is "compliance evidence must be trustworthy for
  live-mandate M&A outreach." The wave does NOT attack a surface symptom (e.g. an
  app-level "don't edit audit rows" convention, or a plain checksum that any DB writer
  could recompute). It attacks the cause: (1) mutability is removed at the DB layer
  where even a compromised app role cannot UPDATE/DELETE; (2) undetectable forgery is
  removed by keying the chain with a secret the DB does not itself hold in a usable
  write path. Both root causes of "silently-altered evidence" are addressed at the
  layer that actually enforces them. No symptom-layer fix detected.

proceed_notes: |
  Framing is sound; the following are P-2 spec / P-3 plan sharpening items, NOT
  reframes — the orchestrator should carry them into the spec contract's edge-cases:

  1. SYMMETRIC-KEY TRUST BOUNDARY (in-scope, explicitly bounded). HMAC defends against
     a DB-write-only attacker; an attacker who ALSO exfiltrates the Railway HMAC secret
     can forge a consistent chain. This is inherent to symmetric HMAC and is the
     correct, documented pilot-stage threat model (security.md §73/§76): the verifier's
     value is detecting DB-side tampering, and the recordkeeping export ships an
     independently-checkable attestation. Asymmetric signatures / external timestamp
     anchoring are legitimately H2. NOT a reframe — flag so P-2 states the threat model
     explicitly in the verifier's acceptance criteria (what it does and does NOT defend).

  2. KEY STORAGE. Confirm at P-2 that the HMAC key lives ONLY in Railway env (never in
     the DB, never in a migration, never logged) — task a8b2b5a2 already says "read from
     a Railway secret (never hard-coded)"; make "never persisted in the app DB" an
     explicit AC so the "storing the HMAC key in the DB" antipattern can't creep in.

  3. GENESIS + GAP DETECTION as first-class ACs. sequence_number is GENERATED ALWAYS AS
     IDENTITY (gap-free on commit), but a DELETE is blocked, not impossible-to-simulate;
     the verifier must treat BOTH a hash mismatch AND a sequence_number gap as a break
     (e6a4cbfe already lists both — keep it). Genesis entry (prev_hash sentinel) must
     have a defined, verifiable form so entry #1 is not a silent verification hole.

  4. WRITE-PATH ATOMICITY. Keep security.md §78's "same transaction (or outbox)" as a
     hard AC on a8b2b5a2 so no "do the action, forget/lose the audit row" path exists;
     under concurrent appends the chain read-prev + insert must be serialized per chain
     (per-project keying) to avoid two entries claiming the same prev_hash.

escalation_reason: |
  n/a
sibling_visible: false
```
