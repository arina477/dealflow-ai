/**
 * MatchesShortlistClient — client component for /matches-shortlist.
 *
 * SSR-hydrated (wave-8/9 pattern): receives `initialData` from the server
 * component. Does NOT fetch from /matches or /matches/:id (the API routes).
 * All client mutations use the /matches-data proxy path (non-page-colliding,
 * wave-10 pattern).
 *
 * Mutation paths (all via /matches-data — non-page-colliding proxy):
 *   POST   /matches-data                          → POST   /matches (create run)
 *   PATCH  /matches-data/:id/candidates/:cid      → PATCH  /matches/:id/candidates/:cid (disposition)
 *   POST   /matches-data/:id/handoff              → POST   /matches/:id/handoff (ready-for-outreach)
 *
 * AI-framing STRIP (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance):
 *   - NO "AI Match Analysis" badge or bot icon
 *   - NO "Rationale Explainability Engine" — drawer is "Score breakdown"
 *   - NO "Model Data Freshness" / "AI rationale is generated" / "improve model"
 *   - NO "similar mandates" cross-client fabrication
 *   - All framing: "rule-based fit score" / "score breakdown" (deterministic)
 *
 * RBAC:
 *   advisor/admin: can create runs, disposition, handoff.
 *   analyst: read-only (controls hidden, mutations are blocked).
 */
'use client';

