'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';

interface LicenseEntitlements {
  maxWorkers?: number;
  maxVideosPerDay?: number;
  cloudRender?: boolean;
  cloudRenderMinutesPerMonth?: number;
}

interface Detail {
  user: { id: string; email: string; displayName: string; role: string; status: string; createdAt: string };
  license: {
    status: string;
    activeDevices: number;
    entitlements?: LicenseEntitlements;
    license: { id: string; maxDevices: number; validUntil: string | null; entitlements?: LicenseEntitlements } | null;
  };
  licenseHistory: { id: string; status: string; maxDevices: number; validUntil?: string | null; createdAt: string; revokedAt: string | null }[];
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

  const [grant, setGrant] = useState({
    maxDevices: 2,
    maxWorkers: 2,
    maxVideosPerDay: 10,
    cloudRender: true,
    cloudRenderMinutesPerMonth: 120,
    validUntil: '',
  });
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'MEMBER' | 'SUPERADMIN'>('MEMBER');
  const [newPw, setNewPw] = useState('');
  const [tempPw, setTempPw] = useState<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!d.data || prefilled.current) return;
    prefilled.current = true;
    setEditName(d.data.user.displayName);
    setEditEmail(d.data.user.email);
    setEditRole((d.data.user.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'MEMBER'));
    const lic = d.data.license.license;
    const ent = lic?.entitlements ?? d.data.license.entitlements;
    if (lic || ent) {
      setGrant({
        maxDevices: lic?.maxDevices ?? 2,
        maxWorkers: ent?.maxWorkers ?? 2,
        maxVideosPerDay: ent?.maxVideosPerDay ?? 10,
        cloudRender: ent?.cloudRender ?? true,
        cloudRenderMinutesPerMonth: ent?.cloudRenderMinutesPerMonth ?? 120,
        validUntil: lic?.validUntil ? new Date(lic.validUntil).toISOString().slice(0, 10) : '',
      });
    }
  }, [d.data]);

  const updateProfile = useMutation({
    mutationFn: () => api(`/admin/members/${id}`, { method: 'PATCH', json: { displayName: editName.trim(), email: editEmail.trim(), role: editRole } }),
    onSuccess: () => (toast.success('Profil & role diperbarui'), refresh()),
    onError: onErr,
  });
  const resetPassword = useMutation({
    mutationFn: () => api<{ ok: boolean; temporaryPassword: string }>(`/admin/members/${id}/reset-password`, { method: 'POST', json: { newPassword: newPw.trim() || undefined, revokeSessions: true } }),
    onSuccess: (r) => {
      setTempPw(r.temporaryPassword);
      setNewPw('');
      toast.success('Password direset & semua sesi dicabut');
      refresh();
    },
    onError: onErr,
  });
  const revokeAllSess = useMutation({
    mutationFn: () => api<{ ok: boolean; revokedCount: number }>(`/admin/members/${id}/revoke-all-sessions`, { method: 'POST' }),
    onSuccess: (r) => (toast.success(`${r.revokedCount} sesi aktif dicabut`), refresh()),
    onError: onErr,
  });
  const quickExtend = (days: number) => {
    const baseMs = grant.validUntil && new Date(grant.validUntil).getTime() > Date.now() ? new Date(grant.validUntil).getTime() : Date.now();
    const nextDate = new Date(baseMs + days * 86_400_000).toISOString().slice(0, 10);
    setGrant((g) => ({ ...g, validUntil: nextDate }));
    toast.success(`Masa berlaku diset ke ${nextDate} — klik simpan lisensi untuk menerapkan`);
  };

  const status = useMutation({
    mutationFn: (s: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') => api(`/admin/members/${id}/status`, { method: 'PATCH', json: { status: s } }),
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
          entitlements: {
            maxWorkers: grant.maxWorkers,
            maxVideosPerDay: grant.maxVideosPerDay,
            cloudRender: grant.cloudRender,
            cloudRenderMinutesPerMonth: grant.cloudRenderMinutesPerMonth,
          },
        },
      }),
    onSuccess: () => (toast.success('Lisensi diberikan'), refresh()),
    onError: onErr,
  });
  const revoke = useMutation({ mutationFn: (lid: string) => api(`/admin/licenses/${lid}/revoke`, { method: 'POST' }), onSuccess: () => (toast.success('Lisensi dicabut'), refresh()), onError: onErr });
  const revokeDevice = useMutation({ mutationFn: (did: string) => api(`/admin/devices/${did}`, { method: 'DELETE' }), onSuccess: () => (toast.success('Perangkat dilepas'), refresh()), onError: onErr });
  const revokeSession = useMutation({ mutationFn: (sid: string) => api(`/admin/sessions/${sid}`, { method: 'DELETE' }), onSuccess: () => (toast.success('Sesi dicabut'), refresh()), onError: onErr });

  if (d.isError) return <ErrorNote error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) return <Skeleton className="h-96 rounded-card" />;
  const { user, license } = d.data;
  const num = (k: 'maxDevices' | 'maxWorkers' | 'maxVideosPerDay' | 'cloudRenderMinutesPerMonth' | 'validUntil') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGrant((g) => ({ ...g, [k]: k === 'validUntil' ? e.target.value : Number(e.target.value) }));

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/members" className="hover:underline">← 02 · Daftar Member</Link>}
        title={user.displayName}
        actions={
          <div className="flex flex-wrap gap-2">
            {user.status !== 'ACTIVE' && (
              <Button loading={status.isPending} onClick={() => status.mutate('ACTIVE')}>
                Aktifkan
              </Button>
            )}
            {user.status !== 'SUSPENDED' && (
              <Button
                variant="ghost"
                loading={status.isPending}
                onClick={() => confirm('Tangguhkan member ini? Semua sesinya akan dicabut.') && status.mutate('SUSPENDED')}
              >
                Tangguhkan
              </Button>
            )}
            {user.status !== 'DISABLED' && (
              <Button
                variant="danger"
                loading={status.isPending}
                onClick={() => confirm('Nonaktifkan (DISABLED) member ini secara permanen?') && status.mutate('DISABLED')}
              >
                Nonaktifkan (DISABLED)
              </Button>
            )}
          </div>
        }
      />
      <p className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        {user.email} · <span className="font-mono text-xs">{user.role}</span> · <Status value={user.status} /> · sejak {fmtDate(user.createdAt)}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Lisensi</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Status value={license.status} label={license.status === 'NONE' ? 'Belum ada' : undefined} />
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => quickExtend(30)}>+30h</Button>
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => quickExtend(90)}>+90h</Button>
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => quickExtend(365)}>+365h</Button>
              {license.license && license.status === 'ACTIVE' && (
                <Button variant="danger" className="h-8 px-2.5 text-xs" loading={revoke.isPending} onClick={() => confirm('Cabut lisensi? Semua perangkat dilepas.') && revoke.mutate(license.license!.id)}>
                  Cabut lisensi
                </Button>
              )}
            </div>
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
            <Field id="cloudMins" label="Menit render cloud/bln">
              <Input id="cloudMins" type="number" min={0} max={10000} value={grant.cloudRenderMinutesPerMonth} onChange={num('cloudRenderMinutesPerMonth')} />
            </Field>
            <Field id="validUntil" label="Berlaku sampai" hint="Kosongkan untuk tanpa batas">
              <Input id="validUntil" type="date" value={grant.validUntil} onChange={num('validUntil')} />
            </Field>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={grant.cloudRender}
                  onChange={(e) => setGrant((g) => ({ ...g, cloudRender: e.target.checked }))}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Izinkan Render Cloud
              </label>
            </div>
            <Button type="submit" loading={doGrant.isPending} className="col-span-2">
              {license.status === 'ACTIVE' ? 'Ganti / Perbarui lisensi' : 'Berikan lisensi'}
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
          <div className="mt-6 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-medium">Sesi aktif</h2>
            {d.data.sessions.length > 0 && (
              <Button variant="danger" className="h-8 px-2.5 text-xs" loading={revokeAllSess.isPending} onClick={() => confirm('Paksa logout semua sesi member ini?') && revokeAllSess.mutate()}>
                Paksa Logout Semua
              </Button>
            )}
          </div>
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

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Edit Profil &amp; Role</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate();
            }}
          >
            <Field id="ep-name" label="Nama tampilan"><Input id="ep-name" value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
            <Field id="ep-email" label="Email"><Input id="ep-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></Field>
            <Field id="ep-role" label="Role">
              <select id="ep-role" value={editRole} onChange={(e) => setEditRole(e.target.value as 'MEMBER' | 'SUPERADMIN')} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm">
                <option value="MEMBER">MEMBER</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
              </select>
            </Field>
            <Button type="submit" loading={updateProfile.isPending}>Simpan Profil &amp; Role</Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Reset Password Member</h2>
          <p className="mt-1 text-xs text-muted">Password disimpan sebagai hash satu arah Argon2id (tidak dapat dibaca ulang). Buat password baru atau kosongkan untuk auto-generate:</p>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirm('Reset password member ini dan cabut semua sesinya?')) resetPassword.mutate();
            }}
          >
            <Field id="rp-pw" label="Password baru (kosongkan = acak)"><Input id="rp-pw" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Otomatis dibuatkan jika kosong" /></Field>
            <Button type="submit" variant="ghost" loading={resetPassword.isPending}>Reset Password &amp; Logout Sesi</Button>
          </form>
          {tempPw && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2 text-xs">
              <span className="font-mono">Password baru: <strong>{tempPw}</strong></span>
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(tempPw);
                  toast.success('Password disalin');
                }}
              >
                Salin
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-3 p-5">
        <h2 className="font-display text-lg font-medium">Riwayat lisensi</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {d.data.licenseHistory.length === 0 && <li className="text-muted">Belum ada riwayat lisensi.</li>}
          {d.data.licenseHistory.map((lh) => (
            <li key={lh.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <Status value={lh.status} />
                <span className="num font-mono text-xs text-muted">{lh.maxDevices} perangkat</span>
              </div>
              <span className="text-xs text-muted">
                Dibuat {fmtDate(lh.createdAt)}
                {lh.validUntil ? ` · Berlaku s/d ${fmtDate(lh.validUntil)}` : ''}
                {lh.revokedAt ? ` · Dicabut ${fmtDate(lh.revokedAt)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-3 p-5">
        <h2 className="font-display text-lg font-medium">Riwayat akses</h2>
        <ul className="mt-3 grid gap-1 font-mono text-xs">
          {d.data.accessHistory.length === 0 && <li className="text-muted">Belum ada riwayat akses.</li>}
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
