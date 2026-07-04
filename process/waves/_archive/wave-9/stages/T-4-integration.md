# Wave 9 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration: buyer-universe assemble/filter/enrich/submit→DB (one-txn + audit-last-in-txn + idempotent via mandate_id UNIQUE + composite candidate UNIQUE); reads M3 companies (assemble) + M4 mandateBuyerCriteria (filter) + M3 contacts (enrich); migration 0008. **LIVE at C-2 first-try (937ae18):** assemble 201+idempotent(re-assemble=same universe)+candidates-from-M3; filter→Detail+partial-dims-honest(geo recorded not-applied); enrich→Detail(3 contacts); submit-guard(0-included→400)/submitted; SSR-hydrates-existing-universe(CRIT-1); NO rank/score(byte-scan); RBAC(anon 401/compliance 403/analyst 2xx); audited(chain ok 153); D6 link; mandate_id UNIQUE live-enforced.
```yaml
test_pattern: ci-verified
skipped: false
live_c2_evidence: ["assemble 201+idempotent", "filter→Detail+partial-honest", "enrich→Detail", "submit-guard 400/submitted", "SSR-hydrates", "no-rank byte-scan", "RBAC", "audited", "migration 0008 mandate_id UNIQUE"]
findings: []
