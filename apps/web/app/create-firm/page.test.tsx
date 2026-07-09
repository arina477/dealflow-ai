/**
 * CreateFirmPage — RTL component tests (wave-37, task 6235baf7).
 *
 * Coverage:
 *   - Renders firm name, email, and password fields with correct labels.
 *   - Zod validation fires on submit with empty / invalid fields.
 *   - 201 → redirect to / (canonical authed dashboard, admin session set).
 *   - 400 → friendly message (email may already be registered / invalid details).
 *   - 429 → friendly rate-limit message.
 *   - Other 4xx/5xx → generic error message.
 *   - Network failure → connection error message.
 *   - "Have an invite? Sign in instead" link present, pointing to /login.
 *
 * Note: pure RTL component test. Playwright E2E (real-browser flow) handled
 * separately by the QA stage.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import CreateFirmPage from './page';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function fillAndSubmit(opts: { firmName?: string; email?: string; password?: string }) {
  if (opts.firmName) {
    await userEvent.type(screen.getByLabelText(/firm name/i), opts.firmName);
  }
  if (opts.email) {
    await userEvent.type(screen.getByLabelText(/email address/i), opts.email);
  }
  if (opts.password) {
    await userEvent.type(screen.getByLabelText(/^password$/i), opts.password);
  }
  fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateFirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('render', () => {
    it('renders firm name field with correct label', () => {
      render(<CreateFirmPage />);
      expect(screen.getByLabelText(/firm name/i)).toBeDefined();
    });

    it('renders email field with correct label', () => {
      render(<CreateFirmPage />);
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
    });

    it('renders password field with correct label', () => {
      render(<CreateFirmPage />);
      expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    });

    it('renders "Create workspace" submit button', () => {
      render(<CreateFirmPage />);
      expect(screen.getByRole('button', { name: /create workspace/i })).toBeDefined();
    });

    it('renders "Have an invite? Sign in instead" link pointing to /login', () => {
      render(<CreateFirmPage />);
      const link = screen.getByRole('link', { name: /have an invite/i });
      expect(link).toBeDefined();
      expect((link as HTMLAnchorElement).href).toContain('/login');
    });

    it('renders the admin notice about workspace administrator role', () => {
      render(<CreateFirmPage />);
      expect(screen.getByText(/workspace administrator/i)).toBeDefined();
    });
  });

  describe('form validation', () => {
    it('shows firm name error when firm name is blank on submit', async () => {
      render(<CreateFirmPage />);
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
      await waitFor(() => {
        expect(screen.getByText(/at least 1 character/i)).toBeDefined();
      });
    });

    it('marks firm name input aria-invalid on validation error', async () => {
      render(<CreateFirmPage />);
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/firm name/i).getAttribute('aria-invalid')).toBe('true');
      });
    });

    it('shows email validation error when email is blank on submit', async () => {
      render(<CreateFirmPage />);
      await userEvent.type(screen.getByLabelText(/firm name/i), 'Acme Capital');
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i).getAttribute('aria-invalid')).toBe('true');
      });
    });

    it('shows password validation error when password is too short', async () => {
      render(<CreateFirmPage />);
      await userEvent.type(screen.getByLabelText(/firm name/i), 'Acme Capital');
      await userEvent.type(screen.getByLabelText(/email address/i), 'admin@acme.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'short');
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeDefined();
      });
    });
  });

  describe('success flow', () => {
    it('redirects to / on 201 response', async () => {
      vi.stubGlobal('fetch', makeFetch(201));
      render(<CreateFirmPage />);
      await fillAndSubmit({
        firmName: 'Acme Capital Partners',
        email: 'admin@acme.com',
        password: 'Password123!',
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('error handling', () => {
    it('shows friendly message on 400 (email may be registered / invalid details)', async () => {
      // Backend returns 400 for an already-registered email or invalid input.
      // Firm names are NOT unique, so a 400 is not "firm name taken".
      vi.stubGlobal('fetch', makeFetch(400));
      render(<CreateFirmPage />);
      await fillAndSubmit({
        firmName: 'Acme Capital Partners',
        email: 'admin@acme.com',
        password: 'Password123!',
      });
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/already be registered|invalid/i);
      });
    });

    it('shows rate-limit message on 429', async () => {
      vi.stubGlobal('fetch', makeFetch(429));
      render(<CreateFirmPage />);
      await fillAndSubmit({
        firmName: 'Acme Capital Partners',
        email: 'admin@acme.com',
        password: 'Password123!',
      });
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/too many requests/i);
      });
    });

    it('shows generic error on other 4xx (e.g. 403)', async () => {
      vi.stubGlobal('fetch', makeFetch(403));
      render(<CreateFirmPage />);
      await fillAndSubmit({
        firmName: 'Acme Capital Partners',
        email: 'admin@acme.com',
        password: 'Password123!',
      });
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/could not create workspace/i);
      });
    });

    it('shows server-unreachable message on fetch rejection', async () => {
      vi.stubGlobal('fetch', makeFetchError());
      render(<CreateFirmPage />);
      await fillAndSubmit({
        firmName: 'Acme Capital Partners',
        email: 'admin@acme.com',
        password: 'Password123!',
      });
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/unable to reach the server/i);
      });
    });
  });
});
