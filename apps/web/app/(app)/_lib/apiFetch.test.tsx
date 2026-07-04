/**
 * apiFetch — unit tests (T-5 CSRF fix, wave-5).
 *
 * Proves the shared authed-API client sends the SuperTokens VIA_CUSTOM_HEADER
 * anti-CSRF header (`rid: 'anti-csrf'`) on every call. This is the client half
 * of the fix that makes authenticated compliance CRUD mutations (POST/PATCH/
 * DELETE) pass Session.getSession instead of 401'ing.
 *
 * The end-to-end proof (real POST through the Next proxy in a live browser)
 * happens at C-2 re-verify / the T-5 real-browser E2E re-run; this unit test
 * locks the header contract at the fetch-wrapper boundary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANTI_CSRF_HEADER, ANTI_CSRF_VALUE, apiFetch } from './apiFetch';

function lastFetchInit(): { url: string; init: RequestInit } {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>;
  const call = mock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

function headerValue(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the anti-csrf rid header on a POST mutation', async () => {
    await apiFetch('/compliance/suppression', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchType: 'exact', value: 'x@y.com' }),
    });

    const { init } = lastFetchInit();
    expect(headerValue(init, ANTI_CSRF_HEADER)).toBe(ANTI_CSRF_VALUE);
    expect(ANTI_CSRF_HEADER).toBe('rid');
    expect(ANTI_CSRF_VALUE).toBe('anti-csrf');
    // Caller's own headers survive alongside the injected rid header.
    expect(headerValue(init, 'content-type')).toBe('application/json');
  });

  it('sends the anti-csrf rid header on a DELETE with no caller headers', async () => {
    await apiFetch('/compliance/suppression/123', { method: 'DELETE' });
    const { init } = lastFetchInit();
    expect(headerValue(init, ANTI_CSRF_HEADER)).toBe(ANTI_CSRF_VALUE);
  });

  it('sends the anti-csrf rid header on a GET (harmless, uniform)', async () => {
    await apiFetch('/compliance/audit-log/verify', { cache: 'no-store' });
    const { init } = lastFetchInit();
    expect(headerValue(init, ANTI_CSRF_HEADER)).toBe(ANTI_CSRF_VALUE);
  });

  it('includes cookie credentials so the session cookie is attached', async () => {
    await apiFetch('/compliance/rules', { method: 'POST' });
    const { init } = lastFetchInit();
    expect(init.credentials).toBe('include');
  });

  it('does not overwrite a caller-supplied rid header', async () => {
    // The SuperTokens frontend flow uses rid:'emailpassword'; if a caller ever
    // sets rid explicitly, apiFetch must leave it intact.
    await apiFetch('/auth/signin', {
      method: 'POST',
      headers: { rid: 'emailpassword' },
    });
    const { init } = lastFetchInit();
    expect(headerValue(init, 'rid')).toBe('emailpassword');
  });
});
