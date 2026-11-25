'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Tabs } from '@/components/ui/extra';

interface LicenseRow {
  license: { id: string; userId: string; status: string; maxDevices: number; validUntil: string | null; createdAt: string; entitlements: { maxWorkers: number; maxVideosPerDay: number } };
  email: string;
  displayName: string;
}

interface DeviceRow {
  device: { id: string; userId: string; label: string; platform: string; lastSeenAt: string; revokedAt: string | null };
  email: string;
}

export default function LicensesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'licenses' | 'devices'>('licenses');
  const [status, setStatus] = useState('');
  const [devQ, setDevQ] = useState('');

  const q = useQuery({
    queryKey: ['admin-licenses', status],
    queryFn: () => api<{ items: LicenseRow[] }>(`/admin/licenses?limit=100${status ? `&status=${status}` : ''}`),
    enabled: tab === 'licenses',
  });

  const devs = useQuery({
    queryKey: ['admin-devices', devQ],
    queryFn: () => api<{ items: DeviceRow[] }>(`/admin/devices?limit=100${devQ.trim() ? `&q=${encodeURIComponent(devQ.trim())}` : ''}`),
    enabled: tab === 'devices',
  });

  const revokeDevice = useMutation({
    mutationFn: (id: string) => api(`/admin/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Perangkat dicabut');
      qc.invalidateQueries({ queryKey: ['admin-devices'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHead eyebrow="03 · License & device manager" title="Lisensi & Device" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Bagian"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'licenses', label: 'Lisensi' },
            { value: 'devices', label: 'Perangkat Global' },
          ]}
        />
        {tab === 'licenses' ? (
          <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-[10px] border border-line bg-surface px-3 text-sm">
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="REVOKED">Dicabut</option>
          </select>
        ) : (
          <Input
            aria-label="Cari perangkat"
            placeholder="Cari email atau nama perangkat…"
            value={devQ}
            onChange={(e) => setDevQ(e.target.value)}
            className="h-10 max-w-xs"
          />
        )}
      </div>

      {tab === 'licenses' && (
        <>
          {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
          {q.isLoading && <Skeleton className="h-48 rounded-card" />}
          {q.data?.items.length === 0 && <Empty title="Belum ada lisensi" body="Berikan lisensi dari halaman detail member." />}
          {!!q.data?.items.length && (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Perangkat</th>
                    <th className="px-5 py-3 font-medium">Worker · video/hari</th>
                    <th className="px-5 py-3 font-medium">Berlaku</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((r) => (
                    <tr key={r.license.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        <Link className="font-medium hover:underline" href={`/admin/members/${r.license.userId}`}>
                          {r.displayName}
                        </Link>
                        <p className="text-muted">{r.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Status value={r.license.status} />
                      </td>
                      <td className="num px-5 py-3">{r.license.maxDevices}</td>
                      <td className="num px-5 py-3">
                        {r.license.entitlements.maxWorkers} · {r.license.entitlements.maxVideosPerDay}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {fmtDate(r.license.createdAt)} → {r.license.validUntil ? fmtDate(r.license.validUntil) : 'tanpa batas'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {tab === 'devices' && (
        <>
          {devs.isError && <ErrorNote error={devs.error} onRetry={() => devs.refetch()} />}
          {devs.isLoading && <Skeleton className="h-48 rounded-card" />}
          {devs.data?.items.length === 0 && <Empty title="Belum ada perangkat" body="Perangkat desktop yang diaktivasi member tampil di sini." />}
          {!!devs.data?.items.length && (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-medium">Perangkat</th>
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Platform</th>
                    <th className="px-5 py-3 font-medium">Terakhir aktif</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {devs.data.items.map((r) => (
                    <tr key={r.device.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium">{r.device.label}</td>
                      <td className="px-5 py-3">
                        <Link className="text-accent hover:underline" href={`/admin/members/${r.device.userId}`}>
                          {r.email}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{r.device.platform}</td>
                      <td className="px-5 py-3 text-muted">{fmtDate(r.device.lastSeenAt)}</td>
                      <td className="px-5 py-3">
                        <Status value={r.device.revokedAt ? 'REVOKED' : 'ACTIVE'} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!r.device.revokedAt && (
                          <Button
                            variant="danger"
                            className="h-8 text-xs"
                            loading={revokeDevice.isPending && revokeDevice.variables === r.device.id}
                            onClick={() => confirm(`Cabut perangkat "${r.device.label}"?`) && revokeDevice.mutate(r.device.id)}
                          >
                            Lepas
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
