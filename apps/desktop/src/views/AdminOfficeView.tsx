import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../bridge';
import { Button, Card, Pill } from '../components/UI';
import { Icon } from '../components/Icons';

type RoomKey = 'RENDER_ROOM' | 'WORKSPACE' | 'MEETING' | 'LOUNGE';

interface OfficeMember {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  presence: 'PRODUCING' | 'ONLINE' | 'IDLE' | 'OFFLINE';
  room: string;
  activity?: string;
  activeRun?: { id?: string; stage?: string; currentStage?: string; progress?: number; topic?: string } | null;
  activeRender?: { id?: string; progress?: number } | null;
  deviceCount?: number;
  stage?: string | null;
  progress?: number | null;
  platform?: string | null;
  lastSeenAt: string | null;
  activeSessions?: number;
}

interface OfficePresenceResponse {
  members: OfficeMember[];
  summary: { total: number; producing: number; online: number; idle: number; offline: number };
  recentEvents: { id: string; actorEmail?: string | null; actorUserId?: string | null; targetType?: string | null; action: string; createdAt: string }[];
  serverTime: string;
}

function resolveRoom(room: string | undefined, presence: OfficeMember['presence']): RoomKey {
  if (room === 'RENDER_ROOM' || room === 'STUDIO') return 'RENDER_ROOM';
  if (room === 'WORKSPACE' || room === 'LOBBY') return 'WORKSPACE';
  if (room === 'MEETING' || room === 'ARCHIVE') return 'MEETING';
  if (room === 'LOUNGE') return 'LOUNGE';
  return presence === 'PRODUCING' ? 'RENDER_ROOM' : presence === 'ONLINE' ? 'WORKSPACE' : 'LOUNGE';
}

function resolveActivity(m: OfficeMember): string {
  if (m.activity) return m.activity;
  if (m.activeRun) {
    const st = m.activeRun.stage ?? m.activeRun.currentStage ?? 'PRODUCING';
    const pct = typeof m.activeRun.progress === 'number' ? ` (${m.activeRun.progress}%)` : '';
    return `Produksi: ${st}${pct}${m.activeRun.topic ? ` · ${m.activeRun.topic}` : ''}`;
  }
  if (m.activeRender) {
    return `Rendering video${typeof m.activeRender.progress === 'number' ? ` (${m.activeRender.progress}%)` : ''}`;
  }
  if (m.presence === 'ONLINE') return 'Aktif di DENTSWEB Studio';
  if (m.presence === 'IDLE') return 'Standby / Idle';
  return 'Offline';
}

const ROOM_CONFIG = {
  WORKSPACE: { label: 'Ruang Kerja', x: 60, y: 65, w: 330, h: 175, fill: '#171C2B', stroke: '#3B82F6', accent: '#60A5FA' },
  RENDER_ROOM: { label: 'Ruang Render & Server', x: 410, y: 65, w: 330, h: 175, fill: '#1A162B', stroke: '#8B5CF6', accent: '#C084FC' },
  MEETING: { label: 'Ruang Meeting', x: 60, y: 260, w: 330, h: 175, fill: '#132226', stroke: '#06B6D4', accent: '#22D3EE' },
  LOUNGE: { label: 'Lounge Istirahat', x: 410, y: 260, w: 330, h: 175, fill: '#1D1A18', stroke: '#F59E0B', accent: '#FBBF24' },
} as const;

const PRESENCE_COLOR: Record<OfficeMember['presence'], string> = {
  PRODUCING: '#D92BFF',
  ONLINE: '#10B981',
  IDLE: '#F59E0B',
  OFFLINE: '#64748B',
};

