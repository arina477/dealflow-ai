# Stack Decisions

## Selected: claudomat baseline (applied 2026-06-29)

**Monorepo:** Turborepo + pnpm
**Backend:** NestJS (Node.js + TypeScript strict)
**Frontend:** Next.js 15 (App Router, React 19) + Tailwind + shadcn/ui
**Shared contracts:** Zod schemas in `@dealflow/shared`, bridged to NestJS DTOs via `@anatine/zod-nestjs`
**Database:** PostgreSQL (Railway-managed) + Drizzle ORM
**Realtime:** Socket.IO namespaces — only if a feature requires it (e.g. live outreach-status / pipeline updates); evaluate at v6, do not scaffold up front
**Auth:** SuperTokens (self-hosted on Railway — Core + Postgres; JWT + refresh tokens over Railway private network). RBAC for the 4 roles (advisor / analyst / compliance / admin)
**Payments:** Stripe — **deferred** (no payments in MVP; monetization via future licensing is H3). Add when needed
**Storage:** Railway Buckets (S3-compatible) — documents, recordkeeping export packages, attachments
**Hosting:** Railway — **bring-your-own** (founder's own Railway account; credential collected at deploy time per C-2 Action 0, not now)
**CI/CD:** GitHub Actions (lint + typecheck + test + build; parallel jobs; `timeout-minutes` + least-privilege `permissions`)
**Lint/format:** Biome
**Testing:** Vitest + Supertest + React Testing Library + Playwright MCP (live E2E swarm)
**Secrets:** platform env vars only — never committed

### Project-specific additions to plan in v6 architecture (driven by the product, not the generic baseline)
- **Transactional email + event tracking provider** (e.g. Resend or equivalent with webhooks for opens/clicks/replies/bounces) — REQUIRED: compliant outreach is a core MVP feature, not "user-facing email" in the baseline-optional sense. Provider + DKIM/SPF/DMARC sending-identity decided in the v6 SDK/Services branch.
- **Tamper-evident audit-log store** — append-only design with integrity hashing (hash-chain) for the compliance wedge. Architecture detail decided in v6 (DB branch + Security branch); Postgres-backed append-only table is the likely baseline-fit.
- **AI/LLM provider** — latest Claude models for buyer-seller match rationale + AI-assisted outreach drafting. Decided in v6 SDK branch.
- **Deal-source data + contact-enrichment providers** — external data APIs for sourcing/enrichment. Selected in v6 SDK branch + per `external-sdk-integration-rules.md`.
- **Background jobs** — sourcing/sync, enrichment queue, outreach send queue, email-event webhook processor, audit-integrity verification. Queue tech (likely Redis-backed) evaluated at v6 when load is understood.

## Rationale
Applied as the default technical stack — no founder stack preference or constraint surfaced in v0 docs, the vision, or any request. The product is a standard data-heavy TypeScript/React web application (dashboards, tables, forms, role-gated workflow), which the baseline fits directly. v6 architecture branches assume these choices. The founder can switch any piece later by saying so.
