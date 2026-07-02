/**
 * /login — email + password sign-in page.
 *
 * Reconciliation notes applied (P-4 / jenny findings):
 *   - SSO "Continue with Google" button: OMITTED (deferred M8/M11)
 *   - SOC 2 Type II badge: OMITTED (compliance_regime: none; false claim)
 *
 * Auth flow:
 *   POST /auth/signin  (SuperTokens EmailPassword SDK auto-route)
 *   credentials: 'include'  — httpOnly cookie session
 *   success  → GET /auth/me (role) → /dashboard
 *   failure  → GENERIC inline error (no user-enumeration: same message for
 *              unknown-email and wrong-password)
 *
 * Client component: form interactivity + fetch.
 * Shared Zod contract: loginRequestSchema from @dealflow/shared.
 */

'use client';

import { loginRequestSchema } from '@dealflow/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '../(auth)/_components/AuthCard';
import { FormField } from '../(auth)/_components/FormField';
import { InlineAlert } from '../(auth)/_components/InlineAlert';
import { SubmitButton } from '../(auth)/_components/SubmitButton';

// Generic error — no distinction between unknown email vs wrong password.
const GENERIC_AUTH_ERROR = 'Invalid email or password. Please try again.';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const result = loginRequestSchema.safeParse({ email, password });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: { email?: string; password?: string } = {};
    for (const issue of result.error.issues) {
      const path = issue.path[0] as string;
      if (path === 'email' || path === 'password') {
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
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

      // SuperTokens EmailPassword sign-in SDK auto-route.
      const res = await fetch(`${apiBase}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', rid: 'emailpassword' },
        credentials: 'include',
        body: JSON.stringify({ formFields: [{ id: 'email', value: email }, { id: 'password', value: password }] }),
      });

      if (!res.ok) {
        // No user-enumeration: always show the same generic error.
        setServerError(GENERIC_AUTH_ERROR);
        return;
      }

      const body: unknown = await res.json();
      const status = (body as Record<string, unknown>)?.status;

      if (status === 'OK') {
        // Fetch role from /auth/me so the redirect can be role-aware in future.
        // This wave: redirect to /dashboard (placeholder authed landing).
        router.replace('/dashboard');
      } else if (status === 'WRONG_CREDENTIALS_ERROR') {
        // No user-enumeration: same generic message regardless of root cause.
        setServerError(GENERIC_AUTH_ERROR);
      } else {
        setServerError(GENERIC_AUTH_ERROR);
      }
    } catch {
      setServerError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard>
      <div style={{ marginBottom: '32px' }}>
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
          Welcome back
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}
        >
          Sign in to access deal intelligence and compliance workflows.
        </p>
      </div>

      {serverError && (
        <div style={{ marginBottom: '24px' }}>
          <InlineAlert variant="danger" message={serverError} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          labelRight={
            <a
              href="/reset-password"
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Forgot password?
            </a>
          }
        />

        <div style={{ paddingTop: '8px' }}>
          <SubmitButton label="Sign in" loadingLabel="Signing in..." isLoading={isLoading} />
        </div>
      </form>
    </AuthCard>
  );
}
