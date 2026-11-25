'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton } from '@/components/ui';

interface ModuleItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  badge: string;
  completedCount: number;
  totalLessons: number;
  completed: boolean;
  lessons: {
    id: string;
    slug: string;
    title: string;
    duration: string;
    summary: string;
    checklistCount: number;
    checkedCount: number;
    completed: boolean;
  }[];
}

export default function KelasMateriPage() {
  const q = useQuery({ queryKey: ['lms-modules'], queryFn: () => api<{ items: ModuleItem[] }>('/lms/modules') });
  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="KURIKULUM · 8 MODUL" title="Daftar Kelas DENTSWEB MOTION" />
      <div className="grid gap-4">
        {(q.data?.items ?? []).map((m) => (
          <Card key={m.id} className="grid gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{m.title}</h2>
                  {m.badge && <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">{m.badge}</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{m.subtitle}</p>
              </div>
              <span className="font-mono text-xs text-muted">
                {m.completedCount}/{m.totalLessons} selesai
              </span>
            </div>

            <div className="grid gap-2 border-t border-line pt-3">
              {m.lessons.map((l) => (
                <Link
                  key={l.id}
                  href={`/kelas/materi/${l.slug}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/70 px-3.5 py-2.5 transition hover:border-accent/50 hover:bg-surface-2/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                        l.completed ? 'border-accent bg-accent text-accent-contrast' : 'border-line text-muted'
                      }`}
                    >
                      {l.completed ? '✓' : '·'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="truncate text-xs text-muted">{l.summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-muted">
                    <span>Checklist {l.checkedCount}/{l.checklistCount}</span>
                    <span>{l.duration}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
