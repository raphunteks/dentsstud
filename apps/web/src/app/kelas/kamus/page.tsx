'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';

interface GlossaryItem {
  id: string;
  category: string;
  term: string;
  definition: string;
  example: string;
}

function KamusInner() {
  const sp = useSearchParams();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState(sp.get('q') ?? '');

  const query = useQuery({
    queryKey: ['lms-glossary', cat, q],
    queryFn: () => {
      const p = new URLSearchParams();
      if (cat) p.set('category', cat);
      if (q.trim()) p.set('q', q.trim());
      return api<{ items: GlossaryItem[]; categories: string[] }>(`/lms/glossary?${p.toString()}`);
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="20 ISTILAH · 5 KATEGORI" title="Kamus Motion" />
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari istilah motion..." />
        <button type="button" onClick={() => setCat('')} className={`rounded-lg px-3 py-2 text-xs font-medium ${!cat ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
          Semua
        </button>
        {(query.data?.categories ?? []).map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-lg px-3 py-2 text-xs font-medium ${cat === c ? 'bg-accent text-accent-contrast' : 'border border-line'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(query.data?.items ?? []).map((g) => (
          <Card key={g.id} className="grid gap-1.5 p-4">
            <span className="w-fit rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{g.category}</span>
            <h3 className="text-sm font-semibold">{g.term}</h3>
            <p className="text-xs leading-relaxed text-muted">{g.definition}</p>
            {g.example && <p className="mt-1 rounded-lg bg-surface-2/70 p-2 text-[11px]">Contoh: {g.example}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function KelasKamusPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <KamusInner />
    </Suspense>
  );
}
