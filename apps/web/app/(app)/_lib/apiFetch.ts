/**
 * apiFetch — same-origin browser client for the authenticated app API (T-5).
 *
 * The api runs SuperTokens with `antiCsrf: 'VIA_CUSTOM_HEADER'` (see
 * apps/api/src/modules/auth/supertokens.config.ts). Under that posture every
 * state-changing request that passes through session verification
 * (Session.getSession — the SessionGuard) MUST carry a custom header, or the
 * SDK rejects it with 401 as a suspected cross-site forgery.
 *
 * The standard SuperTokens custom header is `rid: "anti-csrf"`. This wrapper
 * injects it on EVERY call (harmless on GET — anti-csrf is not enforced on GET,
 * but sending it keeps callers uniform and future-proofs any GET→mutation
 * change) and merges any caller-supplied headers on top.
 *
 * Requests are same-origin relative paths proxied to the api by the Next.js
 * `afterFiles` rewrites, so the browser attaches the first-party session cookie
 * automatically — no `credentials` option is required. We still set
 * `credentials: 'include'` defensively so the helper is correct even if a
 * caller passes an absolute URL.
 *
 * Server-only: import from client components ('use client'). SSR page.tsx
 * fetches forward the cookie server→server and are GET-only, so they do not use
 * this helper.
 */

/** The SuperTokens VIA_CUSTOM_HEADER anti-CSRF header. */
export const ANTI_CSRF_HEADER = 'rid';
export const ANTI_CSRF_VALUE = 'anti-csrf';

/**
 * fetch() wrapper that adds the anti-csrf custom header + cookie credentials.
 * Caller headers win on key collision.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // Set the anti-csrf header only if the caller has not already provided one
  // (e.g. the SuperTokens frontend flow uses rid:'emailpassword').
  if (!headers.has(ANTI_CSRF_HEADER)) {
    headers.set(ANTI_CSRF_HEADER, ANTI_CSRF_VALUE);
  }
  return fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });
}
