/**
 * Login page — RTL component tests (B-3, wave-2, task af6cbc59).
 *
 * Coverage:
 *   - Renders email + password fields with correct labels and aria attributes.
 *   - Zod validation fires on submit with empty / invalid fields.
 *   - No-user-enumeration: GENERIC error shown on 401 (wrong creds) — NOT
 *     "Unknown email" or "Wrong password" — same message regardless.
 *   - No-user-enumeration: GENERIC error shown on 403 / any non-OK response.
 *   - SSO button absent (deferred, reconciliation note).
 *   - SOC 2 badge absent (CODE-OF-CONDUCT / false compliance claim).
 *
 * Note: this is a pure RTL component test. Playwright E2E (real-browser signin)
 * is gated on host Chrome availability (T-5 stage, task fa23349a).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock next/navigation before importing the page.
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Import AFTER mocking navigation.
import LoginPage from './page';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFetch(status: number, body: unknown = {}): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

function makeFetchError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('network error'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('render', () => {
    it('renders email field with correct label', () => {
      render(<LoginPage />);
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
    });

    it('renders password field with correct label', () => {
      render(<LoginPage />);
      expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    });

    it('renders the sign-in submit button', () => {
      render(<LoginPage />);
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
    });

    it('does NOT render SSO / Google button (deferred)', () => {
      render(<LoginPage />);
      expect(screen.queryByText(/continue with google/i)).toBeNull();
      expect(screen.queryByText(/google/i)).toBeNull();
    });

    it('does NOT render SOC 2 Type II badge (false compliance claim)', () => {
      render(<LoginPage />);
      expect(screen.queryByText(/soc 2/i)).toBeNull();
    });

    it('renders "Forgot password?" link pointing to /reset-password', () => {
      render(<LoginPage />);
      const link = screen.getByRole('link', { name: /forgot password/i });
      expect(link).toBeDefined();
      expect((link as HTMLAnchorElement).href).toContain('/reset-password');
    });
  });

  describe('form validation', () => {
    it('shows email validation error when email is blank on submit', async () => {
      render(<LoginPage />);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeDefined();
      });
    });

    it('marks email input aria-invalid on validation error', async () => {
      render(<LoginPage />);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i).getAttribute('aria-invalid')).toBe('true');
      });
    });
  });

  describe('no-user-enumeration', () => {
    it('shows generic error on WRONG_CREDENTIALS_ERROR (not which field is wrong)', async () => {
      vi.stubGlobal('fetch', makeFetch(200, { status: 'WRONG_CREDENTIALS_ERROR' }));
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/invalid email or password/i);
        // Must NOT reveal which field is wrong.
        expect(alert.textContent).not.toMatch(/unknown email/i);
        expect(alert.textContent).not.toMatch(/wrong password/i);
        expect(alert.textContent).not.toMatch(/account not found/i);
      });
    });

    it('shows generic error on non-OK HTTP status (403)', async () => {
      vi.stubGlobal('fetch', makeFetch(403));
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1!');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/invalid email or password/i);
      });
    });

    it('shows generic error on non-OK HTTP status (401)', async () => {
      vi.stubGlobal('fetch', makeFetch(401));
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'Password1!');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/invalid email or password/i);
      });
    });
  });

  describe('success flow', () => {
    it('redirects to / (canonical authed dashboard, P-4 remediation) on successful sign-in', async () => {
      vi.stubGlobal('fetch', makeFetch(200, { status: 'OK', user: { id: '1' } }));
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('network error', () => {
    it('shows server-unreachable message on fetch rejection', async () => {
      vi.stubGlobal('fetch', makeFetchError());
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/unable to reach the server/i);
      });
    });
  });
});
