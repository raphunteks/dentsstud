'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Card, PageHead, Skeleton } from '@/components/ui';

export default function ClaudeOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      toast.error(`Otorisasi Claude ditolak: ${error}`);
      router.replace('/settings/claude');
      return;
    }

    if (!code || !state) {
      toast.error('Parameter callback OAuth tidak lengkap');
      router.replace('/settings/claude');
      return;
    }

    api(`/ai/connections/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(() => {
        toast.success('Akun Claude berhasil terhubung via OAuth (9Router)!');
        router.replace('/settings/claude');
      })
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : 'Gagal menyelesaikan otorisasi Claude');
        router.replace('/settings/claude');
      });
  }, [router, searchParams]);

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Menyambungkan Claude..." />
      <div className="max-w-md">
        <Card className="p-6 text-center">
          <p className="font-medium">Memproses otorisasi OAuth...</p>
          <p className="mt-2 text-sm text-muted">Mohon tunggu, kredensial sedang ditukar dan divalidasi ke server.</p>
          <Skeleton className="mt-4 h-2 w-full" />
        </Card>
      </div>
    </>
  );
}
