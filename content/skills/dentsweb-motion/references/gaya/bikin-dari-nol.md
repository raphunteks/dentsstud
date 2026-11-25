# Gaya: Bikin dari Nol

> Penonton diajak "membuat ulang" sebuah alat dari nol lewat satu tokoh sederhana. Tokoh punya masalah, mencoba solusi paling gampang, **gagal** ("tapi…" / "masalahnya…"), memperbaiki, gagal lagi… sampai yang ia rakit ternyata persis alat yang dijual di toko. Penonton tidak diceramahi. Mereka menebak bersama tokoh, dan tiap kegagalan menjelaskan satu bagian alat. Visualnya 3D semi-realistis bersih, kamera perspektif setinggi mata, tanah atau dinding depan terpotong supaya isinya terlihat. Video asli kami: "Air kolam koi kok hijau?" (70 dtk, YouTube Shorts `wZBTqAscL_U`).

Contoh siap pakai: `assets/gaya/bikin-dari-nol/scene.html`. Ini video kolam koi lengkap 70 dtk, jalan tanpa file suara (subtitle dari `kata.js`).

Acuan rasa pola ceritanya adalah akun-akun "how it's made from scratch" (mis. @howcomeid). Ambil **polanya** saja. Isi, tokoh, dan visual dibuat sendiri, jangan meniru adegan atau tampilan akun mana pun.

## Cocok untuk · tidak cocok untuk
**Cocok:** "kenapa alat X bentuknya begitu", alat yang lahir dari serangkaian masalah: filter kolam/akuarium, septic tank, penangkal petir, AC, kulkas, rice cooker, termos, water heater, sumur bor, tandon + pompa, talang air, kompor gas, jemuran, rem sepeda, lampu lalu lintas, kunci pintu. Juga topik "kenapa cara sederhana tidak cukup" (kenapa kabel perlu ground, kenapa rumah perlu MCB).
**Tidak cocok:** alat yang tidak punya cerita "coba → gagal" (mis. benda yang langsung jadi), sejarah atau peristiwa, data abstrak, cerita fiktif penuh drama (pakai Mode Cerita). Kalau topiknya murni "isi alat ini apa", **Isometrik Dibongkar** lebih cocok.

## Pola cerita (WAJIB, ini inti gayanya)
1. **Hook "Kalau kamu…"** (0–8 dtk) yang membantah anggapan gampang: *"Kalau kamu bikin kolam koi, cukup gali lubang, isi air, masukin ikan, beres, kan? Seminggu kemudian, airnya hijau."* Tokoh melakukan cara naif itu di layar, lalu masalahnya terlihat (chip waktu "SEMINGGU KEMUDIAN").
2. **Kenapa masalahnya terjadi** (1 kalimat, boleh pakai lingkaran pembesar): *"Hijaunya itu alga, tumbuhan super kecil…"*
3. **3–4 putaran coba → gagal.** Tiap putaran adalah satu bagian alat:
   - solusi diucapkan dengan **"Jadi, …" / "Terus, …" / "Solusi gampang: …"**, lalu tokoh langsung memasangnya;
   - hasilnya kelihatan berhasil sebentar;
   - kegagalan diucapkan dengan **"Tapi …" / "Masalahnya, …"**. Pada kata itu muncul **✕ merah besar** + bunyi tik;
   - penyebab gagal dijelaskan singkat, dan penyebab itu yang memicu solusi berikutnya.
4. **Solusi terakhir berhasil** (tanpa ✕). Perubahan besar terlihat, misalnya air bening lagi.
5. **Penutup "ternyata"**: semua bagian yang tadi dipasang menyatu jadi alat asli (rumah filter, casing), lalu kamera mundur. Sebutkan ulang nama bagiannya, lalu kalimat *"Selamat, kamu baru aja bikin ulang [alat] yang dijual di toko."*
6. Tanpa CTA di akhir (kecuali user minta). Ajakan komentar ditaruh di caption.

Kata penghubung yang diulang supaya pola terasa: *tapi, masalahnya, jadi, terus*. Satu kalimat VO = satu aksi tokoh. Jangan menjelaskan bagian alat sebelum tokoh "butuh" bagian itu.

