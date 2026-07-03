# Wave 5 — B-2 Backend (schema + gate + evaluators + CRUD)
## Part 1 — schema (postgres-pro, commit 64f0b60)
apps/api/src/db/schema/compliance-rules.ts (4 MUTABLE config tables + 3 pgEnums) + barrel. Migration 0003_giant_outlaw_kid (+down). Indexes: suppression(match_type,value), disclaimer(jurisdiction,active), approvals(resource_type,resource_id). **NO immutability trigger/grant** (distinct from audit_log — audited-on-change). $onUpdateFn first live use. Additive.
## Part 2 — gate service + evaluators (security-engineer, commit 26f13a7)
apps/api/src/modules/compliance-gate/{compliance-gate.service,repository,content-hash,module}.ts + evaluators/{suppression,sod,disclaimer,content-hash}.evaluator.ts + specs; app.module wiring.
- **Non-bypassable:** evaluate(ctx, tx) 2-param no-skip; evaluators private const iterated unconditionally every call; verdict→AuditService.append('gate-evaluate') IN-TX BEFORE return; audit-fail→throw→rollback (NO verdict without audit). evaluateStandalone opens own tx.
- **SoD = compliance ONLY (matrix PROVEN):** compliance approver→allowed; admin/advisor/analyst→BLOCKED (no super-role shortcut per security.md §RBAC-SoD); sender==approver→blocked; no-row→no-approval block; revoked→blocked. SOD_APPROVER_ROLE='compliance'. Approver from stored row server-side.
- Suppression exact+domain-suffix(dot-boundary) hard-block; disclaimer enforced; content-hash keyless SHA-256 canonicalized (post-edit re-block).
- Default posture allow-with-no-rules (SoD → deny-until-approved). 22 gate tests.
## Part 3 — CRUD (backend-developer, commit c390359)
apps/api/src/modules/compliance/{rules,suppression,disclaimers}.{controller,service}.ts + dto + specs; compliance.module wiring.
- CRUD /compliance/{rules,suppression,disclaimers} @Roles compliance/admin (config mgmt — DISTINCT from SoD approver); RBAC matrix compliance/admin 2xx, advisor/analyst 403, anon 401.
- **Every mutation audited IN-TX** (rule-change/suppression-change/disclaimer-change via AuditService.append; audit-fail→rollback, no silent unaudited change). GET not audited.
- **Disclaimer edit = new-version** (deactivate prior + insert version+1, append-style). Zod validation 400.
## Verify
typecheck clean; biome 0 err (2 pre-existing infos); api tests 158 pass/1 skip.
```yaml
skipped: false
specialists_spawned: [postgres-pro, security-engineer, backend-developer]
commits: [64f0b60, 26f13a7, c390359]
sod_compliance_only_proven: true
non_bypassable: true
deviations: ["gate repository split (evaluator purity)", "createZodDto inline parse (no global pipe)"]
simplify_applied: true
```
