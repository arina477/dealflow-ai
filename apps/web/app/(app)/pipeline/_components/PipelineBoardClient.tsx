'use client';

/**
 * PipelineBoardClient — Pipeline board UI (wave-12 B-3, tasks d1940142 + 45b259e1).
 *
 * Renders a 7-column stage board matching design/pipeline.html.
 * The 7 fixed pipeline_stage columns in order (product-decision #137):
 *   shortlisted → contacted → engaged → diligence → offer → closed → withdrawn
 *
 * Mutations use /pipeline-data proxy (non-page-colliding — wave-8/9 lesson):
 *   PATCH /pipeline-data/:id/stage  → PATCH /pipeline/:id/stage  (transition)
 *   POST  /pipeline-data/:id/notes  → POST  /pipeline/:id/notes  (add note)
 *
 * Board reflects server truth on refresh (SSR re-read), NOT optimistic-only.
 * Stage transitions are advisor-only; compliance sees board as read-only.
 *
 * HARD BOUNDARY (P-4 karen flag):
 *   NO send/email affordance.
 *   NO AI/drafting affordance.
 *
 * Deal card click → opens DealTimelinePanel (event timeline + add-note).
 */

import type { PipelineStage, Role } from '@dealflow/shared';
import { pipelineStageEnum } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type { NormalisedBoard, PipelineRowWithJoins } from '../_lib/pipeline-types';
import { PIPELINE_STAGES } from '../_lib/pipeline-types';
import { DealTimelinePanel } from './DealTimelinePanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PipelineBoardClientProps {
  initialBoard: NormalisedBoard;
  userRole: Role;
  mandateId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Stage display labels
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<PipelineStage, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  engaged: 'Engaged',
  diligence: 'Diligence',
  offer: 'Offer',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
};

// ---------------------------------------------------------------------------
// Stage move select
// ---------------------------------------------------------------------------

interface StageMoveSelectProps {
  pipelineId: string;
  currentStage: PipelineStage;
  onMove: (id: string, toStage: PipelineStage) => void;
  disabled: boolean;
}

