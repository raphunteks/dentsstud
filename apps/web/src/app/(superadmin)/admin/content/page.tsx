'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Select, Table, Tabs, Textarea } from '@/components/ui/extra';

interface Cat { id: string; slug: string; name: string; description: string | null; sortOrder: number; isActive: boolean; total: number; published: number }
interface Preset { id: string; slug: string; name: string; description: string; status: string; currentVersion: number; thumbnailUrl: string | null; previewUrl: string | null; updatedAt: string; category: { name: string; slug: string } }
interface PresetDetail extends Preset { version: { recipe: unknown; version: number } | null }
interface Hook { id: string; slug: string; name: string; status: string; currentVersion: number; recipe: unknown; config: { formats?: string[] } }
const err = (e: unknown) => toast.error((e as Error).message);
const DEFAULT_RECIPE = { palette: { background: '#141210', ink: '#f4efe5', accent: '#d9a441' }, typography: { display: 'Chivo', body: 'Chivo' }, motion: { easing: 'easeOut', intensity: 0.5, transition: 'fade' }, layout: { titleScale: 1, safeArea: 0.06, textAlign: 'left' } };

export default function ContentLibrary() {
  const [tab, setTab] = useState<'presets' | 'categories' | 'hooks'>('presets');
  return (
    <>
      <PageHead eyebrow="04 · Content library" title="Katalog konten" actions={<Link href="/admin/content/import" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Import folder / upload</Link>} />
      <div className="mb-5">
        <Tabs label="Bagian katalog" value={tab} onChange={setTab} items={[{ value: 'presets', label: 'Preset gaya' }, { value: 'categories', label: 'Kategori' }, { value: 'hooks', label: 'Hook pembuka' }]} />
      </div>
      {tab === 'presets' && <Presets />}
      {tab === 'categories' && <Categories />}
      {tab === 'hooks' && <Hooks />}
    </>
  );
}

