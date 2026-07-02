/**
 * Reset-password page — RTL component tests (B-3, wave-2, task af6cbc59).
 *
 * Coverage:
 *   - Request step: renders email field; shows check-email ack after submit
 *     regardless of server response (no-user-enumeration).
 *   - No-user-enumeration: ack shown even when fetch rejects (network error).
 *   - No-user-enumeration: ack message does NOT say "account found" or "email
 *     exists" — uses conditional language.
 *   - Confirm step (token present): renders new-password + confirm fields.
 *   - Confirm step: shows mismatch error.
 *   - Confirm step: shows generic error on 4xx (invalid/expired token).
 *   - Confirm step: shows success state on 200.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: mockGet }),
}));

import ResetPasswordPage from './page';

function makeFetch(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
  } as Response);
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('request step (no token)', () => {
    beforeEach(() => {
      mockGet.mockReturnValue(null);
    });

    it('renders the email field', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
    });

    it('renders the send-reset-link button', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeDefined();
    });

    it('shows check-email ack after submit (server OK) — no-user-enumeration', async () => {
      vi.stubGlobal('fetch', makeFetch(202));
      render(<ResetPasswordPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeDefined();
      });
    });

    it('shows check-email ack even when fetch rejects (network error) — no enumeration', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));
      render(<ResetPasswordPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@firm.com');
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        // Even on network error we show the same ack — no enumeration of any kind.
        expect(screen.getByText(/check your email/i)).toBeDefined();
      });
    });

    it('ack message uses conditional language (does not confirm account existence)', async () => {
      vi.stubGlobal('fetch', makeFetch(202));
      render(<ResetPasswordPage />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'exists@firm.com');
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        const ackText = screen.getByText(/if an account exists/i);
        expect(ackText).toBeDefined();
        // Must NOT say "we found your account" or "account registered"
        expect(screen.queryByText(/found your account/i)).toBeNull();
        expect(screen.queryByText(/account registered/i)).toBeNull();
        expect(screen.queryByText(/email is registered/i)).toBeNull();
      });
    });

    it('shows validation error for invalid email format', async () => {
      render(<ResetPasswordPage />);
      await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email');
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i).getAttribute('aria-invalid')).toBe('true');
      });
    });
  });

  describe('confirm step (token present)', () => {
    beforeEach(() => {
      mockGet.mockReturnValue('valid-reset-token');
    });

    it('renders new-password field', () => {
      render(<ResetPasswordPage />);
      // Use exact label text to avoid matching "Confirm new password"
      expect(screen.getByLabelText('New password')).toBeDefined();
    });

    it('renders confirm-new-password field', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByLabelText('Confirm new password')).toBeDefined();
    });

    it('renders the reset-password submit button', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByRole('button', { name: /reset password/i })).toBeDefined();
    });

    it('shows mismatch error when passwords do not match', async () => {
      render(<ResetPasswordPage />);
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ValidPass1!' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), {
        target: { value: 'DifferentPass2!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeDefined();
      });
    });

    it('shows generic error on 4xx (invalid/expired token)', async () => {
      vi.stubGlobal('fetch', makeFetch(400));
      render(<ResetPasswordPage />);

      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ValidPass1!' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), {
        target: { value: 'ValidPass1!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/invalid or has expired/i);
      });
    });

    it('shows success state on 200 with link to /login', async () => {
      vi.stubGlobal('fetch', makeFetch(200));
      render(<ResetPasswordPage />);

      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ValidPass1!' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), {
        target: { value: 'ValidPass1!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password updated/i)).toBeDefined();
        const loginLink = screen.getByRole('link', { name: /sign in to dealflow ai/i });
        expect((loginLink as HTMLAnchorElement).href).toContain('/login');
      });
    });
  });
});
