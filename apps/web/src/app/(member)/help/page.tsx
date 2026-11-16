'use client';
import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Tabs, Textarea } from '@/components/ui/extra';
import { Thread, type Ticket } from '@/components/support/thread';

interface Art { id: string; slug: string; kind: 'GUIDE' | 'FAQ' | 'TROUBLESHOOTING'; title: string; body: string }
interface Row { id: string; subject: string; status: string; updatedAt: string }
const KIND = { GUIDE: 'Panduan', FAQ: 'FAQ', TROUBLESHOOTING: 'Troubleshooting' } as const;

function Articles() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [open, setOpen] = useState<Art | null>(null);
  const list = useQuery({ queryKey: ['help', dq], queryFn: () => api<Art[]>(`/help/articles${dq ? `?q=${encodeURIComponent(dq)}` : ''}`) });
  return (
    <>
      <Input aria-label="Cari artikel" placeholder="Cari: render, kuota, Claude…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <div className="mt-5">
        {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
        {list.isLoading && <Skeleton className="h-48 rounded-card" />}
        {list.data?.length === 0 && <Empty title="Tidak ditemukan" body="Coba kata lain atau kirim tiket ke tim." />}
        <div className="grid gap-6">
          {(['GUIDE', 'TROUBLESHOOTING', 'FAQ'] as const).map((k) => {
            const items = list.data?.filter((a) => a.kind === k) ?? [];
            if (!items.length) return null;
            return (
              <section key={k} aria-labelledby={`k-${k}`}>
                <h2 id={`k-${k}`} className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">{KIND[k]}</h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {items.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => setOpen(a)} className="w-full rounded-card border border-line bg-surface p-4 text-left transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-text/30">
                        <span className="font-display text-base font-medium">{a.title}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-muted">{a.body}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{open?.body}</div>
      </Modal>
    </>
  );
}

function Tickets() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const list = useQuery({ queryKey: ['tickets'], queryFn: () => api<Row[]>('/support/tickets') });
  const t = useQuery({ queryKey: ['ticket', open], queryFn: () => api<Ticket>(`/support/tickets/${open}`), enabled: !!open, refetchInterval: open ? 15_000 : false });
  const create = useMutation({
    mutationFn: () => api<Ticket>('/support/tickets', { method: 'POST', json: { subject, body, diagnostics: { userAgent: navigator.userAgent.slice(0, 300), page: 'web' } } }),
    onSuccess: (r) => (toast.success('Tiket terkirim'), setForm(false), setSubject(''), setBody(''), qc.invalidateQueries({ queryKey: ['tickets'] }), setOpen(r.id)),
    onError: (e) => toast.error((e as Error).message),
  });
  const reply = useMutation({
    mutationFn: (b: string) => api(`/support/tickets/${open}/messages`, { method: 'POST', json: { body: b } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['ticket', open] }), qc.invalidateQueries({ queryKey: ['tickets'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <Button onClick={() => setForm(true)}>Tiket baru</Button>
      <div className="mt-5">
        {list.isLoading && <Skeleton className="h-32 rounded-card" />}
        {list.data?.length === 0 && <Empty title="Belum ada tiket" body="Kirim tiket bila menemukan masalah. Informasi perangkat dasar dilampirkan otomatis; kunci API tidak pernah dikirim." />}
        <ul className="grid gap-2">
          {list.data?.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-text/30">
                <span className="truncate text-sm font-medium">{r.subject}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted"><Status value={r.status} label={r.status === 'PENDING' ? 'Dibalas tim' : undefined} />{fmtDate(r.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Modal open={form} onClose={() => setForm(false)} title="Tiket baru">
        <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
          <Field id="ts" label="Subjek"><Input id="ts" maxLength={255} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field id="tb" label="Ceritakan masalahnya"><Textarea id="tb" rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <Button type="submit" loading={create.isPending} disabled={subject.trim().length < 4 || body.trim().length < 10}>Kirim tiket</Button>
        </form>
      </Modal>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title={t.data?.subject ?? 'Tiket'}>
        {t.data ? <Thread t={t.data} onReply={(b) => reply.mutateAsync(b)} sending={reply.isPending} /> : <Skeleton className="h-40" />}
      </Modal>
    </>
  );
}

export default function HelpPage() {
  const [tab, setTab] = useState<'articles' | 'tickets'>('articles');
  return (
    <>
      <PageHead eyebrow="Bantuan" title="Pusat Bantuan" />
      <Card className="mb-5 inline-block p-1"><Tabs label="Bagian" value={tab} onChange={setTab} items={[{ value: 'articles', label: 'Artikel' }, { value: 'tickets', label: 'Tiket support' }]} /></Card>
      {tab === 'articles' ? <Articles /> : <Tickets />}
    </>
  );
}
