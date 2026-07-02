# SDK Registry

Project-local index of every external SDK / third-party service / managed API integrated into this codebase. Maintained by `claudomat-brain/rules/external-sdk-integration-rules.md`.

Each row points at the SDK doc at `command-center/dev/SDK-Docs/<Name>/<name>.md` (rendered via the SDK-doc template at research-process Step 3).

---

## Registry

| SDK | SDK Doc | Official Docs | Version | Last verified |
|-----|---------|---------------|---------|---------------|
| _(empty — populated by research-process Step 3 as SDKs are integrated)_ | _ | _ | _ | _ |

---

## When to update

- **Adding a new SDK** → research process creates SDK doc + adds row here.
- **Upgrading an SDK version** → re-research, rewrite "Official API Surface" + "Platform Compatibility", append to "Integration-Specific Findings", update registry row + "Last verified".
- **Wave shipped that hit a new gotcha** → append to that SDK doc's "Integration-Specific Findings" only. Registry row unchanged.
- **SDK process itself changes** → update `claudomat-brain/rules/external-sdk-integration-rules.md`, NOT this file.

---

## Schema

| Column | Format | Notes |
|---|---|---|
| `SDK` | Free text — display name | E.g., `supertokens-node`, `Stripe`, `Phosphor Icons` |
| `SDK Doc` | Markdown link | Format: `\`command-center/dev/SDK-Docs/<Name>/<name>.md\`` |
| `Official Docs` | Markdown link to live URL | Version-specific landing page |
| `Version` | Semver / CLI version / "MCP" | The exact installed version this doc was verified against |
| `Last verified` | YYYY-MM-DD | Date the research process last ran for this SDK |
