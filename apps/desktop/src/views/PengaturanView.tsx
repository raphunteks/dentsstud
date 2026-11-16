import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { invoke } from '../bridge';
import { Button, Card, Pill, errMsg } from '../components/UI';
import type { Dash, OfflineStatus, SessionUser } from '../types';

interface PengaturanViewProps {
  user: SessionUser;
  dash?: Dash;
  offline?: OfflineStatus;
}

export function PengaturanView({ user, dash, offline }: PengaturanViewProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'license' | 'claude' | 'profile'>('license');

  const activate = useMutation({
    mutationFn: () => invoke<{ offlineUntil: string }>('license:activate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['offline'] });
    },
  });

  const detect = useQuery({
    queryKey: ['claude-detect'],
    queryFn: () => invoke<{ installed: boolean; version?: string; path?: string }>('claude:detect'),
  });

  const testClaude = useMutation({
    mutationFn: () =>
      invoke<{ ok: boolean; answer?: string; error?: string; latencyMs?: number }>('claude:test', {
        prompt: 'Jawab singkat dalam bahasa Indonesia: apa ibu kota Indonesia?',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-text">
          Pengaturan Studio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kelola lisensi perangkat, koneksi AI Claude Code, dan profil akun Anda.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-2">
        {[
          { id: 'license', label: 'Lisensi & Perangkat' },
          { id: 'claude', label: 'Claude AI & CLI' },
          { id: 'profile', label: 'Profil Akun' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === t.id
                ? 'bg-surface-2 text-text shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'license' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Status Lisensi Komputer Ini
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Status Lisensi Server</span>
                <Pill ok={dash?.license.status === 'ACTIVE'}>{dash?.license.status ?? 'ACTIVE'}</Pill>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Aktivasi Offline</span>
                <Pill ok={offline?.valid}>
                  {offline?.valid
                    ? `Aktif sampai ${new Date(offline.until!).toLocaleString('id-ID')}`
                    : 'Belum diaktifkan di komputer ini'}
                </Pill>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Maksimum Perangkat</span>
                <span className="font-mono font-medium text-text">{dash?.license.activeDevices ?? 1} / 10 perangkat</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Worker Paralel</span>
                <span className="font-mono font-medium text-text">Maks 4 worker simultan</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                disabled={activate.isPending}
                onClick={() => activate.mutate()}
                className="w-full sm:w-auto"
              >
                {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan Perangkat Ini'}
              </Button>
              {activate.isError && (
                <p role="alert" className="mt-2 text-xs text-bad">
                  {errMsg(activate.error)}
                </p>
              )}
              {activate.isSuccess && (
                <p className="mt-2 text-xs text-ok">
                  ✓ Komputer berhasil diaktivasi secara offline s/d{' '}
                  {new Date(activate.data.offlineUntil).toLocaleString('id-ID')}.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'claude' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Koneksi Claude Code (Lokal)
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              DENTSWEB STUDIO dapat memanfaatkan Claude Code CLI resmi yang terpasang di perangkat Anda untuk eksekusi agent lokal.
            </p>
            <div className="space-y-3 text-sm pt-2">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Deteksi Claude CLI</span>
                {detect.isLoading ? (
                  <Pill>Mendeteksi…</Pill>
                ) : detect.data?.installed ? (
                  <Pill ok>Terpasang v{detect.data.version}</Pill>
                ) : (
                  <Pill ok={false}>Tidak ditemukan</Pill>
                )}
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Koneksi Server AI</span>
                <Pill ok={dash?.ai.status === 'CONNECTED'}>{dash?.ai.status ?? 'CONNECTED'}</Pill>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => detect.refetch()} size="sm">
                Deteksi Ulang CLI
              </Button>
              <Button
                disabled={!detect.data?.installed || testClaude.isPending}
                onClick={() => testClaude.mutate()}
                size="sm"
              >
                {testClaude.isPending ? 'Menunggu jawaban…' : 'Uji Respon Claude'}
              </Button>
            </div>

            {testClaude.data && (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
                {testClaude.data.ok ? (
                  <p className="text-text">
                    {testClaude.data.answer}{' '}
                    <span className="num text-muted">({testClaude.data.latencyMs} ms)</span>
                  </p>
                ) : (
                  <p className="text-bad">{testClaude.data.error}</p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Informasi Pengguna
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Nama Lengkap</span>
                <span className="font-medium text-text">{user.displayName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Email Terdaftar</span>
                <span className="font-mono text-text">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Peran (Role)</span>
                <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                  {user.role}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
