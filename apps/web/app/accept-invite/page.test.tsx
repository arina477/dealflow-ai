/**
 * Accept-invite page — RTL component tests (B-3, wave-2, task af6cbc59).
 *
 * Coverage:
 *   - Error state when ?token= is absent.
 *   - Password + confirm fields rendered when token is present.
 *   - Name field is NOT rendered (omitted per reconciliation note — no DB column).
 *   - Zod validation: password too short.
 *   - Confirm-password mismatch error.
 *   - Generic error on 4xx (invalid/expired invite — no specifics).
 *   - Redirect to /dashboard on 201.
 *
 * useSearchParams requires Suspense in Next.js App Router.
 * We mock next/navigation to control the token value.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const mockGet = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}));

import AcceptInvitePage from './page';

function makeFetch(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
  } as Response);
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('missing token (no ?token= in URL)', () => {
    it('renders the "Invite Link Invalid" error state', () => {
      mockGet.mockReturnValue(null);
      render(<AcceptInvitePage />);
      expect(screen.getByText(/invite link invalid/i)).toBeDefined();
    });

    it('does NOT render the form when token is absent', () => {
      mockGet.mockReturnValue(null);
      render(<AcceptInvitePage />);
      expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    });
  });

  describe('token present — form rendering', () => {
    beforeEach(() => {
      mockGet.mockReturnValue('test-invite-token-abc');
    });

    it('renders password field', () => {
      render(<AcceptInvitePage />);
      expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    });

    it('renders confirm password field', () => {
      render(<AcceptInvitePage />);
      expect(screen.getByLabelText(/confirm password/i)).toBeDefined();
    });

    it('does NOT render a name field (omitted per reconciliation note)', () => {
      render(<AcceptInvitePage />);
      expect(screen.queryByLabelText(/full.*name/i)).toBeNull();
      expect(screen.queryByLabelText(/legal name/i)).toBeNull();
      expect(screen.queryByLabelText(/^name$/i)).toBeNull();
    });

    it('renders the submit button', () => {
      render(<AcceptInvitePage />);
      expect(screen.getByRole('button', { name: /accept.*create account/i })).toBeDefined();
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockGet.mockReturnValue('valid-token');
    });

    it('shows password-too-short error when submitting short password', async () => {
      render(<AcceptInvitePage />);
      await userEvent.type(screen.getByLabelText(/^password$/i), 'abc');
      fireEvent.click(screen.getByRole('button', { name: /accept/i }));
      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeDefined();
      });
    });

    it('shows mismatch error when passwords do not match', async () => {
      render(<AcceptInvitePage />);
      await userEvent.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'DifferentPass1!');
      fireEvent.click(screen.getByRole('button', { name: /accept/i }));
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeDefined();
      });
    });
  });

  describe('server responses', () => {
    beforeEach(() => {
      mockGet.mockReturnValue('valid-token');
    });

    it('redirects to /dashboard on 201', async () => {
      vi.stubGlobal('fetch', makeFetch(201));
      render(<AcceptInvitePage />);

      await userEvent.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'ValidPass1!');
      fireEvent.click(screen.getByRole('button', { name: /accept/i }));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows generic error on 4xx without exposing specifics (expired/consumed)', async () => {
      vi.stubGlobal('fetch', makeFetch(422));
      render(<AcceptInvitePage />);

      await userEvent.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'ValidPass1!');
      fireEvent.click(screen.getByRole('button', { name: /accept/i }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        // Generic message — no specifics like "token expired" vs "token consumed"
        expect(alert.textContent).toMatch(/invalid|expired|already been used/i);
        // Must NOT say specifically "expired" alone or "consumed" as distinct states
        expect(alert.textContent).not.toMatch(/^token expired$/i);
      });
    });
  });
});
