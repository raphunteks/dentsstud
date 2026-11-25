'use client';
import { PageHead } from '@/components/ui';
import { MultiProviderPanel } from '@/components/ai/multi-provider-panel';

export default function ClaudeSettingsPage() {
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Koneksi AI Provider & Auto-Switch" />
      <MultiProviderPanel />
    </>
  );
}
