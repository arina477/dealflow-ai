/**
 * AddConnectionForm — minimal "Add / connect a source" affordance (AC-SEED enabler).
 *
 * Enables the analyst to create ≥2 fixture connections so the ≥2-source view
 * is real (not empty). Calls POST /sourcing/connections with providerKey:'fixture'
 * and a displayName entered by the analyst.
 *
 * The real provider picker (adapter wave) is deferred — this is intentionally
 * minimal. Keep it simple.
 *
 * Accessibility: labeled form, error announcement, focus management.
 */

'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type { ConnectionWithCount } from '../_lib/workspace-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddConnectionFormProps {
  onCreated: (connection: ConnectionWithCount) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddConnectionForm({ onCreated }: AddConnectionFormProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setDisplayName('');
    // Focus input on next tick
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setDisplayName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError('Display name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/sourcing/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey: 'fixture',
          displayName: name,
          config: {},
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Failed to create connection (${res.status})`);
      }

      const data = (await res.json()) as {
        id?: string;
        providerKey?: string;
        displayName?: string;
        enabled?: boolean;
        config?: Record<string, unknown>;
        createdBy?: string | null;
        createdAt?: string;
      };

      const newConn: ConnectionWithCount = {
        id: data.id ?? crypto.randomUUID(),
        providerKey: data.providerKey ?? 'fixture',
        displayName: data.displayName ?? name,
        enabled: data.enabled ?? true,
        config: data.config ?? {},
        createdBy: data.createdBy ?? null,
        createdAt: data.createdAt ?? new Date().toISOString(),
        companyCount: 0,
      };

      onCreated(newConn);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Add a data source connection"
        onClick={handleOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '4px',
          border: '1px dashed #d1d5db',
          backgroundColor: 'transparent',
          color: '#6b7280',
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms ease',
          outline: 'none',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgba(16,185,129,0.25)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#10b981';
          (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
          (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
        }}
      >
        <PlusIcon />
        Add source
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add a new data source connection"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label="Connection display name"
        placeholder="e.g. Fixture Source B"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={80}
        style={{
          height: '30px',
          padding: '0 10px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          fontSize: '12px',
          color: '#111827',
          outline: 'none',
          width: '160px',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
          (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(16,185,129,0.15)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
          (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
      />

      <button
        type="submit"
        aria-label="Create connection"
        disabled={submitting}
        style={{
          height: '30px',
          padding: '0 10px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: '#10b981',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 500,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          transition: 'background-color 150ms ease',
          outline: 'none',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px rgba(16,185,129,0.3)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>

      <button
        type="button"
        aria-label="Cancel adding connection"
        onClick={handleClose}
        style={{
          height: '30px',
          padding: '0 8px',
          borderRadius: '4px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#6b7280',
          fontSize: '12px',
          cursor: 'pointer',
          outline: 'none',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgba(16,185,129,0.25)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        Cancel
      </button>

      {error && (
        <span
          role="alert"
          aria-live="assertive"
          style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 500 }}
        >
          {error}
        </span>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline icon
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
