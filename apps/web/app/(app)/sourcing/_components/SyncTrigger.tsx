/**
 * SyncTrigger — per-connection "Sync now" button.
 *
 * Calls the EXISTING wave-6 POST /sourcing/connections/:id/sync (reuse).
 * On success: shows a SyncSummary ({ingested, updated}) and notifies parent
 * to refresh the results.
 *
 * Design: design/sourcing-workspace.html header "Sync Status" button pattern
 * (per-connection variant), §10 zinc/emerald tokens.
 *
 * Accessibility: loading state announced via aria-live, button labelled.
 */

'use client';

import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncSummaryData {
  ingested: number;
  updated: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SyncTriggerProps {
  connectionId: string;
  /** Called after a successful sync with the number of newly ingested records. */
  onSyncComplete: (ingested: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncTrigger({ connectionId, onSyncComplete }: SyncTriggerProps) {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState<SyncSummaryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSync = async () => {
    if (status === 'syncing') return;
    setStatus('syncing');
    setSummary(null);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/sourcing/connections/${connectionId}/sync`, {
        method: 'POST',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Sync failed (${res.status})`);
      }

      const data = (await res.json()) as { ingested?: number; updated?: number };
      const ingested = typeof data.ingested === 'number' ? data.ingested : 0;
      const updated = typeof data.updated === 'number' ? data.updated : 0;
      setSummary({ ingested, updated });
      setStatus('done');
      onSyncComplete(ingested);

      // Auto-reset to idle after 4 seconds
      setTimeout(() => {
        setStatus('idle');
        setSummary(null);
      }, 4000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Sync failed');
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 4000);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        aria-label={status === 'syncing' ? 'Syncing…' : 'Sync now'}
        aria-busy={status === 'syncing'}
        disabled={status === 'syncing'}
        onClick={() => void handleSync()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '4px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: status === 'error' ? '#b91c1c' : '#4b5563',
          fontSize: '11px',
          fontWeight: 500,
          cursor: status === 'syncing' ? 'not-allowed' : 'pointer',
          opacity: status === 'syncing' ? 0.7 : 1,
          transition: 'all 150ms ease',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgba(16,185,129,0.25)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(16,24,40,0.05)';
        }}
      >
        <SyncIcon spinning={status === 'syncing'} />
        {status === 'syncing' ? 'Syncing…' : 'Sync'}
      </button>

      {/* Inline feedback */}
      {status === 'done' && summary && (
        <span
          role="status"
          aria-live="polite"
          style={{
            fontSize: '11px',
            color: '#10b981',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          +{summary.ingested} ingested, {summary.updated} updated
        </span>
      )}

      {status === 'error' && errorMessage && (
        <span
          role="alert"
          aria-live="assertive"
          style={{
            fontSize: '11px',
            color: '#b91c1c',
            fontWeight: 500,
          }}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icon
// ---------------------------------------------------------------------------

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: spinning ? 'spin 0.7s linear infinite' : 'none' }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
