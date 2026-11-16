import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { get, invoke } from '../bridge';
import { Button, Card, Pill, Select, errMsg } from '../components/UI';

export function LocalRenderView() {
  const qc = useQueryClient();
  const cap = useQuery({
    queryKey: ['render-cap'],
    queryFn: () => invoke<{ chrome: string | null }>('render:capability'),
  });
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: () =>
      get<{ id: string; projectName: string; mode: string; status: string; progress: number; outputs: { url: string; format: string }[] }[]>('/render/jobs'),
    refetchInterval: 4000,
  });
  const [prog, setProg] = useState<Record<string, number>>({});

  useEffect(() => {
    const b = window.dentsweb ?? window.dentweb;
    return b
      ? b.onEvent((e) => e.channel === 'render:progress' && e.data.jobId && setProg((p) => ({ ...p, [e.data.jobId!]: e.data.progress })))
      : undefined;
  }, []);

  const run = useMutation({
    mutationFn: (jobId: string) => invoke('render:local', { jobId }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const local = jobs.data?.filter((j) => j.mode === 'LOCAL') ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">ENGINE DESKTOP</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Render Lokal Komputer
        </h1>
        <p className="mt-1 text-sm text-muted">
          Browser render:{' '}
          {cap.data?.chrome ? (
            <Pill ok>{cap.data.chrome.split(/[\\/]/).pop()}</Pill>
          ) : (
            <Pill ok={false}>Chrome/Edge tidak ditemukan</Pill>
          )}{' '}
          · Menggunakan GPU komputer Anda sendiri untuk rendering Remotion tanpa kuota server.
        </p>
      </div>

      {run.isError && <p role="alert" className="text-sm text-bad">{errMsg(run.error)}</p>}

      {local.length === 0 && (
        <Card className="p-8 text-center text-muted">
          Belum ada job antrean render lokal aktif.
        </Card>
      )}

      {local.map((j) => (
        <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium text-text">{j.projectName}</p>
            <p className="text-xs text-muted">
              {j.status} · {Math.round((prog[j.id] ?? j.progress / 100) * 100)}%
            </p>
          </div>
          <div className="flex gap-2">
            {j.status === 'AWAITING_LOCAL' && (
              <Button disabled={!cap.data?.chrome || run.isPending} onClick={() => run.mutate(j.id)} size="sm">
                Render di Komputer Ini
              </Button>
            )}
            {j.status === 'RUNNING' && (
              <Button variant="ghost" onClick={() => invoke('render:cancel', { jobId: j.id })} size="sm">
                Hentikan
              </Button>
            )}
            {j.outputs.map((o) => (
              <Button
                key={o.url}
                variant="ghost"
                size="sm"
                onClick={() =>
                  invoke('shell:open-external', {
                    url: o.url.startsWith('http') ? o.url : `https://${o.url}`,
                  }).catch(() => undefined)
                }
              >
                Buka Hasil {o.format}
              </Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function OfflineProjectsView() {
  const qc = useQueryClient();
  const remote = useQuery({
    queryKey: ['remote-projects'],
    queryFn: () => get<{ id: string; name: string }[]>('/projects'),
    retry: false,
  });
  const local = useQuery({
    queryKey: ['local-projects'],
    queryFn: () =>
      invoke<
        {
          id: string;
          name: string;
          revision: number;
          pendingOps: number;
          document: { title: string; scenes: { id: string; name: string; layers: { id: string; type: string; text?: string }[] }[] };
        }[]
      >('projects:local-list'),
  });
  const cache = useMutation({
    mutationFn: (projectId: string) => invoke('projects:cache', { projectId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-projects'] }),
  });
  const sync = useMutation({
    mutationFn: () => invoke<{ status: string; conflictCopy?: string }[]>('projects:sync'),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">ENGINE DESKTOP</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Project Offline
          </h1>
          <p className="mt-1 text-sm text-muted">
            Simpan project di disk komputer Anda untuk diedit kapan saja tanpa internet.
          </p>
        </div>
        <Button disabled={sync.isPending} onClick={() => sync.mutate()} size="sm">
          {sync.isPending ? 'Menyinkronkan…' : 'Sinkronkan Sekarang'}
        </Button>
      </div>

      {remote.data && remote.data.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text">Tersedia di Server untuk Diunduh:</h2>
          <div className="flex flex-wrap gap-2">
            {remote.data.map((p) => (
              <Button key={p.id} variant="ghost" size="sm" onClick={() => cache.mutate(p.id)}>
                ↓ Unduh {p.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {local.data && local.data.length === 0 && (
        <Card className="p-8 text-center text-muted">
          Belum ada project yang disimpan di komputer ini.
        </Card>
      )}
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
        <Button disabled={run.isPending} onClick={() => (setP(0), run.mutate())}>
          {run.isPending ? `Memindai ${Math.round(p * 100)}%…` : 'Pilih Folder di Komputer'}
        </Button>
      </Card>

      {run.isError && <p role="alert" className="text-sm text-bad">{errMsg(run.error)}</p>}

      {v && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-text">Hasil Validasi · {v.status}</h2>
            <Button
              disabled={commit.isPending || !v.items.some((i) => i.status === 'VALID')}
              onClick={() => commit.mutate(v.id)}
              size="sm"
            >
              Commit ke Database
            </Button>
          </div>
          <ul className="space-y-2 text-xs">
            {v.items.map((i) => (
              <li key={i.originalPath} className="flex items-center gap-2">
                <Pill ok={i.status === 'VALID'}>{i.status}</Pill>
                <span className="font-mono text-muted">{i.originalPath}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