function StageMoveSelect({ pipelineId, currentStage, onMove, disabled }: StageMoveSelectProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const toStage = e.target.value as PipelineStage;
    if (!pipelineStageEnum.options.includes(toStage)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/pipeline-data/${pipelineId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Error ${res.status}`);
        // Reset the select visually by forcing a re-render
        e.target.value = currentStage;
        return;
      }
      onMove(pipelineId, toStage);
    } catch {
      setError('Network error');
      e.target.value = currentStage;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <select
        aria-label="Move to stage"
        value={currentStage}
        onChange={handleChange}
        disabled={disabled || loading}
        style={{
          fontSize: '12px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '3px 6px',
          backgroundColor: loading ? '#f9fafb' : '#fff',
          color: '#374151',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#dc2626' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deal card
// ---------------------------------------------------------------------------

interface DealCardProps {
  deal: PipelineRowWithJoins;
  userRole: Role;
  onMove: (id: string, toStage: PipelineStage) => void;
  onOpenTimeline: (deal: PipelineRowWithJoins) => void;
}

function DealCard({ deal, userRole, onMove, onOpenTimeline }: DealCardProps) {
  const isAdvisor = userRole === 'advisor';

  const displayName =
    deal.buyerName ??
    deal.buyerFirm ??
    deal.outreachId ??
    deal.matchCandidateId ??
    deal.id.slice(0, 8);
  const mandateDisplay = deal.mandateName ?? deal.mandateId.slice(0, 8);

  return (
    <article
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(16,24,40,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(16,24,40,0.05)';
      }}
    >
      {/* Deal identity */}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            lineHeight: '20px',
          }}
        >
          {displayName}
        </h3>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '16px',
          }}
        >
          Mandate: {mandateDisplay}
        </p>
      </div>

      {/* Source type badge */}
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 500,
            borderRadius: '6px',
            lineHeight: '16px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
          }}
        >
          {deal.dealSourceType === 'outreach' ? 'Outreach' : 'Match'}
        </span>
      </div>

      {/* Timeline button */}
      <button
        type="button"
        aria-label={`View timeline for deal ${displayName}`}
        onClick={() => onOpenTimeline(deal)}
        style={{
          fontSize: '12px',
          color: '#10b981',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
          textDecoration: 'underline',
        }}
      >
        View timeline
      </button>

      {/* Stage move — advisor only */}
      {isAdvisor && (
        <StageMoveSelect
          pipelineId={deal.id}
          currentStage={deal.stage}
          onMove={onMove}
          disabled={false}
        />
      )}

      {/* Timestamp */}
      <p
        style={{
          margin: 0,
          fontSize: '11px',
          color: '#9ca3af',
          lineHeight: '16px',
        }}
      >
        {new Date(deal.createdAt).toLocaleDateString()}
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Stage column
// ---------------------------------------------------------------------------

interface StageColumnProps {
  stage: PipelineStage;
  deals: PipelineRowWithJoins[];
  userRole: Role;
  index: number;
  onMove: (id: string, toStage: PipelineStage) => void;
  onOpenTimeline: (deal: PipelineRowWithJoins) => void;
}

function StageColumn({ stage, deals, userRole, index, onMove, onOpenTimeline }: StageColumnProps) {
  return (
    <section
      style={{
        width: '260px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        // Staggered animation index via CSS custom property
        opacity: 0,
        animation: `slideUpFade 0.5s cubic-bezier(0.16,1,0.3,1) forwards`,
        animationDelay: `${index * 80}ms`,
      }}
      data-stage={stage}
      aria-label={`${STAGE_LABELS[stage]} column`}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {STAGE_LABELS[stage]}
        </span>
        <span
          style={{
            fontSize: '11px',
            backgroundColor: deals.length > 0 ? '#d1fae5' : '#f3f4f6',
            color: deals.length > 0 ? '#047857' : '#6b7280',
            fontWeight: deals.length > 0 ? 700 : 400,
            padding: '1px 7px',
            borderRadius: '9999px',
            minWidth: '20px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {deals.length}
        </span>
      </div>

      {/* Cards scroll area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingRight: '4px',
          paddingBottom: '24px',
        }}
      >
        {deals.length === 0 ? (
          /* Empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minHeight: '120px',
              border: '2px dashed #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              backgroundColor: 'rgba(249,250,251,0.5)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              No deals
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: '#9ca3af',
              }}
            >
              {STAGE_LABELS[stage]} is empty
            </p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              userRole={userRole}
              onMove={onMove}
              onOpenTimeline={onOpenTimeline}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PipelineBoardClient (root component)
// ---------------------------------------------------------------------------

export function PipelineBoardClient({
  initialBoard,
  userRole,
  mandateId: _mandateId,
}: PipelineBoardClientProps) {
  const [board, setBoard] = useState<NormalisedBoard>(initialBoard);
  const [activeTimelineDeal, setActiveTimelineDeal] = useState<PipelineRowWithJoins | null>(null);

  // Stage transition: move deal from its current column to the new stage.
  // Board reflects server truth on the next SSR refresh; we update locally
  // only to show the move optimistically in the current session.
  const handleMove = useCallback((id: string, toStage: PipelineStage) => {
    setBoard((prev) => {
      // Find the deal across all stages
      let movingDeal: PipelineRowWithJoins | undefined;
      for (const deals of Object.values(prev.byStage)) {
        const found = deals.find((d) => d.id === id);
        if (found) {
          movingDeal = found;
          break;
        }
      }
      if (!movingDeal) return prev;

      const updatedDeal: PipelineRowWithJoins = { ...movingDeal, stage: toStage };

      // Build new byStage: remove from current column, add to target column
      const newByStage = { ...prev.byStage };
      for (const stage of PIPELINE_STAGES) {
        newByStage[stage] = prev.byStage[stage].filter((d) => d.id !== id);
      }
      newByStage[toStage] = [...newByStage[toStage], updatedDeal];

      return { byStage: newByStage };
    });
  }, []);

  const handleOpenTimeline = useCallback((deal: PipelineRowWithJoins) => {
    setActiveTimelineDeal(deal);
  }, []);

  const handleCloseTimeline = useCallback(() => {
    setActiveTimelineDeal(null);
  }, []);

  return (
    <>
      {/* Global keyframe for column stagger */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 64px)',
          overflow: 'hidden',
        }}
      >
        {/* Board header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
                lineHeight: '28px',
              }}
            >
              Pipeline Board
            </h1>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '13px',
                color: '#6b7280',
              }}
            >
              {PIPELINE_STAGES.length} fixed stages · deal-stage tracking
            </p>
          </div>

          {/* Role badge */}
          <span
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              fontWeight: 500,
            }}
          >
            {userRole === 'advisor' ? 'Advisor — can move deals' : 'Compliance — read-only'}
          </span>
        </div>

        {/* Kanban board — horizontal scroll */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '20px',
              height: '100%',
              alignItems: 'flex-start',
              minWidth: 'max-content',
              paddingBottom: '16px',
            }}
          >
            {PIPELINE_STAGES.map((stage, index) => (
              <StageColumn
                key={stage}
                stage={stage}
                deals={board.byStage[stage]}
                userRole={userRole}
                index={index}
                onMove={handleMove}
                onOpenTimeline={handleOpenTimeline}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Deal timeline panel (slide-in on card click) */}
      {activeTimelineDeal && (
        <DealTimelinePanel
          deal={activeTimelineDeal}
          userRole={userRole}
          onClose={handleCloseTimeline}
        />
      )}
    </>
  );
}
