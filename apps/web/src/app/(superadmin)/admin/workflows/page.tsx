'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fmtDate } from '@/lib/api';
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
  const save = useMutation({
    mutationFn: () => api(`/admin/agents/${a.id}`, { method: 'PATCH', json: { systemPrompt: prompt, config: { model: model.trim() || null, ...(maxTokens ? { maxTokens: Number(maxTokens) } : {}) } } }),
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="model" className="mb-1 block text-sm font-medium">Model (kosong = default koneksi member)</label><Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-…" /></div>
        <div><label htmlFor="mt" className="mb-1 block text-sm font-medium">Max tokens</label><Input id="mt" inputMode="numeric" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value.replace(/\D/g, ''))} /></div>
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
  const test = useMutation({ mutationFn: (id: string) => api<{ valid: boolean; issues: string[] }>(`/admin/workflows/${id}/test`, { method: 'POST' }), onSuccess: (r) => (r.valid ? toast.success('Workflow lolos pengujian') : setIssues(r.issues)) });
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

export default function AdminWorkflows() {
  const [tab, setTab] = useState<'agents' | 'workflow'>('agents');
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
      <Tabs label="Bagian" value={tab} onChange={setTab} items={[{ value: 'agents', label: 'Agent' }, { value: 'workflow', label: 'Workflow' }]} />
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
      </div>
      <Modal wide open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ''}>
        {edit && <AgentEditor key={edit.id} a={edit} onClose={() => setEdit(null)} />}
      </Modal>
    </>
  );
}
