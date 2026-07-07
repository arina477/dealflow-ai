/**
 * MatchFeedbackService — orchestrates calibration aggregation over match_candidates.
 *
 * Wave-19 (task 5568ad44 / e206a56a).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * All database access flows through MatchFeedbackRepository methods, each of which
 * uses getDb(this.db) → ALS request-handle → GUC-set dedicated pg Client →
 * FORCE RLS → per-firm data. This service itself holds no Drizzle handle and
 * issues no direct DB calls, so the isolation invariant is enforced structurally
 * at the repository layer.
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This service has ZERO writes. No scorer-retrain. No LLM/ML import.
 * NO Anthropic/Claude/BullMQ import or call anywhere in this module.
 */

import type { CalibrationSummary } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { MatchFeedbackRepository } from './match-feedback.repository';

@Injectable()
export class MatchFeedbackService {
  constructor(private readonly matchFeedbackRepository: MatchFeedbackRepository) {}

  /**
   * getCalibration — returns the CalibrationSummary for the request workspace.
   *
   * Runs band calibration + dimension lift concurrently via Promise.all.
   * Each is workspace-scoped at the repository layer (getDb → FORCE RLS).
   *
   * Empty-state safe: 0 decided candidates → totalDecided=0, all acceptRate=null.
   * Read-only: appends ZERO audit rows. No LLM/ML.
   *
   * G2 null-vs-zero: acceptRate=null when decidedCount=0; 0 when decided>0 but 0 accepted.
   */
  async getCalibration(): Promise<CalibrationSummary> {
    const [bands, dimensionLifts] = await Promise.all([
      this.matchFeedbackRepository.getBandCalibration(),
      this.matchFeedbackRepository.getDimensionLifts(),
    ]);

    const totalDecided = bands.reduce((sum, b) => sum + b.decidedCount, 0);

    return {
      totalDecided,
      bands,
      dimensionLifts,
    };
  }
}
