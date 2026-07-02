/**
 * /accept-invite — invite-bound account creation.
 *
 * Flow:
 *   1. Read ?token= from URL query params (server-side via searchParams).
 *   2. If token absent → render error state immediately (no fetch needed).
 *   3. Token present → show set-password form.
 *   4. Submit → POST /auth/signup { inviteToken, password }
 *      - 201 + Set-Cookie → redirect to /dashboard
 *      - 4xx → inline generic error (expired / consumed / invalid — no specifics)
 *
 * Reconciliation notes (P-4 jenny findings):
 *   - "Full Legal Name" field: OMITTED — users schema has no name column this wave.
 *   - No SSO option.
 *
 * Client component: form interactivity.
 * Shared Zod contract: signupRequestSchema from @dealflow/shared.
 */

'use client';

import { signupRequestSchema } from '@dealflow/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '../(auth)/_components/AuthCard';
import { FormField } from '../(auth)/_components/FormField';
import { InlineAlert } from '../(auth)/_components/InlineAlert';
import { SubmitButton } from '../(auth)/_components/SubmitButton';

// Generic error for any invalid/expired/consumed invite — no specifics to avoid
// leaking whether a token once existed.
const GENERIC_INVITE_ERROR =
  'This invite link is invalid, has expired, or has already been used. Please contact your administrator.';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Missing token → show error state without exposing why.
  if (!inviteToken) {
    return (
      <div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-danger)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h1
          style={{
            fontSize: '24px',
            lineHeight: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '12px',
          }}
        >
          Invite Link Invalid
        </h1>
        <p style={{ fontSize: '14px', lineHeight: '20px', color: 'var(--text-body)' }}>
          {GENERIC_INVITE_ERROR}
        </p>
      </div>
    );
  }

  function validate(): boolean {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    const result = signupRequestSchema.safeParse({ inviteToken, password });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'password') newErrors.password = issue.message;
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${apiBase}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteToken, password }),
      });

      if (res.status === 201) {
        router.replace('/dashboard');
      } else {
        // 4xx: expired / consumed / invalid — generic message, no specifics.
        setServerError(GENERIC_INVITE_ERROR);
      }
    } catch {
      setServerError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '24px',
            lineHeight: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Set up your account
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}
        >
          You have been invited to DealFlow AI. Set a password to activate your account.
        </p>
      </div>

      {serverError && (
        <div style={{ marginBottom: '24px' }}>
          <InlineAlert variant="danger" message={serverError} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        <FormField
          label="Confirm password"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />

        <div style={{ paddingTop: '8px' }}>
          <SubmitButton
            label="Accept & create account"
            loadingLabel="Creating account..."
            isLoading={isLoading}
          />
        </div>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthCard>
      {/* Suspense required: useSearchParams() needs it in Next.js App Router */}
      <Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}
            aria-label="Verifying invite..."
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}
            >
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Verifying secure invitation...
          </div>
        }
      >
        <AcceptInviteForm />
      </Suspense>
    </AuthCard>
  );
}
