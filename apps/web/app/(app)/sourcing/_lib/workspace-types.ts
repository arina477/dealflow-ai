/**
 * Shared type definitions and fetch utilities for the sourcing workspace.
 * Extracted from page.tsx to avoid Next.js "only export config + default"
 * constraint at the page segment boundary.
 */

import type { DataSourceConnectionRecord } from '@dealflow/shared';
import { dataSourceConnectionSchema } from '@dealflow/shared';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export interface ConnectionWithCount extends DataSourceConnectionRecord {
  companyCount: number;
}

const connectionWithCountSchema = dataSourceConnectionSchema
  .extend({
    companyCount: z.number().int().nonnegative().optional().default(0),
  })
  // Override createdAt: the shared schema uses z.string().datetime() which rejects
  // PG-wire format ("2026-07-04 04:30:08.014852+00"). Accept any string here;
  // the workspace displays but does not parse this value.
  .extend({
    createdAt: z.string(),
  });

const connectionsResponseSchema = z.object({
  connections: z.array(connectionWithCountSchema),
});

export async function fetchConnections(
  apiBase: string,
  cookie: string
): Promise<ConnectionWithCount[]> {
  try {
    const res = await fetch(`${apiBase}/sourcing/connections`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = connectionsResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.connections : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Companies (workspace shape)
// ---------------------------------------------------------------------------

export interface WorkspaceCompany {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  status: string;
  /** Connection IDs this company is sourced from (for badge rendering). */
  connectionIds: string[];
  createdAt: string;
}

const workspaceCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  domain: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  status: z.string().min(1),
  connectionIds: z.array(z.string()).optional().default([]),
  // Accept any string timestamp — the API returns PG-wire format
  // ("2026-07-04 04:30:08.014852+00", SPACE separator, +00 offset, microseconds)
  // which is NOT ISO-8601 and would be rejected by z.string().datetime().
  // The workspace only displays this value; strict ISO validation is not needed.
  createdAt: z.string(),
});

const workspaceCompaniesResponseSchema = z.object({
  companies: z.array(workspaceCompanySchema),
});

export async function fetchWorkspaceCompanies(
  apiBase: string,
  cookie: string,
  params?: { q?: string; source?: string }
): Promise<WorkspaceCompany[]> {
  try {
    const url = new URL(`${apiBase}/sourcing/companies`);
    if (params?.q) url.searchParams.set('q', params.q);
    if (params?.source) url.searchParams.set('source', params.source);
    const res = await fetch(url.toString(), {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = workspaceCompaniesResponseSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data.companies.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain ?? null,
        sector: c.sector ?? null,
        status: c.status,
        connectionIds: c.connectionIds,
        createdAt: c.createdAt,
      }));
    }
    return [];
  } catch {
    return [];
  }
}
