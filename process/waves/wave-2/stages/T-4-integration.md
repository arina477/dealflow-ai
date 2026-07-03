# Wave 2 — T-4 Integration (Pattern A, CI-verified)
- CI provisions real postgres:18; the test job runs against it. Boundaries: migration 0001 (users/roles/invites + 4-role seed) applied; auth.repository → Drizzle → Postgres (invite create, FOR UPDATE consume, users mapping); health route→service→DB.
- Live confirmation (C-2): migration applied on the deployed app DB (idempotent pre-deploy); /health db:ok; the full auth flow exercised the users/roles/invites tables end-to-end against the real deployed Postgres (invite row created, consumed transactionally, user row mapped to SuperTokens id, role joined for the claim).
- Rule adherence: integration hits real Postgres (no mocking). SuperTokens Core on its OWN isolated Postgres (verified distinct at C-2).
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: ["0001 migration","invite FOR UPDATE consume","users↔supertokens mapping","health round-trip"]
ci_evidence: ["CI test job real-postgres green","C-2 live auth flow exercised users/roles/invites"]
findings: []
```
