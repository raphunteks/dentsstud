export interface SeedModule {
  slug: string;
  title: string;
  subtitle: string;
  badge: string;
  sortOrder: number;
}

export interface SeedLesson {
  moduleSlug: string;
  slug: string;
  title: string;
  duration: string;
  videoUrl: string;
  chapters: { time: string; label: string }[];
  summary: string;
  checklist: string[];
  lessonPrompt: string;
  sortOrder: number;
}

export interface SeedPrompt {
  stage: string;
  title: string;
  description: string;
  promptText: string;
  tags: string[];
}

export interface SeedRecipe {
  category: string;
  title: string;
  description: string;
  palette: string[];
  fonts: string;
  pacing: string;
  modeCerita: string;
  promptTemplate: string;
}

export interface SeedGlossary {
  category: string;
  term: string;
  definition: string;
  example: string;
}

export interface SeedEffect {
  category: string;
  name: string;
  description: string;
  useCase: string;
  promptSnippet: string;
}

export interface SeedUpdate {
  version: string;
  title: string;
  releasedAt: string;
  highlights: string[];
}

export const SEED_MODULES: SeedModule[] = [
  { slug: 'fondasi-dentsweb-motion', title: '01 · Fondasi DENTSWEB MOTION', subtitle: 'Arsitektur video edukasi 1-kalimat dari ide ke MP4 siap tayang.', badge: 'WAJIB', sortOrder: 1 },
  { slug: 'hook-psikologi-retensi', title: '02 · Hook & Psikologi Retensi 3 Detik', subtitle: 'Formula membuka video edukasi agar penonton berhenti scroll.', badge: 'INTI', sortOrder: 2 },
  { slug: 'riset-naskah-evidence', title: '03 · Riset Medis & Naskah Evidence-Based', subtitle: 'Menyusun naskah akurat, padat, dan ramah awam tanpa jargon berat.', badge: 'INTI', sortOrder: 3 },
  { slug: 'tipografi-kinetik-editorial', title: '04 · Tipografi Kinetik & Layout Editorial', subtitle: 'Hierarki ukuran huruf, kontras warna, dan safe-area vertikal 9:16.', badge: 'DESAIN', sortOrder: 4 },
  { slug: 'motion-beat-sync-suara', title: '05 · Motion Direction & Beat-Sync Suara', subtitle: 'Menyelaraskan transisi visual dengan ritme narasi VoiceStudio.', badge: 'MOTION', sortOrder: 5 },
  { slug: 'mode-cerita-visual-analog', title: '06 · Mode Cerita & Analogi Visual', subtitle: 'Mengubah konsep kompleks menjadi cerita 3 babak yang mudah diingat.', badge: 'STORY', sortOrder: 6 },
  { slug: 'qc-revisi-render-cepat', title: '07 · Quality Control, Revisi & Render', subtitle: 'Checklist audit sebelum ekspor 1080p dan strategi revisi cepat.', badge: 'OPS', sortOrder: 7 },
  { slug: 'distribusi-10-platform', title: '08 · Distribusi Multi-Channel & Auto-Publish', subtitle: 'Optimasi caption, hashtag, dan jadwal ke 10 platform sosial media.', badge: 'GROWTH', sortOrder: 8 },
];

