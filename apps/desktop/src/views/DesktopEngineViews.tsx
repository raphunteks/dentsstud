import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { get, invoke, mutate, toMediaUrl } from '../bridge';
import { Button, Card, Input, Modal, Pill, Select, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';

interface RenderJob {
  id: string;
  projectName: string;
  mode: 'LOCAL' | 'CLOUD' | string;
  status: string;
  progress: number;
  error?: string | null;
  createdAt?: string;
  outputs: { url: string; format: string }[];
}

export function LocalRenderView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'LOCAL' | 'CLOUD'>('ALL');
  const cap = useQuery({
    queryKey: ['render-cap'],
    queryFn: () => invoke<{ chrome: string | null }>('render:capability'),
  });
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: () => get<RenderJob[]>('/render/jobs').catch(() => []),
    refetchInterval: (query) =>
      query.state.data?.some((j) => j.status === 'RUNNING' || j.status === 'QUEUED' || j.status === 'AWAITING_LOCAL')
        ? 3000
        : 15000,
  });
  const [prog, setProg] = useState<Record<string, number>>({});

  useEffect(() => {
    const b = window.dentsweb ?? window.dentweb;
    return b
      ? b.onEvent((e) => e.channel === 'render:progress' && e.data?.jobId && setProg((p) => ({ ...p, [e.data.jobId]: e.data.progress })))
      : undefined;
  }, []);

  const runLocal = useMutation({
    mutationFn: (jobId: string) => invoke('render:local', { jobId }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const cancelCloud = useMutation({
    mutationFn: (jobId: string) => mutate('POST', `/render/jobs/${jobId}/cancel`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const retryCloud = useMutation({
    mutationFn: (jobId: string) => mutate('POST', `/render/jobs/${jobId}/retry`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const filtered = (jobs.data ?? []).filter((j) => filter === 'ALL' || j.mode === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">ENGINE DESKTOP</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Render Center (Lokal & Cloud)
          </h1>
          <p className="mt-1 text-sm text-muted">
            Browser render:{' '}
            {cap.data?.chrome ? (
              <Pill ok>{cap.data.chrome.split(/[\\/]/).pop()}</Pill>
            ) : (
              <Pill ok={false}>Chrome/Edge tidak ditemukan</Pill>
            )}{' '}
            · Pantau dan jalankan antrean render lokal GPU atau Cloud Worker.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(['ALL', 'LOCAL', 'CLOUD'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded-full px-3.5 py-1 text-xs font-medium transition cursor-pointer',
                filter === f ? 'bg-accent text-accent-contrast font-semibold' : 'text-muted hover:text-text'
              )}
            >
              {f === 'ALL' ? 'Semua' : f === 'LOCAL' ? 'Lokal' : 'Cloud'}
            </button>
          ))}
        </div>
      </div>

      {runLocal.isError && <p role="alert" className="text-sm text-bad">{errMsg(runLocal.error)}</p>}
      {cancelCloud.isError && <p role="alert" className="text-sm text-bad">{errMsg(cancelCloud.error)}</p>}
      {retryCloud.isError && <p role="alert" className="text-sm text-bad">{errMsg(retryCloud.error)}</p>}

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-muted">
          Belum ada job antrean render pada filter ini.
        </Card>
      )}

      {filtered.map((j) => {
        const pct = Math.round((prog[j.id] ?? (j.progress || 0) / 100) * 100);
        return (
          <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-text truncate">{j.projectName}</p>
                <Pill variant={j.mode === 'LOCAL' ? 'accent' : 'blue'}>{j.mode}</Pill>
                <Pill ok={j.status === 'COMPLETED' ? true : j.status === 'FAILED' ? false : null}>{j.status}</Pill>
              </div>
              <p className="text-xs text-muted font-mono">Progress: {pct}%</p>
              {j.error && <p className="text-xs text-bad">{j.error}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {j.mode === 'LOCAL' && j.status === 'AWAITING_LOCAL' && (
                <Button disabled={!cap.data?.chrome || runLocal.isPending} onClick={() => runLocal.mutate(j.id)} size="sm">
                  ▶ Render di Komputer Ini
                </Button>
              )}
              {j.mode === 'LOCAL' && j.status === 'RUNNING' && (
                <Button variant="ghost" onClick={() => void invoke('render:cancel', { jobId: j.id })} size="sm">
                  Hentikan
                </Button>
              )}
              {j.mode === 'CLOUD' && (j.status === 'QUEUED' || j.status === 'RUNNING') && (
                <Button variant="ghost" size="sm" disabled={cancelCloud.isPending} onClick={() => cancelCloud.mutate(j.id)}>
                  Batalkan Cloud
                </Button>
              )}
              {j.mode === 'CLOUD' && (j.status === 'FAILED' || j.status === 'CANCELLED') && (
                <Button size="sm" disabled={retryCloud.isPending} onClick={() => retryCloud.mutate(j.id)}>
                  ↻ Coba Ulang
                </Button>
              )}
              {(j.outputs ?? []).map((o) => (
                <Button
                  key={o.url}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void invoke('shell:open-external', { url: toMediaUrl(o.url) }).catch(() => undefined)
                  }
                >
                  ⬇ Buka Hasil ({o.format})
                </Button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

interface LocalProject {
  id: string;
  name: string;
  revision: number;
  updatedAt?: string;
  pendingOps: number;
  document: {
    title: string;
    format?: string;
    scenes: { id: string; name: string; layers: { id: string; type: string; text?: string }[] }[];
  };
}

export function OfflineProjectsView() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newFormat, setNewFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [editing, setEditing] = useState<LocalProject | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editScenes, setEditScenes] = useState<{ id: string; name: string; layers: { id: string; type: string; text?: string }[] }[]>([]);
  const [syncResults, setSyncResults] = useState<{ projectId: string; status: string; conflictCopy?: string }[] | null>(null);
  const [renderFeedback, setRenderFeedback] = useState<string | null>(null);

  const remote = useQuery({
    queryKey: ['remote-projects'],
    queryFn: () => get<{ id: string; name: string; format?: string }[]>('/projects'),
    retry: false,
  });

  const local = useQuery({
    queryKey: ['local-projects'],
    queryFn: () => invoke<LocalProject[]>('projects:local-list'),
  });

  const createProj = useMutation({
    mutationFn: async () => {
      const created = await mutate<{ id: string; name: string }>('POST', '/projects', {
        name: newName.trim(),
        format: newFormat,
      });
      await invoke('projects:cache', { projectId: created.id }).catch(() => undefined);
      return created;
    },
    onSuccess: () => {
      setNewName('');
      qc.invalidateQueries({ queryKey: ['remote-projects'] });
      qc.invalidateQueries({ queryKey: ['local-projects'] });
    },
  });

  const cache = useMutation({
    mutationFn: (projectId: string) => invoke('projects:cache', { projectId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-projects'] }),
  });

  const sync = useMutation({
    mutationFn: () => invoke<{ projectId: string; status: string; conflictCopy?: string }[]>('projects:sync'),
    onSuccess: (res) => {
      setSyncResults(res);
      qc.invalidateQueries({ queryKey: ['local-projects'] });
      qc.invalidateQueries({ queryKey: ['remote-projects'] });
    },
  });

  const saveLocalOp = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const ops: Record<string, unknown>[] = [];
      if (editTitle.trim() && editTitle.trim() !== editing.document.title) {
        ops.push({ op: 'setMeta', patch: { title: editTitle.trim() } });
      }
      for (const sc of editScenes) {
        const origSc = editing.document.scenes.find((s) => s.id === sc.id);
        if (!origSc) continue;
        if (sc.name !== origSc.name) {
          ops.push({ op: 'updateScene', sceneId: sc.id, patch: { name: sc.name } });
        }
        for (const ly of sc.layers) {
          const origLy = origSc.layers.find((l) => l.id === ly.id);
          if (origLy && ly.type === 'text' && ly.text !== origLy.text) {
            ops.push({ op: 'updateLayer', sceneId: sc.id, layerId: ly.id, patch: { text: ly.text ?? '' } });
          }
        }
      }
      if (ops.length === 0) throw new Error('Tidak ada perubahan untuk disimpan');
      return invoke('projects:local-op', { projectId: editing.id, ops });
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['local-projects'] });
    },
  });

  const queueRender = useMutation({
    mutationFn: ({ projectId, mode }: { projectId: string; mode: 'LOCAL' | 'CLOUD' }) =>
      mutate('POST', '/render/jobs', { projectId, mode }),
    onSuccess: (_d, vars) => {
      setRenderFeedback(`Job render ${vars.mode} berhasil dimasukkan ke antrean! Buka tab Render Lokal.`);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (e) => setRenderFeedback(`Gagal mengantrekan render: ${errMsg(e)}`),
  });

  const openEditor = (p: LocalProject) => {
    setEditing(p);
    setEditTitle(p.document?.title ?? p.name);
    setEditScenes(JSON.parse(JSON.stringify(p.document?.scenes ?? [])));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">ENGINE DESKTOP</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Project Offline & Editor Scene
          </h1>
          <p className="mt-1 text-sm text-muted">
            Buat, unduh, edit judul/scene/layer teks secara offline, lalu sinkronkan atau antrekan render.
          </p>
        </div>
        <Button disabled={sync.isPending} onClick={() => sync.mutate()} size="sm">
          {sync.isPending ? 'Menyinkronkan…' : '↻ Sinkronkan Sekarang'}
        </Button>
      </div>

      {sync.isError && <p role="alert" className="text-xs text-bad">{errMsg(sync.error)}</p>}
      {renderFeedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs text-text flex justify-between items-center">
          <span>{renderFeedback}</span>
          <button onClick={() => setRenderFeedback(null)} className="text-muted hover:text-text cursor-pointer">✕</button>
        </div>
      )}

      {syncResults && syncResults.length > 0 && (
        <Card className="p-4 space-y-2 border-accent/40">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text">Hasil Sinkronisasi</h3>
            <button onClick={() => setSyncResults(null)} className="text-xs text-muted hover:text-text cursor-pointer">Tutup</button>
          </div>
          <ul className="space-y-1 text-xs">
            {syncResults.map((r, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <Pill ok={r.status === 'SYNCED' ? true : r.status.startsWith('ERROR') ? false : null}>{r.status}</Pill>
                <span className="font-mono text-muted">{r.projectId.slice(0, 8)}</span>
                {r.conflictCopy && <span className="text-amber-500">Salinan konflik: {r.conflictCopy.slice(0, 8)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Buat Project Baru */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text">Buat Project Motion Baru</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim().length < 2) return;
            createProj.mutate();
          }}
          className="flex flex-wrap gap-2"
        >
          <Input
            placeholder="Nama project baru (mis. Edukasi Karang Gigi)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[220px] h-10 text-xs"
          />
          <Select value={newFormat} onChange={(e) => setNewFormat(e.target.value as typeof newFormat)} className="w-36 h-10 text-xs">
            <option value="9:16">9:16 Reels</option>
            <option value="16:9">16:9 YouTube</option>
            <option value="1:1">1:1 Square</option>
          </Select>
          <Button type="submit" size="sm" disabled={createProj.isPending || newName.trim().length < 2}>
            {createProj.isPending ? 'Membuat…' : '+ Buat & Unduh'}
          </Button>
        </form>
        {createProj.isError && <p className="text-xs text-bad">{errMsg(createProj.error)}</p>}
      </Card>

      {/* Project di Server untuk Diunduh */}
      {remote.data && remote.data.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text">Tersedia di Server untuk Diunduh Offline:</h2>
          <div className="flex flex-wrap gap-2">
            {remote.data.map((p) => (
              <Button key={p.id} variant="ghost" size="sm" disabled={cache.isPending} onClick={() => cache.mutate(p.id)}>
                ↓ Unduh {p.name}
              </Button>
            ))}
          </div>
          {cache.isError && <p className="text-xs text-bad">{errMsg(cache.error)}</p>}
        </Card>
      )}

      {/* Daftar Project Offline Tersimpan */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          Project Tersimpan di Disk Lokal ({local.data?.length ?? 0})
        </h2>

        {local.data && local.data.length === 0 && (
          <Card className="p-8 text-center text-muted">
            Belum ada project yang disimpan di komputer ini. Buat project baru atau unduh dari daftar di atas.
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(local.data ?? []).map((p) => (
            <Card key={p.id} className="p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-text truncate">
                    {p.document?.title || p.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Pill>Rev {p.revision}</Pill>
                    {p.pendingOps > 0 && (
                      <Pill variant="accent">{p.pendingOps} belum sinkron</Pill>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {p.document?.scenes?.length ?? 0} scene · Format {p.document?.format ?? '9:16'}
                  {p.updatedAt ? ` · Diperbarui ${new Date(p.updatedAt).toLocaleString('id-ID')}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                <Button size="sm" variant="outline" onClick={() => openEditor(p)}>
                  <Icon name="edit" className="w-3.5 h-3.5" /> Edit Offline
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={queueRender.isPending}
                  onClick={() => queueRender.mutate({ projectId: p.id, mode: 'LOCAL' })}
                >
                  <Icon name="monitor" className="w-3.5 h-3.5" /> Render Lokal
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={queueRender.isPending}
                  onClick={() => queueRender.mutate({ projectId: p.id, mode: 'CLOUD' })}
                >
                  <Icon name="cloud" className="w-3.5 h-3.5" /> Render Cloud
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal Edit Offline */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Offline: ${editing?.name ?? ''}`}>
        {editing && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text">Judul Dokumen</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xs" />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-text">Daftar Scene & Layer Teks</p>
              {editScenes.length === 0 && (
                <p className="text-xs text-muted">Dokumen ini belum memiliki scene.</p>
              )}
              {editScenes.map((sc, sIdx) => (
                <div key={sc.id} className="rounded-xl border border-line bg-surface-2/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted shrink-0">Scene {sIdx + 1}</span>
                    <Input
                      value={sc.name}
                      onChange={(e) => {
                        const next = [...editScenes];
                        next[sIdx] = { ...sc, name: e.target.value };
                        setEditScenes(next);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  {sc.layers
                    .filter((l) => l.type === 'text')
                    .map((ly) => {
                      const lIdx = sc.layers.findIndex((x) => x.id === ly.id);
                      return (
                        <div key={ly.id} className="pl-3 space-y-1">
                          <span className="text-[10px] font-mono text-muted">Layer Teks ({ly.id.slice(0, 6)})</span>
                          <Input
                            value={ly.text ?? ''}
                            onChange={(e) => {
                              const next = [...editScenes];
                              const nextLayers = [...sc.layers];
                              nextLayers[lIdx] = { ...ly, text: e.target.value };
                              next[sIdx] = { ...sc, layers: nextLayers };
                              setEditScenes(next);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            {saveLocalOp.isError && <p className="text-xs text-bad">{errMsg(saveLocalOp.error)}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Batal</Button>
              <Button size="sm" disabled={saveLocalOp.isPending} onClick={() => saveLocalOp.mutate()}>
                {saveLocalOp.isPending ? 'Menyimpan…' : 'Simpan ke Jurnal Offline'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function FolderImportView() {
  const [kind, setKind] = useState<'preset' | 'voice' | 'hook'>('preset');
  const [p, setP] = useState(0);

  useEffect(() => {
    const b = window.dentsweb ?? window.dentweb;
    return b ? b.onEvent((e) => e.channel === 'import:progress' && setP(e.data.progress)) : undefined;
  }, []);

  const run = useMutation({
    mutationFn: () =>
      invoke<{
        canceled?: boolean;
        validated?: { id: string; status: string; items: { originalPath: string; status: string; validationErrors: string[] }[] };
        skipped?: string[];
      }>('import:folder', { kind }),
  });

  const commit = useMutation({
    mutationFn: (batchId: string) =>
      invoke<{ status: string }>('api:mutate', {
        method: 'POST',
        path: '/admin/imports/commit',
        body: { batchId },
      }),
  });

  const v = run.data?.validated;
  const skipped = run.data?.skipped ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Import Folder Konten Lokal
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pindai folder lokal untuk memvalidasi preset gaya visual, suara, atau hook.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-5">
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="preset">Preset gaya visual</option>
          <option value="voice">Suara narator</option>
          <option value="hook">Hook pembuka</option>
        </Select>
        <Button disabled={run.isPending} onClick={() => (setP(0), commit.reset(), run.mutate())}>
          {run.isPending ? `Memindai ${Math.round(p * 100)}%…` : 'Pilih Folder di Komputer'}
        </Button>
      </Card>

      {run.isError && <p role="alert" className="text-sm text-bad">{errMsg(run.error)}</p>}

      {skipped.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 space-y-1.5">
          <p className="text-xs font-semibold text-amber-500">File Dilewati ({skipped.length}):</p>
          <ul className="text-[11px] font-mono text-muted max-h-28 overflow-y-auto space-y-0.5">
            {skipped.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      {v && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-text">Hasil Validasi · {v.status}</h2>
            <Button
              disabled={commit.isPending || commit.isSuccess || !v.items.some((i) => i.status === 'VALID')}
              onClick={() => commit.mutate(v.id)}
              size="sm"
            >
              {commit.isPending ? 'Menyimpan…' : commit.isSuccess ? '✓ Berhasil Di-commit' : 'Commit ke Database'}
            </Button>
          </div>

          {commit.isSuccess && (
            <p className="text-xs text-ok font-medium">
              ✓ Batch berhasil disimpan ke katalog sebagai DRAFT (status: {commit.data?.status ?? 'COMMITTED'}).
            </p>
          )}
          {commit.isError && <p role="alert" className="text-xs text-bad">{errMsg(commit.error)}</p>}

          <ul className="space-y-2 text-xs">
            {v.items.map((i) => (
              <li key={i.originalPath} className="rounded-lg border border-line/60 bg-surface-2/30 p-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <Pill ok={i.status === 'VALID'}>{i.status}</Pill>
                  <span className="font-mono text-muted truncate">{i.originalPath}</span>
                </div>
                {i.validationErrors && i.validationErrors.length > 0 && (
                  <ul className="pl-4 list-disc text-[11px] text-bad">
                    {i.validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
