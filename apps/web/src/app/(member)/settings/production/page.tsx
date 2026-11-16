'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Field, Input, PageHead, Skeleton } from '@/components/ui';
import { Select, Textarea } from '@/components/ui/extra';

interface S { videosPerDay: number; defaultWorkers: number; preferredFormat: string; scheduleConfig: { enabled: boolean; times: string[]; timezone: string; topics: string[]; presetId?: string | null; hookMode?: 'AUTO' | 'NONE' } }

export default function ProductionSettings() {
  const q = useQuery({ queryKey: ['prod-settings'], queryFn: () => api<{ settings: S; limits: { maxWorkers: number; maxVideosPerDay: number } }>('/settings/production') });
  const presets = useQuery({ queryKey: ['presets-all'], queryFn: () => api<{ items: { id: string; name: string }[] }>('/styles/presets?limit=100') });
  const [f, setF] = useState<S | null>(null);
  useEffect(() => { if (q.data) setF(q.data.settings); }, [q.data]);
  const save = useMutation({ mutationFn: () => api('/settings/production', { method: 'PUT', json: f }), onSuccess: () => toast.success('Pengaturan produksi disimpan'), onError: (e) => toast.error((e as Error).message) });
  if (!f || !q.data) return <Skeleton className="h-80 rounded-card" />;
  const L = q.data.limits;
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Produksi otomatis" />
      <Card className="max-w-3xl p-6">
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => (e.preventDefault(), save.mutate())}>
          <Field id="vpd" label="Video per hari" hint={`Batas lisensi: ${L.maxVideosPerDay}`}><Input id="vpd" type="number" min={0} max={L.maxVideosPerDay} value={f.videosPerDay} onChange={(e) => setF({ ...f, videosPerDay: Number(e.target.value) })} /></Field>
          <Field id="wk" label="Worker bawaan" hint={`Batas lisensi: ${Math.max(1, L.maxWorkers)}`}><Input id="wk" type="number" min={1} max={Math.max(1, L.maxWorkers)} value={f.defaultWorkers} onChange={(e) => setF({ ...f, defaultWorkers: Number(e.target.value) })} /></Field>
          <Field id="fmt" label="Format"><Select id="fmt" value={f.preferredFormat} onChange={(e) => setF({ ...f, preferredFormat: e.target.value })}><option>9:16</option><option>16:9</option><option>1:1</option></Select></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={f.scheduleConfig.enabled} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, enabled: e.target.checked } })} /> Jalankan produksi otomatis sesuai jadwal</label>
          <Field id="times" label="Jam produksi (HH:MM, pisahkan koma)"><Input id="times" value={f.scheduleConfig.times.join(', ')} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, times: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} /></Field>
          <Field id="tz" label="Zona waktu"><Input id="tz" value={f.scheduleConfig.timezone} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, timezone: e.target.value } })} /></Field>
          <Field id="hookMode" label="Hook pada produksi otomatis"><Select id="hookMode" className="w-full" value={f.scheduleConfig.hookMode ?? 'AUTO'} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, hookMode: e.target.value as 'AUTO' | 'NONE' } })}><option value="AUTO">Otomatis</option><option value="NONE">Tanpa hook</option></Select></Field>
          <Field id="presetId" label="Gaya visual"><Select id="presetId" className="w-full" value={f.scheduleConfig.presetId ?? ''} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, presetId: e.target.value || null } })}><option value="">Gaya bawaan</option>{presets.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <p className="self-end text-xs text-muted sm:col-span-1">Narator memakai suara default dari Studio Suara bila akun suara Anda aktif; selain itu tanpa narasi.</p>
          <div className="sm:col-span-3"><Field id="topics" label="Daftar topik (satu per baris; dipakai bergiliran)"><Textarea id="topics" value={f.scheduleConfig.topics.join('\n')} onChange={(e) => setF({ ...f, scheduleConfig: { ...f.scheduleConfig, topics: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } })} /></Field></div>
          <div className="sm:col-span-3"><Button type="submit" loading={save.isPending}>Simpan</Button></div>
        </form>
      </Card>
    </>
  );
}
