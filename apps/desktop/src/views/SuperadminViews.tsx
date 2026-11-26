import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, invoke, mutate, pickInstaller, toMediaUrl, uploadRelease, uploadSkillZip } from '../bridge';
import { Button, Card, Pill, Input, Select, Modal, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import { AiProvidersPanel } from '../components/AiProvidersPanel';
import type { Info } from '../types';

export { AdminDashboardView, AdminContentView, AdminResultsView, AdminAnalyticsView } from './SuperadminExtraViews';

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  licenseStatus?: string | null;
  licenseValidUntil?: string | null;
  licenseMaxDevices?: number | null;
  activeDevicesCount?: number;
  activeSessionsCount?: number;
  lastSeenAt?: string | null;
}

interface License {
  id: string;
  userId: string;
  userEmail?: string;
  status: string;
  maxDevices: number;
  validUntil?: string | null;
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

const DEFAULT_MODELS = [
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

function toArr<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.rows)) return o.rows as T[];
  }
  return [];
}

function memberDaysLeft(validUntil?: string | null): number | null {
  if (!validUntil) return null;
  const ts = Date.parse(validUntil);
  if (!Number.isFinite(ts)) return null;
  return Math.ceil((ts - Date.now()) / 86_400_000);
}

/** 02. Member Management (KPI Bar, Filters, CSV Export, Register Modal, Edit Profile/Role, Reset Password, Force Logout, Quick Extend License) */
export function AdminMembersView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [licenseFilter, setLicenseFilter] = useState('ALL');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [grantDays, setGrantDays] = useState(30);
  const [grantDevices, setGrantDevices] = useState(2);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; copyText?: string } | null>(null);

  // Register Member Modal state
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'MEMBER' | 'SUPERADMIN'>('MEMBER');
  const [regDays, setRegDays] = useState(30);
  const [regMaxDev, setRegMaxDev] = useState(2);

  // Edit Member & Reset Password inside Detail Modal
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('MEMBER');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [resetPwInput, setResetPwInput] = useState('');
  const [resetRevokeAll, setResetRevokeAll] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);

  const members = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => get<unknown>('/admin/members?limit=100').then((r) => toArr<Member>(r)).catch(() => []),
  });

  const detailQ = useQuery({
    queryKey: ['admin-member-detail', selectedMemberId],
    queryFn: () => get<any>(`/admin/members/${selectedMemberId}`),
    enabled: !!selectedMemberId,
  });

  useEffect(() => {
    const u = detailQ.data?.user;
    if (!u) return;
    setEditName(u.displayName ?? '');
    setEditEmail(u.email ?? '');
    setEditRole(u.role ?? 'MEMBER');
    setEditStatus(u.status ?? 'ACTIVE');
  }, [detailQ.data?.user?.id]);

  const invalidateMembers = () => {
    qc.invalidateQueries({ queryKey: ['admin-members'] });
    qc.invalidateQueries({ queryKey: ['admin-licenses'] });
    if (selectedMemberId) qc.invalidateQueries({ queryKey: ['admin-member-detail', selectedMemberId] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mutate('PATCH', `/admin/members/${id}/status`, { status }),
    onSuccess: () => invalidateMembers(),
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const registerMember = useMutation({
    mutationFn: () =>
      mutate<{ user?: Member; temporaryPassword?: string }>('POST', '/admin/members', {
        displayName: regName.trim(),
        email: regEmail.trim(),
        ...(regPassword.trim() ? { password: regPassword.trim() } : {}),
        role: regRole,
        ...(regDays > 0 ? { validDays: regDays, maxDevices: regMaxDev } : {}),
      }),
    onSuccess: (res) => {
      const pw = res?.temporaryPassword ?? regPassword.trim();
      setFeedback({
        ok: true,
        text: `Member ${res?.user?.email ?? regEmail} berhasil didaftarkan${pw ? ` · Password sementara: ${pw}` : ''}`,
        copyText: pw ? `Email: ${res?.user?.email ?? regEmail}\nPassword: ${pw}` : undefined,
      });
      setShowRegister(false);
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegRole('MEMBER');
      invalidateMembers();
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal mendaftarkan member: ${errMsg(e)}` }),
  });

  const editMember = useMutation({
    mutationFn: (id: string) =>
      mutate('PATCH', `/admin/members/${id}`, {
        displayName: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
      }),
    onSuccess: () => {
      setFeedback({ ok: true, text: 'Profil & role member diperbarui.' });
      invalidateMembers();
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal menyimpan profil: ${errMsg(e)}` }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      mutate<{ ok: boolean; temporaryPassword?: string }>('POST', `/admin/members/${id}/reset-password`, {
        ...(resetPwInput.trim() ? { newPassword: resetPwInput.trim() } : {}),
        revokeSessions: resetRevokeAll,
      }),
    onSuccess: (res) => {
      const pw = res?.temporaryPassword ?? resetPwInput.trim();
      setResetPwInput('');
      setFeedback({
        ok: true,
        text: `Password berhasil direset${pw ? ` · Password baru: ${pw}` : ''}`,
        copyText: pw || undefined,
      });
      invalidateMembers();
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal reset password: ${errMsg(e)}` }),
  });

  const revokeAllSessions = useMutation({
    mutationFn: (id: string) =>
      mutate<{ ok: boolean; revokedCount?: number }>('POST', `/admin/members/${id}/revoke-all-sessions`, {}),
    onSuccess: (res) => {
      setFeedback({ ok: true, text: `Semua sesi diakhiri (${res?.revokedCount ?? 0} sesi).` });
      invalidateMembers();
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const grantLic = useMutation({
    mutationFn: ({ userId, days, maxDevices }: { userId: string; days: number; maxDevices: number }) =>
      mutate('POST', '/admin/licenses/grant', {
        userId,
        validUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
        maxDevices,
      }),
    onSuccess: (_, vars) => {
      setFeedback({ ok: true, text: `Lisensi +${vars.days} hari (maks ${vars.maxDevices} device) diberikan.` });
      invalidateMembers();
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const revokeLic = useMutation({
    mutationFn: (licenseId: string) => mutate('POST', `/admin/licenses/${licenseId}/revoke`, {}),
    onSuccess: () => invalidateMembers(),
  });

  const revokeDevice = useMutation({
    mutationFn: (deviceId: string) => mutate('DELETE', `/admin/devices/${deviceId}`),
    onSuccess: () => invalidateMembers(),
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => mutate('DELETE', `/admin/sessions/${sessionId}`),
    onSuccess: () => invalidateMembers(),
  });

  const allMembers = members.data ?? [];
  const kpi = {
    total: allMembers.length,
    active: allMembers.filter((m) => m.status === 'ACTIVE').length,
    licensed: allMembers.filter((m) => {
      const d = memberDaysLeft(m.licenseValidUntil);
      return d !== null && d > 0;
    }).length,
    expiredOrNone: allMembers.filter((m) => {
      const d = memberDaysLeft(m.licenseValidUntil);
      return d === null || d <= 0;
    }).length,
    suspended: allMembers.filter((m) => m.status === 'SUSPENDED' || m.status === 'DISABLED').length,
  };

  const list = allMembers.filter((m) => {
    const okStatus = statusFilter === 'ALL' || m.status === statusFilter;
    const days = memberDaysLeft(m.licenseValidUntil);
    const okLic =
      licenseFilter === 'ALL' ||
      (licenseFilter === 'ACTIVE' && days !== null && days > 0) ||
      (licenseFilter === 'EXPIRING' && days !== null && days > 0 && days <= 14) ||
      (licenseFilter === 'EXPIRED' && (days === null || days <= 0));
    const okSearch =
      !search.trim() ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.displayName.toLowerCase().includes(search.toLowerCase());
    return okStatus && okLic && okSearch;
  });

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }).catch(() => undefined);
  }

  function exportCsv() {
    const header = ['Nama', 'Email', 'Role', 'Status', 'Lisensi Valid Until', 'Max Devices', 'Active Devices', 'Active Sessions'];
    const rows = list.map((m) => [
      m.displayName,
      m.email,
      m.role,
      m.status,
      m.licenseValidUntil ?? '',
      String(m.licenseMaxDevices ?? ''),
      String(m.activeDevicesCount ?? 0),
      String(m.activeSessionsCount ?? 0),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dentsweb-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">02 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Manajemen Member & Akses</h1>
          <p className="mt-1 text-sm text-muted">Registrasi member, kelola status, reset password, paksa logout, dan perpanjang lisensi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Icon name="download" className="w-3.5 h-3.5 mr-1.5 inline" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowRegister(true)}>
            <Icon name="plus" className="w-3.5 h-3.5 mr-1.5 inline" />
            Registrasi Member
          </Button>
        </div>
      </div>

      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5">
          <p className="text-[11px] font-mono uppercase text-muted">Total Member</p>
          <p className="num text-xl font-semibold text-text mt-0.5">{kpi.total}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-mono uppercase text-muted">Aktif</p>
          <p className="num text-xl font-semibold text-ok mt-0.5">{kpi.active}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-mono uppercase text-muted">Lisensi Aktif</p>
          <p className="num text-xl font-semibold text-accent mt-0.5">{kpi.licensed}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-mono uppercase text-muted">Expired / Kosong</p>
          <p className="num text-xl font-semibold text-warn mt-0.5">{kpi.expiredOrNone}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-mono uppercase text-muted">Suspended</p>
          <p className="num text-xl font-semibold text-bad mt-0.5">{kpi.suspended}</p>
        </Card>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 ${
            feedback.ok ? 'border-accent/40 bg-accent/10 text-text' : 'border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          <span className="font-mono break-all">{feedback.text}</span>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.copyText && (
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(feedback.copyText!)}>
                <Icon name="copy" className="w-3 h-3 mr-1 inline" />
                {copiedKey ? 'Tersalin' : 'Salin'}
              </Button>
            )}
            <button onClick={() => setFeedback(null)} className="text-muted hover:text-text cursor-pointer">Tutup</button>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Cari nama / email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-60 h-9 text-xs" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36 h-9 text-xs">
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="DISABLED">DISABLED</option>
        </Select>
        <Select value={licenseFilter} onChange={(e) => setLicenseFilter(e.target.value)} className="w-44 h-9 text-xs">
          <option value="ALL">Semua Lisensi</option>
          <option value="ACTIVE">Lisensi Aktif</option>
          <option value="EXPIRING">Segera Expired (&le;14h)</option>
          <option value="EXPIRED">Expired / Kosong</option>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lisensi &amp; Expired</th>
                <th className="px-4 py-3">Device &amp; Sesi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((m) => {
                const days = memberDaysLeft(m.licenseValidUntil);
                return (
                  <tr key={m.id} className="hover:bg-surface-2/40 transition">
                    <td className="px-4 py-3 font-medium text-text">{m.displayName}</td>
                    <td className="px-4 py-3 font-mono text-muted">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={m.role === 'SUPERADMIN' ? 'text-accent font-bold' : 'text-muted'}>{m.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={m.status}
                        disabled={setStatus.isPending || m.role === 'SUPERADMIN'}
                        onChange={(e) => setStatus.mutate({ id: m.id, status: e.target.value })}
                        className="h-7 text-[11px] w-28"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="DISABLED">DISABLED</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {days === null ? (
                        <Pill ok={null}>Kosong</Pill>
                      ) : days <= 0 ? (
                        <Pill ok={false}>EXPIRED</Pill>
                      ) : (
                        <div className="space-y-0.5">
                          <Pill ok={days > 14 ? true : null}>{days}h tersisa</Pill>
                          <p className="text-[10px] font-mono text-muted">
                            s/d {new Date(m.licenseValidUntil!).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">
                      {m.activeDevicesCount ?? 0}/{m.licenseMaxDevices ?? '-'} dev · {m.activeSessionsCount ?? 0} sesi
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedMemberId(m.id)}>
                        Detail &amp; Akses
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">Tidak ada member yang sesuai.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Register New Member Modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Registrasi Member Baru">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            registerMember.mutate();
          }}
          className="space-y-3 text-xs"
        >
          <Input required placeholder="Nama Tampilan" value={regName} onChange={(e) => setRegName(e.target.value)} className="h-9 text-xs" />
          <Input required type="email" placeholder="Email Member" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="h-9 text-xs" />
          <Input placeholder="Password (kosongkan untuk auto-generate aman)" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="h-9 text-xs font-mono" />
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-muted">
              Role
              <Select value={regRole} onChange={(e) => setRegRole(e.target.value as 'MEMBER' | 'SUPERADMIN')} className="h-9 text-xs">
                <option value="MEMBER">MEMBER</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
              </Select>
            </label>
            <label className="grid gap-1 text-muted">
              Lisensi (Hari)
              <Input type="number" min={0} max={3650} value={regDays} onChange={(e) => setRegDays(Number(e.target.value))} className="h-9 text-xs" />
            </label>
            <label className="grid gap-1 text-muted">
              Maks Device
              <Input type="number" min={1} max={50} value={regMaxDev} onChange={(e) => setRegMaxDev(Number(e.target.value))} className="h-9 text-xs" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowRegister(false)}>Batal</Button>
            <Button type="submit" size="sm" disabled={!regName.trim() || !regEmail.trim() || registerMember.isPending}>
              {registerMember.isPending ? 'Mendaftarkan…' : 'Daftarkan Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Member Detail, Edit Profile, Reset Password, Quick Extend & Sessions Modal */}
      <Modal open={!!selectedMemberId} onClose={() => setSelectedMemberId(null)} title={detailQ.data?.user?.displayName ?? 'Detail Member'}>
        {detailQ.isLoading ? (
          <p className="text-xs text-muted py-4">Memuat detail member…</p>
        ) : detailQ.data ? (
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 text-xs">
            {/* Edit Profile & Role */}
            <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
              <p className="font-semibold text-text">Edit Profil &amp; Role</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama" className="h-8 text-xs" />
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" className="h-8 text-xs font-mono" />
                <Select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="h-8 text-xs">
                  <option value="MEMBER">MEMBER</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </Select>
                <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="h-8 text-xs">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                </Select>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-1">
                <Button size="sm" variant="danger" disabled={revokeAllSessions.isPending} onClick={() => revokeAllSessions.mutate(selectedMemberId!)}>
                  Paksa Logout Semua Sesi
                </Button>
                <Button size="sm" disabled={editMember.isPending} onClick={() => editMember.mutate(selectedMemberId!)}>
                  {editMember.isPending ? 'Menyimpan…' : 'Simpan Profil'}
                </Button>
              </div>
            </div>

            {/* Reset Password */}
            <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2">
              <p className="font-semibold text-text">Reset Password Member</p>
              <p className="text-[11px] text-muted">
                Password disimpan dalam bentuk hash satu arah (Argon2id) sehingga tidak dapat dilihat ulang. Gunakan form ini untuk membuat password baru.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Password baru (kosongkan = generate acak)"
                  value={resetPwInput}
                  onChange={(e) => setResetPwInput(e.target.value)}
                  className="flex-1 h-8 text-xs font-mono"
                />
                <Button size="sm" variant="outline" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate(selectedMemberId!)}>
                  {resetPassword.isPending ? 'Mereset…' : resetPwInput.trim() ? 'Set Password' : 'Generate Acak'}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer">
                <input type="checkbox" checked={resetRevokeAll} onChange={(e) => setResetRevokeAll(e.target.checked)} />
                Akhiri semua sesi login aktif setelah reset password
              </label>
            </div>

            {/* Quick Extend License */}
            <div className="space-y-2 border-t border-line pt-3">
              <p className="font-semibold text-text">Perpanjang / Berikan Lisensi (Quick Extend)</p>
              <div className="flex flex-wrap gap-1.5">
                {[30, 90, 365].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="outline"
                    disabled={grantLic.isPending}
                    onClick={() => grantLic.mutate({ userId: selectedMemberId!, days: d, maxDevices: grantDevices })}
                  >
                    +{d} Hari
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input type="number" min={1} max={3650} value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} className="w-24 h-8 text-xs" title="Durasi (hari)" />
                <span className="text-muted">hari</span>
                <Input type="number" min={1} max={50} value={grantDevices} onChange={(e) => setGrantDevices(Number(e.target.value))} className="w-20 h-8 text-xs" title="Maks Device" />
                <span className="text-muted">device</span>
                <Button size="sm" disabled={grantLic.isPending} onClick={() => grantLic.mutate({ userId: selectedMemberId!, days: grantDays, maxDevices: grantDevices })}>
                  + Grant Lisensi
                </Button>
              </div>
            </div>

            {/* Licenses */}
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="font-semibold text-text">Lisensi ({toArr(detailQ.data.licenseHistory ?? detailQ.data.licenses).length})</p>
              {toArr(detailQ.data.licenseHistory ?? detailQ.data.licenses).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-line p-2">
                  <div>
                    <Pill ok={l.status === 'ACTIVE'}>{l.status}</Pill>
                    <span className="ml-2 font-mono text-muted">
                      Maks {l.maxDevices} dev {l.validUntil ? `· s/d ${new Date(l.validUntil).toLocaleDateString('id-ID')}` : ''}
                    </span>
                  </div>
                  {l.status === 'ACTIVE' && (
                    <Button size="sm" variant="danger" onClick={() => revokeLic.mutate(l.id)}>Revoke</Button>
                  )}
                </div>
              ))}
            </div>

            {/* Devices */}
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="font-semibold text-text">Perangkat ({detailQ.data.devices?.length ?? 0})</p>
              {(detailQ.data.devices ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-line p-2">
                  <span>{d.label} ({d.platform})</span>
                  <Button size="sm" variant="ghost" onClick={() => revokeDevice.mutate(d.id)}>Cabut</Button>
                </div>
              ))}
            </div>

            {/* Sessions */}
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="font-semibold text-text">Sesi Aktif ({detailQ.data.sessions?.length ?? 0})</p>
              {(detailQ.data.sessions ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-line p-2">
                  <span className="font-mono text-muted">{s.client || 'web'} · {s.id.slice(0, 8)}</span>
                  <Button size="sm" variant="ghost" onClick={() => revokeSession.mutate(s.id)}>Akhiri</Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** 03. License & Global Devices */
export function AdminLicensesView() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'licenses' | 'devices'>('licenses');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantDays, setGrantDays] = useState(30);
  const [grantMaxDev, setGrantMaxDev] = useState(2);

  const licenses = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () =>
      get<unknown>('/admin/licenses?limit=100')
        .then((r) =>
          toArr<any>(r).map((row) => {
            const lic = row?.license ?? row;
            return {
              ...lic,
              userEmail: row?.email ?? lic?.userEmail,
              displayName: row?.displayName ?? lic?.displayName,
            } as License & { displayName?: string };
          })
        )
        .catch(() => []),
  });

  const members = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => get<unknown>('/admin/members?limit=100').then((r) => toArr<Member>(r)).catch(() => []),
  });

  const devices = useQuery({
    queryKey: ['admin-devices'],
    queryFn: () =>
      get<unknown>('/admin/devices?limit=100')
        .then((r) =>
          toArr<any>(r).map((row) => {
            const dev = row?.device ?? row;
            return { ...dev, userEmail: row?.email ?? dev?.userEmail };
          })
        )
        .catch(() => []),
    enabled: subTab === 'devices',
  });

  const grantMut = useMutation({
    mutationFn: () =>
      mutate('POST', '/admin/licenses/grant', {
        userId: grantUserId,
        validUntil: new Date(Date.now() + grantDays * 86_400_000).toISOString(),
        maxDevices: grantMaxDev,
      }),
    onSuccess: () => {
      setGrantUserId('');
      qc.invalidateQueries({ queryKey: ['admin-licenses'] });
      qc.invalidateQueries({ queryKey: ['admin-members'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/licenses/${id}/revoke`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-licenses'] });
      qc.invalidateQueries({ queryKey: ['admin-members'] });
    },
  });

  const revokeDevMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/admin/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-devices'] }),
  });

  const licList = toArr<License & { displayName?: string }>(licenses.data).filter((l) => {
    const okStatus = statusFilter === 'ALL' || l.status === statusFilter;
    const q = search.trim().toLowerCase();
    const okSearch = !q || (l.userEmail ?? '').toLowerCase().includes(q) || (l.displayName ?? '').toLowerCase().includes(q);
    return okStatus && okSearch;
  });

  const devList = toArr<any>(devices.data).filter((d) => {
    const q = search.trim().toLowerCase();
    return !q || (d.label ?? '').toLowerCase().includes(q) || (d.userEmail ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">03 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Kelola Lisensi & Device</h1>
          <p className="mt-1 text-sm text-muted">Berikan/cabut lisensi member serta pantau perangkat teraktivasi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Cari email / perangkat..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-9 text-xs" />
          <Button size="sm" variant={subTab === 'licenses' ? 'primary' : 'ghost'} onClick={() => setSubTab('licenses')}>Lisensi</Button>
          <Button size="sm" variant={subTab === 'devices' ? 'primary' : 'ghost'} onClick={() => setSubTab('devices')}>Perangkat Global</Button>
        </div>
      </div>

      {subTab === 'licenses' && (
        <>
          <Card className="p-4 flex flex-wrap items-center gap-2">
            <Select value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} className="flex-1 min-w-[200px] h-9 text-xs">
              <option value="">-- Pilih Member untuk Grant Lisensi --</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.displayName} ({m.email})</option>
              ))}
            </Select>
            <Input type="number" min={1} max={3650} value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} className="w-24 h-9 text-xs" placeholder="Hari" />
            <Input type="number" min={1} max={50} value={grantMaxDev} onChange={(e) => setGrantMaxDev(Number(e.target.value))} className="w-24 h-9 text-xs" placeholder="Device" />
            <Button size="sm" disabled={!grantUserId || grantMut.isPending} onClick={() => grantMut.mutate()}>+ Grant Lisensi</Button>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36 h-9 text-xs">
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="REVOKED">REVOKED</option>
            </Select>
          </Card>
          {grantMut.isError && <p className="text-xs text-bad">{errMsg(grantMut.error)}</p>}

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-muted uppercase font-mono border-b border-line">
                  <tr>
                    <th className="px-4 py-3">User / Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Maks Perangkat</th>
                    <th className="px-4 py-3">Berlaku Sampai</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {licList.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-2/40">
                      <td className="px-4 py-3 font-mono text-text">{l.userEmail || l.userId.slice(0, 8)}</td>
                      <td className="px-4 py-3"><Pill ok={l.status === 'ACTIVE'}>{l.status}</Pill></td>
                      <td className="px-4 py-3 font-mono text-muted">{l.maxDevices} device</td>
                      <td className="px-4 py-3 font-mono text-muted">{l.validUntil ? new Date(l.validUntil).toLocaleDateString('id-ID') : 'Selamanya'}</td>
                      <td className="px-4 py-3 text-right">
                        {l.status === 'ACTIVE' && (
                          <Button size="sm" variant="danger" disabled={revokeMut.isPending} onClick={() => revokeMut.mutate(l.id)}>Revoke</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {licList.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Tidak ada lisensi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {subTab === 'devices' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted uppercase font-mono border-b border-line">
                <tr>
                  <th className="px-4 py-3">Perangkat</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Pemilik</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devList.map((d: any) => (
                  <tr key={d.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-medium text-text">{d.label}</td>
                    <td className="px-4 py-3 font-mono text-muted">{d.platform} / {d.architecture}</td>
                    <td className="px-4 py-3 font-mono text-muted">{d.userEmail || d.userId?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="danger" disabled={revokeDevMut.isPending} onClick={() => revokeDevMut.mutate(d.id)}>Cabut</Button>
                    </td>
                  </tr>
                ))}
                {devList.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Belum ada perangkat global.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** 14. Sistem, VPS, Workers, Settings, Feature Flags, Incidents & Audit Logs */
export function AdminSystemView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'health' | 'settings' | 'flags' | 'incidents' | 'audit'>('health');
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState('MEDIUM');
  const [incBody, setIncBody] = useState('');
  const [settingDraft, setSettingDraft] = useState<Record<string, string>>({});

  // NO fake green catch fallback — show real error state when offline
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => get<SysHealth>('/health'),
    refetchInterval: 10000,
    retry: false,
  });

  const workersQ = useQuery({
    queryKey: ['admin-workers'],
    queryFn: () => get<unknown>('/admin/workers').then((r) => toArr(r)).catch(() => []),
    enabled: tab === 'health',
  });

  const settingsQ = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => get<unknown>('/admin/settings').then((r) => toArr(r)).catch(() => []),
    enabled: tab === 'settings',
  });

  const flagsQ = useQuery({
    queryKey: ['admin-flags'],
    queryFn: () => get<unknown>('/admin/feature-flags').then((r) => toArr(r)).catch(() => []),
    enabled: tab === 'flags',
  });

  const incidentsQ = useQuery({
    queryKey: ['admin-incidents'],
    queryFn: () => get<unknown>('/admin/incidents').then((r) => toArr(r)).catch(() => []),
    enabled: tab === 'incidents',
  });

  const auditQ = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () =>
      get<unknown>('/admin/audit-logs?limit=50')
        .then((r) =>
          toArr<any>(r).map((row) => ({
            ...(row?.log ?? row),
            actorEmail: row?.actorEmail ?? null,
          }))
        )
        .catch(() => []),
    enabled: tab === 'audit',
  });

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => mutate('PATCH', `/admin/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settings'] }),
  });

  const toggleFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => mutate('PATCH', `/admin/feature-flags/${key}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flags'] }),
  });

  const createIncident = useMutation({
    mutationFn: () => mutate('POST', '/admin/incidents', { title: incTitle.trim(), severity: incSeverity, rootCause: incBody.trim() || undefined }),
    onSuccess: () => {
      setIncTitle('');
      setIncBody('');
      qc.invalidateQueries({ queryKey: ['admin-incidents'] });
    },
  });

  const resolveIncident = useMutation({
    mutationFn: (id: string) => mutate('PATCH', `/admin/incidents/${id}`, { status: 'RESOLVED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-incidents'] }),
  });

  const h = health.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">14 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Sistem, VPS & Audit</h1>
          <p className="mt-1 text-sm text-muted">Pantau kesehatan server real-time, worker nodes, feature flags, insiden, dan audit log.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'health', label: 'Health & Workers' },
            { id: 'settings', label: 'Settings' },
            { id: 'flags', label: 'Feature Flags' },
            { id: 'incidents', label: 'Incidents' },
            { id: 'audit', label: 'Audit Logs' },
          ].map((t) => (
            <Button key={t.id} size="sm" variant={tab === t.id ? 'primary' : 'ghost'} onClick={() => setTab(t.id as typeof tab)}>
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === 'health' && (
        <>
          {health.isError && (
            <Card className="p-5 border-bad/40 bg-bad/10 space-y-2">
              <p className="text-sm font-semibold text-bad">Server API Tidak Dapat Dihubungi (OFFLINE)</p>
              <p className="text-xs text-bad/90">{errMsg(health.error)}</p>
              <Button size="sm" variant="outline" onClick={() => health.refetch()}>Coba Hubungi Lagi</Button>
            </Card>
          )}

          {h && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'API Server', val: h.status, ok: h.status === 'ok' },
                { label: 'Database PostgreSQL', val: h.db, ok: h.db === 'up' },
                { label: 'Redis (BullMQ)', val: h.redis, ok: h.redis === 'up' },
                { label: 'SMTP Service', val: h.smtp, ok: h.smtp === 'configured' },
              ].map((item) => (
                <Card key={item.label} className="p-5 space-y-2">
                  <p className="text-xs text-muted font-medium">{item.label}</p>
                  <Pill ok={item.ok}>{(item.val || 'DOWN').toUpperCase()}</Pill>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-text">Worker Nodes ({workersQ.data?.length ?? 0})</h2>
            {(workersQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted">Belum ada worker node terdaftar.</p>
            ) : (
              <div className="space-y-2">
                {(workersQ.data ?? []).map((w: any) => (
                  <div key={w.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
                    <div>
                      <p className="font-mono font-semibold text-text">{w.name || w.id}</p>
                      <p className="text-muted">Last heartbeat: {w.lastHeartbeatAt ? new Date(w.lastHeartbeatAt).toLocaleString('id-ID') : '-'}</p>
                    </div>
                    <Pill ok={w.status === 'ONLINE'}>{w.status}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'settings' && (
        <Card className="p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-text">System Settings</h2>
          {(settingsQ.data ?? []).map((s: any) => (
            <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-xs">
              <div className="min-w-0">
                <p className="font-mono font-semibold text-text">{s.key}</p>
                {s.description && <p className="text-muted">{s.description}</p>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={settingDraft[s.key] ?? JSON.stringify(s.value)}
                  onChange={(e) => setSettingDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                  className="w-56 h-8 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      const val = JSON.parse(settingDraft[s.key] ?? JSON.stringify(s.value));
                      saveSetting.mutate({ key: s.key, value: val });
                    } catch {
                      saveSetting.mutate({ key: s.key, value: settingDraft[s.key] });
                    }
                  }}
                >
                  Simpan
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'flags' && (
        <Card className="p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-text">Feature Flags</h2>
          {(flagsQ.data ?? []).map((f: any) => (
            <div key={f.key} className="flex items-center justify-between border-b border-line pb-3 text-xs">
              <div>
                <p className="font-mono font-semibold text-text">{f.key}</p>
                <p className="text-muted">{f.description || 'Toggle fitur platform'}</p>
              </div>
              <Button size="sm" variant={f.enabled ? 'primary' : 'outline'} onClick={() => toggleFlag.mutate({ key: f.key, enabled: !f.enabled })}>
                {f.enabled ? 'AKTIF' : 'NONAKTIF'}
              </Button>
            </div>
          ))}
        </Card>
      )}

      {tab === 'incidents' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-text">Catat Insiden Sistem</h2>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Judul insiden..." value={incTitle} onChange={(e) => setIncTitle(e.target.value)} className="flex-1 h-9 text-xs" />
              <Select value={incSeverity} onChange={(e) => setIncSeverity(e.target.value)} className="w-36 h-9 text-xs">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </Select>
            </div>
            <Textarea rows={2} placeholder="Deskripsi dampak / kronologi..." value={incBody} onChange={(e) => setIncBody(e.target.value)} className="text-xs" />
            <Button size="sm" disabled={!incTitle.trim() || createIncident.isPending} onClick={() => createIncident.mutate()}>+ Buat Insiden</Button>
          </Card>

          <div className="space-y-2">
            {(incidentsQ.data ?? []).map((inc: any) => (
              <Card key={inc.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill ok={inc.status === 'RESOLVED' ? true : false}>{inc.status}</Pill>
                    <span className="font-semibold text-text">{inc.title}</span>
                  </div>
                  <p className="text-muted mt-1">{inc.body}</p>
                </div>
                {inc.status !== 'RESOLVED' && (
                  <Button size="sm" variant="outline" onClick={() => resolveIncident.mutate(inc.id)}>Selesaikan</Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Waktu</th>
                  <th className="px-4 py-2.5">Aksi</th>
                  <th className="px-4 py-2.5">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(auditQ.data ?? []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-mono text-muted">{new Date(a.createdAt).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 font-mono font-semibold text-text">{a.action}</td>
                    <td className="px-4 py-2 font-mono text-muted">{a.targetType} {a.targetId?.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** 06. AI Provider & Auto-Fallback Router (5 Providers + Priority + Cooldown + OAuth Client Config) */
export function AdminAIProvidersView() {
  const qc = useQueryClient();
  const [showOAuthCfg, setShowOAuthCfg] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleRedirectUri, setGoogleRedirectUri] = useState('');
  const [openaiClientId, setOpenaiClientId] = useState('');
  const [openaiClientSecret, setOpenaiClientSecret] = useState('');
  const [openaiRedirectUri, setOpenaiRedirectUri] = useState('');
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  const oauthClientsQ = useQuery({
    queryKey: ['admin-ai-oauth-clients'],
    queryFn: () => get<Record<string, any>>('/admin/ai/oauth-clients').catch(() => null),
    enabled: showOAuthCfg,
  });

  useEffect(() => {
    const d = oauthClientsQ.data;
    if (!d) return;
    if (d.gemini?.clientId && !googleClientId) setGoogleClientId(String(d.gemini.clientId));
    if (d.gemini?.redirectUri && !googleRedirectUri) setGoogleRedirectUri(String(d.gemini.redirectUri));
    if (d.openai?.clientId && !openaiClientId) setOpenaiClientId(String(d.openai.clientId));
    if (d.openai?.redirectUri && !openaiRedirectUri) setOpenaiRedirectUri(String(d.openai.redirectUri));
  }, [oauthClientsQ.data]);

  const saveOAuthCfg = useMutation({
    mutationFn: () =>
      mutate('PATCH', '/admin/ai/oauth-clients', {
        gemini: {
          ...(googleClientId.trim() ? { clientId: googleClientId.trim() } : {}),
          ...(googleClientSecret.trim() ? { clientSecret: googleClientSecret.trim() } : {}),
          ...(googleRedirectUri.trim() ? { redirectUri: googleRedirectUri.trim() } : {}),
        },
        openai: {
          ...(openaiClientId.trim() ? { clientId: openaiClientId.trim() } : {}),
          ...(openaiClientSecret.trim() ? { clientSecret: openaiClientSecret.trim() } : {}),
          ...(openaiRedirectUri.trim() ? { redirectUri: openaiRedirectUri.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setGoogleClientSecret('');
      setOpenaiClientSecret('');
      setCfgMsg('Konfigurasi OAuth Client berhasil disimpan ke server (aktif tanpa restart).');
      qc.invalidateQueries({ queryKey: ['admin-ai-oauth-clients'] });
      qc.invalidateQueries({ queryKey: ['ai-providers'] });
    },
    onError: (e) => setCfgMsg(`Gagal menyimpan OAuth Client: ${errMsg(e)}`),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">06 · SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">AI Provider & Auto-Fallback Router</h1>
        <p className="mt-1 text-sm text-muted">Kelola koneksi multi-provider (Anthropic Claude, Google Gemini, OpenAI, OpenRouter, Custom / 9Router), atur urutan prioritas auto-switch, model aktif, dan uji respons.</p>
      </div>

      <AiProvidersPanel />

      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-text">Konfigurasi OAuth Client (Google / OpenAI)</h2>
            <p className="text-xs text-muted">Opsional — simpan Client ID &amp; Secret OAuth resmi milik Anda agar login OAuth Google/OpenAI aktif tanpa restart server.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowOAuthCfg((v) => !v)}>
            {showOAuthCfg ? 'Sembunyikan' : 'Atur OAuth Client'}
          </Button>
        </div>

        {showOAuthCfg && (
          <div className="space-y-4 pt-3 border-t border-line">
            {cfgMsg && <p className="text-xs text-accent">{cfgMsg}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3.5">
                <p className="text-xs font-semibold text-text">Google Gemini OAuth</p>
                <Input placeholder="Google Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} className="h-8 text-xs font-mono" />
                <Input type="password" placeholder={oauthClientsQ.data?.gemini?.hasSecret ? 'Client Secret tersimpan (kosongkan jika tetap)' : 'Google Client Secret'} value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} className="h-8 text-xs font-mono" />
                <Input placeholder="Redirect URI (opsional)" value={googleRedirectUri} onChange={(e) => setGoogleRedirectUri(e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3.5">
                <p className="text-xs font-semibold text-text">OpenAI OAuth</p>
                <Input placeholder="OpenAI Client ID" value={openaiClientId} onChange={(e) => setOpenaiClientId(e.target.value)} className="h-8 text-xs font-mono" />
                <Input type="password" placeholder={oauthClientsQ.data?.openai?.hasSecret ? 'Client Secret tersimpan (kosongkan jika tetap)' : 'OpenAI Client Secret'} value={openaiClientSecret} onChange={(e) => setOpenaiClientSecret(e.target.value)} className="h-8 text-xs font-mono" />
                <Input placeholder="Redirect URI (opsional)" value={openaiRedirectUri} onChange={(e) => setOpenaiRedirectUri(e.target.value)} className="h-8 text-xs font-mono" />
              </div>
            </div>
            <div>
              <Button size="sm" disabled={saveOAuthCfg.isPending} onClick={() => saveOAuthCfg.mutate()}>
                {saveOAuthCfg.isPending ? 'Menyimpan…' : 'Simpan Konfigurasi OAuth'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? '');
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface MotionSkillItem {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  content: string;
  active?: boolean;
  sourceType?: string;
  filesCount?: number;
  totalBytes?: number;
  storagePath?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 07. Workflow Engine & Skills Library CMS */
export function AdminWorkflowsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'agents' | 'skills' | 'workflows'>('agents');
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentModel, setAgentModel] = useState(DEFAULT_MODELS[0]!);
  const [agentTemp, setAgentTemp] = useState(0.5);

  const [uploadMode, setUploadMode] = useState<'zip' | 'folder' | 'manual'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderFiles, setFolderFiles] = useState<{ path: string; content?: string; base64?: string }[]>([]);
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillBody, setSkillBody] = useState('');
  const [previewSkill, setPreviewSkill] = useState<MotionSkillItem | null>(null);
  const [editingSkill, setEditingSkill] = useState<MotionSkillItem | null>(null);
  const [editSkillName, setEditSkillName] = useState('');
  const [editSkillDesc, setEditSkillDesc] = useState('');
  const [editSkillBody, setEditSkillBody] = useState('');
  const [editSkillActive, setEditSkillActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const agentsQ = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => get<unknown>('/admin/agents').then((r) => toArr(r)).catch(() => []),
  });

  const skillsQ = useQuery({
    queryKey: ['admin-skills'],
    queryFn: () => get<unknown>('/admin/skills').then((r) => toArr<MotionSkillItem>(r)).catch(() => []),
  });

  const workflowsQ = useQuery({
    queryKey: ['admin-workflows'],
    queryFn: () => get<unknown>('/admin/workflows').then((r) => toArr(r)).catch(() => []),
  });

  const saveAgent = useMutation({
    mutationFn: () =>
      mutate('POST', `/admin/agents/${editingAgent.code}/versions`, {
        systemPrompt: agentPrompt,
        model: agentModel,
        temperature: agentTemp,
        publish: true,
      }),
    onSuccess: () => {
      setEditingAgent(null);
      qc.invalidateQueries({ queryKey: ['admin-agents'] });
      setFeedback('Versi prompt agent berhasil disimpan & dipublikasikan.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const createSkill = useMutation({
    mutationFn: () =>
      mutate('POST', '/admin/skills', {
        name: skillName.trim(),
        description: skillDesc.trim() || undefined,
        content: skillBody.trim(),
        active: true,
      }),
    onSuccess: () => {
      setSkillName('');
      setSkillDesc('');
      setSkillBody('');
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
      setFeedback('Skill berhasil disimpan ke Skills Library.');
    },
    onError: (e) => setFeedback(`Gagal menyimpan skill: ${errMsg(e)}`),
  });

  const uploadZipMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return uploadSkillZip(file.name, base64);
    },
    onSuccess: (res) => {
      setZipFile(null);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
      setFeedback(`Berhasil mengimpor ${res?.count ?? res?.imported?.length ?? 1} skill dari arsip .ZIP.`);
    },
    onError: (e) => setFeedback(`Gagal upload .ZIP: ${errMsg(e)}`),
  });

  const uploadFolderMut = useMutation({
    mutationFn: () =>
      mutate<{ imported?: unknown[]; count?: number }>('POST', '/admin/skills/upload-folder', {
        folderName: folderName || undefined,
        files: folderFiles,
      }),
    onSuccess: (res) => {
      setFolderName('');
      setFolderFiles([]);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
      setFeedback(`Berhasil mengimpor ${res?.count ?? res?.imported?.length ?? 1} skill dari folder.`);
    },
    onError: (e) => setFeedback(`Gagal upload folder: ${errMsg(e)}`),
  });

  const updateSkillMut = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>
      mutate('PATCH', `/admin/skills/${payload.id}`, payload.body),
    onSuccess: () => {
      setEditingSkill(null);
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
      setFeedback('Skill berhasil diperbarui.');
    },
    onError: (e) => setFeedback(`Gagal memperbarui skill: ${errMsg(e)}`),
  });

  const deleteSkill = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/admin/skills/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-skills'] });
      setFeedback('Skill dihapus dari Skills Library.');
    },
    onError: (e) => setFeedback(`Gagal menghapus skill: ${errMsg(e)}`),
  });

  const publishWorkflow = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/workflows/${id}/publish`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workflows'] });
      setFeedback('Workflow dipublikasikan.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const skills = skillsQ.data ?? [];
  const activeSkills = skills.filter((s) => s.active !== false);
  const inactiveSkills = skills.length - activeSkills.length;
  const totalActiveChars = activeSkills.reduce((acc, s) => acc + (s.content?.length ?? 0), 0);

  async function handleFolderSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const collected: { path: string; content?: string; base64?: string }[] = [];
    let rootDir = '';
    const textExt = /\.(md|txt|json|yml|yaml|py|sh|js|mjs|ts|tsx|css|html|svg|xml|csv|toml|ini|env\.example)$/i;
    for (const f of Array.from(files)) {
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      if (!rootDir && relPath.includes('/')) rootDir = relPath.split('/')[0] ?? '';
      if (textExt.test(f.name) || f.type.startsWith('text/')) {
        const content = await f.text();
        collected.push({ path: relPath, content });
      } else {
        const base64 = await fileToBase64(f);
        collected.push({ path: relPath, base64 });
      }
    }
    setFolderName(rootDir || 'skill-folder');
    setFolderFiles(collected);
    if (collected.length === 0) {
      setFeedback('Folder kosong — tidak ada file ditemukan.');
    }
  }

  async function handleMdFilePrefill(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const baseName = file.name.replace(/\.(md|txt)$/i, '');
    if (!skillName.trim()) setSkillName(baseName);
    setSkillBody(text);
    setFeedback(`File ${file.name} dimuat ke editor (${text.length.toLocaleString('id-ID')} karakter).`);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">07 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Agent Workflows & Skills Library</h1>
          <p className="mt-1 text-sm text-muted">Edit prompt & model agent, kelola Skills Library (.zip, folder, atau .md) di database, dan publikasikan workflow.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'agents' ? 'primary' : 'ghost'} onClick={() => setTab('agents')}>Agents ({agentsQ.data?.length ?? 0})</Button>
          <Button size="sm" variant={tab === 'skills' ? 'primary' : 'ghost'} onClick={() => setTab('skills')}>
            <Icon name="puzzle" className="w-3.5 h-3.5 mr-1.5 inline" />
            Skills Library ({skills.length})
          </Button>
          <Button size="sm" variant={tab === 'workflows' ? 'primary' : 'ghost'} onClick={() => setTab('workflows')}>Workflows ({workflowsQ.data?.length ?? 0})</Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-text flex justify-between items-center gap-3">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text cursor-pointer">Tutup</button>
        </div>
      )}

      {tab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(agentsQ.data ?? []).map((a: any) => (
            <Card key={a.id || a.code} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-text">{a.name}</h3>
                  <p className="text-[11px] font-mono text-muted">@{a.code} · v{a.activeVersion?.version ?? 1}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingAgent(a);
                    setAgentPrompt(a.activeVersion?.systemPrompt ?? '');
                    setAgentModel(a.activeVersion?.model ?? DEFAULT_MODELS[0]!);
                    setAgentTemp(Number(a.activeVersion?.temperature ?? 0.5));
                  }}
                >
                  Edit Prompt
                </Button>
              </div>
              <p className="text-xs text-muted line-clamp-2">{a.description || a.activeVersion?.systemPrompt}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'skills' && (
        <div className="space-y-4">
          {/* Live Summary Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Total Skills</p>
              <p className="mt-1 font-display text-2xl font-semibold text-text">{skills.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Aktif</p>
              <p className="mt-1 font-display text-2xl font-semibold text-emerald-400">{activeSkills.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Nonaktif</p>
              <p className="mt-1 font-display text-2xl font-semibold text-muted">{inactiveSkills}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Total Karakter Aktif</p>
              <p className="mt-1 font-display text-2xl font-semibold text-text">{totalActiveChars.toLocaleString('id-ID')}</p>
            </Card>
          </div>

          {/* 3-Mode Upload Panel */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="upload" className="w-4 h-4 text-accent" />
                <h2 className="font-display text-sm font-semibold text-text">Tambah / Impor ke Skills Library</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant={uploadMode === 'zip' ? 'primary' : 'outline'} onClick={() => setUploadMode('zip')}>
                  <Icon name="package" className="w-3.5 h-3.5 mr-1.5 inline" />
                  Upload .ZIP
                </Button>
                <Button size="sm" variant={uploadMode === 'folder' ? 'primary' : 'outline'} onClick={() => setUploadMode('folder')}>
                  <Icon name="folder" className="w-3.5 h-3.5 mr-1.5 inline" />
                  Upload Folder
                </Button>
                <Button size="sm" variant={uploadMode === 'manual' ? 'primary' : 'outline'} onClick={() => setUploadMode('manual')}>
                  <Icon name="edit" className="w-3.5 h-3.5 mr-1.5 inline" />
                  Upload .md / Manual
                </Button>
              </div>
            </div>

            {uploadMode === 'zip' && (
              <div className="space-y-3 rounded-xl border border-dashed border-line bg-surface-2/40 p-4">
                <p className="text-xs text-muted">
                  Unggah arsip <span className="font-mono text-text">.zip</span> berisi satu atau beberapa folder skill (<span className="font-mono text-text">SKILL.md</span> beserta semua file pendukung seperti <span className="font-mono text-text">.py</span>, <span className="font-mono text-text">.sh</span>, <span className="font-mono text-text">scripts/</span>, <span className="font-mono text-text">references/</span>, aset). Semua file disimpan ke storage VPS &amp; database.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                    className="text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text hover:file:bg-surface-2 cursor-pointer"
                  />
                  {zipFile && (
                    <span className="text-xs font-mono text-muted">
                      {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div>
                  <Button
                    size="sm"
                    disabled={!zipFile || uploadZipMut.isPending}
                    onClick={() => zipFile && uploadZipMut.mutate(zipFile)}
                  >
                    <Icon name="upload" className="w-3.5 h-3.5 mr-1.5 inline" />
                    {uploadZipMut.isPending ? 'Mengimpor .ZIP…' : 'Impor Skill dari .ZIP'}
                  </Button>
                </div>
              </div>
            )}

            {uploadMode === 'folder' && (
              <div className="space-y-3 rounded-xl border border-dashed border-line bg-surface-2/40 p-4">
                <p className="text-xs text-muted">
                  Pilih folder skill lokal yang berisi <span className="font-mono text-text">SKILL.md</span> beserta seluruh file pendukung (<span className="font-mono text-text">.md</span>, <span className="font-mono text-text">.py</span>, <span className="font-mono text-text">.json</span>, gambar, dll.). Semua file akan disimpan ke storage VPS &amp; database.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    multiple
                    {...({ webkitdirectory: '', directory: '' } as Record<string, unknown>)}
                    onChange={(e) => void handleFolderSelect(e.target.files)}
                    className="text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text hover:file:bg-surface-2 cursor-pointer"
                  />
                  {folderFiles.length > 0 && (
                    <span className="text-xs font-mono text-text">
                      Folder: {folderName} · {folderFiles.length} file siap diunggah
                    </span>
                  )}
                </div>
                <div>
                  <Button
                    size="sm"
                    disabled={folderFiles.length === 0 || uploadFolderMut.isPending}
                    onClick={() => uploadFolderMut.mutate()}
                  >
                    <Icon name="folder" className="w-3.5 h-3.5 mr-1.5 inline" />
                    {uploadFolderMut.isPending ? 'Mengunggah Folder…' : `Unggah Folder (${folderFiles.length} file)`}
                  </Button>
                </div>
              </div>
            )}

            {uploadMode === 'manual' && (
              <div className="grid gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                  <span className="text-xs text-muted">Muat cepat dari file <span className="font-mono text-text">.md</span> lokal (opsional):</span>
                  <input
                    type="file"
                    accept=".md,.txt,text/markdown,text/plain"
                    onChange={(e) => void handleMdFilePrefill(e.target.files?.[0] ?? null)}
                    className="text-xs text-muted file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-xs file:text-text cursor-pointer"
                  />
                </div>
                <Input placeholder="Nama Skill (mis. dentsweb-motion)" value={skillName} onChange={(e) => setSkillName(e.target.value)} className="h-9 text-xs" />
                <Input placeholder="Deskripsi singkat" value={skillDesc} onChange={(e) => setSkillDesc(e.target.value)} className="h-9 text-xs" />
                <Textarea rows={6} placeholder="Instruksi Markdown Skill (# Rules, Timing, Easing...)" value={skillBody} onChange={(e) => setSkillBody(e.target.value)} className="text-xs font-mono" />
                <div>
                  <Button size="sm" disabled={!skillName.trim() || !skillBody.trim() || createSkill.isPending} onClick={() => createSkill.mutate()}>
                    {createSkill.isPending ? 'Menyimpan…' : '+ Simpan Skill ke Server'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Skills List */}
          <div className="space-y-2.5">
            {skillsQ.isLoading ? (
              <Card className="p-6 text-center text-xs text-muted">Memuat Skills Library…</Card>
            ) : skills.length === 0 ? (
              <Card className="p-6 text-center text-xs text-muted">Belum ada skill di Skills Library.</Card>
            ) : (
              skills.map((sk) => {
                const isActive = sk.active !== false;
                return (
                  <Card key={sk.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text truncate">{sk.name}</p>
                        <Pill ok={isActive ? true : null}>{isActive ? 'Aktif' : 'Nonaktif'}</Pill>
                        {sk.sourceType && <Pill variant="accent">{sk.sourceType}</Pill>}
                        {typeof sk.filesCount === 'number' && sk.filesCount > 0 && (
                          <span className="text-[11px] font-mono text-muted">{sk.filesCount} file</span>
                        )}
                        {typeof sk.totalBytes === 'number' && sk.totalBytes > 0 && (
                          <span className="text-[11px] font-mono text-muted">{formatBytes(sk.totalBytes)}</span>
                        )}
                        <span className="text-[11px] font-mono text-muted">{(sk.content?.length ?? 0).toLocaleString('id-ID')} karakter</span>
                      </div>
                      <p className="text-xs text-muted truncate">{sk.description || 'Tanpa deskripsi'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant={isActive ? 'outline' : 'primary'}
                        disabled={updateSkillMut.isPending}
                        onClick={() => updateSkillMut.mutate({ id: sk.id, body: { active: !isActive } })}
                      >
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPreviewSkill(sk)}>
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingSkill(sk);
                          setEditSkillName(sk.name);
                          setEditSkillDesc(sk.description ?? '');
                          setEditSkillBody(sk.content ?? '');
                          setEditSkillActive(isActive);
                        }}
                      >
                        <Icon name="edit" className="w-3.5 h-3.5 mr-1 inline" />
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" disabled={deleteSkill.isPending} onClick={() => deleteSkill.mutate(sk.id)}>
                        Hapus
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'workflows' && (
        <div className="space-y-3">
          {(workflowsQ.data ?? []).map((w: any) => (
            <Card key={w.id} className="p-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-text">{w.name}</p>
                <p className="text-xs font-mono text-muted">{w.slug} · {w.status || 'ACTIVE'}</p>
              </div>
              <Button size="sm" variant="outline" disabled={publishWorkflow.isPending} onClick={() => publishWorkflow.mutate(w.id)}>
                Publikasikan
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editingAgent} onClose={() => setEditingAgent(null)} title={`Edit Agent: ${editingAgent?.name ?? ''}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={agentModel} onChange={(e) => setAgentModel(e.target.value)} className="h-9 text-xs">
              {DEFAULT_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input type="number" step={0.1} min={0} max={1} value={agentTemp} onChange={(e) => setAgentTemp(Number(e.target.value))} className="h-9 text-xs" placeholder="Temperature" />
          </div>
          <Textarea rows={10} value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} className="text-xs font-mono" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingAgent(null)}>Batal</Button>
            <Button size="sm" disabled={saveAgent.isPending} onClick={() => saveAgent.mutate()}>Simpan & Publikasikan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!previewSkill} onClose={() => setPreviewSkill(null)} title={`Preview Skill: ${previewSkill?.name ?? ''}`}>
        {previewSkill && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Pill ok={previewSkill.active !== false ? true : null}>{previewSkill.active !== false ? 'Aktif' : 'Nonaktif'}</Pill>
              {previewSkill.sourceType && <Pill variant="accent">{previewSkill.sourceType}</Pill>}
              <span className="font-mono">{(previewSkill.content?.length ?? 0).toLocaleString('id-ID')} karakter</span>
            </div>
            {previewSkill.description && <p className="text-xs text-muted">{previewSkill.description}</p>}
            <pre className="max-h-[55vh] overflow-auto rounded-xl border border-line bg-surface-2 p-3 text-xs font-mono text-text whitespace-pre-wrap break-words">
              {previewSkill.content}
            </pre>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setPreviewSkill(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editingSkill} onClose={() => setEditingSkill(null)} title={`Edit Skill: ${editingSkill?.name ?? ''}`}>
        {editingSkill && (
          <div className="space-y-3">
            <Input placeholder="Nama Skill" value={editSkillName} onChange={(e) => setEditSkillName(e.target.value)} className="h-9 text-xs" />
            <Input placeholder="Deskripsi singkat" value={editSkillDesc} onChange={(e) => setEditSkillDesc(e.target.value)} className="h-9 text-xs" />
            <label className="flex items-center gap-2 text-xs text-text cursor-pointer select-none">
              <input type="checkbox" checked={editSkillActive} onChange={(e) => setEditSkillActive(e.target.checked)} className="rounded border-line" />
              Aktifkan skill di pipeline produksi
            </label>
            <Textarea rows={12} value={editSkillBody} onChange={(e) => setEditSkillBody(e.target.value)} className="text-xs font-mono" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingSkill(null)}>Batal</Button>
              <Button
                size="sm"
                disabled={!editSkillName.trim() || !editSkillBody.trim() || updateSkillMut.isPending}
                onClick={() =>
                  updateSkillMut.mutate({
                    id: editingSkill.id,
                    body: {
                      name: editSkillName.trim(),
                      description: editSkillDesc.trim(),
                      content: editSkillBody.trim(),
                      active: editSkillActive,
                    },
                  })
                }
              >
                {updateSkillMut.isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 08. Production & Global Render Queue */
export function AdminProductionView() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'runs' | 'render'>('runs');
  const [logRunId, setLogRunId] = useState<string | null>(null);

  const runsQ = useQuery({
    queryKey: ['admin-runs'],
    queryFn: () => get<unknown>('/admin/production/runs?limit=50').then((r) => toArr(r)).catch(() => []),
    refetchInterval: 10_000,
  });

  const renderQ = useQuery({
    queryKey: ['admin-render-jobs'],
    queryFn: () => get<unknown>('/admin/render/jobs').then((r) => toArr(r)).catch(() => []),
    enabled: subTab === 'render',
    refetchInterval: 10_000,
  });

  const logsQ = useQuery({
    queryKey: ['admin-run-logs', logRunId],
    queryFn: () => get<unknown>(`/production/runs/${logRunId}/events?technical=1`).then((r) => toArr(r)).catch(() => []),
    enabled: !!logRunId,
  });

  const cancelRun = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/production/runs/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-runs'] }),
  });

  const retryRun = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/production/runs/${id}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-runs'] }),
  });

  const cancelJob = useMutation({
    mutationFn: (id: string) => mutate('POST', `/admin/render/jobs/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-render-jobs'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">08 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Antrean Produksi & Render Global</h1>
          <p className="mt-1 text-sm text-muted">Pantau, batalkan, coba ulang, dan lihat log teknis produksi & render worker.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={subTab === 'runs' ? 'primary' : 'ghost'} onClick={() => setSubTab('runs')}>Pipeline Runs</Button>
          <Button size="sm" variant={subTab === 'render' ? 'primary' : 'ghost'} onClick={() => setSubTab('render')}>Global Render Queue</Button>
        </div>
      </div>

      {subTab === 'runs' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-3">Topik</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tahap / Progress</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(runsQ.data ?? []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-medium text-text max-w-xs truncate">{r.topic || r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><Pill ok={r.status === 'COMPLETED' ? true : r.status === 'FAILED' ? false : null}>{r.status}</Pill></td>
                    <td className="px-4 py-3 font-mono text-muted">{r.currentStage || '-'} ({r.progress ?? 0}%)</td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setLogRunId(r.id)}>Log</Button>
                      {(r.status === 'RUNNING' || r.status === 'QUEUED') && (
                        <Button size="sm" variant="danger" onClick={() => cancelRun.mutate(r.id)}>Cancel</Button>
                      )}
                      {(r.status === 'FAILED' || r.status === 'CANCELLED') && (
                        <Button size="sm" variant="outline" onClick={() => retryRun.mutate(r.id)}>Retry</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {subTab === 'render' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(renderQ.data ?? []).map((j: any) => (
                  <tr key={j.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-mono text-text">{j.projectName || j.id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><Pill>{j.mode}</Pill></td>
                    <td className="px-4 py-3"><Pill ok={j.status === 'COMPLETED' ? true : j.status === 'FAILED' ? false : null}>{j.status}</Pill></td>
                    <td className="px-4 py-3 font-mono text-muted">{j.progress ?? 0}%</td>
                    <td className="px-4 py-3 text-right">
                      {(j.status === 'RUNNING' || j.status === 'QUEUED') && (
                        <Button size="sm" variant="danger" onClick={() => cancelJob.mutate(j.id)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(renderQ.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Tidak ada job render global.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!logRunId} onClose={() => setLogRunId(null)} title={`Log Teknis Run ${logRunId?.slice(0, 8) ?? ''}`}>
        <div className="max-h-80 overflow-y-auto rounded-lg bg-black/90 p-3 font-mono text-[10px] text-white/85 space-y-1">
          {(logsQ.data ?? []).map((e: any) => (
            <div key={e.id}>
              <span className="text-white/40">{new Date(e.createdAt).toLocaleTimeString('id-ID')}</span>{' '}
              <span className="text-accent">[{e.eventType}]</span> {e.message}
            </div>
          ))}
          {(logsQ.data ?? []).length === 0 && <p className="text-white/40">Belum ada entri log.</p>}
        </div>
      </Modal>
    </div>
  );
}

/** 10. Kuota & Scheduler */
export function AdminQuotasView() {
  const qc = useQueryClient();
  const quotasQ = useQuery({
    queryKey: ['admin-quotas'],
    queryFn: () => get<unknown>('/admin/production/quotas').then((r) => toArr(r)).catch(() => []),
  });

  const tickMut = useMutation({
    mutationFn: () => mutate('POST', '/admin/production/scheduler/tick', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-quotas'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">10 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Kuota & Scheduler</h1>
          <p className="mt-1 text-sm text-muted">Pantau pemakaian kuota harian member dan picu scheduler produksi otomatis.</p>
        </div>
        <Button size="sm" disabled={tickMut.isPending} onClick={() => tickMut.mutate()}>
          {tickMut.isPending ? 'Memicu…' : '▶ Trigger Scheduler Tick'}
        </Button>
      </div>

      {tickMut.isSuccess && <p className="text-xs text-ok">✓ Scheduler tick berhasil dijalankan.</p>}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Terpakai Hari Ini</th>
                <th className="px-4 py-3">Batas Harian</th>
                <th className="px-4 py-3">Maks Worker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(quotasQ.data ?? []).map((q: any, idx: number) => (
                <tr key={q.userId || idx}>
                  <td className="px-4 py-3 font-mono text-text">{q.email || q.userId?.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-accent">{q.usedToday ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-muted">{q.maxVideosPerDay ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-muted">{q.maxWorkers ?? '-'}</td>
                </tr>
              ))}
              {(quotasQ.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Belum ada data kuota.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** 11. Rilis Desktop (Upload .dmg/.exe, Dynamic version from app:info, Toggle Active, Download Links) */
export function AdminReleasesView({ info }: { info?: Info }) {
  const qc = useQueryClient();
  const curVer = info?.version ?? '1.0.19';

  const [platform, setPlatform] = useState<'darwin' | 'win32'>('darwin');
  const [arch, setArch] = useState<'arm64' | 'x64' | 'universal'>('arm64');
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable');
  const [version, setVersion] = useState(curVer);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [pickedFile, setPickedFile] = useState<{ filePath: string; filename: string; sizeBytes: number } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const releasesQ = useQuery({
    queryKey: ['admin-releases'],
    queryFn: () => get<unknown>('/admin/releases').then((r) => toArr(r)).catch(() => []),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => mutate('PATCH', `/admin/releases/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-releases'] }),
  });

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!pickedFile) throw new Error('Pilih file installer (.dmg / .exe) terlebih dahulu.');
      return uploadRelease({
        filePath: pickedFile.filePath,
        platform,
        arch,
        channel,
        version: version.trim(),
        releaseNotes: releaseNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setPickedFile(null);
      setReleaseNotes('');
      qc.invalidateQueries({ queryKey: ['admin-releases'] });
      setFeedback({ ok: true, text: `Rilis v${version.trim()} (${platform}/${arch}) berhasil diunggah & dipublikasikan.` });
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal mengunggah rilis: ${errMsg(e)}` }),
  });

  async function handlePickInstaller() {
    try {
      const res = await pickInstaller();
      if (!res.canceled) {
        setPickedFile({ filePath: res.filePath, filename: res.filename, sizeBytes: res.sizeBytes });
        if (res.filename.endsWith('.exe')) {
          setPlatform('win32');
          setArch('x64');
        } else if (res.filename.includes('arm64')) {
          setPlatform('darwin');
          setArch('arm64');
        } else if (res.filename.includes('x64')) {
          setPlatform('darwin');
          setArch('x64');
        }
        const m = res.filename.match(/(\d+\.\d+\.\d+)/);
        if (m?.[1]) setVersion(m[1]);
      }
    } catch (e) {
      setFeedback({ ok: false, text: `Gagal memilih file: ${errMsg(e)}` });
    }
  }

  const list = releasesQ.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">11 · SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Rilis Desktop</h1>
        <p className="mt-1 text-sm text-muted">
          Versi aplikasi desktop ini: <strong className="font-mono text-text">v{curVer}</strong> ({info?.platform}/{info?.arch}). Unggah installer `.dmg`/`.exe` baru atau kelola rilis aktif.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between gap-3 ${
            feedback.ok ? 'border-accent/40 bg-accent/10 text-text' : 'border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Unggah Rilis Baru (.dmg / .exe) */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="upload" className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm font-semibold text-text">Unggah Rilis Baru (.dmg / .exe)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="grid gap-1 text-xs text-muted">
            Platform
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as 'darwin' | 'win32')} className="h-9 text-xs">
              <option value="darwin">macOS (darwin)</option>
              <option value="win32">Windows (win32)</option>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Arch
            <Select value={arch} onChange={(e) => setArch(e.target.value as 'arm64' | 'x64' | 'universal')} className="h-9 text-xs">
              <option value="arm64">Apple Silicon (arm64)</option>
              <option value="x64">Intel / Windows (x64)</option>
              <option value="universal">Universal</option>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Channel
            <Select value={channel} onChange={(e) => setChannel(e.target.value as 'stable' | 'beta')} className="h-9 text-xs">
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Versi
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.13" className="h-9 text-xs font-mono" />
          </label>
        </div>

        <label className="grid gap-1 text-xs text-muted">
          Catatan Rilis
          <Textarea
            rows={3}
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            placeholder="Ringkasan pembaruan versi ini (changelog)..."
            className="text-xs"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => void handlePickInstaller()}>
              <Icon name="package" className="w-3.5 h-3.5 mr-1.5 inline" />
              Pilih File Installer (.dmg / .exe)
            </Button>
            {pickedFile ? (
              <span className="text-xs font-mono text-text">
                {pickedFile.filename} ({formatBytes(pickedFile.sizeBytes)})
              </span>
            ) : (
              <span className="text-xs text-muted">Belum ada file dipilih (stream langsung dari disk)</span>
            )}
          </div>
          <Button
            size="sm"
            disabled={!pickedFile || !version.trim() || uploadMut.isPending}
            onClick={() => uploadMut.mutate()}
          >
            <Icon name="upload" className="w-3.5 h-3.5 mr-1.5 inline" />
            {uploadMut.isPending ? 'Mengunggah Rilis…' : 'Publikasikan Rilis'}
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Arch</th>
                <th className="px-4 py-3">Versi</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3 font-medium text-text">{r.platform}</td>
                  <td className="px-4 py-3 font-mono text-muted">{r.arch}</td>
                  <td className="px-4 py-3 font-mono font-bold text-accent">v{r.version}</td>
                  <td className="px-4 py-3 font-mono text-muted">{r.filename}</td>
                  <td className="px-4 py-3"><Pill ok={r.isActive}>{r.isActive ? 'AKTIF' : 'ARSIP'}</Pill></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {r.downloadUrl && (
                      <Button size="sm" variant="ghost" onClick={() => void invoke('shell:open-external', { url: toMediaUrl(r.downloadUrl) })}>
                        <Icon name="download" className="w-3.5 h-3.5 mr-1 inline" />
                        Unduh
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate({ id: r.id, isActive: !r.isActive })}>
                      {r.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Belum ada rilis terdaftar di tabel app_releases server.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** 12. Support & Help Articles CMS */
export function AdminSupportView() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'tickets' | 'articles'>('tickets');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [artTitle, setArtTitle] = useState('');
  const [artCat, setArtCat] = useState('Panduan');
  const [artBody, setArtBody] = useState('');

  const ticketsQ = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => get<unknown>('/admin/support/tickets').then((r) => toArr(r)).catch(() => []),
  });

  const ticketDetailQ = useQuery({
    queryKey: ['admin-ticket-detail', activeTicketId],
    queryFn: () => get<any>(`/admin/support/tickets/${activeTicketId}`),
    enabled: !!activeTicketId,
  });

  const articlesQ = useQuery({
    queryKey: ['admin-help-articles'],
    queryFn: () => get<unknown>('/admin/help/articles').then((r) => toArr(r)).catch(() => []),
    enabled: subTab === 'articles',
  });

  const replyMut = useMutation({
    mutationFn: () => mutate('POST', `/admin/support/tickets/${activeTicketId}/messages`, { body: replyBody.trim() }),
    onSuccess: () => {
      setReplyBody('');
      qc.invalidateQueries({ queryKey: ['admin-ticket-detail', activeTicketId] });
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => mutate('PATCH', `/admin/support/tickets/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      if (activeTicketId) qc.invalidateQueries({ queryKey: ['admin-ticket-detail', activeTicketId] });
    },
  });

  const createArt = useMutation({
    mutationFn: () => {
      const slug = artTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return mutate('POST', '/admin/help/articles', { title: artTitle.trim(), slug, category: artCat.trim(), bodyMd: artBody.trim(), published: true });
    },
    onSuccess: () => {
      setArtTitle('');
      setArtBody('');
      qc.invalidateQueries({ queryKey: ['admin-help-articles'] });
    },
  });

  const delArt = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/admin/help/articles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-help-articles'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">12 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Tiket Support & Artikel Bantuan</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={subTab === 'tickets' ? 'primary' : 'ghost'} onClick={() => setSubTab('tickets')}>Tiket ({ticketsQ.data?.length ?? 0})</Button>
          <Button size="sm" variant={subTab === 'articles' ? 'primary' : 'ghost'} onClick={() => setSubTab('articles')}>Help CMS</Button>
        </div>
      </div>

      {subTab === 'tickets' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-3">Subjek</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(ticketsQ.data ?? []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-medium text-text">{t.subject}</td>
                    <td className="px-4 py-3 font-mono text-muted">{t.userEmail || t.userId?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <Pill ok={t.status === 'RESOLVED' || t.status === 'CLOSED' ? true : null}>{t.status}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setActiveTicketId(t.id)}>Balas / Kelola</Button>
                    </td>
                  </tr>
                ))}
                {(ticketsQ.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Belum ada tiket masuk.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {subTab === 'articles' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text">Tambah Artikel Bantuan</h2>
            <div className="flex gap-2">
              <Input placeholder="Judul artikel..." value={artTitle} onChange={(e) => setArtTitle(e.target.value)} className="flex-1 h-9 text-xs" />
              <Input placeholder="Kategori" value={artCat} onChange={(e) => setArtCat(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
            <Textarea rows={4} placeholder="Isi panduan (Markdown)..." value={artBody} onChange={(e) => setArtBody(e.target.value)} className="text-xs" />
            <Button size="sm" disabled={!artTitle.trim() || !artBody.trim() || createArt.isPending} onClick={() => createArt.mutate()}>+ Terbitkan Artikel</Button>
          </Card>

          <div className="space-y-2">
            {(articlesQ.data ?? []).map((a: any) => (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-text">{a.title}</p>
                  <p className="text-muted">{a.category} · {a.slug}</p>
                </div>
                <Button size="sm" variant="danger" onClick={() => delArt.mutate(a.id)}>Hapus</Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!activeTicketId} onClose={() => setActiveTicketId(null)} title={ticketDetailQ.data?.subject ?? 'Detail Tiket'}>
        {ticketDetailQ.data && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Ubah status:</span>
              <Select
                value={ticketDetailQ.data.status}
                onChange={(e) => updateStatus.mutate({ id: activeTicketId!, status: e.target.value })}
                className="w-40 h-8 text-xs"
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {(ticketDetailQ.data.messages ?? []).map((m: any) => (
                <div key={m.id} className="rounded-lg border border-line bg-surface-2/40 p-2.5">
                  <p className="text-[10px] font-mono text-muted">{m.senderRole || 'USER'} · {new Date(m.createdAt).toLocaleString('id-ID')}</p>
                  <p className="text-text mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!replyBody.trim()) return;
                replyMut.mutate();
              }}
              className="flex gap-2 pt-2 border-t border-line"
            >
              <Input placeholder="Balasan admin..." value={replyBody} onChange={(e) => setReplyBody(e.target.value)} className="flex-1 h-9 text-xs" />
              <Button type="submit" size="sm" disabled={replyMut.isPending || !replyBody.trim()}>Kirim</Button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 05. Voice & TTS Center (Fixed audioRef Stop/Pause preventing overlapping tracks) */
export function AdminVoicesView() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [newVoice, setNewVoice] = useState({ provider: 'cadangan', providerVoiceId: '', name: '', language: 'id-ID', gender: 'female' });

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  useEffect(() => () => stopAudio(), []);

  const playUrl = (id: string, url: string) => {
    if (playingId === id) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(toMediaUrl(url));
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingId(null);
      }
    };
    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingId(null);
      }
    };
    audio.play().catch(() => stopAudio());
  };

  const providers = useQuery({
    queryKey: ['admin-voice-providers'],
    queryFn: () => get<unknown>('/admin/voice-providers').then((r) => toArr(r)).catch(() => []),
  });

  const voices = useQuery({
    queryKey: ['admin-voices'],
    queryFn: () => get<unknown>('/admin/voices').then((r) => toArr(r)).catch(() => []),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-voice-providers'] });
    qc.invalidateQueries({ queryKey: ['admin-voices'] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">05 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Provider & Suara TTS</h1>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>+ Tambah Suara</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(providers.data ?? []).map((p: any) => (
          <Card key={p.provider} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-sm text-text">{p.displayName || p.provider}</span>
              <Pill ok={p.isEnabled}>{p.isEnabled ? 'AKTIF' : 'OFF'}</Pill>
            </div>
            <p className="text-xs font-mono text-muted">Status: {p.status}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await mutate('PATCH', `/admin/voice-providers/${p.provider}`, { isEnabled: !p.isEnabled });
                refresh();
              }}
            >
              {p.isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-3">Nama Suara</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(voices.data ?? []).map((v: any) => (
                <tr key={v.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3 font-medium text-text">{v.name}</td>
                  <td className="px-4 py-3 font-mono text-muted">{v.provider} · {v.language}</td>
                  <td className="px-4 py-3"><Pill ok={v.status === 'PUBLISHED'}>{v.status}</Pill></td>
                  <td className="px-4 py-3 text-right space-x-1.5">
                    {v.sampleUrl && (
                      <Button size="sm" variant="ghost" onClick={() => playUrl(v.id, v.sampleUrl)}>
                        {playingId === v.id ? '■ Stop' : '▶ Putar'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingId === v.id}
                      onClick={async () => {
                        setTestingId(v.id);
                        try {
                          const res = await mutate<{ audioUrl: string }>('POST', `/admin/voices/${v.id}/test`, {});
                          if (res?.audioUrl) playUrl(v.id, res.audioUrl);
                          refresh();
                        } catch (e) {
                          alert(errMsg(e));
                        } finally {
                          setTestingId(null);
                        }
                      }}
                    >
                      {testingId === v.id ? 'Sintesis…' : 'Test'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await mutate('POST', `/admin/voices/${v.id}/${v.status === 'PUBLISHED' ? 'disable' : 'publish'}`, {});
                        refresh();
                      }}
                    >
                      {v.status === 'PUBLISHED' ? 'Nonaktifkan' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (!confirm(`Hapus suara "${v.name}"?`)) return;
                        await mutate('DELETE', `/admin/voices/${v.id}`);
                        refresh();
                      }}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Profil Suara Baru">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const slug = newVoice.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            await mutate('POST', '/admin/voices', {
              provider: newVoice.provider,
              providerVoiceId: newVoice.providerVoiceId,
              slug,
              name: newVoice.name,
              language: newVoice.language,
              voiceAttributes: { gender: newVoice.gender },
            });
            setModalOpen(false);
            setNewVoice({ provider: 'cadangan', providerVoiceId: '', name: '', language: 'id-ID', gender: 'female' });
            refresh();
          }}
          className="space-y-3 text-xs"
        >
          <Select value={newVoice.provider} onChange={(e) => setNewVoice({ ...newVoice, provider: e.target.value })}>
            <option value="cadangan">VoiceStudio (cadangan)</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="gemini">Gemini TTS</option>
          </Select>
          <Input placeholder="Nama Tampilan" required value={newVoice.name} onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })} />
          <Input placeholder="Provider Voice ID (mis. kokoro-af-heart)" required value={newVoice.providerVoiceId} onChange={(e) => setNewVoice({ ...newVoice, providerVoiceId: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Bahasa (id-ID / en-US)" value={newVoice.language} onChange={(e) => setNewVoice({ ...newVoice, language: e.target.value })} />
            <Select value={newVoice.gender} onChange={(e) => setNewVoice({ ...newVoice, gender: e.target.value })}>
              <option value="female">Wanita</option>
              <option value="male">Pria</option>
            </Select>
          </div>
          <Button type="submit" size="sm" className="w-full">Simpan Suara</Button>
        </form>
      </Modal>
    </div>
  );
}