export const SEED_LESSONS: SeedLesson[] = [
  {
    moduleSlug: 'fondasi-dentsweb-motion',
    slug: 'pengenalan-workflow-1-kalimat',
    title: 'Workflow 1-Kalimat: Dari Topik ke Video Edukasi',
    duration: '08:20',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/01-workflow.mp4',
    chapters: [{ time: '00:00', label: 'Konsep DENTSWEB MOTION' }, { time: '02:45', label: 'Pipeline 6 Agen AI' }, { time: '05:30', label: 'Demo Render Pertama' }],
    summary: 'Pelajari bagaimana DENTSWEB MOTION mengubah satu kalimat topik menjadi paket video lengkap: riset, cek fakta, naskah, suara, motion, dan caption.',
    checklist: ['Buka tab Buat Konten di Studio', 'Pastikan koneksi AI Provider aktif', 'Jalankan 1 proyek uji berdurasi 30 detik'],
    lessonPrompt: 'Buatkan video edukasi 45 detik bergaya DENTSWEB MOTION tentang pentingnya scaling gigi setiap 6 bulan dengan hook visual kontras tinggi.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'fondasi-dentsweb-motion',
    slug: 'instalasi-skill-dentsweb-motion',
    title: 'Instalasi & Update Paket Skill DENTSWEB MOTION',
    duration: '06:15',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/02-instalasi.mp4',
    chapters: [{ time: '00:00', label: 'Struktur Paket Skill ZIP' }, { time: '03:10', label: 'Sinkronisasi Preset & Gaya' }],
    summary: 'Panduan mengunduh paket dentsweb-motion-v2.3.0.zip dan memaksimalkan preset gaya bawaan studio.',
    checklist: ['Unduh paket dentsweb-motion-v2.3.0.zip', 'Verifikasi versi skill terbaru di Log Update', 'Pilih 2 gaya favorit untuk identitas klinik'],
    lessonPrompt: 'Gunakan preset DENTSWEB MOTION Editorial Clean dengan rasio 9:16 untuk topik perawatan gigi sensitif.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'hook-psikologi-retensi',
    slug: 'anatomi-hook-3-detik',
    title: 'Anatomi Hook 3 Detik Pertama',
    duration: '09:40',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/03-hook.mp4',
    chapters: [{ time: '00:00', label: 'Pola Pattern Interrupt' }, { time: '04:20', label: 'Visual Hook vs Verbal Hook' }, { time: '07:10', label: 'Studi Kasus Retensi >65%' }],
    summary: 'Tiga detik pertama menentukan 70% performa video. Kuasai 4 pola hook: mitos-vs-fakta, angka mengejutkan, pertanyaan tajam, dan kontras visual.',
    checklist: ['Tulis 3 variasi hook untuk 1 topik', 'Pastikan teks hook maksimal 7 kata', 'Tambahkan gerak masuk kinetik di 0.3 detik pertama'],
    lessonPrompt: 'Tulis 5 hook 3 detik pola Mitos vs Fakta untuk topik "Gigi bungsu tidak sakit apakah tetap harus dicabut?"',
    sortOrder: 1,
  },
  {
    moduleSlug: 'hook-psikologi-retensi',
    slug: 'menjaga-retensi-tengah-video',
    title: 'Open Loop & Pattern Reset di Tengah Video',
    duration: '07:50',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/04-retensi.mp4',
    chapters: [{ time: '00:00', label: 'Kenapa Penonton Drop di Detik 12' }, { time: '03:45', label: 'Teknik Visual Reset Tiap 4 Detik' }],
    summary: 'Gunakan pergantian layout, zoom mikro, dan open loop narasi setiap 4-6 detik agar perhatian penonton tetap terkunci hingga CTA.',
    checklist: ['Rencanakan minimal 1 perubahan visual tiap 4 detik', 'Sisipkan 1 open loop sebelum poin klimaks'],
    lessonPrompt: 'Susun struktur 6 scene berdurasi 45 detik dengan pattern reset visual setiap 5 detik untuk topik penyebab bau mulut.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'riset-naskah-evidence',
    slug: 'menyaring-referensi-klinis',
    title: 'Menyaring Referensi Klinis & Cek Fakta Otomatis',
    duration: '10:15',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/05-riset.mp4',
    chapters: [{ time: '00:00', label: 'Sumber Tepercaya (WHO, ADA, PDGI)' }, { time: '05:00', label: 'Membaca Skor Fact-Check Studio' }],
    summary: 'Cara memastikan klaim edukasi memiliki landasan ilmiah yang jelas serta memverifikasi panel Fact-Check sebelum render.',
    checklist: ['Aktifkan mode verifikasi sumber di Buat Konten', 'Periksa klaim berstatus Unverified sebelum render'],
    lessonPrompt: 'Riset 3 fakta klinis terbaru tentang fluoride pada pasta gigi anak usia 3-6 tahun lengkap dengan bahasa ramah orang tua.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'riset-naskah-evidence',
    slug: 'menulis-naskah-ritme-bicara',
    title: 'Menulis Naskah 130 Kata/Menit untuk Voiceover',
    duration: '08:05',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/06-naskah.mp4',
    chapters: [{ time: '00:00', label: 'Panjang Kalimat Ideal' }, { time: '04:15', label: 'Tanda Jeda & Intonasi TTS' }],
    summary: 'Kalimat pendek (8-12 kata) menghasilkan artikulasi VoiceStudio yang jernih dan ritme visual yang nyaman dibaca.',
    checklist: ['Batas maksimal 110 kata untuk video 45 detik', 'Hindari singkatan medis tanpa pelafalan kamus'],
    lessonPrompt: 'Ubah penjelasan medis tentang gingivitis menjadi naskah voiceover 95 kata dengan kalimat pendek dan nada hangat.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'tipografi-kinetik-editorial',
    slug: 'hierarki-tipografi-9-16',
    title: 'Hierarki Tipografi & Safe-Area Vertikal 9:16',
    duration: '09:10',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/07-tipografi.mp4',
    chapters: [{ time: '00:00', label: 'Zona Aman TikTok & Reels' }, { time: '04:40', label: 'Skala Headline vs Subtitle' }],
    summary: 'Jaga teks penting di luar area tombol UI TikTok/Reels/Shorts dan gunakan maksimal 2 keluarga font yang kontras.',
    checklist: ['Pastikan margin bawah minimal 220px pada 1080x1920', 'Gunakan kontras teks minimal 7:1 terhadap latar'],
    lessonPrompt: 'Rancang arahan tipografi kinetik Editorial Minimalis untuk 4 poin cara memilih sikat gigi yang tepat.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'tipografi-kinetik-editorial',
    slug: 'palet-warna-brand-klinik',
    title: 'Mengunci Palet Warna Brand di Setiap Video',
    duration: '06:50',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/08-palet.mp4',
    chapters: [{ time: '00:00', label: 'Aturan 60-30-10' }, { time: '03:30', label: 'Setup Brand Kit di Pengaturan' }],
    summary: 'Konsistensi warna latar, permukaan kartu, dan aksen membuat penonton langsung mengenali brand Anda dalam 1 detik.',
    checklist: ['Isi warna primer & logo di Pengaturan Brand', 'Uji keterbacaan di layar ponsel kecerahan 50%'],
    lessonPrompt: 'Buat skema warna 60-30-10 bernuansa klinis hangat (ivory, slate, teal) untuk serial edukasi ortodonti.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'motion-beat-sync-suara',
    slug: 'prinsip-easing-dan-timing',
    title: 'Prinsip Easing, Anticipation & Overshoot Halus',
    duration: '11:00',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/09-easing.mp4',
    chapters: [{ time: '00:00', label: 'Cubic-Bezier Profesional' }, { time: '05:20', label: 'Durasi Transisi Ideal (240-420ms)' }],
    summary: 'Bedakan animasi kaku linear dengan kurva spring/expo-out yang terasa mahal dan editorial.',
    checklist: ['Gunakan kurva ease-out untuk elemen masuk', 'Hindari animasi lebih lambat dari 600ms pada transisi teks'],
    lessonPrompt: 'Arahkan motion graphics dengan transisi expo-out 320ms dan stagger 60ms per baris untuk infografis tahapan karies.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'motion-beat-sync-suara',
    slug: 'sinkronisasi-voiceover-dan-scene',
    title: 'Beat-Sync Narasi VoiceStudio dengan Pergantian Scene',
    duration: '08:30',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/10-beatsync.mp4',
    chapters: [{ time: '00:00', label: 'Menandai Kata Kunci Penekanan' }, { time: '04:10', label: 'Kamus Pelafalan Istilah Medis' }],
    summary: 'Posisikan pergantian scene tepat 100ms sebelum kata kunci diucapkan agar otak penonton merasakan sinkronisasi sempurna.',
    checklist: ['Tambahkan istilah medis ke Kamus Pelafalan Suara', 'Atur kecepatan narasi antara 1.0x - 1.08x'],
    lessonPrompt: 'Buat cue sheet beat-sync per kalimat untuk naskah 40 detik tentang perbedaan veneer dan bleaching.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'mode-cerita-visual-analog',
    slug: 'struktur-cerita-3-babak-mikro',
    title: 'Mode Cerita: Struktur 3 Babak dalam 45 Detik',
    duration: '09:25',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/11-cerita.mp4',
    chapters: [{ time: '00:00', label: 'Babak 1: Masalah Nyata' }, { time: '03:20', label: 'Babak 2: Analogi Visual' }, { time: '06:40', label: 'Babak 3: Resolusi & Aksi' }],
    summary: 'Penonton lebih mengingat cerita daripada daftar teori. Gunakan Mode Cerita untuk mengubah prosedur klinis menjadi alur naratif.',
    checklist: ['Pilih 1 analogi sehari-hari untuk topik klinis', 'Akhiri dengan 1 langkah aksi sederhana'],
    lessonPrompt: 'Aktifkan Mode Cerita 3 babak dengan analogi "perisai kaca" untuk menjelaskan lapisan enamel gigi.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'mode-cerita-visual-analog',
    slug: 'komparasi-before-after-aman',
    title: 'Visualisasi Komparasi & Data Edukatif',
    duration: '07:40',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/12-komparasi.mp4',
    chapters: [{ time: '00:00', label: 'Split-Screen & Progress Bar' }, { time: '04:00', label: 'Etika Visual Medis di Sosmed' }],
    summary: 'Sajikan perbandingan kebiasaan baik vs buruk menggunakan ilustrasi vektor bersih agar aman dari pembatasan algoritma.',
    checklist: ['Gunakan ikon/ilustrasi vektor alih-alih foto klinis ekstrem', 'Tampilkan label perbandingan singkat maksimal 3 kata'],
    lessonPrompt: 'Buat storyboard split-screen komparasi menyikat gigi 30 detik vs 2 menit dengan indikator progres animasi.',
    sortOrder: 2,
  },
  {
    moduleSlug: 'qc-revisi-render-cepat',
    slug: 'audit-qc-sebelum-publikasi',
    title: 'Checklist QC 7 Poin Sebelum Publish',
    duration: '06:45',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/13-qc.mp4',
    chapters: [{ time: '00:00', label: 'Cek Typo & Pelafalan' }, { time: '03:15', label: 'Cek Audio Loudness & Clipping' }],
    summary: 'Gunakan fitur Revoice dan Rerender di halaman Hasil untuk memperbaiki detail kecil tanpa mengulang produksi dari nol.',
    checklist: ['Tonton preview penuh tanpa suara untuk cek tipografi', 'Tonton ulang dengan suara untuk cek ritme narasi'],
    lessonPrompt: 'Lakukan audit QC 7 poin (hook, akurasi, typo, safe-area, pacing, audio, CTA) untuk naskah berikut.',
    sortOrder: 1,
  },
  {
    moduleSlug: 'qc-revisi-render-cepat',
    slug: 'produksi-batch-otomatis',
    title: 'Menyiapkan Jadwal Produksi Otomatis Mingguan',
    duration: '07:30',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/14-batch.mp4',
    chapters: [{ time: '00:00', label: 'Antrean Topik Mingguan' }, { time: '03:50', label: 'Slot Waktu Render Ideal' }],
    summary: 'Siapkan 7 topik edukasi sekali duduk dan biarkan Produksi Otomatis merender antrean Anda secara terjadwal.',
    checklist: ['Isi minimal 5 topik di Pengaturan Produksi Otomatis', 'Tetapkan jam produksi harian yang konsisten'],
    lessonPrompt: 'Rancang bank 14 topik edukasi kesehatan gigi untuk jadwal konten 2 minggu (campuran mitos, tips cepat, dan studi kasus).',
    sortOrder: 2,
  },
  {
    moduleSlug: 'distribusi-10-platform',
    slug: 'optimasi-caption-multi-channel',
    title: 'Menyesuaikan Caption & Batas Karakter 10 Platform',
    duration: '08:15',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/15-distribusi.mp4',
    chapters: [{ time: '00:00', label: 'Karakteristik Reels, TikTok, Shorts' }, { time: '04:20', label: 'Thread Ringkas untuk X & Threads' }],
    summary: 'Satu video MP4 dapat didistribusikan ke 10 platform sekaligus dengan panjang caption dan hashtag yang otomatis tervalidasi.',
    checklist: ['Hubungkan minimal 2 akun di tab Sosial Media', 'Gunakan 1-klik Publish Sosmed dari halaman Hasil'],
    lessonPrompt: 'Adaptasikan 1 topik edukasi behel gigi menjadi caption TikTok/IG (80 kata), deskripsi YouTube Shorts, dan post X (<240 karakter).',
    sortOrder: 1,
  },
  {
    moduleSlug: 'distribusi-10-platform',
    slug: 'evaluasi-kalender-dan-ideas-board',
    title: 'Siklus Konten Berkelanjutan dengan Ideas Board',
    duration: '06:30',
    videoUrl: 'https://motion.dentsweb.my.id/media/lms/16-kalender.mp4',
    chapters: [{ time: '00:00', label: 'Menangkap Pertanyaan Pasien' }, { time: '03:10', label: 'Promosi Ide ke Kalender' }],
    summary: 'Ubah setiap pertanyaan pasien di klinik menjadi kartu di Ideas Board, lalu jadwalkan terbit rutin tanpa kehabisan ide.',
    checklist: ['Tambahkan 3 pertanyaan pasien ke Ideas Board', 'Promosikan 1 ide menjadi jadwal posting minggu ini'],
    lessonPrompt: 'Ubah 5 pertanyaan pasien paling sering tentang tambal gigi menjadi kartu Ideas Board lengkap dengan sudut pandang hook.',
    sortOrder: 2,
  },
];

