'use client';
import { Player, type PlayerRef } from '@remotion/player';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { MotionComp } from '@dentweb/remotion-compositions/components';
import { ANIMATABLE, durationOf, valueAt, type Layer, type MotionDocument } from '@dentweb/motion-schema';
import { api, ApiError } from '@/lib/api';
import { Button, Field, Input, Skeleton, Status } from '@/components/ui';
import { Select, Textarea } from '@/components/ui/extra';
import { sceneStart, uid, useEditor } from './store';

interface Preset { id: string; name: string; currentVersion: number; thumbnailUrl: string | null }

export function Editor({ projectId }: { projectId: string }) {
  const s = useEditor();
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const q = useQuery({ queryKey: ['project-doc', projectId], queryFn: () => api<{ revision: number; document: MotionDocument; project: { name: string } }>(`/projects/${projectId}/document`), refetchOnMount: 'always', staleTime: 0 });
  useEffect(() => { if (q.data) s.load(q.data.document, q.data.revision); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: debounced whole-document save with optimistic concurrency (never blocks the UI).
  const save = useMutation({
    mutationFn: (v: { doc: MotionDocument; rev: number }) => api<{ revision: number }>(`/projects/${projectId}/document`, { method: 'PUT', json: { document: v.doc, baseRevision: v.rev } }),
    onSuccess: (r) => useEditor.getState().saved(r.revision),
    onError: (e) => toast.error(e instanceof ApiError && e.code === 'REVISION_CONFLICT' ? 'Project diubah di perangkat lain. Muat ulang untuk melihat versi terbaru.' : (e as Error).message),
  });
  useEffect(() => {
    if (!s.dirty || !s.doc || save.isPending) return;
    const t = setTimeout(() => save.mutate({ doc: s.doc!, rev: s.revision }), 1200);
    return () => clearTimeout(t);
  }, [s.doc, s.dirty, s.revision, save.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const h = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener('frameupdate', h);
    return () => p.removeEventListener('frameupdate', h);
  }, [s.doc?.scenes.length]);

  const onKey = useCallback((e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') (e.preventDefault(), e.shiftKey ? useEditor.getState().redo() : useEditor.getState().undo());
    if (e.key === ' ') (e.preventDefault(), player.current?.toggle());
    const st = useEditor.getState();
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.layerId && st.sceneId) st.apply({ op: 'removeLayer', sceneId: st.sceneId, layerId: st.layerId }) && st.select(st.sceneId);
  }, []);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

  const render = useMutation({
    mutationFn: async (mode: 'CLOUD' | 'LOCAL') => {
      if (useEditor.getState().dirty) await save.mutateAsync({ doc: useEditor.getState().doc!, rev: useEditor.getState().revision });
      return api<{ id: string }>('/render/jobs', { method: 'POST', json: { projectId, mode, format: 'mp4' } });
    },
    onSuccess: (_j, mode) => toast.success(mode === 'CLOUD' ? 'Render cloud masuk antrean. Pantau di Render Center.' : 'Job render lokal dibuat. Buka aplikasi desktop untuk menjalankannya.'),
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isError) return <p role="alert" className="text-bad">{(q.error as Error).message}</p>;
  if (!s.doc) return <Skeleton className="h-[70vh] rounded-card" />;
  const doc = s.doc;
  const scene = doc.scenes.find((x) => x.id === s.sceneId) ?? doc.scenes[0]!;
  const layer = scene.layers.find((l) => l.id === s.layerId) ?? null;
  const local = frame - sceneStart(doc, scene.id);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/studio/projects" className="text-sm text-muted hover:text-text">← Projects</Link>
        <input aria-label="Judul project" value={doc.title} onChange={(e) => s.apply({ op: 'setMeta', patch: { title: e.target.value } })} className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-display text-xl font-medium hover:bg-surface-2 focus:bg-surface-2" />
        <span className="text-xs text-muted" role="status">{save.isPending ? 'Menyimpan…' : s.dirty ? 'Belum tersimpan' : `Tersimpan · rev ${s.revision}`}</span>
        <Button variant="quiet" onClick={s.undo} disabled={!s.past.length} aria-label="Undo">↶</Button>
        <Button variant="quiet" onClick={s.redo} disabled={!s.future.length} aria-label="Redo">↷</Button>
        <PresetPicker />
        <Button variant="ghost" loading={render.isPending && render.variables === 'LOCAL'} onClick={() => render.mutate('LOCAL')}>Render lokal</Button>
        <Button loading={render.isPending && render.variables === 'CLOUD'} onClick={() => render.mutate('CLOUD')}>Render cloud</Button>
      </div>
      {s.error && <p role="alert" className="text-sm text-bad">{s.error}</p>}
      <div className="grid gap-3 xl:grid-cols-[220px_1fr_300px]">
        <SceneList onSeek={(f) => player.current?.seekTo(f)} />
        <div className="grid content-start gap-3">
          <div className="relative mx-auto w-full" style={{ maxWidth: doc.width >= doc.height ? '100%' : 380 }}>
            <Player
              ref={player}
              component={MotionComp}
              inputProps={{ doc }}
              durationInFrames={Math.max(1, durationOf(doc))}
              fps={doc.fps}
              compositionWidth={doc.width}
              compositionHeight={doc.height}
              controls
              style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}
              acknowledgeRemotionLicense
            />
            <CanvasOverlay sceneLocal={local} />
          </div>
          <Timeline frame={frame} onSeek={(f) => player.current?.seekTo(f)} />
        </div>
        <Inspector layer={layer} local={local} />
      </div>
    </div>
  );
}

