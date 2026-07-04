/**
 * BuyerUniverseClient — client component for /buyer-universe.
 *
 * SSR-hydrated (wave-8 pattern): receives `initialDetail` from the server
 * component. Does NOT fetch from /buyer-universe or /buyer-universe/:id
 * (the page routes). All client mutations use the /buyer-universe-data proxy
 * path (non-page-colliding, per wave-8 lesson).
 *
 * Mutation paths (all via /buyer-universe-data — non-page-colliding proxy):
 *   POST   /buyer-universe-data                       → assemble
 *   POST   /buyer-universe-data/:id/filter            → filter
 *   POST   /buyer-universe-data/:id/enrich            → enrich
 *   GET    /buyer-universe-data/:id/gaps              → view gaps
 *   POST   /buyer-universe-data/:id/submit            → submit → ready-to-rank
 *   PATCH  /buyer-universe-data/:id/candidates/:cid  → include/exclude
 *
 * M4/M5 BOUNDARY: NO score / rank / fit display. Assemble + filter +
 * include/exclude + enrich + gaps + submit only.
 */
'use client';

import type {
  BuyerUniverseCandidateMembershipStatus,
  BuyerUniverseDetail,
  BuyerUniverseGap,
  BuyerUniverseStatus,
  EnrichedCandidate,
  Role,
} from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BuyerUniverseClientProps {
  mandateId: string;
  initialDetail: BuyerUniverseDetail | null;
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function UniverseStatusBadge({ status }: { status: BuyerUniverseStatus }) {
  const styles: Record<BuyerUniverseStatus, { bg: string; color: string; border: string }> = {
    draft: { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' },
    filtered: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    submitted: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  };
  const s = styles[status];
  return (
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
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Membership status badge
// ---------------------------------------------------------------------------

function MembershipBadge({ status }: { status: BuyerUniverseCandidateMembershipStatus }) {
  const styles: Record<
    BuyerUniverseCandidateMembershipStatus,
    { bg: string; color: string; border: string; label: string }
  > = {
    candidate: {
      bg: '#F3F4F6',
      color: '#4B5563',
      border: '#E5E7EB',
      label: 'Candidate',
    },
    included: {
      bg: '#ECFDF5',
      color: '#047857',
      border: 'rgba(4,120,87,0.2)',
      label: 'Included',
    },
    excluded: {
      bg: '#FEF2F2',
      color: '#B91C1C',
      border: 'rgba(185,28,28,0.2)',
      label: 'Excluded',
    },
  };
  const s = styles[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
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
// Completeness bar
// ---------------------------------------------------------------------------

function CompletenessBar({ candidate }: { candidate: EnrichedCandidate }) {
  const contactCount = candidate.contacts.length;
  const hasEmail = candidate.contacts.some((c) => Boolean(c.email));
  // Simple completeness: 0 contacts = 0%, has contacts + email = 100%, contacts only = 60%
  const pct = contactCount === 0 ? 0 : hasEmail ? 100 : 60;
  const barColor = pct === 100 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#D1D5DB';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '100px',
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
          }}
        />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Include/Exclude toggle
// ---------------------------------------------------------------------------

function MembershipToggle({
  candidate,
  disabled,
  onToggle,
}: {
  candidate: EnrichedCandidate;
  disabled: boolean;
  onToggle: (cid: string, next: BuyerUniverseCandidateMembershipStatus) => void;
}) {
  const isIncluded = candidate.membershipStatus === 'included';
  const isExcluded = candidate.membershipStatus === 'excluded';

  function handleClick() {
    if (disabled) return;
    // Toggle: included → excluded, excluded/candidate → included
    const next: BuyerUniverseCandidateMembershipStatus = isIncluded ? 'excluded' : 'included';
    onToggle(candidate.id, next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isIncluded}
      aria-label={`${isIncluded ? 'Exclude' : 'Include'} ${candidate.companyId}`}
      disabled={disabled}
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        height: '20px',
        width: '36px',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        border: 'none',
        background: 'transparent',
        padding: 0,
        opacity: isExcluded ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          margin: 'auto',
          height: '16px',
          width: '36px',
          borderRadius: '9999px',
          backgroundColor: isIncluded ? '#10B981' : '#D1D5DB',
          transition: 'background-color 0.2s',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          display: 'inline-block',
          height: '20px',
          width: '20px',
          transform: isIncluded ? 'translateX(16px)' : 'translateX(0)',
          borderRadius: '9999px',
          border: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 2px rgba(16,24,40,0.08)',
          transition: 'transform 0.2s',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Gaps panel
// ---------------------------------------------------------------------------

function GapsPanel({ gaps, onClose }: { gaps: BuyerUniverseGap[]; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Data Gaps"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(3,7,18,0.5)',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 20px 40px rgba(16,24,40,0.2)',
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Data Gaps ({gaps.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gaps panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              fontSize: '20px',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>
        {gaps.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>No data gaps found.</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {gaps.map((gap) => (
              <li
                key={gap.candidateId}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#92400E',
                }}
              >
                <span style={{ fontWeight: 600 }}>{gap.candidateId.slice(0, 8)}…</span> —{' '}
                {gap.reason}
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
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

// ---------------------------------------------------------------------------
// Assemble empty state
// ---------------------------------------------------------------------------

function AssembleEmptyState({
  mandateId,
  loading,
  onAssemble,
}: {
  mandateId: string;
  loading: boolean;
  onAssemble: () => void;
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
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
        No buyer universe yet
      </div>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px', maxWidth: '360px' }}>
        Assemble the buyer universe for mandate{' '}
        <code
          style={{
            fontFamily: 'monospace',
            backgroundColor: '#F3F4F6',
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {mandateId.slice(0, 8)}…
        </code>{' '}
        to pull matching companies from the M3 canonical database.
      </p>
      <button
        type="button"
        onClick={onAssemble}
        disabled={loading}
        aria-label="Assemble buyer universe"
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
        {loading ? 'Assembling…' : 'Assemble Buyer Universe'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate row
// ---------------------------------------------------------------------------

function CandidateRow({
  candidate,
  gap,
  disabled,
  onToggle,
}: {
  candidate: EnrichedCandidate;
  gap: BuyerUniverseGap | undefined;
  disabled: boolean;
  onToggle: (cid: string, next: BuyerUniverseCandidateMembershipStatus) => void;
}) {
  const isExcluded = candidate.membershipStatus === 'excluded';
  const isFlagged = Boolean(gap);

  const rowStyle: React.CSSProperties = {
    borderLeft: isFlagged
      ? '3px solid #F59E0B'
      : isExcluded
        ? '3px solid transparent'
        : '3px solid transparent',
    backgroundColor: isFlagged ? '#FFFAF0' : isExcluded ? '#F9FAFB' : '#FFFFFF',
    opacity: isExcluded ? 0.6 : 1,
  };

  return (
    <tr style={rowStyle}>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: isExcluded ? '#9CA3AF' : '#111827',
            textDecoration: isExcluded ? 'line-through' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {candidate.companyId.slice(0, 8)}…
          {isFlagged && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '9999px',
                backgroundColor: '#F59E0B',
                flexShrink: 0,
              }}
              title="Data gap — action required"
            />
          )}
        </div>
        {gap && (
          <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>{gap.reason}</div>
        )}
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        <MembershipBadge status={candidate.membershipStatus} />
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          {candidate.contacts.length} contact{candidate.contacts.length !== 1 ? 's' : ''}
        </span>
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <CompletenessBar candidate={candidate} />
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
          textAlign: 'center',
        }}
      >
        <MembershipToggle candidate={candidate} disabled={disabled} onToggle={onToggle} />
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #F3F4F6',
          whiteSpace: 'nowrap',
        }}
      >
        {candidate.provenance ? (
          <span style={{ fontSize: '11px', color: '#6B7280' }}>{candidate.provenance}</span>
        ) : (
          <span style={{ fontSize: '11px', color: '#D1D5DB' }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Filter sidebar
// ---------------------------------------------------------------------------

function FilterSidebar({
  searchQuery,
  membershipFilter,
  onSearchChange,
  onMembershipChange,
  onReset,
}: {
  searchQuery: string;
  membershipFilter: 'all' | 'included' | 'excluded' | 'candidate';
  onSearchChange: (v: string) => void;
  onMembershipChange: (v: 'all' | 'included' | 'excluded' | 'candidate') => void;
  onReset: () => void;
}) {
  return (
    <aside
      aria-label="Criteria Filters"
      style={{
        width: '272px',
        flexShrink: 0,
        borderRight: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(249,250,251,0.9)',
          backdropFilter: 'blur(4px)',
          zIndex: 10,
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
          Criteria Filters
        </h2>
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: '12px',
            color: '#6B7280',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Search */}
        <div>
          <div style={{ position: 'relative' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search company ID or status…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search candidates"
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '6px 12px 6px 36px',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Membership filter */}
        <div>
          <p
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: '10px',
              margin: '0 0 10px',
            }}
          >
            Membership Status
          </p>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '4px',
              display: 'flex',
              boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
            }}
          >
            {(['all', 'included', 'excluded', 'candidate'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onMembershipChange(opt)}
                style={{
                  flex: 1,
                  padding: '4px 2px',
                  fontSize: '11px',
                  fontWeight: membershipFilter === opt ? 600 : 500,
                  color: membershipFilter === opt ? '#111827' : '#6B7280',
                  backgroundColor: membershipFilter === opt ? '#F3F4F6' : 'transparent',
                  border:
                    membershipFilter === opt
                      ? '1px solid rgba(209,213,219,0.5)'
                      : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  textTransform: 'capitalize',
                  boxShadow: membershipFilter === opt ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main BuyerUniverseClient
// ---------------------------------------------------------------------------

export function BuyerUniverseClient({
  mandateId,
  initialDetail,
  userRole: _userRole,
}: BuyerUniverseClientProps) {
  const [detail, setDetail] = useState<BuyerUniverseDetail | null>(initialDetail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [membershipFilter, setMembershipFilter] = useState<
    'all' | 'included' | 'excluded' | 'candidate'
  >('all');
  const [gaps, setGaps] = useState<BuyerUniverseGap[] | null>(null);
  const [showGaps, setShowGaps] = useState(false);

  const universe = detail?.universe;
  const candidates: EnrichedCandidate[] = detail?.candidates ?? [];

  // ---------------------------------------------------------------------------
  // Filtered candidates (in-memory)
  // ---------------------------------------------------------------------------

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      searchQuery === '' || c.companyId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMembership = membershipFilter === 'all' || c.membershipStatus === membershipFilter;
    return matchesSearch && matchesMembership;
  });

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalCount = candidates.length;
  const includedCount = candidates.filter((c) => c.membershipStatus === 'included').length;
  const enrichedCount = candidates.filter((c) => c.contacts.length > 0).length;
  const enrichedPct = totalCount > 0 ? Math.round((enrichedCount / totalCount) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Assemble
  // ---------------------------------------------------------------------------

  async function handleAssemble() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/buyer-universe-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandateId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to assemble buyer universe.');
        return;
      }
      const newUniverse = (await res.json()) as { id: string };
      // Fetch the full detail for the new universe
      const detailRes = await apiFetch(`/buyer-universe-data/${newUniverse.id}`);
      if (!detailRes.ok) {
        setError('Universe assembled but failed to load detail.');
        return;
      }
      const newDetail = (await detailRes.json()) as BuyerUniverseDetail;
      setDetail(newDetail);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  async function handleFilter() {
    if (!universe) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/buyer-universe-data/${universe.id}/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to apply filter.');
        return;
      }
      const updated = (await res.json()) as BuyerUniverseDetail;
      setDetail(updated);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Include/exclude toggle
  // ---------------------------------------------------------------------------

  async function handleToggle(candidateId: string, next: BuyerUniverseCandidateMembershipStatus) {
    if (!universe) return;
    // Optimistic update
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        candidates: prev.candidates.map((c) =>
          c.id === candidateId ? { ...c, membershipStatus: next } : c
        ),
      };
    });
    try {
      const res = await apiFetch(`/buyer-universe-data/${universe.id}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipStatus: next }),
      });
      if (!res.ok) {
        // Revert on failure
        const currentStatus: BuyerUniverseCandidateMembershipStatus =
          next === 'included' ? 'excluded' : 'included';
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId ? { ...c, membershipStatus: currentStatus } : c
            ),
          };
        });
        setError('Failed to update candidate status.');
      }
    } catch {
      setError('Network error updating candidate.');
    }
  }

  // ---------------------------------------------------------------------------
  // Enrich
  // ---------------------------------------------------------------------------

  async function handleEnrich() {
    if (!universe) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/buyer-universe-data/${universe.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to enrich candidates.');
        return;
      }
      const updated = (await res.json()) as BuyerUniverseDetail;
      setDetail(updated);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // View gaps
  // ---------------------------------------------------------------------------

  async function handleViewGaps() {
    if (!universe) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/buyer-universe-data/${universe.id}/gaps`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to load gaps.');
        return;
      }
      const data = (await res.json()) as { gaps: BuyerUniverseGap[] };
      setGaps(data.gaps ?? []);
      setShowGaps(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!universe) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/buyer-universe-data/${universe.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to submit to match engine.');
        return;
      }
      const updated = (await res.json()) as BuyerUniverseDetail;
      setDetail(updated);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Computed state
  // ---------------------------------------------------------------------------

  const isSubmitted = universe?.status === 'submitted';
  const canSubmit = universe !== undefined && !isSubmitted && includedCount > 0;

  // ---------------------------------------------------------------------------
  // Render: no universe assembled yet
  // ---------------------------------------------------------------------------

  if (!universe) {
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
            <span style={{ color: '#111827' }}>Build Universe</span>
          </nav>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Buyer Universe
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

        <AssembleEmptyState
          mandateId={mandateId}
          loading={loading}
          onAssemble={() => void handleAssemble()}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: universe exists
  // ---------------------------------------------------------------------------

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
      {/* Gaps modal */}
      {showGaps && gaps !== null && <GapsPanel gaps={gaps} onClose={() => setShowGaps(false)} />}

      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF',
          padding: '4px 24px 16px',
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
          <span style={{ color: '#111827' }}>Build Universe</span>
        </nav>

        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Buyer Universe
            </h1>
            <UniverseStatusBadge status={universe.status} />

            {/* Stats strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginLeft: '16px',
                paddingLeft: '16px',
                borderLeft: '1px solid #E5E7EB',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {totalCount}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                  }}
                >
                  Included
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#10B981',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {includedCount}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                  }}
                >
                  Enriched
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#10B981',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {enrichedPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => void handleFilter()}
              disabled={loading || isSubmitted}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: loading || isSubmitted ? 'not-allowed' : 'pointer',
                opacity: loading || isSubmitted ? 0.5 : 1,
              }}
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={() => void handleEnrich()}
              disabled={loading || isSubmitted}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: loading || isSubmitted ? 'not-allowed' : 'pointer',
                opacity: loading || isSubmitted ? 0.5 : 1,
              }}
            >
              Enrich
            </button>
            <button
              type="button"
              onClick={() => void handleViewGaps()}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              View Gaps
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || loading}
              aria-label="Submit to Match Engine"
              title={
                isSubmitted
                  ? 'Already submitted'
                  : includedCount === 0
                    ? 'Include at least one candidate before submitting'
                    : 'Submit buyer universe to the match engine'
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#FFFFFF',
                backgroundColor: canSubmit && !loading ? '#10B981' : '#9CA3AF',
                border: 'none',
                borderRadius: '6px',
                cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {isSubmitted ? 'Submitted' : 'Submit to Match Engine'}
            </button>
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

      {/* Split workspace */}
      <div
        style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}
      >
        {/* Filter sidebar */}
        <FilterSidebar
          searchQuery={searchQuery}
          membershipFilter={membershipFilter}
          onSearchChange={setSearchQuery}
          onMembershipChange={setMembershipFilter}
          onReset={() => {
            setSearchQuery('');
            setMembershipFilter('all');
          }}
        />

        {/* Data table */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          {/* Table action bar */}
          <div
            style={{
              height: '48px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#4B5563' }}>
                {filteredCandidates.length} record{filteredCandidates.length !== 1 ? 's' : ''} shown
              </span>
              {(searchQuery || membershipFilter !== 'all') && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#10B981',
                    backgroundColor: '#ECFDF5',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}
                >
                  Filters active
                </span>
              )}
            </div>
          </div>

          {/* Scrollable table */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#FCFCFD' }}>
            <table
              style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}
              aria-label="Buyer universe candidates"
            >
              <thead>
                <tr>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      minWidth: '200px',
                    }}
                  >
                    Company
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      minWidth: '120px',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      minWidth: '120px',
                    }}
                  >
                    Contact Readiness
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      minWidth: '160px',
                    }}
                  >
                    Completeness
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      textAlign: 'center',
                      minWidth: '100px',
                    }}
                  >
                    Included
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#FFFFFF',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '10px 16px',
                      minWidth: '140px',
                    }}
                  >
                    Provenance
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: '48px 16px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: '#9CA3AF',
                      }}
                    >
                      No candidates match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      gap={gaps?.find((g) => g.candidateId === candidate.id)}
                      disabled={loading || isSubmitted}
                      onToggle={(cid, next) => void handleToggle(cid, next)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom fade */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0,
              left: '272px',
              right: 0,
              height: '32px',
              background: 'linear-gradient(to top, #FFFFFF, transparent)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        </div>
      </div>
    </div>
  );
}
