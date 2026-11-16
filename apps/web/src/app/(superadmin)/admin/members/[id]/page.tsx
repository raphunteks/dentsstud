'use client';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';

interface Detail {
  user: { id: string; email: string; displayName: string; role: string; status: string; createdAt: string };
  license: { status: string; activeDevices: number; license: { id: string; maxDevices: number; validUntil: string | null } | null };
  licenseHistory: { id: string; status: string; maxDevices: number; createdAt: string; revokedAt: string | null }[];
  devices: { id: string; label: string; platform: string; lastSeenAt: string; revokedAt: string | null }[];
  sessions: { id: string; client: string; ipAddress: string | null; lastSeenAt: string }[];
  accessHistory: { id: string; action: string; createdAt: string; ipAddress: string | null }[];
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ['admin-member', id], queryFn: () => api<Detail>(`/admin/members/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-member', id] });
  const onErr = (e: unknown) => toast.error((e as Error).message);

  const [grant, setGrant] = useState({ maxDevices: 2, maxWorkers: 2, maxVideosPerDay: 10, validUntil: '' });
  const status = useMutation({
    mutationFn: (s: string) => api(`/admin/members/${id}/status`, { method: 'PATCH', json: { status: s } }),
    onSuccess: () => (toast.success('Status diperbarui'), refresh()),
    onError: onErr,
  });
  const doGrant = useMutation({
    mutationFn: () =>
      api('/admin/licenses/grant', {
        method: 'POST',
        json: {
          userId: id,
          maxDevices: grant.maxDevices,
          validUntil: grant.validUntil ? new Date(grant.validUntil).toISOString() : null,
          entitlements: { maxWorkers: grant.maxWorkers, maxVideosPerDay: grant.maxVideosPerDay, cloudRender: true, cloudRenderMinutesPerMonth: 120 },
        },
      }),
    onSuccess: () => (toast.success('Lisensi diberikan'), refresh()),
    onError: onErr,
  });
  const revoke = useMutation({ mutationFn: (lid: string) => api(`/admin/licenses/${lid}/revoke`, { method: 'POST' }), onSuccess: () => (toast.success('Lisensi dicabut'), refresh()), onError: onErr });
  const revokeDevice = useMutation({ mutationFn: (did: string) => api(`/admin/devices/${did}`, { method: 'DELETE' }), onSuccess: refresh, onError: onErr });
  const revokeSession = useMutation({ mutationFn: (sid: string) => api(`/admin/sessions/${sid}`, { method: 'DELETE' }), onSuccess: refresh, onError: onErr });

  if (d.isError) return <ErrorNote error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) return <Skeleton className="h-96 rounded-card" />;
  const { user, license } = d.data;
  const num = (k: keyof typeof grant) => (e: React.ChangeEvent<HTMLInputElement>) => setGrant((g) => ({ ...g, [k]: k === 'validUntil' ? e.target.value : Number(e.target.value) }));

  return (
    <>
      <PageHead
        eyebrow="02 · Member detail"
        title={user.displayName}
        actions={
          user.status === 'ACTIVE' ? (
            <Button variant="danger" loading={status.isPending} onClick={() => confirm('Tangguhkan member ini? Semua sesinya akan dicabut.') && status.mutate('SUSPENDED')}>
              Tangguhkan
            </Button>
          ) : (
            <Button loading={status.isPending} onClick={() => status.mutate('ACTIVE')}>
              Aktifkan
            </Button>
          )
        }
      />
      <p className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        {user.email} · <span className="font-mono text-xs">{user.role}</span> · <Status value={user.status} /> · sejak {fmtDate(user.createdAt)}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Lisensi</h2>
          <div className="mt-3 flex items-center justify-between">
            <Status value={license.status} label={license.status === 'NONE' ? 'Belum ada' : undefined} />
            {license.license && license.status === 'ACTIVE' && (
              <Button variant="danger" loading={revoke.isPending} onClick={() => confirm('Cabut lisensi? Semua perangkat dilepas.') && revoke.mutate(license.license!.id)}>
                Cabut lisensi
              </Button>
            )}
          </div>
          <form
            className="mt-5 grid grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              doGrant.mutate();
            }}
          >
            <Field id="maxDevices" label="Maks. perangkat">
              <Input id="maxDevices" type="number" min={1} max={20} value={grant.maxDevices} onChange={num('maxDevices')} />
            </Field>
            <Field id="maxWorkers" label="Maks. worker">
              <Input id="maxWorkers" type="number" min={1} max={16} value={grant.maxWorkers} onChange={num('maxWorkers')} />
            </Field>
            <Field id="maxVideos" label="Video per hari">
              <Input id="maxVideos" type="number" min={0} max={500} value={grant.maxVideosPerDay} onChange={num('maxVideosPerDay')} />
            </Field>
            <Field id="validUntil" label="Berlaku sampai" hint="Kosongkan untuk tanpa batas">
              <Input id="validUntil" type="date" value={grant.validUntil} onChange={num('validUntil')} />
            </Field>
            <Button type="submit" loading={doGrant.isPending} className="col-span-2">
              {license.status === 'ACTIVE' ? 'Ganti lisensi' : 'Berikan lisensi'}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Perangkat</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {d.data.devices.length === 0 && <li className="text-muted">Belum ada perangkat.</li>}
            {d.data.devices.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
                <span>
                  {x.label} <span className="text-muted">· {x.platform} · {fmtDate(x.lastSeenAt)}</span>
                </span>
                {x.revokedAt ? <Status value="REVOKED" /> : <Button variant="quiet" onClick={() => revokeDevice.mutate(x.id)}>Lepas</Button>}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 font-display text-lg font-medium">Sesi aktif</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {d.data.sessions.length === 0 && <li className="text-muted">Tidak ada sesi aktif.</li>}
            {d.data.sessions.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span>
                  {x.client} <span className="text-muted">· {x.ipAddress ?? '—'} · {fmtDate(x.lastSeenAt)}</span>
                </span>
                <Button variant="quiet" onClick={() => revokeSession.mutate(x.id)}>
                  Cabut
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-3 p-5">
        <h2 className="font-display text-lg font-medium">Riwayat akses</h2>
        <ul className="mt-3 grid gap-1 font-mono text-xs">
          {d.data.accessHistory.map((a) => (
            <li key={a.id} className="flex justify-between gap-4 border-b border-line py-1.5 last:border-0">
              <span>{a.action}</span>
              <span className="text-muted">
                {a.ipAddress ?? ''} {fmtDate(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