export const SEED_PROMPTS: SeedPrompt[] = [
  // Stage 1: Hook & Ide (4)
  { stage: 'Hook & Ide', title: 'Hook Mitos vs Fakta Klinis', description: 'Membuka video dengan mematahkan miskonsepsi populer secara ramah.', promptText: 'Buat 5 hook 3 detik pola Mitos vs Fakta untuk topik [TOPIK]. Maksimal 8 kata per hook, nada edukatif tanpa menghakimi.', tags: ['hook', 'mitos', 'retensi'] },
  { stage: 'Hook & Ide', title: 'Hook Angka Mengejutkan', description: 'Memicu rasa ingin tahu menggunakan statistik atau durasi konkret.', promptText: 'Tulis 5 kalimat pembuka berbasis angka spesifik tentang [TOPIK] yang relevan untuk pasien usia 20-40 tahun.', tags: ['hook', 'data'] },
  { stage: 'Hook & Ide', title: 'Generator 10 Ide dari Keluhan Pasien', description: 'Mengubah keluhan harian menjadi serial konten edukasi.', promptText: 'Dari keluhan pasien "[KELUHAN]", pecah menjadi 10 ide video 45 detik bergaya DENTSWEB MOTION lengkap dengan sudut hook.', tags: ['ide', 'serial'] },
  { stage: 'Hook & Ide', title: 'Hook Visual Kontras 2 Detik', description: 'Arahan visual pembuka yang langsung terbaca meski tanpa suara.', promptText: 'Rancang konsep visual 2 detik pertama untuk [TOPIK] dengan 1 headline besar (maks 5 kata) dan 1 animasi kontras.', tags: ['visual', 'silent-watch'] },
  // Stage 2: Riset & Cek Fakta (3)
  { stage: 'Riset & Cek Fakta', title: 'Ringkasan Bukti Klinis Ramah Awam', description: 'Menyederhanakan pedoman klinis menjadi 3 poin mudah dicerna.', promptText: 'Ringkas panduan klinis terbaru (WHO/ADA/PDGI) mengenai [TOPIK] ke dalam 3 poin faktual ber bahasa Indonesia sehari-hari.', tags: ['riset', 'evidence'] },
  { stage: 'Riset & Cek Fakta', title: 'Audit Klaim Naskah', description: 'Mengecek potensi klaim berlebihan sebelum dipublikasikan.', promptText: 'Periksa naskah berikut dan tandai kalimat yang berisiko overclaim medis, lalu beri alternatif kalimat yang akurat dan aman: [NASKAH]', tags: ['fact-check', 'etika'] },
  { stage: 'Riset & Cek Fakta', title: 'Analogi Sehari-hari untuk Istilah Medis', description: 'Mencari metafora visual agar pasien awam langsung paham.', promptText: 'Berikan 3 analogi benda sehari-hari yang akurat secara klinis untuk menjelaskan mekanisme [TOPIK].', tags: ['analogi', 'edukasi'] },
  // Stage 3: Naskah & Voiceover (4)
  { stage: 'Naskah & Voiceover', title: 'Naskah 45 Detik Ritme Cepat', description: 'Struktur Hook-Isi-CTA tepat 95-105 kata untuk VoiceStudio.', promptText: 'Tulis naskah voiceover 45 detik (95-105 kata) tentang [TOPIK]. Gunakan kalimat pendek maks 10 kata, akhiri dengan CTA ringan.', tags: ['naskah', '45s'] },
  { stage: 'Naskah & Voiceover', title: 'Naskah Mode Cerita 3 Babak', description: 'Format cerita pasien mikro dengan tensi dan resolusi jelas.', promptText: 'Tulis naskah Mode Cerita 3 babak (Masalah -> Analogi -> Solusi) berdurasi 60 detik untuk topik [TOPIK].', tags: ['story', '60s'] },
  { stage: 'Naskah & Voiceover', title: 'Pemoles Intonasi TTS', description: 'Menambahkan jeda alami dan penekanan kata untuk narator AI.', promptText: 'Sunting naskah berikut agar natural saat dibacakan TTS Indonesia (pecah kalimat panjang, tambahkan koma jeda alami): [NASKAH]', tags: ['tts', 'voicestudio'] },
  { stage: 'Naskah & Voiceover', title: 'CTA Edukatif Non-Hard-Selling', description: 'Penutup video yang mendorong simpan, bagikan, dan konsultasi.', promptText: 'Buat 5 variasi kalimat penutup (CTA) 1 kalimat yang sopan dan mendorong penonton menyimpan video tentang [TOPIK].', tags: ['cta', 'engagement'] },
  // Stage 4: Motion Direction (4)
  { stage: 'Motion Direction', title: 'Storyboard 6 Scene DENTSWEB MOTION', description: 'Memecah naskah menjadi daftar scene + arahan kamera & transisi.', promptText: 'Pecah naskah [TOPIK] menjadi 6 scene (durasi, teks layar maks 6 kata, elemen visual utama, jenis transisi expo-out).', tags: ['storyboard', 'scene'] },
  { stage: 'Motion Direction', title: 'Arahan Beat-Sync Pergantian Scene', description: 'Menentukan kata kunci pemicu animasi pada tiap kalimat.', promptText: 'Tandai kata kunci pemicu motion (bold) dan jenis efek masuk (slide, scale, highlight) untuk naskah berikut: [NASKAH]', tags: ['beat-sync', 'timing'] },
  { stage: 'Motion Direction', title: 'Infografis Perbandingan Split-Screen', description: 'Arahan layout 2 kolom kiri-kanan untuk edukasi benar vs salah.', promptText: 'Buat spesifikasi motion split-screen Benar vs Salah untuk [TOPIK] dengan 3 pasangan poin singkat dan indikator ceklis.', tags: ['split-screen', 'infografis'] },
  { stage: 'Motion Direction', title: 'Timeline Progres Bertahap', description: 'Visualisasi langkah 1-2-3 atau tahapan waktu perawatan.', promptText: 'Rancang animasi timeline 4 tahap vertikal 9:16 untuk proses [TOPIK] dengan progress bar sinkron narasi.', tags: ['timeline', 'step'] },
  // Stage 5: Typography & Visual (3)
  { stage: 'Typography & Visual', title: 'Kinetic Headline Penekanan', description: 'Memilih 1-2 kata kunci untuk diperbesar dan diberi warna aksen.', promptText: 'Dari naskah [NASKAH], ekstrak teks layar singkat (maks 5 kata/scene) dan tandai 1 kata aksen warna per scene.', tags: ['tipografi', 'aksen'] },
  { stage: 'Typography & Visual', title: 'Komposisi Cover Thumbnail 9:16', description: 'Judul sampul 3-4 kata yang langsung terbaca di grid profil.', promptText: 'Buat 5 opsi teks cover thumbnail (maks 4 kata) yang kontras dan seragam untuk serial [TOPIK].', tags: ['cover', 'thumbnail'] },
  { stage: 'Typography & Visual', title: 'Brief Palet & Mood Editorial', description: 'Menentukan nuansa warna, grid, dan tekstur latar.', promptText: 'Definisikan arahan visual (latar, kartu, teks, aksen, radius sudut, gaya ikon) bergaya Editorial Bersih untuk [TOPIK].', tags: ['palet', 'editorial'] },
  // Stage 6: Revisi & Polish (3)
  { stage: 'Revisi & Polish', title: 'Pemadat Naskah 20% Lebih Tajam', description: 'Memangkas kata basa-basi tanpa mengurangi makna klinis.', promptText: 'Pangkas naskah berikut sebesar 20% agar lebih padat, langsung ke inti, dan tetap hangat: [NASKAH]', tags: ['editing', 'ringkas'] },
  { stage: 'Revisi & Polish', title: 'Audit Safe-Area & Keterbacaan', description: 'Checklist cepat teks terlalu padat atau terlalu kecil.', promptText: 'Evaluasi daftar teks layar berikut: pastikan tiap layar <= 6 kata dan mudah dibaca dalam 2 detik di layar ponsel: [TEKS]', tags: ['qc', 'safe-area'] },
  { stage: 'Revisi & Polish', title: 'Variasi A/B Hook untuk Rerender', description: 'Menguji 2 versi pembuka dari video yang sudah jadi.', promptText: 'Buat 2 alternatif hook 3 detik yang benar-benar berbeda sudut pandangnya untuk mengganti pembuka video [TOPIK].', tags: ['ab-test', 'rerender'] },
  // Stage 7: Caption & Distribusi (3)
  { stage: 'Caption & Distribusi', title: 'Paket Caption IG Reels & TikTok', description: 'Caption ringkas + 5 hashtag terkurasi + komentar pertama.', promptText: 'Buat caption Instagram/TikTok (maks 70 kata), 6 hashtag relevan, dan 1 komentar pertama pemancing diskusi untuk [TOPIK].', tags: ['instagram', 'tiktok'] },
  { stage: 'Caption & Distribusi', title: 'Deskripsi SEO YouTube Shorts', description: 'Judul dan deskripsi ramah pencarian Google & YouTube.', promptText: 'Tulis judul SEO (<65 karakter) dan deskripsi YouTube Shorts 3 paragraf singkat untuk video [TOPIK].', tags: ['youtube', 'seo'] },
  { stage: 'Caption & Distribusi', title: 'Adaptasi Ringkas X & Threads', description: 'Mengubah inti video menjadi posting teks tajam <= 260 karakter.', promptText: 'Ringkas pesan utama video [TOPIK] menjadi 1 post X/Threads maksimal 250 karakter dengan 1 pertanyaan penutup.', tags: ['x', 'threads'] },
];

