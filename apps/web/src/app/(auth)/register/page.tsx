'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterInput } from '@dentweb/shared-types';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { fieldErrors } from '@/lib/form';
import { Button, Field, Input } from '@/components/ui';
import { OtpStep } from '@/components/auth/otp-step';

export default function RegisterPage() {
  const router = useRouter();
  const session = useSession();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session.data?.user) {
      router.replace(session.data.user.role === 'SUPERADMIN' ? '/admin' : '/dashboard');
    } else if (session.isError) {
      if (typeof document !== 'undefined') {
        document.cookie = 'dw_auth=; Max-Age=0; path=/;';
        document.cookie = 'dw_sid=; Max-Age=0; path=/;';
      }
    }
  }, [session.data, session.isError, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = RegisterInput.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ challengeId: string }>('/auth/register', { method: 'POST', json: parsed.data });
      setChallenge(r.challengeId);
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Pendaftaran gagal' });
    } finally {
      setBusy(false);
    }
  }

  if (challenge) return <OtpStep challengeId={challenge} email={form.email} onBack={() => setChallenge(null)} />;

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="font-display text-3xl font-medium ">Buat akun</h1>
        <p className="mt-2 text-sm text-muted">Akses produksi aktif setelah Superadmin memberi lisensi nonkomersial.</p>
      </div>
      {errors.form && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
          {errors.form}
        </p>
      )}
      <Field id="displayName" label="Nama" error={errors.displayName}>
        <Input id="displayName" autoComplete="name" value={form.displayName} onChange={set('displayName')} invalid={!!errors.displayName} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />
      </Field>
      <Field id="password" label="Password" hint="Minimal 10 karakter, berisi huruf dan angka." error={errors.password}>
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />
      </Field>
      <Button type="submit" loading={busy} className="h-11">
        Daftar dan kirim kode
      </Button>
      <p className="text-sm text-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-medium text-text underline underline-offset-4">
          Masuk
        </Link>
      </p>
    </form>
  );
}
