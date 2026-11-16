'use client';
import { create } from 'zustand';
import { applyOperation, type Layer, type MotionDocument, type Operation } from '@dentweb/motion-schema';

interface EditorState {
  doc: MotionDocument | null;
  revision: number;
  past: MotionDocument[];
  future: MotionDocument[];
  dirty: boolean;
  sceneId: string | null;
  layerId: string | null;
  error: string | null;
  load: (doc: MotionDocument, revision: number) => void;
  apply: (op: Operation) => boolean;
  undo: () => void;
  redo: () => void;
  select: (sceneId: string | null, layerId?: string | null) => void;
  saved: (revision: number) => void;
}

/** Editor state: every change is a validated operation; undo/redo keep 100 steps. */
export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  revision: 0,
  past: [],
  future: [],
  dirty: false,
  sceneId: null,
  layerId: null,
  error: null,
  load: (doc, revision) => set({ doc, revision, past: [], future: [], dirty: false, sceneId: doc.scenes[0]?.id ?? null, layerId: null, error: null }),
  apply: (op) => {
    const { doc, past } = get();
    if (!doc) return false;
    try {
      const next = applyOperation(doc, op);
      set({ doc: next, past: [...past.slice(-99), doc], future: [], dirty: true, error: null });
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length || !doc) return;
    set({ doc: past[past.length - 1]!, past: past.slice(0, -1), future: [doc, ...future], dirty: true });
  },
  redo: () => {
    const { future, doc, past } = get();
    if (!future.length || !doc) return;
    set({ doc: future[0]!, future: future.slice(1), past: [...past, doc], dirty: true });
  },
  select: (sceneId, layerId = null) => set({ sceneId, layerId }),
  saved: (revision) => set({ revision, dirty: false }),
}));

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;
export const sceneStart = (doc: MotionDocument, sceneId: string) => {
  let f = 0;
  for (const s of doc.scenes) {
    if (s.id === sceneId) return f;
    f += s.durationFrames;
  }
  return 0;
};
export type { Layer };
