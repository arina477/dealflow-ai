/**
 * /matches — Placeholder page test (wave-15 AppShell polish, task d7f716b4).
 *
 * Verifies that the /matches route renders a graceful placeholder
 * (not a raw 404) when the nav item is clicked.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MatchesPlaceholderPage from './page';

describe('MatchesPlaceholderPage (/matches)', () => {
  it('renders "Matches" heading (not a 404)', () => {
    render(<MatchesPlaceholderPage />);
    expect(screen.getByRole('heading', { name: /^matches$/i })).toBeDefined();
  });

  it('renders coming-soon placeholder section', () => {
    render(<MatchesPlaceholderPage />);
    expect(screen.getByRole('region', { name: /matches.*coming soon/i })).toBeDefined();
  });

  it('renders a link to /matches-shortlist', () => {
    render(<MatchesPlaceholderPage />);
    const link = screen.getByRole('link', { name: /go to matches shortlist/i });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).href).toContain('/matches-shortlist');
  });

  it('does not render any send or AI affordance', () => {
    render(<MatchesPlaceholderPage />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
  });
});
