/**
 * /sourcing — redirect to /sourcing/companies.
 *
 * The NAV_SOURCING sidebar item points to /sourcing (per rbac.ts).
 * The companies screen lives at /sourcing/companies. This redirect
 * makes the nav item land on the correct screen without exposing
 * a second route in the nav bar.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SourcingPage() {
  redirect('/sourcing/companies');
}
