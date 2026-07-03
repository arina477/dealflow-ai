/**
 * /dashboard — RETIRED wave-2 placeholder.
 *
 * The canonical authed dashboard is now at '/' (app/(app)/page.tsx).
 * P-4 remediation: canonical dashboard route = '/' per DESIGN-SYSTEM §10.
 *
 * Any bookmarked /dashboard link is redirected to '/' permanently.
 */

import { redirect } from 'next/navigation';

export default function DashboardRedirectPage() {
  redirect('/');
}
