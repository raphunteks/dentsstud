'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

interface Summary {
  status: string;
  activeDevices: number;
  license: { maxDevices: number; validUntil: string | null; validFrom: string } | null;
  entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean; cloudRenderMinutesPerMonth: number };
}
interface Device {
  id: string;
  label: string;
  platform: string;
  architecture: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export default function LicensePage() {
  const qc = useQueryClient();
  const lic = useQuery({ queryKey: ['license'], queryFn: () => api<Summary>('/licenses/me') });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('/devices') });
  const release = useMutation({
    mutationFn: (id: string) => api(`/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Perangkat dilepas');
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['license'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const PLATFORM: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Lisensi & perangkat" />
      {lic.isError && <ErrorNote error={lic.error} onRetry={() => lic.refetch()} />}
      <Card className="p-6">
        {lic.data ? (
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted">Status</p>
              <div className="mt-2">
                <Status value={lic.data.status} label={lic.data.status === 'NONE' ? 'Belum ada lisensi' : undefined} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted">Perangkat</p>
              <p className="num mt-1 text-2xl">
                {lic.data.activeDevices}/{lic.data.license?.maxDevices ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Worker · video/hari</p>
              <p className="num mt-1 text-2xl">
                {lic.data.entitlements.maxWorkers} · {lic.data.entitlements.maxVideosPerDay}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Berlaku sampai</p>
              <p className="mt-1">{lic.data.license?.validUntil ? fmtDate(lic.data.license.validUntil) : lic.data.license ? 'Tanpa batas' : '—'}</p>
            </div>
          </div>
        ) : (
          <Skeleton className="h-16" />
        )}
        <p className="mt-6 text-sm text-muted">Lisensi DENTWEB STUDIO bersifat nonkomersial dan diberikan oleh Superadmin.</p>
      </Card>

      <h2 className="mt-10 pb-4 font-display text-xl font-medium">Perangkat aktif</h2>
      {devices.isError && <ErrorNote error={devices.error} onRetry={() => devices.refetch()} />}
      {devices.data?.length === 0 && <Empty title="Belum ada perangkat" body="Perangkat tercatat saat Anda masuk dari aplikasi desktop macOS atau Windows." />}
      <div className="grid gap-2">
        {devices.data?.map((d) => (
          <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-medium">{d.label}</p>
              <p className="text-sm text-muted">
                {PLATFORM[d.platform] ?? d.platform} · {d.architecture} · terakhir {fmtDate(d.lastSeenAt)}
              </p>
            </div>
            {d.revokedAt ? (
              <Status value="REVOKED" label="Dilepas" />
            ) : (
              <Button variant="danger" loading={release.isPending && release.variables === d.id} onClick={() => confirm(`Lepas ${d.label}?`) && release.mutate(d.id)}>
                Lepas perangkat
              </Button>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
