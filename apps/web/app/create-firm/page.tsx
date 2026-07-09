/**
 * /create-firm — self-serve workspace creation (wave-37, task 6235baf7).
 *
 * Flow:
 *   POST /auth/signup-firm { firmName, email, password }
 *   → 201 + Set-Cookie (admin session)
 *   → redirect to / (canonical authed dashboard)
 *
 * SAME-ORIGIN path: same reasoning as /auth/signin and /auth/signup —
 * the Next.js rewrite in next.config.ts proxies /auth/signup-firm to the
 * API so the session cookie lands first-party on the web origin.
 *
 * Error handling:
 *   - 409 Conflict  → firm name or email already taken (friendly message)
 *   - 429           → rate limited (friendly message, no field detail)
 *   - 4xx           → generic validation error
 *   - network       → connection error message
 *
 * Client component: form interactivity + fetch.
 * Shared Zod contract: signupFirmRequestSchema from @dealflow/shared.
 */

'use client';

import { signupFirmRequestSchema } from '@dealflow/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '../(auth)/_components/AuthCard';
import { FormField } from '../(auth)/_components/FormField';
import { InlineAlert } from '../(auth)/_components/InlineAlert';
import { SubmitButton } from '../(auth)/_components/SubmitButton';

export default function CreateFirmPage() {
  const router = useRouter();

  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    firmName?: string;
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const result = signupFirmRequestSchema.safeParse({ firmName, email, password });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: { firmName?: string; email?: string; password?: string } = {};
    for (const issue of result.error.issues) {
      const path = issue.path[0] as string;
      if (path === 'firmName' || path === 'email' || path === 'password') {
        fieldErrors[path] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return false;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      // SAME-ORIGIN path (cross-origin session fix): next.config.ts rewrites
      // /auth/signup-firm to the API origin so the Set-Cookie session lands
      // first-party on the web origin (readable by dashboard server components).
      const res = await fetch('/auth/signup-firm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firmName, email, password }),
      });

      if (res.status === 201) {
        // Session cookie is set; redirect to canonical authed dashboard.
        router.replace('/');
        return;
      }

      if (res.status === 409) {
        setServerError(
          'A workspace with this firm name, or an account with this email, already exists. Please use a different name or sign in.'
        );
        return;
      }

      if (res.status === 429) {
        setServerError('Too many requests. Please wait a moment before trying again.');
        return;
      }

      // Any other 4xx/5xx — generic, no field-level detail.
      setServerError('Could not create workspace. Check your details and try again.');
    } catch {
      setServerError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard>
      <div style={{ marginBottom: '32px' }}>
        {/* Workspace icon — lucide network, emerald, matching the mockup */}
        <div
          aria-hidden="true"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* lucide network icon, 1.5px stroke */}
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="16" y="16" width="6" height="6" rx="1" />
            <rect x="2" y="16" width="6" height="6" rx="1" />
            <rect x="9" y="2" width="6" height="6" rx="1" />
            <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
            <path d="M12 12V8" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '24px',
            lineHeight: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            margin: 0,
          }}
        >
          Create workspace
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}
        >
          Set up a dedicated, compliance-ready environment for your firm&rsquo;s pipeline and
          mandate execution.
        </p>
      </div>

      {serverError && (
        <div style={{ marginBottom: '24px' }}>
          <InlineAlert variant="danger" message={serverError} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <FormField
          label="Firm name"
          id="firmName"
          type="text"
          autoComplete="organization"
          placeholder="e.g. Acme Capital Partners"
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          error={errors.firmName}
          required
        />

        <FormField
          label="Email address"
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@firm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />

        <FormField
          label="Password"
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />

        {/* Admin notice — mirrors the mockup's shield-check info panel */}
        <div
          style={{
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          {/* lucide shield-check icon */}
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-info)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: '1px' }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <p
            style={{
              fontSize: '13px',
              lineHeight: '18px',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            As the creator, you will be assigned as the{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              Workspace Administrator
            </strong>{' '}
            by default. You can manage roles in team settings later.
          </p>
        </div>

        <div
          style={{
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <SubmitButton
            label="Create workspace"
            loadingLabel="Provisioning..."
            isLoading={isLoading}
          />

          <a
            href="/login"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)';
            }}
          >
            Have an invite? Sign in instead
          </a>
        </div>
      </form>
    </AuthCard>
  );
}
