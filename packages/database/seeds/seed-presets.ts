import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { createDatabase, styleCategories, users, visualPresets, visualPresetVersions } from '../src/index.js';

dotenv.config();
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

export const PRESETS_DATA = [
  {
    slug: 'kartun-flat',
    name: 'Kartun Flat',
    categorySlug: 'kartun',
    description: 'Explainer umum & edukasi anak dengan bentuk membulat, outline tegas, warna cerah, dan gerak spring squash & stretch.',
    music: 'ceria',
    voice: 'honeypie',
    palette: { background: '#0F1B33', accent: '#FFC93C', ink: '#FFF8EC', secondary: '#FF5C7A', highlight: '#4FC3F7' },
    typography: { display: 'Baloo 2', body: 'Nunito', displayWeight: 700 },
    motion: { intensity: 0.9, transition: 'zoom', spring: 'overshoot' },
    sfx: ['pop', 'boing', 'ding', 'whoosh'],
  },
  {
    slug: 'papan-sains',
    name: 'Papan Sains',
    categorySlug: 'infografis',
    description: 'Diagram ilmiah, rumus, proses edukatif dengan garis kapur neon tipis di atas latar biru tua dengan DrawPath.',
    music: 'tech',
    voice: 'Sikedewi',
    palette: { background: '#0B1E2D', accent: '#5CE1E6', ink: '#E8F1F2', secondary: '#123047', highlight: '#FFD166' },
    typography: { display: 'Space Grotesk', body: 'Caveat', displayWeight: 600 },
    motion: { intensity: 0.7, transition: 'fade', drawPath: true },
    sfx: ['click', 'ding', 'swoosh'],
  },
  {
    slug: 'sinematik',
    name: 'Sinematik',
    categorySlug: 'sinema',
    description: 'Fakta spektakuler, alam, dan narasi mendalam dengan 3 lapisan parallax, vignette 30%, grain 5%, dan push-in kamera halus.',
    music: 'angkasa',
    voice: 'Bram',
    palette: { background: '#08080A', accent: '#E0A96D', ink: '#ECECEE', secondary: '#1A1A24', highlight: '#7395AE' },
    typography: { display: 'Playfair Display', body: 'Inter', displayWeight: 600 },
    motion: { intensity: 0.6, transition: 'fade', parallax: true, vignette: 0.3, grain: 0.05 },
    sfx: ['riser', 'impact', 'whoosh'],
  },
  {
    slug: 'clay',
    name: 'Clay Stop-Motion',
    categorySlug: '3d',
    description: 'Gaya tanah liat stop-motion 12 fps dengan bentuk plastisin tebal membulat, gradasi radial, highlight, dan getaran boiling.',
    music: 'ceria',
    voice: 'honeypie',
    palette: { background: '#F2E8DC', accent: '#E76F51', ink: '#264653', secondary: '#2A9D8F', highlight: '#E9C46A' },
    typography: { display: 'Baloo 2', body: 'Nunito', displayWeight: 800 },
    motion: { intensity: 0.8, fpsLimit: 12, boilingEffect: true },
    sfx: ['boing', 'pop', 'tap'],
  },
  {
    slug: 'retro',
    name: 'Retro Neon Synthwave',
    categorySlug: 'grafis',
    description: 'Nostalgia cyberpunk 80-an dengan grid lantai melaju kencang, matahari bergaris, chromatic aberration, dan glow neon cerah.',
    music: 'synthwave',
    voice: 'Putra',
    palette: { background: '#14002B', accent: '#FF006E', ink: '#FFFFFF', secondary: '#3C096C', highlight: '#FB5607' },
    typography: { display: 'Space Grotesk', body: 'Chivo Mono', displayWeight: 700 },
    motion: { intensity: 1.0, transition: 'zoom', gridFloor: true, glow: true },
    sfx: ['swoosh', 'glitch', 'impact'],
  },
  {
    slug: 'cat-air',
    name: 'Cat Air Artistik',
    categorySlug: 'gambar-tangan',
    description: 'Sapuan kuas cat air transparan yang merembes di tepian kertas basah, warna pastel elegan, dan animasi mekar perlahan.',
    music: 'piano',
    voice: 'Maya',
    palette: { background: '#FBF7EF', accent: '#7FB7D9', ink: '#333333', secondary: '#F2A7A0', highlight: '#F6D27A' },
    typography: { display: 'Caveat', body: 'Playfair Display', displayWeight: 500 },
    motion: { intensity: 0.5, transition: 'fade', watercolorBloom: true },
    sfx: ['swoosh', 'ding'],
  },
  {
    slug: 'pixel',
    name: 'Pixel 8-bit Arkade',
    categorySlug: 'gim',
    description: 'Estetika game retro 8-bit dengan grid pixel 8–12px, palet warna terbatas, bayangan blok, dan HUD skor bergaya arkade klasik.',
    music: 'synthwave',
    voice: 'Pratama',
    palette: { background: '#1A1C2C', accent: '#FFCD75', ink: '#FFFFFF', secondary: '#5D275D', highlight: '#38B764' },
    typography: { display: 'Space Grotesk', body: 'Chivo Mono', displayWeight: 700 },
    motion: { intensity: 0.8, pixelSnap: 8, fpsLimit: 12 },
    sfx: ['click', 'pop', 'ding', 'coin'],
  },
  {
    slug: 'komik',
    name: 'Panel Komik Strip',
    categorySlug: 'cetak',
    description: 'Panel komik bergaris hitam tebal, balon kata pop dinamis, efek teks suara besar BAM!, dan tekstur titik halftone.',
    music: 'funk',
    voice: 'Putra',
    palette: { background: '#FFFFFF', accent: '#FFD23F', ink: '#111111', secondary: '#EE4266', highlight: '#3BCEAC' },
    typography: { display: 'Anton', body: 'Nunito', displayWeight: 700 },
    motion: { intensity: 0.9, transition: 'slide', comicPanels: true },
    sfx: ['impact', 'boing', 'pop'],
  },
  {
    slug: 'stickman',
    name: 'Stickman Relatable',
    categorySlug: 'gambar-tangan',
    description: 'Animasi figur garis hitam stickman ekspresif dengan humor situasi sehari-hari, latar bersih, dan timing cerita yang hidup.',
    music: 'lofi',
    voice: 'Sikedewi',
    palette: { background: '#FFFFFF', accent: '#FF5A36', ink: '#1A1A1A', secondary: '#E5E5E5', highlight: '#0070F3' },
    typography: { display: 'Caveat', body: 'Inter', displayWeight: 600 },
    motion: { intensity: 0.8, transition: 'cut', stickmanPoses: true },
    sfx: ['pop', 'boing', 'step'],
  },
  {
    slug: 'lowpoly',
    name: 'Low-poly 3D Geometri',
    categorySlug: '3d',
    description: 'Visual lanskap poli segitiga 3D bernuansa alam megah dengan bayangan sudut datar, kamera melayang pelan, dan pergeseran awan.',
    music: 'angkasa',
    voice: 'Putra',
    palette: { background: '#1E3A5F', accent: '#F4A259', ink: '#F1F5F2', secondary: '#3D7EA6', highlight: '#8FC1A9' },
    typography: { display: 'Space Grotesk', body: 'Inter', displayWeight: 600 },
    motion: { intensity: 0.6, transition: 'zoom', lowpolyRotate: true },
    sfx: ['whoosh', 'ambient', 'wind'],
  },
];

