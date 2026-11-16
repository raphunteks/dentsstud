/**
 * Static seed definitions. ZERO presets, ZERO voices, ZERO hooks by design (v1.1 §1.5).
 */
export const STYLE_CATEGORIES = [
  { slug: 'gaya-studio', name: 'Gaya Studio' },
  { slug: 'infografis', name: 'Infografis' },
  { slug: 'gambar-tangan', name: 'Gambar Tangan' },
  { slug: 'film-bukti', name: 'Film Bukti' },
  { slug: '3d', name: '3D' },
  { slug: 'kartun', name: 'Kartun' },
  { slug: 'grafis', name: 'Grafis' },
  { slug: 'cetak', name: 'Cetak' },
  { slug: 'dokumenter', name: 'Dokumenter' },
  { slug: 'asia-timur', name: 'Asia Timur' },
  { slug: 'gim', name: 'Gim' },
  { slug: 'sinema', name: 'Sinema' },
] as const;

export const ROLE_PERMISSIONS: Record<'SUPERADMIN' | 'MEMBER', string[]> = {
  MEMBER: [
    'content:create', 'jobs:read:own', 'presets:read:published', 'voices:read:published',
    'devices:manage:own', 'results:manage:own', 'projects:manage:own', 'settings:manage:own',
  ],
  SUPERADMIN: [
    'content:create', 'jobs:read:own', 'jobs:read:all', 'jobs:manage:all',
    'categories:manage', 'presets:manage', 'presets:publish', 'presets:read:published',
    'voices:manage', 'voices:read:published', 'hooks:manage', 'agents:manage', 'workflows:manage',
    'licenses:manage', 'members:manage', 'devices:manage:own', 'devices:read:all', 'workers:manage',
    'results:manage:own', 'results:read:all', 'projects:manage:own', 'settings:manage:own',
    'ops:metadata:read', 'releases:manage', 'system:manage', 'audit:read', 'support:manage',
  ],
};

export const AGENTS = [
  {
    code: 'research', name: 'Research Agent', stage: 'RESEARCH',
    description: 'Mengumpulkan informasi dan sumber untuk topik video.',
    systemPrompt: 'Anda adalah Research Agent DENTWEB STUDIO. Kumpulkan fakta relevan tentang topik yang diberikan, sertakan sumber yang dapat diverifikasi (URL, judul). Jangan mengarang sumber. Keluarkan JSON sesuai output schema.',
  },
  {
    code: 'scriptwriter', name: 'Scriptwriter Agent', stage: 'SCRIPT',
    description: 'Menyusun naskah narasi dan pembagian scene.',
    systemPrompt: 'Anda adalah Scriptwriter Agent. Tulis naskah video berbahasa Indonesia yang natural, terbagi per scene dengan durasi, berdasarkan laporan riset. Terapkan aturan brand bila ada. Keluarkan JSON sesuai output schema.',
  },
  {
    code: 'fact_checker', name: 'Fact Checker Agent', stage: 'FACT_CHECK',
    description: 'Memverifikasi setiap klaim naskah terhadap sumber riset.',
    systemPrompt: 'Anda adalah Fact Checker Agent. Periksa setiap klaim dalam naskah terhadap sumber riset. Tandai klaim tanpa bukti sebagai UNVERIFIED. Keluarkan JSON sesuai output schema.',
  },
  {
    code: 'motion_director', name: 'Motion Director Agent', stage: 'MOTION',
    description: 'Menerjemahkan naskah menjadi motion document Remotion.',
    systemPrompt: 'Anda adalah Motion Director Agent. Ubah naskah tervalidasi menjadi motion document (scene, layer, keyframe) yang mematuhi motion-schema dan preset gaya terpilih. Keluarkan JSON sesuai output schema.',
  },
  {
    code: 'qc', name: 'QC Agent', stage: 'QC',
    description: 'Memeriksa kualitas teknis dan konten hasil render.',
    systemPrompt: 'Anda adalah QC Agent. Evaluasi metadata render, durasi, keterbacaan teks, dan kesesuaian dengan naskah. Keluarkan daftar pemeriksaan dan status lulus/gagal dalam JSON.',
  },
  {
    code: 'social_media', name: 'Social Media Agent', stage: 'SOCIAL',
    description: 'Menyusun caption, hashtag, komentar pertama, dan cover.',
    systemPrompt: 'Anda adalah Social Media Agent. Buat caption, hashtag, komentar pertama, dan teks cover dari naskah dan sumber, mematuhi batas platform dan aturan brand. Keluarkan JSON sesuai output schema.',
  },
] as const;

export const PRODUCTION_WORKFLOW = {
  code: 'standard-production',
  name: 'Produksi Standar',
  definition: {
    stages: [
      { code: 'RESEARCH', agent: 'research', timeoutSec: 300, maxAttempts: 3 },
      { code: 'SCRIPT', agent: 'scriptwriter', timeoutSec: 300, maxAttempts: 3 },
      { code: 'FACT_CHECK', agent: 'fact_checker', timeoutSec: 300, maxAttempts: 3 },
      { code: 'MOTION', agent: 'motion_director', timeoutSec: 1800, maxAttempts: 2 },
      { code: 'QC', agent: 'qc', timeoutSec: 300, maxAttempts: 2 },
      { code: 'SOCIAL', agent: 'social_media', timeoutSec: 300, maxAttempts: 3 },
    ],
  },
} as const;

