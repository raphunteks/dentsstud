'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Table, Tabs } from '@/components/ui/extra';
import { Bars } from '@/components/ui/bars';

interface A {
  days: number;
  daily: { day: string; completed: number; failed: number; cancelled: number; total: number }[];
  totals: { runs: number; completed: number; failed: number; successRate: number | null };
  stages: { stage: string; avg_sec: number; runs: number }[];
  render: { mode: string; jobs: number; avg_sec: number | null; failed: number }[];
  topErrors: { message: string; n: number }[];
  members: { active: number; fresh: number; total: number };
  results: { total: number; uploaded: number; revisions: number; narrations: number };
}
interface E { id: string; source: string; message: string; stack: string | null; occurrences: number; status: string; firstSeenAt: string; lastSeenAt: string; userEmail: string | null; context: Record<string, unknown> }

const ORDER = ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'MOTION', 'QC', 'SOCIAL'];

function fillDays(days: number, rows: A['daily']) {
  const map = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), value: map.get(key)?.completed ?? 0 };
  });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-2 text-3xl font-medium">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function Overview() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const q = useQuery({ queryKey: ['analytics', days], queryFn: () => api<A>(`/admin/analytics?days=${days}`) });
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const a = q.data;
  return (
    <>
      <div className="mb-5"><Tabs label="Rentang" value={days} onChange={setDays} items={[{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }]} /></div>
      {!a ? <Skeleton className="h-96 rounded-card" /> : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Produksi" value={a.totals.runs} hint={`${a.totals.completed} selesai · ${a.totals.failed} gagal`} />
            <Stat label="Tingkat sukses" value={a.totals.successRate === null ? '—' : `${a.totals.successRate}%`} hint="Selesai ÷ (selesai + gagal)" />
            <Stat label="Member aktif" value={a.members.active} hint={`${a.members.fresh} baru · ${a.members.total} total`} />
            <Stat label="Video dihasilkan" value={a.results.total} hint={`${a.results.uploaded} diunggah · ${a.results.revisions} revisi`} />
          </div>
          <Card className="p-5">
            <h2 className="font-display text-base font-medium">Video selesai per hari</h2>
            <div className="mt-4"><Bars label="Video selesai per hari" data={fillDays(a.days, a.daily)} /></div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-display text-base font-medium">Rata-rata durasi tahap</h2>
              {a.stages.length === 0 ? <p className="mt-3 text-sm text-muted">Belum ada tahap yang selesai pada rentang ini.</p> : (
                <ul className="mt-4 grid gap-3">
                  {[...a.stages].sort((x, y) => ORDER.indexOf(x.stage) - ORDER.indexOf(y.stage)).map((s) => {
                    const max = Math.max(...a.stages.map((x) => x.avg_sec), 1);
                    return (
                      <li key={s.stage} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 text-sm">
                        <span className="font-mono text-xs">{s.stage}</span>
                        <span className="h-2 rounded-[4px] bg-surface-2"><span className="block h-full rounded-[4px] bg-accent" style={{ width: `${(s.avg_sec / max) * 100}%` }} /></span>
                        <span className="num text-right font-mono text-xs">{s.avg_sec}s</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-base font-medium">Render</h2>
              {a.render.length === 0 ? <p className="mt-3 text-sm text-muted">Belum ada render pada rentang ini.</p> : (
                <dl className="mt-4 grid gap-3 text-sm">
                  {a.render.map((r) => (
                    <div key={r.mode} className="flex justify-between border-b border-line pb-3 last:border-0">
                      <dt>{r.mode === 'CLOUD' ? 'Cloud' : 'Lokal'}</dt>
                      <dd className="num font-mono text-xs">{r.jobs} job · rata-rata {r.avg_sec ?? '—'}s · {r.failed} gagal</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-4 text-xs text-muted">{a.results.narrations} file narasi TTS dibuat.</p>
            </Card>
          </div>
          <Card className="p-5">
            <h2 className="font-display text-base font-medium">Penyebab gagal teratas</h2>
            {a.topErrors.length === 0 ? <p className="mt-3 text-sm text-muted">Tidak ada produksi gagal.</p> : (
              <ul className="mt-3 grid gap-2 text-sm">{a.topErrors.map((e) => <li key={e.message} className="flex justify-between gap-4"><span>{e.message}</span><span className="num font-mono text-xs">{e.n}×</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Errors() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'IGNORED'>('OPEN');
  const [open, setOpen] = useState<E | null>(null);
  const q = useQuery({ queryKey: ['errors', status], queryFn: () => api<E[]>(`/admin/errors?status=${status}`) });
  const set = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api(`/admin/errors/${id}`, { method: 'PATCH', json: { status: s } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['errors'] }), setOpen(null)),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <div className="mb-5"><Tabs label="Status error" value={status} onChange={setStatus} items={[{ value: 'OPEN', label: 'Terbuka' }, { value: 'RESOLVED', label: 'Selesai' }, { value: 'IGNORED', label: 'Diabaikan' }]} /></div>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <Skeleton className="h-64 rounded-card" />}
      {q.data?.length === 0 && <Empty title="Tidak ada error" body="Error API (5xx), web dan desktop dikelompokkan otomatis di sini." />}
      {!!q.data?.length && (
        <Table head={['Sumber', 'Pesan', 'Kejadian', 'Terakhir', '']} minWidth={820}>
          {q.data.map((e) => (
            <tr key={e.id}>
              <td><Status value={e.source === 'api' ? 'bad' : 'warn'} label={e.source} /></td>
              <td className="max-w-[420px]"><span className="line-clamp-2 font-mono text-xs">{e.message}</span></td>
              <td className="num font-mono">{e.occurrences}</td>
              <td className="text-muted">{fmtDate(e.lastSeenAt)}</td>
              <td className="text-right"><Button variant="ghost" className="h-8" onClick={() => setOpen(e)}>Detail</Button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal wide open={!!open} onClose={() => setOpen(null)} title="Detail error">
        {open && (
          <div className="grid gap-3 text-sm">
            <p className="font-mono text-xs">{open.message}</p>
            <p className="text-muted">Pertama {fmtDate(open.firstSeenAt)} · terakhir {fmtDate(open.lastSeenAt)} · {open.occurrences}× {open.userEmail ? `· ${open.userEmail}` : ''}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px]">{open.stack ?? 'Tanpa stack trace'}{'\n\n'}{JSON.stringify(open.context, null, 2)}</pre>
            <div className="flex gap-2">
              {open.status !== 'RESOLVED' && <Button onClick={() => set.mutate({ id: open.id, s: 'RESOLVED' })}>Tandai selesai</Button>}
              {open.status !== 'IGNORED' && <Button variant="ghost" onClick={() => set.mutate({ id: open.id, s: 'IGNORED' })}>Abaikan</Button>}
              {open.status !== 'OPEN' && <Button variant="ghost" onClick={() => set.mutate({ id: open.id, s: 'OPEN' })}>Buka lagi</Button>}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function AdminAnalytics() {
  const [tab, setTab] = useState<'overview' | 'errors'>('overview');
  return (
    <>
      <PageHead eyebrow="13 · Superadmin" title="Analitik & Monitoring" />
      <div className="mb-5"><Tabs label="Bagian" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Ringkasan' }, { value: 'errors', label: 'Error' }]} /></div>
      {tab === 'overview' ? <Overview /> : <Errors />}
    </>
  );
}
