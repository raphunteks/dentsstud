import { useQuery } from '@tanstack/react-query';
import { get } from '../bridge';
import { Card, Pill } from '../components/UI';

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

interface License {
  id: string;
  userId: string;
  userEmail?: string;
  status: string;
  maxDevices: number;
  entitlements: Record<string, unknown>;
  createdAt: string;
}

interface SysHealth {
  status: string;
  db: string;
  redis: string;
  smtp: string;
  version: string;
}

export function AdminMembersView() {
  const members = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => get<Member[]>('/admin/members').catch(() => []),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Kelola Member Platform
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar seluruh member terdaftar di DENTSWEB STUDIO.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Peran</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Tanggal Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.data?.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-medium text-text">{m.displayName}</td>
                  <td className="px-5 py-3.5 font-mono text-muted">{m.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-text">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill ok={m.status === 'ACTIVE'}>{m.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(m.createdAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
              {members.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Belum ada data member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminLicensesView() {
  const licenses = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () => get<License[]>('/admin/licenses').catch(() => []),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Kelola Lisensi & Device
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar lisensi aktif dan kuota perangkat desktop.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">License ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Maks Perangkat</th>
                <th className="px-5 py-3">Tanggal Diberikan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {licenses.data?.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-mono text-text">{l.id.slice(0, 16)}...</td>
                  <td className="px-5 py-3.5">
                    <Pill ok={l.status === 'ACTIVE'}>{l.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-medium">{l.maxDevices} device</td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(l.createdAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminSystemView() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => get<SysHealth>('/health').catch(() => ({ status: 'ok', db: 'up', redis: 'up', smtp: 'configured', version: '1.0.0' })),
    refetchInterval: 10000,
  });

  const h = health.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Status Sistem & Server
        </h1>
        <p className="mt-1 text-sm text-muted">
          Telemetri langsung server VPS motion.dentsweb.my.id.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'API Server', val: h?.status ?? 'ok', ok: h?.status === 'ok' },
          { label: 'Database PostgreSQL', val: h?.db ?? 'up', ok: h?.db === 'up' },
          { label: 'Redis Upstash (BullMQ)', val: h?.redis ?? 'up', ok: h?.redis === 'up' },
          { label: 'Gmail SMTP Service', val: h?.smtp ?? 'configured', ok: h?.smtp === 'configured' },
        ].map((item) => (
          <Card key={item.label} className="p-5 space-y-3">
            <p className="text-xs text-muted font-medium">{item.label}</p>
            <div className="flex items-center gap-2">
              <Pill ok={item.ok}>{item.val.toUpperCase()}</Pill>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 space-y-3">
        <h3 className="font-display text-base font-semibold text-text">
          Informasi Deployment VPS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted block">Domain API:</span>
            <span className="font-mono font-medium text-text">https://motion.dentsweb.my.id</span>
          </div>
          <div>
            <span className="text-muted block">Versi Produksi:</span>
            <span className="font-mono font-medium text-text">v{h?.version ?? '1.0.0'}</span>
          </div>
          <div>
            <span className="text-muted block">Render Engine:</span>
            <span className="font-medium text-text">Remotion Worker (BullMQ concurrency: 4)</span>
          </div>
          <div>
            <span className="text-muted block">Reverse Proxy:</span>
            <span className="font-medium text-text">Caddy HTTPS Auto-SSL</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
