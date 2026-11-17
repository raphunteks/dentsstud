'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginInput } from '@dentweb/shared-types';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { fieldErrors } from '@/lib/form';
import { Button, Field, Input, Skeleton } from '@/components/ui';
import { OtpStep } from '@/components/auth/otp-step';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const session = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  // Auto-login: If already authenticated with confirmed active session
  useEffect(() => {
    if (session.data?.user) {
      const destination = next && next.startsWith('/') && !next.startsWith('/login') ? next : session.data.user.role === 'SUPERADMIN' ? '/admin' : '/dashboard';
      router.replace(destination);
    } else if (session.isError) {
      if (typeof document !== 'undefined') {
        document.cookie = 'dw_auth=; Max-Age=0; path=/;';
        document.cookie = 'dw_sid=; Max-Age=0; path=/;';
      }
    }
  }, [session.data, session.isError, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = LoginInput.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ challengeId: string }>('/auth/login', { method: 'POST', json: parsed.data });
      setChallenge(r.challengeId);
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Tidak dapat masuk' });
    } finally {
      setBusy(false);
    }
  }

  if (challenge) return <OtpStep challengeId={challenge} email={email} next={next} onBack={() => setChallenge(null)} />;

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="font-display text-3xl font-medium ">Masuk</h1>
        <p className="mt-2 text-sm text-muted">Setelah password benar, kami kirim kode OTP ke email Anda.</p>
      </div>
      {errors.form && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
          {errors.form}
        </p>
      )}
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
      </Field>
      <Button type="submit" loading={busy} className="h-11">
        Lanjut
      </Button>
      <p className="text-sm text-muted">
        Belum punya akun?{' '}
        <Link href="/register" className="font-medium text-text underline underline-offset-4">
          Daftar
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[300px] place-items-center">
          <Skeleton className="h-8 w-40" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
