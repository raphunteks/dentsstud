import { Card } from '../components/UI';

export function BantuanView() {
  const FAQS = [
    {
      q: 'Bagaimana cara memulai produksi video pertama saya?',
      a: 'Buka menu "+ Buat Konten", atur format video (9:16 untuk Reels/TikTok), masukkan topik atau biarkan AI menentukannya, lalu pilih gaya visual dan suara narator. Klik "Mulai produksi".',
    },
    {
      q: 'Apakah video bisa dirender di komputer saya sendiri?',
      a: 'Bisa! Buka menu "Render Lokal" di bawah Engine Desktop. Komputer Anda akan memakai Google Chrome dan GPU lokal untuk merender video Remotion secara langsung tanpa membebani server.',
    },
    {
      q: 'Berapa lama proses pembuatan 1 video?',
      a: 'Rata-rata 15 sampai 25 menit, mencakup 6 tahap otomatis: riset topik, penulisan naskah, cek fakta ilmiah, sintesis suara TTS, rendering grafis Remotion, dan quality control (QC).',
    },
    {
      q: 'Bagaimana cara mengaktifkan lisensi perangkat desktop?',
      a: 'Di menu "Pengaturan" atau "Beranda", klik tombol "Aktifkan perangkat ini". Sistem akan mendaftarkan komputer Anda dan memberikan bukti lisensi offline.',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">PANDUAN & BANTUAN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Pusat Bantuan DENTSWEB STUDIO
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pertanyaan umum, panduan alur kerja, dan dokumentasi operasional platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAQS.map((item, idx) => (
          <Card key={idx} className="p-5 space-y-2">
            <h3 className="font-display text-sm font-semibold text-text">
              {item.q}
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              {item.a}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-surface-2/40 border-line">
        <h3 className="font-display text-base font-semibold text-text">
          Butuh Bantuan Langsung?
        </h3>
        <p className="text-xs text-muted mt-1">
          Hubungi tim administrator DENTSWEB STUDIO melalui email resmi:
        </p>
        <p className="mt-2 font-mono text-sm text-accent font-semibold">
          sentrovahelp@gmail.com
        </p>
      </Card>
    </div>
  );
}
