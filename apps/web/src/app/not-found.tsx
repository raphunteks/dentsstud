import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="num font-mono text-xs text-muted">404</p>
        <h1 className="mt-2 font-display text-2xl font-medium">Halaman tidak ditemukan</h1>
        <Link href="/dashboard" className="mt-5 inline-flex h-11 items-center rounded-[10px] bg-accent px-5 text-sm font-medium text-accent-contrast">Ke beranda</Link>
      </div>
    </main>
  );
}