function Categories() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['adm-cats'], queryFn: () => api<Cat[]>('/admin/styles/categories') });
  const inv = () => qc.invalidateQueries({ queryKey: ['adm-cats'] });
  const [form, setForm] = useState({ slug: '', name: '' });
  const create = useMutation({ mutationFn: () => api('/admin/styles/categories', { method: 'POST', json: form }), onSuccess: () => (setForm({ slug: '', name: '' }), inv(), toast.success('Kategori dibuat')), onError: err });
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string; isActive?: boolean; name?: string }) => api(`/admin/styles/categories/${id}`, { method: 'PATCH', json: b }), onSuccess: inv, onError: err });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/styles/categories/${id}`, { method: 'DELETE' }), onSuccess: inv, onError: err });
  const reorder = useMutation({ mutationFn: (ids: string[]) => api('/admin/styles/categories/reorder', { method: 'POST', json: { ids } }), onSuccess: inv, onError: err });
  const move = (i: number, d: number) => {
    const ids = q.data!.map((c) => c.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + d, 0, x!);
    reorder.mutate(ids);
  };
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-64 rounded-card" />;
  return (
    <div className="grid gap-4">
      <Table head={['Urutan', 'Kategori', 'Preset', 'Aktif', '']}>
        {q.data.map((c, i) => (
          <tr key={c.id}>
            <td className="whitespace-nowrap">
              <Button variant="quiet" className="h-8 px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Naikkan ${c.name}`}>↑</Button>
              <Button variant="quiet" className="h-8 px-2" disabled={i === q.data.length - 1} onClick={() => move(i, 1)} aria-label={`Turunkan ${c.name}`}>↓</Button>
            </td>
            <td>
              <input aria-label={`Nama ${c.slug}`} defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && patch.mutate({ id: c.id, name: e.target.value })} className="w-full rounded-md bg-transparent px-1 py-1 font-medium hover:bg-surface-2 focus:bg-surface-2" />
              <span className="font-mono text-xs text-muted">{c.slug}</span>
            </td>
            <td className="num">{c.published} / {c.total}</td>
            <td>
              <button role="switch" aria-checked={c.isActive} aria-label={`Aktifkan ${c.name}`} onClick={() => patch.mutate({ id: c.id, isActive: !c.isActive })} className={`relative h-6 w-11 rounded-full ${c.isActive ? 'bg-accent' : 'bg-surface-2'}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${c.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </td>
            <td className="text-right"><Button variant="danger" className="h-8" onClick={() => confirm(`Hapus kategori ${c.name}?`) && del.mutate(c.id)}>Hapus</Button></td>
          </tr>
        ))}
      </Table>
      <Card className="p-5">
        <h2 className="font-display text-lg font-medium">Kategori baru</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
          <Field id="cat-name" label="Nama"><Input id="cat-name" value={form.name} onChange={(e) => setForm({ name: e.target.value, slug: e.target.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
          <Field id="cat-slug" label="Slug"><Input id="cat-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} /></Field>
          <Button type="submit" loading={create.isPending} disabled={!form.slug || form.name.length < 2}>Tambah kategori</Button>
        </form>
      </Card>
    </div>
  );
}

function Presets() {
  const [status, setStatus] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const cats = useQuery({ queryKey: ['adm-cats'], queryFn: () => api<Cat[]>('/admin/styles/categories') });
  const q = useQuery({ queryKey: ['adm-presets', status, cat], queryFn: () => api<{ items: Preset[] }>(`/admin/styles/presets?limit=100${status ? `&status=${status}` : ''}${cat ? `&categoryId=${cat}` : ''}`) });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Arsip</option>
        </Select>
        <Select aria-label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Semua kategori</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button variant="ghost" onClick={() => setCreating(true)}>Buat preset manual</Button>
      </div>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.items.length === 0 && <Empty title="Belum ada preset" body="Impor package preset dari folder lokal atau upload dashboard. Hasil import masuk sebagai Draft." />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {q.data?.items.map((p) => (
          <button key={p.id} onClick={() => setOpen(p.id)} className="group overflow-hidden rounded-card border border-line bg-surface text-left transition-transform hover:-translate-y-0.5">
            <div className="lit aspect-[4/3] overflow-hidden">{p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}</div>
            <div className="grid gap-1 p-3">
              <span className="font-medium">{p.name}</span>
              <span className="flex items-center justify-between text-xs text-muted">{p.category.name}<Status value={p.status} /></span>
            </div>
          </button>
        ))}
      </div>
      {open && <PresetDetailModal id={open} onClose={() => setOpen(null)} />}
      <CreatePresetModal open={creating} onClose={() => setCreating(false)} cats={cats.data ?? []} />
    </div>
  );
}

function PresetDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ['adm-preset', id], queryFn: () => api<PresetDetail>(`/admin/styles/presets/${id}`) });
  const versions = useQuery({ queryKey: ['adm-preset-v', id], queryFn: () => api<{ version: number; createdAt: string }[]>(`/admin/styles/presets/${id}/versions`) });
  const [recipe, setRecipe] = useState<string | null>(null);
  const [testJob, setTestJob] = useState<string | null>(null);
  const job = useQuery({ queryKey: ['test-job', testJob], enabled: !!testJob, queryFn: () => api<{ status: string; progress: number; outputs: { url: string }[] }>(`/render/jobs/${testJob}`), refetchInterval: (q) => (q.state.data && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(q.state.data.status) ? false : 2000) });
  const inv = () => ['adm-preset', 'adm-presets', 'adm-preset-v', 'adm-cats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const act = useMutation({ mutationFn: (a: string) => api(`/admin/styles/presets/${id}/${a}`, { method: 'POST' }), onSuccess: (_r, a) => (toast.success(`Berhasil: ${a}`), inv()), onError: err });
  const rollback = useMutation({ mutationFn: (v: number) => api(`/admin/styles/presets/${id}/rollback`, { method: 'POST', json: { version: v } }), onSuccess: inv, onError: err });
  const save = useMutation({ mutationFn: () => api(`/admin/styles/presets/${id}`, { method: 'PATCH', json: { recipe: JSON.parse(recipe!) } }), onSuccess: () => (setRecipe(null), inv(), toast.success('Versi baru dibuat')), onError: err });
  const del = useMutation({ mutationFn: () => api(`/admin/styles/presets/${id}`, { method: 'DELETE' }), onSuccess: () => (inv(), onClose()), onError: err });
  const test = useMutation({ mutationFn: () => api<{ id: string }>(`/admin/styles/presets/${id}/test-render`, { method: 'POST', json: { format: '9:16' } }), onSuccess: (j) => setTestJob(j.id), onError: err });
  const p = d.data;
  return (
    <Modal open onClose={onClose} title={p?.name ?? 'Preset'} wide>
      {!p ? <Skeleton className="h-64" /> : (
        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="grid content-start gap-3">
            <div className="lit aspect-[3/4] overflow-hidden rounded-xl">{p.previewUrl ? <video src={p.previewUrl} controls muted className="size-full object-cover" /> : p.thumbnailUrl && <img src={p.thumbnailUrl} alt={`Thumbnail ${p.name}`} className="size-full object-cover" />}</div>
            <p className="text-sm text-muted"><span className="font-mono text-xs">{p.slug}</span> · v{p.currentVersion} · <Status value={p.status} /></p>
            <div className="flex flex-wrap gap-2">
              {p.status === 'DRAFT' && <Button onClick={() => act.mutate('publish')} loading={act.isPending}>Publish</Button>}
              {p.status === 'PUBLISHED' && <Button variant="ghost" onClick={() => act.mutate('unpublish')}>Unpublish</Button>}
              {p.status !== 'ARCHIVED' ? <Button variant="ghost" onClick={() => act.mutate('archive')}>Arsipkan</Button> : <Button variant="ghost" onClick={() => act.mutate('restore')}>Pulihkan</Button>}
              <Button variant="ghost" onClick={() => act.mutate('duplicate')}>Duplikat</Button>
              <Button variant="ghost" onClick={() => test.mutate()} loading={test.isPending}>Test render</Button>
              {p.status !== 'PUBLISHED' && <Button variant="danger" onClick={() => confirm('Hapus preset ini?') && del.mutate()}>Hapus</Button>}
            </div>
            {testJob && job.data && (
              <div className="rounded-lg bg-surface-2 p-3 text-sm" role="status">
                Test render: <Status value={job.data.status} /> {job.data.status === 'RUNNING' && <span className="num">{job.data.progress}%</span>}
                {job.data.outputs[0] && <video src={job.data.outputs[0].url} controls className="mt-2 w-full rounded" />}
              </div>
            )}
          </div>
          <div className="grid content-start gap-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Recipe (versi {p.version?.version})</h3>
              <Textarea aria-label="Recipe JSON" className="min-h-64 font-mono text-xs" value={recipe ?? JSON.stringify(p.version?.recipe, null, 2)} onChange={(e) => setRecipe(e.target.value)} />
              {recipe !== null && <Button className="mt-2" onClick={() => save.mutate()} loading={save.isPending}>Simpan sebagai versi baru</Button>}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Riwayat versi</h3>
              <ul className="grid gap-1 text-sm">
                {versions.data?.map((v) => (
                  <li key={v.version} className="flex items-center justify-between border-b border-line py-1.5">
                    <span>v{v.version} <span className="text-muted">· {fmtDate(v.createdAt)}</span></span>
                    {v.version !== p.currentVersion && <Button variant="quiet" className="h-8" onClick={() => rollback.mutate(v.version)}>Rollback ke v{v.version}</Button>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CreatePresetModal({ open, onClose, cats }: { open: boolean; onClose: () => void; cats: Cat[] }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', slug: '', categoryId: '', recipe: JSON.stringify(DEFAULT_RECIPE, null, 2) });
  const create = useMutation({
    mutationFn: () => api('/admin/styles/presets', { method: 'POST', json: { name: f.name, slug: f.slug, categoryId: f.categoryId, recipe: JSON.parse(f.recipe) } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['adm-presets'] }), toast.success('Draft preset dibuat. Tambahkan thumbnail lewat import sebelum publish.'), onClose()),
    onError: err,
  });
  return (
    <Modal open={open} onClose={onClose} title="Preset manual (draft)">
      <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
        <Field id="p-name" label="Nama"><Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
        <Field id="p-slug" label="Slug"><Input id="p-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
        <Field id="p-cat" label="Kategori"><Select id="p-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">Pilih</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field id="p-recipe" label="Recipe JSON"><Textarea id="p-recipe" className="min-h-48 font-mono text-xs" value={f.recipe} onChange={(e) => setF({ ...f, recipe: e.target.value })} /></Field>
        <Button type="submit" loading={create.isPending} disabled={!f.categoryId || !f.slug}>Buat draft</Button>
      </form>
    </Modal>
  );
}

function Hooks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['adm-hooks'], queryFn: () => api<Hook[]>('/admin/hooks') });
  const [f, setF] = useState({ name: '', slug: '', style: 'bold', durationSec: 2, inAnim: 'pop' });
  const inv = () => qc.invalidateQueries({ queryKey: ['adm-hooks'] });
  const create = useMutation({
    mutationFn: () => api('/admin/hooks', { method: 'POST', json: { name: f.name, slug: f.slug, formats: ['9:16', '16:9', '1:1'], recipe: { durationSec: f.durationSec, style: f.style, text: { maxWords: 8 }, animation: { in: f.inAnim } } } }),
    onSuccess: () => (inv(), setF({ ...f, name: '', slug: '' })),
    onError: err,
  });
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: string }) => (a === 'delete' ? api(`/admin/hooks/${id}`, { method: 'DELETE' }) : api(`/admin/hooks/${id}/${a}`, { method: 'POST' })), onSuccess: inv, onError: err });
  return (
    <div className="grid gap-4">
      {q.data?.length === 0 && <Empty title="Belum ada hook" body="Mode Otomatis tetap tersedia untuk member. Tambahkan hook lewat form ini atau import package hook." />}
      {!!q.data?.length && (
        <Table head={['Hook', 'Gaya', 'Status', '']}>
          {q.data.map((h) => (
            <tr key={h.id}>
              <td><span className="font-medium">{h.name}</span><br /><span className="font-mono text-xs text-muted">{h.slug} · v{h.currentVersion}</span></td>
              <td>{(h.recipe as { style?: string })?.style}</td>
              <td><Status value={h.status} /></td>
              <td className="whitespace-nowrap text-right">
                {h.status === 'PUBLISHED' ? <Button variant="ghost" className="h-8" onClick={() => act.mutate({ id: h.id, a: 'unpublish' })}>Unpublish</Button> : <Button className="h-8" onClick={() => act.mutate({ id: h.id, a: 'publish' })}>Publish</Button>}
                {h.status !== 'PUBLISHED' && <Button variant="danger" className="ml-2 h-8" onClick={() => act.mutate({ id: h.id, a: 'delete' })}>Hapus</Button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Card className="p-5">
        <h2 className="font-display text-lg font-medium">Hook baru</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-5 sm:items-end" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
          <Field id="h-name" label="Nama"><Input id="h-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
          <Field id="h-style" label="Gaya"><Select id="h-style" value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}>{['bongkar', 'bold', 'glass', 'neon', 'komik', 'custom'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field id="h-in" label="Animasi"><Select id="h-in" value={f.inAnim} onChange={(e) => setF({ ...f, inAnim: e.target.value })}>{['pop', 'slide', 'type', 'mask', 'scale'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field id="h-dur" label="Durasi (detik)"><Input id="h-dur" type="number" min={0.5} max={8} step={0.5} value={f.durationSec} onChange={(e) => setF({ ...f, durationSec: Number(e.target.value) })} /></Field>
          <Button type="submit" loading={create.isPending} disabled={f.name.length < 2}>Tambah draft</Button>
        </form>
      </Card>
    </div>
  );
}