export const SEED_RECIPES: SeedRecipe[] = [
  { category: 'Editorial', title: 'Swiss Clinical Editorial', description: 'Grid presisi, latar ivory hangat, tipografi tebal kontras tinggi untuk kredibilitas medis.', palette: ['#F7F6F2', '#14171A', '#0F766E', '#E2E8F0'], fonts: 'Plus Jakarta Sans + JetBrains Mono', pacing: 'Sedang (320ms expo-out)', modeCerita: 'Fakta Terstruktur', promptTemplate: 'Gaya Swiss Clinical Editorial, latar #F7F6F2, aksen #0F766E, tipografi besar rata kiri, transisi bersih.' },
  { category: 'Keynote', title: 'Apple Keynote Minimal', description: 'Latar gelap elegan, sorotan cahaya lembut, satu angka atau kata kunci per layar.', palette: ['#0B0D10', '#F8FAFC', '#38BDF8', '#1E293B'], fonts: 'Inter Display + Inter', pacing: 'Sinematik (420ms ease-out)', modeCerita: 'Reveal Bertahap', promptTemplate: 'Gaya Keynote Minimal gelap, fokus 1 pesan per layar, skala halus, ruang kosong luas.' },
  { category: 'Explainer', title: 'Vox Documentary Cards', description: 'Gaya jurnalisme visual dengan highlight stabilo kuning dan kartu kutipan sumber.', palette: ['#FAF9F5', '#18181B', '#EAB308', '#334155'], fonts: 'Space Grotesk + Inter', pacing: 'Cepat (260ms crisp)', modeCerita: 'Investigasi Ringan', promptTemplate: 'Gaya Vox Documentary, kartu kutipan sumber, efek stabilo kuning pada kata kunci.' },
  { category: 'Explainer', title: 'Kurzgesagt Clean Vector', description: 'Ilustrasi vektor geometris warna cerah terukur untuk menyederhanakan anatomi.', palette: ['#0F172A', '#FFFFFF', '#2DD4BF', '#FB7185'], fonts: 'Outfit + Plus Jakarta Sans', pacing: 'Dinamis (300ms spring)', modeCerita: 'Analogi Visual', promptTemplate: 'Gaya vektor geometris bersih, latar biru malam, ikon anatomi sederhana dan ramah.' },
  { category: 'Data', title: '3Blue1Brown Diagram', description: 'Visualisasi diagram skematis dan garis panah presisi di atas kanvas gelap.', palette: ['#111318', '#F1F5F9', '#60A5FA', '#FBBF24'], fonts: 'IBM Plex Sans + IBM Plex Mono', pacing: 'Terukur (380ms)', modeCerita: 'Penjelasan Mekanisme', promptTemplate: 'Gaya diagram edukatif garis vektor halus, panah penunjuk teranimasi, label mono.' },
  { category: 'Social', title: 'Bento Kinetic Reels', description: 'Kartu bento modular yang bergeser ritmis mengikuti ketukan narasi.', palette: ['#FFFFFF', '#09090B', '#10B981', '#F4F4F5'], fonts: 'Plus Jakarta Sans', pacing: 'Cepat (240ms snappy)', modeCerita: 'Listicle 3-5 Poin', promptTemplate: 'Layout bento 2x2 modular, sudut membulat 20px, transisi geser cepat sinkron beat.' },
  { category: 'Story', title: 'Mode Cerita: Warm Diary', description: 'Nuansa kertas hangat seperti buku catatan klinik, cocok untuk kisah pasien.', palette: ['#FDF8F3', '#292524', '#EA580C', '#E7E5E4'], fonts: 'Fraunces + Plus Jakarta Sans', pacing: 'Tenang (400ms)', modeCerita: 'Cerita 3 Babak', promptTemplate: 'Mode Cerita Warm Diary, serif editorial + sans bersih, alur 3 babak empatik.' },
  { category: 'Story', title: 'Mode Cerita: Mitos vs Fakta', description: 'Kontras dua kutub merah-hijau lembut untuk meluruskan informasi keliru.', palette: ['#F8FAFC', '#0F172A', '#DC2626', '#16A34A'], fonts: 'Space Grotesk + Inter', pacing: 'Tegas (250ms)', modeCerita: 'Kontras Mitos/Fakta', promptTemplate: 'Mode Cerita Mitos vs Fakta, stempel merah tercoret berubah menjadi kartu fakta hijau bersih.' },
  { category: 'SaaS', title: 'Linear Crisp Dark', description: 'Estetika antarmuka modern monokrom gelap dengan garis tipis 1px.', palette: ['#09090B', '#FAFAFA', '#A1A1AA', '#27272A'], fonts: 'Inter + JetBrains Mono', pacing: 'Presisi (280ms)', modeCerita: 'Step-by-Step UI', promptTemplate: 'Gaya Linear gelap monokrom, border hairline 1px, fokus kejernihan informasi.' },
  { category: 'Social', title: 'Wrapped High-Energy', description: 'Tipografi raksasa penuh layar dengan transisi potong cepat untuk fakta singkat.', palette: ['#111827', '#F9FAFB', '#F43F5E', '#A855F7'], fonts: 'Syne + Plus Jakarta Sans', pacing: 'Sangat Cepat (200ms)', modeCerita: 'Fakta Kilat', promptTemplate: 'Tipografi raksasa penuh layar, beat-sync ketat, kontras tinggi untuk video <30 detik.' },
  { category: 'Editorial', title: 'Monochrome Paper Print', description: 'Hitam-putih koran modern dengan satu aksen tinta tunggal.', palette: ['#F4F3EF', '#111111', '#1D4ED8', '#D6D3CD'], fonts: 'Instrument Serif + Inter', pacing: 'Editorial (350ms)', modeCerita: 'Opini Ahli', promptTemplate: 'Gaya cetak editorial monokrom, tipografi serif tegas, aksen biru tinta tunggal.' },
  { category: 'Story', title: 'Mode Cerita: Q&A Pasien', description: 'Gelembung pertanyaan pasien di atas diikuti jawaban ringkas dokter.', palette: ['#F0FDF4', '#14532D', '#0D9488', '#DCFCE7'], fonts: 'Plus Jakarta Sans', pacing: 'Ramah (300ms)', modeCerita: 'Tanya Jawab', promptTemplate: 'Mode Cerita Q&A, kartu pertanyaan pasien masuk di detik 0, diikuti 3 kartu jawaban ringkas.' },
];

