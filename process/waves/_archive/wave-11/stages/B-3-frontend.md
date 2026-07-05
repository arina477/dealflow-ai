# Wave 11 — B-3 Frontend (outreach pages + AC-STRIP)
nextjs-developer (2 spawns — first hit session limit mid-run; second completed the 9 failing tests). Commit 0eb1028. Branch wave-11-outreach-foundation.
## Files
apps/web/app/(app)/{outreach-templates,outreach-composer,compliance-queue}/{page.tsx,page.test.tsx,_components/*} + next.config.ts (+/outreach-data + /outreach-templates-data proxies).
## Confirmations
- **AC-STRIP HONORED (CODE-OF-CONDUCT provenance):** compose CTA = "Run Compliance Gate & Create Record" (NOT "Send"); result = send-ELIGIBLE record + explicit "No email has been sent" note; ZERO forbidden strings (send immediate/schedule send/WORM-on-send/AI drafting/AI-powered/generate-with-AI) in rendered DOM. The design Send/Schedule/AI-draft affordances STRIPPED (only doc-comments reference them). Templates: manual drafting (no AI-draft).
- **Version-binding UI:** send-eligible badge only for approved+hash-matching version.
- **Gate verdict rendered:** compose → POST /outreach-data → send_eligible ("Send-eligible record created" + id + no-email note) | blocked ("Outreach blocked" + reason).
- SSR-hydrated (server fetches via apiBase internal; NO client page-route fetch — wave-8/9); mutations via /outreach-data + /outreach-templates-data proxies (NOT page routes); apiFetch rid; read-passthrough.
- compliance-queue: pending-version grant/reject (compliance role) + SoD.
- assertRole; nav⊆RBAC.
## Verify: FULL pnpm -r test green (shared 458 + api 593 + web 431); typecheck clean; biome 0 net-new; build (3 routes compile).
## Note: 2 nextjs spawns (first session-limited mid-run; orchestrator diagnosed 9 failing tests + AC-STRIP-in-comments; second reconciled impl-vs-test [aria-label override, dup badge, Next15 page-export] + FULL verify).
```yaml
skipped: false
specialists_spawned: [nextjs-developer, nextjs-developer]
commit: 0eb1028
ac_strip_honored: true
ssr_hydrated: true
full_repo_test_green: true