export async function seedPresets(db = createDatabase(undefined, 1)) {
  const [superadmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'SUPERADMIN'))
    .limit(1);

  if (!superadmin) {
    console.warn('[seedPresets] Tidak ada Superadmin di DB. Lewati seeding presets.');
    return;
  }

  const cats = await db.select({ id: styleCategories.id, slug: styleCategories.slug }).from(styleCategories);
  const catMap = new Map(cats.map((c) => [c.slug, c.id]));

  for (const item of PRESETS_DATA) {
    const categoryId = catMap.get(item.categorySlug);
    if (!categoryId) {
      console.warn(`[seedPresets] Category ${item.categorySlug} tidak ditemukan.`);
      continue;
    }

    const manifest = {
      slug: item.slug,
      name: item.name,
      aspectRatios: ['9:16'],
      recommendedMusic: item.music,
      recommendedVoice: item.voice,
      tags: [item.categorySlug, 'reels', 'tiktok', 'remotion', 'one-line-motion'],
    };

    const recipe = {
      palette: item.palette,
      typography: item.typography,
      motion: item.motion,
      sfx: item.sfx,
      layout: { safeArea: 0.08, titleScale: 1.0, textAlign: 'center' },
    };

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify({ manifest, recipe }))
      .digest('hex');

    const [preset] = await db
      .insert(visualPresets)
      .values({
        categoryId,
        slug: item.slug,
        name: item.name,
        description: item.description,
        status: 'PUBLISHED',
        currentVersion: 1,
        createdBy: superadmin.id,
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: visualPresets.slug,
        set: {
          name: item.name,
          description: item.description,
          status: 'PUBLISHED',
          updatedAt: new Date(),
        },
      })
      .returning({ id: visualPresets.id });

    if (preset) {
      await db
        .insert(visualPresetVersions)
        .values({
          presetId: preset.id,
          version: 1,
          manifest,
          recipe,
          checksum,
          createdBy: superadmin.id,
        })
        .onConflictDoUpdate({
          target: [visualPresetVersions.presetId, visualPresetVersions.version],
          set: {
            manifest,
            recipe,
            checksum,
          },
        });
    }
  }

  console.log(`[seedPresets] Berhasil seeding ${PRESETS_DATA.length} presets motion ke database.`);
}

if (process.argv[1] && process.argv[1].endsWith('seed-presets.ts')) {
  seedPresets()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
