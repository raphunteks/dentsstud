'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SessionUser } from '@dentweb/shared-types';
import { api, ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';

export function OtpStep({ challengeId, email, onBack, next }: { challengeId: string; email: string; onBack: () => void; next?: string | null }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e?: React.FormEvent, value = code) {
    e?.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(value)) return setError('Masukkan 6 digit kode dari email');
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ user: SessionUser }>('/auth/otp/verify', { method: 'POST', json: { challengeId, code: value } });
      qc.setQueryData(['session'], { user: r.user });
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : r.user.role === 'SUPERADMIN' ? '/admin' : '/dashboard';
      router.replace(target);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verifikasi gagal');
      setCode('');
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      await api('/auth/otp/resend', { method: 'POST', json: { challengeId } });
      toast.success('Kode baru dikirim');
      setCooldown(60);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengirim ulang');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="font-display text-3xl font-medium ">Cek email Anda</h1>
        <p className="mt-2 text-sm text-muted">
          Kode 6 digit dikirim ke <b className="text-text">{email}</b>. Berlaku 10 menit, sekali pakai.
        </p>
      </div>
      <Field id="otp" label="Kode OTP" error={error}>
        <Input
          ref={ref}
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          invalid={!!error}
          aria-describedby={error ? 'otp-err' : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(v);
            if (v.length === 6) void submit(undefined, v);
          }}
          className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
        />
      </Field>
      <Button type="submit" loading={busy} className="h-11">
        Verifikasi dan masuk
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted underline-offset-4 hover:text-text hover:underline">
          Ganti email
        </button>
        <button type="button" disabled={cooldown > 0} onClick={resend} className="text-accent underline-offset-4 hover:underline disabled:text-muted disabled:no-underline">
          {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim ulang kode'}
        </button>
      </div>
    </form>
  );
}
