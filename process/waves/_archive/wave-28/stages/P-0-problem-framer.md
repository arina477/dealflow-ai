verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: the seed correctly frames M10 RETENTION as CONFIG + read-only
  CUTOFF SURFACING (a policy the firm sets + a "records older than X" display), NOT
  a purge of audit_log_entries. Verified the load-bearing crux against code: the
  WORM trigger audit_log_no_mutate (migration 0002) fires BEFORE UPDATE OR DELETE
  unconditionally for every role incl. superuser, and audit-log.ts documents it as
  the sole backstop; a "retention" feature that deleted audit rows would hit this
  trigger and break the HMAC chain. The seed explicitly DEFERS genuine retention-
  delete to founder/compliance — this is the causally correct design (a mutable
  policy-config table sitting BESIDE the immutable chain, never mutating it). All
  four supporting concerns are grounded in existing prior art: RLS pattern
  (workspace_isolation policy + FORCE ROW LEVEL SECURITY, migration 0014) exists to
  copy; new table MUST add its own policy in-migration (wave-27 lesson holds — RLS
  is not inherited); RolesGuard/@Roles() RBAC exists; AuditService append path
  exists; and admin/workspace-settings.service.ts is a near-identical workspace-
  scoped, role-guarded settings-mutation precedent. No antipattern matches.
proposed_reframe: |
  n/a — PROCEED.
escalation_reason: |
  n/a — PROCEED.
sibling_visible: false

# Load-bearing concerns (flagged for P-1/P-2/P-3, all judged SOUND at framing level)

## 1. WORM-preservation (THE crux) — SOUND
Confirmed audit_log_no_mutate (0002) blocks all UPDATE/DELETE on audit_log_entries
unconditionally. Seed stores POLICY, not a deletion mechanism; retention-DELETE
over WORM data is DEFERRED. Carry a NON-NEGOTIABLE acceptance criterion into P-2:
this wave adds NO code path that DELETEs/UPDATEs audit_log_entries, and the HMAC
chain (AuditVerifier.verifyChain / read_audit_chain_rls_exempt) stays verifiable
end-to-end. T-8 Security must prove no audit-mutation path was introduced.

## 2. RLS on the NEW config table — SOUND but MUST be explicit in the migration
workspace_retention_policy is per-workspace; without its OWN RLS policy a firm
could read/write another firm's config. The migration MUST replicate the 0014
pattern: ENABLE + FORCE ROW LEVEL SECURITY + CREATE POLICY "workspace_isolation"
using the app-role GUC, read via getDb workspace-scoped connection. Do NOT assume
inheritance (wave-27 lesson). Carry an isolation e2e AC (mirror
recordkeeping-export-isolation / seller-intent-isolation) into T-8.

## 3. RBAC (admin/compliance, fail-closed) — SOUND
Setting retention is a sensitive admin/compliance action. RolesGuard + @Roles()
prior art exists (admin/workspace-settings.service.ts). Confirm the exact role at
P-2; guard fail-closed.

## 4. Audit-log the CONFIG CHANGE (not the audited data) — SOUND & IN SCOPE
A retention-window change (old->new, who, when) is itself sensitive -> append to
the M2 chain via AuditService. Note the clean separation: we WRITE a new audit
entry recording the policy change; we never mutate existing entries. Keep this AC.

## 5. ~7yr LIGHT default — SOUND at light posture (no founder-ask required)
A ~7-year default for M&A/deal recordkeeping is a defensible sensible default at
light posture (rule 17: technical/sensible-default -> apply silently). The table is
MUTABLE, so a firm can override. Flag for P-2 only: make the default a documented
constant, not a magic number, and surface it as editable in the UI so the firm
owns the legal call. Not a founder-reserved decision at light posture.

## 6. Migration — SOUND
Additive, journaled Drizzle migration, RLS-scoped. NOT a WORM table, so the wave-24
populated-migration AC does not strictly apply. Still must journal + apply cleanly +
carry its own RLS policy (concern 2).

## 7. design_gap = TRUE — CONFIRMED
New settings/cutoff-surfacing UI -> D-block runs (D-1/D-2/D-3). Confirmed.

Sizing (4 tasks: migration+RLS / shared-Zod contracts / RBAC service+API / settings UI)
is P-1's call, not framed here.
