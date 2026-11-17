import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, invoke } from '../bridge';
import { Button, Card, Pill, errMsg } from '../components/UI';
import type { Dash, NavTab, OfflineStatus, SessionUser } from '../types';

interface BerandaViewProps {
  user: SessionUser;
  dash?: Dash;
  offline?: OfflineStatus;
  onNavigate: (tab: NavTab) => void;
}

export function BerandaView({ user, dash, offline, onNavigate }: BerandaViewProps) {
  const qc = useQueryClient();

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

  const greet = () => {
    const h = new Date().getHours();
    return h < 11 ? 'SELAMAT PAGI' : h < 15 ? 'SELAMAT SIANG' : h < 18 ? 'SELAMAT SORE' : 'SELAMAT MALAM';
  };

  const s = dash?.stats;
  const isSuperadmin = user.role === 'SUPERADMIN';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Greeting Hero Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-surface to-surface-2/70 p-6 shadow-xs">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {greet()}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-text">
            Apa yang mau dibuat hari ini?
          </h1>
          <p className="text-sm text-muted max-w-xl">
            Tim agent siap riset, menulis, merender naskah motion graphic, dan menyiapkan paket caption media sosial untuk Anda.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => onNavigate('buat-konten')}
          className="shadow-md font-semibold text-sm"
        >
          ＋ Buat konten baru
        </Button>
      </div>

      {/* Showcase Visual Gallery Banner */}
      <Card className="relative overflow-hidden p-6 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-2">
              <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                Baru
              </span>
              <h2 className="font-display text-xl font-medium text-text">
                Katalog gaya visual siap pakai
              </h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted max-w-2xl">
              Dari papan tulis sampai hologram 3D, cukup pilih satu dan tim agent menyesuaikannya ke format Reels/TikTok 9:16 berbahasa Indonesia.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => onNavigate('galeri-gaya')}
            className="text-xs sm:text-sm"
          >
            Jelajahi galeri →
          </Button>
        </div>

        {/* Mini Preview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
          {[
            { label: '3D Hologram', color: 'from-blue-600/20 to-purple-600/20' },
            { label: 'Infografis Data', color: 'from-amber-600/20 to-red-600/20' },
            { label: 'Gambar Tangan', color: 'from-emerald-600/20 to-teal-600/20' },
            { label: 'Film Bukti', color: 'from-zinc-600/20 to-neutral-800/20' },
            { label: 'Cetak Vintage', color: 'from-yellow-700/20 to-stone-600/20' },
            { label: 'Sinematik 3D', color: 'from-cyan-600/20 to-blue-700/20' },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate('galeri-gaya')}
              className={clsx(
                'group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-line bg-gradient-to-br p-2.5 flex flex-col justify-end transition hover:scale-102 hover:border-accent',
                item.color
              )}
            >
              <span className="text-[11px] font-semibold text-text group-hover:text-accent transition-colors">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Siap diunggah', value: s?.readyToUpload, tab: 'hasil' as NavTab, color: 'text-text' },
          { label: 'Sedang diproduksi', value: s?.inProduction, tab: 'progress' as NavTab, color: 'text-blue-500' },
          { label: 'Sudah diunggah', value: s?.uploaded, tab: 'hasil' as NavTab, color: 'text-ok' },
          { label: 'Gagal', value: s?.failed, tab: 'hasil' as NavTab, color: 'text-bad' },
        ].map((item) => (
          <Card
            key={item.label}
            onClick={() => onNavigate(item.tab)}
            className="cursor-pointer hover:border-text/30 p-4 sm:p-5"
          >
            <p className="text-xs sm:text-sm text-muted">{item.label}</p>
            <p className={clsx('num mt-2 sm:mt-3 text-3xl font-medium', item.color)}>
              {item.value ?? 0}
            </p>
          </Card>
        ))}
      </div>

      {/* Two Lower Cards: Video Siap Upload & Mulai Cepat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-text">
                Siap diunggah
              </h2>
              <button
                onClick={() => onNavigate('hasil')}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Lihat semua
              </button>
            </div>
            <p className="text-xs text-muted mt-1">
              Video terbaru yang lolos quality control otomatis.
            </p>
          </div>
          <div className="my-6 grid place-items-center text-center py-4">
            <span className="text-3xl mb-2 opacity-60">🎬</span>
            <p className="text-sm font-medium text-text">Belum ada video siap upload</p>
            <p className="text-xs text-muted mt-1">Mulai produksi naskah pertama Anda sekarang.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('buat-konten')} className="w-full text-xs">
            + Pesan Konten Sekarang
          </Button>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-text">
              Mulai cepat
            </h2>
            <p className="text-xs text-muted mt-1">
              Pintasan alur kerja produksi studio.
            </p>
          </div>
          <div className="space-y-2.5 my-4">
            <div
              onClick={() => onNavigate('buat-konten')}
              className="group flex items-center justify-between rounded-xl border border-line bg-surface-2/40 p-3 hover:bg-surface-2 transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-text group-hover:text-accent">
                  Pesan konten
                </p>
                <p className="text-xs text-muted">Atur jumlah, topik, suara narator & gaya visual</p>
              </div>
              <span className="text-muted group-hover:text-accent text-sm">→</span>
            </div>

            <div
              onClick={() => onNavigate('render-lokal')}
              className="group flex items-center justify-between rounded-xl border border-line bg-surface-2/40 p-3 hover:bg-surface-2 transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-text group-hover:text-accent">
                  Render lokal komputer
                </p>
                <p className="text-xs text-muted">Gunakan GPU & Chrome komputer Anda sendiri</p>
              </div>
              <span className="text-muted group-hover:text-accent text-sm">→</span>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Status lisensi: <span className="font-semibold text-text">{dash?.license.status ?? 'ACTIVE'}</span>
          </p>
        </Card>
      </div>

      {/* Hardware & Perangkat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Lisensi */}
        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-text">
            Lisensi perangkat ini
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            Server: <Pill ok={dash?.license.status === 'ACTIVE'}>{dash?.license.status ?? 'ACTIVE'}</Pill>
            Offline:{' '}
            <Pill ok={offline?.valid}>
              {offline?.valid ? `aktif s/d ${new Date(offline.until!).toLocaleDateString('id-ID')}` : 'belum diaktifkan'}
            </Pill>
          </div>
          <Button
            className="mt-4"
            disabled={activate.isPending}
            onClick={() => activate.mutate()}
          >
            {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan perangkat ini'}
          </Button>
          {activate.isError && (
            <p role="alert" className="mt-2 text-xs text-bad">
              {errMsg(activate.error)}
            </p>
          )}
          {activate.isSuccess && (
            <p className="mt-2 text-xs text-ok">
              Perangkat teraktivasi. Bukti offline berlaku sampai {new Date(activate.data.offlineUntil).toLocaleDateString('id-ID')}.
            </p>
          )}
        </Card>

        {/* Card Claude Code */}
        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-text">
            Claude Code (lokal)
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {detect.isLoading ? (
              <Pill>Mendeteksi…</Pill>
            ) : detect.data?.installed ? (
              <Pill ok>Terpasang v{detect.data.version}</Pill>
            ) : (
              <Pill ok={false}>Tidak ditemukan</Pill>
            )}
            <span className="text-xs text-muted">· server AI</span>
            <Pill ok={dash?.ai.status === 'CONNECTED'}>{dash?.ai.status ?? 'CONNECTED'}</Pill>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => detect.refetch()} className="text-xs">
              Deteksi ulang
            </Button>
            <Button
              disabled={!detect.data?.installed || testClaude.isPending}
              onClick={() => testClaude.mutate()}
              className="text-xs"
            >
              {testClaude.isPending ? 'Menunggu jawaban…' : 'Tes respon AI'}
            </Button>
          </div>
          {testClaude.data && (
            <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3 text-xs">
              {testClaude.data.ok ? (
                <p className="text-text">
                  {testClaude.data.answer}{' '}
                  <span className="num text-[10px] text-muted">({testClaude.data.latencyMs} ms)</span>
                </p>
              ) : (
                <p className="text-bad">{testClaude.data.error}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
