'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LoginInput } from '@dentweb/shared-types';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { fieldErrors } from '@/lib/form';
import { Button, Field, Input, Skeleton } from '@/components/ui';
import { OtpStep } from '@/components/auth/otp-step';

function isSafeNext(next: string | null): next is string {
  return Boolean(next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login'));
}

function ForgotPasswordFlow({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Masukkan email akun Anda');
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ challengeId?: string; message?: string }>('/auth/password/forgot', {
        method: 'POST',
        json: { email: email.trim() },
      });
      setChallengeId(r.challengeId ?? 'pending');
      toast.success('Jika email terdaftar, kode OTP reset password telah dikirim.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim kode reset');
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 digit kode OTP');
    if (newPassword.length < 8) return setError('Password baru minimal 8 karakter');
    setBusy(true);
    setError(undefined);
    try {
      await api('/auth/password/reset', {
        method: 'POST',
        json: {
          email: email.trim(),
          ...(challengeId && challengeId !== 'pending' ? { challengeId } : {}),
          code,
          newPassword,
        },
      });
      toast.success('Password berhasil diubah. Silakan masuk kembali.');
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mereset password');
    } finally {
      setBusy(false);
    }
  }

  if (!challengeId) {
    return (
      <form onSubmit={requestCode} className="grid gap-5" noValidate>
        <div>
          <h1 className="font-display text-3xl font-medium">Lupa Password</h1>
          <p className="mt-2 text-sm text-muted">Masukkan email Anda untuk menerima kode OTP 6 digit guna mengatur ulang password.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <Field id="fp-email" label="Email">
          <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} className="h-11">
          Kirim kode reset
        </Button>
        <button type="button" onClick={onBack} className="text-left text-sm text-muted underline-offset-4 hover:text-text hover:underline">
          ← Kembali ke halaman masuk
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitReset} className="grid gap-5" noValidate>
      <div>
        <h1 className="font-display text-3xl font-medium">Atur Password Baru</h1>
        <p className="mt-2 text-sm text-muted">
          Masukkan kode OTP 6 digit yang dikirim ke <b className="text-text">{email}</b> beserta password baru Anda.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <Field id="fp-code" label="Kode OTP (6 digit)">
        <Input
          id="fp-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="font-mono tracking-[0.35em]"
        />
      </Field>
      <Field id="fp-newpw" label="Password baru" hint="Minimal 8 karakter">
        <Input id="fp-newpw" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy} className="h-11">
        Simpan password baru
      </Button>
      <button type="button" onClick={onBack} className="text-left text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        ← Kembali ke halaman masuk
      </button>
    </form>
  );
}

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
  const [forgot, setForgot] = useState(false);

  // Auto-login: If already authenticated with confirmed active session
  useEffect(() => {
    if (session.data?.user) {
      const destination = isSafeNext(next) ? next : session.data.user.role === 'SUPERADMIN' ? '/admin' : '/dashboard';
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

  if (forgot) return <ForgotPasswordFlow initialEmail={email} onBack={() => setForgot(false)} />;
  if (challenge) return <OtpStep challengeId={challenge} email={email} next={isSafeNext(next) ? next : null} onBack={() => setChallenge(null)} />;

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
      <div className="-mt-2 text-right">
        <button type="button" onClick={() => setForgot(true)} className="text-xs font-medium text-accent underline-offset-4 hover:underline cursor-pointer">
          Lupa password?
        </button>
      </div>
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
