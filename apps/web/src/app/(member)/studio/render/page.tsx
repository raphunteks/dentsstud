'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtBytes, fmtDate } from '@/lib/api';
import { Button, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Progress, Table } from '@/components/ui/extra';

interface J { id: string; projectName: string; mode: string; status: string; progress: number; createdAt: string; completedAt: string | null; preset: { format: string }; outputs: { id: string; url: string; format: string; sizeBytes: number }[] }
const ACTIVE = ['QUEUED', 'AWAITING_LOCAL', 'RUNNING', 'CANCELLING'];

export default function RenderCenter() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['render-jobs'], queryFn: () => api<J[]>('/render/jobs'), refetchInterval: (q) => (q.state.data?.some((j) => ACTIVE.includes(j.status)) ? 2000 : false) });
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: 'cancel' | 'retry' }) => api(`/render/jobs/${id}/${a}`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['render-jobs'] }), onError: (e) => toast.error((e as Error).message) });
  return (
    <>
      <PageHead eyebrow="Studio" title="Render Center" />
      <p className="mb-5 max-w-2xl text-sm text-muted">Render cloud berjalan di worker DENTSWEB. Render lokal dijalankan aplikasi desktop di komputer Anda; job berstatus "AWAITING LOCAL" menunggu aplikasi desktop.</p>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <Skeleton className="h-48 rounded-card" />}
      {q.data?.length === 0 && <Empty title="Belum ada render" body="Buka project di Motion Editor lalu pilih Render cloud atau Render lokal." />}
      {!!q.data?.length && (
        <Table head={['Project', 'Mode', 'Status', 'Progres', 'Dibuat', '']} minWidth={860}>
          {q.data.map((j) => (
            <tr key={j.id}>
              <td className="font-medium">{j.projectName}<br /><span className="font-mono text-xs text-muted">{j.preset.format}</span></td>
              <td>{j.mode === 'CLOUD' ? 'Cloud' : 'Lokal'}</td>
              <td><Status value={j.status} /></td>
              <td className="w-40"><Progress value={j.progress} label={`Progres ${j.projectName}`} /><span className="num text-xs text-muted">{j.progress}%</span></td>
              <td className="text-muted">{fmtDate(j.createdAt)}</td>
              <td className="whitespace-nowrap text-right">
                {j.outputs.map((o) => <a key={o.id} href={o.url} className="mr-2 inline-flex h-8 items-center rounded-[10px] bg-accent px-3 text-xs font-medium text-accent-contrast">Unduh {o.format.toUpperCase()} · {fmtBytes(o.sizeBytes)}</a>)}
                {ACTIVE.includes(j.status) && <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: j.id, a: 'cancel' })}>Hentikan</Button>}
                {['FAILED', 'CANCELLED'].includes(j.status) && <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: j.id, a: 'retry' })}>Ulangi</Button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
