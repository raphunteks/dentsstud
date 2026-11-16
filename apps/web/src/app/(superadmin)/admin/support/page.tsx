'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Select, Table, Tabs, Textarea } from '@/components/ui/extra';
import { Thread, type Ticket } from '@/components/support/thread';

interface Art { id: string; slug: string; kind: string; title: string; body: string; status: string; sortOrder: number; updatedAt: string }
interface Row { id: string; subject: string; status: string; updatedAt: string; owner: { email: string; displayName: string } }

function Tickets() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'>('OPEN');
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['admin-tickets', status], queryFn: () => api<Row[]>(`/admin/support/tickets${status ? `?status=${status}` : ''}`), refetchInterval: 20_000 });
  const t = useQuery({ queryKey: ['admin-ticket', open], queryFn: () => api<Ticket>(`/admin/support/tickets/${open}`), enabled: !!open });
  const reply = useMutation({
    mutationFn: (body: string) => api(`/admin/support/tickets/${open}/messages`, { method: 'POST', json: { body } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin-ticket', open] }), qc.invalidateQueries({ queryKey: ['admin-tickets'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  const setSt = useMutation({
    mutationFn: (s: string) => api(`/admin/support/tickets/${open}`, { method: 'PATCH', json: { status: s } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin-ticket', open] }), qc.invalidateQueries({ queryKey: ['admin-tickets'] })),
  });
  return (
    <>
      <Tabs label="Status tiket" value={status} onChange={setStatus} items={[{ value: 'OPEN', label: 'Menunggu tim' }, { value: 'PENDING', label: 'Menunggu member' }, { value: 'RESOLVED', label: 'Selesai' }, { value: 'CLOSED', label: 'Ditutup' }, { value: '', label: 'Semua' }]} />
      <div className="mt-5">
        {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
        {list.isLoading && <Skeleton className="h-48 rounded-card" />}
        {list.data?.length === 0 && <Empty title="Tidak ada tiket" body="Tiket member muncul di sini." />}
        {!!list.data?.length && (
          <Table head={['Subjek', 'Member', 'Status', 'Diperbarui']} minWidth={680}>
            {list.data.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setOpen(r.id)}>
                <td className="font-medium"><button className="text-left hover:underline">{r.subject}</button></td>
                <td>{r.owner.displayName}<br /><span className="text-xs text-muted">{r.owner.email}</span></td>
                <td><Status value={r.status} /></td>
                <td className="text-muted">{fmtDate(r.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title={t.data?.subject ?? 'Tiket'}>
        {t.data ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Status value={t.data.status} />
              <Select aria-label="Ubah status" value={t.data.status} onChange={(e) => setSt.mutate(e.target.value)} className="h-9">
                {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            {t.data.diagnostics && <pre className="mb-4 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px]">{JSON.stringify(t.data.diagnostics, null, 2)}</pre>}
            <Thread t={t.data} onReply={(b) => reply.mutateAsync(b)} sending={reply.isPending} staffView />
          </>
        ) : <Skeleton className="h-48" />}
      </Modal>
    </>
  );
}

function Articles() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin-articles'], queryFn: () => api<Art[]>('/admin/help/articles') });
  const [edit, setEdit] = useState<Partial<Art> | null>(null);
  const save = useMutation({
    mutationFn: (a: Partial<Art>) => {
      const body = { slug: a.slug, kind: a.kind, title: a.title, body: a.body, status: a.status, sortOrder: Number(a.sortOrder ?? 0) };
      return a.id ? api(`/admin/help/articles/${a.id}`, { method: 'PATCH', json: body }) : api('/admin/help/articles', { method: 'POST', json: body });
    },
    onSuccess: () => (toast.success('Artikel disimpan'), setEdit(null), qc.invalidateQueries({ queryKey: ['admin-articles'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/admin/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setEdit(null), qc.invalidateQueries({ queryKey: ['admin-articles'] })),
  });
  return (
    <>
      <Button onClick={() => setEdit({ kind: 'GUIDE', status: 'DRAFT', sortOrder: 0, slug: '', title: '', body: '' })}>Artikel baru</Button>
      <div className="mt-5">
        {list.isLoading && <Skeleton className="h-48 rounded-card" />}
        {!!list.data?.length && (
          <Table head={['Judul', 'Jenis', 'Status', 'Diperbarui']} minWidth={640}>
            {list.data.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setEdit(a)}>
                <td className="font-medium">{a.title}<br /><span className="font-mono text-xs text-muted">{a.slug}</span></td>
                <td>{a.kind}</td>
                <td><Status value={a.status} /></td>
                <td className="text-muted">{fmtDate(a.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit artikel' : 'Artikel baru'}>
        {edit && (
          <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), save.mutate(edit))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="at" label="Judul"><Input id="at" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field id="as" label="Slug"><Input id="as" value={edit.slug ?? ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select aria-label="Jenis" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}><option value="GUIDE">Panduan</option><option value="FAQ">FAQ</option><option value="TROUBLESHOOTING">Troubleshooting</option></Select>
              <Select aria-label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select>
              <Input aria-label="Urutan" inputMode="numeric" value={String(edit.sortOrder ?? 0)} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </div>
            <Field id="ab" label="Isi (teks biasa; baris baru dipertahankan)"><Textarea id="ab" rows={14} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button type="submit" loading={save.isPending}>Simpan</Button>
              {edit.id && <Button type="button" variant="ghost" onClick={() => del.mutate(edit.id!)}>Hapus</Button>}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function AdminSupport() {
  const [tab, setTab] = useState<'tickets' | 'articles'>('tickets');
  return (
    <>
      <PageHead eyebrow="12 · Superadmin" title="Support" />
      <Card className="mb-5 inline-block p-1"><Tabs label="Bagian" value={tab} onChange={setTab} items={[{ value: 'tickets', label: 'Tiket' }, { value: 'articles', label: 'Artikel bantuan' }]} /></Card>
      {tab === 'tickets' ? <Tickets /> : <Articles />}
    </>
  );
}
