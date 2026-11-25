'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';

interface PromptItem {
  id: string;
  stage: string;
  title: string;
  description: string;
  promptText: string;
  tags: string[];
  isFavorite: boolean;
}

function PromptLibraryInner() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [stage, setStage] = useState('');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [favOnly, setFavOnly] = useState(false);

  const query = useQuery({
    queryKey: ['lms-prompts', stage, q, favOnly],
    queryFn: () => {
      const p = new URLSearchParams();
      if (stage) p.set('stage', stage);
      if (q.trim()) p.set('q', q.trim());
      if (favOnly) p.set('fav', '1');
      return api<{ items: PromptItem[]; stages: string[] }>(`/lms/prompts?${p.toString()}`);
    },
  });

  const favMut = useMutation({
    mutationFn: (id: string) => api(`/lms/prompts/${id}/favorite`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-prompts'] });
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
    },
  });

  const copyMut = useMutation({
    mutationFn: (id: string) => api(`/lms/prompts/${id}/copy`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lms-overview'] }),
  });

  if (query.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="24 PROMPT · 7 TAHAP" title="Koleksi Prompt DENTSWEB MOTION" />
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari prompt..." />
        <button
          type="button"
          onClick={() => setFavOnly((f) => !f)}
          className={`h-10 rounded-xl border px-3 text-xs font-medium ${favOnly ? 'border-accent bg-accent/15 text-accent' : 'border-line'}`}
        >
          {favOnly ? '★ Favorit Saja' : '☆ Semua Prompt'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setStage('')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!stage ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
          Semua Tahap
        </button>
        {(query.data?.stages ?? []).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStage(st)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${stage === st ? 'bg-accent text-accent-contrast' : 'border border-line'}`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(query.data?.items ?? []).map((p) => (
          <Card key={p.id} className="grid gap-2.5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{p.stage}</span>
                <h3 className="mt-1 text-sm font-semibold">{p.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => favMut.mutate(p.id)}
                className={`text-sm ${p.isFavorite ? 'text-accent' : 'text-muted hover:text-text'}`}
                title="Favorit"
              >
                {p.isFavorite ? '★' : '☆'}
              </button>
            </div>
            <p className="text-xs text-muted">{p.description}</p>
            <p className="rounded-xl bg-surface-2/70 p-3 font-mono text-[11px] leading-relaxed">{p.promptText}</p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(p.promptText).then(() => toast.success('Prompt disalin'));
                  copyMut.mutate(p.id);
                }}
              >
                Salin
              </Button>
              <Link
                href={`/create-content?topic=${encodeURIComponent(p.promptText)}`}
                className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-medium text-accent-contrast"
              >
                Pakai di Studio →
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function KelasPromptPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <PromptLibraryInner />
    </Suspense>
  );
}
