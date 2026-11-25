import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, invoke, mutate, toMediaUrl } from '../bridge';
import { Button, Card, Input, Modal, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import type { NavTab } from '../types';

function toArr<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.rows)) return o.rows as T[];
    if (Array.isArray(o.categories)) return o.categories as T[];
  }
  return [];
}

/** 01. Control Center / Admin Dashboard */
export function AdminDashboardView({ onNavigate }: { onNavigate?: (tab: NavTab) => void }) {
  const dashQ = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => get<Record<string, any>>('/admin/dashboard'),
    refetchInterval: 30_000,
  });

  const metricsQ = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => get<Record<string, any>>('/admin/metrics').catch(() => null),
    refetchInterval: 30_000,
  });

  const d = dashQ.data;
  const m = metricsQ.data;

  const kpis = [
    { label: 'Total Member', value: d?.members?.total ?? d?.totalMembers ?? 0, tab: 'admin-members' as NavTab },
    { label: 'Lisensi Aktif', value: d?.licenses?.active ?? d?.activeLicenses ?? 0, tab: 'admin-licenses' as NavTab },
    { label: 'Produksi Aktif', value: d?.production?.active ?? d?.activeRuns ?? 0, tab: 'admin-production' as NavTab },
    { label: 'Video Dihasilkan', value: d?.results?.total ?? d?.totalResults ?? 0, tab: 'admin-results' as NavTab },
    { label: 'Preset Terbit', value: d?.catalog?.presets ?? d?.publishedPresets ?? 0, tab: 'admin-content' as NavTab },
    { label: 'Suara Terbit', value: d?.catalog?.voices ?? d?.publishedVoices ?? 0, tab: 'admin-voices' as NavTab },
    { label: 'Tiket Terbuka', value: d?.support?.open ?? d?.openTickets ?? 0, tab: 'admin-support' as NavTab },
    { label: 'Error Terbuka', value: d?.errors?.open ?? d?.openErrors ?? 0, tab: 'admin-analytics' as NavTab },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">01 · SUPERADMIN CONTROL CENTER</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Dashboard Platform</h1>
          <p className="mt-1 text-sm text-muted">Ringkasan operasional, kesehatan sistem, dan metrik produksi global.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { dashQ.refetch(); metricsQ.refetch(); }}>
          ↻ Segarkan
        </Button>
      </div>

      {dashQ.isError && (
        <Card className="p-5 border-bad/40 bg-bad/5 text-xs text-bad">
          Gagal memuat dashboard admin: {errMsg(dashQ.error)}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            onClick={() => onNavigate?.(k.tab)}
            className="p-4 cursor-pointer hover:border-accent transition"
          >
            <p className="text-xs text-muted">{k.label}</p>
            <p className="num mt-2 text-3xl font-semibold text-text">{k.value}</p>
          </Card>
        ))}
      </div>

      {m && (
        <Card className="p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-text">Metrik Runtime Server</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <p className="text-muted">Uptime</p>
              <p className="font-mono font-semibold text-text mt-1">{Math.round((m.uptimeSec ?? m.uptime ?? 0) / 60)} menit</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <p className="text-muted">Memory RSS</p>
              <p className="font-mono font-semibold text-text mt-1">{m.memoryMb?.rss ?? Math.round((m.memory?.rss ?? 0) / 1048576)} MB</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <p className="text-muted">Worker Nodes</p>
              <p className="font-mono font-semibold text-text mt-1">{m.workersOnline ?? d?.workers?.online ?? 0} online</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/40 p-3">
              <p className="text-muted">Antrean Render</p>
              <p className="font-mono font-semibold text-text mt-1">{m.renderQueued ?? d?.render?.queued ?? 0} antre</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/** 04. Content Library CMS: Presets, Categories, Hooks, Test Render */
export function AdminContentView() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'presets' | 'categories' | 'hooks'>('presets');
  const [catName, setCatName] = useState('');
  const [hookName, setHookName] = useState('');
  const [hookDesc, setHookDesc] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const presetsQ = useQuery({
    queryKey: ['admin-presets'],
    queryFn: () => get<unknown>('/admin/styles/presets').then((r) => toArr(r)).catch(() => []),
  });

  const catsQ = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => get<unknown>('/admin/styles/categories').then((r) => toArr(r)).catch(() => []),
  });

  const hooksQ = useQuery({
    queryKey: ['admin-hooks'],
    queryFn: () => get<unknown>('/admin/hooks').then((r) => toArr(r)).catch(() => []),
  });

  const togglePreset = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mutate('POST', `/admin/styles/presets/${id}/${status === 'PUBLISHED' ? 'archive' : 'publish'}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-presets'] });
      setFeedback('Status preset berhasil diperbarui.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const testRenderPreset = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/styles/presets/${id}/test-render`, {}),
    onSuccess: () => setFeedback('Test render preset dikirim ke antrean render!'),
    onError: (e) => setFeedback(`Test render gagal: ${errMsg(e)}`),
  });

  const createCat = useMutation({
    mutationFn: () => {
      const slug = catName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return mutate('POST', '/admin/styles/categories', { name: catName.trim(), slug });
    },
    onSuccess: () => {
      setCatName('');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      setFeedback('Kategori berhasil dibuat.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const createHook = useMutation({
    mutationFn: () => {
      const slug = hookName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return mutate('POST', '/admin/hooks', { name: hookName.trim(), slug, description: hookDesc.trim() });
    },
    onSuccess: () => {
      setHookName('');
      setHookDesc('');
      qc.invalidateQueries({ queryKey: ['admin-hooks'] });
      setFeedback('Hook berhasil dibuat sebagai DRAFT.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const publishHook = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mutate('POST', `/admin/hooks/${id}/${status === 'PUBLISHED' ? 'archive' : 'publish'}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-hooks'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">04 · SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Content Library CMS</h1>
        <p className="mt-1 text-sm text-muted">Kelola preset gaya visual, kategori katalog, hook pembuka, dan test render.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'presets', label: `Preset Visual (${presetsQ.data?.length ?? 0})` },
          { id: 'categories', label: `Kategori (${catsQ.data?.length ?? 0})` },
          { id: 'hooks', label: `Hook Pembuka (${hooksQ.data?.length ?? 0})` },
        ].map((t) => (
          <Button key={t.id} size="sm" variant={subTab === t.id ? 'primary' : 'ghost'} onClick={() => setSubTab(t.id as typeof subTab)}>
            {t.label}
          </Button>
        ))}
      </div>

      {feedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-text flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-muted cursor-pointer">✕</button>
        </div>
      )}

      {subTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(presetsQ.data ?? []).map((p: any) => (
            <Card key={p.id} className="p-4 space-y-3 flex flex-col justify-between">
              <div className="flex gap-3">
                <div className="h-20 w-14 shrink-0 rounded-lg bg-neutral-900 overflow-hidden border border-line">
                  {p.thumbnailUrl ? (
                    <img src={toMediaUrl(p.thumbnailUrl)} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-xs text-muted">No img</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-display text-sm font-semibold text-text truncate">{p.name}</h3>
                    <Pill ok={p.status === 'PUBLISHED'}>{p.status}</Pill>
                  </div>
                  <p className="text-[11px] font-mono text-muted">{p.slug}</p>
                  <p className="text-xs text-muted line-clamp-2">{p.description}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-line">
                <Button size="sm" variant="outline" className="flex-1 text-xs" disabled={togglePreset.isPending} onClick={() => togglePreset.mutate({ id: p.id, status: p.status })}>
                  {p.status === 'PUBLISHED' ? 'Arsipkan' : 'Publikasikan'}
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" disabled={testRenderPreset.isPending} onClick={() => testRenderPreset.mutate(p.id)}>
                  ▶ Test Render
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {subTab === 'categories' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (catName.trim().length < 2) return;
                createCat.mutate();
              }}
              className="flex gap-2"
            >
              <Input placeholder="Nama kategori baru..." value={catName} onChange={(e) => setCatName(e.target.value)} className="h-9 text-xs flex-1" />
              <Button type="submit" size="sm" disabled={createCat.isPending || catName.trim().length < 2}>+ Tambah Kategori</Button>
            </form>
          </Card>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Nama</th>
                  <th className="px-4 py-2.5">Slug</th>
                  <th className="px-4 py-2.5">Jumlah Preset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(catsQ.data ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-medium text-text">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{c.slug}</td>
                    <td className="px-4 py-2.5 font-mono text-accent">{c.presetCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {subTab === 'hooks' && (
        <div className="space-y-4 max-w-3xl">
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text">Tambah Hook Pembuka Baru</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (hookName.trim().length < 2) return;
                createHook.mutate();
              }}
              className="grid gap-2"
            >
              <Input placeholder="Nama Hook (mis. Fakta Mengejutkan Enamel)" value={hookName} onChange={(e) => setHookName(e.target.value)} className="h-9 text-xs" />
              <Textarea rows={2} placeholder="Deskripsi / pola kalimat hook..." value={hookDesc} onChange={(e) => setHookDesc(e.target.value)} className="text-xs" />
              <div>
                <Button type="submit" size="sm" disabled={createHook.isPending || hookName.trim().length < 2}>+ Simpan Hook</Button>
              </div>
            </form>
          </Card>
          <div className="space-y-2">
            {(hooksQ.data ?? []).map((h: any) => (
              <Card key={h.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text">{h.name}</p>
                    <Pill ok={h.status === 'PUBLISHED'}>{h.status}</Pill>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{h.description || h.slug}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => publishHook.mutate({ id: h.id, status: h.status })}>
                  {h.status === 'PUBLISHED' ? 'Arsipkan' : 'Publikasikan'}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 09. Hasil & Media Global */
export function AdminResultsView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const resultsQ = useQuery({
    queryKey: ['admin-results'],
    queryFn: () => get<unknown>('/admin/results?tab=ALL').then((r) => toArr(r)).catch(() => []),
  });

  const detailQ = useQuery({
    queryKey: ['admin-result-detail', previewId],
    queryFn: () => get<any>(`/admin/results/${previewId}`),
    enabled: !!previewId,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/admin/results/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-results'] });
      if (previewId) setPreviewId(null);
    },
  });

  const list = (resultsQ.data ?? []).filter(
    (r) =>
      !search.trim() ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.userEmail?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">09 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Hasil & Media Global</h1>
          <p className="mt-1 text-sm text-muted">Putar, pantau, dan moderasi seluruh video hasil produksi member.</p>
        </div>
        <Input placeholder="Cari judul / email pemilik..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 h-9 text-xs" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-3">Judul Video</th>
                <th className="px-4 py-3">Pemilik</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3 font-medium text-text max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-3 font-mono text-muted">{r.userEmail || r.user?.email || r.userId?.slice(0, 8)}</td>
                  <td className="px-4 py-3"><Pill ok={r.status === 'READY' || r.status === 'UPLOADED'}>{r.status}</Pill></td>
                  <td className="px-4 py-3 font-mono text-muted">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewId(r.id)}>
                      <Icon name="play" className="w-3.5 h-3.5" /> Putar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={delMut.isPending}
                      onClick={() => {
                        if (confirm(`Hapus video "${r.title}" secara moderasi?`)) delMut.mutate(r.id);
                      }}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">Belum ada hasil video global.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!previewId} onClose={() => setPreviewId(null)} title={detailQ.data?.title ?? 'Pratinjau Video'}>
        {detailQ.isLoading ? (
          <div className="min-h-[320px] grid place-items-center text-xs text-muted">Memuat video…</div>
        ) : detailQ.isError || !detailQ.data ? (
          <p className="text-xs text-bad py-4">Gagal memuat detail video.</p>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full min-h-[320px] aspect-[9/16] max-h-[540px] mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center">
              {detailQ.data.videoUrl ? (
                <video
                  key={detailQ.data.videoUrl}
                  src={toMediaUrl(detailQ.data.videoUrl)}
                  poster={detailQ.data.coverUrl ? toMediaUrl(detailQ.data.coverUrl) : undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full max-h-[540px] rounded-xl bg-black object-contain"
                />
              ) : (
                <p className="text-xs text-muted">File video tidak ditemukan.</p>
              )}
            </div>
            {detailQ.data.social?.caption && (
              <p className="text-xs text-muted whitespace-pre-wrap max-h-32 overflow-y-auto rounded-lg border border-line bg-surface-2/40 p-3">
                {detailQ.data.social.caption}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {detailQ.data.videoUrl && (
                <Button size="sm" variant="outline" onClick={() => void invoke('shell:open-external', { url: toMediaUrl(detailQ.data.videoUrl) })}>
                  <Icon name="download" className="w-3.5 h-3.5" /> Unduh MP4
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 13. Analitik & Error Reports */
export function AdminAnalyticsView() {
  const qc = useQueryClient();
  const [selectedErr, setSelectedErr] = useState<any | null>(null);

  const analyticsQ = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => get<Record<string, any>>('/admin/analytics').catch(() => null),
  });

  const errorsQ = useQuery({
    queryKey: ['admin-errors'],
    queryFn: () => get<unknown>('/admin/errors').then((r) => toArr(r)).catch(() => []),
  });

  const resolveErr = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => mutate('PATCH', `/admin/errors/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-errors'] });
      setSelectedErr(null);
    },
  });

  const resolveAllErrs = useMutation({
    mutationFn: () => mutate('POST', '/admin/errors/resolve-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-errors'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const a = analyticsQ.data ?? {};
  const errs = errorsQ.data ?? [];
  const openCount = errs.filter((e) => e.status !== 'RESOLVED').length;
  const resolvedCount = errs.filter((e) => e.status === 'RESOLVED').length;
  const runsTotal = Number(a.runsTotal ?? a.totalRuns ?? 0);
  const rawRate = a.successRate;
  const successRatePct =
    rawRate == null ? (runsTotal > 0 ? 0 : null) : rawRate > 1 ? Math.round(rawRate) : Math.round(rawRate * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">13 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Analitik & Error Reports</h1>
          <p className="mt-1 text-sm text-muted">Pantau statistik penggunaan, tingkat keberhasilan produksi, dan telemetri error Desktop/Web.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {openCount > 0 && (
            <Button size="sm" variant="primary" disabled={resolveAllErrs.isPending} onClick={() => resolveAllErrs.mutate()}>
              {resolveAllErrs.isPending ? 'Menyelesaikan…' : `Tandai Semua Selesai (${openCount})`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { analyticsQ.refetch(); errorsQ.refetch(); }}>
            Segarkan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Total Runs (30h)</p>
          <p className="num text-2xl font-semibold text-text mt-1">{runsTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Success Rate</p>
          <p className="num text-2xl font-semibold text-ok mt-1">{successRatePct != null ? `${successRatePct}%` : '-'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Error Reports Aktif</p>
          <p className="num text-2xl font-semibold text-bad mt-1">{openCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Total Selesai (Resolved)</p>
          <p className="num text-2xl font-semibold text-ok mt-1">{resolvedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Total Error Tercatat</p>
          <p className="num text-2xl font-semibold text-text mt-1">{errs.length}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text">Error Telemetry ({errs.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-2.5">Sumber</th>
                <th className="px-4 py-2.5">Pesan Error</th>
                <th className="px-4 py-2.5">Jumlah</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {errs.map((e: any) => (
                <tr key={e.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-2.5 font-mono text-muted">{e.source || e.platform || 'desktop'}</td>
                  <td className="px-4 py-2.5 text-text max-w-md truncate">{e.message}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-accent">{e.count ?? 1}×</td>
                  <td className="px-4 py-2.5">
                    <Pill ok={e.status === 'RESOLVED' ? true : false}>{e.status || 'OPEN'}</Pill>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedErr(e)}>Detail</Button>
                    {e.status !== 'RESOLVED' && (
                      <Button size="sm" variant="outline" disabled={resolveErr.isPending} onClick={() => resolveErr.mutate({ id: e.id, status: 'RESOLVED' })}>
                        Tandai Selesai
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {errs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">Tidak ada laporan error.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!selectedErr} onClose={() => setSelectedErr(null)} title="Detail Error Telemetry">
        {selectedErr && (
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-bad">{selectedErr.message}</p>
            {selectedErr.stack && (
              <pre className="max-h-60 overflow-auto rounded-lg bg-black/80 p-3 font-mono text-[10px] text-white/80 whitespace-pre-wrap">
                {selectedErr.stack}
              </pre>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedErr(null)}>Tutup</Button>
              {selectedErr.status !== 'RESOLVED' && (
                <Button size="sm" onClick={() => resolveErr.mutate({ id: selectedErr.id, status: 'RESOLVED' })}>
                  Tandai Resolved
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
