'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton } from '@/components/ui';
import { Select, Tabs } from '@/components/ui/extra';

interface P { id: string; name: string; width: number; height: number; fps: number; durationFrames: number; currentRevision: number; updatedAt: string }

export default function Projects() {
  const qc = useQueryClient();
  const router = useRouter();
  const [view, setView] = useState<'active' | 'trash'>('active');
  const q = useQuery({ queryKey: ['projects', view], queryFn: () => api<P[]>(`/projects${view === 'trash' ? '?trash=1' : ''}`) });
  const [f, setF] = useState({ name: '', format: '9:16' });
  const create = useMutation({ mutationFn: () => api<P>('/projects', { method: 'POST', json: f }), onSuccess: (p) => router.push(`/studio/editor/${p.id}`), onError: (e) => toast.error((e as Error).message) });
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: 'trash' | 'restore' }) => api(a === 'trash' ? `/projects/${id}` : `/projects/${id}/restore`, { method: a === 'trash' ? 'DELETE' : 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }) });
  return (
    <>
      <PageHead eyebrow="Studio" title="Motion Editor & Projects" />
      <Card className="mb-6 p-5">
        <form className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
          <Field id="pn" label="Nama project"><Input id="pn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field id="pf" label="Format"><Select id="pf" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="9:16">9:16 Reels/TikTok</option><option value="16:9">16:9 YouTube</option><option value="1:1">1:1 Feed</option></Select></Field>
          <Button type="submit" loading={create.isPending} disabled={!f.name.trim()}>Buat & buka editor</Button>
        </form>
      </Card>
      <div className="mb-4"><Tabs label="Tampilan" value={view} onChange={setView} items={[{ value: 'active', label: 'Project' }, { value: 'trash', label: 'Sampah' }]} /></div>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <Skeleton className="h-40 rounded-card" />}
      {q.data?.length === 0 && <Empty title={view === 'trash' ? 'Sampah kosong' : 'Belum ada project'} body="Project tersimpan otomatis dan bisa disunting offline di aplikasi desktop." />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((p) => (
          <Card key={p.id} as="article" className="grid gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              {view === 'active' ? <Link href={`/studio/editor/${p.id}`} className="font-medium hover:underline">{p.name}</Link> : <span className="font-medium">{p.name}</span>}
              <span className="font-mono text-xs text-muted">{p.width}×{p.height}</span>
            </div>
            <p className="text-xs text-muted">{(p.durationFrames / p.fps).toFixed(1)} detik · rev {p.currentRevision} · {fmtDate(p.updatedAt)}</p>
            <div>{view === 'active' ? <Button variant="quiet" className="h-8" onClick={() => act.mutate({ id: p.id, a: 'trash' })}>Pindah ke sampah</Button> : <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: p.id, a: 'restore' })}>Pulihkan</Button>}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
