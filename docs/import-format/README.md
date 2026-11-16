# Format paket import katalog (schemaVersion 1)

Satu paket = satu folder dengan `manifest.json` di akarnya. Banyak paket boleh dikumpulkan dalam satu folder induk atau satu ZIP. Kontrak lengkap (sumber kebenaran): `packages/content-schema/src/index.ts`. Hasil import selalu **DRAFT**; publikasi dilakukan manual dari Content Library setelah pratinjau/test render.

Aturan umum: `slug` huruf kecil/angka/tanda hubung; semua path relatif tanpa `..`; setiap file di `files[]` wajib punya `sha256` (hex) yang cocok; tipe yang diterima: png, jpg, webp, mp4, webm, mp3, wav, ogg, json, txt, md, ttf, otf, woff2 (dicek magic byte). SVG/HTML/JS selalu ditolak.

## Preset gaya (`kind: "preset"`)
```json
{
  "schemaVersion": 1, "kind": "preset", "slug": "cetak-biru", "name": "Cetak Biru",
  "category": "infografis", "description": "Garis teknis biru di atas kertas.",
  "compatibility": { "formats": ["9:16", "16:9"] },
  "rights": { "license": "Milik studio, nonkomersial", "nonCommercialOnly": true },
  "recipe": "recipe.json",
  "files": [
    { "path": "thumbnail.png", "sha256": "<hex>", "role": "thumbnail" },
    { "path": "recipe.json", "sha256": "<hex>", "role": "recipe" }
  ]
}
```
`category` harus salah satu dari 12 slug kategori. `recipe.json`: `palette` (background, ink, accent wajib, `#RRGGBB`), `typography` (display, body, displayWeight, fontFiles), `motion` (easing, intensity 0–1, transition), `layout` (titleScale, safeArea, textAlign), `textures` opsional.

## Hook (`kind: "hook"`)
`recipe` ditulis langsung di manifest: `durationSec` 0,5–8, `style`, `text.maxWords`, `text.case`, `animation.in` (pop/slide/type/mask/scale), `animation.emphasis`, `palette` opsional.

## Suara (`kind: "voice"`)
`provider`: `gemini` | `elevenlabs` | `cadangan`; `providerVoiceId` (nama voice Gemini, `voice_id` ElevenLabs, atau id engine cadangan); `language`; `attributes` (gender, age, tone); `capabilities` (emotion, speed, pitch, instructions); `synthesis` (model, stability, similarityBoost); `sample` audio opsional. Suara hanya bisa dipublikasikan setelah test sintesis berhasil.

## Cara membuat checksum
```bash
shasum -a 256 thumbnail.png recipe.json
```
