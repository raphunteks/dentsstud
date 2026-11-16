'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Progress, Table, Tabs } from '@/components/ui/extra';

interface Run { id: string; status: string; progress: number; currentStage: string | null; topic: string | null; kind: string; createdAt: string; error: { message?: string } | null; owner: { email: string; displayName: string } }
interface Ev { id: string; eventType: string; agentCode: string | null; message: string; createdAt: string; metadata: Record<string, unknown> }

const FILTERS = { active: 'QUEUED,RUNNING,CANCELLING', failed: 'FAILED', done: 'COMPLETED', all: '' } as const;
type F = keyof typeof FILTERS;

export default function AdminProduction() {
  const qc = useQueryClient();
  const [f, setF] = useState<F>('active');
  const [logs, setLogs] = useState<string | null>(null);
  const runs = useQuery({ queryKey: ['admin-runs', f], queryFn: () => api<Run[]>(`/admin/production/runs?limit=200${FILTERS[f] ? `&status=${FILTERS[f]}` : ''}`), refetchInterval: f === 'active' ? 4000 : false });
  const ev = useQuery({ queryKey: ['admin-run-logs', logs], queryFn: () => api<Ev[]>(`/admin/production/runs/${logs}/logs`), enabled: !!logs });
  const act = useMutation({
    mutationFn: ({ id, a }: { id: string; a: 'cancel' | 'retry' }) => api(`/admin/production/runs/${id}/${a}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-runs'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHead eyebrow="08 · Superadmin" title="Produksi" />
      <Tabs label="Filter" value={f} onChange={setF} items={[{ value: 'active', label: 'Aktif' }, { value: 'failed', label: 'Gagal' }, { value: 'done', label: 'Selesai' }, { value: 'all', label: 'Semua' }]} />
      <div className="mt-5">
        {runs.isError && <ErrorNote error={runs.error} onRetry={() => runs.refetch()} />}
        {runs.isLoading && <Skeleton className="h-64 rounded-card" />}
        {runs.data?.length === 0 && <Empty title="Tidak ada produksi" body="Produksi member muncul di sini secara real-time." />}
        {!!runs.data?.length && (
          <Table head={['Member', 'Topik', 'Status', 'Tahap', 'Progres', 'Dibuat', '']} minWidth={980}>
            {runs.data.map((r) => (
              <tr key={r.id}>
                <td><span className="font-medium">{r.owner.displayName}</span><br /><span className="text-xs text-muted">{r.owner.email}</span></td>
                <td className="max-w-[260px]"><span className="line-clamp-2">{r.topic ?? '—'}</span>{r.kind !== 'PRODUCTION' && <span className="font-mono text-xs text-muted">{r.kind}</span>}{r.error?.message && <span className="mt-1 block text-xs text-bad">{r.error.message}</span>}</td>
                <td><Status value={r.status} /></td>
                <td className="font-mono text-xs">{r.currentStage ?? '—'}</td>
                <td className="w-36"><Progress value={r.progress} label={`Progres ${r.id}`} /><span className="num text-xs text-muted">{r.progress}%</span></td>
                <td className="text-muted">{fmtDate(r.createdAt)}</td>
                <td className="whitespace-nowrap text-right">
                  <Button variant="ghost" className="h-8" onClick={() => setLogs(r.id)}>Log</Button>
                  {['QUEUED', 'RUNNING'].includes(r.status) && <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: r.id, a: 'cancel' })}>Hentikan</Button>}
                  {['FAILED', 'CANCELLED'].includes(r.status) && <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: r.id, a: 'retry' })}>Lanjutkan</Button>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal wide open={!!logs} onClose={() => setLogs(null)} title="Log teknis">
        {ev.isLoading ? <Skeleton className="h-64" /> : (
          <pre className="max-h-[60vh] overflow-auto rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed">
            {ev.data?.map((e) => `${e.createdAt}  ${e.eventType.padEnd(20)} ${e.agentCode ?? '-'}  ${e.message}${Object.keys(e.metadata ?? {}).length ? `  ${JSON.stringify(e.metadata)}` : ''}`).join('\n')}
          </pre>
        )}
      </Modal>
    </>
  );
}
