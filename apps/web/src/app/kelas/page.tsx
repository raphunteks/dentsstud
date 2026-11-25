'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, PageHead, Skeleton } from '@/components/ui';

interface Overview {
  stats: {
    completedLessons: number;
    totalLessons: number;
    percent: number;
    completedModules: number;
    totalModules: number;
    checklistDone: number;
    checklistTotal: number;
    promptsCopied: number;
    favoritePromptsCount: number;
  };
  nextLesson: { id: string; slug: string; title: string; moduleTitle?: string; duration?: string } | null;
  modules: { id: string; slug: string; title: string; subtitle: string; badge: string; completedCount: number; totalLessons: number }[];
  recentHistory: { lessonId: string; slug: string; title: string; at: string }[];
  latestUpdate: { version: string; title: string; releasedAt: string; highlights: string[] } | null;
  termOfDay: { category: string; term: string; definition: string; example: string } | null;
}

export default function KelasBerandaPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lms-overview'], queryFn: () => api<Overview>('/lms/overview') });
  const resetMut = useMutation({
    mutationFn: () => api('/lms/progress/reset', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Progres belajar direset');
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
      qc.invalidateQueries({ queryKey: ['lms-modules'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div className="grid gap-6">
      <PageHead
        eyebrow="DENTSWEB MOTION · BERANDA BELAJAR"
        title="Pusat Belajar DENTSWEB MOTION"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/kelas/racik" className="inline-flex h-10 items-center rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-surface-2">
              Racik Prompt
            </Link>
            {d.nextLesson && (
              <Link href={`/kelas/materi/${d.nextLesson.slug}`} className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">
                Lanjut Belajar →
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Materi Selesai', `${d.stats.completedLessons}/${d.stats.totalLessons} (${d.stats.percent}%)`],
          ['Modul Tuntas', `${d.stats.completedModules}/${d.stats.totalModules}`],
          ['Checklist Praktik', `${d.stats.checklistDone}/${d.stats.checklistTotal}`],
          ['Prompt Disalin', `${d.stats.promptsCopied} (${d.stats.favoritePromptsCount} fav)`],
        ].map(([label, val]) => (
          <Card key={label} className="grid gap-1 p-4">
            <span className="text-xs text-muted">{label}</span>
            <span className="font-mono text-lg font-semibold">{val}</span>
          </Card>
        ))}
      </div>

      {d.nextLesson && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-accent/5 p-5">
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">Rekomendasi Berikutnya</span>
            <h2 className="text-base font-semibold">{d.nextLesson.title}</h2>
            <p className="text-xs text-muted">{d.nextLesson.moduleTitle} · Durasi {d.nextLesson.duration}</p>
          </div>
          <Link href={`/kelas/materi/${d.nextLesson.slug}`} className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">
            Mulai Materi
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="grid gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Kurikulum 8 Modul</h3>
            <Link href="/kelas/materi" className="text-xs font-medium text-accent hover:underline">Lihat semua →</Link>
          </div>
          <div className="grid gap-2.5">
            {d.modules.map((m) => {
              const mpct = m.totalLessons ? Math.round((m.completedCount / m.totalLessons) * 100) : 0;
              return (
                <Link key={m.id} href="/kelas/materi" className="grid gap-1.5 rounded-xl border border-line p-3 hover:bg-surface-2/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{m.title}</span>
                    <span className="font-mono text-xs text-muted">{m.completedCount}/{m.totalLessons}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-accent transition-all" style={{ width: `${mpct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="grid content-start gap-4">
          {d.termOfDay && (
            <Card className="grid gap-2 p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Kamus Hari Ini · {d.termOfDay.category}</span>
              <h3 className="text-sm font-semibold">{d.termOfDay.term}</h3>
              <p className="text-xs text-muted leading-relaxed">{d.termOfDay.definition}</p>
              {d.termOfDay.example && <p className="rounded-lg bg-surface-2 p-2.5 text-[11px] text-text">Contoh: {d.termOfDay.example}</p>}
            </Card>
          )}

          {d.latestUpdate && (
            <Card className="grid gap-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Log Update Terbaru</span>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">{d.latestUpdate.version}</span>
              </div>
              <h3 className="text-sm font-semibold">{d.latestUpdate.title}</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                {d.latestUpdate.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
              <Link href="/kelas/update" className="pt-1 text-xs font-medium text-accent hover:underline">Lihat semua update →</Link>
            </Card>
          )}

          <Card className="flex items-center justify-between p-4">
            <span className="text-xs text-muted">Ingin mengulang progres dari 0%?</span>
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs"
              disabled={resetMut.isPending}
              onClick={() => confirm('Reset seluruh progres belajar Anda?') && resetMut.mutate()}
            >
              Reset Progres
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
