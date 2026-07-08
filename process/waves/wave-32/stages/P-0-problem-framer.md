verdict: REFRAME
verdict_source: problem-framer
matched_antipatterns: [3]
reasoning: |
  Symptom-vs-cause: clean — the wave targets the CAUSE (own the data store on our infra to
  unblock the key-gated loop), not a symptom. The three load-bearing cruxes were researched
  against Twenty's official self-host docs + server source:
  (1) DEPLOY FEASIBILITY — feasible (official Railway templates exist), but the task's framing
  under-states the lift: Twenty self-host is a 4-service stack (server + worker from the SAME
  twentycrm/twenty image, managed postgres:16, managed Redis) AND requires S3-compatible object
  storage because server and worker are separate Railway containers that cannot share the local
  file volume Twenty defaults to. A pgvector caveat (per-workspace metadata migration attempts
  the vector extension; Railway managed Postgres lacks it) may or may not be fatal depending on
  whether AI/vector features engage. None of S3-storage / pgvector appears in the P-block framing.
  (2) API-KEY AUTO-PROVISIONING — feasible but NOT officially documented: no env-var admin token,
  no supported one-shot CLI. The only headless path is a 4-5 call GraphQL mutation chain
  (signUp -> signUpInNewWorkspace -> createOneApiKey -> generateApiKeyToken), which works because
  captcha is off by default (CAPTCHA_DRIVER unset) and first-workspace creation is unrestricted on
  a fresh instance. An undocumented `GenerateApiKeyCommand` (yarn command:prod) also exists but has
  no published usage. This is the load-bearing claim behind "unblocks the loop, no founder key" and
  it currently rests on undocumented behavior — must be de-risked with a spike BEFORE the deploy is
  committed, not discovered at C-2.
  (3) ADAPTER REUSE — REAL, not assumed. Self-hosted Twenty exposes the identical REST surface
  (GET /rest/companies, Bearer auth, /rest/ prefix, cursor pageInfo); the wave-31 twenty.adapter.ts
  reads purely from TWENTY_BASE_URL + TWENTY_API_KEY with an https-only SSRF guard and needs no
  change to point at the self-hosted instance. SDK doc already documents both cloud and self-hosted
  use the same token type + endpoints.
  The REFRAME trigger is antipattern #3 (demo-path tunnel vision) plus a hidden happy-path gap: a
  FRESH Twenty instance is EMPTY — no demo companies. "Live-verify real companies flow into the
  sourcing search" has nothing to verify unless the wave explicitly seeds companies (via the
  post-provision GraphQL/API write path or the dev-only seed command) as a defined step. As framed,
  the verify criterion is unsatisfiable on a clean deploy.
proposed_reframe: |
  Keep the wave's intent (self-host Twenty on Railway, auto-provision key, activate the reused READ
  adapter, live-verify) but make three framing corrections BEFORE P-1 sizing:

  A. DEPLOY SCOPE is bigger than "multiple services / Docker." The real stack = 4 services
     (server + worker from one image, managed Postgres 16, managed Redis) PLUS S3-compatible object
     storage (server/worker cannot share Railway's ephemeral local volume). Author
     command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md capturing: the docker-compose service
     topology, STORAGE_TYPE=s3 requirement, the pgvector caveat (confirm whether it is fatal or
     disable-able), APP_SECRET shared across server+worker, and MESSAGE_QUEUE_TYPE=pg-boss to avoid
     Railway ioredis IPv6 issues. Prefer starting from the existing official Railway Twenty template
     rather than hand-authoring compose.

  B. API-KEY AUTO-PROVISIONING must be de-risked FIRST as a bounded spike, because the whole
     "no founder key" claim depends on undocumented behavior. Spike goal: on a throwaway fresh
     instance, prove the headless GraphQL chain (signUp -> signUpInNewWorkspace -> create API key ->
     generateApiKeyToken) yields a working Bearer token with captcha unset, and record the exact
     mutation sequence in twenty-selfhost.md. If the spike fails (captcha forced, workspace-creation
     guard, mutation shape drift), the "unblocks the loop with zero console steps" claim is false and
     the wave needs a different mechanism (or a one-time founder console step) — surface that outcome
     rather than discovering it at deploy time.

  C. ADD AN EXPLICIT SEED STEP to the acceptance criteria: a fresh Twenty is empty, so the wave must
     write a handful of known company/contact records into the provisioned workspace (via Twenty's
     API POST after key provisioning) so that "real companies flow into sourcing search" has
     observable data to verify. Without this, live-verify is unsatisfiable.

  Unchanged and correct: the read-first / write-later split (DealFlow-creates-in-Twenty write path +
  screen migration deferred to later waves) is a coherent, valuable standalone slice — read
  activation + live-verify against seeded data is a real end-to-end proof, not a half-slice, since
  the sourcing search is the consumer that lights up. Adapter reuse is real (no change needed).
  Secret hygiene as framed is correct and non-negotiable: the instance DB creds, APP_SECRET, and the
  provisioned API key are all env-generated (openssl/crypto) + Railway-stored, never committed;
  TWENTY_BASE_URL points at the self-hosted https instance. design_gap_flag: false confirmed —
  infra + existing sourcing UI, D-skip stands.

  Antipattern watch for B/C-blocks (flag, do not gate here): NO debug-by-deploy on the provisioning
  spike (root-cause the GraphQL chain locally against a throwaway instance, not by pushing to prod);
  persistence/backup story for the self-hosted Postgres is a LATER concern, not this wave. Sizing
  (whether deploy + spike + read-activate + seed + verify is one wave or the deploy/spike is its own
  slice) is P-1's call — this reframe only ensures P-1 sizes against the TRUE lift (4 services + S3 +
  undocumented-key spike + seed), not the understated one.
sibling_visible: false
