'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SessionUser } from '@dentweb/shared-types';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Field, Input } from '@/components/ui';
import { OtpStep } from '@/components/auth/otp-step';

function KelasLoginInner() {
  const sp = useSearchParams();
  const rawNext = sp.get('next');
  const safeNext = rawNext && rawNext.startsWith('/kelas') && !rawNext.startsWith('//') ? rawNext : '/kelas';
  const router = useRouter();
  const qc = useQueryClient();

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
      const r = await api<{ challengeId?: string; user?: SessionUser }>('/auth/login', {
        method: 'POST',
        json: { email: email.trim(), password },
      });
      if (r.challengeId) {
        setChallenge({ id: r.challengeId, email: email.trim() });
      } else if (r.user) {
        qc.setQueryData(['session'], { user: r.user });
        toast.success('Berhasil masuk ke Kelas DENTSWEB MOTION');
        router.replace(safeNext);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk. Periksa email dan kata sandi.');
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
            <h1 className="text-xl font-semibold tracking-tight">Masuk Kelas Member</h1>
          </div>
        </div>

        {challenge ? (
          <OtpStep challengeId={challenge.id} email={challenge.email} onBack={() => setChallenge(null)} next={safeNext} />
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label="Email Akun" id="kelas-email">
              <Input id="kelas-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@klinik.id" />
            </Field>
            <Field label="Kata Sandi" id="kelas-pass">
              <Input id="kelas-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              Masuk ke Kelas
            </Button>
            <div className="flex items-center justify-between pt-2 text-xs text-muted">
              <Link href="/kelas/register" className="text-accent hover:underline">Belum punya akun? Daftar Kelas</Link>
              <Link href="/login" className="hover:underline">Masuk Studio →</Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function KelasLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <KelasLoginInner />
    </Suspense>
  );
}
