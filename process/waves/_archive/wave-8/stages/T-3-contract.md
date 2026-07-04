# Wave 8 — T-3 Contract (Pattern A, CI-verified)
Contract surface: mandate.ts (mandateSchema/BuyerCriteria/ComplianceProfile/mandateCreateSchema [no disclaimer_template_id input — derived]/mandateConfigureSchema/MandateDetail/AvailableJurisdiction) + rbac (/mandates read advisor/admin/analyst; /mandates/new + /mandates/jurisdictions write advisor/admin) + audit (mandate-create/mandate-configure). Read-schemas passthrough (wave-7 lesson); INPUT schemas .strict() (mass-assignment guard). API↔web share types. nav⊆RBAC. No drift.
```yaml
test_pattern: ci-verified
skipped: false
findings: []
