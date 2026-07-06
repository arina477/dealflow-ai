/**
 * /outreach — Placeholder page test (wave-15 AppShell polish, task d7f716b4).
 *
 * Verifies that the /outreach route renders a graceful placeholder
 * (not a raw 404) when the nav item is clicked.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import OutreachPlaceholderPage from './page';

describe('OutreachPlaceholderPage (/outreach)', () => {
  it('renders "Outreach" heading (not a 404)', () => {
    render(<OutreachPlaceholderPage />);
    expect(screen.getByRole('heading', { name: /^outreach$/i })).toBeDefined();
  });

  it('renders coming-soon placeholder section', () => {
    render(<OutreachPlaceholderPage />);
    expect(screen.getByRole('region', { name: /outreach.*coming soon/i })).toBeDefined();
  });

  it('renders a link to /outreach-composer', () => {
    render(<OutreachPlaceholderPage />);
    const link = screen.getByRole('link', { name: /go to outreach composer/i });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).href).toContain('/outreach-composer');
  });

  it('does not render any send or AI affordance', () => {
    render(<OutreachPlaceholderPage />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
  });
});
