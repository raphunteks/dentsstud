'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Tabs } from '@/components/ui/extra';

type Tab = 'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH';
type Item =
  | { kind: 'result'; id: string; title: string; status: string; coverUrl: string | null; captionPreview: string; createdAt: string; revision: number; deletedAt: string | null }
  | { kind: 'run'; id: string; title: string; status: string; error: { message?: string } | null; createdAt: string; currentStage: string | null };

const TABS: { value: Tab; label: string }[] = [
  { value: 'READY', label: 'Siap upload' },
  { value: 'UPLOADED', label: 'Diunggah' },
  { value: 'FAILED', label: 'Gagal' },
  { value: 'ALL', label: 'Semua' },
  { value: 'TRASH', label: 'Sampah' },
];

export default function ResultsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('READY');
  const q = useQuery({ queryKey: ['results', tab], queryFn: () => api<Item[]>(`/results?tab=${tab}`) });
  const act = useMutation({
    mutationFn: ({ path, method }: { path: string; method: 'POST' | 'DELETE' }) => api(path, { method }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['results'] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHead eyebrow="Produksi" title="Hasil" />
      <Tabs label="Status hasil" value={tab} onChange={setTab} items={TABS} />
      <div className="mt-5">
        {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-card" />)}</div>}
        {q.data?.length === 0 && (
          <Empty
            title={tab === 'TRASH' ? 'Sampah kosong' : tab === 'FAILED' ? 'Tidak ada produksi gagal' : 'Belum ada video di sini'}
            body={tab === 'READY' ? 'Video yang lolos QC muncul di sini lengkap dengan caption, hashtag dan cover.' : 'Video berpindah tab sesuai statusnya.'}
            action={tab === 'READY' ? <Link href="/create-content" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Buat konten</Link> : undefined}
          />
        )}
        {!!q.data?.length && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.map((it) =>
              it.kind === 'run' ? (
                <li key={it.id} className="rounded-card border border-line bg-surface p-5">
                  <Status value="FAILED" />
                  <h3 className="mt-3 font-display text-lg font-medium">{it.title}</h3>
                  <p className="mt-1 text-sm text-muted">{it.error?.message ?? 'Produksi gagal'}</p>
                  <p className="mt-2 font-mono text-xs text-muted">{it.currentStage ?? '-'} · {fmtDate(it.createdAt)}</p>
                  <div className="mt-4 flex gap-2">
                    <Button className="h-9" onClick={() => act.mutate({ path: `/production/runs/${it.id}/resume`, method: 'POST' })}>Lanjutkan</Button>
                    <Link href={`/progress?run=${it.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 text-sm">Lihat log</Link>
                  </div>
                </li>
              ) : (
                <li key={it.id} className="group overflow-hidden rounded-card border border-line bg-surface">
                  <Link href={`/results/${it.id}`} className="block">
                    <div className="aspect-video overflow-hidden bg-surface-2">
                      {it.coverUrl ? <img src={it.coverUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="grid size-full place-items-center text-xs text-muted">Tanpa cover</div>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Status value={it.status} label={it.status === 'READY' ? 'Siap upload' : it.status === 'UPLOADED' ? 'Diunggah' : undefined} />
                        {it.revision > 1 && <span className="font-mono text-xs text-muted">Revisi {it.revision}</span>}
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-display text-base font-medium">{it.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{it.captionPreview}</p>
                      <p className="mt-2 font-mono text-xs text-muted">{fmtDate(it.createdAt)}</p>
                    </div>
                  </Link>
                  {tab === 'TRASH' && (
                    <div className="border-t border-line p-3">
                      <Button variant="ghost" className="h-9" onClick={() => act.mutate({ path: `/results/${it.id}/restore`, method: 'POST' })}>Pulihkan</Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </>
  );
}
