'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, fmtBytes, fmtDate } from '@/lib/api';
import { uploadFiles } from '@/lib/upload';
import { Button, Card, Empty, PageHead, Status } from '@/components/ui';
import { Progress, Select, Table } from '@/components/ui/extra';

interface Item { id: string; originalPath: string; status: string; validationErrors: string[]; targetId: string | null }
interface Batch { id: string; kind: string; source: string; status: string; summary: Record<string, number>; createdAt: string; items?: Item[] }

export default function ImportPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'preset' | 'voice' | 'hook'>('preset');
  const [files, setFiles] = useState<{ file: File; path: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [batch, setBatch] = useState<Batch | null>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const history = useQuery({ queryKey: ['imports'], queryFn: () => api<Batch[]>('/admin/imports') });

  const pick = (list: FileList | null) => setFiles([...(list ?? [])].map((f) => ({ file: f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name })));
  const total = files.reduce((a, f) => a + f.file.size, 0);

  const run = useMutation({
    mutationFn: async () => {
      const b = await api<Batch>('/admin/imports/init', { method: 'POST', json: { kind, source: 'DASHBOARD_UPLOAD' } });
      for (let i = 0; i < files.length; i += 50) {
        const chunk = files.slice(i, i + 50);
        await uploadFiles(`/admin/imports/upload?batchId=${b.id}`, chunk, (p) => setProgress(((i + p * chunk.length) / files.length) * 100));
      }
      return api<Batch>('/admin/imports/validate', { method: 'POST', json: { batchId: b.id } });
    },
    onSuccess: (b) => (setBatch(b), qc.invalidateQueries({ queryKey: ['imports'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  const commit = useMutation({
    mutationFn: () => api<Batch>('/admin/imports/commit', { method: 'POST', json: { batchId: batch!.id } }),
    onSuccess: (b) => (setBatch(b), setFiles([]), toast.success(`Status: ${b.status}. Item masuk sebagai Draft.`), qc.invalidateQueries()),
    onError: (e) => toast.error((e as Error).message),
  });
  const cancel = useMutation({ mutationFn: () => api(`/admin/imports/${batch!.id}/cancel`, { method: 'POST' }), onSuccess: () => (setBatch(null), qc.invalidateQueries({ queryKey: ['imports'] })) });
  const valid = batch?.items?.filter((i) => i.status === 'VALID').length ?? 0;

  return (
    <>
      <PageHead eyebrow="04 · Content library" title="Import package" />
      <Card className="grid gap-4 p-6">
        <p className="text-sm text-muted">Pilih folder berisi package (setiap package punya <code className="font-mono">manifest.json</code>) atau file .zip. Semua file diperiksa: path, tipe asli, checksum, kategori, duplikat. Hasil import selalu Draft. Folder lokal di komputer Superadmin juga bisa diimpor dari aplikasi desktop.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">Jenis<Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="preset">Preset gaya</option><option value="voice">Suara</option><option value="hook">Hook</option></Select></label>
          <input ref={folderRef} type="file" className="sr-only" multiple onChange={(e) => pick(e.target.files)} {...({ webkitdirectory: '', directory: '' } as object)} aria-label="Pilih folder" />
          <Button variant="ghost" onClick={() => folderRef.current?.click()}>Pilih folder</Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-4 text-sm hover:bg-surface-2">
            Pilih .zip / file<input type="file" className="sr-only" multiple accept=".zip,.json,.png,.jpg,.webp,.mp4,.webm,.mp3,.wav,.ogg,.ttf,.otf,.woff2,.txt" onChange={(e) => pick(e.target.files)} />
          </label>
          <Button onClick={() => run.mutate()} loading={run.isPending} disabled={!files.length}>Upload dan validasi</Button>
        </div>
        {files.length > 0 && <p className="text-sm">{files.length} file · {fmtBytes(total)}</p>}
        {run.isPending && <Progress value={progress} label="Progres upload" />}
      </Card>

      {batch?.items && (
        <section className="mt-6 grid gap-3" aria-label="Hasil validasi">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-medium">Hasil validasi <Status value={batch.status} /></h2>
            <div className="flex gap-2">
              {batch.status === 'VALIDATED' && <Button onClick={() => commit.mutate()} loading={commit.isPending} disabled={!valid}>Commit {valid} package valid</Button>}
              {batch.status === 'VALIDATED' && <Button variant="ghost" onClick={() => cancel.mutate()}>Batalkan</Button>}
            </div>
          </div>
          <Table head={['Package', 'Status', 'Catatan']}>
            {batch.items.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs">{i.originalPath}</td>
                <td><Status value={i.status === 'VALID' || i.status === 'COMMITTED' ? 'ok' : i.status === 'DUPLICATE' ? 'warn' : 'bad'} label={i.status} /></td>
                <td>{i.validationErrors.length ? <ul className="list-disc pl-4 text-xs text-muted">{i.validationErrors.map((e, k) => <li key={k}>{e}</li>)}</ul> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <h2 className="mt-10 pb-3 font-display text-xl font-medium">Riwayat import</h2>
      {history.data?.length === 0 && <Empty title="Belum ada import" body="Riwayat batch import muncul di sini." />}
      {!!history.data?.length && (
        <Table head={['Waktu', 'Jenis', 'Sumber', 'Status', 'Ringkasan']}>
          {history.data.map((b) => (
            <tr key={b.id}>
              <td className="text-muted">{fmtDate(b.createdAt)}</td><td>{b.kind}</td><td className="font-mono text-xs">{b.source}</td><td><Status value={b.status} /></td>
              <td className="num text-xs">{b.summary.files ?? 0} file · valid {b.summary.VALID ?? 0} · commit {b.summary.committed ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