export const SEED_GLOSSARY: SeedGlossary[] = [
  { category: 'Animasi & Timing', term: 'Easing (Cubic-Bezier)', definition: 'Kurva percepatan animasi yang membuat gerak terasa alami, bukan kaku seperti robot.', example: 'Gunakan ease-out (0.16, 1, 0.3, 1) saat kartu teks masuk ke layar.' },
  { category: 'Animasi & Timing', term: 'Stagger', definition: 'Jeda kecil berurutan (40-80ms) antar elemen yang muncul bersama agar mata mudah mengikuti.', example: '3 poin manfaat muncul bergantian dengan stagger 60ms.' },
  { category: 'Animasi & Timing', term: 'Anticipation', definition: 'Gerakan persiapan singkat sebelum aksi utama untuk memberi bobot visual.', example: 'Tombol sedikit mengecil 96% sebelum memantul ke 100%.' },
  { category: 'Animasi & Timing', term: 'Overshoot / Spring', definition: 'Elemen melewati target sedikit lalu kembali menetap secara elastis.', example: 'Badge fakta masuk dengan spring ringan tanpa memantul berlebihan.' },
  { category: 'Kamera & Layout', term: 'Safe-Area 9:16', definition: 'Area aman di tengah frame 1080x1920 agar teks tidak tertutup tombol TikTok, Reels, atau Shorts.', example: 'Sisakan ruang kosong 180px di atas dan 240px di bawah.' },
  { category: 'Kamera & Layout', term: 'Rule of Thirds', definition: 'Membagi layar menjadi grid 3x3 untuk menempatkan titik fokus secara seimbang.', example: 'Letakkan ilustrasi gigi di sepertiga atas dan headline di tengah.' },
  { category: 'Kamera & Layout', term: 'Visual Reset', definition: 'Perubahan komposisi atau skala layar tiap 4-6 detik untuk menyegarkan fokus penonton.', example: 'Berpindah dari full-screen headline ke kartu split-screen di detik ke-5.' },
  { category: 'Kamera & Layout', term: 'Negative Space', definition: 'Ruang kosong yang disengaja di sekitar teks agar desain terasa premium dan tidak sesak.', example: 'Minimal 35% area frame tetap bersih dari elemen dekoratif.' },
  { category: 'Tipografi', term: 'Kinetic Typography', definition: 'Teknik menganimasikan huruf dan kata mengikuti ritme serta emosi narasi.', example: 'Kata kunci "GRATIS" atau "2 MENIT" muncul membesar tepat saat diucapkan.' },
  { category: 'Tipografi', term: 'Visual Hierarchy', definition: 'Urutan prioritas baca berdasarkan ukuran, ketebalan, dan kontras warna teks.', example: 'Headline 72px Bold, subjudul 34px Regular, catatan sumber 20px Muted.' },
  { category: 'Tipografi', term: 'Tracking & Leading', definition: 'Jarak antar huruf (tracking) dan jarak antar baris (leading) demi keterbacaan cepat.', example: 'Gunakan tracking -0.02em untuk headline besar agar rapat dan kokoh.' },
  { category: 'Tipografi', term: 'Contrast Ratio', definition: 'Perbandingan kecerahan teks terhadap latar belakang (target minimal 7:1 di video).', example: 'Teks #111111 di atas latar #F7F6F2 memiliki rasio kontras >16:1.' },
  { category: 'Audio & Beat-Sync', term: 'Beat-Sync', definition: 'Menyelaraskan momen transisi visual dengan ketukan musik atau jeda kalimat narator.', example: 'Kartu poin kedua masuk tepat pada awal kalimat kedua narator.' },
  { category: 'Audio & Beat-Sync', term: 'LUFS Loudness', definition: 'Standar kenyaringan audio terukur agar volume suara stabil di semua platform.', example: 'Target -14 LUFS untuk YouTube/TikTok agar suara narator jelas.' },
  { category: 'Audio & Beat-Sync', term: 'Audio Ducking', definition: 'Menurunkan volume musik latar otomatis saat narator berbicara.', example: 'Musik latar turun ke -22dB selama segmen voiceover aktif.' },
  { category: 'Audio & Beat-Sync', term: 'Pronunciation Dictionary', definition: 'Daftar pemetaan pelafalan khusus agar mesin TTS membaca istilah medis dengan tepat.', example: 'Memetakan "scaling" -> "skeling" atau "gingivitis" -> "gingi-vitis".' },
  { category: 'Render & Output', term: 'FPS (Frames Per Second)', definition: 'Jumlah gambar per detik; 30fps standar edukasi, 60fps untuk gerak tipografi super halus.', example: 'DENTSWEB MOTION merender 30fps H.264 untuk keseimbangan ukuran dan kejernihan.' },
  { category: 'Render & Output', term: 'Bitrate & CRF', definition: 'Pengaturan kompresi video yang menentukan ketajaman teks dan ukuran file MP4.', example: 'CRF 18-20 menjaga tepi teks tetap tajam tanpa file terlalu besar.' },
  { category: 'Render & Output', term: 'Keyframes', definition: 'Titik acuan posisi, skala, atau opasitas pada lini masa animasi.', example: 'Keyframe opacity 0 di frame 0 dan opacity 1 di frame 10.' },
  { category: 'Render & Output', term: 'Codec H.264 (MP4)', definition: 'Format kompresi video universal yang didukung penuh oleh seluruh 10 platform sosial.', example: 'Selalu ekspor MP4 H.264 + audio AAC 48kHz untuk kompatibilitas 100%.' },
];

