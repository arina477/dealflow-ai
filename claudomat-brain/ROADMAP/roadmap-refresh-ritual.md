# DEPRECATED — Roadmap Refresh Ritual

Retained through 0.16.x for external link stability. Removed at 0.17.0.

**Active replacements:**

- Strategic milestone authoring + re-evaluation → `claudomat-brain/ROADMAP/roadmap-planning-ritual.md` (produces empty `status='todo'` milestones — no child tasks).
- Per-wave decomposition into one bundle → `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md` (INSERTs ONE bundle per fire: 1 seed + 0-N siblings via `parent_task_id` self-FK under the active milestone; fired by N-1 when active queue has no seed candidate AND scope is not shipped). N-2 picks the bundle as a unit; B-0 claims it; L-2 closes it.

**Migration of trigger reasons:**

| Old reason | New target |
|---|---|
| `milestone-stockout` | `roadmap-planning` ritual, reason `milestone-stockout` |
| `backlog-stockout` | `roadmap-planning` ritual, reason `backlog-stockout` |
| `both` | `roadmap-planning` ritual, reason `both` |

Update consumer references to the new file paths.
