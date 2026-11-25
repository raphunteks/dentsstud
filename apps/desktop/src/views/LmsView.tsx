import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, invoke, mutate, toMediaUrl } from '../bridge';
import { Button, Card, Input, Modal, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import type { NavTab } from '../types';

function toArr<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.modules)) return o.modules as T[];
    if (Array.isArray(o.lessons)) return o.lessons as T[];
    if (Array.isArray(o.members)) return o.members as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

function toYouTubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
}

type LmsSubTab = 'beranda' | 'materi' | 'racik' | 'prompt' | 'gaya' | 'kamus' | 'efek' | 'unduh';

interface LmsViewProps {
  onNavigate: (tab: NavTab, opts?: { topic?: string; notes?: string }) => void;
}

export function LmsView({ onNavigate }: LmsViewProps) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<LmsSubTab>('beranda');
  const [activeLessonSlug, setActiveLessonSlug] = useState<string | null>(null);
  const [editablePrompt, setEditablePrompt] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [promptStage, setPromptStage] = useState('');
  const [promptSearch, setPromptSearch] = useState('');
  const [promptFavOnly, setPromptFavOnly] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [effectSearch, setEffectSearch] = useState('');

  // Racik Prompt (6-stage builder)
  const [rTopic, setRTopic] = useState('Kenapa scaling gigi rutin 6 bulan sekali penting?');
  const [rStyle, setRStyle] = useState('Editorial Minimalist (DENTSWEB MOTION)');
  const [rFormat, setRFormat] = useState('9:16 Vertikal (45 detik)');
  const [rScenes, setRScenes] = useState('Hook 3 detik -> Fakta Medis -> Visual Perbandingan -> Kesimpulan');
  const [rVoice, setRVoice] = useState('Narasi Indonesia tenang, tempo sedang, jeda antar poin');
  const [rCta, setRCta] = useState('Simpan video ini & bagikan ke keluarga');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const overviewQ = useQuery({
    queryKey: ['lms-overview'],
    queryFn: () => get<Record<string, any>>('/lms/overview').catch(() => null),
  });

  const modulesQ = useQuery({
    queryKey: ['lms-modules'],
    queryFn: () => get<unknown>('/lms/modules').then((r) => toArr<any>(r)).catch(() => []),
  });

  const lessonQ = useQuery({
    queryKey: ['lms-lesson', activeLessonSlug],
    queryFn: () => get<Record<string, any>>(`/lms/lessons/${activeLessonSlug}`),
    enabled: !!activeLessonSlug,
  });

  useEffect(() => {
    if (lessonQ.data?.lessonPrompt != null) {
      setEditablePrompt(String(lessonQ.data.lessonPrompt));
    }
  }, [lessonQ.data?.slug, lessonQ.data?.lessonPrompt]);

  const promptsQ = useQuery({
    queryKey: ['lms-prompts', promptStage, promptSearch, promptFavOnly],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (promptStage) qs.set('stage', promptStage);
      if (promptSearch.trim()) qs.set('q', promptSearch.trim());
      if (promptFavOnly) qs.set('fav', '1');
      const s = qs.toString();
      return get<unknown>(`/lms/prompts${s ? `?${s}` : ''}`).then((r) => toArr<any>(r)).catch(() => []);
    },
    enabled: subTab === 'prompt' || cmdOpen,
  });

  const recipesQ = useQuery({
    queryKey: ['lms-recipes', recipeSearch],
    queryFn: () => {
      const s = recipeSearch.trim() ? `?q=${encodeURIComponent(recipeSearch.trim())}` : '';
      return get<unknown>(`/lms/recipes${s}`).then((r) => toArr<any>(r)).catch(() => []);
    },
    enabled: subTab === 'gaya' || cmdOpen,
  });

  const glossaryQ = useQuery({
    queryKey: ['lms-glossary', glossarySearch],
    queryFn: () => {
      const s = glossarySearch.trim() ? `?q=${encodeURIComponent(glossarySearch.trim())}` : '';
      return get<unknown>(`/lms/glossary${s}`).then((r) => toArr<any>(r)).catch(() => []);
    },
    enabled: subTab === 'kamus' || cmdOpen,
  });

  const effectsQ = useQuery({
    queryKey: ['lms-effects', effectSearch],
    queryFn: () => {
      const s = effectSearch.trim() ? `?q=${encodeURIComponent(effectSearch.trim())}` : '';
      return get<unknown>(`/lms/effects${s}`).then((r) => toArr<any>(r)).catch(() => []);
    },
    enabled: subTab === 'efek' || cmdOpen,
  });

  const updatesQ = useQuery({
    queryKey: ['lms-updates'],
    queryFn: () => get<unknown>('/lms/updates').then((r) => toArr<any>(r)).catch(() => []),
    enabled: subTab === 'unduh',
  });

  const skillDlQ = useQuery({
    queryKey: ['lms-skill-download'],
    queryFn: () => get<Record<string, any>>('/lms/skill-download').catch(() => null),
    enabled: subTab === 'unduh',
  });

  const completeMut = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      mutate('POST', `/lms/lessons/${id}/complete`, { completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
      qc.invalidateQueries({ queryKey: ['lms-modules'] });
      if (activeLessonSlug) qc.invalidateQueries({ queryKey: ['lms-lesson', activeLessonSlug] });
    },
  });

  const checklistMut = useMutation({
    mutationFn: ({ id, index, checked }: { id: string; index: number; checked: boolean }) =>
      mutate('POST', `/lms/lessons/${id}/checklist`, { index, checked }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
      if (activeLessonSlug) qc.invalidateQueries({ queryKey: ['lms-lesson', activeLessonSlug] });
    },
  });

  const favPromptMut = useMutation({
    mutationFn: (id: string) => mutate('POST', `/lms/prompts/${id}/favorite`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-prompts'] });
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
    },
  });

  const copyPromptMut = useMutation({
    mutationFn: (id: string) => mutate('POST', `/lms/prompts/${id}/copy`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lms-overview'] }),
  });

  const resetProgMut = useMutation({
    mutationFn: () => mutate('POST', '/lms/progress/reset', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-overview'] });
      qc.invalidateQueries({ queryKey: ['lms-modules'] });
      setFeedback('Progres belajar berhasil direset.');
    },
  });

  const ov = overviewQ.data;
  const stats = ov?.stats ?? { completedLessons: 0, totalLessons: 0, percent: 0, completedModules: 0, totalModules: 0, checklistDone: 0, checklistTotal: 0, promptsCopied: 0 };
  const pct = Math.min(100, Math.max(0, Number(stats.percent ?? 0)));
  const modules = modulesQ.data ?? [];

  const composedRacikPrompt = useMemo(
    () =>
      [
        `[DENTSWEB MOTION BRIEF]`,
        `1. Topik & Hook: ${rTopic}`,
        `2. Gaya Visual: ${rStyle}`,
        `3. Format & Durasi: ${rFormat}`,
        `4. Struktur Adegan: ${rScenes}`,
        `5. Suara & Ritme: ${rVoice}`,
        `6. CTA Penutup: ${rCta}`,
      ].join('\n'),
    [rTopic, rStyle, rFormat, rScenes, rVoice, rCta],
  );

  function sendToBuatKonten(topicText: string, promptNotes?: string) {
    onNavigate('buat-konten', { topic: topicText, notes: promptNotes ?? topicText });
  }

  function copyText(text: string, promptId?: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    if (promptId) copyPromptMut.mutate(promptId);
    setFeedback('Prompt disalin ke clipboard.');
  }

  const allLessonsFlat = useMemo(
    () => modules.flatMap((m: any) => toArr<any>(m.lessons).map((l: any) => ({ ...l, moduleTitle: m.title }))),
    [modules],
  );

  const cmdResults = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return allLessonsFlat.slice(0, 6).map((l: any) => ({ kind: 'Materi', title: l.title, sub: l.moduleTitle, onSelect: () => { setActiveLessonSlug(l.slug); setSubTab('materi'); setCmdOpen(false); } }));
    const res: { kind: string; title: string; sub: string; onSelect: () => void }[] = [];
    for (const l of allLessonsFlat) {
      if (String(l.title).toLowerCase().includes(q)) {
        res.push({ kind: 'Materi', title: l.title, sub: l.moduleTitle, onSelect: () => { setActiveLessonSlug(l.slug); setSubTab('materi'); setCmdOpen(false); } });
      }
    }
    for (const p of promptsQ.data ?? []) {
      if (String(p.title ?? '').toLowerCase().includes(q) || String(p.content ?? p.prompt ?? '').toLowerCase().includes(q)) {
        res.push({ kind: 'Prompt', title: p.title, sub: p.stage ?? 'Prompt', onSelect: () => { setPromptSearch(cmdQuery); setSubTab('prompt'); setCmdOpen(false); } });
      }
    }
    for (const r of recipesQ.data ?? []) {
      if (String(r.name ?? r.title ?? '').toLowerCase().includes(q)) {
        res.push({ kind: 'Resep Gaya', title: r.name ?? r.title, sub: r.category ?? 'Gaya', onSelect: () => { setRecipeSearch(cmdQuery); setSubTab('gaya'); setCmdOpen(false); } });
      }
    }
    for (const g of glossaryQ.data ?? []) {
      if (String(g.term ?? '').toLowerCase().includes(q)) {
        res.push({ kind: 'Kamus', title: g.term, sub: g.category ?? 'Istilah', onSelect: () => { setGlossarySearch(cmdQuery); setSubTab('kamus'); setCmdOpen(false); } });
      }
    }
    for (const ef of effectsQ.data ?? []) {
      if (String(ef.name ?? '').toLowerCase().includes(q)) {
        res.push({ kind: 'Efek', title: ef.name, sub: ef.category ?? 'Efek', onSelect: () => { setEffectSearch(cmdQuery); setSubTab('efek'); setCmdOpen(false); } });
      }
    }
    return res.slice(0, 12);
  }, [cmdQuery, allLessonsFlat, promptsQ.data, recipesQ.data, glossaryQ.data, effectsQ.data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar: Title + Progress Ring + ⌘K Search + Lanjut Belajar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3.5">
          {/* Lightweight SVG Progress Ring */}
          <svg viewBox="0 0 44 44" className="w-11 h-11 shrink-0" aria-label={`Progres ${pct}%`}>
            <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" className="text-surface-2" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="currentColor"
              className="text-accent"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${Math.round((pct / 100) * 113.1)} 113.1`}
              transform="rotate(-90 22 22)"
            />
            <text x="22" y="25.5" textAnchor="middle" className="fill-text text-[10px] font-mono font-bold">
              {pct}%
            </text>
          </svg>
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">BELAJAR · DENTSWEB MOTION LMS</p>
            <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Kelas &amp; Materi Motion</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCmdOpen(true)}>
            <Icon name="search" className="w-3.5 h-3.5 mr-1.5 inline" />
            Cari Materi (⌘K)
          </Button>
          {ov?.nextLesson?.slug && (
            <Button
              size="sm"
              onClick={() => {
                setActiveLessonSlug(ov.nextLesson.slug);
                setSubTab('materi');
              }}
            >
              <Icon name="play" className="w-3.5 h-3.5 mr-1.5 inline" />
              Lanjut Belajar
            </Button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['beranda', 'Beranda Kelas'],
            ['materi', `Daftar Kelas (${modules.length})`],
            ['racik', 'Racik Prompt'],
            ['prompt', 'Koleksi Prompt'],
            ['gaya', 'Resep Gaya'],
            ['kamus', 'Kamus Motion'],
            ['efek', 'Video Efek'],
            ['unduh', 'Update & Download Skill'],
          ] as [LmsSubTab, string][]
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={subTab === id ? 'primary' : 'ghost'} onClick={() => setSubTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {feedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-text flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-muted cursor-pointer">Tutup</button>
        </div>
      )}

      {/* 1. Beranda Kelas */}
      {subTab === 'beranda' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase text-muted">Pelajaran Selesai</p>
              <p className="num text-2xl font-semibold text-text mt-1">{stats.completedLessons} / {stats.totalLessons}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase text-muted">Modul Tuntas</p>
              <p className="num text-2xl font-semibold text-accent mt-1">{stats.completedModules} / {stats.totalModules}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase text-muted">Checklist Praktik</p>
              <p className="num text-2xl font-semibold text-ok mt-1">{stats.checklistDone} / {stats.checklistTotal}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-mono uppercase text-muted">Prompt Disalin</p>
              <p className="num text-2xl font-semibold text-text mt-1">{stats.promptsCopied ?? 0}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <p className="text-[11px] font-mono uppercase text-accent font-bold">Langkah Berikutnya</p>
              <h2 className="font-display text-base font-semibold text-text">
                {ov?.nextLesson?.title ?? 'Mulai Modul 1 DENTSWEB MOTION'}
              </h2>
              <p className="text-xs text-muted">{ov?.nextLesson?.summary ?? 'Pelajari alur produksi video motion edukasi dari ide satu kalimat hingga render MP4 siap unggah.'}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    if (ov?.nextLesson?.slug) setActiveLessonSlug(ov.nextLesson.slug);
                    setSubTab('materi');
                  }}
                >
                  Buka Pelajaran
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSubTab('racik')}>
                  Buka Racik Prompt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={resetProgMut.isPending}
                  onClick={() => {
                    if (confirm('Reset seluruh progres belajar Anda?')) resetProgMut.mutate();
                  }}
                >
                  Reset Progres
                </Button>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <p className="text-[11px] font-mono uppercase text-muted font-bold">Istilah Motion Hari Ini</p>
              <h2 className="font-display text-base font-semibold text-text">
                {ov?.termOfDay?.term ?? 'Easing / Anticipation'}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {ov?.termOfDay?.definition ?? 'Kurva percepatan animasi yang membuat transisi terasa natural, editorial, dan profesional.'}
              </p>
              {ov?.latestUpdate && (
                <div className="pt-2 border-t border-line text-xs">
                  <span className="font-mono text-accent font-semibold">v{ov.latestUpdate.version}</span>{' '}
                  <span className="text-muted">— {ov.latestUpdate.title}</span>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* 2. Daftar Kelas & Lesson Player */}
      {subTab === 'materi' && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
          {/* Left Module Accordion */}
          <Card className="p-3 space-y-3 max-h-[72vh] overflow-y-auto">
            {modules.length === 0 ? (
              <p className="text-xs text-muted p-4 text-center">Memuat kurikulum kelas…</p>
            ) : (
              modules.map((m: any, idx: number) => (
                <div key={m.id ?? idx} className="space-y-1">
                  <p className="px-2 text-[11px] font-mono uppercase font-bold text-accent">
                    Modul {m.sortOrder ?? m.order ?? idx + 1} · {m.title}
                  </p>
                  <div className="space-y-1">
                    {toArr<any>(m.lessons).map((l: any) => {
                      const active = activeLessonSlug === l.slug;
                      return (
                        <button
                          key={l.id ?? l.slug}
                          onClick={() => setActiveLessonSlug(l.slug)}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                            active ? 'bg-accent/15 text-text font-semibold border border-accent/40' : 'text-muted hover:bg-surface-2 hover:text-text'
                          }`}
                        >
                          <span className="truncate">{l.title}</span>
                          {l.completed && <Pill ok>✓</Pill>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Right Lesson Player */}
          <Card className="p-5 space-y-4">
            {!activeLessonSlug ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-text">Pilih pelajaran di panel kiri untuk mulai belajar</p>
                <p className="text-xs text-muted">Setiap pelajaran dilengkapi video, chapters, checklist praktik, dan prompt siap kirim ke studio.</p>
              </div>
            ) : lessonQ.isLoading ? (
              <p className="text-xs text-muted py-6">Memuat materi pelajaran…</p>
            ) : lessonQ.data ? (() => {
              const l = lessonQ.data;
              const yt = toYouTubeEmbed(l.videoUrl);
              const chapters = toArr<any>(l.chapters);
              const checklist = toArr<string>(l.checklist);
              const checkedItems: number[] = Array.isArray(l.checkedItems) ? l.checkedItems : [];
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-text">{l.title}</h2>
                      <p className="text-xs font-mono text-muted">{l.duration ?? '5–10 menit'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={l.completed ? 'outline' : 'primary'}
                      disabled={completeMut.isPending}
                      onClick={() => completeMut.mutate({ id: l.id, completed: !l.completed })}
                    >
                      {l.completed ? 'Selesai (Tandai Belum)' : 'Tandai Selesai'}
                    </Button>
                  </div>

                  {l.videoUrl && (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
                      {yt ? (
                        <iframe src={yt} title={l.title} className="w-full h-full" allowFullScreen />
                      ) : (
                        <video src={toMediaUrl(l.videoUrl)} controls playsInline className="w-full h-full object-contain" />
                      )}
                    </div>
                  )}

                  {l.summary && <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{l.summary}</p>}

                  {chapters.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-text">Chapters</p>
                      <div className="flex flex-wrap gap-1.5">
                        {chapters.map((ch: any, i: number) => (
                          <span key={i} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-mono text-muted">
                            {ch.time ?? `0${i}:00`} · {ch.title ?? String(ch)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {checklist.length > 0 && (
                    <div className="space-y-2 border-t border-line pt-3">
                      <p className="text-xs font-semibold text-text">Checklist Praktik</p>
                      {checklist.map((item, idx) => {
                        const checked = checkedItems.includes(idx);
                        return (
                          <label key={idx} className="flex items-start gap-2 text-xs text-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => checklistMut.mutate({ id: l.id, index: idx, checked: e.target.checked })}
                              className="mt-0.5"
                            />
                            <span className={checked ? 'line-through text-muted' : ''}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-2 border-t border-line pt-3">
                    <p className="text-xs font-semibold text-text">Prompt Praktik (Editable)</p>
                    <Textarea rows={4} value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)} className="text-xs font-mono" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyText(editablePrompt)}>
                        <Icon name="copy" className="w-3.5 h-3.5 mr-1 inline" />
                        Salin Prompt
                      </Button>
                      <Button size="sm" onClick={() => sendToBuatKonten(l.title, editablePrompt)}>
                        <Icon name="bolt" className="w-3.5 h-3.5 mr-1 inline" />
                        Kirim ke Buat Konten
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-line">
                    <Button size="sm" variant="ghost" disabled={!l.prevLesson?.slug} onClick={() => l.prevLesson?.slug && setActiveLessonSlug(l.prevLesson.slug)}>
                      ← Sebelumnya
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!l.nextLesson?.slug} onClick={() => l.nextLesson?.slug && setActiveLessonSlug(l.nextLesson.slug)}>
                      Selanjutnya →
                    </Button>
                  </div>
                </div>
              );
            })() : null}
          </Card>
        </div>
      )}

      {/* 3. Racik Prompt (6 Tahap) */}
      {subTab === 'racik' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-text">Racik Prompt DENTSWEB MOTION (6 Tahap)</h2>
            <label className="grid gap-1 text-muted">1. Topik &amp; Hook<Input value={rTopic} onChange={(e) => setRTopic(e.target.value)} className="h-9 text-xs" /></label>
            <label className="grid gap-1 text-muted">2. Gaya Visual<Input value={rStyle} onChange={(e) => setRStyle(e.target.value)} className="h-9 text-xs" /></label>
            <label className="grid gap-1 text-muted">3. Format &amp; Durasi<Input value={rFormat} onChange={(e) => setRFormat(e.target.value)} className="h-9 text-xs" /></label>
            <label className="grid gap-1 text-muted">4. Struktur Adegan<Input value={rScenes} onChange={(e) => setRScenes(e.target.value)} className="h-9 text-xs" /></label>
            <label className="grid gap-1 text-muted">5. Suara &amp; Ritme<Input value={rVoice} onChange={(e) => setRVoice(e.target.value)} className="h-9 text-xs" /></label>
            <label className="grid gap-1 text-muted">6. CTA Penutup<Input value={rCta} onChange={(e) => setRCta(e.target.value)} className="h-9 text-xs" /></label>
          </Card>
          <Card className="p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h2 className="font-display text-sm font-semibold text-text">Hasil Racikan Prompt</h2>
              <pre className="rounded-xl border border-line bg-surface-2 p-4 text-xs font-mono text-text whitespace-pre-wrap leading-relaxed">
                {composedRacikPrompt}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Button size="sm" variant="outline" onClick={() => copyText(composedRacikPrompt)}>
                <Icon name="copy" className="w-3.5 h-3.5 mr-1 inline" />
                Salin Prompt
              </Button>
              <Button size="sm" onClick={() => sendToBuatKonten(rTopic, composedRacikPrompt)}>
                <Icon name="bolt" className="w-3.5 h-3.5 mr-1 inline" />
                Kirim ke Buat Konten
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 4. Koleksi Prompt */}
      {subTab === 'prompt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Cari prompt..." value={promptSearch} onChange={(e) => setPromptSearch(e.target.value)} className="w-60 h-9 text-xs" />
            <Select value={promptStage} onChange={(e) => setPromptStage(e.target.value)} className="w-44 h-9 text-xs">
              <option value="">Semua Tahap</option>
              <option value="ide">Ide &amp; Hook</option>
              <option value="naskah">Naskah</option>
              <option value="visual">Visual &amp; Gaya</option>
              <option value="motion">Motion &amp; Animasi</option>
              <option value="audio">Audio &amp; Suara</option>
              <option value="qc">QC &amp; Revisi</option>
              <option value="sosmed">Distribusi Sosmed</option>
            </Select>
            <Button size="sm" variant={promptFavOnly ? 'primary' : 'outline'} onClick={() => setPromptFavOnly((v) => !v)}>
              Favorit Saja
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(promptsQ.data ?? []).map((p: any) => (
              <Card key={p.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-text truncate">{p.title}</p>
                  <Pill variant="accent">{p.stage || 'umum'}</Pill>
                </div>
                <p className="text-xs font-mono text-muted whitespace-pre-wrap line-clamp-4">{p.content ?? p.prompt}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyText(p.content ?? p.prompt ?? '', p.id)}>Salin</Button>
                  <Button size="sm" onClick={() => sendToBuatKonten(p.title, p.content ?? p.prompt)}>Kirim ke Buat Konten</Button>
                  <Button size="sm" variant={p.isFavorite || p.favorited ? 'primary' : 'ghost'} onClick={() => favPromptMut.mutate(p.id)}>
                    {p.isFavorite || p.favorited ? 'Favorit' : '+ Favorit'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. Resep Gaya */}
      {subTab === 'gaya' && (
        <div className="space-y-4">
          <Input placeholder="Cari resep gaya visual..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-64 h-9 text-xs" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recipesQ.data ?? []).map((r: any) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-text">{r.name ?? r.title}</p>
                  <Pill>{r.category || 'Gaya'}</Pill>
                </div>
                <p className="text-xs text-muted">{r.description}</p>
                {r.promptSnippet && (
                  <p className="text-[11px] font-mono text-text bg-surface-2 rounded-lg p-2 line-clamp-3">{r.promptSnippet}</p>
                )}
                <Button size="sm" variant="outline" onClick={() => sendToBuatKonten(r.name ?? r.title, r.promptSnippet ?? r.description)}>
                  Gunakan di Buat Konten
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 6. Kamus Motion */}
      {subTab === 'kamus' && (
        <div className="space-y-4">
          <Input placeholder="Cari istilah motion..." value={glossarySearch} onChange={(e) => setGlossarySearch(e.target.value)} className="w-64 h-9 text-xs" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(glossaryQ.data ?? []).map((g: any) => (
              <Card key={g.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-text">{g.term}</p>
                  <Pill>{g.category || 'Motion'}</Pill>
                </div>
                <p className="text-xs text-muted leading-relaxed">{g.definition}</p>
                {g.example && <p className="text-[11px] font-mono text-accent">Contoh: {g.example}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 7. Video Efek */}
      {subTab === 'efek' && (
        <div className="space-y-4">
          <Input placeholder="Cari efek video..." value={effectSearch} onChange={(e) => setEffectSearch(e.target.value)} className="w-64 h-9 text-xs" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(effectsQ.data ?? []).map((ef: any) => (
              <Card key={ef.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-text">{ef.name}</p>
                  <Pill variant="accent">{ef.category || 'Efek'}</Pill>
                </div>
                <p className="text-xs text-muted">{ef.description}</p>
                {ef.promptHint && <p className="text-[11px] font-mono text-text bg-surface-2 rounded-lg p-2">{ef.promptHint}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 8. Update & Download Skill */}
      {subTab === 'unduh' && (
        <div className="space-y-4 max-w-3xl">
          <Card className="p-5 space-y-3 border-accent/40 bg-accent/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono uppercase text-accent font-bold">SKILL RESMI DENTSWEB MOTION</p>
                <h2 className="font-display text-base font-semibold text-text">
                  {skillDlQ.data?.filename ?? 'dentsweb-motion-v2.3.0.zip'}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Paket skill resmi siap pasang untuk Claude Code / Antigravity / DENTSWEB Studio.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const dl = skillDlQ.data?.downloadUrl || '/api/v1/lms/skill-download/file';
                  void invoke('shell:open-external', { url: toMediaUrl(dl) });
                }}
              >
                <Icon name="download" className="w-3.5 h-3.5 mr-1.5 inline" />
                Unduh Skill (.ZIP)
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-text">Log Update Kurikulum &amp; Skill</h3>
            <div className="space-y-2.5">
              {(updatesQ.data ?? []).map((u: any) => (
                <div key={u.id} className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-accent">v{u.version}</span>
                    <span className="text-[11px] font-mono text-muted">
                      {u.releasedAt || u.createdAt ? new Date(u.releasedAt || u.createdAt).toLocaleDateString('id-ID') : ''}
                    </span>
                  </div>
                  <p className="font-semibold text-text">{u.title}</p>
                  <p className="text-muted whitespace-pre-wrap">{u.notes ?? u.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ⌘K Global LMS Search Modal */}
      <Modal open={cmdOpen} onClose={() => setCmdOpen(false)} title="Cari di DENTSWEB MOTION LMS (⌘K)">
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Ketik judul materi, prompt, resep gaya, istilah kamus, atau efek..."
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            className="h-9 text-xs"
          />
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {cmdResults.map((r, i) => (
              <button
                key={i}
                onClick={r.onSelect}
                className="w-full text-left rounded-lg border border-line bg-surface-2/40 hover:border-accent px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-text truncate">{r.title}</span>
                <span className="text-[10px] font-mono text-muted shrink-0">{r.kind} · {r.sub}</span>
              </button>
            ))}
            {cmdResults.length === 0 && <p className="text-xs text-muted text-center py-4">Tidak ada hasil ditemukan.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** 17. Superadmin Kelas & LMS CMS + Member Progress Analytics */
export function AdminLmsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'modules' | 'prompts' | 'recipes' | 'glossary' | 'effects' | 'updates' | 'analytics'>('modules');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [extra, setExtra] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const listEndpoint =
    tab === 'modules'
      ? '/lms/modules'
      : tab === 'prompts'
        ? '/lms/prompts'
        : tab === 'recipes'
          ? '/lms/recipes'
          : tab === 'glossary'
            ? '/lms/glossary'
            : tab === 'effects'
              ? '/lms/effects'
              : tab === 'updates'
                ? '/lms/updates'
                : '/admin/lms/analytics';

  const listQ = useQuery({
    queryKey: ['admin-lms', tab],
    queryFn: () => get<unknown>(listEndpoint).then((r) => toArr<any>(r)).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (tab === 'modules') return mutate('POST', '/admin/lms/modules', { title: title.trim(), description: body.trim() });
      if (tab === 'prompts') return mutate('POST', '/admin/lms/prompts', { title: title.trim(), stage: category.trim() || 'ide', content: body.trim() });
      if (tab === 'recipes') return mutate('POST', '/admin/lms/recipes', { name: title.trim(), category: category.trim() || 'Editorial', description: body.trim(), promptSnippet: extra.trim() || undefined });
      if (tab === 'glossary') return mutate('POST', '/admin/lms/glossary', { term: title.trim(), category: category.trim() || 'Animasi', definition: body.trim(), example: extra.trim() || undefined });
      if (tab === 'effects') return mutate('POST', '/admin/lms/effects', { name: title.trim(), category: category.trim() || 'Transisi', description: body.trim(), promptHint: extra.trim() || undefined });
      return mutate('POST', '/admin/lms/updates', { version: category.trim() || '2.3.1', title: title.trim(), notes: body.trim() });
    },
    onSuccess: () => {
      setTitle('');
      setCategory('');
      setBody('');
      setExtra('');
      qc.invalidateQueries({ queryKey: ['admin-lms', tab] });
      setFeedback('Item LMS berhasil ditambahkan.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/admin/lms/${tab}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lms', tab] });
      setFeedback('Item LMS dihapus.');
    },
  });

  const items = listQ.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">17 · SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Kelas &amp; LMS Control Center</h1>
        <p className="mt-1 text-sm text-muted">Kelola modul kurikulum, koleksi prompt, resep gaya, kamus motion, efek video, log update, dan analitik progres member.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['modules', 'Modul & Lesson'],
            ['prompts', 'Koleksi Prompt'],
            ['recipes', 'Resep Gaya'],
            ['glossary', 'Kamus Motion'],
            ['effects', 'Video Efek'],
            ['updates', 'Log Update'],
            ['analytics', 'Analitik Member'],
          ] as [typeof tab, string][]
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? 'primary' : 'ghost'} onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {feedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-text flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-muted cursor-pointer">Tutup</button>
        </div>
      )}

      {tab === 'analytics' ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Pelajaran</th>
                  <th className="px-4 py-2.5">Progres</th>
                  <th className="px-4 py-2.5">Checklist</th>
                  <th className="px-4 py-2.5">Prompt Disalin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((m: any) => (
                  <tr key={m.userId ?? m.email} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2.5 font-medium text-text">{m.displayName}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{m.email}</td>
                    <td className="px-4 py-2.5 font-mono">{m.completedLessons ?? 0} / {m.totalLessons ?? 0}</td>
                    <td className="px-4 py-2.5"><Pill ok={(m.percent ?? 0) >= 80}>{m.percent ?? 0}%</Pill></td>
                    <td className="px-4 py-2.5 font-mono">{m.checklistDone ?? 0}</td>
                    <td className="px-4 py-2.5 font-mono">{m.promptsCopied ?? 0}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Belum ada data progres member.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-text">Tambah Item Baru ({tab})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder={tab === 'glossary' ? 'Istilah Motion' : 'Judul / Nama'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs"
              />
              {tab !== 'modules' && (
                <Input
                  placeholder={tab === 'updates' ? 'Versi (mis. 2.3.1)' : tab === 'prompts' ? 'Stage (ide/naskah/visual/motion)' : 'Kategori'}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 text-xs"
                />
              )}
            </div>
            <Textarea
              rows={3}
              placeholder={tab === 'prompts' ? 'Isi prompt...' : 'Deskripsi / Definisi / Catatan...'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-xs"
            />
            {(tab === 'recipes' || tab === 'glossary' || tab === 'effects') && (
              <Input
                placeholder={tab === 'glossary' ? 'Contoh penggunaan (opsional)' : 'Snippet prompt / hint (opsional)'}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            )}
            <div>
              <Button size="sm" disabled={!title.trim() || !body.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
                + Simpan ke LMS
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {items.map((it: any) => (
              <Card key={it.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">
                    {it.title ?? it.name ?? it.term}
                    {it.version && <span className="ml-2 font-mono text-xs text-accent">v{it.version}</span>}
                  </p>
                  <p className="text-xs text-muted truncate">{it.description ?? it.definition ?? it.notes ?? it.content}</p>
                </div>
                <Button size="sm" variant="danger" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(it.id)}>
                  Hapus
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
