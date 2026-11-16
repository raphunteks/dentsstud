import { useState } from 'react';
import clsx from 'clsx';
import { Card, Input, Modal, Button } from '../components/UI';
import type { NavTab } from '../types';

interface GaleriGayaViewProps {
  onNavigate: (tab: NavTab) => void;
}

export function GaleriGayaView({ onNavigate }: GaleriGayaViewProps) {
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<{ id: string; name: string; cat: string; desc: string; number: number } | null>(null);

  const CATEGORIES = [
    { id: 'all', name: 'Semua 81' },
    { id: 'studio', name: 'Gaya studio (15)' },
    { id: 'infografis', name: 'Infografis (8)' },
    { id: 'tangan', name: 'Gambar tangan (8)' },
    { id: 'bukti', name: 'Film bukti (8)' },
    { id: '3d', name: '3D (7)' },
    { id: 'kartun', name: 'Kartun (4)' },
    { id: 'grafis', name: 'Grafis (7)' },
    { id: 'cetak', name: 'Cetak (6)' },
    { id: 'dokumenter', name: 'Dokumenter (8)' },
    { id: 'asiatimur', name: 'Asia Timur (4)' },
    { id: 'sinema', name: 'Sinema (2)' },
  ];

  const STYLES = [
    { id: 's-65', number: 65, name: 'Kisah Mikroskop', cat: 'bukti', desc: 'Visual makro zooming dengan partikel sel hidup dan penjelas detail mikroskopik.' },
    { id: 's-66', number: 66, name: 'Meja Lampu Arsip', cat: 'bukti', desc: 'Efek meja kaca iluminasi dengan foto polaroid dan coretan spidol retro.' },
    { id: 's-67', number: 67, name: 'Berita Teks Berjalan', cat: 'dokumenter', desc: 'Tipografi cepat dengan highlight teks kuning khas video investigasi VOX.' },
    { id: 's-68', number: 68, name: 'Newsreel 1920-an', cat: 'dokumenter', desc: 'Filter grain monokrom film seluloid hitam putih dengan flicker tempo cepat.' },
    { id: 's-69', number: 69, name: 'Hitung Mundur Peluncuran', cat: 'dokumenter', desc: 'Grafis telemetry luar angkasa dengan angka digital dan radar tracking.' },
    { id: 's-70', number: 70, name: 'Simfoni Time-lapse', cat: 'sinema', desc: 'Gerakan awan dan lalu lintas cepat berpadu grafik garis penjelas ritmik.' },
    { id: 's-71', number: 71, name: 'Investigasi Visual', cat: 'bukti', desc: 'Peta koneksi pin merah, garis benang detektif, dan arsip dokumen rahasia.' },
    { id: 's-72', number: 72, name: 'Montase Konstruktivisme', cat: 'cetak', desc: 'Geometri tebal, sudut miring dinamis, dan warna merah hitam khas poster propaganda seni.' },
    { id: 's-73', number: 73, name: 'Telestrator Olahraga', cat: 'infografis', desc: 'Garis panah taktik kurva dinamis yang menyorot pergerakan objek di lapangan.' },
    { id: 's-74', number: 74, name: 'Paket Berita TV', cat: 'studio', desc: 'Lower-third modern, layar studio kaca, dan transisi swipe profesional.' },
    { id: 's-75', number: 75, name: 'Bento Grid SaaS', cat: 'studio', desc: 'Kotak-kotak rounded halus dengan gradient lembut khas Apple Keynote.' },
    { id: 's-76', number: 76, name: 'Papan Tulis Fisika', cat: 'tangan', desc: 'Coretan kapur putih di atas papan tulis hitam dengan rumus KaTeX presisi.' },
    { id: 's-77', number: 77, name: 'Hologram Neon Cyberpunk', cat: '3d', desc: 'Wireframe biru toska neon berputar di ruang gelap dengan scanlines CRT.' },
    { id: 's-78', number: 78, name: 'Anime Pop Ink', cat: 'kartun', desc: 'Outline kuas manga tebal dengan efek halftone screen tone dan aksen kanji.' },
    { id: 's-79', number: 79, name: 'Kertas Lipat Origami', cat: 'tangan', desc: 'Layer kertas bertekstur yang membuka lipatan satu per satu membentuk objek.' },
    { id: 's-80', number: 80, name: 'Terminal Retro 80s', cat: 'sinema', desc: 'Kursor hijau fosfor berkedip pada monitor monokrom IBM antik.' },
  ];

  const filtered = STYLES.filter((s) => {
    const matchCat = activeCat === 'all' || s.cat === activeCat;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">KATALOG STUDIO</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Galeri Gaya Visual
          </h1>
          <p className="mt-1 text-sm text-muted">
            81 preset komposisi motion graphic siap pakai untuk Reels & TikTok 9:16.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Cari gaya..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={clsx(
              'rounded-full border px-3.5 py-1 text-xs transition cursor-pointer',
              activeCat === c.id
                ? 'border-accent bg-accent text-accent-contrast font-semibold shadow-xs'
                : 'border-line bg-surface text-muted hover:text-text'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <Card
            key={item.id}
            onClick={() => setSelectedStyle(item)}
            className="group relative cursor-pointer overflow-hidden p-0 hover:border-accent hover:shadow-md transition-all duration-200"
          >
            {/* Visual Thumbnail */}
            <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex flex-col justify-between p-3 text-white">
              <div className="flex items-center justify-between">
                <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-mono font-bold text-accent">
                  #{item.number}
                </span>
                <span className="rounded bg-white/20 px-2 py-0.5 text-[9px] uppercase font-semibold">
                  {item.cat}
                </span>
              </div>
              <div>
                <p className="font-display text-sm font-bold group-hover:text-accent transition-colors leading-tight">
                  {item.name}
                </p>
                <p className="text-[10px] opacity-75 line-clamp-2 mt-1">
                  {item.desc}
                </p>
              </div>
            </div>
            <div className="p-3 bg-surface border-t border-line">
              <span className="text-xs font-semibold text-accent group-hover:underline">
                Lihat Detail & Pakai →
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!selectedStyle}
        onClose={() => setSelectedStyle(null)}
        title={selectedStyle ? `#${selectedStyle.number} — ${selectedStyle.name}` : ''}
      >
        {selectedStyle && (
          <div className="space-y-4">
            <div className="relative aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center p-6 text-white text-center">
              <div>
                <span className="rounded bg-accent px-2.5 py-1 text-xs font-bold text-black uppercase">
                  {selectedStyle.cat}
                </span>
                <h3 className="font-display text-xl font-bold mt-2">
                  {selectedStyle.name}
                </h3>
              </div>
            </div>
            <p className="text-sm text-text leading-relaxed">
              {selectedStyle.desc}
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedStyle(null)}>
                Tutup
              </Button>
              <Button
                onClick={() => {
                  setSelectedStyle(null);
                  onNavigate('buat-konten');
                }}
              >
                Gunakan Gaya Ini di Pesanan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
