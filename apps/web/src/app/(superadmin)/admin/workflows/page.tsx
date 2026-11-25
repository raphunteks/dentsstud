'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fmtBytes, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Tabs, Textarea } from '@/components/ui/extra';

interface Agent { id: string; code: string; name: string; description: string; isActive: boolean; currentVersion: number; config: { model?: string | null; temperature?: number; maxTokens?: number }; systemPrompt: string; outputContract: string | null; versions: { version: number; createdAt: string }[] }
interface Stage { code: string; agent: string; timeoutSec: number; maxAttempts: number }
interface Wf { id: string; code: string; name: string; status: string; currentVersion: number; versions: { id: string; version: number; createdAt: string; definition: { stages: Stage[] } }[] }

const ALL: Stage[] = [
  { code: 'RESEARCH', agent: 'research', timeoutSec: 300, maxAttempts: 3 },
  { code: 'SCRIPT', agent: 'scriptwriter', timeoutSec: 300, maxAttempts: 3 },
  { code: 'FACT_CHECK', agent: 'fact_checker', timeoutSec: 300, maxAttempts: 3 },
  { code: 'MOTION', agent: 'motion_director', timeoutSec: 1800, maxAttempts: 2 },
  { code: 'QC', agent: 'qc', timeoutSec: 300, maxAttempts: 2 },
  { code: 'SOCIAL', agent: 'social_media', timeoutSec: 300, maxAttempts: 3 },
];
const OPTIONAL = ['FACT_CHECK', 'QC'];

