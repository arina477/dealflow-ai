/**
 * matching.scorer.ts — Pure deterministic scoring function for match candidates.
 *
 * HARD BOUNDARY (CRITICAL):
 *   NO Anthropic/Claude/LLM import or call.
 *   NO BullMQ, NO randomness, NO Date.now() in the score.
 *   NO rationale-TEXT field — score_breakdown is structured rule-contributions.
 *   This function is PURE and DETERMINISTIC: identical inputs → identical output.
 *
 * SCORING DIMENSIONS (wave-10):
 *   1. Sector/industry match (PRIMARY weight = 60 points max):
 *      - Exact token match (every token in criterion appears in sector tokens,
 *        or sector tokens appear in criterion tokens — same logic as filterAsActor)
 *        → 60 points.
 *      - Partial match (≥1 token overlaps but not full subset) → 20 points.
 *      - No sector data on company → 0 points.
 *      - No industry criterion defined → 30 points (neutral; criterion missing
 *        is not penalized).
 *   2. Contact completeness (SECONDARY weight = 30 points max):
 *      - ≥1 contact with non-null email → 30 points.
 *      - ≥1 contact but all emails null → 15 points (contacts exist, email gap).
 *      - 0 contacts → 0 points.
 *   3. Deterministic tie-break (10 points max, computed from name + created_at):
 *      - Always ≥0 and ≤10 to break ties without randomness.
 *      - Derived from a stable hash of the company name + candidate's createdAt.
 *      - The tie-break is a single-digit deterministic integer [0..10].
 *
 * UNSUPPORTED DIMENSIONS (graceful degradation):
 *   geo, sizeBand, dealType — M3 companies lack these columns. When a criterion
 *   specifies these, the dimension contributes 0 to the score, and the dimension
 *   name is recorded in breakdown.notApplied with the provenance note
 *   'not applied — M3 lacks column' so the advisor understands the partial scoring.
 *
 * SCORE RANGE:
 *   Minimum: 0 (no sector match + no contacts + tie-break 0)
 *   Maximum: 100 (exact sector match + contacts with email + tie-break 10)
 *
 * DISCRIMINATION PROPERTY:
 *   An exact-sector-match + full-contacts candidate ALWAYS scores clearly higher
 *   than a no-sector-match + no-contacts candidate. The weights ensure this:
 *     best case = 60 + 30 + 10 = 100
 *     worst case = 0 + 0 + 0 = 0
 *     exact-match + full-contacts minimum = 60 + 30 + 0 = 90
 *     no-match + no-contacts maximum = 0 + 0 + 10 = 10
 *   → gap ≥ 80 points between best-sector/full-contacts and worst-sector/no-contacts.
 */

// ---------------------------------------------------------------------------
// Input types (DB row fragments — no Drizzle import; pure types only)
// ---------------------------------------------------------------------------

/**
 * ScorerCandidate — the buyer_universe_candidates row fragment needed for scoring.
 * (id, companyId, createdAt — just what the scorer needs)
 */
export interface ScorerCandidate {
  id: string;
  companyId: string;
  createdAt: string;
}

/**
 * ScorerCompany — the companies row fragment needed for scoring.
 * Only sector is supported for M3 companies (wave-10 graceful degradation).
 */
export interface ScorerCompany {
  id: string;
  name: string;
  sector: string | null;
}

/**
 * ScorerContact — the contacts row fragment needed for contact completeness scoring.
 */
export interface ScorerContact {
  id: string;
  companyId: string;
  email: string | null;
  name: string | null;
  title: string | null;
}

/**
 * ScorerCriteria — the mandate_buyer_criteria row fragment needed for scoring.
 * All fields are nullable — missing criteria = no restriction.
 */
export interface ScorerCriteria {
  industry: string | null;
  geo: string | null;
  sizeBand: string | null;
  dealType: string | null;
}

/**
 * ScoreBreakdown — the structured rule-contribution breakdown.
 * Stored as JSONB in match_candidates.score_breakdown.
 * NOT prose — each field is a number or array of strings.
 */
export interface ScoreBreakdown {
  /** Points from sector/industry token match (0, 20, 30, or 60). */
  sectorMatch: number;
  /** Points from contact completeness (0, 15, or 30). */
  contactCompleteness: number;
  /** Deterministic tie-break points (0..10). */
  tieBreak: number;
  /** Total fit score (sum of above, clamped to [0, 100]). */
  total: number;
  /**
   * Dimensions that were specified in criteria but could not be applied
   * because M3 companies lack those columns. Each entry is a string like
   * 'geo: not applied — M3 lacks column'.
   */
  notApplied: string[];
}

/**
 * ScoreResult — the output of scoreCandidate.
 */
