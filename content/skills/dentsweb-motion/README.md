# Skill DENTSWEB MOTION v2.3.0

Skill Claude untuk membuat video motion graphic lewat chat dengan alur kerja DENTSWEB MOTION:
brief → gaya → gambar uji adegan 1 → naskah → suara ElevenLabs → semua adegan → revisi → MP4.

## Yang baru di v2.2

- **Galeri Gaya: 80 gaya tambahan** (total 87) — cat air, tinta Cina, wayang bayangan, ukiyo-e,
  risograph, anime 80-an, RPG piksel, HD-2D, cetak biru, HUD hologram, newsreel, dan lainnya.
  Cukup sebut namanya. Resep galeri dari Lemo-Opuscar karya LemoLab (MIT).

## Yang baru di v2.1

- **Mode Cerita** untuk cerita fiktif: horor, misteri, dongeng, drama, sampai seri bersambung.
  Dipasang di atas gaya mana pun, lengkap dengan lembar tokoh supaya tokoh tetap sama di tiap
  adegan dan tiap Part, alur hook → twist, serta narator + suara tiap tokoh.

## Yang baru di v2

- **Ditulis ulang dari nol** dengan alur kerja tim DENTSWEB MOTION.
- **8 resep gaya dari seri konten kami**: Isometrik Dibongkar, Sejarah 3D Sinematik, Tubuh Manusia
  Anime, Dunia 2D Bertekstur, Kartun Cel Cerah, Peta Relief Sinematik, Promo Produk & Iklan, Bikin dari Nol —
  masing-masing dengan contoh adegan yang langsung jalan.
- **Gaya yang kamu sebut langsung dipakai.** Claude tidak lagi menawarkan gaya lain kalau kamu
  sudah menentukan gayanya. Belum menentukan? Claude memberi 3 pilihan.
- **Gambar uji adegan 1 dulu**, baru suara. Kredit ElevenLabs tidak terbuang kalau gayanya
  masih direvisi.
- **9:16 + subtitle per kata** jadi bawaan (Reels/TikTok/Shorts).
- **Setiap revisi dicadangkan otomatis.** Bilang "balikin yang tadi" kapan saja.
- Satu alat kerja `scripts/mf.py` (buat proyek, potret cek, waktu subtitle, cadangan, render MP4).

## Pasang

1. Unduh `dentsweb-motion.zip` dari halaman Download kelas.
2. Di Claude Code, kirim zip-nya dengan pesan: *"pasang skill dentsweb-motion dari zip ini ke folder
   skill-ku. Kalau sudah ada versi lama, ganti dengan yang ini."*
   Manual: ekstrak, lalu salin folder `dentsweb-motion` ke `~/.claude/skills/` (timpa yang lama).
3. Mulai chat baru, lalu tanya: *"skill dentsweb-motion versi berapa yang aktif?"* → harus **2.3.0**.

Butuh: Google Chrome, Python 3, dan ffmpeg (Mac: `brew install ffmpeg`, Windows:
`winget install Gyan.FFmpeg`). Untuk suara: plugin ElevenLabs di Kustomisasi → Konektor.

> Punya skill lain untuk motion graphic yang terpasang bersamaan? Sebaiknya pakai salah satu saja,
> supaya Claude tidak bingung memilih.

## Cara pakai

Cukup ngobrol:
- *"bikin video 9:16 gaya isometrik dibongkar: gimana kulkas bikin dingin, 40 detik, pakai suara"*
- *"bikin promo 15 detik untuk kopi susu Kopi Teras, warna brand hijau tua, ini logonya"*
- *"bikin video sejarah 3D tentang Mercusuar Alexandria"*
- *"pakai gaya ini"* + kirim gambar contoh
- *"pakai mode cerita: cerita horor 60 detik tentang mercusuar yang lampunya menyala lagi"*

Revisi cukup satu kalimat: *"adegan 2 kelamaan"*, *"kurang detail"*, *"ganti suaranya lebih
semangat"*, *"balikin yang tadi"*.

## Isi

```
One-line-motion/
  SKILL.md                 alur kerja (dibaca Claude)
  references/              aturan video, mesin, suara, revisi, racik gaya, resep tiap gaya
  references/galeri/       80 gaya tambahan + katalog (README.md)
  assets/mesin/            mesin adegan + contoh dasar 2D & 3D
  assets/gaya/<gaya>/      contoh adegan tiap gaya
  scripts/mf.py            alat kerja proyek
```

## Lisensi

Lisensi Pembeli DENTSWEB MOTION — lihat `LICENSE`. Video yang kamu buat sepenuhnya milikmu.
