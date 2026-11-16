'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fmtDate } from '@/lib/api';
import { Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Table, Tabs } from '@/components/ui/extra';

type Tab = 'READY' | 'UPLOADED' | 'ALL' | 'TRASH';
interface Item { kind: 'result'; id: string; title: string; status: string; coverUrl: string | null; createdAt: string; revision: number; userId: string }
interface Detail { videoUrl: string; coverUrl: string | null; title: string; social: { caption: string; hashtags: string[] } | null; qc: { passed: boolean } | null; factCheck: { verdict: { verified: number; unverified: number; contradicted: number } } | null }

export default function AdminResults() {
  const [tab, setTab] = useState<Tab>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-results', tab], queryFn: () => api<Item[]>(`/admin/results?tab=${tab}`) });
  const d = useQuery({ queryKey: ['admin-result', open], queryFn: () => api<Detail>(`/admin/results/${open}`), enabled: !!open });
  return (
    <>
      <PageHead eyebrow="09 · Superadmin" title="Hasil & Media" />
      <Tabs label="Status" value={tab} onChange={setTab} items={[{ value: 'ALL', label: 'Semua' }, { value: 'READY', label: 'Siap upload' }, { value: 'UPLOADED', label: 'Diunggah' }, { value: 'TRASH', label: 'Sampah' }]} />
      <div className="mt-5">
        {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <Skeleton className="h-64 rounded-card" />}
        {q.data?.length === 0 && <Empty title="Belum ada hasil" body="Video hasil produksi semua member tercatat di sini." />}
        {!!q.data?.length && (
          <Table head={['', 'Judul', 'Status', 'Revisi', 'Dibuat']} minWidth={720}>
            {q.data.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setOpen(r.id)}>
                <td className="w-24">{r.coverUrl ? <img src={r.coverUrl} alt="" className="aspect-video w-20 rounded object-cover" /> : <div className="aspect-video w-20 rounded bg-surface-2" />}</td>
                <td className="font-medium"><button className="text-left hover:underline" onClick={() => setOpen(r.id)}>{r.title}</button></td>
                <td><Status value={r.status} /></td>
                <td className="num font-mono">{r.revision}</td>
                <td className="text-muted">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title={d.data?.title ?? 'Hasil'}>
        {d.isLoading && <Skeleton className="h-64" />}
        {d.data && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
            <video src={d.data.videoUrl} poster={d.data.coverUrl ?? undefined} controls className="max-h-[60vh] w-full rounded-xl bg-black" />
            <div className="grid content-start gap-2 text-sm">
              <p>QC: {d.data.qc ? (d.data.qc.passed ? 'lulus' : 'gagal') : '—'}</p>
              {d.data.factCheck && <p>Cek fakta: {d.data.factCheck.verdict.verified} terverifikasi, {d.data.factCheck.verdict.unverified} belum, {d.data.factCheck.verdict.contradicted} bertentangan</p>}
              <p className="whitespace-pre-wrap text-muted">{d.data.social?.caption}</p>
              <p className="text-muted">{d.data.social?.hashtags.join(' ')}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
