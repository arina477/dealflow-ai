# Wave 11 — T-4-integration
Pattern A (CI-verified). CI run 28740703914 test job green.

## Integration coverage (audit) — NOT hollow
outreach-gate.e2e-spec (6 un-mocked cases vs real Postgres, real ComplianceGateService+Repository+AuditService, rollback-isolated) GREEN:
- A: approved + SoD-clean -> real gate returns allowed=true (send_eligible reachable) — THE HEADLINE
- B: no-approval -> blocked
- C: composer==approver -> sod/sender-is-approver block
- D: content-drift (re-drafted v2) -> blocked
- M-2: non-pending approve -> ConflictException
- C-2: listTemplatesWithVersions embeds versions
Definitive proof the compliance_approvals-bound gate reaches send_eligible ONLY through a passing evaluate(). Self-migrates the test DB in beforeAll.

```yaml
test_pattern: ci-verified
evidence:
  - "CI run 28740703914 test job: outreach-gate.e2e 6/6 green vs real Postgres"
  - "593 api + 458 shared + 431 web unit/component green"
findings: []
```
