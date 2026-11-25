'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';

interface RecipeItem {
  id: string;
  category: string;
  title: string;
  description: string;
  palette: string[];
  fonts: string;
  pacing: string;
  modeCerita: string;
  promptTemplate: string;
}

export default function KelasGayaPage() {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['lms-recipes', cat, q],
    queryFn: () => {
      const p = new URLSearchParams();
      if (cat) p.set('category', cat);
      if (q.trim()) p.set('q', q.trim());
      return api<{ items: RecipeItem[]; categories: string[] }>(`/lms/recipes?${p.toString()}`);
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="12 RESEP GAYA & MODE CERITA" title="Resep Gaya DENTSWEB MOTION" />
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari gaya atau mode cerita..." />
        <button type="button" onClick={() => setCat('')} className={`rounded-lg px-3 py-2 text-xs font-medium ${!cat ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
          Semua
        </button>
        {(query.data?.categories ?? []).map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-lg px-3 py-2 text-xs font-medium ${cat === c ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(query.data?.items ?? []).map((r) => (
          <Card key={r.id} className="flex flex-col justify-between gap-3 p-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{r.category}</span>
                <span className="text-[11px] font-medium text-accent">{r.modeCerita}</span>
              </div>
              <h3 className="text-sm font-semibold">{r.title}</h3>
              <p className="text-xs text-muted">{r.description}</p>
              <div className="flex items-center gap-1.5 pt-1">
                {r.palette.map((hex) => (
                  <span key={hex} className="h-5 w-5 rounded-md border border-line" style={{ backgroundColor: hex }} title={hex} />
                ))}
              </div>
              <p className="font-mono text-[11px] text-muted">Font: {r.fonts} · {r.pacing}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-2.5">
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => navigator.clipboard.writeText(r.promptTemplate).then(() => toast.success('Resep gaya disalin'))}
              >
                Salin Resep
              </Button>
              <Link
                href={`/create-content?topic=${encodeURIComponent(r.promptTemplate)}`}
                className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-medium text-accent-contrast"
              >
                Gunakan →
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