import type {
  MatchCandidate,
  MatchCandidateDisposition,
  MatchRankedList,
  Role,
} from '@dealflow/shared';
import { matchRankedListSchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MatchesShortlistClientProps {
  mandateId: string;
  initialData: MatchRankedList | null;
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Score breakdown helpers
// ---------------------------------------------------------------------------

/**
 * ScoreBreakdownPanel — displays the deterministic score_breakdown jsonb.
 * NO AI/model language. Everything is framed as "rule-based contributions".
 */
function ScoreBreakdownPanel({
  candidate,
  onClose,
}: {
  candidate: MatchCandidate;
  onClose: () => void;
}) {
  const breakdown = candidate.scoreBreakdown as Record<string, unknown> | null;

  // Extract well-known keys from the deterministic scorer output
  const sectorMatch = breakdown?.sectorMatch as
    | { score: number; weight: number; label: string }
    | undefined;
  const contactCompleteness = breakdown?.contactCompleteness as
    | { score: number; weight: number; label: string }
    | undefined;
  const tieBreak = breakdown?.tieBreak as { score: number; label: string } | undefined;
  const notApplied = breakdown?.notApplied as string[] | undefined;

  return (
    <div
      role="dialog"
      aria-label={`Score breakdown for candidate`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(3,7,18,0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 20px 40px rgba(16,24,40,0.2)',
          width: '100%',
          maxWidth: '480px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #F3F4F6',
            backgroundColor: '#F9FAFB',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            {/* Rule-based fit score badge — NOT "AI Match Analysis" */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
                marginBottom: '8px',
              }}
            >
              Rule-based fit score
            </span>
            {/* Score breakdown — NOT "Rationale Explainability Engine" */}
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
                margin: 0,
              }}
            >
              Score breakdown
            </h2>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0' }}>
              Candidate {candidate.id.slice(0, 8)}…
            </p>
          </div>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: `3px solid ${candidate.fitScore >= 70 ? '#10B981' : candidate.fitScore >= 50 ? '#F59E0B' : '#9CA3AF'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
              {candidate.fitScore}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#6B7280' }}>score</span>
          </div>
        </div>

        {/* Breakdown dimensions */}
        <div style={{ padding: '20px 24px' }}>
          <h4
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#6B7280',
              marginBottom: '12px',
              marginTop: 0,
            }}
          >
            Score contributions (rule-based)
          </h4>

          {breakdown ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sectorMatch && (
                <BreakdownDimension
                  label={sectorMatch.label ?? 'Sector / industry match'}
                  score={sectorMatch.score}
                  weight={sectorMatch.weight}
                />
              )}
              {contactCompleteness && (
                <BreakdownDimension
                  label={contactCompleteness.label ?? 'Contact completeness'}
                  score={contactCompleteness.score}
                  weight={contactCompleteness.weight}
                />
              )}
              {tieBreak && (
                <BreakdownDimension label={tieBreak.label ?? 'Tie-break'} score={tieBreak.score} />
              )}
              {notApplied && notApplied.length > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#9CA3AF',
                      marginBottom: '6px',
                    }}
                  >
                    Dimensions not applied
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {notApplied.map((dim) => (
                      <li
                        key={dim}
                        style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}
                      >
                        {dim}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
              No breakdown data available for this candidate.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function BreakdownDimension({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight?: number;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const barColor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#D1D5DB';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280' }}>
          {score}
          {weight !== undefined && (
            <span style={{ fontWeight: 400, color: '#9CA3AF' }}> / wt {weight}</span>
          )}
        </span>
      </div>
      <div
        style={{
          height: '6px',
          backgroundColor: '#F3F4F6',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: barColor,
            borderRadius: '9999px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score gauge (CSS conic-gradient fit gauge — from design LAYOUT)
// ---------------------------------------------------------------------------

function FitScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const ringColor = pct >= 70 ? '#10B981' : pct >= 50 ? '#D97706' : '#9CA3AF';

  return (
    <div
      role="img"
      aria-label={`Rule-based fit score: ${score}`}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: `conic-gradient(${ringColor} ${pct}%, #F3F4F6 0%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Inner white circle to create ring effect */}
      <div
        style={{
          position: 'absolute',
          inset: '4px',
          background: 'white',
          borderRadius: '50%',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontSize: '13px',
          fontWeight: 700,
          color: '#111827',
          letterSpacing: '-0.5px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disposition badge
// ---------------------------------------------------------------------------

function DispositionBadge({ disposition }: { disposition: MatchCandidateDisposition }) {
  const styles: Record<
    MatchCandidateDisposition,
    { bg: string; color: string; border: string; label: string }
  > = {
    pending: { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB', label: 'Pending' },
    accepted: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: 'Accepted' },
    rejected: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA', label: 'Rejected' },
    flagged: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A', label: 'Flagged' },
  };
  const s = styles[disposition];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Candidate row
// ---------------------------------------------------------------------------

function CandidateRow({
  candidate,
  canMutate,
  onDisposition,
  onOpenBreakdown,
}: {
  candidate: MatchCandidate;
  canMutate: boolean;
  onDisposition: (cid: string, disposition: MatchCandidateDisposition) => void;
  onOpenBreakdown: (candidate: MatchCandidate) => void;
}) {
  const isAccepted = candidate.disposition === 'accepted';
  const isFlagged = candidate.disposition === 'flagged';
  const isRejected = candidate.disposition === 'rejected';

  const rowStyle: React.CSSProperties = {
    backgroundColor: isAccepted
      ? 'rgba(236,253,245,0.2)'
      : isFlagged
        ? 'rgba(254,243,199,0.1)'
        : '#FFFFFF',
    borderLeft: isAccepted
      ? '3px solid #10B981'
      : isFlagged
        ? '3px solid #F59E0B'
        : '3px solid transparent',
    opacity: isRejected ? 0.55 : 1,
    transition: 'opacity 0.15s',
  };

  return (
    <tr style={rowStyle}>
      {/* Fit Score */}
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        <FitScoreGauge score={candidate.fitScore} />
      </td>

      {/* Candidate ID (company identifier) */}
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          minWidth: '200px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: isRejected ? '#9CA3AF' : '#111827',
            textDecoration: isRejected ? 'line-through' : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {candidate.buyerUniverseCandidateId.slice(0, 8)}…
        </div>
        <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
          {candidate.matchRunId.slice(0, 8)}…
        </div>
      </td>

      {/* Disposition */}
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        <DispositionBadge disposition={candidate.disposition} />
      </td>

      {/* Score breakdown button — "Score breakdown" NOT "AI rationale" */}
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          minWidth: '180px',
        }}
      >
        <button
          type="button"
          onClick={() => onOpenBreakdown(candidate)}
          aria-label={`View score breakdown for candidate ${candidate.buyerUniverseCandidateId.slice(0, 8)}`}
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#10B981',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          View score breakdown
        </button>
      </td>

      {/* Actions */}
      <td
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        {canMutate && !isRejected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!isAccepted && (
              <button
                type="button"
                onClick={() => onDisposition(candidate.id, 'accepted')}
                aria-label="Accept candidate"
                title="Accept"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6B7280',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ECFDF5';
                  (e.currentTarget as HTMLButtonElement).style.color = '#10B981';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#A7F3D0';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF';
                  (e.currentTarget as HTMLButtonElement).style.color = '#6B7280';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB';
                }}
              >
                {/* Check icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}
            {isAccepted && (
              <span
                role="status"
                aria-label="Accepted"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: '#ECFDF5',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#047857',
                }}
              >
                {/* Check-check icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                  <polyline points="16 6 5 17" />
                </svg>
                Accepted
              </span>
            )}
            {!isFlagged && (
              <button
                type="button"
                onClick={() => onDisposition(candidate.id, 'flagged')}
                aria-label="Flag candidate"
                title="Flag"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9CA3AF',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEF3C7';
                  (e.currentTarget as HTMLButtonElement).style.color = '#D97706';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF';
                }}
              >
                {/* Flag icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDisposition(candidate.id, 'rejected')}
              aria-label="Reject candidate"
              title="Reject"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9CA3AF',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEF2F2';
                (e.currentTarget as HTMLButtonElement).style.color = '#B91C1C';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF';
              }}
            >
              {/* X icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {!canMutate && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>read-only</span>}
        {canMutate && isRejected && (
          <button
            type="button"
            onClick={() => onDisposition(candidate.id, 'pending')}
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#6B7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Restore
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state (no match run exists yet)
// ---------------------------------------------------------------------------

function NoRunEmptyState({
  mandateId,
  loading,
  canMutate,
  onCreateRun,
}: {
  mandateId: string;
  loading: boolean;
  canMutate: boolean;
  onCreateRun: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#F3F4F6',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        {/* Target icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
        No match run yet
      </div>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px', maxWidth: '360px' }}>
        {canMutate
          ? `Create a match run for mandate ${mandateId.slice(0, 8)}… to score and rank the submitted buyer universe.`
          : 'No match run has been created yet. An advisor or admin must submit the buyer universe first.'}
      </p>
      {canMutate && (
        <button
          type="button"
          onClick={onCreateRun}
          disabled={loading}
          aria-label="Create match run"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#FFFFFF',
            backgroundColor: loading ? '#9CA3AF' : '#10B981',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {loading ? 'Creating…' : 'Create Match Run'}
        </button>
      )}
      <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '12px' }}>
        The buyer universe must be submitted before creating a match run.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shortlist sidebar (accepted candidates)
// ---------------------------------------------------------------------------

function ShortlistSidebar({
  candidates,
  canMutate,
  handoffLoading,
  handoffDone,
  onHandoff,
}: {
  candidates: MatchCandidate[];
  canMutate: boolean;
  handoffLoading: boolean;
  handoffDone: boolean;
  onHandoff: () => void;
}) {
  const accepted = candidates.filter((c) => c.disposition === 'accepted');
  const canHandoff = canMutate && accepted.length >= 1 && !handoffDone;

  return (
    <aside
      aria-label="Shortlist"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '340px',
        flexShrink: 0,
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        zIndex: 10,
      }}
    >
      {/* Shortlist header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#111827',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {/* List-checks icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Shortlist
          </h2>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#E5E7EB',
              color: '#374151',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {accepted.length} accepted
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#E5E7EB',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (accepted.length / Math.max(1, candidates.length)) * 100)}%`,
              backgroundColor: '#10B981',
              borderRadius: '9999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Accepted candidates list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {accepted.length === 0 ? (
          <div
            style={{
              border: '2px dashed #E5E7EB',
              borderRadius: '8px',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'rgba(249,250,251,0.5)',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, margin: 0 }}>
              Accept candidates to build your outreach pool.
            </p>
          </div>
        ) : (
          accepted.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                padding: '10px 12px',
                position: 'relative',
                borderLeft: '3px solid #10B981',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#047857',
                        backgroundColor: '#ECFDF5',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        border: '1px solid #A7F3D0',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {c.fitScore}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.buyerUniverseCandidateId.slice(0, 8)}…
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>
                    Candidate ID: {c.id.slice(0, 8)}…
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Handoff CTA */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
        }}
      >
        {handoffDone ? (
          <div
            role="status"
            aria-label="Ready for outreach"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#047857',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Ready for outreach
          </div>
        ) : (
          <button
            type="button"
            onClick={onHandoff}
            disabled={!canHandoff || handoffLoading}
            aria-label="Submit shortlist to outreach"
            data-testid="handoff-button"
            title={
              !canMutate
                ? 'Advisor or admin required'
                : accepted.length === 0
                  ? 'Accept at least one candidate before submitting'
                  : 'Submit shortlist to outreach'
            }
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: canHandoff && !handoffLoading ? '#10B981' : '#9CA3AF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: canHandoff && !handoffLoading ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.15s',
            }}
          >
            <span>{handoffLoading ? 'Submitting…' : 'Submit to Outreach'}</span>
            {!handoffLoading && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        )}
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '10px',
            color: '#6B7280',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Compliance checks auto-run on confirm
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main MatchesShortlistClient
// ---------------------------------------------------------------------------

export function MatchesShortlistClient({
  mandateId,
  initialData,
  userRole,
}: MatchesShortlistClientProps) {
  const [data, setData] = useState<MatchRankedList | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdownCandidate, setBreakdownCandidate] = useState<MatchCandidate | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffDone, setHandoffDone] = useState(initialData?.run.readyForOutreach ?? false);

  const canMutate = userRole === 'advisor' || userRole === 'admin';
  const candidates = data?.candidates ?? [];
  const run = data?.run;

  const acceptedCount = candidates.filter((c) => c.disposition === 'accepted').length;

  // ---------------------------------------------------------------------------
  // Create match run (POST /matches-data)
  // ---------------------------------------------------------------------------

  async function handleCreateRun() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/matches-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandateId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to create match run.');
        return;
      }
      // The POST /matches response is the full MatchRankedList (run + ranked candidates)
      const raw: unknown = await res.json();
      const parsed = matchRankedListSchema.safeParse(raw);
      if (parsed.success) {
        setData(parsed.data);
        setHandoffDone(parsed.data.run.readyForOutreach);
      } else {
        // Unexpected shape — do NOT blind-cast unvalidated data into state.
        // The schema is .passthrough(), so a genuine MatchRankedList always parses;
        // reaching here means the API returned a truly wrong shape. Leave existing
        // data unchanged and surface an actionable error.
        setError('Unexpected response from server — please refresh.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Disposition (PATCH /matches-data/:id/candidates/:cid)
  // ---------------------------------------------------------------------------

  async function handleDisposition(candidateId: string, disposition: MatchCandidateDisposition) {
    if (!run) return;
    // Capture the pre-mutation disposition so we can restore it if the PATCH fails.
    const prevDisposition = data?.candidates.find((c) => c.id === candidateId)?.disposition;
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        candidates: prev.candidates.map((c) => (c.id === candidateId ? { ...c, disposition } : c)),
      };
    });
    try {
      const res = await apiFetch(`/matches-data/${run.id}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to update disposition.');
        // Revert to the captured pre-mutation disposition (not the already-mutated c.disposition).
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId && prevDisposition !== undefined
                ? { ...c, disposition: prevDisposition }
                : c
            ),
          };
        });
      }
      // On success, the response is the updated candidate — update state
      else {
        const raw: unknown = await res.json();
        // The API may return the updated run+candidates or just the candidate
        const rankedParsed = matchRankedListSchema.safeParse(raw);
        if (rankedParsed.success) {
          setData(rankedParsed.data);
        }
        // If it just returns the candidate, the optimistic update is already correct
      }
    } catch {
      setError('Network error updating disposition.');
    }
  }

  // ---------------------------------------------------------------------------
  // Handoff (POST /matches-data/:id/handoff)
  // ---------------------------------------------------------------------------

  async function handleHandoff() {
    if (!run) return;
    setHandoffLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/matches-data/${run.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to submit to outreach.');
        return;
      }
      // Parse response — may be MatchRankedList or just the run
      const raw: unknown = await res.json();
      const parsed = matchRankedListSchema.safeParse(raw);
      if (parsed.success) {
        setData(parsed.data);
        setHandoffDone(parsed.data.run.readyForOutreach);
      } else {
        setHandoffDone(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setHandoffLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render: no run yet (empty state)
  // ---------------------------------------------------------------------------

  if (!run) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Header */}
        <header
          style={{
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            padding: '12px 24px 16px',
            flexShrink: 0,
          }}
        >
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#6B7280',
              marginBottom: '8px',
            }}
          >
            <a href="/mandates" style={{ color: '#6B7280', textDecoration: 'none' }}>
              Mandates
            </a>
            <span aria-hidden="true">›</span>
            <a href={`/mandates/${mandateId}`} style={{ color: '#6B7280', textDecoration: 'none' }}>
              Mandate
            </a>
            <span aria-hidden="true">›</span>
            <span style={{ color: '#111827' }}>Matches & Shortlist</span>
          </nav>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Matches &amp; Shortlist
          </h1>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              margin: '16px 24px 0',
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid rgba(185,28,28,0.2)',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        <NoRunEmptyState
          mandateId={mandateId}
          loading={loading}
          canMutate={canMutate}
          onCreateRun={() => void handleCreateRun()}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: run exists — ranked list + shortlist
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: '#FCFCFD',
      }}
    >
      {/* Score breakdown modal */}
      {breakdownCandidate && (
        <ScoreBreakdownPanel
          candidate={breakdownCandidate}
          onClose={() => setBreakdownCandidate(null)}
        />
      )}

      {/* Page header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '4px 24px 0',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#6B7280',
            paddingTop: '8px',
            marginBottom: '6px',
          }}
        >
          <a href="/mandates" style={{ color: '#6B7280', textDecoration: 'none' }}>
            Mandates
          </a>
          <span aria-hidden="true">›</span>
          <a href={`/mandates/${mandateId}`} style={{ color: '#6B7280', textDecoration: 'none' }}>
            Mandate
          </a>
          <span aria-hidden="true">›</span>
          <span style={{ color: '#111827' }}>Matches &amp; Shortlist</span>
        </nav>

        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Matches &amp; Shortlist
            </h1>
            {/* Run status badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor: run.status === 'scored' ? '#ECFDF5' : '#F3F4F6',
                color: run.status === 'scored' ? '#047857' : '#4B5563',
                border: `1px solid ${run.status === 'scored' ? '#A7F3D0' : '#E5E7EB'}`,
              }}
            >
              {run.status}
            </span>
            {handoffDone && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                }}
              >
                Ready for outreach
              </span>
            )}

            {/* Stats */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginLeft: '8px',
                paddingLeft: '16px',
                borderLeft: '1px solid #E5E7EB',
              }}
            >
              <StatPill label="Total" value={candidates.length} />
              <StatPill label="Accepted" value={acceptedCount} color="#10B981" />
              <StatPill
                label="Flagged"
                value={candidates.filter((c) => c.disposition === 'flagged').length}
                color="#D97706"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            margin: '0 24px',
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid rgba(185,28,28,0.2)',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#B91C1C',
            flexShrink: 0,
            marginTop: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Split workspace: left ranked list, right shortlist */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* LEFT PANE: Ranked candidates table */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FCFCFD',
            overflow: 'hidden',
          }}
        >
          {/* Utility bar */}
          <div
            style={{
              height: '48px',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#4B5563' }}>
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} — ordered by
              rule-based fit score
            </span>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Fit score ↓ (deterministic)</span>
          </div>

          {/* Scrollable table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table
              style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}
              aria-label="Ranked match candidates"
            >
              <thead>
                <tr>
                  {['Fit Score', 'Candidate', 'Disposition', 'Score Breakdown', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          position: 'sticky',
                          top: 0,
                          backgroundColor: '#FFFFFF',
                          zIndex: 10,
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: '#6B7280',
                          borderBottom: '1px solid #E5E7EB',
                          padding: '10px 16px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: '48px 16px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: '#9CA3AF',
                      }}
                    >
                      No candidates in this match run.
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      canMutate={canMutate}
                      onDisposition={(cid, d) => void handleDisposition(cid, d)}
                      onOpenBreakdown={setBreakdownCandidate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT PANE: Shortlist sidebar */}
        <ShortlistSidebar
          candidates={candidates}
          canMutate={canMutate}
          handoffLoading={handoffLoading}
          handoffDone={handoffDone}
          onHandoff={() => void handleHandoff()}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill helper
// ---------------------------------------------------------------------------

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#6B7280',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: color ?? '#111827',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}
