/**
 * /outreach/activity — Outreach activity tracker panel (wave-20 B-3, task b2acf4ce).
 *
 * SSR-fetches GET /outreach-activity (advisor's workspace-scoped list, planned-first
 * ordering via the (workspace_id, status, due_at) index). The proxy rewrite in
 * next.config.ts maps /outreach-activity → GET /outreach-activity on the API
 * (afterFiles — no Next.js page exists at /outreach-activity, so it always
 * falls through to the proxy).
 *
 * Also SSR-fetches GET /mandates (mandate list) to populate the optional
 * 0-or-1 deal-target link dropdown in the create form. Falls back to [] on
 * any error so the form still renders (mandate link becomes unavailable, not
 * a hard blocker for v1).
 *
 * RBAC: advisor + admin.
 *   assertRole('/outreach-activity', me.role) — matches the API route entry
 *   in shared rbac.ts (/outreach-activity → ['advisor', 'admin']).
 *   analyst/compliance/anon → redirect('/').
 *
 * AppShell chrome: inherited from app/(app)/layout.tsx.
 * Nav item: NAV_OUTREACH_ACTIVITY in shared rbac.ts (/outreach/activity, icon: phone-call).
 *
 * HARD BOUNDARY: INTERNAL records only. NO external send, NO reminders,
 * NO notifications, NO LLM. Simple form + list.
 *
 * Empty state:    graceful "No outreach touches logged yet".
 * Loading state:  N/A (SSR); initial data shown immediately.
 * Error state:    graceful error banner (no white screen).
 *
 * @see packages/shared/src/outreach-activity.ts  (contracts)
 * @see packages/shared/src/rbac.ts               (NAV_OUTREACH_ACTIVITY + route entries)
 * @see apps/web/next.config.ts                   (/outreach-activity afterFiles rewrites)
 */

import type { ListOutreachActivityResponse, MeResponse, OutreachActivity } from '@dealflow/shared';
import {
  listOutreachActivityResponseSchema,
  mandateSchema,
  meResponseSchema,
} from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import type { MandateOption } from './_components/OutreachActivityForm';
import { OutreachActivityPanel } from './_components/OutreachActivityPanel';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base (mirrors the layout + compliance/audit-log pattern)
// ---------------------------------------------------------------------------

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

// ---------------------------------------------------------------------------
// Cookie header
// ---------------------------------------------------------------------------

async function cookieHeader(): Promise<string> {
  return (await cookies()).toString();
}

// ---------------------------------------------------------------------------
// Session fetch
// ---------------------------------------------------------------------------

async function fetchMe(cookie: string): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = meResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Outreach activity list fetch — GET /outreach-activity (SSR-hydration)
//
// Returns [] on any failure — the panel renders the empty state.
// ---------------------------------------------------------------------------

async function fetchActivities(cookie: string): Promise<OutreachActivity[]> {
  try {
    const res = await fetch(`${apiBase()}/outreach-activity`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // Try the wrapped { activities: [] } shape first
    const parsed = listOutreachActivityResponseSchema.safeParse(raw);
    if (parsed.success) return parsed.data.activities;
    // Fallback: try raw array
    const arrayParsed = z
      .array(
        z.object({
          id: z.string().uuid(),
          workspaceId: z.string().uuid(),
          channel: z.enum(['call', 'email', 'linkedin', 'other']),
          status: z.enum(['planned', 'completed', 'cancelled']),
          subject: z.string(),
          notes: z.string().nullable(),
          dueAt: z.string().nullable(),
          completedAt: z.string().nullable(),
          outreachId: z.string().uuid().nullable(),
          matchCandidateId: z.string().uuid().nullable(),
          pipelineId: z.string().uuid().nullable(),
          mandateId: z.string().uuid().nullable(),
          createdBy: z.string().uuid(),
          createdAt: z.string(),
          updatedAt: z.string().nullable(),
        }).passthrough()
      )
      .safeParse(raw);
    return arrayParsed.success ? (arrayParsed.data as OutreachActivity[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mandate list fetch — GET /mandates (for the 0-or-1 deal-target dropdown)
//
// Returns [] on any failure — the form renders without the link dropdown.
// We only need id + sellerName for the dropdown label.
// ---------------------------------------------------------------------------

async function fetchMandateOptions(cookie: string): Promise<MandateOption[]> {
  try {
    const res = await fetch(`${apiBase()}/mandates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // The list may be an array or wrapped { mandates: [] }
    const arraySchema = z.array(mandateSchema);
    const wrappedSchema = z.object({ mandates: arraySchema });
    const direct = arraySchema.safeParse(raw);
    if (direct.success) {
      return direct.data.map((m) => ({ id: m.id, label: m.sellerName }));
    }
    const wrapped = wrappedSchema.safeParse(raw);
    if (wrapped.success) {
      return wrapped.data.mandates.map((m) => ({ id: m.id, label: m.sellerName }));
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function OutreachActivityPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert route access — advisor + admin only (per /outreach-activity RBAC).
  //    analyst/compliance → redirect('/').
  assertRole('/outreach-activity', me.role);

  // 3. Parallel SSR fetches: activity list + mandate options.
  const [initialActivities, mandateOptions] = await Promise.all([
    fetchActivities(cookie),
    fetchMandateOptions(cookie),
  ]);

  // ---------------------------------------------------------------------------
  // Check for fetch error (activities fetch returned [] but may be a server error)
  // We can't distinguish empty list from error at this level — render gracefully.
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '900px',
      }}
    >
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: '32px',
            letterSpacing: '-0.01em',
            color: '#111827',
          }}
        >
          Outreach Activity
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6B7280',
          }}
        >
          Log and track your outreach touches. Internal records only — no external send.
        </p>
      </div>

      {/* ── Client panel: form + list (shared state) ─────────────────────── */}
      <OutreachActivityPanel
        initialActivities={initialActivities}
        mandateOptions={mandateOptions}
      />
    </div>
  );
}