export const SEED_EFFECTS: SeedEffect[] = [
  { category: 'Transisi', name: 'Clean Wipe Reveal', description: 'Sapuan garis bersih membuka scene baru dari kiri ke kanan.', useCase: 'Berpindah dari hook ke poin materi pertama.', promptSnippet: 'transisi clean wipe 280ms ease-out' },
  { category: 'Transisi', name: 'Zoom-Through Focus', description: 'Kamera mendorong halus masuk ke kartu utama menuju scene berikutnya.', useCase: 'Masuk ke detail anatomi atau langkah prosedur.', promptSnippet: 'transisi zoom-through scale 1.0 ke 1.18' },
  { category: 'Transisi', name: 'Vertical Card Stack', description: 'Kartu baru meluncur naik menumpuk kartu sebelumnya.', useCase: 'Format daftar 3-5 tips singkat.', promptSnippet: 'card stack vertikal dengan bayangan tipis' },
  { category: 'Tipografi', name: 'Word-by-Word Pop', description: 'Setiap kata muncul sinkron dengan suara narator.', useCase: 'Hook 3 detik dan kalimat penekanan.', promptSnippet: 'kinetic caption per kata sinkron narasi' },
  { category: 'Tipografi', name: 'Highlighter Marker Sweep', description: 'Sapuan stabilo lembut di belakang kata kunci penting.', useCase: 'Menyorot fakta medis atau angka statistik.', promptSnippet: 'efek stabilo sapuan kiri-ke-kanan 320ms' },
  { category: 'Tipografi', name: 'Split-Line Mask Up', description: 'Baris teks muncul dari balik garis tak terlihat dengan rapi.', useCase: 'Judul bab bergaya editorial Swiss.', promptSnippet: 'text mask reveal ke atas stagger 60ms' },
  { category: 'Kamera', name: 'Ken Burns Micro Drift', description: 'Gerak zoom 3-5% sangat halus agar frame tidak terasa mati.', useCase: 'Menjaga nyawa visual saat narasi panjang.', promptSnippet: 'slow drift zoom 1.00 ke 1.05 sepanjang scene' },
  { category: 'Kamera', name: 'Rack Focus Blur', description: 'Latar sedikit kabur sementara kartu utama tajam di depan.', useCase: 'Menonjolkan 1 pesan atau kutipan ahli.', promptSnippet: 'backdrop blur halus fokus ke kartu tengah' },
  { category: 'Kamera', name: 'Split-Screen Push', description: 'Layar membelah dua secara simetris untuk komparasi.', useCase: 'Perbandingan kebiasaan benar vs salah.', promptSnippet: 'split-screen 50/50 masuk berlawanan arah' },
  { category: 'Background', name: 'Subtle Paper Grain', description: 'Tekstur kertas editorial tipis agar latar tidak datar.', useCase: 'Gaya Swiss Clinical dan Warm Diary.', promptSnippet: 'tekstur grain halus opacity 4%' },
  { category: 'Background', name: 'Architectural Dot Grid', description: 'Pola titik presisi di latar belakang yang bergerak mikro.', useCase: 'Konten teknis, diagram, dan data.', promptSnippet: 'dot grid halus 24px dengan paralaks ringan' },
  { category: 'Background', name: 'Soft Ambient Gradient', description: 'Cahaya gradien lembut bergerak pelan di sudut frame.', useCase: 'Gaya Keynote Minimal gelap.', promptSnippet: 'ambient glow lembut di sudut kanan atas' },
  { category: 'Data & Chart', name: 'Animated Number Counter', description: 'Angka berhitung cepat menuju nilai statistik target.', useCase: 'Menampilkan persentase atau durasi perawatan.', promptSnippet: 'counter angka animasi 0 ke target dalam 700ms' },
  { category: 'Data & Chart', name: 'Horizontal Progress Bar', description: 'Batang progres terisi halus menampilkan perbandingan.', useCase: 'Efektivitas metode atau langkah selesai.', promptSnippet: 'progress bar horizontal dengan label persen' },
  { category: 'Data & Chart', name: 'Callout Pointer Line', description: 'Garis penunjuk melukis diri menuju bagian ilustrasi.', useCase: 'Menjelaskan lapisan gigi atau titik nyeri.', promptSnippet: 'garis callout SVG stroke-dashoffset animasi' },
  { category: 'Highlight', name: 'Checklist Tick Pop', description: 'Ikon centang muncul memantul saat poin selesai disebut.', useCase: 'Ringkasan langkah perawatan harian.', promptSnippet: 'ceklis hijau muncul berurutan dengan pop ringan' },
  { category: 'Highlight', name: 'Myth Stamp Strike', description: 'Coretan atau stempel MITOS sebelum berganti ke FAKTA.', useCase: 'Serial edukasi meluruskan hoaks kesehatan.', promptSnippet: 'stempel MITOS merah lalu flip ke kartu FAKTA' },
  { category: 'Highlight', name: 'Source Citation Pill', description: 'Lencana sumber jurnal/organisasi muncul rapi di pojok bawah.', useCase: 'Meningkatkan kepercayaan klinis penonton.', promptSnippet: 'citation badge kecil di atas safe-area bawah' },
  { category: 'Audio Sync', name: 'Waveform Pulse Bar', description: 'Gelombang audio tipis bereaksi mengikuti suara narator.', useCase: 'Segmen kutipan suara atau Q&A pasien.', promptSnippet: 'minimal audio waveform bar 12 batang' },
  { category: 'Audio Sync', name: 'Beat-Flash Accent', description: 'Kilatan aksen halus pada border kartu saat kata kunci.', useCase: 'Video cepat gaya Wrapped <30 detik.', promptSnippet: 'border glow pulse singkat pada kata penekanan' },
  { category: 'Audio Sync', name: 'Chapter Progress Pill', description: 'Indikator progres di bagian atas menunjukkan sisa durasi.', useCase: 'Meningkatkan retensi hingga detik akhir.', promptSnippet: 'top progress bar tipis 3px warna aksen' },
  { category: 'Finishing', name: 'Brand Watermark Lockup', description: 'Logo klinik transparan rapi di pojok atas safe-area.', useCase: 'Identitas konsisten di setiap unggahan.', promptSnippet: 'logo watermark pojok kanan atas opacity 75%' },
  { category: 'Finishing', name: 'CTA End-Card Slide', description: 'Kartu penutup 2.5 detik dengan ajakan simpan & konsultasi.', useCase: 'Penutup standar seluruh video edukasi.', promptSnippet: 'end-card 2.5 detik dengan logo dan ajakan simpan' },
  { category: 'Finishing', name: 'Seamless Loop Bridge', description: 'Kalimat akhir menyambung natural kembali ke hook pembuka.', useCase: 'Menaikkan watch-time ulang di Reels & TikTok.', promptSnippet: 'seamless loop transisi akhir kembali ke frame 0' },
];

