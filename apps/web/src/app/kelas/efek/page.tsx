'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';

interface EffectItem {
  id: string;
  category: string;
  name: string;
  description: string;
  useCase: string;
  promptSnippet: string;
}

export default function KelasEfekPage() {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const query = useQuery({
    queryKey: ['lms-effects', cat, q],
    queryFn: () => {
      const p = new URLSearchParams();
      if (cat) p.set('category', cat);
      if (q.trim()) p.set('q', q.trim());
      return api<{ items: EffectItem[]; categories: string[] }>(`/lms/effects?${p.toString()}`);
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="24 EFEK · 8 KATEGORI" title="Video Efek DENTSWEB MOTION" />
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari efek video..." />
        <button type="button" onClick={() => setCat('')} className={`rounded-lg px-3 py-2 text-xs font-medium ${!cat ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
          Semua
        </button>
        {(query.data?.categories ?? []).map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-lg px-3 py-2 text-xs font-medium ${cat === c ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(query.data?.items ?? []).map((e) => (
          <Card key={e.id} className="flex flex-col justify-between gap-2.5 p-4">
            <div className="grid gap-1.5">
              <span className="w-fit rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{e.category}</span>
              <h3 className="text-sm font-semibold">{e.name}</h3>
              <p className="text-xs text-muted">{e.description}</p>
              <p className="text-[11px] text-text"><span className="font-medium">Kapan dipakai:</span> {e.useCase}</p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
              <code className="truncate text-[10px] text-muted">{e.promptSnippet}</code>
              <Button
                variant="ghost"
                className="h-7 shrink-0 px-2.5 text-[11px]"
                onClick={() => navigator.clipboard.writeText(e.promptSnippet).then(() => toast.success('Snippet efek disalin'))}
              >
                Salin
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
