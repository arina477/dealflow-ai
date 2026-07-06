# Wave 15 — P-0 Frame

## Discover
- wave_db_id: f22747a7-6405-4fd1-9021-fae7da5cdf1c (wave_number 15)
- Prior-work: FIRST M7 wave (M7 Admin & settings promoted at wave-14 N-3 via BOARD 7/7 when M6→blocked on the founder send-credential #141). Reuses M1 auth/RBAC + M2 audit.
- Roadmap milestone: M7 (08d3053a, in_progress, Class=product-feature). wave.milestone_id backfilled.
- Spec-contract short-circuit: **no-prior-spec** → full P-1..P-3.
- Product decisions: buildable-without-credential (BOARD-confirmed #331: the credential-seamed half — DKIM/SPF/DMARC generation, live domain-verify, live connection-test, invite-email send — is DEFERRED, NOT seeded). M6 stays blocked (send credential #141, loudly re-surfaced). LLM-spend deferred.

## Reframe
- Original framing: 4-task M7 admin vertical — seed 82ec8724 (user-management: invite/assign-role/deactivate + race-safe last-admin guard + SoD + audited), sibling 648a86a6 (workspace/firm-profile settings + default-compliance-profile cascade), sibling 41c017f7 (data-source connection admin UI + encrypted-at-rest credential form, NO live test), sibling d7f716b4 (AppShell polish: placeholders for unbuilt role-nav routes + TopBar-title, carry-forward).
- **problem-framer: PROCEED** — on-critical-path admin correctly SEAMED from the #141 block (hard-bounds it out, doesn't patch at the credential layer); coherent single-class admin vertical (not a grab-bag); edge/SoD/RBAC/audit explicitly covered; the AppShell carry-forward is now load-bearing (replaces its own 404s + carries the RBAC-live test). No antipattern.
- **ceo-reviewer: PROCEED (HOLD-SCOPE)** — the 9/10: compliance-first rigor (server-side race-safe last-admin guard + SoD + WORM-audited role/settings/credential mutations) = the wedge's admin-layer expression, NOT generic CRUD; the credential-seamed 9/10-vs-#141 half deferred per #331 (no gold-plating); traces to both live bets + M7 success metric; the RIGHT investment while M6 blocked (prepares the sending-identity surface M6's send plugs into; doesn't compete with unblocking M6). Bundling 4 surfaces right (shared RBAC/SoD/audit spine, additive, 3 thin CRUD + 1 re-parented polish). **The risk is EXECUTION RIGOR → P-4 gate concern.**
- **mvp-thinner: OK (floor-constrained)** — the only deferrable AC is d7f716b4 (AppShell polish) but peeling drops residual to ~2,400-2,500 at/under the 2,500 multi-spec floor AND its RBAC-reverify half is seed-fused (#340) → refuse the peel; the other 3 trace to M7's metric. Coherent vertical.
- **Merge (PROCEED+PROCEED+OK):** no split. Disposition: **PROCEED** with the original 4-task framing.
- **EXECUTION-RIGOR CONSTRAINTS carried for P-2/P-3/P-4/B (ceo-reviewer + the compliance-first posture):**
  1. **RACE-SAFE last-admin guard:** deactivating/demoting the LAST admin must be rejected SERVER-SIDE, atomically (concurrent double-deactivate-last-admin must not leave zero admins — DB-level guard / advisory lock / transactional count-check, not a service-level TOCTOU).
  2. **CREDENTIAL NEVER IN THE AUDIT ROW / LOGS:** the data-source credential form (41c017f7) stores credentials ENCRYPTED-AT-REST; the plaintext credential MUST NOT leak into audit_log_entries, error messages, or logs (audit the ACTION [connection-created/updated] + non-secret metadata only, never the secret).
  3. **SoD + WORM-audit** on every role-change / settings / credential mutation (M2 AuditService.append last-in-txn; actor via M1 getUserWithRole).
- **SECURITY-SCOPE-TIGHTENED expected at P-4** (82ec8724 touches user-creation/invite/role/deactivate — auth-adjacent → the tightened gate ≥2 Phase-2 iterations).
- Final framing: build the M7 admin vertical — user-management (invite/role/deactivate, race-safe last-admin guard, SoD, audited) + workspace/firm settings (compliance-profile cascade) + data-source connection admin (encrypted credential form, credential-never-logged, no live test) + AppShell nav polish (placeholders + TopBar). Reuse M1 RBAC + M2 audit. Buildable-without-credential (#141-seamed paths deferred).
