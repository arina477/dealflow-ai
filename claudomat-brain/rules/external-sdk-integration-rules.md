# External SDKs & Tools — Rules

Pre-build research process + SDK-doc template for waves that integrate, upgrade, or significantly interact with an external SDK / third-party service / managed API. Project's SDK docs live at `command-center/dev/SDK-Docs/<Name>/<name>.md`; the registry lives at `command-center/dev/SDK-Docs/registry.md`.

---

## When this rule fires

| Stage | Trigger | Action |
|---|---|---|
| **P-3 Plan (approach phase)** | Approach declares a new SDK, an SDK upgrade, or non-trivial change to an existing SDK integration | Run the research process (below) before P-3 plan locks in the dep list |
| **P-2 Spec / N-2 Seed** | Any `tasks` row author / seed that names a known SDK | Auto-link `SDK Reference: command-center/dev/SDK-Docs/<Name>/<name>.md` into the task's `description` (prose section) |
| **B-0 Branch** | Approach added a new dep | Install dep + verify version matches the SDK doc's "Installed version" field |
| **B-3 Backend / B-4 Frontend** | Implementer is using the SDK | Read the SDK doc as the authoritative reference (NOT random blog posts / Stack Overflow) |
| **L-1 Docs** | Wave shipped that touched an SDK | Add an "Integration-Specific Findings" section to the SDK doc capturing platform quirks, adapter patterns, env-var gotchas, bugs hit + fixes |

Orchestrator at P-3 entry scans the approach deliverable for SDK / tool names. If a name matches an entry in `command-center/dev/SDK-Docs/registry.md` AND the doc's "Last verified" date is within the project's freshness window AND the installed version matches → skip research, jump to auto-link. Otherwise run the full process.

---

## Research process (5 steps)

1. **Check the SDK registry.** Open `command-center/dev/SDK-Docs/registry.md`. If `<SDK-Name>` exists with a recent "Last verified" date and the matching installed version → skip to Step 4. Otherwise continue.

2. **Spawn `research-analyst`** to read the SDK's official docs + GitHub repository (README, CHANGELOG, issues filtered by the project's stack tags) + migration guides for the target version + platform-specific gotchas. External research from the SDK author's world only — never blog posts, Stack Overflow, or AI-generated summaries.

   **Literal-boundary audit (mandatory before research closes).** Fill every row of the SDK doc's "Runtime literals" table — env var names (with legacy aliases), cookie names, prefixes, headers, claims, default paths, error codes, log formats, version-negotiation strings. A spec or implementation that hardcodes any of these wrong = silent prod failure. Cite SDK source-of-truth per row (docs URL + section, or source file + line). Cross-check the SDK's CHANGELOG for renames between major versions (env-var aliases, cookie-name changes, claim renames are common on major bumps). Research is not complete until every row has either a citation or an explicit "N/A — verified SDK does not own this category."

3. **Write the SDK doc** to `command-center/dev/SDK-Docs/<SDK-Name>/<sdk-name>.md` using the template in § "SDK doc template". Update `command-center/dev/SDK-Docs/registry.md` with the new row.

4. **Link to the task.** Add `SDK Reference: command-center/dev/SDK-Docs/<SDK-Name>/<sdk-name>.md` to the task's `description` (prose section). Implementers read it at B-3 / B-4.


5. **Enrich after implementation (L-1 Docs).** Append to "Integration-Specific Findings" with platform quirks, adapter patterns, env-var gotchas, what differed from official docs, bugs hit + fixes. Findings compound across waves.

---

## Auto-linking

When INSERTing ANY row into `tasks` at P-2 Spec or N-2 Seed, scan the task description for SDK / tool names. If a matching `command-center/dev/SDK-Docs/<Name>/` directory exists, attach the SDK reference to the task's `description` (prose section) automatically.

---

## SDK doc template

Every SDK doc at `command-center/dev/SDK-Docs/<Name>/<name>.md` must follow this structure:

```markdown
# <SDK Name> Reference

**Last verified:** YYYY-MM-DD
**Official docs:** <URL to official documentation for the installed version>
**GitHub:** <URL to SDK repository>
**Installed version:** X.Y.Z
**Install location:** <package or workspace path>

---

## Official API Surface
(from external research — what the SDK provides)

### Public classes / functions
### Constructor options
### Methods with signatures
### Runtime literals (strings the SDK owns at runtime, not the project)

Values the SDK emits or reads at runtime. Hardcoding any of these wrong in spec or implementation = silent 100% prod failure. Verify each category against SDK source-of-truth (docs URL + section, or source file + line). Mark "N/A — verified SDK does not own this category" explicitly if absent — do not omit rows; "N/A" documents the audit happened.

| Category | What to capture | Example |
|---|---|---|
| Env var names (+ legacy aliases) | Vars the SDK reads, deprecated names + version they changed | `AUTH_SECRET` (v5), legacy `JWT_SECRET` (v4) |
| Cookie names | Names the SDK emits; dev vs prod naming differences | `authjs.session-token` (v5) was `next-auth.session-token` (v4) |
| Cookie prefixes | Auto-applied prefixes under conditions | `__Secure-` prepended in HTTPS, `__Host-` if path=/ |
| HTTP headers | Headers set or required at request boundaries | `Authorization: Bearer …`, `X-CSRF-Token` |
| JWT/JWE claims | Claim names the SDK writes or expects | `sub`, `exp`, custom (`iss` enforcement) |
| Default ports / paths / callbacks | Default endpoints, callback URLs, file paths | `/api/auth/callback/[provider]` |
| Error codes / classes | Error names exposed at boundaries that callers match on | `CredentialsSignin`, `OAuthCallbackError` |
| Log line formats | Formats other systems may parse | structured JSON keys (`level`, `msg`, `name`) |
| Version negotiation strings | Strings used in protocol/version handshakes | `User-Agent: stripe-node/X.Y.Z` |

## Platform Compatibility
(verified against this project's deployment targets — list per-platform sections matching the project's `stack.deploy_platform` (and `deploy_targets[].platform`) from `project.yaml`, plus the framework-runtime sections relevant to the project, e.g. server-side runtime, edge runtime, build-time)

## Known Gotchas
(from official docs, GitHub issues, community — NOT our integration)

## Documentation Links
(version-specific links for future reference)
- Getting Started: <URL>
- API Reference: <URL>
- Migration Guide: <URL> (if applicable)
- GitHub Issues: <URL filtered to relevant tags>

---

## Integration-Specific Findings
(added during/after implementation — what WE learned)

### Our adapter patterns
### Env var configuration on our platforms
### Bugs we hit and how we solved them
### What differed from the official docs
```

The "Platform Compatibility" sections are project-tuned: render the per-platform headers from the project's `stack.deploy_platform` + `stack.frontend` + `stack.backend` declared in `project.yaml`. Don't hardcode platform names in this template.

---

## SDK registry (project-side)

The brain does not ship a registry — it's project-specific and grows over the project's lifetime. Project initializes `command-center/dev/SDK-Docs/registry.md` at `claudomat init` with this header schema:

```markdown
# SDK Registry

| SDK | SDK Doc | Official Docs | Version | Last verified |
|-----|---------|---------------|---------|---------------|
```

Rows are added by the research process (Step 3). When updating an SDK to a new version, update the registry row and re-run research for the new version's docs.

---

## When to update SDK docs

- Adding a new SDK → create SDK doc + add row to registry
- Upgrading an SDK version → re-research, rewrite "Official API Surface" + "Platform Compatibility", append to "Integration-Specific Findings", update registry row + "Last verified"
- Wave shipped that hit a new gotcha → append to "Integration-Specific Findings" only (no re-research)
- SDK changes researcher process itself → update this brain rule, not the project's docs
