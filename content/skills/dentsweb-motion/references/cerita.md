# Mode Cerita — cerita fiktif di atas gaya mana pun

Mode cerita **bukan gaya**. Ia lapisan di atas gaya bawaan: gaya mengatur *tampilan*, mode cerita
mengatur *alur, tokoh, shot, dan suara*. Dibaca setiap kali user minta cerita fiktif: cerpen,
horor, misteri, dongeng karangan, drama, kisah "POV", cerita bersambung (Part 1, 2, …), fabel,
atau legenda yang diceritakan ulang.

Semua langkah di SKILL.md bagian 2 tetap berlaku. Yang berubah ditulis di bawah.

## 1. Brief: 4 tambahan

Tanyakan bersama 5 hal brief (tetap **satu** pesan), dengan default terisi:

| Hal | Default bila "terserah" |
|---|---|
| Genre & nada (horor, misteri, haru, lucu, petualangan, romansa ringan) | dari topik |
| Tokoh utama (siapa, maunya apa, apa yang menghalangi) | 1 tokoh utama + 1 lawan/pendamping |
| Ending: twist, haru, lucu, atau menggantung (untuk seri) | twist |
| Sekali tamat atau seri | sekali tamat |

Durasi bawaan cerita **45–60 dtk** (cerita butuh ruang lebih dari explainer); seri per bagian 45–60 dtk.

## 2. Pilih gaya untuk genre

Tawarkan 3 seperti biasa, dengan peta ini sebagai pegangan:

| Genre | Gaya rekomendasi | Catatan |
|---|---|---|
| Horor, misteri, kriminal | `dunia-2d` varian `noir` | tokoh siluet justru menambah seram |
| Dongeng, fabel, legenda | `dunia-2d` varian `catair` atau `ukiran` | hewan/tokoh boleh berwajah sederhana |
| Drama, haru, petualangan anime | `dunia-2d` varian `anime` | close-up wajah boleh (lihat bagian 4) |
| Komedi, slice of life, cerita sekolah/kantor | `kartun-cel` | balon kata + lip-sync sudah tersedia |
| Kisah di masa lalu (kapal, kota kuno) | `sejarah-3d` | manusia tetap jauh/siluet; cerita dibawa narator |
| Cerita rakyat, mitos | galeri: `shadow-puppet`, `woodcut`, `papercut-red` | baca `galeri/README.md` dulu |
| Dongeng anak, sebelum tidur | galeri: `crayon-book`, `paper-popup` | — |
| Horor found footage | galeri: `backrooms` | — |
| Petualangan fantasi, gim | galeri: `hd-2d`, `pixel-rpg` | — |
| Komedi retro | galeri: `rubber-hose`, `silent-film`, `scifi-toon` | — |
| Gaya lain | racik dengan `racik-gaya.md` | — |

**Pengecualian resep:** di mode cerita, aturan "tokoh = siluet tanpa wajah" di `dunia-2d` boleh
dilonggarkan untuk tokoh utama saat close-up (wajah sederhana sesuai varian: anime bermata, noir
setengah wajah tertimpa bayangan, cat air bermata titik). Tokoh latar tetap siluet. Sebut satu
kalimat ke user.

## 3. Lembar tokoh — `tokoh.md`

Ditulis setelah `gaya.md`, sebelum gambar uji. Satu blok per tokoh (maks. 3 tokoh bicara):

```markdown
## Raka (tokoh utama)
- Umur & peran: 17, anak penjaga mercusuar
- Mau apa / takut apa: ingin tahu cahaya di laut · takut gelap
- Ciri tetap: rambut hitam berantakan, jaket kuning #F2B233 (warna penanda), syal merah
- Siluet khas: syal berkibar ke kanan (terbaca walau tokoh kecil)
- Suara: <nama> (<id>), cara bicara pendek & ragu
- Warna subtitle: #F2B233
```

- **Warna penanda** satu per tokoh, dipakai di baju, label nama, dan subtitle. Penonton
  mengenali tokoh dari warna, terutama di layar HP.
- **Seri wajib konsisten**: `tokoh.md` disalin ke bagian berikutnya tanpa diubah (wajah, warna,
  suara). Ini mengalahkan aturan "tiap video berbeda".

## 4. Alur cerita

Kerangka 45–60 dtk (geser detik mengikuti suara):

| Detik | Babak | Isi | Shot |
|---|---|---|---|
| 0–3 | **Hook di tengah kejadian** | mulai dari momen paling ganjil/tegang, bukan "Pada suatu hari" | close-up benda/wajah → tarik balik |
| 3–10 | Dunia & tokoh | siapa, di mana, maunya apa (1–2 kalimat) | lebar (establishing) → sedang |
| 10–20 | Pemicu | sesuatu terjadi yang memaksa tokoh bergerak | sedang, kamera mendorong |
| 20–38 | Naik tegang | 2–3 rintangan, tiap rintangan lebih berat; ganti shot tiap 2–4 dtk | bergantian lebar/dekat/reaksi |
| 38–48 | Klimaks | keputusan atau konfrontasi; beri ±2,5 dtk hening/lambat | close-up wajah, zoom kejut |
| 48–55 | Twist / akhir | satu informasi baru yang membalik makna hook | insert benda kunci dari hook |
| 55–60 | Penutup | kalimat pamungkas + pertanyaan ke penonton (atau "bersambung") | crane mundur / gelap |

