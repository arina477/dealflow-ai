/**
 * RecordsPanel — scope toggle + conditional table rendering.
 *
 * Wave-29 B-3: client component that owns the active scope state.
 * Renders ScopeToggle + the active table (AuditLogTable or DealActivityTable).
 *
 * RBAC gating:
 *   - `canSeeDealActivity` is resolved server-side in page.tsx by checking
 *     whether the user's role is in ['compliance', 'admin']. It is passed
 *     as a boolean prop — no RBAC logic runs client-side.
 *   - When `canSeeDealActivity` is false (advisor), only the "Audit log" tab
 *     is shown; the "Deal activity" tab and DealActivityTable are never mounted.
 *   - The scope toggle itself enforces this: ScopeToggle renders the deal tab
 *     only when `canSeeDealActivity` is true. Even if activeScope were 'deal'
 *     (impossible from the initial 'audit' default), the DealActivityTable
 *     branch below also requires `canSeeDealActivity`.
 *
 * READ-ONLY: no mutation control in either table view.
 */

'use client';

import type { AuditLogEntryRead, DealActivityRow } from '@dealflow/shared';
import { useState } from 'react';
import { AuditLogTable } from './AuditLogTable';
import { DealActivityTable } from './DealActivityTable';
import type { AuditScope } from './ScopeToggle';
import { ScopeToggle } from './ScopeToggle';

export interface RecordsPanelProps {
  /** SSR-hydrated audit log entries (first page). */
  initialEntries: AuditLogEntryRead[];
  /** SSR-hydrated deal activity rows (first page). */
  initialDealRows: DealActivityRow[];
  /** Total deal activity rows matching empty filter. */
  initialDealTotal: number;
  /** True for compliance/admin; false for advisor (no deal-activity access). */
  canSeeDealActivity: boolean;
  /** Deep-link params forwarded from the page URL. */
  initialFrom?: string | undefined;
  initialTo?: string | undefined;
  initialMandateId?: string | undefined;
}

export function RecordsPanel({
  initialEntries,
  initialDealRows,
  initialDealTotal,
  canSeeDealActivity,
  initialFrom,
  initialTo,
  initialMandateId,
}: RecordsPanelProps) {
  const [activeScope, setActiveScope] = useState<AuditScope>('audit');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Scope toggle — deal tab hidden for advisor (canSeeDealActivity=false) */}
      <ScopeToggle
        activeScope={activeScope}
        onScopeChange={setActiveScope}
        canSeeDealActivity={canSeeDealActivity}
      />

      {/* Active table — always 'audit' for advisor; toggleable for compliance/admin */}
      <div style={{ marginTop: '16px' }}>
        {activeScope === 'audit' || !canSeeDealActivity ? (
          <AuditLogTable
            initialEntries={initialEntries}
            {...(initialFrom !== undefined && { initialFrom })}
            {...(initialTo !== undefined && { initialTo })}
            {...(initialMandateId !== undefined && { initialMandateId })}
          />
        ) : (
          <DealActivityTable
            initialRows={initialDealRows}
            initialTotal={initialDealTotal}
            {...(initialFrom !== undefined && { initialFrom })}
            {...(initialTo !== undefined && { initialTo })}
            {...(initialMandateId !== undefined && { initialMandateId })}
          />
        )}
      </div>
    </div>
  );
}
