'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';
import { Select, Textarea } from '@/components/ui/extra';

type Tab = 'modules' | 'prompts' | 'recipes' | 'glossary' | 'effects' | 'updates' | 'analytics';

export default function AdminLmsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('analytics');

  const modulesQ = useQuery({ queryKey: ['admin-lms-modules'], queryFn: () => api<{ items: { id: string; slug: string; title: string; subtitle: string; badge: string; lessons: { id: string; slug: string; title: string; duration: string }[] }[] }>('/lms/modules') });
  const promptsQ = useQuery({ queryKey: ['admin-lms-prompts'], queryFn: () => api<{ items: { id: string; stage: string; title: string; promptText: string }[] }>('/lms/prompts') });
  const recipesQ = useQuery({ queryKey: ['admin-lms-recipes'], queryFn: () => api<{ items: { id: string; category: string; title: string; modeCerita: string }[] }>('/lms/recipes') });
  const glossaryQ = useQuery({ queryKey: ['admin-lms-glossary'], queryFn: () => api<{ items: { id: string; category: string; term: string; definition: string }[] }>('/lms/glossary') });
  const effectsQ = useQuery({ queryKey: ['admin-lms-effects'], queryFn: () => api<{ items: { id: string; category: string; name: string; promptSnippet: string }[] }>('/lms/effects') });
  const updatesQ = useQuery({ queryKey: ['admin-lms-updates'], queryFn: () => api<{ items: { id: string; version: string; title: string; releasedAt: string }[] }>('/lms/updates') });
  const analyticsQ = useQuery({ queryKey: ['admin-lms-analytics'], queryFn: () => api<{ totalLessons: number; items: { userId: string; displayName: string; email: string; completedLessons: number; totalLessons: number; percent: number; checklistDone: number; promptsCopied: number }[] }>('/admin/lms/analytics') });

  // Quick-add form drafts
  const [mSlug, setMSlug] = useState(''); const [mTitle, setMTitle] = useState(''); const [mSub, setMSub] = useState('');
  const [lModId, setLModId] = useState(''); const [lSlug, setLSlug] = useState(''); const [lTitle, setLTitle] = useState(''); const [lDur, setLDur] = useState('06:00');
  const [pStage, setPStage] = useState('Hook & Ide'); const [pTitle, setPTitle] = useState(''); const [pText, setPText] = useState('');
  const [rCat, setRCat] = useState('Editorial'); const [rTitle, setRTitle] = useState(''); const [rMode, setRMode] = useState('');
  const [gCat, setGCat] = useState('Animasi & Timing'); const [gTerm, setGTerm] = useState(''); const [gDef, setGDef] = useState('');
  const [eCat, setECat] = useState('Transisi'); const [eName, setEName] = useState(''); const [eSnip, setESnip] = useState('');
  const [uVer, setUVer] = useState(''); const [uTitle, setUTitle] = useState('');

  const invAll = () => {
    for (const k of ['admin-lms-modules', 'admin-lms-prompts', 'admin-lms-recipes', 'admin-lms-glossary', 'admin-lms-effects', 'admin-lms-updates', 'admin-lms-analytics']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const reqMut = useMutation({
    mutationFn: ({ path, method, json }: { path: string; method: 'POST' | 'DELETE'; json?: unknown }) => api(path, { method, json }),
    onSuccess: () => {
      toast.success('Data LMS diperbarui');
      invAll();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (analyticsQ.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (analyticsQ.isError) return <ErrorNote error={analyticsQ.error} onRetry={() => analyticsQ.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="OPERASIONAL · 17 KELAS & LMS" title="17 Kelas & LMS (DENTSWEB MOTION)" />

      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {(
          [
            ['analytics', 'Analitik Member'],
            ['modules', `Modul & Lesson (${modulesQ.data?.items.length ?? 0})`],
            ['prompts', `Prompt (${promptsQ.data?.items.length ?? 0})`],
            ['recipes', `Resep Gaya (${recipesQ.data?.items.length ?? 0})`],
            ['glossary', `Kamus (${glossaryQ.data?.items.length ?? 0})`],
            ['effects', `Efek (${effectsQ.data?.items.length ?? 0})`],
            ['updates', `Log Update (${updatesQ.data?.items.length ?? 0})`],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 rounded-[10px] px-3.5 text-xs font-medium ${tab === k ? 'bg-accent text-accent-contrast' : 'border border-line hover:bg-surface-2'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <Card className="overflow-x-auto p-5">
          <h3 className="mb-3 text-sm font-semibold">Progres Belajar Member (Total {analyticsQ.data?.totalLessons ?? 0} Materi)</h3>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Materi Selesai</th>
                <th className="py-2 pr-3">Progres</th>
                <th className="py-2 pr-3">Checklist</th>
                <th className="py-2">Prompt Disalin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(analyticsQ.data?.items ?? []).map((u) => (
                <tr key={u.userId}>
                  <td className="py-2.5 pr-3 font-medium">{u.displayName || '—'}</td>
                  <td className="py-2.5 pr-3 text-muted">{u.email}</td>
                  <td className="py-2.5 pr-3 font-mono">{u.completedLessons}/{u.totalLessons}</td>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-accent">{u.percent}%</td>
                  <td className="py-2.5 pr-3 font-mono">{u.checklistDone}</td>
                  <td className="py-2.5 font-mono">{u.promptsCopied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'modules' && (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="grid gap-2.5 p-4">
              <h3 className="text-xs font-semibold uppercase text-muted">Tambah Modul</h3>
              <Input value={mSlug} onChange={(e) => setMSlug(e.target.value)} placeholder="slug-modul" />
              <Input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Judul modul" />
              <Input value={mSub} onChange={(e) => setMSub(e.target.value)} placeholder="Subjudul singkat" />
              <Button
                className="h-9 text-xs"
                disabled={!mSlug.trim() || !mTitle.trim()}
                onClick={() => {
                  reqMut.mutate({ path: '/admin/lms/modules', method: 'POST', json: { slug: mSlug.trim(), title: mTitle.trim(), subtitle: mSub.trim() } });
                  setMSlug(''); setMTitle(''); setMSub('');
                }}
              >
                + Tambah Modul
              </Button>
            </Card>
            <Card className="grid gap-2.5 p-4">
              <h3 className="text-xs font-semibold uppercase text-muted">Tambah Lesson</h3>
              <Select value={lModId} onChange={(e) => setLModId(e.target.value)}>
                <option value="">Pilih Modul...</option>
                {(modulesQ.data?.items ?? []).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Select>
              <Input value={lSlug} onChange={(e) => setLSlug(e.target.value)} placeholder="slug-lesson" />
              <div className="flex gap-2">
                <Input value={lTitle} onChange={(e) => setLTitle(e.target.value)} placeholder="Judul lesson" />
                <Input className="w-24" value={lDur} onChange={(e) => setLDur(e.target.value)} placeholder="06:00" />
              </div>
              <Button
                className="h-9 text-xs"
                disabled={!lModId || !lSlug.trim() || !lTitle.trim()}
                onClick={() => {
                  reqMut.mutate({ path: '/admin/lms/lessons', method: 'POST', json: { moduleId: lModId, slug: lSlug.trim(), title: lTitle.trim(), duration: lDur } });
                  setLSlug(''); setLTitle('');
                }}
              >
                + Tambah Lesson
              </Button>
            </Card>
          </div>
          {(modulesQ.data?.items ?? []).map((m) => (
            <Card key={m.id} className="grid gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{m.title}</span>
                <Button variant="ghost" className="h-7 px-2 text-xs text-bad" onClick={() => confirm(`Hapus modul ${m.title}?`) && reqMut.mutate({ path: `/admin/lms/modules/${m.id}`, method: 'DELETE' })}>Hapus Modul</Button>
              </div>
              <div className="grid gap-1 pl-3 text-xs">
                {m.lessons.map((l) => (
                  <div key={l.id} className="flex items-center justify-between border-b border-line/50 py-1.5">
                    <span>{l.title} <span className="font-mono text-muted">({l.duration})</span></span>
                    <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/lessons/${l.id}`, method: 'DELETE' })}>Hapus</button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'prompts' && (
        <div className="grid gap-4">
          <Card className="grid gap-2.5 p-4">
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={pStage} onChange={(e) => setPStage(e.target.value)} placeholder="Tahap (misal: Hook & Ide)" />
              <Input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Judul prompt" />
            </div>
            <Textarea rows={2} value={pText} onChange={(e) => setPText(e.target.value)} placeholder="Isi teks prompt..." />
            <Button className="h-9 w-fit text-xs" disabled={!pTitle.trim() || !pText.trim()} onClick={() => { reqMut.mutate({ path: '/admin/lms/prompts', method: 'POST', json: { stage: pStage, title: pTitle, promptText: pText } }); setPTitle(''); setPText(''); }}>+ Tambah Prompt</Button>
          </Card>
          <Card className="divide-y divide-line p-4 text-xs">
            {(promptsQ.data?.items ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div><span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{p.stage}</span><span className="font-medium">{p.title}</span></div>
                <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/prompts/${p.id}`, method: 'DELETE' })}>Hapus</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'recipes' && (
        <div className="grid gap-4">
          <Card className="grid gap-2 md:grid-cols-4 p-4">
            <Input value={rCat} onChange={(e) => setRCat(e.target.value)} placeholder="Kategori" />
            <Input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Nama Resep" />
            <Input value={rMode} onChange={(e) => setRMode(e.target.value)} placeholder="Mode Cerita" />
            <Button className="h-10 text-xs" disabled={!rTitle.trim()} onClick={() => { reqMut.mutate({ path: '/admin/lms/recipes', method: 'POST', json: { category: rCat, title: rTitle, modeCerita: rMode } }); setRTitle(''); setRMode(''); }}>+ Tambah Resep</Button>
          </Card>
          <Card className="divide-y divide-line p-4 text-xs">
            {(recipesQ.data?.items ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <span><span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{r.category}</span>{r.title} · <span className="text-muted">{r.modeCerita}</span></span>
                <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/recipes/${r.id}`, method: 'DELETE' })}>Hapus</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'glossary' && (
        <div className="grid gap-4">
          <Card className="grid gap-2 md:grid-cols-4 p-4">
            <Input value={gCat} onChange={(e) => setGCat(e.target.value)} placeholder="Kategori" />
            <Input value={gTerm} onChange={(e) => setGTerm(e.target.value)} placeholder="Istilah" />
            <Input value={gDef} onChange={(e) => setGDef(e.target.value)} placeholder="Definisi" />
            <Button className="h-10 text-xs" disabled={!gTerm.trim() || !gDef.trim()} onClick={() => { reqMut.mutate({ path: '/admin/lms/glossary', method: 'POST', json: { category: gCat, term: gTerm, definition: gDef } }); setGTerm(''); setGDef(''); }}>+ Tambah Istilah</Button>
          </Card>
          <Card className="divide-y divide-line p-4 text-xs">
            {(glossaryQ.data?.items ?? []).map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2">
                <span><span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{g.category}</span><b>{g.term}</b> — {g.definition}</span>
                <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/glossary/${g.id}`, method: 'DELETE' })}>Hapus</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'effects' && (
        <div className="grid gap-4">
          <Card className="grid gap-2 md:grid-cols-4 p-4">
            <Input value={eCat} onChange={(e) => setECat(e.target.value)} placeholder="Kategori" />
            <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Nama Efek" />
            <Input value={eSnip} onChange={(e) => setESnip(e.target.value)} placeholder="Prompt snippet" />
            <Button className="h-10 text-xs" disabled={!eName.trim()} onClick={() => { reqMut.mutate({ path: '/admin/lms/effects', method: 'POST', json: { category: eCat, name: eName, promptSnippet: eSnip } }); setEName(''); setESnip(''); }}>+ Tambah Efek</Button>
          </Card>
          <Card className="divide-y divide-line p-4 text-xs">
            {(effectsQ.data?.items ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2">
                <span><span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{e.category}</span><b>{e.name}</b> — <code className="text-muted">{e.promptSnippet}</code></span>
                <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/effects/${e.id}`, method: 'DELETE' })}>Hapus</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'updates' && (
        <div className="grid gap-4">
          <Card className="grid gap-2 md:grid-cols-3 p-4">
            <Input value={uVer} onChange={(e) => setUVer(e.target.value)} placeholder="v2.4.0" />
            <Input value={uTitle} onChange={(e) => setUTitle(e.target.value)} placeholder="Judul rilisan update" />
            <Button className="h-10 text-xs" disabled={!uVer.trim() || !uTitle.trim()} onClick={() => { reqMut.mutate({ path: '/admin/lms/updates', method: 'POST', json: { version: uVer, title: uTitle, highlights: [uTitle] } }); setUVer(''); setUTitle(''); }}>+ Tambah Update</Button>
          </Card>
          <Card className="divide-y divide-line p-4 text-xs">
            {(updatesQ.data?.items ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2">
                <span><span className="mr-2 font-mono font-bold text-accent">{u.version}</span>{u.title} <span className="text-muted">({u.releasedAt})</span></span>
                <button type="button" className="text-bad hover:underline" onClick={() => reqMut.mutate({ path: `/admin/lms/updates/${u.id}`, method: 'DELETE' })}>Hapus</button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
