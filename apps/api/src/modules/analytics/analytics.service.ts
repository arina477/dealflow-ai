/**
 * AnalyticsService — orchestrates the 4 metric-family aggregations.
 *
 * Wave-18 (task a5ba8068).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * All database access flows through AnalyticsRepository methods, each of which
 * uses getDb(this.db) → ALS request-handle → GUC-set dedicated pg Client →
 * FORCE RLS → per-firm data. This service itself holds no Drizzle handle and
 * issues no direct DB calls, so the isolation invariant is enforced structurally
 * at the repository layer.
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This service has ZERO writes. No audit row is appended for analytics reads
 * (parallel to the admin-activity read pattern in wave-16).
 */

import type { AnalyticsSummary } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AnalyticsRepository } from './analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * getSummary — returns the 4-family AnalyticsSummary for the request workspace.
   *
   * All four families run concurrently via Promise.all for latency efficiency.
   * Each is workspace-scoped at the repository layer (getDb → FORCE RLS).
   *
   * Empty-state safe: all families return zero-counts for an empty workspace.
   * Read-only: appends ZERO audit rows.
   */
  async getSummary(): Promise<AnalyticsSummary> {
    const [mandateThroughput, outreachGateOutcomes, advisorProductivityRows, matchDisposition] =
      await Promise.all([
        this.analyticsRepository.getMandateThroughput(),
        this.analyticsRepository.getOutreachGateOutcomes(),
        this.analyticsRepository.getAdvisorProductivity(),
        this.analyticsRepository.getMatchDisposition(),
      ]);

    return {
      mandateThroughput,
      outreachGateOutcomes,
      advisorProductivity: {
        rows: advisorProductivityRows,
        total: advisorProductivityRows.length,
      },
      matchDisposition,
    };
  }
}
