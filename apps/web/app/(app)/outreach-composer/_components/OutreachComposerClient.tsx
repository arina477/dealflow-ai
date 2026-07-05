'use client';

/**
 * OutreachComposerClient — Outreach Composer UI (wave-11 B-3, tasks e90a4a99 + 2601ba33).
 *
 * AC-STRIP (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance):
 *   NO "Send Immediate Campaign" button.
 *   NO "Schedule Send..." button.
 *   NO "hash written to WORM storage upon send" copy.
 *   NO "AI Drafting in Progress" / AI-draft modals.
 *   NO "AI Auto-Draft Missing Fields".
 *   NO "AI-powered", "generated" (as capability), "AI" framing for any feature.
 *
 *   This component produces a SEND-ELIGIBLE record, NOT an actual send.
 *   The gate verdict (send_eligible | blocked) is surfaced honestly.
 *   The actual send is a later bundle.
 *
 * Mutations use /outreach-data proxy (non-page-colliding):
 *   POST /outreach-data → POST /outreach (compose → gate → send_eligible|blocked)
 *
 * RBAC: advisor only (compose).
 *
 * @see design/outreach-composer.html (LAYOUT reference — send/AI/WORM affordances STRIPPED)
 */

import type { GateVerdictRecord, Outreach, OutreachStatus, Role } from '@dealflow/shared';
import { gateVerdictRecordSchema, outreachSchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type {
  ComposerInitialData,
  DisclaimerForComposer,
  MandateRow,
  MatchCandidate,
  TemplateVersionWithName,
} from '../page';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OutreachComposerClientProps {
  initialData: ComposerInitialData;
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Gate verdict display
// ---------------------------------------------------------------------------

interface GateVerdictDisplayProps {
  verdict: GateVerdictRecord;
  status: OutreachStatus;
  outreachId: string;
}

function GateVerdictDisplay({ verdict, status, outreachId }: GateVerdictDisplayProps) {
  const isSendEligible = verdict.allowed && status === 'send_eligible';

  return (
    <section
      aria-label="Gate verdict"
      style={{
        border: `1px solid ${isSendEligible ? '#A7F3D0' : '#FECACA'}`,
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
    >
      {/* Status header */}
      <div
        style={{
          padding: '14px 16px',
          backgroundColor: isSendEligible ? '#ECFDF5' : '#FEF2F2',
          borderBottom: `1px solid ${isSendEligible ? '#A7F3D0' : '#FECACA'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: isSendEligible ? '#D1FAE5' : '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isSendEligible ? '#047857' : '#B91C1C'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isSendEligible ? (
              <path d="M20 6L9 17l-5-5" />
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            )}
          </svg>
        </div>
        <div>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: isSendEligible ? '#047857' : '#B91C1C',
              margin: 0,
            }}
          >
            {isSendEligible ? 'Send-eligible record created' : 'Outreach blocked'}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: isSendEligible ? '#065F46' : '#7F1D1D',
              margin: '2px 0 0',
            }}
          >
            {isSendEligible
              ? 'This outreach passed all pre-send compliance checks. Actual send is a later step.'
              : 'This outreach did not pass all pre-send compliance checks. Resolve blocks below.'}
          </p>
        </div>
      </div>

      {/* Outreach record ID */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: '#9CA3AF',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Record ID
        </span>
        <code style={{ fontSize: '11px', color: '#374151', fontFamily: 'monospace' }}>
          {outreachId}
        </code>
      </div>

      {/* Compliance check results */}
      <div style={{ padding: '16px' }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
          }}
        >
          Pre-send Compliance Gate Results
        </p>

        {/* Block reasons */}
        {verdict.blocks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {verdict.blocks.map((block, i) => {
              const rule = typeof block.rule === 'string' ? block.rule : `block-${i}`;
              const reason =
                typeof block.reason === 'string'
                  ? block.reason
                  : typeof block.message === 'string'
                    ? block.message
                    : JSON.stringify(block);
              return (
                <div
                  key={rule}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B91C1C"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: '1px' }}
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#B91C1C', margin: 0 }}>
                      {rule}
                    </p>
                    <p style={{ fontSize: '12px', color: '#7F1D1D', margin: '2px 0 0' }}>
                      {reason}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '6px',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#047857"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span style={{ fontSize: '12px', color: '#047857', fontWeight: 500 }}>
              All compliance checks passed
            </span>
          </div>
        )}

        {/* Required disclaimers */}
        {verdict.requiredDisclaimers.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px',
              }}
            >
              Required Disclaimers Verified
            </p>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {verdict.requiredDisclaimers.map((d) => (
                <li key={d} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Important: send-eligible is NOT a send */}
        {isSendEligible && (
          <div
            role="note"
            aria-label="Send-eligible notice"
            style={{
              marginTop: '16px',
              padding: '10px 12px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#6B7280',
            }}
          >
            <strong style={{ color: '#374151' }}>Note:</strong> A send-eligible record has been
            created and logged. The actual delivery to the recipient is a separate step, available
            in a later release. No email has been sent.
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Composer form
// ---------------------------------------------------------------------------

interface ComposerFormProps {
  approvedVersions: TemplateVersionWithName[];
  acceptedCandidates: MatchCandidate[];
  disclaimers: DisclaimerForComposer[];
  mandates: MandateRow[];
  onResult: (outreach: Outreach, verdict: GateVerdictRecord) => void;
}

function ComposerForm({
  approvedVersions,
  acceptedCandidates,
  disclaimers,
  mandates,
  onResult,
}: ComposerFormProps) {
  const [mandateId, setMandateId] = useState(mandates[0]?.id ?? '');
  const [matchCandidateId, setMatchCandidateId] = useState(acceptedCandidates[0]?.id ?? '');
  const [templateVersionId, setTemplateVersionId] = useState(approvedVersions[0]?.id ?? '');
  const [recipients, setRecipients] = useState('');
  const [jurisdiction, setJurisdiction] = useState(disclaimers[0]?.jurisdiction ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCompose(e: React.FormEvent) {
    e.preventDefault();
    const recipientList = recipients
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    if (!mandateId) {
      setError('Select a mandate.');
      return;
    }
    if (!matchCandidateId) {
      setError('Select a shortlisted buyer candidate.');
      return;
    }
    if (!templateVersionId) {
      setError('Select an approved template version.');
      return;
    }
    if (recipientList.length === 0) {
      setError('At least one recipient email is required.');
      return;
    }
    if (!jurisdiction) {
      setError('Select a jurisdiction.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/outreach-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandateId,
          matchCandidateId,
          templateVersionId,
          recipients: recipientList,
          jurisdiction,
        }),
      });

      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const detail =
          raw !== null && typeof raw === 'object' && 'message' in raw
            ? String((raw as { message: unknown }).message)
            : `Error ${res.status}`;
        setError(detail);
        return;
      }

      // Parse the outreach record
      const parsed = outreachSchema.safeParse(raw);
      if (!parsed.success) {
        // Also handle { outreach: {...} } wrapper
        const wrappedParsed =
          raw !== null && typeof raw === 'object' && 'outreach' in raw
            ? outreachSchema.safeParse((raw as { outreach: unknown }).outreach)
            : null;
        if (wrappedParsed?.success) {
          const verdictParsed = gateVerdictRecordSchema.safeParse(wrappedParsed.data.gateVerdict);
          if (verdictParsed.success) {
            onResult(wrappedParsed.data, verdictParsed.data);
            return;
          }
        }
        setError('Unexpected response from server — please refresh and try again.');
        return;
      }

      const verdictParsed = gateVerdictRecordSchema.safeParse(parsed.data.gateVerdict);
      if (!verdictParsed.success) {
        setError('Unexpected gate verdict shape — please refresh.');
        return;
      }
      onResult(parsed.data, verdictParsed.data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const hasApprovedVersions = approvedVersions.length > 0;
  const hasAcceptedCandidates = acceptedCandidates.length > 0;
  const hasMandates = mandates.length > 0;

  return (
    <form onSubmit={handleCompose} aria-label="Outreach compose form">
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#B91C1C',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Prerequisite warnings */}
      {(!hasApprovedVersions || !hasAcceptedCandidates || !hasMandates) && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            borderRadius: '6px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#B45309',
            marginBottom: '16px',
          }}
        >
          <strong>Prerequisites missing:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
            {!hasMandates && <li>No active mandates found.</li>}
            {!hasAcceptedCandidates && (
              <li>
                No accepted match candidates found. Accept candidates from the Matches page first.
              </li>
            )}
            {!hasApprovedVersions && (
              <li>
                No approved template versions available. Create a template and get compliance
                approval via the Templates Library and Compliance Queue.
              </li>
            )}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Mandate selector */}
        <div>
          <label
            htmlFor="oc-mandate"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Mandate *
          </label>
          <select
            id="oc-mandate"
            value={mandateId}
            onChange={(e) => setMandateId(e.target.value)}
            disabled={!hasMandates}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: hasMandates ? '#fff' : '#F9FAFB',
            }}
          >
            {hasMandates ? (
              mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.sellerName}
                </option>
              ))
            ) : (
              <option value="">No mandates available</option>
            )}
          </select>
        </div>

        {/* Candidate selector */}
        <div>
          <label
            htmlFor="oc-candidate"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Shortlisted Buyer *
          </label>
          <select
            id="oc-candidate"
            value={matchCandidateId}
            onChange={(e) => setMatchCandidateId(e.target.value)}
            disabled={!hasAcceptedCandidates}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: hasAcceptedCandidates ? '#fff' : '#F9FAFB',
            }}
          >
            {hasAcceptedCandidates ? (
              acceptedCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  Candidate {c.id.slice(0, 8)}… (Score: {c.fitScore})
                </option>
              ))
            ) : (
              <option value="">No accepted candidates</option>
            )}
          </select>
        </div>

        {/* Template version selector */}
        <div>
          <label
            htmlFor="oc-version"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Approved Template Version *
          </label>
          <select
            id="oc-version"
            value={templateVersionId}
            onChange={(e) => setTemplateVersionId(e.target.value)}
            disabled={!hasApprovedVersions}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: hasApprovedVersions ? '#fff' : '#F9FAFB',
            }}
          >
            {hasApprovedVersions ? (
              approvedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.templateName ? `${v.templateName} — ` : ''}v{v.versionNumber} (Approved,
                  send-eligible)
                </option>
              ))
            ) : (
              <option value="">No approved versions available</option>
            )}
          </select>
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Only compliance-approved, version-binding-verified versions are listed.
          </p>
        </div>

        {/* Recipients */}
        <div>
          <label
            htmlFor="oc-recipients"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Recipient Email(s) *
          </label>
          <input
            id="oc-recipients"
            type="text"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="buyer@firm.com, partner@fund.com"
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Comma-separated. Checked against the firm suppression list by the gate.
          </p>
        </div>

        {/* Jurisdiction */}
        <div>
          <label
            htmlFor="oc-jurisdiction"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Jurisdiction *
          </label>
          <select
            id="oc-jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            {disclaimers.length > 0 ? (
              disclaimers.map((d) => (
                <option key={d.id} value={d.jurisdiction}>
                  {d.jurisdiction}
                </option>
              ))
            ) : (
              <option value="">No jurisdictions configured</option>
            )}
          </select>
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Used to verify the required disclaimer block is present in the template.
          </p>
        </div>
      </div>

      {/* Pre-send compliance gate explanation */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px 14px',
          backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
        }}
      >
        <h3
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#374151',
            margin: '0 0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Pre-Send Compliance Gate (non-bypassable)
        </h3>
        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#6B7280' }}>
          <li>Version-binding check: approved version must match approved hash</li>
          <li>Separation of duties: you must not be the version approver</li>
          <li>Suppression list: recipients checked against firm blocklist</li>
          <li>Required disclaimer: jurisdiction-appropriate block must be present</li>
        </ul>
      </div>

      {/* Submit — produces send-eligible record, NOT an actual send (AC-STRIP) */}
      <div style={{ marginTop: '20px' }}>
        <button
          type="submit"
          disabled={submitting || !hasApprovedVersions || !hasAcceptedCandidates || !hasMandates}
          style={{
            width: '100%',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor:
              submitting || !hasApprovedVersions || !hasAcceptedCandidates || !hasMandates
                ? '#9CA3AF'
                : '#10B981',
            border: 'none',
            borderRadius: '6px',
            cursor:
              submitting || !hasApprovedVersions || !hasAcceptedCandidates || !hasMandates
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {submitting ? 'Running compliance gate…' : 'Run Compliance Gate & Create Record'}
        </button>
        <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', marginTop: '6px' }}>
          This creates a send-eligible outreach record. Email delivery is available in a later step.
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function OutreachComposerClient({
  initialData,
  userRole: _userRole,
}: OutreachComposerClientProps) {
  const [result, setResult] = useState<{
    outreach: Outreach;
    verdict: GateVerdictRecord;
  } | null>(null);

  function handleResult(outreach: Outreach, verdict: GateVerdictRecord) {
    setResult({ outreach, verdict });
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#6B7280',
            marginBottom: '4px',
          }}
          aria-label="Breadcrumb"
        >
          <a href="/outreach-templates" style={{ color: '#6B7280', textDecoration: 'none' }}>
            Templates
          </a>
          <span>/</span>
          <span>Compose</span>
        </nav>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Outreach Composer
        </h1>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
          Select an approved template and shortlisted buyer, then run the compliance gate to create
          a send-eligible record. The actual email delivery is a separate step.
        </p>
      </div>

      {/* Gate result (after compose) */}
      {result ? (
        <div>
          <GateVerdictDisplay
            verdict={result.verdict}
            status={result.outreach.status}
            outreachId={result.outreach.id}
          />
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setResult(null)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#fff',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Compose Another
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <ComposerForm
            approvedVersions={initialData.approvedVersions}
            acceptedCandidates={initialData.acceptedCandidates}
            disclaimers={initialData.disclaimers}
            mandates={initialData.mandates}
            onResult={handleResult}
          />
        </div>
      )}
    </div>
  );
}
