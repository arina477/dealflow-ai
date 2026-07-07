/**
 * SellerIntentController — GET /seller-intent
 *
 * Wave-23 (task 12947422).
 *
 * ── RBAC ─────────────────────────────────────────────────────────────────────
 * advisor + admin: both may view workspace-scoped seller-intent scores.
 *   advisor — primary persona; views deal heat per mandate (outreach + pipeline + match).
 *   admin   — firm administrator; same workspace-scoped view.
 * analyst/compliance excluded: advisory deal-scoring surface. analyst accesses raw sourcing.
 *
 * Unauthenticated → 401 (SessionGuard).
 * Wrong role (analyst, compliance) → 403 (RolesGuard fail-closed).
 *
 * FAIL-CLOSED at boot: rolesForRoute('/seller-intent') is resolved at module load;
 * if it returns [] (RBAC config drift), the module throws rather than silently
 * opening the route (mirrors AnalyticsController + MatchFeedbackController pattern).
 *
 * ── Security invariants ──────────────────────────────────────────────────────
 * 1. GET only — no mutating method on this controller.
 * 2. READ-ONLY: getList() appends ZERO audit rows.
 * 3. Workspace-scoped: SellerIntentService → SellerIntentRepository → getDb() →
 *    FORCE RLS → own-firm-only (M8 isolation load-bearing invariant).
 * 4. PURE scorer: no LLM, no network, no randomness — deterministic result.
 */

import type { Role, SellerIntentListResponse } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SellerIntentService } from './seller-intent.service';

const SELLER_INTENT_ROLES: Role[] = [...rolesForRoute('/seller-intent')];

if (SELLER_INTENT_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/seller-intent') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot rather than expose /seller-intent.'
  );
}

@Controller('seller-intent')
export class SellerIntentController {
  constructor(private readonly sellerIntentService: SellerIntentService) {}

  /**
   * GET /seller-intent
   *
   * Returns a workspace-scoped SellerIntentListResponse: per-mandate scores covering
   * the 3 signals (outreachEngagement, pipelineVelocity, matchDisposition) + direction.
   *
   * Response: SellerIntentListResponse (200) | 401 (anon) | 403 (wrong role).
   * Empty workspace → valid 200 with [] (empty-state safe).
   * Read-only: no side effects, no audit rows, no LLM calls.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...SELLER_INTENT_ROLES)
  async getList(): Promise<SellerIntentListResponse> {
    return this.sellerIntentService.getList();
  }
}
