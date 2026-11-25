'use client';
import { useQuery } from '@tanstack/react-query';
import { api, fmtBytes } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton } from '@/components/ui';

interface SkillDownloadInfo {
  filename: string;
  version: string;
  sizeBytes: number;
  downloadUrl: string;
  contents: string[];
}

export default function KelasUnduhPage() {
  const q = useQuery({ queryKey: ['lms-skill-download'], queryFn: () => api<SkillDownloadInfo>('/lms/skill-download') });
  if (q.isLoading) return <Skeleton className="h-72 rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="PAKET SKILL RESMI" title="Download Skill DENTSWEB MOTION" />
      <Card className="grid gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-xs font-bold text-accent">v{d.version}</span>
              <h2 className="text-base font-semibold">{d.filename}</h2>
            </div>
            <p className="text-xs text-muted">Ukuran arsip: {fmtBytes(d.sizeBytes)} · Format ZIP siap ekstrak</p>
          </div>
          <a
            href={d.downloadUrl}
            download={d.filename}
            className="inline-flex h-10 items-center rounded-[10px] bg-accent px-5 text-sm font-medium text-accent-contrast hover:opacity-95"
          >
            Unduh {d.filename}
          </a>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/50 p-4">
          <p className="mb-2 text-xs font-semibold">Isi Paket Skill:</p>
          <ul className="space-y-1 font-mono text-xs text-muted">
            {d.contents.map((c) => <li key={c}>• {c}</li>)}
          </ul>
        </div>
      </Card>
    </div>
  );
}