## Ciri wajib (visual)
1. **Kamera perspektif setinggi mata** (fov ±30°), agak di atas tokoh (elevasi 15–20°), azimut 25–35°, jarak 100–135 satuan. Kamera **selalu bergerak pelan** lewat tabel kunci `KK=[[detik,[target],jarak,azimut,elevasi],…]` dengan smootherstep. Bukan isometrik, bukan studio gelap.
2. **Satu set, dipotong depannya.** Seluruh video terjadi di SATU tempat (taman belakang, dapur, atap, kamar mandi). Tanah, lantai, atau dinding depan dipotong rata sehingga isi alat terlihat dari samping, dan potongannya memperlihatkan lapisan (rumput → tanah → tanah liat → batu). Lingkungan hidup: rumput dan daun bergoyang, pagar, pot, batu, pohon.
3. **Satu tokoh sederhana** dibuat dari kode (`orang()`). Kepala bulat, kulit sawo matang, kaos polos berwarna, celana krem, rambut gelap. Wajah sederhana: mata titik + alis, tanpa mulut detail. Gerak lewat `pose()`: bungkuk, jalan, ayun lengan, garuk kepala, tolak pinggang, menuang. Tokoh selalu ada di frame dan **tidak boleh terpotong tepi layar**. Kalau kamera bergeser, tokoh ikut pindah (jalan ke belakang alat). Kaos boleh diberi logo user (`assets/gambar/watermark.png`) atau teks `KAOS_TEKS`.
4. **Alat dirakit satu per satu di depan kamera.** Tiap bagian muncul dengan `E.back` (membal kecil) pas kata solusinya diucapkan. Komponen penting ditaruh di sisi DEPAN yang menghadap kamera, jangan tertutup bagian lain atau tokoh.
5. **Perubahan keadaan yang terlihat** = tanda tangan gerak. Contoh: air bening → hijau (`tabel(HJ,t)`), butir kotoran berputar, awan racun kuning, ikan lemas di dasar. Penonton harus bisa melihat gagal/berhasil tanpa mendengar suara.
6. **✕ merah** besar (230 px, garis putih tebal, miring −6°) muncul di tiap "tapi/masalahnya", membesar dari 1,8× ke 1×, hilang setelah ±1 dtk. Taruh di atas kepala tokoh (top ±620 px). Jangan menutup wajah atau pusat aksi.
7. **Lingkaran pembesar `#lup`** (500 px, cincin putih) untuk hal yang terlalu kecil: alga, bakteri, molekul. Gambarnya 2D canvas di dalam lingkaran, dengan judul besar + baris kecil di bawahnya.
8. **Chip waktu kuning** di tengah atas ("SEMINGGU KEMUDIAN", "HARI 1/2/3") untuk lompatan waktu.
9. **Label tanpa kotak**: titik kuning + garis putih + teks Red Hat Mono 40 px HURUF BESAR, baris kedua Outfit 32 px. Label besar (`big`) Outfit 900 62 px kuning untuk nama bagian alat. Maksimal 2 label sekaligus.
10. **Subtitle kecil** Outfit 800 56 px, putih bergaris bayangan, maks 3 kata, `y:.66`. **Kata kunci dalam pil kuning** dengan teks gelap (CSS `#mfSub .sw[style*="color"]{…}` sudah ada di contoh; isi `SCENE.sub.kunci` dengan kata persis seperti di `kata.js`, termasuk tanda baca).
11. Fakta di layar = fakta di naskah. Tanpa merek atau logo pihak lain. Watermark user di kanan bawah.

## Palet & font bawaan ("Taman Siang")
| Bagian | Warna |
|---|---|
| Langit | `#BFDDF2 → #E9F1F2 → #F4ECDA` |
| Rumput / tanah / tanah liat | `#6F9A48` / `#6E4F33` / `#9A6A42` |
| Air bening → keruh | `#5FB8C9` → `#4E8F3A` |
| Aliran (butir) | `#5FD6FF` |
| Aksen (pil, chip, label besar) | `#FFD23F`, teks gelap `#1D1A10` |
| ✕ | `#FF3B30`, garis `#FFFFFF`, bayangan `#9A1A12` |

Font: **Outfit** 600/800/900 (judul, subtitle) + **Red Hat Mono** 700 (label, chip).

## Yang boleh berubah per video (supaya tidak kembar)
| Set | Tempat | Langit / latar | Aksen | Kaos tokoh |
|---|---|---|---|---|
| **taman** (bawaan) | taman belakang | biru siang `#BFDDF2…` | kuning `#FFD23F` | hijau `#3F8F5A` |
| **dapur** | dapur rumah, lantai keramik terpotong | krem hangat `#F3E6D2 → #FBF5EC` | oranye `#FF9F43` | biru `#3C6E9E` |
| **atap** | atap/teras + langit sore | jingga `#F6C8A0 → #F9E7D2` | toska `#2EC4B6` | merah bata `#B5523B` |

