'use client';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Select } from '@/components/ui/extra';

interface Row {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  licenseStatus: string | null;
  licenseValidUntil?: string | null;
  licenseMaxDevices?: number | null;
  activeDevicesCount?: number;
  activeSessionsCount?: number;
  lastSeenAt?: string | null;
}

function daysLeft(validUntil?: string | null): string | null {
  if (!validUntil) return null;
  const diff = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return 'EXPIRED';
  return `${diff} hari lagi`;
}

export default function MembersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [licFilter, setLicFilter] = useState('');
  const dq = useDeferredValue(q);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'MEMBER' | 'SUPERADMIN'>('MEMBER');
  const [newLicDays, setNewLicDays] = useState('30');
  const [newMaxDev, setNewMaxDev] = useState('2');
  const [createdCred, setCreatedCred] = useState<{ email: string; password: string } | null>(null);

  const list = useInfiniteQuery({
    queryKey: ['admin-members', dq, status],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ limit: '50' });
      if (dq) p.set('q', dq);
      if (status) p.set('status', status);
      if (pageParam) p.set('cursor', pageParam);
      return api<{ items: Row[]; nextCursor: string | null }>(`/admin/members?${p}`);
    },
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });

  const createMember = useMutation({
    mutationFn: () =>
      api<{ user: Row; temporaryPassword: string }>('/admin/members', {
        method: 'POST',
        json: {
          displayName: newName.trim(),
          email: newEmail.trim(),
          password: newPassword.trim() || undefined,
          role: newRole,
          grantLicenseDays: Number(newLicDays) || 0,
          maxDevices: Number(newMaxDev) || 2,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Member ${r.user.displayName} berhasil didaftarkan`);
      setCreatedCred({ email: r.user.email, password: r.temporaryPassword });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      qc.invalidateQueries({ queryKey: ['admin-members'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const allRows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const rows = allRows.filter((r) => {
    if (!licFilter) return true;
    if (licFilter === 'NONE') return !r.licenseStatus;
    return r.licenseStatus === licFilter;
  });

  const kpi = {
    total: allRows.length,
    active: allRows.filter((r) => r.status === 'ACTIVE').length,
    licActive: allRows.filter((r) => r.licenseStatus === 'ACTIVE').length,
    licExpiredOrNone: allRows.filter((r) => !r.licenseStatus || r.licenseStatus === 'EXPIRED' || r.licenseStatus === 'REVOKED').length,
    suspended: allRows.filter((r) => r.status === 'SUSPENDED' || r.status === 'DISABLED').length,
  };

  const exportCsv = () => {
    const headers = ['ID', 'Nama', 'Email', 'Role', 'Status', 'Lisensi', 'Expired', 'Devices', 'Sessions', 'Terdaftar'];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.id,
          `"${(r.displayName || '').replace(/"/g, '""')}"`,
          r.email,
          r.role,
          r.status,
          r.licenseStatus ?? 'NONE',
          r.licenseValidUntil ?? '',
          r.activeDevicesCount ?? 0,
          r.activeSessionsCount ?? 0,
          r.createdAt,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dentsweb-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <PageHead
        eyebrow="02 · Member management"
        title="Member & Akses"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button onClick={() => (setCreatedCred(null), setCreateOpen(true))}>
              + Registrasi Member
            </Button>
          </div>
        }
      />

      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-muted">Total Member</p><p className="num mt-1 text-2xl font-semibold">{kpi.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Akun Aktif</p><p className="num mt-1 text-2xl font-semibold text-ok">{kpi.active}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Lisensi Aktif</p><p className="num mt-1 text-2xl font-semibold text-accent">{kpi.licActive}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Expired / Kosong</p><p className="num mt-1 text-2xl font-semibold text-warn">{kpi.licExpiredOrNone}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Suspended / Nonaktif</p><p className="num mt-1 text-2xl font-semibold text-bad">{kpi.suspended}</p></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input aria-label="Cari member" placeholder="Cari email atau nama" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm">
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PENDING_VERIFICATION">Menunggu verifikasi</option>
          <option value="SUSPENDED">Ditangguhkan</option>
          <option value="DISABLED">Nonaktif</option>
        </select>
        <select aria-label="Filter lisensi" value={licFilter} onChange={(e) => setLicFilter(e.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm">
          <option value="">Semua lisensi</option>
          <option value="ACTIVE">Lisensi Aktif</option>
          <option value="EXPIRED">Kedaluwarsa</option>
          <option value="REVOKED">Dicabut</option>
          <option value="NONE">Belum ada lisensi</option>
        </select>
      </div>

      {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <Skeleton className="h-64 rounded-card" />}
      {list.isSuccess && rows.length === 0 && <Empty title="Tidak ada member" body="Tidak ada akun yang cocok dengan filter ini." />}
      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Lisensi &amp; Expired</th>
                <th className="px-5 py-3 font-medium">Device · Sesi</th>
                <th className="px-5 py-3 font-medium">Terakhir Aktif</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rem = daysLeft(r.licenseValidUntil);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/members/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                        {r.displayName}
                      </Link>
                      <p className="text-xs text-muted">{r.email}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{r.role}</td>
                    <td className="px-5 py-3"><Status value={r.status} /></td>
                    <td className="px-5 py-3">
                      {r.licenseStatus ? (
                        <div className="space-y-0.5">
                          <Status value={r.licenseStatus} />
                          <p className="font-mono text-[11px] text-muted">
                            {r.licenseValidUntil ? `${fmtDate(r.licenseValidUntil)} (${rem})` : 'Tanpa batas'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Belum ada</span>
                      )}
                    </td>
                    <td className="num px-5 py-3 font-mono text-xs">
                      {r.activeDevicesCount ?? 0}/{r.licenseMaxDevices ?? '—'} dev · {r.activeSessionsCount ?? 0} sesi
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{fmtDate(r.lastSeenAt ?? r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {list.hasNextPage && (
        <div>
          <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            Muat lebih banyak
          </Button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Registrasi Member Baru">
        {createdCred ? (
          <div className="grid gap-3 text-sm">
            <p className="text-ok font-medium">Akun berhasil dibuat! Salin kredensial sementara di bawah (password di-hash satu arah Argon2id di database):</p>
            <div className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs space-y-1">
              <p>Email: <strong>{createdCred.email}</strong></p>
              <p>Password: <strong>{createdCred.password}</strong></p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${createdCred.email}\nPassword: ${createdCred.password}`);
                  toast.success('Kredensial disalin');
                }}
              >
                Salin Kredensial
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Tutup</Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim() || !newEmail.trim()) return toast.error('Nama dan email wajib diisi');
              createMember.mutate();
            }}
          >
            <Field id="cm-name" label="Nama lengkap"><Input id="cm-name" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
            <Field id="cm-email" label="Email"><Input id="cm-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></Field>
            <Field id="cm-pw" label="Password (opsional — kosongkan untuk auto-generate)"><Input id="cm-pw" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Otomatis dibuatkan jika kosong" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field id="cm-role" label="Role">
                <Select id="cm-role" value={newRole} onChange={(e) => setNewRole(e.target.value as 'MEMBER' | 'SUPERADMIN')}>
                  <option value="MEMBER">MEMBER</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </Select>
              </Field>
              <Field id="cm-days" label="Lisensi (hari)">
                <Input id="cm-days" type="number" min={0} max={3650} value={newLicDays} onChange={(e) => setNewLicDays(e.target.value)} />
              </Field>
              <Field id="cm-dev" label="Maks. device">
                <Input id="cm-dev" type="number" min={1} max={20} value={newMaxDev} onChange={(e) => setNewMaxDev(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" loading={createMember.isPending} className="mt-2">Daftarkan Member</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
