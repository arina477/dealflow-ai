/**
 * /reset-password — two-step password reset.
 *
 * Step 1 (request):
 *   Form: email → POST /auth/reset/request
 *   Always shows identical "check your email" ack — NO user-enumeration.
 *   (Same 202 body whether email maps to an account or not.)
 *
 * Step 2 (confirm):
 *   Activated when ?token= is present in the URL.
 *   Form: new-password + confirm → POST /auth/reset/confirm { token, password }
 *   Success → success state → link to /login.
 *   Failure (invalid/expired token or weak password) → inline error.
 *
 * No user-enumeration in any branch.
 * Client component: form interactivity + view transitions.
 * Shared Zod contracts: resetRequestSchema, resetConfirmSchema from @dealflow/shared.
 */

'use client';

import { resetConfirmSchema, resetRequestSchema } from '@dealflow/shared';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '../(auth)/_components/AuthCard';
import { FormField } from '../(auth)/_components/FormField';
import { InlineAlert } from '../(auth)/_components/InlineAlert';
import { SubmitButton } from '../(auth)/_components/SubmitButton';

// ----- Request step -----

function RequestStep() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const result = resetRequestSchema.safeParse({ email });
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? 'Invalid email address.');
      return;
    }
    setEmailError(undefined);

    setIsLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    try {
      // Fire-and-forget: always show the same ack regardless of server response.
      await fetch(`${apiBase}/auth/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Swallow network errors — no enumeration (still show check-email ack).
    } finally {
      setIsLoading(false);
    }

    // Always transition to the ack state — no user-enumeration.
    setSubmittedEmail(email);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--emerald-50)',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
          aria-hidden="true"
        >
          {/* lucide mail-check */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-positive)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            <path d="m16 19 2 2 4-4" />
          </svg>
        </div>
        <h1
          style={{
            fontSize: '24px',
            lineHeight: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Check your email
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-body)',
            margin: '12px 0 0',
          }}
        >
          If an account exists for{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{submittedEmail}</strong>, we have
          sent a password reset link. Check your spam folder if it does not arrive.
        </p>
        <div style={{ marginTop: '24px' }}>
          <a
            href="/login"
            style={{
              fontSize: '14px',
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
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
          Reset your password
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}
        >
          Enter your email address and we will send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FormField
          label="Email address"
          id="reset-email"
          type="email"
          autoComplete="email"
          placeholder="name@firm.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(undefined);
          }}
          error={emailError}
          required
        />

        <div style={{ paddingTop: '8px' }}>
          <SubmitButton label="Send reset link" loadingLabel="Sending..." isLoading={isLoading} />
        </div>
      </form>

      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        Remember your password?{' '}
        <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
          Sign in
        </a>
      </div>
    </div>
  );
}

// ----- Confirm step (token present in URL) -----

function ConfirmStep({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    const result = resetConfirmSchema.safeParse({ token, password });
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
      const res = await fetch(`${apiBase}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        // 4xx: invalid/expired token or weak password.
        setServerError(
          'The reset link is invalid or has expired. Please request a new one.'
        );
      }
    } catch {
      setServerError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--emerald-50)',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
          aria-hidden="true"
        >
          {/* lucide check-circle-2 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-positive)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: '24px',
            lineHeight: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Password updated
        </h2>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-body)',
            margin: '12px 0 24px',
          }}
        >
          Your password has been successfully reset. You can now sign in with your new credentials.
        </p>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            width: '100%',
            textAlign: 'center',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--zinc-900)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            padding: '10px 16px',
            textDecoration: 'none',
          }}
        >
          Sign in to DealFlow AI
        </a>
      </div>
    );
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
          Create new password
        </h1>
        <p
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-muted)',
            margin: '8px 0 0',
          }}
        >
          Choose a strong password of at least 8 characters.
        </p>
      </div>

      {serverError && (
        <div style={{ marginBottom: '24px' }}>
          <InlineAlert variant="danger" message={serverError} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FormField
          label="New password"
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />

        <FormField
          label="Confirm new password"
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />

        <div style={{ paddingTop: '8px' }}>
          <SubmitButton label="Reset password" loadingLabel="Resetting..." isLoading={isLoading} />
        </div>
      </form>
    </div>
  );
}

// ----- Router: delegates to Request or Confirm based on ?token= -----

function ResetPasswordRouter() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    return <ConfirmStep token={token} />;
  }
  return <RequestStep />;
}

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <Suspense
        fallback={
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }} aria-label="Loading...">
            Loading...
          </div>
        }
      >
        <ResetPasswordRouter />
      </Suspense>
    </AuthCard>
  );
}