Tokoh boleh diganti (nama, warna kaos, perempuan berkerudung, anak sekolah). Untuk **seri** (Part 1, 2…) tokoh, palet, dan set WAJIB tetap sama.

## Kerangka adegan Shorts 55–75 dtk
| Detik | Isi | Kamera |
|---|---|---|
| 0–8 | Hook "Kalau kamu…": tokoh melakukan cara naif → chip waktu → masalah terlihat, tokoh garuk kepala | jarak 132 → 112, azimut 30 → 26 |
| 8–15 | Kenapa: lingkaran pembesar + 1 kalimat | dorong pelan ke pusat masalah |
| 15–22 | Putaran 1 (solusi gampang) → ✕ | ikut tokoh |
| 22–28 | Putaran 2 → ✕ | geser ke alat baru |
| 28–40 | Putaran 3 → kelihatan berhasil → ✕ (masalah tersembunyi, pakai visual "racun tak terlihat") | sedikit mendekat |
| 40–52 | Putaran 4 → ✕ ironis ("…itu pupuk buat alga") | |
| 52–61 | Solusi terakhir berhasil, keadaan pulih | orbit pelan |
| 61–71 | "Ternyata": bagian menyatu jadi alat asli, sorot bagian satu per satu, kamera mundur | jarak naik ke 135+ |

## Naskah contoh (kolam koi, 7 klip VO)
```
[curious] Kalau kamu bikin kolam koi, cukup gali lubang, isi air, masukin ikan, beres, kan? Seminggu kemudian, airnya hijau.
Hijaunya itu alga, tumbuhan super kecil yang makan sinar matahari dan kotoran ikan. Solusi gampang: kuras dan ganti air tiap hari. Tapi capek, dan kaporit air keran bikin ikan stres.
Jadi, pasang pompa biar airnya muter. Masalahnya, kotorannya cuma ikut keaduk.
Terus, tambahin saringan busa. Kotoran nyangkut, airnya kelihatan jernih. Tapi ikannya malah lemas. Kotoran ikan ngeluarin amonia, racun yang nggak bisa disaring busa.
Jadi, tambahin batu berpori. Di situ tinggal bakteri baik yang ngubah amonia jadi nitrat, yang jauh lebih aman. Masalahnya, nitrat itu pupuk… buat alga.
Terus, pasang lampu yu vi di jalur air. Alganya menggumpal dan ketangkep saringan. Tambah teratai, biar alga kalah rebutan makanan.
Busa, batu berpori, lampu yu vi. Selamat, kamu baru aja bikin ulang filter kolam yang dijual di toko.
```
Singkatan ditulis seperti diucapkan di teks suara ("UV" → "yu vi"). Subtitle tetap memakai ejaan aslinya.

## Suara
- VO ElevenLabs `eleven_v4`, nada santai seperti teman bercerita, sedikit heran di hook. Tag `[curious]` di kalimat pertama saja. Satu klip per putaran (6–8 klip).
- SFX hemat: "buka/pop" kecil tiap alat muncul, tik di tiap ✕, satu bunyi saat lompatan waktu. Volume 0,18–0,34, diletakkan di jeda VO.
- Tanpa musik (atau sangat pelan ±0,08) supaya VO bercerita terdengar dekat.

