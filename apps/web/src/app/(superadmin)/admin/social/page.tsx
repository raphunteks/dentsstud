'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal } from '@/components/ui/extra';

interface PlatformAdminConfig {
  enabled: boolean;
  clientId: string;
  hasClientSecret?: boolean;
  redirectUri: string;
  dailyLimitPerMember: number;
}

interface SocialAdminConfig {
  autoPublishEnabled: boolean;
  platforms: Record<string, PlatformAdminConfig>;
}

interface Overview {
  summary: {
    connectedAccounts: number;
    scheduled: number;
    published: number;
    failed: number;
    drafts: number;
    ideas: number;
  };
  recentPosts: {
    id: string;
    platform: string;
    status: string;
    caption: string;
    userEmail: string;
    userName: string | null;
    accountHandle: string | null;
    scheduledAt: string | null;
    publishedAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }[];
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
};

export default function AdminSocialPage() {
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: ['admin-social-config'], queryFn: () => api<SocialAdminConfig>('/admin/social/config') });
  const ovQ = useQuery({ queryKey: ['admin-social-overview'], queryFn: () => api<Overview>('/admin/social/overview') });

  const [editCode, setEditCode] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [dailyLimit, setDailyLimit] = useState(10);

  const patchMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<SocialAdminConfig>('/admin/social/config', { method: 'PATCH', json: body }),
    onSuccess: () => {
      toast.success('Konfigurasi Social Publisher disimpan');
      setEditCode(null);
      setClientSecret('');
      qc.invalidateQueries({ queryKey: ['admin-social-config'] });
      qc.invalidateQueries({ queryKey: ['social-platforms'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (cfgQ.isLoading || ovQ.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (cfgQ.isError) return <ErrorNote error={cfgQ.error} onRetry={() => cfgQ.refetch()} />;
  if (ovQ.isError) return <ErrorNote error={ovQ.error} onRetry={() => ovQ.refetch()} />;

  const cfg = cfgQ.data!;
  const ov = ovQ.data!;

  const openEdit = (code: string) => {
    const p = cfg.platforms[code];
    setEditCode(code);
    setClientId(p?.clientId ?? '');
    setClientSecret('');
    setRedirectUri(p?.redirectUri ?? '');
    setDailyLimit(p?.dailyLimitPerMember ?? 10);
  };

  return (
    <div className="grid gap-6">
      <PageHead
        eyebrow="OPERASIONAL · 16 SOCIAL PUBLISHER"
        title="16 Social Publisher"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Akun Terhubung', ov.summary.connectedAccounts],
          ['Terjadwal', ov.summary.scheduled],
          ['Terbit', ov.summary.published],
          ['Gagal', ov.summary.failed],
        ].map(([label, val]) => (
          <Card key={String(label)} className="grid gap-1 p-4">
            <span className="text-xs text-muted">{label}</span>
            <span className="font-mono text-2xl font-semibold">{val}</span>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">Member Auto-Publish Langsung</h3>
          <p className="text-xs text-muted">
            Izinkan member mempublikasikan postingan secara langsung atau otomatis sesuai jadwal tanpa persetujuan manual.
          </p>
        </div>
        <Button
          variant={cfg.autoPublishEnabled ? 'primary' : 'ghost'}
          disabled={patchMut.isPending}
          onClick={() => patchMut.mutate({ autoPublishEnabled: !cfg.autoPublishEnabled })}
        >
          {cfg.autoPublishEnabled ? 'Aktif (ON)' : 'Nonaktif (OFF)'}
        </Button>
      </Card>

      <Card className="overflow-x-auto p-5">
        <h3 className="mb-3 text-sm font-semibold">Konfigurasi 10 Platform & Kuota Harian</h3>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="py-2 pr-3">Platform</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">OAuth Client ID</th>
              <th className="py-2 pr-3">Secret</th>
              <th className="py-2 pr-3">Limit/Hari</th>
              <th className="py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs">
            {Object.entries(PLATFORM_LABELS).map(([code, label]) => {
              const p = cfg.platforms[code];
              return (
                <tr key={code}>
                  <td className="py-2.5 pr-3 font-medium">{label}</td>
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        p?.enabled ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'
                      }`}
                      onClick={() => patchMut.mutate({ platforms: { [code]: { enabled: !p?.enabled } } })}
                    >
                      {p?.enabled ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-muted">{p?.clientId || '—'}</td>
                  <td className="py-2.5 pr-3">{p?.hasClientSecret ? 'Tersimpan' : 'Belum diisi'}</td>
                  <td className="py-2.5 pr-3 font-mono">{p?.dailyLimitPerMember ?? 10}</td>
                  <td className="py-2.5 text-right">
                    <Button className="h-8 px-3 text-xs" variant="ghost" onClick={() => openEdit(code)}>Edit OAuth & Kuota</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-5">
        <h3 className="mb-3 text-sm font-semibold">Monitor Antrean Global (50 Terbaru)</h3>
        {ov.recentPosts.length === 0 ? (
          <p className="text-xs text-muted">Belum ada aktivitas publikasi sosial media.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Caption</th>
                <th className="py-2 pr-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ov.recentPosts.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3">{r.userName || r.userEmail}</td>
                  <td className="py-2 pr-3 uppercase">{r.platform}</td>
                  <td className="py-2 pr-3"><Status value={r.status} /></td>
                  <td className="max-w-xs truncate py-2 pr-3 text-muted" title={r.lastError || r.caption}>
                    {r.lastError ? `[Err] ${r.lastError}` : r.caption || '—'}
                  </td>
                  <td className="py-2 pr-3 font-mono text-muted">{fmtDate(r.publishedAt || r.scheduledAt || r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={Boolean(editCode)} onClose={() => setEditCode(null)} title={`Konfigurasi ${editCode ? PLATFORM_LABELS[editCode] : ''}`}>
        {editCode && (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium">OAuth Client ID</label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID aplikasi developer" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">OAuth Client Secret (kosongkan jika tidak diubah)</label>
              <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Redirect URI</label>
              <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Kuota Maksimal Post / Member / Hari</label>
              <Input type="number" min={1} max={200} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value) || 1)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditCode(null)}>Batal</Button>
              <Button
                disabled={patchMut.isPending}
                onClick={() =>
                  patchMut.mutate({
                    platforms: {
                      [editCode]: {
                        clientId,
                        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
                        redirectUri,
                        dailyLimitPerMember: dailyLimit,
                      },
                    },
                  })
                }
              >
                {patchMut.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
