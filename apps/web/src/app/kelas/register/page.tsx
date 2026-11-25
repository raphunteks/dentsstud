'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Field, Input } from '@/components/ui';
import { OtpStep } from '@/components/auth/otp-step';

export default function KelasRegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [challenge, setChallenge] = useState<{ id: string; email: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ challengeId: string }>('/auth/register', {
        method: 'POST',
        json: { displayName: displayName.trim(), email: email.trim(), password },
      });
      setChallenge({ id: r.challengeId, email: email.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registrasi gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.svg" alt="DENTSWEB MOTION" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">DENTSWEB MOTION · LMS</p>
            <h1 className="text-xl font-semibold tracking-tight">Daftar Kelas Member</h1>
          </div>
        </div>

        {challenge ? (
          <OtpStep challengeId={challenge.id} email={challenge.email} onBack={() => setChallenge(null)} next="/kelas" />
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label="Nama Lengkap" id="reg-name">
              <Input id="reg-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="drg. Nama Anda" />
            </Field>
            <Field label="Email" id="reg-email">
              <Input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@klinik.id" />
            </Field>
            <Field label="Kata Sandi (min. 8 karakter)" id="reg-pass">
              <Input id="reg-pass" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" />
            </Field>
            {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              Daftar & Verifikasi OTP
            </Button>
            <div className="flex items-center justify-between pt-2 text-xs text-muted">
              <Link href="/kelas/login" className="text-accent hover:underline">Sudah punya akun? Masuk Kelas</Link>
              <Link href="/login" className="hover:underline">Portal Studio →</Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