## Cara membangun
1. `python3 scripts/mf.py baru <proyek> --dasar bikin-dari-nol` menyalin video kolam koi lengkap + `kata.js`, lalu `mf.py potret <proyek> --t 2,7.5,30` untuk melihat.
2. Peta `scene.html`: **WAKTU** (semua detik, termasuk `silang:[…]` untuk ✕) · **ALAT 3D** (`bhn`, `pasang`, `kotak`, `bubut`, `selang`, `batang`) · **TEKSTUR** (`teksturK`, `bintik`, `LAPIS` lapisan tanah) · **RENDERER & CAHAYA** · **TANAH TERPOTONG** (`blok()`, `DASAR`, batas lubang `LX0..LX1`, `LZ0..LZ1`) · **AIR** (`tinggiAir`, butir `ALGA`) · benda utama (`koi()`) · **TAMAN SEKITAR** · **TOKOH** (`orang()`, `pose()`, kaos `lukisKaos`) · **KAMERA** (`KK`) · **PERALATAN** (bagian alat per putaran + jalur pipa `JALUR_*` + butir aliran `FLOW`) · **LABEL** (`tanda()`) · **LUP** (`gambarLup`) · **ANIMASI** (`tabel(T,t)` untuk keadaan, `animBima`, `animAir`, `animAlat`) · **SCENE**.
3. Ganti topik:
   - tulis ulang set (tempat) dan benda masalah. Kerangka tanah terpotong, tokoh, kamera kunci, ✕, lup, chip, label, dan subtitle pil dipertahankan;
   - satu bagian alat per putaran: grup sendiri, muncul di `animAlat` pada detik `WAKTU.<bagian>`;
   - keadaan "gagal/berhasil" sebagai tabel angka `[[detik,nilai],…]` yang dibaca `tabel()` (warna air, jumlah kotoran, suhu…);
   - tokoh bergerak lewat `pose()` di `animBima` (ganti nama fungsi bila tokohnya lain);
   - setelah VO jadi, isi `SCENE.audio.vo` (contoh ada di komentar), set `sfx:SFX`, jalankan `mf.py kata`, lalu geser `WAKTU` ke kata "tapi/masalahnya" di `kata.js`.
4. **Framing 9:16:** tokoh + alat harus muat di antara y 360–1200 px. Subtitle (y .66 ≈ 1270 px) dan watermark ada di bawahnya. Kalau alat melebar ke kanan, tokoh dipindah ke belakang alat, jangan dibiarkan keluar layar.

## Gambar uji adegan 1
**Detik potret: `mf.py potret <proyek> --t 1.5,4.5,7.8`** (cara naif sedang dilakukan · hasil "beres" · masalah muncul + chip waktu). Periksa:
- tokoh utuh di frame, wajah terlihat, pose terbaca (bukan berdiri kaku);
- potongan tanah/dinding depan memperlihatkan ≥3 lapisan dan isi alat terlihat dari samping;
- kamera perspektif setinggi mata (garis tegak sedikit menyempit ke bawah, bukan isometrik);
- subtitle kecil dengan ≥1 pil kuning, chip waktu terbaca, tidak ada teks di bawah 30 px;
- `error halaman: tidak ada`.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Video jadi ceramah** ("ini pompa, fungsinya…") → setiap bagian harus lahir dari kegagalan sebelumnya. Cek naskah: tiap klip punya "jadi/terus" dan (kecuali yang terakhir) "tapi/masalahnya".
- **Tokoh terpotong tepi layar saat kamera geser** → jalankan tokoh ke belakang alat (z lebih kecil) sebelum kamera bergeser, cek potret di tiap kunci `KK`.
- **Bagian penting tertutup** (lampu UV di balik kotak) → pindahkan jalurnya ke sisi depan yang menghadap kamera (z besar).
- **✕ menutup wajah tokoh** → top 620 px, cek di tiap detik `WAKTU.silang`.
- **Air keruh terlalu pekat sampai ikan/isi tak terlihat** → opacity maksimal ±0,72.
- **Kaos zigzag di tepi bawah** (celana menembus kaos) → jari-jari pita celana sedikit lebih besar dari badan (1,68 vs 1,6).
- **Pil kuning tidak muncul** → kata di `SCENE.sub.kunci` harus sama persis dengan `kata.js` (huruf kecil, termasuk koma/titik), dan `sub.aksen` diisi warna apa saja (mesin memberi warna inline yang dibaca CSS pil).
- **Singkatan dibaca aneh oleh suara** ("UV" jadi "u ef pe") → tulis ejaan lisan di teks suara saja.

## Revisi cepat
- **Kurang lucu/kurang "gagal"** → perbesar reaksi tokoh (garuk kepala, bahu turun, ember jatuh) dan beri jeda 0,4 dtk sebelum ✕.
- **Kurang jelas kenapa gagal** → tambah satu visual sebab (awan racun, butir yang lolos, panah aliran) dan label besar 2–3 kata.
- **Penutup kurang "wah"** → bagian alat terbang menyatu ke satu casing dalam 1 dtk, sorot tiap bagian bergiliran (label besar), kamera mundur pelan ke seluruh set.
- **Terlalu panjang** → gabungkan dua putaran yang mirip. Minimal 3 putaran gagal supaya pola terasa.