export const SEED_UPDATES: SeedUpdate[] = [
  {
    version: 'v2.3.0',
    title: 'DENTSWEB MOTION LMS & 10-Platform Publisher',
    releasedAt: '2026-11-25',
    highlights: [
      'Rebrand resmi paket skill menjadi DENTSWEB MOTION v2.3.0.',
      'Integrasi 1-klik Kirim Prompt dari kelas langsung ke halaman Buat Konten.',
      'Tambahan 12 Resep Gaya + Mode Cerita & 24 efek video siap pakai.',
    ],
  },
  {
    version: 'v2.2.0',
    title: 'Multi-Provider AI & Auto-Fallback Router',
    releasedAt: '2026-11-22',
    highlights: [
      'Dukungan penuh 9Router Custom Gateway dengan muat 500 model otomatis.',
      'Auto-fallback lintas provider AI saat kuota utama penuh.',
    ],
  },
  {
    version: 'v2.1.0',
    title: 'VoiceStudio Pitch & Kamus Pelafalan Medis',
    releasedAt: '2026-11-18',
    highlights: [
      'Pengaturan nada (pitch) -12 hingga +12 semitone di pratinjau suara.',
      'Kamus pelafalan khusus istilah kedokteran gigi untuk akurasi TTS.',
    ],
  },
  {
    version: 'v2.0.0',
    title: 'Engine Beat-Sync & Render Center Generasi Baru',
    releasedAt: '2026-11-10',
    highlights: [
      'Render Remotion 1080p lebih cepat dengan antrean BullMQ terdistribusi.',
      'Panel Fact-Check dan Quality Control otomatis sebelum publikasi.',
    ],
  },
];

