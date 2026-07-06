/**
 * AnalyticsController — GET /analytics
 *
 * Wave-18 (tasks a5ba8068 / 9e05828b).
 *
 * ── RBAC ─────────────────────────────────────────────────────────────────────
 * advisor + admin: both may view workspace-scoped analytics.
 *   advisor — primary persona; sees own firm's mandate/outreach/pipeline/match data.
 *   admin   — firm administrator; sees the same firm-wide summary.
 * analyst excluded: advisory analytics (mandate throughput, deal pipeline, match
 *   disposition) are advisor/admin-facing. Analyst accesses raw sourcing data.
 *
 * Unauthenticated → 401 (SessionGuard).
 * Wrong role (analyst, compliance) → 403 (RolesGuard fail-closed).
 *
 * FAIL-CLOSED at boot: rolesForRoute('/analytics') is resolved at module load;
 * if it returns [] (RBAC config drift), the module throws rather than silently
 * opening the route (mirrors AdminActivityController + AdminUsersController pattern).
 *
 * ── Security invariants ──────────────────────────────────────────────────────
 * 1. GET only — no mutating method on this controller.
 * 2. READ-ONLY: getActivity() appends ZERO audit rows.
 * 3. Workspace-scoped: AnalyticsService → AnalyticsRepository → getDb() →
 *    FORCE RLS → own-firm-only (post-M8 isolation load-bearing invariant).
 */

import type { AnalyticsSummary, Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AnalyticsService } from './analytics.service';

const ANALYTICS_ROLES: Role[] = [...rolesForRoute('/analytics')];

if (ANALYTICS_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/analytics') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot rather than expose /analytics.'
  );
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics
   *
   * Returns a workspace-scoped AnalyticsSummary covering the 4 metric families:
   *   F1 — mandate throughput (draft / active counts)
   *   F2 — outreach compliance-gate outcomes (gatePassRate / blockedRate)
   *   F3 — advisor productivity (per-actor mandate + pipeline activity)
   *   F4 — match disposition (pending / accepted / rejected / flagged)
   *
   * Response: AnalyticsSummary (200) | 401 (anon) | 403 (wrong role).
   * Empty workspace → valid 200 with all-zero counts (empty-state safe).
   * Read-only: no side effects.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ANALYTICS_ROLES)
  async getSummary(): Promise<AnalyticsSummary> {
    return this.analyticsService.getSummary();
  }
}
