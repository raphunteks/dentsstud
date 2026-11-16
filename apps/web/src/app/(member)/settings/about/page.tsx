'use client';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, PageHead } from '@/components/ui';

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';

export default function AboutPage() {
  const check = useMutation({
    mutationFn: async () => {
      const [mac, win] = await Promise.all([
        api<{ version: string } | null>('/releases/latest?platform=darwin&arch=arm64'),
        api<{ version: string } | null>('/releases/latest?platform=win32&arch=x64'),
      ]);
      return { mac, win };
    },
  });
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Tentang" />
      <Card className="grid gap-4 p-6">
        <p>
          DENTSWEB STUDIO <span className="num text-muted">web v{VERSION}</span>
        </p>
        <p className="text-sm text-muted">Create Motion. Powered by AI. Lisensi nonkomersial.</p>
        <div>
          <Button variant="ghost" loading={check.isPending} onClick={() => check.mutate()}>
            Cek pembaruan desktop
          </Button>
        </div>
        {check.data && (
          <p className="text-sm" role="status">
            macOS: {check.data.mac?.version ?? 'belum ada rilis'} · Windows: {check.data.win?.version ?? 'belum ada rilis'}
          </p>
        )}
        {check.isError && <p className="text-sm text-bad">{(check.error as Error).message}</p>}
      </Card>
    </>
  );
}
