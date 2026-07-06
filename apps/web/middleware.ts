/**
 * middleware.ts — injects x-pathname header for server-component pathname resolution.
 *
 * The Next.js App Router does not expose the browser's URL pathname to server
 * components directly. The existing (app)/layout.tsx attempts to read
 * `x-invoke-path` from Next.js internals, which may be absent or return the
 * file-system route path (e.g. `/(app)/admin/users`) rather than the URL path.
 *
 * This middleware runs on every app route and injects the actual request pathname
 * as `x-pathname`. The layout's `resolvePathname()` already reads `x-pathname`
 * as its second fallback — this makes it the reliable first-class source.
 *
 * The middleware is intentionally minimal: it only sets the header and passes
 * through. Auth is handled by the (app) layout server component.
 *
 * Matcher: all authed app pages. Public routes (/auth/*, /health) are excluded
 * so the middleware has no interaction with SuperTokens auth flows.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Inject the actual pathname so server components can resolve it reliably.
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  // Match all app routes, excluding Next.js internal paths and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth|health).*)'],
};
