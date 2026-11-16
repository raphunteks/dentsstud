'use client';
import { useEffect } from 'react';
import { reportError } from '@/lib/report-error';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Terjadi kesalahan</p>
        <h1 className="mt-2 font-display text-2xl font-medium">Halaman ini gagal dimuat</h1>
        <p className="mt-2 text-sm text-muted">Kesalahan sudah dicatat otomatis untuk tim. Coba muat ulang; data Anda tidak terpengaruh.</p>
        <button onClick={reset} className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-accent px-5 text-sm font-medium text-accent-contrast">Coba lagi</button>
      </div>
    </main>
  );
}
