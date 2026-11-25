'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Table, Tabs } from '@/components/ui/extra';

type Tab = 'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH';
interface Item {
  kind?: 'result' | 'run';
  id: string;
  title: string;
  status: string;
  coverUrl?: string | null;
  createdAt: string;
  revision?: number;
  userId?: string;
  ownerEmail?: string;
  error?: { message?: string } | null;
}
interface Detail {
  id?: string;
  userId?: string;
  videoUrl: string;
  coverUrl: string | null;
  title: string;
  social: { caption: string; hashtags: string[] } | null;
  qc: { passed: boolean } | null;
  factCheck: { verdict: { verified: number; unverified: number; contradicted: number } } | null;
}

export default function AdminResults() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-results', tab], queryFn: () => api<Item[]>(`/admin/results?tab=${tab}`) });
  const d = useQuery({ queryKey: ['admin-result', open], queryFn: () => api<Detail>(`/admin/results/${open}`), enabled: !!open });

  const del = useMutation({
    mutationFn: (id: string) => api(`/results/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Hasil dihapus ke sampah');
      setOpen(null);
      qc.invalidateQueries({ queryKey: ['admin-results'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHead eyebrow="09 · Superadmin" title="Hasil & Media" />
      <Tabs
        label="Status"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ALL', label: 'Semua' },
          { value: 'READY', label: 'Siap upload' },
          { value: 'UPLOADED', label: 'Diunggah' },
          { value: 'FAILED', label: 'Gagal' },
          { value: 'TRASH', label: 'Sampah' },
        ]}
      />
      <div className="mt-5">
        {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <Skeleton className="h-64 rounded-card" />}
        {q.data?.length === 0 && <Empty title="Belum ada hasil" body="Video hasil produksi semua member tercatat di sini." />}
        {!!q.data?.length && (
          <Table head={['', 'Judul', 'Pemilik', 'Status', 'Revisi', 'Dibuat', 'Aksi']} minWidth={860}>
            {q.data.map((r) => {
              const isRun = r.kind === 'run';
              return (
                <tr key={r.id} className={!isRun ? 'cursor-pointer hover:bg-surface-2' : undefined} onClick={() => !isRun && setOpen(r.id)}>
                  <td className="w-24">
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt="" className="aspect-video w-20 rounded object-cover" />
                    ) : (
                      <div className="aspect-video w-20 rounded bg-surface-2" />
                    )}
                  </td>
                  <td className="font-medium">
                    {isRun ? (
                      <div>
                        <span>{r.title}</span>
                        {r.error?.message && <p className="mt-0.5 text-xs text-bad">{r.error.message}</p>}
                      </div>
                    ) : (
                      <button className="text-left hover:underline" onClick={() => setOpen(r.id)}>
                        {r.title}
                      </button>
                    )}
                  </td>
                  <td>
                    {r.userId ? (
                      <Link
                        href={`/admin/members/${r.userId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {r.ownerEmail ?? `${r.userId.slice(0, 8)}…`}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td><Status value={r.status} /></td>
                  <td className="num font-mono">{r.revision ?? '—'}</td>
                  <td className="text-muted">{fmtDate(r.createdAt)}</td>
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    {!isRun && (
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`/api/v1/results/${r.id}/download`}
                          className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs hover:bg-surface-2"
                        >
                          Unduh
                        </a>
                        {tab !== 'TRASH' && (
                          <Button
                            variant="danger"
                            className="h-8 px-2.5 text-xs"
                            loading={del.isPending && del.variables === r.id}
                            onClick={() => confirm(`Hapus "${r.title}" ke sampah?`) && del.mutate(r.id)}
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title={d.data?.title ?? 'Hasil'}>
        {d.isError && <ErrorNote error={d.error} onRetry={() => d.refetch()} />}
        {d.isLoading && <Skeleton className="h-64" />}
        {d.data && (
          <div className="grid grid-cols-1 items-start gap-6 overflow-x-hidden lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <div className="min-w-0 w-full overflow-hidden rounded-xl bg-black">
              <video
                key={d.data.videoUrl || open}
                src={d.data.videoUrl || (open ? `/api/v1/results/${open}/download` : undefined)}
                poster={d.data.coverUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="min-h-[300px] max-h-[560px] w-full rounded-xl bg-black object-contain"
              />
            </div>
            <div className="grid min-w-0 w-full content-start gap-2 text-sm">
              <div className="flex flex-wrap gap-2 pb-2">
                {open && (
                  <a
                    href={`/api/v1/results/${open}/download`}
                    className="inline-flex h-9 items-center rounded-[10px] bg-accent px-3 text-xs font-medium text-accent-contrast"
                  >
                    Unduh MP4
                  </a>
                )}
                {open && (
                  <Button
                    variant="danger"
                    className="h-9 text-xs"
                    loading={del.isPending}
                    onClick={() => confirm('Hapus video ini ke sampah?') && del.mutate(open)}
                  >
                    Hapus
                  </Button>
                )}
              </div>
              <p>QC: {d.data.qc ? (d.data.qc.passed ? 'lulus' : 'gagal') : '—'}</p>
              {d.data.factCheck && (
                <p>
                  Cek fakta: {d.data.factCheck.verdict.verified} terverifikasi, {d.data.factCheck.verdict.unverified} belum, {d.data.factCheck.verdict.contradicted} bertentangan
                </p>
              )}
              <p className="whitespace-pre-wrap text-muted">{d.data.social?.caption}</p>
              <p className="text-muted">{d.data.social?.hashtags.join(' ')}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
