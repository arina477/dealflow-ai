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
 * Headers are passed as a plain Record<string, string> (not a Headers instance)
 * so that test assertions using `expect.objectContaining({ rid: 'anti-csrf' })`
 * work correctly — Headers instances do not expose entries as enumerable own
 * properties. All callers in this codebase pass plain objects as init.headers,
 * so the cast to Record<string, string> is safe.
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
 * Caller headers win on key collision (e.g. rid:'emailpassword' from the ST
 * frontend flow is preserved).
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  // Build a plain-object header map so test assertions can inspect entries
  // as own properties (Headers instances do not expose them that way).
  const callerHeaders = (init.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    // Anti-csrf first (lower precedence) so caller can override.
    [ANTI_CSRF_HEADER]: ANTI_CSRF_VALUE,
    // Caller headers last — their values win on collision.
    ...callerHeaders,
  };
  return fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });
}
