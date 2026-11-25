# Galeri Gaya — 80 gaya tambahan

Resep gaya dari pustaka **Lemo-Opuscar** karya LemoLab (MIT · https://github.com/lemomo-ai/lemo-opuscar),
disertakan di skill ini dan dipakai lewat mesin DENTSWEB MOTION. Tiap gaya = satu file `<id>.md`
(bahasa Inggris, isi asli tidak diubah). 66 gaya utama + 14 Gaya Film dari OPUSCAR 98. Baca bagian **Cara pakai** dulu, lalu file gayanya.

## Cara pakai di mesin DENTSWEB MOTION

Resep galeri ditulis untuk mesin Lemo-Opuscar. Ambil **rasa gayanya**, kerjakan dengan alur & mesin kita:

1. **Pakai bagian 1–9 & 11** (esensi, material, warna, tipografi, gerak, kamera, suara, gerak khas,
   jebakan, variasi). Tulis ringkasannya ke `gaya.md` seperti gaya bawaan.
2. **Lewati bagian "Engine"** dan semua rujukan ke `engine.js`, `core/`, `lib.js`, `demo/`, `DEMO.md`,
   `setup.sh`, `$LIB`, Kokoro/Edge TTS, sampler/pluck musik, dan skrip unduh. Penggantinya:
   - proyek: `mf.py baru <proyek> --dasar 2d` (canvas) atau `--dasar 3d` (three.js) — pilih dari teknik
     yang disebut resepnya; semua gerak dihitung dari `t` (aturan emas mesin).
   - suara: VO & efek suara ElevenLabs (`suara-elevenlabs.md`); "Sound palette" dipakai sebagai
     bahan prompt efek suara/musik, bukan alat musiknya.
   - subtitle per kata mesin kita (`SCENE.kata`), gaya visual subtitle diambil dari resep.
3. **Ukuran**: resep ditulis untuk 1920×1080. Bawaan kita 9:16 — tata ulang komposisi ke layar tegak
   dan zona aman (`AMAN`); ukuran huruf ikut aturan video kita.
4. **Bahasa**: teks layar & VO bahasa Indonesia. Abaikan aturan teks/subtitle Mandarin.
5. **Gaya bertanda ⚠ bahan nyata** aslinya memotong rekaman, dokumen, foto, atau data nyata. Minta
   bahan dari user, atau sebutkan sumber berlisensi bebas yang akan dipakai dan **minta izin sebelum
   mengunduh**. Tanpa bahan, bangun versi gambar-kode dan katakan satu kalimat ke user.
6. Gaya galeri juga ikut alur 8 langkah, gambar uji adegan 1, dan checklist bagian 6 SKILL.md.
   Mode Cerita (`cerita.md`) bisa dipasang di atas gaya galeri mana pun.

Saat menawarkan 3 gaya (langkah 2), gaya galeri boleh ikut ditawarkan bila lebih cocok dengan topik.

## Daftar gaya

### Montase & Dokumenter

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `caption-news` | Berita Berteks ⚠ bahan nyata | Caption News | berita medsos, explainer laporan, data singkat |
| `city-symphony` | Simfoni Time-lapse ⚠ bahan nyata | Time-lapse Symphony | film kota, montase musik, pembuka |
| `countdown` | Hitung Mundur Layar Terbelah ⚠ bahan nyata | Live Countdown Split-screen | peluncuran, hitung mundur, acara live |
| `kino-montage` | Montase Konstruktivis ⚠ bahan nyata | Constructivist Montage | sejarah industri, tonggak sejarah, kerja bersama |
| `news-package` | Paket Berita TV ⚠ bahan nyata | Broadcast News Package | rangkuman berita, buletin, update pasar |
| `newsreel` | Newsreel 1920-an ⚠ bahan nyata | 1920s Newsreel | kisah sejarah, tren zaman dulu, peringatan |
| `telestrator` | Papan Taktik Olahraga ⚠ bahan nyata | Sports Telestrator | analisis olahraga, rekap pertandingan, kepelatihan |
| `visual-investigation` | Investigasi Visual ⚠ bahan nyata | Visual Investigation | rekonstruksi kejadian, cek fakta, laporan insiden |

### Film Bukti

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `archive-lighttable` | Meja Lampu Arsip ⚠ bahan nyata | Archive Light Table | sejarah merek, kisah arsip, museum |
| `briefing-board` | Papan Briefing Teknik ⚠ bahan nyata | Engineering Briefing Board | teknik, perbandingan opsi, briefing |
| `data-physical` | Data Jadi Benda ⚠ bahan nyata | Data Physicalization | laporan tahunan, deck investor, data energi |
| `lidar-survey` | Survei LiDAR ⚠ bahan nyata | LiDAR Survey | cagar budaya, lingkungan, survei lokasi |
| `microscope` | Cerita Mikroskop ⚠ bahan nyata | Microscope Story | biomedis, sains material, sains skincare |
| `satellite-briefing` | Briefing Satelit ⚠ bahan nyata | Satellite Briefing | iklim, explainer berita, geografi |
| `teardown` | Bongkar Produk Melayang ⚠ bahan nyata | Exploded Teardown | peluncuran perangkat, halaman produk, explainer spesifikasi |
| `white-model` | Proyeksi di Maket Putih ⚠ bahan nyata | Projection on White Model | tata kota, pameran, data kota |

### Gambar Tangan & Lukisan

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `chalkboard` | Papan Kapur | Chalkboard | asal-usul kata, mitos vs fakta, pelajaran |
| `crayon-book` | Buku Bergambar Krayon | Crayon Picture Book | buku cerita, dongeng sebelum tidur, belajar anak |
| `impasto` | Lukisan Cat Minyak Tebal | Impasto Oil Painting | video musik, seni & budaya, iklan emosional |
| `ink-wash` | Lukisan Tinta Cina | Chinese Ink Wash | silat/wuxia, merek budaya, puisi |
| `one-line` | Gambar Satu Garis | One-line Drawing | cerita merek, tonggak hidup, iklan minimalis |
| `urban-sketch` | Sketsa Kota Pena & Cat Air | Urban Sketch · Pen & Wash | kota & perjalanan, arsitektur, merek gaya hidup |
| `watercolor` | Kuas Cat Air | Watercolor Brush | dokumenter alam, perjalanan, explainer sains |
| `whiteboard` | Penjelasan Papan Tulis | Whiteboard Explainer | explainer, kursus online, sains |

### Tradisi Asia Timur

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `paper-lantern` | Kotak Lampu Kertas | Paper-cut Lightbox | perjalanan, perpisahan & peringatan, kisah tempat |
| `papercut-red` | Guntingan Kertas Merah | Red Paper-cut | Imlek, ucapan hari raya, cerita rakyat |
| `shadow-puppet` | Wayang Kulit Bayangan | Shadow Puppetry | mitos & cerita rakyat, warisan budaya, festival |
| `ukiyoe` | Ukiyo-e | Ukiyo-e | perjalanan, budaya Jepang, puisi |

### Cetak & Grafis

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `engraving` | Ukiran Pelat Tembaga | Copperplate Engraving | label museum, explainer sains, warisan merek |
| `halftone-dossier` | Berkas Halftone Retro | Halftone Dossier | humor, konten hewan peliharaan, video pendek |
| `printed-long-take` | Long Take Cetak | Printed Long Take | perjalanan, satwa liar, lanskap |
| `risograph` | Cetak Risograph | Risograph Print | merek indie, zine, gaya hidup |
| `silkscreen-poster` | Poster Wisata Sablon | Silkscreen Travel Poster | panduan destinasi, pariwisata, poster acara |
| `woodcut` | Cetak Cukil Kayu | Woodcut Print | cerita rakyat, merek kerajinan, trailer buku |

### Grafis & Tipografi

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `art-deco` | Art Deco | Art Deco | hotel & barang mewah, gala, undangan |
| `ascii-crt` | Terminal ASCII / CRT | ASCII / CRT Terminal | alat developer, fiksi ilmiah, merek teknologi |
| `blueprint` | Cetak Biru | Blueprint | teknik, peluncuran perangkat, explainer teknologi |
| `pictogram-motion` | Piktogram Bergerak | Pictogram Motion | layanan publik & kota, identitas acara, explainer lewat tanda |
| `spy-titles` | Pembuka Film Mata-mata 60-an | 60s Spy Title Sequence | title sequence, pembuka acara, trailer |
| `stained-glass` | Kaca Patri | Stained Glass | legenda, warisan budaya, cerita hari raya |
| `swiss-motion` | Motion Grafis Swiss | Swiss Motion Graphics | identitas merek, acara, edukasi desain |

### Material & 3D

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `brick-toy` | Mainan Balok | Brick Toy | mainan & anak, rakitan produk, luar angkasa |
| `desktop-flythrough` | Terbang Menyusuri Desktop | Desktop Flythrough | explainer aplikasi, alur kerja, produk |
| `glass-product` | Render Produk Kaca | Glass Product Render | peluncuran produk, gadget, kecantikan |
| `lowpoly-island` | Pulau Low-poly Isometrik | Low-poly Isometric Island | trailer gim, membangun dunia, konten santai |
| `memphis-diorama` | Diorama Memphis | Memphis Diorama | hero website, loop suasana, musim |
| `paper-popup` | Buku Pop-up Kertas | Paper Pop-up Book | buku anak, trailer gim, film cerita |
| `tilt-shift` | Miniatur Tilt-Shift | Tilt-Shift Miniature | promo kota, properti, transportasi |

### Kartun & Anime

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `cel-anime-80s` | Anime Cel 80-an | 80s Cel Anime | video musik, trailer gim, nostalgia |
| `midcentury-toon` | Kartun Pertengahan Abad | Mid-century Cartoon | panduan setup, pusat bantuan, tutorial |
| `rubber-hose` | Kartun Rubber Hose 1930-an | 1930s Rubber Hose Cartoon | makanan & minuman, iklan retro, anak |
| `scifi-toon` | Kartun Sitkom Sci-fi | Sci-Fi Sitcom Toon | komedi, merek teknologi, video pendek |

### Informasi & Presentasi

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `circuit-board` | Papan Sirkuit | Circuit Board | energi, rantai pasok, perangkat |
| `dark-keynote` | Keynote Teknologi Gelap | Dark Tech Keynote | peluncuran produk, SaaS, presentasi |
| `dataviz` | Bercerita dengan Data | Data Storytelling | jurnalisme data, laporan, iklim & sains |
| `hologram-hud` | HUD Hologram Sci-fi | Sci-fi Hologram HUD | bedah spesifikasi, video peluncuran, pameran |
| `iso-infographic` | Infografis Isometrik | Isometric Infographic | explainer proses, rantai pasok, laporan tahunan |
| `isometric-picture-book` | Buku Bergambar Isometrik | Isometric Picture Book | aturan sehari-hari, antrean, perbandingan |
| `living-screencast` | Screencast Hidup | Living Screencast | tutorial produk, peluncuran fitur, onboarding |
| `transit-map` | Peta Jalur Transit | Transit Map | transportasi, pertumbuhan dari waktu ke waktu, jaringan |

### Gim

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `game-show` | Kuis TV Datar | Game Show Flat | linimasa teknologi, kilas balik tahunan, acara variety |
| `hd-2d` | HD-2D | HD-2D | trailer gim, fantasi, film cerita |
| `microgame` | Kegilaan Gim Mini | Microgame Frenzy | trailer gim, onboarding, video pendek |
| `pixel-rpg` | RPG Piksel 16-bit | 16-bit Pixel RPG | trailer gim, rekap, nostalgia |

### Sinema & Era

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `backrooms` | Rekaman Ruang Liminal | Liminal Found Footage | horor, misteri, teaser gim |
| `silent-film` | Film Bisu 1920-an | 1920s Silent Film | komedi, merek retro, cerita tanpa suara |

### Gaya Film (dari OPUSCAR 98)

Resep satu paragraf — kembangkan dulu jadi `gaya.md` sebelum gambar uji.

| id | Gaya | Nama asli | Cocok untuk |
|---|---|---|---|
| `arang-gotik` | Arang Gotik | Gothic Charcoal Drawing | misteri, horor klasik, kisah rumah tua |
| `mesin-ketik` | Gambar Mesin Ketik | Typewriter Character Art | noir, cerita detektif, surat & kutipan |
| `poster-huruf-kayu` | Poster Huruf Kayu | Wood-Type Campaign Poster | kampanye, pengumuman, sejarah politik |
| `teater-kertas` | Teater Kertas Victoria | Victorian Toy Theatre | dongeng, musikal, cerita anak klasik |
| `cetak-blok` | Cetak Blok Tangan Rajasthan | Rajasthani Hand Block Print | budaya, perjalanan, kisah tokoh |
| `album-polaroid` | Album Foto Polaroid | Family Album Polaroids | kenangan keluarga, nostalgia, perjalanan hidup |
| `gongbi-sutra` | Lukisan Gongbi di Sutra | Gongbi Court Painting on Silk | sejarah istana, budaya Tionghoa, legenda |
| `manuskrip-iluminasi` | Manuskrip Iluminasi Emas | Illuminated Manuscript with Gold Leaf | legenda, sejarah abad pertengahan, kisah religi |
| `mosaik-romawi` | Mosaik Lantai Romawi | Roman Floor Mosaic | sejarah kuno, mitologi, arsitektur |
| `arcade-tarung` | Gim Tarung Arcade 16-bit | 16-bit Arcade Fighting Game | olahraga, persaingan, nostalgia gim |
| `dagerotipe` | Dagerotipe Antik | Cased Daguerreotype, Developing | sejarah abad 19, potret tokoh, arsip keluarga |
| `potongan-arsitektur` | Potongan Arsitektur Aksonometri | Architectural Section Axonometric | rumah & arsitektur, tata ruang, properti |
| `pastel-senja` | Pastel Lembut Senja | Magic-Hour Soft Pastel | perjalanan, lanskap, cerita reflektif |
| `scrimshaw` | Ukiran Scrimshaw | Scrimshaw on a Whale Tooth | kisah laut, nelayan, sejarah maritim |
