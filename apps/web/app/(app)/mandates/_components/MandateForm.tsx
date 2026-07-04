/**
 * MandateForm — client component for POST /mandates (create mandate).
 *
 * Three-section progressive form per design/mandate-new.html:
 *   §1  Seller & Target Profile (name, industry, regions D3, size D3, deal-type, description)
 *   §2  Buyer Universe Criteria (industry, geo, size-band, deal-type — core-4; NO speculative DSL)
 *   §3  Compliance Guardrails (jurisdiction dropdown D2; suppression text/tags D4; 3 acks D5)
 *
 * D2: jurisdiction dropdown only — disclaimer_template_id is DERIVED server-side.
 *     No separate disclaimer picker. Copy frames compliance as CAPTURED-not-enforced.
 * D3: seller geo (regions tag input) + seller size band (radio buttons).
 * D4: suppression = comma-separated text input (NOT a CSV dropzone — deferred).
 * D5: 3 required acknowledgment checkboxes (mandateCreateSchema enforces z.literal(true)).
 *
 * On submit: validates with mandateCreateSchema, calls apiFetch POST /mandates
 * (rid:'anti-csrf' — wave-5), on 201 redirects to the created mandate's detail page.
 */
'use client';

import { mandateCreateSchema } from '@dealflow/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  { value: '', label: 'Select primary sector…' },
  { value: 'enterprise-software', label: 'Enterprise Software / SaaS' },
  { value: 'manufacturing', label: 'Advanced Manufacturing' },
  { value: 'healthcare', label: 'Healthcare Services' },
  { value: 'fintech', label: 'Financial Technology' },
  { value: 'b2b-services', label: 'B2B Professional Services' },
  { value: 'industrials', label: 'Industrials / Distribution' },
  { value: 'consumer', label: 'Consumer / Retail' },
  { value: 'real-estate', label: 'Real Estate / Property' },
  { value: 'media', label: 'Media / Content' },
  { value: 'other', label: 'Other' },
];

const DEAL_TYPES = [
  { value: '', label: 'Select deal type…' },
  { value: 'acquisition', label: 'Full Acquisition' },
  { value: 'majority-stake', label: 'Majority Stake' },
  { value: 'minority-stake', label: 'Minority Stake' },
  { value: 'merger', label: 'Merger' },
  { value: 'asset-sale', label: 'Asset Sale' },
];

const SIZE_BANDS = [
  { value: 'micro', label: '< $10M' },
  { value: 'small', label: '$10M–$50M' },
  { value: 'mid', label: '$50M–$250M' },
  { value: 'large', label: '$250M–$1B' },
  { value: 'mega', label: '$1B+' },
];

// JURISDICTIONS is no longer a hardcoded constant — the dropdown is populated
// from the `availableJurisdictions` prop (SSR-fetched active disclaimer templates).
// This ensures only jurisdictions with an active disclaimer template are selectable,
// preventing derive-no-match 400s on create (CRITICAL-2 fix).

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#1F2937',
  boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '6px',
};

const requiredMark = (
  <span style={{ color: '#DC2626', marginLeft: '2px' }} aria-hidden="true">
    *
  </span>
);

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function SectionCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#F3F4F6',
            color: '#6B7280',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {number}
        </div>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag input (D3 regions, D4 suppression)
// ---------------------------------------------------------------------------

