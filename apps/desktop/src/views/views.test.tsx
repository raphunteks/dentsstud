import { describe, it, expect } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLicensesView, AdminMembersView, AdminSystemView, AdminWorkflowsView, AdminProductionView, AdminQuotasView, AdminReleasesView, AdminSupportView } from './SuperadminViews';
import { AdminOfficeView } from './AdminOfficeView';
import { AdminSocialView, SocialView } from './SocialView';
import { HasilView } from './HasilView';
import { ErrorBoundary } from '../components/UI';
import { CHANNEL_NAMES } from '../../electron/ipc/channels';

describe('Desktop Superadmin and Member Views Integrity', () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  it('renders AdminLicensesView safely without throwing TypeError', () => {
    const html = renderToString(
      <QueryClientProvider client={qc}>
        <ErrorBoundary>
          <AdminLicensesView />
        </ErrorBoundary>
      </QueryClientProvider>
    );
    expect(html).toContain('Kelola Lisensi &amp; Device');
    expect(html).toContain('Semua Status');
  });

  it('renders HasilView safely with empty state and no hardcoded mock data', () => {
    const html = renderToString(
      <QueryClientProvider client={qc}>
        <ErrorBoundary>
          <HasilView onNavigate={() => {}} />
        </ErrorBoundary>
      </QueryClientProvider>
    );
    expect(html).toContain('Hasil Produksi Video');
    expect(html).not.toContain('Magic Com Biasa Nggak Punya Timer');
    expect(html).not.toContain('Freon AC Nggak Pernah Habis');
  });

  it('renders all superadmin views with valid HTML', () => {
    const views = [
      <AdminMembersView key="1" />,
      <AdminSystemView key="2" />,
      <AdminWorkflowsView key="3" />,
      <AdminProductionView key="4" />,
      <AdminQuotasView key="5" />,
      <AdminReleasesView key="6" />,
      <AdminSupportView key="7" />,
      <AdminOfficeView key="8" />,
      <AdminSocialView key="9" />,
      <SocialView key="10" />,
    ];

    for (const view of views) {
      const html = renderToString(
        <QueryClientProvider client={qc}>
          <ErrorBoundary>
            {view}
          </ErrorBoundary>
        </QueryClientProvider>
      );
      expect(html.length).toBeGreaterThan(50);
    }
  });

  it('ErrorBoundary getDerivedStateFromError sets error state correctly', () => {
    const err = new Error('Test intentional explosion');
    const state = ErrorBoundary.getDerivedStateFromError(err);
    expect(state.hasError).toBe(true);
    expect(state.error?.message).toBe('Test intentional explosion');
  });

  it('electron/preload/index.ts ALLOWED list matches 100% of electron/ipc/channels.ts', () => {
    const preloadPath = resolve(__dirname, '../../electron/preload/index.ts');
    const preloadSrc = readFileSync(preloadPath, 'utf8');
    const missing = CHANNEL_NAMES.filter((ch) => !preloadSrc.includes(`'${ch}'`));
    expect(missing).toEqual([]);
  });
});
