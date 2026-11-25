'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Input, PageHead } from '@/components/ui';
import { Select, Textarea } from '@/components/ui/extra';

export default function RacikPromptPage() {
  const [topic, setTopic] = useState('Pentingnya scaling gigi setiap 6 bulan');
  const [audience, setAudience] = useState('Pasien dewasa usia 22-40 tahun (bahasa ramah awam)');
  const [style, setStyle] = useState('Swiss Clinical Editorial');
  const [storyMode, setStoryMode] = useState('Mitos vs Fakta');
  const [duration, setDuration] = useState('45 detik (9:16 Vertikal)');
  const [cta, setCta] = useState('Simpan video ini dan jadwalkan pemeriksaan rutin di klinik.');

  const assembled = useMemo(
    () =>
      `Buatkan video edukasi DENTSWEB MOTION berdurasi ${duration} tentang "${topic.trim() || '[TOPIK]'}".\n` +
      `- Audiens: ${audience}\n` +
      `- Gaya Visual: ${style} (safe-area 9:16, kontras tinggi, transisi expo-out 300ms)\n` +
      `- Mode Cerita: ${storyMode} dengan hook 3 detik pertama (maks 7 kata)\n` +
      `- Ritme Narasi: VoiceStudio 130 kata/menit, beat-sync pergantian scene tiap 4 detik\n` +
      `- CTA Penutup: ${cta}`,
    [topic, audience, style, storyMode, duration, cta],
  );

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="6-STAGE BUILDER · DENTSWEB MOTION" title="Racik Prompt" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-4 p-5">
          <div className="grid gap-1">
            <label className="text-xs font-semibold">1. Topik Utama</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">2. Target Audiens</label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">3. Resep Gaya Visual</label>
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {['Swiss Clinical Editorial', 'Apple Keynote Minimal', 'Vox Documentary Cards', 'Kurzgesagt Clean Vector', 'Bento Kinetic Reels', 'Mode Cerita: Warm Diary', 'Linear Crisp Dark'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">4. Mode Cerita</label>
            <Select value={storyMode} onChange={(e) => setStoryMode(e.target.value)}>
              {['Mitos vs Fakta', 'Cerita 3 Babak', 'Listicle 3-5 Poin', 'Analogi Visual', 'Tanya Jawab Pasien', 'Fakta Kilat'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">5. Durasi & Rasio</label>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              {['30 detik (9:16 Vertikal)', '45 detik (9:16 Vertikal)', '60 detik (9:16 Vertikal)', '60 detik (16:9 YouTube)'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">6. CTA Penutup</label>
            <Input value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-5">
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Hasil Prompt Siap Pakai</h3>
            <Textarea rows={11} readOnly value={assembled} className="font-mono text-xs" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(assembled).then(() => toast.success('Prompt racikan disalin'))}
            >
              Salin Prompt
            </Button>
            <Link
              href={`/create-content?topic=${encodeURIComponent(assembled)}`}
              className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast"
            >
              Kirim ke Buat Konten →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