// Minimal zero-dependency valid ZIP (store method, CRC32) for dentsweb-motion-v2.3.0.zip
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries: { name: string; content: string | Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8');
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    localParts.push(local, dataBuf);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    centralParts.push(central);
    offset += local.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

export function buildDentswebMotionSkillZip(): Buffer {
  const skillMd = `---
name: dentsweb-motion
version: 2.3.0
description: Paket Skill resmi DENTSWEB MOTION untuk produksi video edukasi 1-kalimat siap tayang dengan Remotion & Beat-Sync Engine.
---

# DENTSWEB MOTION v2.3.0

Panduan resmi pembuatan video edukasi motion graphics 9:16 & 16:9 dari satu kalimat topik.

## Workflow Inti
1. **Hook 3 Detik**: Pattern interrupt visual + headline <= 7 kata.
2. **Riset & Fact-Check**: Referensi klinis tepercaya, bahasa ramah awam.
3. **Naskah 130 Kata/Menit**: Kalimat pendek, jeda alami untuk VoiceStudio.
4. **Motion Direction**: Easing expo-out 240-420ms, safe-area 9:16, visual reset tiap 4 detik.
5. **Distribusi 10 Platform**: Publikasi langsung lewat DENTSWEB Social Publisher.
`;
  const readme = `DENTSWEB MOTION Skill Pack v2.3.0\nDENTSWEB STUDIO — https://motion.dentsweb.my.id\n\nBerisi:\n- SKILL.md (instruksi utama DENTSWEB MOTION)\n- presets.json (12 resep gaya & 24 efek video)\n`;
  const presets = JSON.stringify({ version: '2.3.0', recipes: SEED_RECIPES, effects: SEED_EFFECTS }, null, 2);
  return buildZipArchive([
    { name: 'dentsweb-motion/SKILL.md', content: skillMd },
    { name: 'dentsweb-motion/README.md', content: readme },
    { name: 'dentsweb-motion/presets.json', content: presets },
  ]);
}
