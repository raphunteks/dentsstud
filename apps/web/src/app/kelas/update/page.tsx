'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton } from '@/components/ui';

interface UpdateItem {
  id: string;
  version: string;
  title: string;
  releasedAt: string;
  highlights: string[];
}

export default function KelasUpdatePage() {
  const q = useQuery({ queryKey: ['lms-updates'], queryFn: () => api<{ items: UpdateItem[] }>('/lms/updates') });
  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="CHANGELOG · DENTSWEB MOTION" title="Log Update Skill & Kurikulum" />
      <div className="grid gap-4">
        {(q.data?.items ?? []).map((u) => (
          <Card key={u.id} className="grid gap-2.5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent/15 px-2.5 py-0.5 font-mono text-xs font-bold text-accent">{u.version}</span>
                <h3 className="text-sm font-semibold">{u.title}</h3>
              </div>
              <span className="font-mono text-xs text-muted">{u.releasedAt}</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              {u.highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
