'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fmtBytes, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Progress, Select, Table, Textarea } from '@/components/ui/extra';

interface R { id: string; platform: string; arch: string; channel: string; version: string; filename: string; sizeBytes: number; checksum: string; releaseNotes: string | null; isActive: boolean; downloads: number; publishedAt: string; downloadUrl: string }

function upload(fd: FormData, onProgress: (p: number) => void) {
  return new Promise<R>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/admin/releases');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      if (xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, body?.error?.code ?? 'ERROR', body?.error?.details?.[0]?.message ?? body?.error?.message ?? 'Upload gagal'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Koneksi terputus saat upload'));
    xhr.send(fd);
  });
}

export default function AdminReleases() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin-releases'], queryFn: () => api<R[]>('/admin/releases') });
  const [platform, setPlatform] = useState('win32');
  const [arch, setArch] = useState('x64');
  const [channel, setChannel] = useState('stable');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const send = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries({ platform, arch, channel, version, releaseNotes: notes }).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file!, file!.name);
      return upload(fd, setPct);
    },
    onSuccess: (r) => {
      toast.success(`Rilis ${r.version} untuk ${r.platform} dipublikasikan`);
      setFile(null);
      setVersion('');
      setNotes('');
      setPct(0);
      qc.invalidateQueries({ queryKey: ['admin-releases'] });
    },
    onError: (e) => (setPct(0), toast.error((e as Error).message)),
  });
  const toggle = useMutation({
    mutationFn: (r: R) => api(`/admin/releases/${r.id}`, { method: 'PATCH', json: { isActive: !r.isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-releases'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHead eyebrow="11 · Superadmin" title="Desktop & Rilis" />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Unggah rilis</h2>
          <p className="mt-1 text-sm text-muted">Aplikasi desktop membaca feed pembaruan dari rilis aktif dengan versi semver tertinggi per platform dan kanal.</p>
          <form className="mt-4 grid gap-3" onSubmit={(e) => (e.preventDefault(), file && send.mutate())}>
            <div className="grid grid-cols-3 gap-2">
              <Select aria-label="Platform" value={platform} onChange={(e) => { setPlatform(e.target.value); setArch(e.target.value === 'darwin' ? 'universal' : 'x64'); }}><option value="win32">Windows</option><option value="darwin">macOS</option></Select>
              <Select aria-label="Arsitektur" value={arch} onChange={(e) => setArch(e.target.value)}><option value="x64">x64</option><option value="arm64">arm64</option><option value="universal">universal</option></Select>
              <Select aria-label="Kanal" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="stable">stable</option><option value="beta">beta</option></Select>
            </div>
            <Field id="ver" label="Versi"><Input id="ver" value={version} onChange={(e) => setVersion(e.target.value.trim())} placeholder="1.0.0" /></Field>
            <Field id="notes" label="Catatan rilis"><Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <label className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-line px-3 text-sm hover:bg-surface-2">
              {file ? `${file.name} · ${fmtBytes(file.size)}` : `Pilih installer (${platform === 'darwin' ? '.dmg / .zip' : '.exe'})`}
              <input type="file" className="sr-only" accept={platform === 'darwin' ? '.dmg,.zip' : '.exe'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {send.isPending && <Progress value={pct * 100} label="Progres unggah" />}
            <Button type="submit" loading={send.isPending} disabled={!file || !version}>Publikasikan rilis</Button>
          </form>
        </Card>
        <div className="min-w-0">
          {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
          {list.isLoading && <Skeleton className="h-64 rounded-card" />}
          {list.data?.length === 0 && <Empty title="Belum ada rilis" body="Unggah installer .exe atau .dmg hasil build untuk mengaktifkan pembaruan otomatis dan halaman unduhan." />}
          {!!list.data?.length && (
            <Table head={['Versi', 'Platform', 'File', 'Unduhan', 'Dirilis', '']} minWidth={760}>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td><span className="num font-mono font-medium">{r.version}</span><br /><span className="text-xs text-muted">{r.channel}</span></td>
                  <td>{r.platform === 'darwin' ? 'macOS' : 'Windows'} · {r.arch}</td>
                  <td><span className="block max-w-[220px] truncate text-xs" title={r.filename}>{r.filename}</span><span className="font-mono text-[10px] text-muted" title={r.checksum}>{fmtBytes(r.sizeBytes)} · {r.checksum.slice(0, 12)}…</span></td>
                  <td className="num font-mono">{r.downloads}</td>
                  <td className="text-muted">{fmtDate(r.publishedAt)}</td>
                  <td className="whitespace-nowrap text-right"><Status value={r.isActive ? 'ACTIVE' : 'DISABLED'} label={r.isActive ? 'Aktif' : 'Ditarik'} /> <Button variant="ghost" className="h-8" onClick={() => toggle.mutate(r)}>{r.isActive ? 'Tarik' : 'Aktifkan'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