/** Real product documentation shipped with the app (not demo content). Superadmin can edit or unpublish. */
export const HELP_ARTICLES = [
  {
    slug: 'mulai-menggunakan', kind: 'GUIDE', title: 'Mulai menggunakan DENTWEB STUDIO',
    body: `1. Minta Superadmin mengaktifkan lisensi nonkomersial untuk akun Anda. Status lisensi tampil di Pengaturan → Lisensi.
2. Hubungkan Claude di Pengaturan → Claude memakai API key Anthropic milik Anda. Produksi otomatis berjalan di server dan hanya memakai API key; Claude Code lokal hanya dipakai aplikasi desktop.
3. (Opsional) Atur akun suara di Pengaturan → Akun Suara (Gemini, ElevenLabs, atau endpoint cadangan) lalu pilih narator di Studio → Suara.
4. Isi Brand & Akun: nama brand, username Instagram, pembuka, penutup dan CTA. Kolom kosong berarti AI memilih sendiri.
5. Buka Buat Konten, isi enam bagian wizard, lalu Mulai produksi. Pantau di Progress; video selesai muncul di Hasil.`,
  },
  {
    slug: 'alur-produksi-ai', kind: 'GUIDE', title: 'Cara kerja produksi multi-agent',
    body: `Setiap video melewati enam tahap: Riset (dengan web search Anthropic bila akun Anda mengizinkan), Naskah, Cek Fakta, Motion & Render, Quality Control, dan Paket Sosial.
- Cek Fakta menandai setiap klaim sebagai terverifikasi, belum terverifikasi, atau bertentangan. Klaim yang bertentangan memicu satu kali revisi naskah; bila masih bertentangan, produksi dihentikan agar tidak menerbitkan informasi keliru.
- Render memakai Remotion di worker cloud. QC memeriksa resolusi, durasi, codec dan keberadaan audio narasi.
- Paket sosial berisi caption, hashtag, komentar pertama berisi sumber, dan cover dari frame video.
Setiap tahap disimpan sebagai checkpoint. Tombol Lanjutkan meneruskan dari tahap terakhir yang berhasil; Ulang dari awal menjalankan semuanya lagi.`,
  },
  {
    slug: 'revisi-video', kind: 'GUIDE', title: 'Mengganti suara atau render ulang',
    body: `Di halaman detail hasil, pilih Ganti suara atau Render ulang. Riset, naskah dan cek fakta dipakai ulang sehingga revisi lebih cepat dan tidak memotong kuota harian. Revisi tersimpan sebagai video baru yang terhubung ke video asal.`,
  },
  {
    slug: 'format-import-katalog', kind: 'GUIDE', title: 'Format paket import katalog (Superadmin)',
    body: `Setiap paket adalah folder berisi manifest.json dan file yang dirujuknya. Manifest wajib mencantumkan schemaVersion, kind (preset, hook, atau voice), slug, nama, hak penggunaan, dan daftar file beserta SHA-256.
Import selalu menghasilkan DRAFT. Publikasikan dari Content Library setelah meninjau pratinjau dan test render. File SVG, symlink, path di luar folder, dan ZIP yang terlalu besar ditolak. Dokumentasi lengkap ada di docs/import-format di repositori.`,
  },
  {
    slug: 'claude-tidak-terhubung', kind: 'TROUBLESHOOTING', title: 'Produksi gagal: Claude tidak terhubung atau API key ditolak',
    body: `Pesan "Koneksi Claude ditolak" berarti API key dicabut, kedaluwarsa, atau kehabisan kredit. Buka Pengaturan → Claude, hapus koneksi lama lalu tambahkan API key baru, kemudian tekan Lanjutkan di Progress.
Bila riset menampilkan peringatan web search tidak tersedia, organisasi Anthropic Anda belum mengaktifkan web search; video tetap dibuat tetapi klaim tanpa sumber ditandai belum terverifikasi.`,
  },
  {
    slug: 'render-lama-atau-gagal', kind: 'TROUBLESHOOTING', title: 'Render lama atau gagal',
    body: `Render cloud menunggu worker yang tersedia. Bila status lama di antrean, cek halaman Render Center; Superadmin dapat melihat worker aktif di Sistem. Render lokal membutuhkan aplikasi desktop DENTWEB terbuka dan login dengan akun yang sama.
Produksi yang worker-nya berhenti merespons selama lima menit otomatis dilanjutkan dari checkpoint terakhir.`,
  },
  {
    slug: 'kuota-dan-worker', kind: 'FAQ', title: 'Berapa video yang bisa saya buat per hari?',
    body: `Kuota harian dan jumlah worker paralel mengikuti lisensi Anda dan terlihat di wizard Buat Konten. Revisi tidak memotong kuota. Produksi terjadwal di Pengaturan → Produksi tidak pernah membuat pesanan ganda untuk slot jam yang sama.`,
  },
  {
    slug: 'pembaruan-aplikasi-desktop', kind: 'FAQ', title: 'Bagaimana aplikasi desktop diperbarui?',
    body: `Aplikasi Windows memeriksa pembaruan saat dibuka dan memasangnya setelah Anda menyetujui. Di macOS, pembaruan otomatis membutuhkan build yang ditandatangani Apple; sebelum itu aplikasi memberi tahu versi baru dan membuka tautan unduhan DMG.`,
  },
] as const;