function PresetPicker() {
  const s = useEditor();
  const q = useQuery({ queryKey: ['presets', '', ''], queryFn: () => api<{ items: Preset[] }>('/styles/presets?limit=100') });
  const apply = async (id: string) => {
    if (!id) return s.apply({ op: 'setMeta', patch: { preset: null } });
    const p = await api<{ id: string; name: string; version: number; recipe: MotionDocument['style'] }>(`/styles/presets/${id}`);
    s.apply({ op: 'setMeta', patch: { preset: { id: p.id, version: p.version, name: p.name }, style: { ...s.doc!.style, ...p.recipe } } });
  };
  return (
    <Select aria-label="Gaya visual" value={s.doc?.preset?.id ?? ''} onChange={(e) => void apply(e.target.value)} className="h-10">
      <option value="">{q.data?.items.length ? 'Gaya: default' : 'Belum ada preset'}</option>
      {q.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  );
}

function SceneList({ onSeek }: { onSeek: (f: number) => void }) {
  const s = useEditor();
  const doc = s.doc!;
  return (
    <div className="grid content-start gap-2 rounded-card border border-line bg-surface p-3">
      <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Scene</h2>
        <Button variant="quiet" className="h-8" onClick={() => { const id = uid('s'); s.apply({ op: 'addScene', scene: { id, name: `Scene ${doc.scenes.length + 1}`, durationFrames: doc.fps * 4, transition: doc.style.motion.transition, layers: [] } }); s.select(id); }}>+ Scene</Button>
      </div>
      <ol className="grid gap-1">
        {doc.scenes.map((sc, i) => (
          <li key={sc.id}>
            <button onClick={() => (s.select(sc.id), onSeek(sceneStart(doc, sc.id)))} aria-current={s.sceneId === sc.id} className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ${s.sceneId === sc.id ? 'bg-surface-2 font-medium' : 'hover:bg-surface-2/60'}`}>
              <span className="truncate">{i + 1}. {sc.name || sc.id}</span><span className="num text-xs text-muted">{(sc.durationFrames / doc.fps).toFixed(1)}s</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-2 grid gap-1 border-t border-line pt-2">
        <h3 className="text-xs font-medium text-muted">Tambah layer</h3>
        {(['text', 'shape', 'image'] as const).map((t) => <AddLayer key={t} type={t} />)}
      </div>
    </div>
  );
}

function AddLayer({ type }: { type: 'text' | 'shape' | 'image' }) {
  const s = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const add = (extra: Record<string, unknown> = {}) => {
    const id = uid('l');
    const base = { id, name: '', x: 0.5, y: 0.5, w: 0.8, h: 0.2, rotation: 0, scale: 1, opacity: 1, startFrame: 0, keyframes: {}, effect: 'fade' as const, locked: false, hidden: false };
    const layer = type === 'text' ? { ...base, type, text: 'Teks baru', role: 'body' as const } : type === 'shape' ? { ...base, type, shape: 'rect' as const, h: 0.1, strokeWidth: 0, radius: 0 } : { ...base, type, fit: 'cover' as const, h: 0.4, ...extra };
    if (s.sceneId && s.apply({ op: 'addLayer', sceneId: s.sceneId, layer: layer as Layer })) s.select(s.sceneId, id);
  };
  const upload = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/v1/media', { method: 'POST', body: fd, credentials: 'include' });
      const b = await r.json();
      if (!r.ok) throw new Error(b?.error?.message ?? 'Upload gagal');
      return b as { id: string; url: string };
    },
    onSuccess: (m) => add({ assetId: m.id, src: m.url }),
    onError: (e) => toast.error((e as Error).message),
  });
  const label = { text: 'Teks', shape: 'Bentuk', image: 'Gambar' }[type];
  if (type === 'image') return (<><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Pilih gambar" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} /><Button variant="ghost" className="h-9 justify-start" loading={upload.isPending} onClick={() => fileRef.current?.click()}>+ {label}</Button></>);
  return <Button variant="ghost" className="h-9 justify-start" onClick={() => add()}>+ {label}</Button>;
}

/** Drag-to-move boxes over the preview for the current scene's layers. */
function CanvasOverlay({ sceneLocal }: { sceneLocal: number }) {
  const s = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const doc = s.doc!;
  const scene = doc.scenes.find((x) => x.id === s.sceneId);
  if (!scene) return null;
  const pad = doc.style.layout.safeArea;
  const onDown = (e: React.PointerEvent, l: Layer) => {
    if (l.locked) return;
    s.select(scene.id, l.id);
    const box = ref.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = l.x, oy = l.y;
    const inner = { w: box.width * (1 - 2 * pad), h: box.height * (1 - 2 * pad) };
    let lx = ox, ly = oy;
    const move = (ev: PointerEvent) => { lx = Math.round((ox + (ev.clientX - sx) / inner.w) * 1000) / 1000; ly = Math.round((oy + (ev.clientY - sy) / inner.h) * 1000) / 1000; ref.current!.querySelector<HTMLElement>(`[data-l="${l.id}"]`)!.style.translate = `${(lx - ox) * inner.w}px ${(ly - oy) * inner.h}px`; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); s.apply({ op: 'updateLayer', sceneId: scene.id, layerId: l.id, patch: { x: lx, y: ly } }); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 bottom-[42px]" style={{ padding: `${pad * 100}%` }}>
      <div className="relative size-full">
        {scene.layers.map((l) => {
          const x = valueAt(l, 'x', sceneLocal), y = valueAt(l, 'y', sceneLocal);
          return (
            <div key={l.id} data-l={l.id} onPointerDown={(e) => onDown(e, l)} title={l.type === 'text' ? l.text.slice(0, 30) : l.type}
              className={`pointer-events-auto absolute cursor-move rounded border ${s.layerId === l.id ? 'border-accent' : 'border-transparent hover:border-white/40'}`}
              style={{ left: `${(x - l.w / 2) * 100}%`, top: `${(y - l.h / 2) * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }} />
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ frame, onSeek }: { frame: number; onSeek: (f: number) => void }) {
  const s = useEditor();
  const doc = s.doc!;
  const total = Math.max(1, durationOf(doc));
  const scene = doc.scenes.find((x) => x.id === s.sceneId) ?? doc.scenes[0]!;
  const start = sceneStart(doc, scene.id);
  return (
    <div className="grid gap-2 rounded-card border border-line bg-surface p-3">
      <div className="relative flex h-10 overflow-hidden rounded-lg" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.round(((e.clientX - r.left) / r.width) * total)); }}>
        {doc.scenes.map((sc) => (
          <button key={sc.id} onClick={() => s.select(sc.id)} style={{ width: `${(sc.durationFrames / total) * 100}%` }} className={`truncate border-r border-bg px-2 text-left text-xs ${sc.id === scene.id ? 'bg-accent text-accent-contrast' : 'bg-surface-2'}`}>{sc.name || sc.id}</button>
        ))}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-text" style={{ left: `${(frame / total) * 100}%` }} />
      </div>
      <div className="grid gap-1">
        {scene.layers.map((l) => (
          <div key={l.id} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs">
            <button onClick={() => s.select(scene.id, l.id)} className={`truncate rounded px-1.5 py-1 text-left ${s.layerId === l.id ? 'bg-surface-2 font-medium' : 'text-muted'}`}>{l.type === 'text' ? l.text : l.type}</button>
            <div className="relative h-5 rounded bg-surface-2">
              <span className="absolute inset-y-0.5 rounded bg-accent/40" style={{ left: `${(l.startFrame / scene.durationFrames) * 100}%`, width: `${(((l.durationFrames ?? scene.durationFrames - l.startFrame)) / scene.durationFrames) * 100}%` }} />
              {Object.values(l.keyframes).flat().map((k, i) => k && <span key={i} aria-hidden className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-text" style={{ left: `${(k.frame / scene.durationFrames) * 100}%` }} />)}
              <span aria-hidden className="absolute inset-y-0 w-px bg-text/60" style={{ left: `${Math.max(0, Math.min(1, (frame - start) / scene.durationFrames)) * 100}%` }} />
            </div>
          </div>
        ))}
        {scene.layers.length === 0 && <p className="text-xs text-muted">Scene ini belum punya layer.</p>}
      </div>
    </div>
  );
}

function Inspector({ layer, local }: { layer: Layer | null; local: number }) {
  const s = useEditor();
  const doc = s.doc!;
  const scene = doc.scenes.find((x) => x.id === s.sceneId) ?? doc.scenes[0]!;
  const up = (patch: Record<string, unknown>) => layer && s.apply({ op: 'updateLayer', sceneId: scene.id, layerId: layer.id, patch });
  const num = (k: string, v: string) => up({ [k]: Number(v) });
  return (
    <div className="grid content-start gap-3 rounded-card border border-line bg-surface p-4 text-sm">
      <h2 className="font-medium">Scene</h2>
      <Field id="sc-name" label="Nama"><Input id="sc-name" value={scene.name} onChange={(e) => s.apply({ op: 'updateScene', sceneId: scene.id, patch: { name: e.target.value } })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field id="sc-dur" label="Durasi (detik)"><Input id="sc-dur" type="number" min={0.5} step={0.5} value={scene.durationFrames / doc.fps} onChange={(e) => s.apply({ op: 'updateScene', sceneId: scene.id, patch: { durationFrames: Math.max(1, Math.round(Number(e.target.value) * doc.fps)) } })} /></Field>
        <Field id="sc-tr" label="Transisi"><Select id="sc-tr" value={scene.transition} onChange={(e) => s.apply({ op: 'updateScene', sceneId: scene.id, patch: { transition: e.target.value as 'fade' } })}>{['cut', 'fade', 'slide', 'wipe', 'zoom'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
      </div>
      <Field id="sc-bg" label="Latar"><input id="sc-bg" type="color" value={scene.background ?? doc.style.palette.background} onChange={(e) => s.apply({ op: 'updateScene', sceneId: scene.id, patch: { background: e.target.value } })} className="h-9 w-full rounded" /></Field>
      <Field id="sc-narr" label="Narasi"><Textarea id="sc-narr" value={scene.narration ?? ''} onChange={(e) => s.apply({ op: 'updateScene', sceneId: scene.id, patch: { narration: e.target.value } })} className="min-h-16" /></Field>
      {doc.scenes.length > 1 && <Button variant="danger" className="h-9" onClick={() => s.apply({ op: 'removeScene', sceneId: scene.id }) && s.select(doc.scenes.find((x) => x.id !== scene.id)!.id)}>Hapus scene</Button>}
      {layer && (
        <>
          <h2 className="mt-2 border-t border-line pt-3 font-medium">Layer · {layer.type}</h2>
          {layer.type === 'text' && (
            <>
              <Field id="ly-text" label="Teks"><Textarea id="ly-text" value={layer.text} onChange={(e) => up({ text: e.target.value })} className="min-h-16" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field id="ly-role" label="Peran"><Select id="ly-role" value={layer.role} onChange={(e) => up({ role: e.target.value })}>{['title', 'body', 'caption', 'label'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
                <Field id="ly-col" label="Warna"><input id="ly-col" type="color" value={layer.color ?? doc.style.palette.ink} onChange={(e) => up({ color: e.target.value })} className="h-11 w-full rounded" /></Field>
              </div>
            </>
          )}
          {layer.type === 'shape' && (
            <div className="grid grid-cols-2 gap-2">
              <Field id="ly-sh" label="Bentuk"><Select id="ly-sh" value={layer.shape} onChange={(e) => up({ shape: e.target.value })}>{['rect', 'circle', 'line'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
              <Field id="ly-fill" label="Isi"><input id="ly-fill" type="color" value={layer.fill ?? doc.style.palette.accent} onChange={(e) => up({ fill: e.target.value })} className="h-11 w-full rounded" /></Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(['x', 'y', 'w', 'h'] as const).map((k) => <Field key={k} id={`ly-${k}`} label={k.toUpperCase()}><Input id={`ly-${k}`} type="number" step={0.01} value={layer[k]} onChange={(e) => num(k, e.target.value)} /></Field>)}
            <Field id="ly-rot" label="Rotasi"><Input id="ly-rot" type="number" value={layer.rotation} onChange={(e) => num('rotation', e.target.value)} /></Field>
            <Field id="ly-op" label="Opasitas"><Input id="ly-op" type="number" min={0} max={1} step={0.05} value={layer.opacity} onChange={(e) => num('opacity', e.target.value)} /></Field>
            <Field id="ly-st" label="Mulai (frame)"><Input id="ly-st" type="number" min={0} value={layer.startFrame} onChange={(e) => num('startFrame', e.target.value)} /></Field>
            <Field id="ly-fx" label="Efek masuk"><Select id="ly-fx" value={layer.effect} onChange={(e) => up({ effect: e.target.value })}>{['none', 'fade', 'rise', 'pop', 'wipe', 'typewriter', 'blur'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="text-[13px] font-medium">Keyframe di frame {Math.max(0, local)}</legend>
            <div className="flex flex-wrap gap-1">
              {ANIMATABLE.map((p) => (
                <Button key={p} variant="ghost" className="h-8 px-2 text-xs" onClick={() => { const kf = [...(layer.keyframes[p] ?? []).filter((k) => k.frame !== Math.max(0, local)), { frame: Math.max(0, local), value: valueAt(layer, p, local), easing: doc.style.motion.easing }]; up({ keyframes: { ...layer.keyframes, [p]: kf } }); }}>◆ {p}</Button>
              ))}
              {Object.keys(layer.keyframes).length > 0 && <Button variant="quiet" className="h-8 px-2 text-xs" onClick={() => up({ keyframes: {} })}>Hapus semua</Button>}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={layer.locked} onChange={(e) => up({ locked: e.target.checked })} /> Kunci</label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={layer.hidden} onChange={(e) => up({ hidden: e.target.checked })} /> Sembunyikan</label>
          </div>
          <Button variant="danger" className="h-9" onClick={() => s.apply({ op: 'removeLayer', sceneId: scene.id, layerId: layer.id }) && s.select(scene.id)}>Hapus layer</Button>
        </>
      )}
      {!layer && <p className="text-xs text-muted">Pilih layer di canvas atau timeline. Spasi: putar/jeda · Ctrl/⌘+Z: undo · Delete: hapus layer.</p>}
      <p className="text-xs text-muted">Durasi total <span className="num">{(durationOf(doc) / doc.fps).toFixed(1)}s</span> · {doc.width}×{doc.height} · <Status value={doc.preset ? 'ok' : 'neutral'} label={doc.preset?.name ?? 'gaya default'} /></p>
    </div>
  );
}
