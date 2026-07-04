/**
 * MandateDetailClient — client component for GET /mandates/:id (detail page).
 *
 * SSR-hydrated (wave-7 pattern): receives `initialDetail` from the server
 * component. Does NOT fetch from /mandates/:id (the page route) — the server
 * already fetched it server-side via the internal API URL to avoid the
 * page-route collision (wave-7 lesson).
 *
 * Role-based rendering:
 *   - advisor / admin: shows "Configure" edit controls (PATCH /mandates/:id)
 *   - analyst: read-only, no edit controls
 *
 * D6 — Deferred placeholders: Buyer Engine, Ranked Candidates, Pipeline sections
 * are rendered as labelled DeferredPlaceholder mount points. NOT built yet,
 * NOT dropped — stable DOM positions for the M4 bundle.
 */
'use client';

import type { MandateDetail, Role } from '@dealflow/shared';
import { mandateConfigureSchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import { DeferredPlaceholder } from './DeferredPlaceholder';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MandateDetailClientProps {
  mandateId: string;
  initialDetail: MandateDetail;
  /** The authenticated user's role. Named `userRole` to avoid conflict with the HTML `role` attribute. */
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(raw: string): string {
  // PG-wire timestamptz: "2026-07-04 04:42:20+00" — two-step normalization:
  //   1. Replace space with 'T' → "2026-07-04T04:42:20+00"
  //   2. Append ':00' when timezone offset is +HH or -HH (no minutes) →
  //      "2026-07-04T04:42:20+00:00". V8 requires +HH:MM; bare +HH is invalid.
  // ISO "2026-07-04T04:42:20.000Z" passes through unchanged.
  try {
    const normalized = raw.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'draft' | 'active' }) {
  const isDraft = status === 'draft';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: isDraft ? '#F9FAFB' : '#ECFDF5',
        color: isDraft ? '#4B5563' : '#059669',
        border: `1px solid ${isDraft ? '#E5E7EB' : '#A7F3D0'}`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isDraft ? '#9CA3AF' : '#10B981',
          flexShrink: 0,
          ...(isDraft ? {} : { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }),
        }}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail row
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <dt
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#6B7280',
        }}
      >
        {label}
      </dt>
      <dd style={{ fontSize: '14px', color: '#111827', margin: 0, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configure form (advisor/admin edit panel)
// ---------------------------------------------------------------------------

interface ConfigureFormProps {
  mandateId: string;
  detail: MandateDetail;
  onSaved: (updated: MandateDetail) => void;
  onCancel: () => void;
}

function ConfigureForm({ mandateId, detail, onSaved, onCancel }: ConfigureFormProps) {
  const { mandate, buyerCriteria } = detail;

  const [sellerName, setSellerName] = useState(mandate.sellerName);
  const [status, setStatus] = useState<'draft' | 'active'>(mandate.status);
  const [buyerGeo, setBuyerGeo] = useState(buyerCriteria?.geo ?? '');
  const [buyerSizeBand, setBuyerSizeBand] = useState(buyerCriteria?.sizeBand ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const input = {
      sellerName: sellerName.trim() || undefined,
      status,
      buyerCriteria: {
        ...(buyerGeo ? { geo: buyerGeo } : {}),
        ...(buyerSizeBand ? { sizeBand: buyerSizeBand } : {}),
      },
    };

    const parsed = mandateConfigureSchema.safeParse(input);
    if (!parsed.success) {
      setSaveError(parsed.error.errors[0]?.message ?? 'Validation error.');
      return;
    }

    setSaving(true);
    try {
      // PATCH to /mandates-data/:id — the non-colliding proxy path (CRITICAL-1 fix).
      // /mandates-data/:id (no page file) → afterFiles rewrite → PATCH /mandates/:id on API.
      const res = await apiFetch(`/mandates-data/${mandateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        const body: unknown = await res.json();
        onSaved(body as MandateDetail);
      } else {
        let msg = 'Save failed.';
        try {
          const err = (await res.json()) as { message?: string };
          if (err.message) msg = err.message;
        } catch {
          // ignore
        }
        setSaveError(msg);
      }
    } catch {
      setSaveError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    padding: '7px 10px',
    fontSize: '13px',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <form
      onSubmit={handleSave}
      aria-label="Configure mandate"
      style={{
        border: '1px solid #D1FAE5',
        borderRadius: '8px',
        backgroundColor: '#F0FDF4',
        padding: '20px',
        marginTop: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#065F46', marginBottom: '16px' }}>
        Configure Mandate
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {saveError && (
          <div
            role="alert"
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#991B1B',
            }}
          >
            {saveError}
          </div>
        )}

        <div>
          <label
            htmlFor="cfg-seller-name"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '4px',
            }}
          >
            Seller Name
          </label>
          <input
            id="cfg-seller-name"
            type="text"
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="cfg-status"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '4px',
            }}
          >
            Status
          </label>
          {/* The configure form is only shown for draft mandates (active are locked).
              Only the draft → active advance is permitted; active → draft is
              blocked server-side. The select reflects that: draft is always
              shown, active is shown to allow the advance. No revert option. */}
          <select
            id="cfg-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
            style={{ ...inputStyle, maxWidth: '200px', appearance: 'none' }}
          >
            <option value="draft">Draft</option>
            <option value="active">Activate (draft → active)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="cfg-buyer-geo"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '4px',
            }}
          >
            Buyer Geography
          </label>
          <input
            id="cfg-buyer-geo"
            type="text"
            placeholder="e.g. North America"
            value={buyerGeo}
            onChange={(e) => setBuyerGeo(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="cfg-buyer-size"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '4px',
            }}
          >
            Buyer Size Band
          </label>
          <input
            id="cfg-buyer-size"
            type="text"
            placeholder="e.g. $50M–$250M"
            value={buyerSizeBand}
            onChange={(e) => setBuyerSizeBand(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: saving ? '#D1D5DB' : '#10B981',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// MandateDetailClient
// ---------------------------------------------------------------------------

export function MandateDetailClient({
  mandateId,
  initialDetail,
  userRole,
}: MandateDetailClientProps) {
  const [detail, setDetail] = useState<MandateDetail>(initialDetail);
  const [configuring, setConfiguring] = useState(false);

  const { mandate, buyerCriteria, complianceProfile } = detail;
  const isEditor = userRole === 'advisor' || userRole === 'admin';

  function handleSaved(updated: MandateDetail) {
    setDetail(updated);
    setConfiguring(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#6B7280',
              marginBottom: '6px',
            }}
          >
            Mandate
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '-0.01em',
              margin: 0,
              marginBottom: '10px',
            }}
          >
            {mandate.sellerName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StatusBadge status={mandate.status} />
            <span
              style={{ fontSize: '12px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}
            >
              Created {formatDate(mandate.createdAt)}
            </span>
          </div>
        </div>

        {/* Configure button — advisor/admin only, draft mandates only.
            Active mandates are locked server-side (409); the button is hidden
            client-side as a UX convenience (not the authoritative guard). */}
        {isEditor && !configuring && mandate.status === 'draft' && (
          <button
            type="button"
            onClick={() => setConfiguring(true)}
            aria-label="Configure this mandate"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
              transition: 'all 150ms ease',
              flexShrink: 0,
            }}
          >
            {/* Edit icon */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Configure
          </button>
        )}
        {/* Active-mandate locked badge (read-only indicator for editors) */}
        {isEditor && !configuring && mandate.status === 'active' && (
          <span
            role="status"
            aria-label="Active mandate is read-only"
            title="Active mandates are locked and cannot be edited"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B7280',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          >
            {/* Lock icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Locked
          </span>
        )}
      </div>

      {/* Configure form (advisor/admin) */}
      {isEditor && configuring && (
        <ConfigureForm
          mandateId={mandateId}
          detail={detail}
          onSaved={handleSaved}
          onCancel={() => setConfiguring(false)}
        />
      )}

      {/* ── Seller / Target Profile ── */}
      <section
        aria-labelledby="profile-heading"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
        }}
      >
        <h2
          id="profile-heading"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#111827',
            marginBottom: '16px',
            marginTop: 0,
          }}
        >
          Seller & Target Profile
        </h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          <DetailRow label="Company" value={mandate.sellerName} />
          <DetailRow label="Industry" value={mandate.sellerIndustry ?? '—'} />
          <DetailRow
            label="Regions"
            value={
              mandate.sellerGeo && mandate.sellerGeo.length > 0 ? mandate.sellerGeo.join(', ') : '—'
            }
          />
          <DetailRow label="Size Band" value={mandate.sellerSizeBand ?? '—'} />
          <DetailRow label="Deal Type" value={mandate.dealType ?? '—'} />
          {mandate.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <DetailRow label="Description" value={mandate.description} />
            </div>
          )}
        </dl>
      </section>

      {/* ── Buyer Universe Criteria ── */}
      <section
        aria-labelledby="buyer-heading"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
        }}
      >
        <h2
          id="buyer-heading"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#111827',
            marginBottom: '16px',
            marginTop: 0,
          }}
        >
          Buyer Universe Criteria
        </h2>
        {buyerCriteria ? (
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            <DetailRow label="Industry" value={buyerCriteria.industry ?? '—'} />
            <DetailRow label="Geography" value={buyerCriteria.geo ?? '—'} />
            <DetailRow label="Size Band" value={buyerCriteria.sizeBand ?? '—'} />
            <DetailRow label="Deal Type" value={buyerCriteria.dealType ?? '—'} />
          </dl>
        ) : (
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            No buyer criteria configured.
          </p>
        )}
      </section>

      {/* ── Compliance Profile ── */}
      <section
        aria-labelledby="compliance-heading"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
        }}
      >
        <h2
          id="compliance-heading"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#111827',
            marginBottom: '4px',
            marginTop: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {/* Shield icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Compliance Profile
        </h2>
        <p
          style={{
            fontSize: '12px',
            color: '#6B7280',
            marginBottom: '16px',
            marginTop: '4px',
          }}
        >
          Captured for the compliance gate — not enforced at this stage.
        </p>
        {complianceProfile ? (
          <dl style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <DetailRow label="Jurisdiction" value={complianceProfile.jurisdiction} />
            <DetailRow
              label="Disclaimer Template ID"
              value={
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {complianceProfile.disclaimerTemplateId}
                </span>
              }
            />
            <DetailRow
              label="Suppression Scope"
              value={
                complianceProfile.suppressionScope != null
                  ? String(complianceProfile.suppressionScope)
                  : '—'
              }
            />
            <div>
              <dt
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#6B7280',
                  marginBottom: '8px',
                }}
              >
                Acknowledgments
              </dt>
              <dd style={{ margin: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <AckDisplay
                    checked={complianceProfile.lawfulAuthorization}
                    label="Lawfully authorized by seller"
                  />
                  <AckDisplay
                    checked={complianceProfile.aiResultsValidated}
                    label="AI results must be validated before outreach"
                  />
                  <AckDisplay
                    checked={complianceProfile.conflictDbsReviewed}
                    label="Conflict databases reviewed"
                  />
                </div>
              </dd>
            </div>
          </dl>
        ) : (
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            No compliance profile configured.
          </p>
        )}
      </section>

      {/* ── D6: Deferred Placeholders ── */}
      {/* These are STABLE MOUNT POINTS for the M4 bundle. Do NOT remove. */}
      <section aria-labelledby="deferred-heading">
        <h2
          id="deferred-heading"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#6B7280',
            marginBottom: '12px',
            marginTop: 0,
          }}
        >
          AI Sourcing Canvas
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Wave-9 B-3: Buyer Engine placeholder replaced with a live CTA link.
              Links to /buyer-universe?mandateId=<id> — the assembled buyer universe for this mandate.
              Ranked Candidates + Pipeline remain deferred (M5/later). */}
          <section
            aria-label="Buyer Engine — open buyer universe"
            style={{
              border: '1px solid #D1FAE5',
              borderRadius: '8px',
              padding: '20px 24px',
              backgroundColor: '#ECFDF5',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#065F46',
                  marginBottom: '4px',
                }}
              >
                Buyer Engine
              </div>
              <div style={{ fontSize: '12px', color: '#047857' }}>
                Assemble, filter, enrich, and submit buyers to the match engine.
              </div>
            </div>
            <a
              href={`/buyer-universe?mandateId=${mandateId}`}
              aria-label="Open Buyer Universe for this mandate"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#FFFFFF',
                backgroundColor: '#10B981',
                border: 'none',
                borderRadius: '6px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Open Buyer Universe
            </a>
          </section>
          <DeferredPlaceholder
            title="Ranked Candidates"
            description="Ranked AI-matched buyer candidates will appear here in a later step."
          />
          <DeferredPlaceholder
            title="Pipeline"
            description="The deal pipeline view will appear here in a later step."
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acknowledgment display (read-only, for compliance profile)
// ---------------------------------------------------------------------------

function AckDisplay({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        role="img"
        aria-label={checked ? 'Acknowledged' : 'Not acknowledged'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          backgroundColor: checked ? '#10B981' : '#F3F4F6',
          border: `1px solid ${checked ? '#10B981' : '#D1D5DB'}`,
          flexShrink: 0,
          color: '#FFFFFF',
          fontSize: '10px',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ fontSize: '13px', color: '#374151' }}>{label}</span>
    </div>
  );
}