Aturan menulis:
- **Tunjukkan, jangan jelaskan.** Narator tidak bilang "Raka takut"; layar menunjukkan tangan
  gemetar. Narator hanya mengisi yang tak bisa digambar (waktu, rahasia, isi pikiran).
- **Hook dan twist bersambung**: benda/kalimat di detik 0–3 muncul lagi di twist (tanam → panen).
- **Satu tokoh, satu keinginan, satu rintangan besar.** Jangan subplot di video pendek.
- Seri: akhiri tiap bagian dengan pertanyaan yang belum terjawab; buka bagian berikutnya
  dengan rekap 1 kalimat (≤3 dtk).

## 5. Bahasa shot

Setiap baris naskah diberi jenis shot:
`LEBAR` (lokasi) · `SEDANG` (tokoh setengah badan) · `DEKAT` (wajah) · `INSERT` (benda kunci
layar penuh) · `REAKSI` (tokoh yang mendengar) · `POV` (dari mata tokoh).

- Ganti shot lewat kamera yang bergerak/menyambung (whip pan, match cut benda, menembus kabut),
  bukan potong keras berturut-turut — tetap "video, bukan slide".
- **Kontinuitas**: arah pandang tokoh konsisten (A selalu di kiri menghadap kanan saat dialog),
  waktu hari & cuaca tidak melompat tanpa alasan, warna penanda selalu ada.
- Dialog = shot/reverse-shot, kamera mendorong ke yang bicara; yang mendengar tetap bereaksi.

## 6. Naskah cerita — `naskah.md`

Tambah kolom penutur dan shot:

```markdown
| # | Shot | Yang terlihat | Penutur | Kalimat | ±dtk |
|---|---|---|---|---|---|
| 1 | DEKAT | lampu mercusuar berkedip tiga kali, padahal sudah mati | NARATOR | Lampu itu sudah mati sepuluh tahun. | 2.5 |
| 2 | REAKSI | Raka menurunkan senter pelan | RAKA | [whispers] Terus... siapa yang nyalain? | 2 |
```

- Satu baris = satu klip suara (satu penutur per klip).
- Dialog ±13 huruf/dtk, narasi ±2,6 kata/dtk. 60 dtk ≈ 600–700 huruf.

## 7. Suara

Ikuti `suara-elevenlabs.md`, dengan tambahan:
- **Narator + maks. 2 suara tokoh.** Suara dibedakan jelas (umur/jenis kelamin/warna suara).
  Catat semua id di kepala `naskah.md` dan di `tokoh.md`.
- Tes dulu **satu baris tiap suara** (bukan hanya adegan 1), supaya user setuju semua pemeran.
- Nada lewat tag v4 seperlunya: `[whispers]`, `[scared]`, `[laughs]`, `[pause]`, `[sad]`.
- Nama klip: `vo-01-narator.mp3`, `vo-02-raka.mp3`, …
- **Suasana boleh lebih kaya** dari explainer: satu ambience pelan sepanjang adegan (angin, ombak,
  hujan, vol .15–.25) + efek momen di jeda. Musik boleh untuk genre emosional (haru, horor), vol ≤ .12,
  dan diam 1–2 dtk sebelum klimaks/twist.
- Subtitle: dialog tokoh ditulis dengan tanda kutip di `teks` (`"Terus... siapa yang nyalain?"`)
  supaya terbedakan dari narasi. Di `kartun-cel`, pakai balon kata + `s:'B'`. Bila gayanya punya
  subtitle sendiri (komik noir, sobekan kertas), warnai frasa dengan warna penanda penuturnya.

## 8. Gambar uji

Potret adegan 1 seperti biasa, **plus satu potret close-up tokoh utama** (pakai detik saat ia
paling dekat kamera). User menyetujui wajah & warna tokoh di sini, karena tokoh paling mahal
diganti belakangan.

## 9. Isi & kejujuran

- Dunia cerita boleh dikarang; **fakta dunia nyata yang disebut tetap harus benar** (aturan video
  #7 tetap berlaku untuk klaim nyata).
- Cerita yang meniru gaya "kisah nyata" atau memakai tempat/peristiwa nyata → beri tanda kecil
  "cerita fiksi" di awal atau akhir. Tidak memakai nama orang nyata sebagai pelaku jahat.
- Horor/kriminal: seram lewat suasana, bayangan, dan suara — tanpa darah, luka, atau jenazah.
- Bukan cerita ulang film/novel/game yang ada (tokoh, nama, adegan khasnya). Legenda rakyat boleh.

## 10. Checklist mode cerita

- [ ] Brief punya genre, tokoh utama + keinginannya, jenis ending, sekali/seri
- [ ] `tokoh.md` ada; warna penanda & suara tiap tokoh tercatat
- [ ] Hook dimulai di tengah kejadian; twist memanen benda/kalimat dari hook
- [ ] Tiap baris naskah punya shot & penutur; tidak ada narasi yang menjelaskan hal yang terlihat
- [ ] Kontinuitas: arah pandang, waktu hari, warna penanda konsisten antar-adegan
- [ ] Semua suara tokoh dites dulu; ambience & musik tidak menutupi kata
- [ ] Seri: `tokoh.md`, gaya, dan suara sama dengan bagian sebelumnya