const AVATAR_PALETTE = ['#6366F1', '#0EA5E9', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6'];

const RBAC_MATRIX = [
  { group: 'Studio Member', module: 'Beranda, Buat Konten, Progress, Hasil', member: true, superadmin: true, note: 'Produksi video motion edukasi & riwayat hasil pribadi' },
  { group: 'Studio Member', module: 'Galeri Gaya & Suara (TTS)', member: true, superadmin: true, note: 'Akses katalog preset gaya & suara aktif' },
  { group: 'Desktop Engine', module: 'Render Lokal & Project Offline', member: true, superadmin: true, note: 'Render via Chrome lokal & sinkronisasi project offline' },
  { group: 'Pengaturan', module: 'Lisensi, AI Provider, Brand, Jadwal, TTS, Update & Rilis', member: true, superadmin: true, note: 'Konfigurasi pribadi, multi-provider AI, & auto-update' },
  { group: 'Desktop Engine', module: 'Import Folder Konten (Bulk Asset)', member: false, superadmin: true, note: 'Khusus Superadmin untuk impor katalog massal' },
  { group: '01 Superadmin', module: '01 Control Center', member: false, superadmin: true, note: 'Ringkasan kesehatan platform & KPI global' },
  { group: '02 Superadmin', module: '02 Member & Akses', member: false, superadmin: true, note: 'Registrasi member, reset password, edit role, paksa logout, lisensi' },
  { group: '03 Superadmin', module: '03 Lisensi & Device', member: false, superadmin: true, note: 'Grant/revoke lisensi & perangkat aktif global' },
  { group: '04–05 Superadmin', module: '04 Content Library & 05 Voice / TTS', member: false, superadmin: true, note: 'Manajemen preset, kategori, hook, & suara VoiceStudio' },
  { group: '06–07 Superadmin', module: '06 AI Provider & 07 Workflow / Skills Library', member: false, superadmin: true, note: 'OAuth Client config, prompt agent, upload ZIP/Folder skills' },
  { group: '08–10 Superadmin', module: '08 Produksi & Render, 09 Hasil Global, 10 Kuota', member: false, superadmin: true, note: 'Antrean global, inspeksi hasil semua member, limit harian' },
  { group: '11–12 Superadmin', module: '11 Rilis Desktop & 12 Support / Help', member: false, superadmin: true, note: 'Publikasi installer .dmg/.exe & tiket bantuan member' },
  { group: '13–14 Superadmin', module: '13 Analitik & Error, 14 Sistem & VPS', member: false, superadmin: true, note: 'Telemetri error, resolve massal, feature flags, audit log' },
  { group: '15 Superadmin', module: '15 Kantor & RBAC', member: false, superadmin: true, note: 'Monitoring kehadiran live isometric studio & matriks hak akses' },
];

export function AdminOfficeView() {
  const [subTab, setSubTab] = useState<'office' | 'rbac'>('office');
  const [selected, setSelected] = useState<OfficeMember | null>(null);

  const presenceQ = useQuery({
    queryKey: ['admin-office-presence'],
    queryFn: () => get<OfficePresenceResponse>('/admin/office/presence'),
    refetchInterval: 10_000,
  });

  const data = presenceQ.data;
  const members = data?.members ?? [];
  const summary = data?.summary ?? { total: members.length, producing: 0, online: 0, idle: 0, offline: 0 };
  const recentEvents = data?.recentEvents ?? [];

  // Group members by room to compute crisp non-overlapping grid positions
  const byRoom: Record<RoomKey, OfficeMember[]> = {
    WORKSPACE: [],
    RENDER_ROOM: [],
    MEETING: [],
    LOUNGE: [],
  };
  for (const m of members) {
    byRoom[resolveRoom(m.room, m.presence)].push(m);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">15 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Kantor Live & Matriks RBAC</h1>
          <p className="mt-1 text-sm text-muted">Pantau aktivitas real-time seluruh member & produksi di studio isometric serta audit hak akses RBAC.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={subTab === 'office' ? 'primary' : 'ghost'} onClick={() => setSubTab('office')}>
            <Icon name="monitor" className="w-3.5 h-3.5 mr-1.5 inline" />
            Kantor Live ({summary.total})
          </Button>
          <Button size="sm" variant={subTab === 'rbac' ? 'primary' : 'ghost'} onClick={() => setSubTab('rbac')}>
            <Icon name="key" className="w-3.5 h-3.5 mr-1.5 inline" />
            Matriks RBAC
          </Button>
          {subTab === 'office' && (
            <Button size="sm" variant="outline" onClick={() => void presenceQ.refetch()}>
              Segarkan
            </Button>
          )}
        </div>
      </div>

      {subTab === 'office' && (
        <div className="space-y-4">
          {/* KPI Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="p-3.5">
              <p className="text-[11px] font-mono uppercase text-muted">Total Tim</p>
              <p className="num text-xl font-semibold text-text mt-0.5">{summary.total}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] font-mono uppercase text-muted">Producing</p>
              <p className="num text-xl font-semibold text-accent mt-0.5">{summary.producing}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] font-mono uppercase text-muted">Online</p>
              <p className="num text-xl font-semibold text-ok mt-0.5">{summary.online}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] font-mono uppercase text-muted">Idle</p>
              <p className="num text-xl font-semibold text-warn mt-0.5">{summary.idle}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[11px] font-mono uppercase text-muted">Offline</p>
              <p className="num text-xl font-semibold text-muted mt-0.5">{summary.offline}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
            {/* Pure SVG + CSS Isometric Pixel-Art Office Floorplan */}
            <Card className="p-4 space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-display font-semibold text-text">Denah Studio DENTSWEB (Live 10s Poll)</span>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted">
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#D92BFF]" />Producing</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#10B981]" />Online</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#F59E0B]" />Idle</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#64748B]" />Offline</span>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-xl border border-line bg-[#0D101A]">
                <svg viewBox="0 0 800 475" className="w-full h-auto min-w-[620px] select-none" role="img" aria-label="Kantor Live DENTSWEB Studio">
                  <defs>
                    <pattern id="office-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E2538" strokeWidth="0.7" />
                    </pattern>
                  </defs>
                  <rect width="800" height="475" fill="url(#office-grid)" />

                  {/* Floor Title */}
                  <text x="60" y="38" fill="#94A3B8" fontSize="11" fontFamily="monospace" letterSpacing="2">
                    DENTSWEB STUDIO HQ · LIVE TELEMETRY FLOOR
                  </text>
                  <text x="740" y="38" textAnchor="end" fill="#64748B" fontSize="10" fontFamily="monospace">
                    {data?.serverTime ? new Date(data.serverTime).toLocaleTimeString('id-ID') : 'LIVE'}
                  </text>

                  {/* 4 Isometric-Styled Pixel Rooms */}
                  {(Object.keys(ROOM_CONFIG) as RoomKey[]).map((roomKey) => {
                    const rm = ROOM_CONFIG[roomKey];
                    const occupants = byRoom[roomKey];
                    return (
                      <g key={roomKey}>
                        {/* Room Base with subtle 3D depth edge */}
                        <rect x={rm.x} y={rm.y + 6} width={rm.w} height={rm.h} rx="12" fill="#080A12" />
                        <rect x={rm.x} y={rm.y} width={rm.w} height={rm.h} rx="12" fill={rm.fill} stroke={rm.stroke} strokeOpacity="0.45" strokeWidth="1.5" />

                        {/* Room Header Bar */}
                        <rect x={rm.x + 10} y={rm.y + 10} width={rm.w - 20} height="22" rx="6" fill="#0B0E17" fillOpacity="0.65" />
                        <circle cx={rm.x + 22} cy={rm.y + 21} r="3.5" fill={rm.accent} />
                        <text x={rm.x + 32} y={rm.y + 25} fill="#E2E8F0" fontSize="11" fontWeight="600" fontFamily="monospace">
                          {rm.label} ({occupants.length})
                        </text>

                        {/* Minimal pixel furniture accents per room */}
                        {roomKey === 'WORKSPACE' && (
                          <g opacity="0.3">
                            <rect x={rm.x + 22} y={rm.y + 138} width="64" height="18" rx="3" fill="#334155" />
                            <rect x={rm.x + 110} y={rm.y + 138} width="64" height="18" rx="3" fill="#334155" />
                            <rect x={rm.x + 198} y={rm.y + 138} width="64" height="18" rx="3" fill="#334155" />
                          </g>
                        )}
                        {roomKey === 'RENDER_ROOM' && (
                          <g opacity="0.35">
                            <rect x={rm.x + 275} y={rm.y + 44} width="34" height="114" rx="4" fill="#312E81" stroke="#8B5CF6" strokeWidth="1" />
                            <circle cx={rm.x + 292} cy={rm.y + 62} r="3" fill="#00C2FF" />
                            <circle cx={rm.x + 292} cy={rm.y + 82} r="3" fill="#D92BFF" />
                            <circle cx={rm.x + 292} cy={rm.y + 102} r="3" fill="#10B981" />
                          </g>
                        )}
                        {roomKey === 'MEETING' && (
                          <rect x={rm.x + 115} y={rm.y + 128} width="100" height="28" rx="12" fill="#164E63" opacity="0.35" />
                        )}
                        {roomKey === 'LOUNGE' && (
                          <rect x={rm.x + 225} y={rm.y + 130} width="82" height="24" rx="6" fill="#78350F" opacity="0.35" />
                        )}

                        {/* Pixel-Art Avatars inside room */}
                        {occupants.map((m, idx) => {
                          const col = idx % 4;
                          const row = Math.floor(idx / 4);
                          const ax = rm.x + 48 + col * 72;
                          const ay = rm.y + 72 + row * 62;
                          const shirt = AVATAR_PALETTE[(m.displayName.charCodeAt(0) + idx) % AVATAR_PALETTE.length]!;
                          const dotColor = PRESENCE_COLOR[m.presence];
                          const isSelected = selected?.id === m.id;
                          const initials = m.displayName.slice(0, 2).toUpperCase();

                          return (
                            <g
                              key={m.id}
                              transform={`translate(${ax}, ${ay})`}
                              onClick={() => setSelected(m)}
                              className="cursor-pointer"
                            >
                              {isSelected && (
                                <circle cx="0" cy="4" r="24" fill="none" stroke="#00C2FF" strokeWidth="2" strokeDasharray="4 3" />
                              )}
                              {/* Subtle floor shadow */}
                              <ellipse cx="0" cy="20" rx="14" ry="4.5" fill="#000000" fillOpacity="0.45" />
                              {/* Pixel body */}
                              <rect x="-10" y="2" width="20" height="16" rx="4" fill={shirt} />
                              {/* Pixel head */}
                              <rect x="-9" y="-14" width="18" height="16" rx="5" fill="#FDE68A" />
                              {/* Pixel eyes */}
                              <rect x="-5" y="-8" width="2.5" height="2.5" fill="#0F172A" />
                              <rect x="2.5" y="-8" width="2.5" height="2.5" fill="#0F172A" />
                              {/* Role badge (crown dot for superadmin) */}
                              {m.role === 'SUPERADMIN' && <rect x="-5" y="-18" width="10" height="3" rx="1" fill="#F59E0B" />}
                              {/* Live presence indicator */}
                              <circle cx="11" cy="-11" r="4.5" fill={dotColor} stroke="#0D101A" strokeWidth="1.5" />
                              {/* Name label */}
                              <text x="0" y="32" textAnchor="middle" fill="#E2E8F0" fontSize="9.5" fontFamily="monospace">
                                {m.displayName.length > 10 ? `${m.displayName.slice(0, 9)}…` : m.displayName || initials}
                              </text>
                              {/* Activity mini-bubble for PRODUCING / ONLINE */}
                              {(m.presence === 'PRODUCING' || m.presence === 'ONLINE') && (
                                <g transform="translate(0, -28)">
                                  <rect x="-32" y="-11" width="64" height="14" rx="4" fill="#0F172A" stroke={dotColor} strokeWidth="0.9" />
                                  <text x="0" y="-1" textAnchor="middle" fill="#F8FAFC" fontSize="7.5" fontFamily="monospace">
                                    {m.presence === 'PRODUCING'
                                      ? `${m.stage ?? m.activeRun?.stage ?? m.activeRun?.currentStage ?? 'RENDER'} ${m.progress ?? m.activeRun?.progress ?? m.activeRender?.progress ?? 0}%`
                                      : m.platform ?? 'ONLINE'}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Selected Member Inspector */}
              {selected && (
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-text">{selected.displayName}</span>
                      <Pill ok={selected.presence === 'ONLINE' || selected.presence === 'PRODUCING'}>{selected.presence}</Pill>
                      <span className="font-mono text-muted">{selected.role}</span>
                    </div>
                    <p className="text-muted font-mono">{selected.email}</p>
                    <p className="text-text">Aktivitas: {resolveActivity(selected)}</p>
                    <p className="text-[11px] text-muted">
                      Ruangan: {ROOM_CONFIG[resolveRoom(selected.room, selected.presence)].label} · Perangkat: {selected.deviceCount ?? selected.activeSessions ?? 0} · Terakhir terlihat:{' '}
                      {selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString('id-ID') : 'Belum tercatat'}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Tutup</Button>
                </div>
              )}
            </Card>

            {/* Right Sidebar: Recent Studio Activity Feed */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h2 className="font-display text-sm font-semibold text-text">Aktivitas Terbaru</h2>
                <span className="text-[11px] font-mono text-muted">{recentEvents.length} log</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">Belum ada aktivitas tercatat.</p>
                ) : (
                  recentEvents.map((ev) => (
                    <div key={ev.id} className="rounded-lg border border-line bg-surface-2/40 p-2.5 text-xs space-y-0.5">
                      <p className="font-mono text-[11px] font-semibold text-accent truncate">{ev.action}</p>
                      <p className="text-[11px] text-text truncate">{ev.actorEmail || ev.targetType || ev.actorUserId?.slice(0, 8) || 'system'}</p>
                      <p className="text-[10px] font-mono text-muted">{new Date(ev.createdAt).toLocaleString('id-ID')}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {subTab === 'rbac' && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-text">Matriks Hak Akses RBAC (Member vs Superadmin)</h2>
              <p className="text-xs text-muted">Pembagian akses modul Studio Member &amp; 15 Modul Superadmin pada Web &amp; Desktop.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Modul / Fitur</th>
                  <th className="px-4 py-3 text-center">Member</th>
                  <th className="px-4 py-3 text-center">Superadmin</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {RBAC_MATRIX.map((row) => (
                  <tr key={row.module} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-mono text-muted whitespace-nowrap">{row.group}</td>
                    <td className="px-4 py-3 font-medium text-text">{row.module}</td>
                    <td className="px-4 py-3 text-center">
                      <Pill ok={row.member}>{row.member ? 'Akses' : 'Terkunci'}</Pill>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Pill ok={row.superadmin}>{row.superadmin ? 'Penuh' : 'Terkunci'}</Pill>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.note}</td>
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
