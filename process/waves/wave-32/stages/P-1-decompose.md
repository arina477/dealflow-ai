# Wave 32 — P-1 Decompose (M9 self-host Twenty foundational deploy — single-spec, INFRA/DEVOPS)
## Rubric — NO SPLIT: one coherent foundational slice (deploy the 4-service Twenty stack + S3 → auto-provision key → seed sample data → activate read → live-verify). mvp-thinner OK (splitting deploy-only ships an unproven instance). WRITE-path + screen-migration + prod-hardening = later waves.
## wave_type single-spec (1 task). design_gap false, D-skip. INFRA wave (deployment specialist). Verdict: PROCEED.
```yaml
verdict: PROCEED
wave_type: single-spec
claimed_task_ids: [878c3123]
design_gap_flag: false
d_block: skip
wave_kind: infra-deploy (self-host 3rd-party OSS app)
key_risk: API-key-auto-provisioning-spike (DB-seed primary, GraphQL fallback) — ESCALATE if both fail
```
