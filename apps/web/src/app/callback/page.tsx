'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Card, PageHead, Skeleton } from '@/components/ui';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const handled = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    let code = searchParams.get('code');
    let state = searchParams.get('state');
    let error = searchParams.get('error');

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashRaw = window.location.hash.replace(/^#\/?/, '');
      const hashParams = new URLSearchParams(hashRaw);
      code = code || hashParams.get('code');
      state = state || hashParams.get('state');
      error = error || hashParams.get('error');
      if (!state && hashRaw && !hashRaw.includes('=')) {
        state = hashRaw;
      }
    }

    if (code && code.includes('#')) {
      const parts = code.split('#');
      code = parts[0]?.trim() || '';
      if (!state && parts[1]) state = parts[1]?.trim() || '';
    }

    const dest = session.data?.user.role === 'SUPERADMIN' ? '/admin/ai-providers' : '/settings/claude';

    if (error) {
      setStatus('error');
      setErrorMessage(`Otorisasi Claude ditolak: ${error}`);
      toast.error(`Otorisasi Claude ditolak: ${error}`);
      setTimeout(() => router.replace(dest), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage('Parameter callback OAuth tidak lengkap (kode atau state tidak ditemukan).');
      toast.error('Parameter callback OAuth tidak lengkap');
      setTimeout(() => router.replace(dest), 3000);
      return;
    }

    api(`/ai/connections/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(() => {
        setStatus('success');
        toast.success('Akun Claude berhasil terhubung via OAuth (9Router)!');
        try {
          window.location.href = 'dentsweb://oauth-success';
        } catch {}
        setTimeout(() => router.replace(dest), 1500);
      })
      .catch((e) => {
        setStatus('error');
        const msg = e instanceof ApiError ? e.message : 'Gagal menyelesaikan otorisasi Claude';
        setErrorMessage(msg);
        toast.error(msg);
        setTimeout(() => router.replace(dest), 4000);
      });
  }, [router, searchParams, session.data?.user.role]);

  const targetPath = session.data?.user.role === 'SUPERADMIN' ? '/admin/ai-providers' : '/settings/claude';

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-4">
      <Card className="w-full p-8 text-center shadow-lg">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <h2 className="text-xl font-semibold">Menyambungkan ke Claude AI...</h2>
            <p className="mt-2 text-sm text-muted">Mohon tunggu, token otorisasi sedang diverifikasi dan ditukar ke server.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-emerald-600">Berhasil Terhubung!</h2>
            <p className="mt-2 text-sm text-muted">Akun Claude Anda aktif via OAuth. Mengalihkan ke dashboard...</p>
            <div className="mt-6 flex flex-col gap-2">
              <a
                href="dentsweb://oauth-success"
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow hover:bg-amber-400 transition-colors"
              >
                Buka DENTSWEB STUDIO Desktop
              </a>
              <Button onClick={() => router.replace(targetPath)} variant="ghost" className="w-full">
                Kembali ke Dashboard Web
              </Button>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-rose-600">Otorisasi Gagal atau Kedaluwarsa</h2>
            <p className="mt-2 text-sm text-muted">{errorMessage}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={async () => {
                  try {
                    const r = await api<{ authorizeUrl: string }>('/ai/connections/start', {
                      method: 'POST',
                      json: {
                        provider: 'anthropic',
                        method: 'OAUTH_PKCE',
                        redirectUri: typeof window !== 'undefined' && (
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.origin.includes('localhost')
                        )
                          ? 'http://localhost:3000/callback'
                          : 'https://platform.claude.com/oauth/code/callback',
                      },
                    });
                    window.location.href = r.authorizeUrl;
                  } catch (e) {
                    router.replace(targetPath);
                  }
                }}
                className="w-full"
              >
                Coba Otorisasi Lagi
              </Button>
              <Button onClick={() => router.replace(targetPath)} variant="ghost" className="w-full">
                Kembali ke Pengaturan
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center">
          <Skeleton className="h-40 w-80 rounded-xl" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
