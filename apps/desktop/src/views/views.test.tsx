import { describe, it, expect } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLicensesView, AdminMembersView, AdminSystemView, AdminWorkflowsView, AdminProductionView, AdminQuotasView, AdminReleasesView, AdminSupportView } from './SuperadminViews';
import { AdminOfficeView } from './AdminOfficeView';
import { AdminSocialView, SocialView } from './SocialView';
import { AdminLmsView, LmsView } from './LmsView';
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
      <AdminLmsView key="11" />,
      <LmsView key="12" onNavigate={() => {}} />,
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

  it('enforces macOS 13–27 compatibility config (entitlements, builder, inside-out afterSign, GPU switches)', () => {
    const builderCfg = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8');
    const entitlements = readFileSync(resolve(__dirname, '../../build/entitlements.mac.plist'), 'utf8');
    const afterSignSrc = readFileSync(resolve(__dirname, '../../scripts/after-sign-mac.mjs'), 'utf8');
    const mainSrc = readFileSync(resolve(__dirname, '../../electron/main/index.ts'), 'utf8');

    for (const key of [
      'minimumSystemVersion: "13.0"',
      'hardenedRuntime: false',
      'afterSign: scripts/after-sign-mac.mjs',
      'LSMinimumSystemVersion: "13.0"',
      'NSLocalNetworkUsageDescription',
      'NSDocumentsFolderUsageDescription',
      'NSDownloadsFolderUsageDescription',
      'NSHighResolutionCapable: true',
      'NSSupportsAutomaticGraphicsSwitching: true',
      'format: UDZO',
      'internetEnabled: false',
    ]) {
      expect(builderCfg).toContain(key);
    }

    for (const ent of [
      'com.apple.security.cs.allow-jit',
      'com.apple.security.cs.allow-unsigned-executable-memory',
      'com.apple.security.cs.disable-library-validation',
      'com.apple.security.network.client',
      'com.apple.security.network.server',
      'com.apple.security.files.user-selected.read-write',
      'com.apple.security.files.downloads.read-write',
    ]) {
      expect(entitlements).toContain(ent);
    }

    expect(afterSignSrc).toContain('entitlements.mac.plist');
    expect(afterSignSrc).toContain('xattr');
    expect(afterSignSrc).not.toContain("'--deep'");
    expect(afterSignSrc).not.toContain("'--identifier'");
    expect(mainSrc).toContain("process.platform !== 'darwin'");
  });
});
