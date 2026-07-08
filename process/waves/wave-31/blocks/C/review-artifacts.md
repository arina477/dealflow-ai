# Wave 31 — C-block review artifacts
**Wave topic:** M9 Twenty CRM DataSourceAdapter merged to main. | **Block exit gate:** C-2 | **Status:** in-progress
**merged_headSha:** b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891 (direct-push-to-main — PAT lacks PR:write)
| Stage | Deliverable | Status |
|---|---|---|
| C-1 | CI-watch on merged headSha | pending |
| C-2 | deploy (dormant) + verify boot | pending |
## C-block obligations (head-ci-cd polices):
- C-1: verify a check-suite FIRED on THIS exact merged headSha (b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891). CI-billing guard (CI #2): if 0 check-suites fired (Actions minutes exhausted — recurring this session), do NOT fabricate a green → STATUS BLOCKED (trigger d, infra-readiness). Watch to green if CI runs.
- C-2: NO migration (adapter-only; config schema untouched). Deploy to Railway (the app bundle changed — new adapter registered). Verify: app BOOTS clean WITHOUT TWENTY_API_KEY/TWENTY_BASE_URL (graceful-dormant — the adapter returns [] , fixture/Affinity search still works). This is the KEY-GATED deploy: LIVE Twenty fetch is NOT verifiable until the founder provides the key + instance URL (a follow-up, do NOT block the wave).
- NO .github/workflows changes (PAT lacks Workflows:write).
## LIVE-verify (real Twenty data) = founder-gated (TWENTY_API_KEY + TWENTY_BASE_URL). C-2 verifies the DORMANT deploy (boot-clean), same as wave-30 Affinity.

## C-block exit: APPROVED
- C-1: check-suite 78284698632 FIRED + SUCCESS on exact merged headSha b1f81d79 (5 runs green: typecheck/test/lint/audit/build). GENUINE green — NOT billing-blocked this wave.
- C-2: Railway dealflow-api deploy 986c1b1d (commitHash b1f81d79, active-routed, boot-clean-DORMANT: /health 200 + db:ok; Twenty adapter registered, graceful-[] without key; stale-SHA a6ad02c redeploy caught+discarded; rollback a7d479ac armed; 0 migrations; canary skipped <1000 DAU).
- LIVE Twenty verify (real companies) = founder-gated (TWENTY_API_KEY + TWENTY_BASE_URL; follow-up staged). NOT a C-2 blocker (dormant deploy verified, mirrors wave-30 Affinity).
- FLAG for L-2: head-ci-cd appended a CI-PRINCIPLES rule mid-C-block — L-2 (head-learn/knowledge-synthesizer) must ratify (counts vs AT-MOST-ONE-per-wave) or revert per the promotion gate.
**Status:** gate-passed → T-block
