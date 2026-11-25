'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, PageHead, Skeleton } from '@/components/ui';
import { Textarea } from '@/components/ui/extra';

interface LessonDetail {
  id: string;
  moduleTitle: string;
  slug: string;
  title: string;
  duration: string;
  videoUrl: string;
  chapters: { time: string; label: string }[];
  summary: string;
  checklist: string[];
  lessonPrompt: string;
  completed: boolean;
  checkedItems: number[];
  prevLesson: { slug: string; title: string } | null;
  nextLesson: { slug: string; title: string } | null;
}

function parseSeconds(mmss: string): number {
  const parts = mmss.split(':').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) return parts[0]! * 60 + parts[1]!;
  return 0;
}

export default function LessonPlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [promptDraft, setPromptDraft] = useState('');

  const q = useQuery({ queryKey: ['lms-lesson', slug], queryFn: () => api<LessonDetail>(`/lms/lessons/${slug}`) });

  useEffect(() => {
    if (q.data) setPromptDraft(q.data.lessonPrompt ?? '');
  }, [q.data]);

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['lms-lesson', slug] });
    qc.invalidateQueries({ queryKey: ['lms-modules'] });
    qc.invalidateQueries({ queryKey: ['lms-overview'] });
  };

  const completeMut = useMutation({
    mutationFn: (completed: boolean) => api(`/lms/lessons/${q.data!.id}/complete`, { method: 'POST', json: { completed } }),
    onSuccess: (_res, completed) => (toast.success(completed ? 'Materi ditandai selesai' : 'Status selesai dibatalkan'), inv()),
    onError: (e) => toast.error((e as Error).message),
  });

  const checkMut = useMutation({
    mutationFn: ({ index, checked }: { index: number; checked: boolean }) =>
      api(`/lms/lessons/${q.data!.id}/checklist`, { method: 'POST', json: { index, checked } }),
    onSuccess: () => inv(),
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <Skeleton className="h-[70vh] rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;

  return (
    <div className="grid gap-6">
      <PageHead
        eyebrow={<Link href="/kelas/materi" className="hover:underline">← {d.moduleTitle}</Link>}
        title={d.title}
        actions={
          <Button
            variant={d.completed ? 'ghost' : 'primary'}
            disabled={completeMut.isPending}
            onClick={() => completeMut.mutate(!d.completed)}
          >
            {d.completed ? '✓ Sudah Selesai' : 'Tandai Selesai'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          <Card className="overflow-hidden">
            <video
              ref={videoRef}
              key={d.videoUrl || d.id}
              src={d.videoUrl || undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
            />
            {d.chapters.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-line p-3">
                {d.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = parseSeconds(ch.time);
                        void videoRef.current.play().catch(() => undefined);
                      }
                    }}
                    className="rounded-lg border border-line bg-surface-2/60 px-2.5 py-1 text-xs hover:border-accent"
                  >
                    <span className="mr-1.5 font-mono text-accent">{ch.time}</span>
                    {ch.label}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="grid gap-2 p-5">
            <h3 className="text-sm font-semibold">Ringkasan Materi ({d.duration})</h3>
            <p className="text-sm leading-relaxed text-muted">{d.summary}</p>
          </Card>

          <Card className="grid gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Prompt Praktik Materi (Bisa Diedit)</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  onClick={() => navigator.clipboard.writeText(promptDraft).then(() => toast.success('Prompt disalin'))}
                >
                  Salin Prompt
                </Button>
                <Link
                  href={`/create-content?topic=${encodeURIComponent(promptDraft)}`}
                  className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-medium text-accent-contrast"
                >
                  Kirim ke Buat Konten →
                </Link>
              </div>
            </div>
            <Textarea rows={4} value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} />
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card className="grid gap-3 p-5">
            <h3 className="text-sm font-semibold">
              Checklist Praktik ({d.checkedItems.length}/{d.checklist.length})
            </h3>
            <div className="grid gap-2">
              {d.checklist.map((item, idx) => {
                const checked = d.checkedItems.includes(idx);
                return (
                  <label key={idx} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-2.5 text-xs hover:bg-surface-2/50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => checkMut.mutate({ index: idx, checked: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span className={checked ? 'line-through text-muted' : 'text-text'}>{item}</span>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card className="grid gap-2 p-4">
            {d.prevLesson && (
              <Link href={`/kelas/materi/${d.prevLesson.slug}`} className="rounded-xl border border-line px-3 py-2 text-xs hover:bg-surface-2">
                ← Sebelumnya: <span className="font-medium">{d.prevLesson.title}</span>
              </Link>
            )}
            {d.nextLesson && (
              <Link href={`/kelas/materi/${d.nextLesson.slug}`} className="rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-accent hover:bg-accent/15">
                Selanjutnya: <span className="font-medium">{d.nextLesson.title}</span> →
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
