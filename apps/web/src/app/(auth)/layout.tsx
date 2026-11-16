import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mark } from '@/components/ui';

const STAGES = ['Riset', 'Naskah', 'Cek fakta', 'Render', 'QC', 'Sosmed'];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(440px,520px)]">
      <aside data-theme="dark" className="relative hidden overflow-hidden bg-bg p-10 text-text lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="w-fit" aria-label="Beranda DENTSWEB STUDIO">
          <Mark className="text-lg" />
        </Link>
        {/* The six production stages as edit tracks; each block is a stage's share of one run. */}
        <div aria-hidden className="grid gap-2.5">
          {STAGES.map((s, i) => (
            <div key={s} className="grid grid-cols-[88px_1fr] items-center gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{s}</span>
              <div className="relative h-7 rounded-md bg-surface-2">
                <span className="track absolute inset-y-1 rounded-[5px] bg-accent" style={{ left: `${4 + i * 14}%`, width: `${12 + ((i * 5) % 9)}%`, animationDelay: `${i * 120}ms` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="max-w-sm font-display text-[32px] font-medium leading-[1.08] tracking-[-0.03em]">
          Pesan video dalam bahasa Indonesia. Tim agent mengerjakan riset sampai caption.
        </p>
      </aside>
      <main id="main" className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
