# Monitor Template — Railway Deploy

Copy into your `MONITOR:` task's `description` MONITOR YAML carve-out per [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md) § tasks. Spawn via the `MONITOR — upsert (railway)` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md). Adjust `$RAILWAY_SERVICE_ID` to your project's service id.

READ `claudomat-brain/monitors/monitor-principles.md` first — this template is a pre-filled instance of the three-condition contract.

**Railway is GraphQL-only — never the Railway CLI.** The brain talks to Railway exclusively over its GraphQL API at `https://backboard.railway.com/graphql/v2`. There is no `railway` CLI installed and the brain must not rely on one.

## Project-scoped token — `Project-Access-Token` header, never `me { … }`

The brain's Railway credential is a **project-scoped token** in env var `RAILWAY_TOKEN`; its project id is in `RAILWAY_PROJECT_ID` (also self-discoverable via the `{ projectToken { projectId environmentId } }` query). Authenticate every GraphQL request with the **`Project-Access-Token: <token>` header — NOT `Authorization: Bearer`**:

```bash
# Self-discover project + environment id from the token itself (no me{} query — project
# tokens get "Not Authorized" on me{}).
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ projectToken { projectId environmentId } }"}'
```

**Never use `me { … }`** — a project-scoped token gets `Not Authorized` on it. Use `project(id:)`, `{ projectToken { … } }`, and project-scoped mutations only.

**Verify with a deploy-scoped query.** Run a project-scoped query that exercises the deploy surface and treat the credential as usable when it returns without a GraphQL `errors` payload:

```bash
# Deploy-scoped probe — succeeds on a valid project token. Success criterion = HTTP 200 with
# a `data.project` object and no `errors` array (the token reached the project's deploy API).
# Do NOT require any deployments to exist — a service with no deployment yet (a valid
# just-pasted token) still means the token is usable; requiring deployments would wrongly
# read that as "no access".
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query(\$id:String!){ project(id:\$id){ id services { edges { node { id name } } } } }\",\"variables\":{\"id\":\"$RAILWAY_PROJECT_ID\"}}" \
  | jq -e '.data.project != null and (.errors | not)'   # exit 0 ⇒ token reached the project's deploy API
# Before any project exists, presence of the token in the environment is the signal:
#   [ -n "$RAILWAY_TOKEN" ]
```

Only when **no** Railway token is in the environment at all should the brain treat the credential as absent (and route to C-2 Action 0's bring-your-own founder-ask pause). This same rule governs C-2 Action 0's credential probe.

**Env-var presence is provisional, not proof of validity.** Before any project/service exists, an exported `RAILWAY_TOKEN` is only an "attempt" signal — the token may be stale, expired, or revoked. If the **first real deploy-scoped GraphQL call** during provisioning then returns an **auth / unauthorized** `errors` payload (as distinct from a "no project / service yet" empty result), treat it as **credential-absent** and route back to C-2 Action 0's founder-ask pause so the founder can mint a fresh token — do NOT report it as a hard deploy failure.

## Conditions

The deploy-state query reads the latest deployment for one service via GraphQL. It takes the
project id (`$RAILWAY_PROJECT_ID`) and the service id (`$RAILWAY_SERVICE_ID`, discoverable from
the project probe above) and returns the newest deployment's `status` as `.data.deployments.edges[0].node.status`.

```yaml
platform: railway
# Shared GraphQL query string used by both conditions (latest deployment for the service).
# Sorted newest-first by Railway, so edges[0] is the latest deployment.
deploy_state_query: |
  query($pid:String!,$sid:String!){
    deployments(first:1, input:{ projectId:$pid, serviceId:$sid }){
      edges { node { id status staticUrl } }
    }
  }
success_condition: |
  curl -sS https://backboard.railway.com/graphql/v2 \
    -H "Project-Access-Token: $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query(\$pid:String!,\$sid:String!){ deployments(first:1, input:{ projectId:\$pid, serviceId:\$sid }){ edges { node { status } } } }\",\"variables\":{\"pid\":\"$RAILWAY_PROJECT_ID\",\"sid\":\"$RAILWAY_SERVICE_ID\"}}" \
    | jq -e '.data.deployments.edges[0].node.status == "SUCCESS"'

failure_condition: |
  curl -sS https://backboard.railway.com/graphql/v2 \
    -H "Project-Access-Token: $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query(\$pid:String!,\$sid:String!){ deployments(first:1, input:{ projectId:\$pid, serviceId:\$sid }){ edges { node { status } } } }\",\"variables\":{\"pid\":\"$RAILWAY_PROJECT_ID\",\"sid\":\"$RAILWAY_SERVICE_ID\"}}" \
    | jq -e '.data.deployments.edges[0].node.status | IN("FAILED", "CRASHED", "REMOVED", "SKIPPED")'

timeout_budget: 900   # 15 minutes. Typical Railway deploy is 2-5 min; pad for queue time.
poll_delay: 45        # seconds between polls
```

## Railway deployment states

Reference: the latest deployment is `.data.deployments.edges[0].node` of the `deployments` GraphQL query above. Known states for that node's `status`:

| State | Terminal? | Classify as |
|---|---|---|
| `QUEUED` | no | pending |
| `INITIALIZING` | no | pending |
| `BUILDING` | no | pending |
| `DEPLOYING` | no | pending |
| `SUCCESS` | yes | success |
| `FAILED` | yes | failure |
| `CRASHED` | yes | failure |
| `REMOVED` | yes | failure (deploy was removed before completion) |
| `SKIPPED` | yes | failure (Railway deprioritized the build — code did NOT ship) |

**SKIPPED is a failure, not a success.** Railway did not deploy this commit even though CI passed. Treating SKIPPED as success is how "green CI, but no deploy" incidents happen.

Verify this list against actual `deployments` GraphQL output before relying on it — Railway occasionally adds or renames states.

## On failure — triage task contents

When the monitor marks FAILURE, the created triage task MUST include:

- Last 100 lines of the deployment build/runtime logs, fetched via the GraphQL `deploymentLogs(deploymentId: <id>, limit: 100)` query (`Project-Access-Token` header)
- The commit SHA that was deployed (`git rev-parse HEAD` at the time of MONITOR creation)
- Link to the Railway dashboard for the failed deployment (construct from project + service + deployment ID)
- The exact `status` value observed (from the `deployments` GraphQL query — FAILED / CRASHED / REMOVED / SKIPPED, the triage route differs)

## Common Railway failure modes (for triage context)

- `FAILED` during BUILDING → usually missing build-time env var or dependency resolution error. Check the deployment's `deploymentLogs` build section.
- `CRASHED` post-deploy → app started but died. Usually runtime env var, missing secret, or port binding issue. Check the deployment's `deploymentLogs` runtime section.
- `SKIPPED` → Railway saw a newer commit mid-queue and skipped this one. Not necessarily a code failure — may resolve by re-triggering from main.
- `REMOVED` → deployment was manually deleted from dashboard or via API. Almost always human action; check audit log.