export interface ScoreResult {
  /** Integer fit score in [0, 100]. PURE, NO randomness. */
  score: number;
  /** Structured breakdown of how the score was derived. */
  breakdown: ScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Normalization helpers (no side effects, no IO, pure)
// ---------------------------------------------------------------------------

/**
 * tokenize — split a string into lowercase normalized tokens.
 * Splits on whitespace, commas, slashes, ampersands, plus, hyphen, pipe.
 * Returns an empty array for null/empty input.
 */
function tokenize(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .trim()
    .split(/[\s,/&+|-]+/)
    .filter(Boolean);
}

/**
 * deterministicTieBreak — produces a stable integer [0..10] from a candidate id.
 * Uses a simple deterministic hash on the candidate id string to avoid any
 * Date.now() or Math.random() dependency. The same id always returns the same
 * value. Pure and collision-resistant enough for tie-breaking within a run.
 */
function deterministicTieBreak(candidateId: string): number {
  // Simple deterministic hash: sum of char codes mod 11 (gives [0..10]).
  let hash = 0;
  for (let i = 0; i < candidateId.length; i++) {
    hash = (hash * 31 + (candidateId.codePointAt(i) ?? 0)) >>> 0;
  }
  return hash % 11;
}

// ---------------------------------------------------------------------------
// scoreCandidate — the PURE deterministic scorer
// ---------------------------------------------------------------------------

/**
 * scoreCandidate — computes a deterministic fit score and breakdown for a
 * single buyer universe candidate against the mandate's buyer criteria.
 *
 * PURE: no IO, no LLM, no randomness, no Date.now(). Same inputs → same output.
 * DETERMINISTIC: scores always discriminate (exact-sector-match + full-contacts
 * clearly beats no-sector-match + no-contacts — gap ≥ 80 points).
 *
 * @param candidate  — the buyer_universe_candidates row (id, companyId, createdAt)
 * @param company    — the companies row for this candidate (id, name, sector)
 * @param contacts   — the contacts[] for this candidate's company
 * @param criteria   — the mandate_buyer_criteria row (may be null if no criteria)
 * @returns ScoreResult { score: number [0..100], breakdown: ScoreBreakdown }
 */
export function scoreCandidate(
  candidate: ScorerCandidate,
  company: ScorerCompany,
  contacts: ScorerContact[],
  criteria: ScorerCriteria | null
): ScoreResult {
  const notApplied: string[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Sector / industry match (PRIMARY weight, up to 60 points)
  // ──────────────────────────────────────────────────────────────────────────

  let sectorMatch = 0;

  if (!criteria?.industry) {
    // No industry criterion — neutral score (not penalized, not rewarded).
    sectorMatch = 30;
  } else {
    const criterionTokens = tokenize(criteria.industry);
    const sectorTokens = tokenize(company.sector);

    if (sectorTokens.length === 0) {
      // Company has no sector data → 0 points (cannot match).
      sectorMatch = 0;
    } else {
      // Full token-subset match (same logic as filterAsActor — wave-9 tighter match).
      // Match if criterion tokens are a subset of sector tokens, or sector tokens
      // are a subset of criterion tokens.
      const criterionMatchesSector = criterionTokens.every((t) =>
        sectorTokens.some((s) => s === t)
      );
      const sectorMatchesCriterion = sectorTokens.every((t) =>
        criterionTokens.some((c) => c === t)
      );

      if (criterionMatchesSector || sectorMatchesCriterion) {
        // Exact (full subset) match → 60 points.
        sectorMatch = 60;
      } else {
        // Check partial overlap: at least one token in common.
        const hasOverlap = criterionTokens.some((t) => sectorTokens.some((s) => s === t));
        if (hasOverlap) {
          // Partial match → 20 points.
          sectorMatch = 20;
        } else {
          // No token overlap → 0 points.
          sectorMatch = 0;
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Contact completeness (SECONDARY weight, up to 30 points)
  // ──────────────────────────────────────────────────────────────────────────

  let contactCompleteness = 0;

  if (contacts.length === 0) {
    // No contacts at all → 0 points.
    contactCompleteness = 0;
  } else {
    const hasEmailContact = contacts.some((c) => c.email && c.email.trim().length > 0);
    if (hasEmailContact) {
      // ≥1 contact with a non-null, non-empty email → 30 points (full score).
      contactCompleteness = 30;
    } else {
      // Contacts exist but all emails are null/empty → 15 points (partial).
      contactCompleteness = 15;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Unsupported dimensions — record in notApplied (graceful degradation)
  // ──────────────────────────────────────────────────────────────────────────
  //
  // M3 companies lack geo, size_band, deal_type columns. When a criterion
  // specifies these, we record the non-application in the breakdown so the
  // advisor can see which criteria could not be evaluated. These dimensions
  // contribute 0 to the score (same as filterAsActor wave-9 pattern).

  if (criteria) {
    if (criteria.geo) {
      notApplied.push('geo: not applied — M3 lacks column');
    }
    if (criteria.sizeBand) {
      notApplied.push('sizeBand: not applied — M3 lacks column');
    }
    if (criteria.dealType) {
      notApplied.push('dealType: not applied — M3 lacks column');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Deterministic tie-break (up to 10 points)
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Pure: derived from the candidate id (stable across runs, no IO, no Date.now()).

  const tieBreak = deterministicTieBreak(candidate.id);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Total (clamped to [0, 100])
  // ──────────────────────────────────────────────────────────────────────────

  const rawTotal = sectorMatch + contactCompleteness + tieBreak;
  const total = Math.max(0, Math.min(100, rawTotal));

  const breakdown: ScoreBreakdown = {
    sectorMatch,
    contactCompleteness,
    tieBreak,
    total,
    notApplied,
  };

  return { score: total, breakdown };
}
