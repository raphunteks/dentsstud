'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, fmtDate } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Table, Tabs } from '@/components/ui/extra';

interface OfficeMember {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  presence: 'PRODUCING' | 'ONLINE' | 'IDLE' | 'OFFLINE';
  room: 'RENDER_ROOM' | 'WORKSPACE' | 'MEETING' | 'LOUNGE';
  activity: string;
  stage?: string | null;
  progress?: number | null;
  platform?: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
}

interface OfficePresence {
  members: OfficeMember[];
  summary: { total: number; producing: number; online: number; idle: number; offline: number };
  recentEvents: { id: string; actorEmail: string; action: string; createdAt: string }[];
  serverTime: string;
}

const ROOM_SLOTS: Record<OfficeMember['room'], { x: number; y: number }[]> = {
  WORKSPACE: [
    { x: 110, y: 120 },
    { x: 190, y: 145 },
    { x: 270, y: 120 },
    { x: 150, y: 195 },
    { x: 240, y: 195 },
  ],
  RENDER_ROOM: [
    { x: 510, y: 120 },
    { x: 590, y: 145 },
    { x: 670, y: 120 },
    { x: 550, y: 195 },
    { x: 640, y: 195 },
  ],
  MEETING: [
    { x: 130, y: 340 },
    { x: 215, y: 365 },
    { x: 295, y: 340 },
    { x: 175, y: 410 },
  ],
  LOUNGE: [
    { x: 515, y: 345 },
    { x: 600, y: 365 },
    { x: 680, y: 345 },
    { x: 560, y: 410 },
    { x: 645, y: 410 },
  ],
};

const PRESENCE_COLOR: Record<OfficeMember['presence'], string> = {
  PRODUCING: '#f59e0b',
  ONLINE: '#10b981',
  IDLE: '#6366f1',
  OFFLINE: '#78716c',
};

const RBAC_MATRIX: { code: string; module: string; member: string; superadmin: string; notes: string }[] = [
  { code: 'M1', module: 'Beranda & Ringkasan Kuota', member: 'Akses Penuh (Milik Sendiri)', superadmin: 'Akses Penuh + Portal Switcher', notes: 'Statistik & antrean produksi aktif' },
  { code: 'M2', module: 'Buat Konten, Progress & Hasil', member: 'Akses Penuh (Milik Sendiri)', superadmin: 'Akses Penuh + Moderasi Global', notes: 'Revoice, Rerender, Trash Restore' },
  { code: 'M3', module: 'Galeri Gaya, Suara AI & Motion Editor', member: 'Akses Penuh', superadmin: 'Akses Penuh + CMS Publikasi', notes: 'Preset, VoiceStudio, Pitch & Kamus' },
  { code: 'M4', module: 'Pengaturan (AI, Brand, Lisensi, Jadwal, Update)', member: 'Akses Penuh (Milik Sendiri)', superadmin: 'Akses Penuh + Konfigurasi Global', notes: 'Multi-Provider AI Auto-Fallback' },
  { code: '01', module: 'Control Center / Global Dashboard', member: 'Ditolak (403)', superadmin: 'Akses Penuh', notes: 'KPI global, metrik DB/Redis/RSS' },
  { code: '02', module: 'Member & Akses (CRUD + Reset Password)', member: 'Ditolak (403)', superadmin: 'Akses Penuh', notes: 'Registrasi, Edit, Suspend, Force Logout' },
  { code: '03', module: 'Lisensi & Perangkat Global', member: 'Lisensi Sendiri Saja', superadmin: 'Akses Penuh Global', notes: 'Grant, Quick Extend, Revoke Device' },
  { code: '04', module: 'Content Library & Bulk Import Folder', member: 'Baca Katalog Published', superadmin: 'Akses Penuh CRUD & Import', notes: 'Preset visual, kategori, hook' },
  { code: '05', module: 'Voice & TTS Center', member: 'Pakai Suara Published', superadmin: 'Akses Penuh CMS & Provider', notes: 'VoiceStudio Kokoro, Gemini, ElevenLabs' },
  { code: '06', module: 'AI Provider & OAuth Client Config', member: 'Koneksi Sendiri Saja', superadmin: 'Akses Penuh + OAuth Client Global', notes: '5 Provider + 9Router + Auto-Fallback' },
  { code: '07', module: 'Agent Workflow & Skills Library', member: 'Ditolak (403)', superadmin: 'Akses Penuh', notes: 'Edit prompt, upload ZIP/Folder skill' },
  { code: '08', module: 'Antrean Produksi Global', member: 'Milik Sendiri Saja', superadmin: 'Akses Penuh (Cancel/Retry/Log)', notes: 'Monitoring 6 tahap pipeline' },
  { code: '09', module: 'Hasil & Media Global', member: 'Milik Sendiri Saja', superadmin: 'Akses Penuh Moderasi', notes: 'Preview, Unduh, Hapus lintas member' },
  { code: '10', module: 'Kuota & Scheduler', member: 'Jadwal Sendiri Saja', superadmin: 'Akses Penuh + Trigger Tick', notes: 'Pantau kuota harian & worker' },
  { code: '11', module: 'Desktop & Rilis (.dmg / .exe)', member: 'Unduh Installer Terbaru', superadmin: 'Unggah, Publikasi & Tarik Rilis', notes: 'Auto-update YAML & checksum' },
  { code: '12', module: 'Support & Help CMS', member: 'Buat Tiket & Baca FAQ', superadmin: 'Balas Tiket & CRUD Artikel', notes: 'Notifikasi balasan real-time' },
  { code: '13', module: 'Analitik & Error Reports', member: 'Ditolak (403)', superadmin: 'Akses Penuh + Resolve-All', notes: 'Telemetry web, desktop, API' },
  { code: '14', module: 'Sistem, VPS, Worker & Audit Log', member: 'Ditolak (403)', superadmin: 'Akses Penuh', notes: 'Settings, Flags, Workers, Incidents' },
  { code: '15', module: 'Kantor Live & Matriks RBAC', member: 'Ditolak (403)', superadmin: 'Akses Penuh', notes: 'Kehadiran real-time DB & audit RBAC' },
];

