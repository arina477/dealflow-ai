# Wave 36 — admin read-only oversight VERIFIED (deployed)
Founder-approved. rbac.ts: added admin to READ routes (/sourcing/companies + :id, /sourcing/connections list, /pipeline + :id + events + notes-read, /matches). NO mutating route changed; M6 sender≠approver SoD UNTOUCHED. Web nav/pages updated for admin visibility. Tests aligned (shared 509, api 1053 pass). Deployed 5832382 (api+web).
VERIFIED deployed: admin GET /sourcing/companies → company list; admin GET /pipeline → 200; admin PATCH /pipeline/:id/stage (write) → 403 (denied). Read-only oversight works.