function AgentEditor({ a, onClose }: { a: Agent; onClose: () => void }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(a.systemPrompt);
  const [model, setModel] = useState(a.config.model ?? '');
  const [maxTokens, setMaxTokens] = useState(String(a.config.maxTokens ?? ''));
  const [temperature, setTemperature] = useState(a.config.temperature !== undefined ? String(a.config.temperature) : '');
  const save = useMutation({
    mutationFn: () =>
      api(`/admin/agents/${a.id}`, {
        method: 'PATCH',
        json: {
          systemPrompt: prompt,
          config: {
            ...a.config,
            model: model.trim() || null,
            ...(maxTokens ? { maxTokens: Number(maxTokens) } : {}),
            ...(temperature !== '' ? { temperature: Number(temperature) } : {}),
          },
        },
      }),
    onSuccess: () => (toast.success('Agent disimpan'), qc.invalidateQueries({ queryKey: ['admin-agents'] }), onClose()),
    onError: (e) => toast.error((e as Error).message),
  });
  const rollback = useMutation({
    mutationFn: (v: number) => api(`/admin/agents/${a.id}/rollback/${v}`, { method: 'POST' }),
    onSuccess: () => (toast.success('Versi prompt diaktifkan'), qc.invalidateQueries({ queryKey: ['admin-agents'] }), onClose()),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="grid gap-4">
      <label htmlFor="prompt" className="text-sm font-medium">System prompt (versi aktif v{a.currentVersion})</label>
      <Textarea id="prompt" rows={12} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-mono text-xs" />
      {a.outputContract && <p className="text-xs text-muted">Kontrak keluaran JSON ditambahkan otomatis oleh engine: <code className="font-mono">{a.outputContract}</code></p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="model" className="mb-1 block text-sm font-medium">Model (kosong = default)</label><Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-…" /></div>
        <div><label htmlFor="mt" className="mb-1 block text-sm font-medium">Max tokens</label><Input id="mt" inputMode="numeric" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value.replace(/\D/g, ''))} /></div>
        <div><label htmlFor="temp" className="mb-1 block text-sm font-medium">Temperature (0–1)</label><Input id="temp" type="number" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="0.7" /></div>
      </div>
      <Button loading={save.isPending} onClick={() => save.mutate()}>Simpan (prompt berubah = versi baru)</Button>
      {a.versions.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">Riwayat versi</p>
          <ul className="grid gap-1.5 text-sm">
            {a.versions.map((v) => (
              <li key={v.version} className="flex items-center justify-between">
                <span>v{v.version} · <span className="text-muted">{fmtDate(v.createdAt)}</span></span>
                {v.version === a.currentVersion ? <Status value="ACTIVE" /> : <Button variant="ghost" className="h-8" onClick={() => rollback.mutate(v.version)}>Aktifkan</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WorkflowBuilder({ wf }: { wf: Wf }) {
  const qc = useQueryClient();
  const current = wf.versions.find((v) => v.version === wf.currentVersion)?.definition.stages ?? ALL;
  const [stages, setStages] = useState<Stage[]>(current);
  const [issues, setIssues] = useState<string[]>([]);
  useEffect(() => setStages(current), [wf.currentVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const enabled = (code: string) => stages.some((s) => s.code === code);
  const toggle = (code: string) => setStages((x) => (enabled(code) ? x.filter((s) => s.code !== code) : ALL.filter((s) => s.code === code || x.some((y) => y.code === s.code)).map((s) => x.find((y) => y.code === s.code) ?? s)));
  const set = (code: string, k: 'timeoutSec' | 'maxAttempts', v: number) => setStages((x) => x.map((s) => (s.code === code ? { ...s, [k]: v } : s)));
  const create = useMutation({
    mutationFn: () => api<{ id: string; version: number }>('/admin/workflows', { method: 'POST', json: { workflowId: wf.id, definition: { stages } } }),
    onSuccess: (v) => (toast.success(`Versi ${v.version} dibuat (belum aktif)`), setIssues([]), qc.invalidateQueries({ queryKey: ['admin-workflows'] })),
    onError: (e) => (e instanceof ApiError && Array.isArray(e.details) ? setIssues(e.details as string[]) : toast.error((e as Error).message)),
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ valid: boolean; issues: string[] }>(`/admin/workflows/${id}/test`, { method: 'POST' }),
    onSuccess: (r) => (r.valid ? toast.success('Workflow lolos pengujian') : setIssues(r.issues)),
    onError: (e) => toast.error((e as Error).message),
  });
  const publish = useMutation({
    mutationFn: (id: string) => api<{ version: number }>(`/admin/workflows/${id}/publish`, { method: 'POST' }),
    onSuccess: (r) => (toast.success(`Versi ${r.version} aktif untuk pesanan baru`), qc.invalidateQueries({ queryKey: ['admin-workflows'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium">{wf.name}</h2>
          <p className="font-mono text-xs text-muted">{wf.code} · versi aktif v{wf.currentVersion}</p>
        </div>
        <Button loading={create.isPending} onClick={() => create.mutate()}>Simpan sebagai versi baru</Button>
      </div>
      <p className="mt-3 text-sm text-muted">Urutan tahap tetap. Cek fakta dan QC boleh dimatikan; pesanan yang sudah berjalan tetap memakai versi saat dipesan.</p>
      <ol className="mt-4 grid gap-2">
        {ALL.map((s, i) => {
          const cur = stages.find((x) => x.code === s.code);
          return (
            <li key={s.code} className="grid grid-cols-[28px_1fr] items-center gap-3 rounded-xl border border-line px-4 py-3 sm:grid-cols-[28px_1fr_auto_auto_auto]">
              <span className="num font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-sm font-medium">{s.code} <span className="font-normal text-muted">· {s.agent}</span></span>
              <label className="flex items-center gap-2 text-xs text-muted">Timeout (dtk)<Input aria-label={`Timeout ${s.code}`} className="h-9 w-24" inputMode="numeric" disabled={!cur} value={cur?.timeoutSec ?? s.timeoutSec} onChange={(e) => set(s.code, 'timeoutSec', Number(e.target.value.replace(/\D/g, '')) || 30)} /></label>
              <label className="flex items-center gap-2 text-xs text-muted">Percobaan<Input aria-label={`Percobaan ${s.code}`} className="h-9 w-16" inputMode="numeric" disabled={!cur} value={cur?.maxAttempts ?? s.maxAttempts} onChange={(e) => set(s.code, 'maxAttempts', Math.min(5, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></label>
              {OPTIONAL.includes(s.code) ? (
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!cur} onChange={() => toggle(s.code)} className="size-4 accent-[var(--color-accent)]" />Aktif</label>
              ) : <span className="text-xs text-muted">Wajib</span>}
            </li>
          );
        })}
      </ol>
      {issues.length > 0 && <ul className="mt-3 grid gap-1 text-sm text-bad" role="alert">{issues.map((x) => <li key={x}>• {x}</li>)}</ul>}
      <h3 className="mt-6 text-sm font-medium">Versi</h3>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {wf.versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>v{v.version} · <span className="text-muted">{v.definition.stages.map((s) => s.code).join(' → ')}</span></span>
            {v.version === wf.currentVersion ? <Status value="ACTIVE" /> : (
              <span className="flex gap-2">
                <Button variant="ghost" className="h-8" onClick={() => test.mutate(v.id)}>Uji</Button>
                <Button variant="ghost" className="h-8" onClick={() => publish.mutate(v.id)}>Aktifkan</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface MotionSkill {
  id: string;
  name: string;
  description?: string;
  content: string;
  active: boolean;
  sourceType?: 'manual' | 'zip' | 'folder';
  filesCount?: number;
  files?: string[];
  totalBytes?: number;
  storagePath?: string;
  createdAt?: string;
  updatedAt?: string;
}

function SkillsCms() {
  const qc = useQueryClient();
  const skills = useQuery({
    queryKey: ['admin-skills'],
    queryFn: async () => {
      const res = await api<MotionSkill[] | { items?: MotionSkill[] }>('/admin/skills');
      return Array.isArray(res) ? res : (res?.items ?? []);
    },
  });

  const [mode, setMode] = useState<'zip' | 'folder' | 'manual'>('zip');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [busyUpload, setBusyUpload] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<MotionSkill | null>(null);
  const [editSkill, setEditSkill] = useState<MotionSkill | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editContent, setEditContent] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api('/admin/skills', {
        method: 'POST',
        json: { name: name.trim(), description: description.trim() || undefined, content, active: true },
      }),
    onSuccess: () => {
      toast.success('Skill motion berhasil disimpan');
      setName('');
      setDescription('');
      setContent('');
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; content?: string; active?: boolean } }) =>
      api<MotionSkill>(`/admin/skills/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => {
      toast.success('Skill diperbarui');
      setEditSkill(null);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/skills/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Skill dihapus');
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadZip = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) return toast.error('Pilih file arsip .zip');
    setBusyUpload(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch('/api/v1/admin/skills/upload-zip', { method: 'POST', body: fd, credentials: 'include' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Upload ZIP gagal');
      toast.success(`${body?.count ?? 1} skill berhasil diimpor dari ZIP`);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyUpload(false);
    }
  };

  const uploadFolder = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setBusyUpload(true);
    try {
      const files: { path: string; content?: string; base64?: string }[] = [];
      let folderName = '';
      for (const f of Array.from(fileList)) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        if (!folderName && rel.includes('/')) folderName = rel.split('/')[0] ?? '';
        if (/(^|\/)(__MACOSX|\.DS_Store|node_modules|\.git)(\/|$)/i.test(rel)) continue;
        if (/\.(md|markdown|txt|json|py|sh|js|mjs|ts|tsx|css|html|svg|yml|yaml)$/i.test(rel)) {
          files.push({ path: rel, content: await f.text() });
        } else {
          const buf = new Uint8Array(await f.arrayBuffer());
          let bin = '';
          for (let i = 0; i < buf.length; i += 0x8000) {
            bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          }
          files.push({ path: rel, base64: btoa(bin) });
        }
      }
      if (!files.length) throw new Error('Folder kosong atau tidak ada file yang valid');
      const res = await api<{ imported: MotionSkill[]; count: number }>('/admin/skills/upload-folder', {
        method: 'POST',
        json: { folderName: folderName || undefined, files },
      });
      toast.success(`${res.count} skill berhasil diimpor dari folder`);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyUpload(false);
    }
  };

  const loadMdFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (!name) setName(file.name.replace(/\.(md|markdown|txt)$/i, ''));
    setContent(text);
    toast.success(`File ${file.name} dimuat`);
  };

  const openEdit = (s: MotionSkill) => {
    setEditSkill(s);
    setEditName(s.name);
    setEditDesc(s.description ?? '');
    setEditContent(s.content);
  };

  const list = skills.data ?? [];
  const activeCount = list.filter((s) => s.active !== false).length;
  const inactiveCount = list.length - activeCount;
  const activeChars = list.filter((s) => s.active !== false).reduce((sum, s) => sum + (s.content?.length ?? 0), 0);

  return (
    <div className="grid gap-6">
      {/* Live Summary Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Total Skills</p>
          <p className="num mt-1 text-2xl font-semibold">{list.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Aktif</p>
          <p className="num mt-1 text-2xl font-semibold text-ok">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Nonaktif</p>
          <p className="num mt-1 text-2xl font-semibold text-muted">{inactiveCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Total Karakter Aktif</p>
          <p className="num mt-1 text-2xl font-semibold">{activeChars.toLocaleString('id-ID')}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Tambah / Impor Skill</h2>
          <p className="mt-1 text-xs text-muted">
            Skill aktif otomatis disuntikkan ke prompt <code>motion_director</code> saat produksi berjalan.
          </p>
          <div className="mt-3">
            <Tabs
              label="Mode upload skill"
              value={mode}
              onChange={setMode}
              items={[
                { value: 'zip', label: 'Upload .ZIP' },
                { value: 'folder', label: 'Upload Folder' },
                { value: 'manual', label: '.md / Manual' },
              ]}
            />
          </div>

          {mode === 'zip' && (
            <div className="mt-4 grid gap-3">
              <p className="text-xs text-muted">
                Unggah arsip <code>.zip</code> berisi 1 atau banyak folder skill (termasuk <code>SKILL.md</code>, <code>scripts/</code>, <code>references/</code>, dan aset pendukung) langsung ke VPS storage &amp; database.
              </p>
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-4 text-center text-xs hover:bg-surface-2">
                <span className="font-medium text-text">{busyUpload ? 'Mengunggah & mengekstrak ZIP…' : 'Pilih file .zip Skill'}</span>
                <span className="text-muted">Mendukung frontmatter YAML (name & description)</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={busyUpload}
                  className="sr-only"
                  onChange={(e) => {
                    void uploadZip(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}

          {mode === 'folder' && (
            <div className="mt-4 grid gap-3">
              <p className="text-xs text-muted">
                Pilih langsung folder skill dari komputer Anda. Semua file <code>SKILL.md</code> &amp; <code>.md</code> di dalamnya akan dipindai dan disimpan.
              </p>
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-4 text-center text-xs hover:bg-surface-2">
                <span className="font-medium text-text">{busyUpload ? 'Memindai & mengunggah folder…' : 'Pilih Folder Skill'}</span>
                <span className="text-muted">Otomatis mendeteksi 1 atau beberapa SKILL.md</span>
                <input
                  type="file"
                  disabled={busyUpload}
                  className="sr-only"
                  {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                  onChange={(e) => {
                    void uploadFolder(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}

          {mode === 'manual' && (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || !content.trim()) return toast.error('Nama dan konten skill wajib diisi');
                create.mutate();
              }}
            >
              <label className="flex h-10 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-line px-3 text-xs hover:bg-surface-2">
                Muat file .md dari komputer
                <input type="file" accept=".md,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => void loadMdFile(e.target.files?.[0])} />
              </label>
              <Input placeholder="Nama skill (mis. motionmaxxing)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Deskripsi singkat (opsional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Textarea rows={10} placeholder="# Instruksi Motion Skill..." value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" />
              <Button type="submit" loading={create.isPending}>Simpan Skill</Button>
            </form>
          )}
        </Card>

        <div className="grid gap-3">
          {skills.isError && <ErrorNote error={skills.error} onRetry={() => skills.refetch()} />}
          {skills.isLoading && <Skeleton className="h-48 rounded-card" />}
          {!skills.isLoading && list.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted">Belum ada skill motion yang terdaftar.</Card>
          )}
          {list.map((s) => {
            const isActive = s.active !== false;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-medium">{s.name}</h3>
                      <Status value={isActive ? 'ACTIVE' : 'DISABLED'} label={isActive ? 'Aktif' : 'Nonaktif'} />
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                        {s.sourceType ?? 'manual'} · {s.filesCount ?? 1} file{s.totalBytes ? ` · ${fmtBytes(s.totalBytes)}` : ''} · {s.content.length.toLocaleString('id-ID')} kar
                      </span>
                    </div>
                    {s.description && <p className="mt-1 text-xs text-muted">{s.description}</p>}
                    {(s.updatedAt || s.createdAt) && (
                      <p className="mt-1 font-mono text-[11px] text-muted">Diperbarui {fmtDate(s.updatedAt ?? s.createdAt)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => patch.mutate({ id: s.id, data: { active: !isActive } })}
                    >
                      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setPreviewSkill(s)}>
                      Preview
                    </Button>
                    <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="h-8 px-2.5 text-xs"
                      loading={remove.isPending && remove.variables === s.id}
                      onClick={() => confirm(`Hapus skill "${s.name}"?`) && remove.mutate(s.id)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] text-muted whitespace-pre-wrap">
                  {s.content.slice(0, 600)}{s.content.length > 600 ? '\n…' : ''}
                </pre>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal wide open={!!previewSkill} onClose={() => setPreviewSkill(null)} title={previewSkill ? `Preview: ${previewSkill.name}` : ''}>
        {previewSkill && (
          <div className="grid gap-3">
            {previewSkill.description && <p className="text-sm text-muted">{previewSkill.description}</p>}
            <pre className="max-h-[65vh] overflow-auto rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {previewSkill.content}
            </pre>
          </div>
        )}
      </Modal>

      <Modal wide open={!!editSkill} onClose={() => setEditSkill(null)} title={editSkill ? `Edit Skill: ${editSkill.name}` : ''}>
        {editSkill && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editName.trim() || !editContent.trim()) return toast.error('Nama dan konten wajib diisi');
              patch.mutate({ id: editSkill.id, data: { name: editName.trim(), description: editDesc.trim(), content: editContent } });
            }}
          >
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama skill" />
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Deskripsi singkat" />
            <Textarea rows={16} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="font-mono text-xs" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditSkill(null)}>Batal</Button>
              <Button type="submit" loading={patch.isPending}>Simpan perubahan</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function AdminWorkflows() {
  const [tab, setTab] = useState<'agents' | 'workflow' | 'skills'>('agents');
  const [edit, setEdit] = useState<Agent | null>(null);
  const agents = useQuery({ queryKey: ['admin-agents'], queryFn: () => api<Agent[]>('/admin/agents') });
  const wfs = useQuery({ queryKey: ['admin-workflows'], queryFn: () => api<Wf[]>('/admin/workflows') });
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (a: Agent) => api(`/admin/agents/${a.id}`, { method: 'PATCH', json: { isActive: !a.isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-agents'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHead eyebrow="07 · Superadmin" title="Agent Workflow" />
      <Tabs
        label="Bagian"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'agents', label: 'Agent' },
          { value: 'workflow', label: 'Workflow' },
          { value: 'skills', label: 'Skills Library' },
        ]}
      />
      <div className="mt-5">
        {tab === 'agents' && (
          <>
            {agents.isError && <ErrorNote error={agents.error} onRetry={() => agents.refetch()} />}
            {agents.isLoading && <Skeleton className="h-72 rounded-card" />}
            <ul className="grid gap-3 md:grid-cols-2">
              {agents.data?.map((a) => (
                <li key={a.id}>
                  <Card className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-medium">{a.name}</h2>
                        <p className="font-mono text-xs text-muted">{a.code} · prompt v{a.currentVersion}{a.config.model ? ` · ${a.config.model}` : ''}</p>
                      </div>
                      <Status value={a.isActive ? 'ACTIVE' : 'DISABLED'} label={a.isActive ? 'Aktif' : 'Nonaktif'} />
                    </div>
                    <p className="mt-2 flex-1 text-sm text-muted">{a.description}</p>
                    <div className="mt-4 flex gap-2">
                      <Button className="h-9" onClick={() => setEdit(a)}>Edit prompt</Button>
                      <Button variant="ghost" className="h-9" onClick={() => toggle.mutate(a)}>{a.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === 'workflow' && (
          <>
            {wfs.isError && <ErrorNote error={wfs.error} onRetry={() => wfs.refetch()} />}
            {wfs.isLoading && <Skeleton className="h-72 rounded-card" />}
            <div className="grid gap-4">{wfs.data?.map((w) => <WorkflowBuilder key={w.id} wf={w} />)}</div>
          </>
        )}
        {tab === 'skills' && <SkillsCms />}
      </div>
      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ''}>
        {edit && <AgentEditor key={edit.id} a={edit} onClose={() => setEdit(null)} />}
      </Modal>
    </>
  );
}
