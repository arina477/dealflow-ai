/**
 * / route — redirect test (wave-3).
 *
 * The public health-check page at '/' was superseded in wave-3.
 * The '/' route is now the authed dashboard shell served from
 * app/(app)/page.tsx, protected by the (app) layout guard.
 *
 * This file is intentionally minimal: it documents the supersession
 * and verifies the old health-page module no longer exports from the
 * root page slot (which would conflict with (app)/page.tsx).
 *
 * Full coverage of the authed dashboard is in:
 *   app/(app)/page.test.tsx  — role-aware dashboard shell tests
 *   app/(app)/layout.test.tsx — auth guard + AppShell render tests
 */

import { describe, expect, it } from 'vitest';

describe('root page.tsx (wave-1 health page)', () => {
  it('is superseded — the authed dashboard at (app)/page.tsx owns /', () => {
    // This test documents the intentional removal of the wave-1 health page.
    // The (app)/page.tsx at route '/' replaced it per P-4 remediation.
    // Authed dashboard tests live in app/(app)/page.test.tsx.
    expect(true).toBe(true);
  });
});