function TagInput({
  id,
  label,
  tags,
  placeholder,
  onTagsChange,
  required,
  hint,
}: {
  id: string;
  label: string;
  tags: string[];
  placeholder: string;
  onTagsChange: (tags: string[]) => void;
  required?: boolean;
  hint?: string;
}) {
  const [inputVal, setInputVal] = useState('');

  function addTag(raw: string) {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (parts.length > 0) onTagsChange([...tags, ...parts]);
    setInputVal('');
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag));
  }

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && requiredMark}
      </label>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus affordance on the tag container; real input below receives all keyboard events */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by the <input> inside this container; div click only focuses the input */}
      <div
        style={{
          ...inputStyle,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          minHeight: '40px',
          cursor: 'text',
          padding: '6px 10px',
        }}
        onClick={() => document.getElementById(id)?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#F3F4F6',
              border: '1px solid #E5E7EB',
              borderRadius: '9999px',
              padding: '1px 8px',
              fontSize: '12px',
              color: '#374151',
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              aria-label={`Remove ${tag}`}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 0 0 2px',
                cursor: 'pointer',
                color: '#6B7280',
                fontSize: '12px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputVal}
          placeholder={tags.length === 0 ? placeholder : 'Add more…'}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(inputVal);
            } else if (e.key === 'Backspace' && inputVal === '' && tags.length > 0) {
              onTagsChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (inputVal.trim()) addTag(inputVal);
          }}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '13px',
            color: '#1F2937',
            flex: 1,
            minWidth: '120px',
          }}
          aria-required={required}
        />
      </div>
      {hint && <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form state type
// ---------------------------------------------------------------------------

interface FormState {
  // §1 Seller & Target Profile
  sellerName: string;
  sellerIndustry: string;
  sellerGeo: string[]; // D3 — multi-region tags
  sellerSizeBand: string; // D3 — radio selection
  dealType: string;
  description: string;

  // §2 Buyer Universe Criteria (core-4)
  buyerIndustry: string;
  buyerGeo: string;
  buyerSizeBand: string;
  buyerDealType: string;

  // §3 Compliance Guardrails
  jurisdiction: string; // D2 — dropdown only; disclaimer derived server-side
  suppressionText: string[]; // D4 — text/tags (NOT CSV dropzone)
  lawful_authorization: boolean; // D5 — ack 1
  ai_results_validated: boolean; // D5 — ack 2
  conflict_dbs_reviewed: boolean; // D5 — ack 3
}

const INITIAL_STATE: FormState = {
  sellerName: '',
  sellerIndustry: '',
  sellerGeo: [],
  sellerSizeBand: '',
  dealType: '',
  description: '',
  buyerIndustry: '',
  buyerGeo: '',
  buyerSizeBand: '',
  buyerDealType: '',
  jurisdiction: '',
  suppressionText: [],
  lawful_authorization: false,
  ai_results_validated: false,
  conflict_dbs_reviewed: false,
};

// ---------------------------------------------------------------------------
// MandateForm component
// ---------------------------------------------------------------------------

/**
 * A jurisdiction value + display label from an active disclaimer template.
 * Populated by the server component (SSR-fetched); never hardcoded here.
 */
export interface AvailableJurisdiction {
  value: string;
  label: string;
}

export function MandateForm({
  availableJurisdictions,
}: {
  availableJurisdictions: AvailableJurisdiction[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string[] {
    const msgs: string[] = [];
    if (!form.sellerName.trim()) msgs.push('Seller company name is required.');
    if (!form.jurisdiction) msgs.push('Legal jurisdiction is required.');
    if (!form.lawful_authorization)
      msgs.push('Attestation required: lawfully authorized by the seller.');
    if (!form.ai_results_validated)
      msgs.push('Attestation required: AI results must be validated before outreach.');
    if (!form.conflict_dbs_reviewed)
      msgs.push('Attestation required: conflict databases must be reviewed.');
    return msgs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const clientErrors = validate();
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }
    setErrors([]);

    // Build the mandateCreateSchema-compatible payload.
    // All 3 acks must be literal true (D5) — schema enforcement.
    if (!form.lawful_authorization || !form.ai_results_validated || !form.conflict_dbs_reviewed) {
      setErrors(['All three compliance acknowledgments are required.']);
      return;
    }

    const payload = {
      sellerName: form.sellerName.trim(),
      ...(form.sellerIndustry ? { sellerIndustry: form.sellerIndustry } : {}),
      ...(form.sellerGeo.length > 0 ? { sellerGeo: form.sellerGeo } : {}),
      ...(form.sellerSizeBand ? { sellerSizeBand: form.sellerSizeBand } : {}),
      ...(form.dealType ? { dealType: form.dealType } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      buyerCriteria: {
        ...(form.buyerIndustry ? { industry: form.buyerIndustry } : {}),
        ...(form.buyerGeo ? { geo: form.buyerGeo } : {}),
        ...(form.buyerSizeBand ? { sizeBand: form.buyerSizeBand } : {}),
        ...(form.buyerDealType ? { dealType: form.buyerDealType } : {}),
      },
      compliance: {
        jurisdiction: form.jurisdiction,
        ...(form.suppressionText.length > 0
          ? { suppressionScope: form.suppressionText.join(', ') }
          : {}),
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: true as const,
        },
      },
    };

    // Client-side schema validation (belt-and-suspenders before the POST).
    const parsed = mandateCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const msgs = parsed.error.errors.map((e) => e.message);
      setErrors(msgs);
      return;
    }

    setSubmitting(true);
    try {
      // POST to /mandates-data — the non-colliding proxy path (CRITICAL-1 fix).
      // /mandates-data (no page file) → afterFiles rewrite → POST /mandates on API.
      // The old /mandates path is a Next.js page route and cannot be used for mutations.
      const res = await apiFetch('/mandates-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 201) {
        const json: unknown = await res.json();
        // The API returns { mandate: Mandate }
        const created = json as { mandate?: { id?: string } };
        const id = created?.mandate?.id;
        if (id) {
          router.push(`/mandates/${id}`);
          return;
        }
      }

      // Non-201 or unexpected shape
      let errMsg = 'Failed to create mandate.';
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) errMsg = body.message;
      } catch {
        // ignore
      }
      setSubmitError(errMsg);
    } catch {
      setSubmitError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Create mandate form">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
          maxWidth: '800px',
        }}
      >
        {/* Global error summary */}
        {(errors.length > 0 || submitError) && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div
              style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', marginBottom: '8px' }}
            >
              Please fix the following errors:
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {submitError && (
                <li style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '4px' }}>
                  {submitError}
                </li>
              )}
              {errors.map((err) => (
                <li key={err} style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '4px' }}>
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── §1: Seller & Target Profile ── */}
        <SectionCard number={1} title="Seller & Target Profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Company name */}
              <div>
                <label htmlFor="seller-name" style={labelStyle}>
                  Company Name {requiredMark}
                </label>
                <input
                  id="seller-name"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="e.g. Acme Manufacturing Inc."
                  value={form.sellerName}
                  onChange={(e) => setField('sellerName', e.target.value)}
                  style={inputStyle}
                  aria-required="true"
                />
              </div>

              {/* Industry / Sector */}
              <div>
                <label htmlFor="seller-industry" style={labelStyle}>
                  Industry / Sector
                </label>
                <select
                  id="seller-industry"
                  value={form.sellerIndustry}
                  onChange={(e) => setField('sellerIndustry', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  {INDUSTRIES.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* D3 — Seller Regions (multi-tag input) */}
            <TagInput
              id="seller-geo"
              label="Seller Geography / Regions"
              tags={form.sellerGeo}
              placeholder="Type a region and press Enter (e.g. North America)"
              onTagsChange={(tags) => setField('sellerGeo', tags)}
              hint="Press Enter or comma to add a region. Multiple regions accepted."
            />

            {/* D3 — Company Size Band (radio) */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Company Size (Revenue)</legend>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                }}
              >
                {SIZE_BANDS.map((band) => (
                  <label
                    key={band.value}
                    style={{
                      cursor: 'pointer',
                      display: 'block',
                      position: 'relative',
                    }}
                  >
                    <input
                      type="radio"
                      name="seller-size-band"
                      value={band.value}
                      checked={form.sellerSizeBand === band.value}
                      onChange={() => setField('sellerSizeBand', band.value)}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 0,
                        height: 0,
                      }}
                    />
                    <div
                      style={{
                        border: `1px solid ${form.sellerSizeBand === band.value ? '#10B981' : '#E5E7EB'}`,
                        borderRadius: '6px',
                        backgroundColor: form.sellerSizeBand === band.value ? '#ECFDF5' : '#FFFFFF',
                        padding: '6px 4px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: form.sellerSizeBand === band.value ? '#047857' : '#4B5563',
                        transition: 'all 150ms ease',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {band.label}
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Deal Type */}
            <div>
              <label htmlFor="deal-type" style={labelStyle}>
                Deal Type
              </label>
              <select
                id="deal-type"
                value={form.dealType}
                onChange={(e) => setField('dealType', e.target.value)}
                style={{ ...inputStyle, maxWidth: '320px', appearance: 'none' }}
              >
                {DEAL_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" style={labelStyle}>
                Executive Snippet
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="Family-owned, profitable, seeking liquidity. Strong margins, recurring revenue…"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── §2: Buyer Universe Criteria ── */}
        <SectionCard number={2} title="Buyer Universe Criteria">
          <p
            style={{
              fontSize: '12px',
              color: '#6B7280',
              marginBottom: '16px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '10px 12px',
            }}
          >
            Specify the characteristics of the ideal buyer universe. All fields are optional — leave
            blank to apply no restriction on that dimension.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label htmlFor="buyer-industry" style={labelStyle}>
                Buyer Industry / Sector
              </label>
              <select
                id="buyer-industry"
                value={form.buyerIndustry}
                onChange={(e) => setField('buyerIndustry', e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                {INDUSTRIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === '' ? 'Any industry' : opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="buyer-geo" style={labelStyle}>
                Buyer Geography
              </label>
              <input
                id="buyer-geo"
                type="text"
                placeholder="e.g. North America, Europe"
                value={form.buyerGeo}
                onChange={(e) => setField('buyerGeo', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="buyer-size-band" style={labelStyle}>
                Buyer Size Band
              </label>
              <select
                id="buyer-size-band"
                value={form.buyerSizeBand}
                onChange={(e) => setField('buyerSizeBand', e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="">Any size</option>
                {SIZE_BANDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="buyer-deal-type" style={labelStyle}>
                Buyer Deal Type
              </label>
              <select
                id="buyer-deal-type"
                value={form.buyerDealType}
                onChange={(e) => setField('buyerDealType', e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                {DEAL_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === '' ? 'Any deal type' : opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {/* ── §3: Compliance Guardrails ── */}
        <SectionCard number={3} title="Compliance Guardrails">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Captured-not-enforced notice (D2 compliance framing) */}
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '6px',
                padding: '12px 14px',
              }}
              role="note"
            >
              <div
                style={{ fontSize: '12px', fontWeight: 600, color: '#92400E', marginBottom: '4px' }}
              >
                Compliance information captured here
              </div>
              <p style={{ fontSize: '12px', color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                The following details are captured now to prepare for the compliance gate. They are{' '}
                <strong>not enforced at this step</strong> — a separate compliance review is
                required before any outreach can be authorized.
              </p>
            </div>

            {/* D2 — Legal Jurisdiction dropdown (NO disclaimer picker).
                Populated from availableJurisdictions prop (SSR-fetched active
                disclaimer templates — CRITICAL-2 fix). Only jurisdictions with an
                active template are offered; if none are configured, an empty state
                is shown and the form cannot be submitted. */}
            <div>
              <label htmlFor="jurisdiction" style={labelStyle}>
                Legal Jurisdiction {requiredMark}
              </label>
              {availableJurisdictions.length === 0 ? (
                <div
                  role="alert"
                  aria-label="No compliance jurisdictions configured"
                  style={{
                    backgroundColor: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    maxWidth: '480px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#92400E',
                      marginBottom: '4px',
                    }}
                  >
                    No compliance jurisdictions configured
                  </div>
                  <p style={{ fontSize: '12px', color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                    An admin must add an active disclaimer template before a mandate can be created.
                    Contact your compliance administrator.
                  </p>
                </div>
              ) : (
                <select
                  id="jurisdiction"
                  required
                  value={form.jurisdiction}
                  onChange={(e) => setField('jurisdiction', e.target.value)}
                  style={{ ...inputStyle, maxWidth: '320px', appearance: 'none' }}
                  aria-required="true"
                  aria-describedby="jurisdiction-hint"
                >
                  <option value="" disabled>
                    Select jurisdiction…
                  </option>
                  {availableJurisdictions.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
              )}
              <p
                id="jurisdiction-hint"
                style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}
              >
                Determines the disclaimer format applied to NDA distributions. The disclaimer
                template is resolved automatically from the selected jurisdiction.
              </p>
            </div>

            {/* D4 — Suppression / Conflict Blocking (text/tags, NOT CSV dropzone) */}
            <TagInput
              id="suppression-scope"
              label="Suppression List / Conflict Blocking"
              tags={form.suppressionText}
              placeholder="Type a company name and press Enter"
              onTagsChange={(tags) => setField('suppressionText', tags)}
              hint="Enter company names to suppress from buyer matching. Press Enter or comma after each entry. (CSV upload deferred — enter names manually.)"
            />

            {/* D5 — 3 required acknowledgment checkboxes */}
            <fieldset
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '16px',
                margin: 0,
                backgroundColor: '#F9FAFB',
              }}
            >
              <legend
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#4B5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0 4px',
                }}
              >
                Required Acknowledgments
              </legend>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}
              >
                <AckCheckbox
                  id="ack-lawful"
                  checked={form.lawful_authorization}
                  onChange={(v) => setField('lawful_authorization', v)}
                  label="I confirm this engagement is lawfully authorized by the seller."
                />
                <AckCheckbox
                  id="ack-ai"
                  checked={form.ai_results_validated}
                  onChange={(v) => setField('ai_results_validated', v)}
                  label="I understand that buyer-matching results are AI-generated and must be independently validated before any outreach is initiated."
                />
                <AckCheckbox
                  id="ack-conflict"
                  checked={form.conflict_dbs_reviewed}
                  onChange={(v) => setField('conflict_dbs_reviewed', v)}
                  label="I have reviewed relevant conflict databases and entered any necessary suppression entries above."
                />
              </div>
            </fieldset>
          </div>
        </SectionCard>

        {/* ── Submit footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/mandates')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: submitting ? '#D1D5DB' : '#10B981',
              border: '1px solid transparent',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
              transition: 'background-color 150ms ease',
            }}
          >
            {submitting ? 'Creating…' : 'Create Mandate'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Acknowledgment checkbox (D5)
// ---------------------------------------------------------------------------

function AckCheckbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        cursor: 'pointer',
      }}
    >
      <div style={{ paddingTop: '1px', flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          required
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          style={{
            width: '16px',
            height: '16px',
            accentColor: '#10B981',
            cursor: 'pointer',
          }}
        />
      </div>
      <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}
