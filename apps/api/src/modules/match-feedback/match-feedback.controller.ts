/**
 * MatchFeedbackController — GET /match-feedback
 *
 * Wave-19 (tasks 69387b56 / e206a56a).
 *
 * ── RBAC ─────────────────────────────────────────────────────────────────────
 * advisor + admin: both may view workspace-scoped match calibration.
 *   advisor — primary persona; calibration over own firm's match decisions.
 *   admin   — firm administrator; same firm-wide calibration view.
 * analyst excluded: calibration is advisory-analytics; analyst accesses raw sourcing.
 *
 * Unauthenticated → 401 (SessionGuard).
 * Wrong role (analyst, compliance) → 403 (RolesGuard fail-closed).
 *
 * FAIL-CLOSED at boot: rolesForRoute('/match-feedback') is resolved at module
 * load; if it returns [] (RBAC config drift), the module throws rather than
 * silently opening the route (mirrors AnalyticsController pattern).
 *
 * ── Security invariants ──────────────────────────────────────────────────────
 * 1. GET only — no mutating method on this controller.
 * 2. READ-ONLY: getCalibration() appends ZERO audit rows. No LLM/ML.
 * 3. Workspace-scoped: MatchFeedbackService → MatchFeedbackRepository →
 *    getDb() → FORCE RLS → own-firm-only (M8 isolation load-bearing invariant).
 */

import type { CalibrationSummary, Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { MatchFeedbackService } from './match-feedback.service';

const MATCH_FEEDBACK_ROLES: Role[] = [...rolesForRoute('/match-feedback')];

if (MATCH_FEEDBACK_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/match-feedback') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot rather than expose /match-feedback.'
  );
}

@Controller('match-feedback')
export class MatchFeedbackController {
  constructor(private readonly matchFeedbackService: MatchFeedbackService) {}

  /**
   * GET /match-feedback
   *
   * Returns a workspace-scoped CalibrationSummary covering:
   *   - Overall accept-rate by fit_score band (4 bands: 0-25, 26-50, 51-75, 76-100).
   *   - Per-dimension accept-rate lift (sectorMatch, contactCompleteness, tieBreak).
   *
   * Response: CalibrationSummary (200) | 401 (anon) | 403 (wrong role).
   * Empty workspace / 0 decided → valid 200 with totalDecided=0, all acceptRate=null.
   * Read-only: no side effects. No LLM/ML.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCH_FEEDBACK_ROLES)
  async getCalibration(): Promise<CalibrationSummary> {
    return this.matchFeedbackService.getCalibration();
  }
}