export default function AdminOfficePage() {
  const [tab, setTab] = useState<'office' | 'rbac'>('office');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-office-presence'],
    queryFn: () => api<OfficePresence>('/admin/office/presence'),
    refetchInterval: 10_000,
    enabled: tab === 'office',
  });

  const data = q.data;
  const selected = data?.members.find((m) => m.id === selectedId) ?? data?.members[0] ?? null;

  const placedMembers = (() => {
    if (!data) return [];
    const counters: Record<OfficeMember['room'], number> = { WORKSPACE: 0, RENDER_ROOM: 0, MEETING: 0, LOUNGE: 0 };
    return data.members.map((m) => {
      const slots = ROOM_SLOTS[m.room];
      const idx = counters[m.room]++;
      const slot = slots[idx % slots.length]!;
      const offsetX = Math.floor(idx / slots.length) * 28;
      return { ...m, x: slot.x + offsetX, y: slot.y };
    });
  })();

  return (
    <div className="grid gap-5">
      <PageHead
        eyebrow="15 · Superadmin"
        title="Kantor Live & Matriks RBAC"
        actions={
          data && (
            <span className="font-mono text-xs text-muted">
              Sinkron otomatis 10 dtk · {fmtDate(data.serverTime)}
            </span>
          )
        }
      />

      <Tabs
        label="Mode tampilan"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'office', label: 'Kantor Live' },
          { value: 'rbac', label: 'Matriks RBAC' },
        ]}
      />

      {tab === 'office' && (
        <>
          {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
          {q.isLoading && <Skeleton className="h-[460px] rounded-card" />}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Card className="p-4"><p className="text-xs text-muted">Total Tim</p><p className="num mt-1 text-2xl font-semibold">{data.summary.total}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted">Sedang Produksi</p><p className="num mt-1 text-2xl font-semibold text-warn">{data.summary.producing}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted">Online Aktif</p><p className="num mt-1 text-2xl font-semibold text-ok">{data.summary.online}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted">Idle / Lounge</p><p className="num mt-1 text-2xl font-semibold">{data.summary.idle}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted">Offline</p><p className="num mt-1 text-2xl font-semibold text-muted">{data.summary.offline}</p></Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] items-start">
                {/* Isometric Pure SVG Pixel-Art Office */}
                <Card className="overflow-hidden p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-text">Denah Studio DENTSWEB (Real-Time DB Presence)</span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Produksi</span>
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Online</span>
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-indigo-500" /> Idle</span>
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-stone-500" /> Offline</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 800 480" className="w-full rounded-xl border border-line bg-surface-2/60">
                    {/* Floor Grid */}
                    <defs>
                      <pattern id="office-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="800" height="480" fill="url(#office-grid)" />

                    {/* 4 Rooms */}
                    <g>
                      <rect x="20" y="20" width="370" height="210" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
                      <text x="36" y="46" fontSize="12" fontWeight="600" fill="var(--text)">RUANG KERJA (WORKSPACE)</text>
                      <rect x="60" y="75" width="76" height="22" rx="4" fill="var(--surface-2)" stroke="var(--line)" />
                      <rect x="220" y="75" width="76" height="22" rx="4" fill="var(--surface-2)" stroke="var(--line)" />

                      <rect x="410" y="20" width="370" height="210" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
                      <text x="426" y="46" fontSize="12" fontWeight="600" fill="var(--text)">RUANG RENDER &amp; SERVER</text>
                      <rect x="455" y="64" width="34" height="46" rx="4" fill="#1c1917" stroke="var(--line)" />
                      <circle cx="472" cy="78" r="3" fill="#10b981" />
                      <circle cx="472" cy="90" r="3" fill="#f59e0b" />
                      <rect x="498" y="64" width="34" height="46" rx="4" fill="#1c1917" stroke="var(--line)" />
                      <circle cx="515" cy="78" r="3" fill="#10b981" />

                      <rect x="20" y="250" width="370" height="210" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
                      <text x="36" y="276" fontSize="12" fontWeight="600" fill="var(--text)">RUANG MEETING (SUPERADMIN)</text>
                      <ellipse cx="205" cy="360" rx="70" ry="32" fill="var(--surface-2)" stroke="var(--line)" />

                      <rect x="410" y="250" width="370" height="210" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
                      <text x="426" y="276" fontSize="12" fontWeight="600" fill="var(--text)">LOUNGE ISTIRAHAT</text>
                      <rect x="460" y="300" width="110" height="24" rx="8" fill="var(--surface-2)" stroke="var(--line)" />
                    </g>

                    {/* Real DB Member Avatars */}
                    {placedMembers.map((m) => {
                      const col = PRESENCE_COLOR[m.presence];
                      const isSel = selected?.id === m.id;
                      const initials = m.displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';
                      return (
                        <g
                          key={m.id}
                          transform={`translate(${m.x}, ${m.y})`}
                          onClick={() => setSelectedId(m.id)}
                          className="cursor-pointer"
                        >
                          {m.presence === 'PRODUCING' && (
                            <circle r="24" fill={col} opacity="0.2">
                              <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite" />
                            </circle>
                          )}
                          <circle r="18" fill={col} stroke={isSel ? 'var(--text)' : 'var(--surface)'} strokeWidth={isSel ? 3 : 2} />
                          <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">{initials}</text>
                          <text y="32" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text)">
                            {m.displayName.slice(0, 14)}
                          </text>
                          {m.presence !== 'OFFLINE' && (
                            <g transform="translate(0, -34)">
                              <rect x="-56" y="-12" width="112" height="20" rx="6" fill="var(--surface)" stroke={col} strokeWidth="1" />
                              <text y="2" textAnchor="middle" fontSize="9" fill="var(--text)">
                                {m.activity.slice(0, 20)}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </Card>

                {/* Right: Inspector + Activity Feed */}
                <div className="grid gap-4">
                  <Card className="p-5">
                    <h2 className="font-display text-base font-medium">Inspektur Anggota</h2>
                    {selected ? (
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <Link href={`/admin/members/${selected.id}`} className="text-sm font-semibold text-accent hover:underline">
                              {selected.displayName}
                            </Link>
                            <p className="text-muted">{selected.email}</p>
                          </div>
                          <Status value={selected.presence === 'ONLINE' ? 'ACTIVE' : selected.presence === 'PRODUCING' ? 'RUNNING' : 'DISABLED'} label={selected.presence} />
                        </div>
                        <p><span className="text-muted">Role:</span> <span className="font-mono">{selected.role}</span></p>
                        <p><span className="text-muted">Ruangan:</span> <span className="font-mono">{selected.room}</span></p>
                        <p><span className="text-muted">Aktivitas:</span> {selected.activity}</p>
                        <p><span className="text-muted">Sesi aktif:</span> {selected.activeSessions} {selected.platform ? `· ${selected.platform}` : ''}</p>
                        <p><span className="text-muted">Terakhir terlihat:</span> {fmtDate(selected.lastSeenAt)}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">Klik avatar di denah untuk melihat detail.</p>
                    )}
                  </Card>

                  <Card className="p-5">
                    <h2 className="font-display text-base font-medium">Aktivitas Terbaru (Audit Live)</h2>
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto font-mono text-[11px]">
                      {data.recentEvents.length === 0 && <li className="text-muted">Belum ada aktivitas tercatat.</li>}
                      {data.recentEvents.map((ev) => (
                        <li key={ev.id} className="border-b border-line/60 pb-1.5 last:border-0">
                          <span className="font-semibold text-text">{ev.action}</span>
                          <span className="text-muted"> · {ev.actorEmail}</span>
                          <span className="block text-[10px] text-muted">{fmtDate(ev.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'rbac' && (
        <Table head={['Kode', 'Modul / Fitur', 'Role MEMBER', 'Role SUPERADMIN', 'Catatan']} minWidth={820}>
          {RBAC_MATRIX.map((r) => (
            <tr key={r.code}>
              <td className="font-mono text-xs font-semibold text-accent">{r.code}</td>
              <td className="font-medium">{r.module}</td>
              <td className="text-xs text-muted">{r.member}</td>
              <td className="text-xs font-medium text-ok">{r.superadmin}</td>
              <td className="text-xs text-muted">{r.notes}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
