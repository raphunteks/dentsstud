import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: { default: 'DENTWEB STUDIO — Create Motion. Powered by AI.', template: '%s · DENTWEB STUDIO' },
  description: 'Platform produksi motion video dengan tim AI multi-agent: riset, naskah, cek fakta, render, QC, dan paket media sosial.',
  applicationName: 'DENTWEB STUDIO',
};
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f2ee' },
    { media: '(prefers-color-scheme: dark)', color: '#141210' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
          Lewati ke konten
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
