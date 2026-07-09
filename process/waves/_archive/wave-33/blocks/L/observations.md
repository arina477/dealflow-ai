# Wave 33 — L-block observations (reality-checked, systemic)

Source of truth: `process/waves/wave-33/stages/B-2-provision.md`.
Vetted by `knowledge-synthesizer` (retro/distill) + `karen` (reality-check). Each observation traces a symptom to a **systemic gap** (missing verification layer / missing safeguard), never to human error. Wave-specific until a second wave confirms, per each `*-PRINCIPLES.md` "Contract for new rules" authoring discipline.

---

## OBS-1 (STRONGEST — promotion-candidate, HELD) — Mocked adapter tests cannot certify an external request contract

**Symptom.** First live sync of the Twenty sourcing connection ingested 0 companies. The adapter had shipped `depth=2` since its authoring; the live self-hosted Twenty v2.19 rejects `depth=2` with HTTP 400 ("Allowed values are 0, 1"). All 18 mocked adapter unit tests passed against the broken adapter; the deploy was green; the product silently delivered nothing.

**Systemic gap (not human error).** The failure is on the **request contract** — an outbound query-param value the server validates and rejects before any response body exists. Every test in the spec stubs `fetch` (`vi.stubGlobal('fetch', ...)`, spec header line 4: "NO live Twenty HTTP"); the mock is the server, and the mock accepts any outbound request. The suite even asserts `depth=1` is *present in the URL string* but never that the real server *accepts* it. No amount of improving the mocks closes this: the mock cannot self-certify a contract only the live service enforces. The live-verify against the actual running instance caught it in one request; the `depth=2→1` fix (commit 6f6b126, 1048 tests pass) re-synced to **9** real companies — the counterfactual proof (0→9 on one param value, same code path).

**Distinctness (decisive).** NOT a near-duplicate of BUILD rule 5 ("Author every client parse of an API response against that endpoint's real return shape") — rule 5 is response/parse-side (the client misreads the return body); this is request/contract-side (the server rejects the outbound param before any body exists). Rule 5's sensor is structurally blind here: there is no return shape to match because the request never succeeded. Also distinct from VERIFY rule 1 (DB serialization) and rule 3 (compliance-invariant mocking). Confirmed independently by both `knowledge-synthesizer` and `karen`.

**Impact.** High — silent 0-ingest in production with 18 green tests and a green deploy. Everything reports healthy; the product delivers nothing. The worst failure class.

**Recurrence status — SINGLE-WAVE CONFIRMATION (held).** The *shared blind-spot pattern* now spans two adapters: `twenty.adapter.spec.ts` line 5 notes it "Mirrors affinity.adapter.spec.ts structure from wave-30" — both are all-mocked-fetch with the identical structural gap. But only the Twenty adapter has been **live-verified and manifested the failure**; the Affinity adapter's blind spot is latent, not a confirmed observation. The Contract's promotion path (both files, line 64) requires the *observation* to appear across 2+ waves. That is a confirmed failure across waves, not a latent shared pattern. → HELD to observations until a second external-API adapter live-verify confirms.

**Pre-loaded second site.** The next wave that live-verifies ANY external-API adapter (Affinity is the standing candidate — same mocked-fetch structure) and either confirms or would have caught a request-contract mismatch = second-wave confirmation. On that confirmation, promote the drafted rule below to VERIFY-PRINCIPLES.md as rule 4 (head-verifier approval still required).

**Drafted rule (Contract-format, HELD — do not append until 2nd-wave confirmation):**
```
4. Test every external-API adapter against a live or recorded instance of that service, not only mocked-fetch unit tests.
   Why: A mock accepts any outbound request, so a server-rejected param passes every mock yet ingests zero live.
```
(rule 117 chars ≤120; why 98 chars ≤100; no wave refs, no war stories, no em-dash, no we/our/the-team — pre-verified.)

---

## OBS-2 — Deploy docs authored from memory hallucinate vendor image names/paths; a silent zero-log deploy failure results

**Symptom.** The prior deploy doc specified container images `twentyhq/twenty-server` / `twentyhq/twenty` — neither exists on Docker Hub. The real image is `twentycrm/twenty` (org `twentycrm`), per the vendor's canonical `docker-compose.yml`. Railway deployed the bad reference and produced **no logs** (no container ever started), so it masqueraded as a generic cascade rather than an image-pull 404.

**Systemic gap.** No verification step required the deploy-doc author to cross-reference the image name against the actual registry / the vendor's canonical compose before committing the doc. The doc was treated as a primary source rather than a derivative that must be validated against vendor ground truth — the vendor compose should have been the *authoring input*, not the recovery step. The committed wave-32 package (docker-compose.yml + twenty-selfhost.md) was corrected in-wave so the durable deliverable is now accurate.

**Recurrence status — single-wave. Held.** Not promotion-eligible yet. Adjacent to BUILD rule 5 in spirit (validate against real ground truth) but an infra-artifact authoring failure, not a client-parse failure.

---

## OBS-3 — Root-owned Railway volume causes EACCES for a non-root container; fix is `RAILWAY_RUN_UID=0`, not chown

**Symptom.** After switching Twenty storage S3→local, the worker hit `EACCES: permission denied, mkdir '/app/.local-storage/...'` at LocalDriver.writeFile. The Railway-attached volume mounts root-owned; Twenty's container runs non-root.

**Systemic gap.** No pre-deploy check validated UID/GID alignment between the container runtime user and the Railway volume mount ownership. The S3 path masks it entirely — it only surfaces on a local-storage fallback (which is exactly the path the founder's signup crash forced onto). Single-wave; infra-provisioning gap. Held.

---

## Cross-wave note (system health)

The strongest lesson (OBS-1) and the two deploy findings (OBS-2/3) all share one meta-pattern: **green-in-isolation is not green-against-reality.** Mocked tests, memory-authored docs, and S3-masked storage all reported healthy and all failed against the live system. This wave's live-verify discipline (real headless-browser signup; real REST sync; real DB companies-table proof — not trusting green deploys) is what surfaced every one. That discipline is the durable asset; OBS-1 is its first formal candidate for codification.
