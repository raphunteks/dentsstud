import { describe, expect, it } from 'vitest';
import { applyOperation, durationOf, newDocument, valueAt, MotionDocument } from '../src/index.js';

describe('motion-schema', () => {
  it('creates valid documents per format', () => {
    const d = newDocument('9:16', 'Uji');
    expect(d.width).toBe(1080);
    expect(d.height).toBe(1920);
    expect(durationOf(d)).toBe(120);
  });
  it('interpolates keyframes with easing and clamps outside range', () => {
    const l = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, keyframes: { x: [{ frame: 0, value: 0, easing: 'linear' as const }, { frame: 10, value: 1, easing: 'linear' as const }] } };
    expect(valueAt(l, 'x', 5)).toBeCloseTo(0.5);
    expect(valueAt(l, 'x', -3)).toBe(0);
    expect(valueAt(l, 'x', 99)).toBe(1);
    expect(valueAt(l, 'y', 5)).toBe(0.5);
  });
  it('applies operations and rejects invalid results', () => {
    let d = newDocument('1:1');
    d = applyOperation(d, { op: 'addScene', scene: { id: 's2', name: '', durationFrames: 60, transition: 'fade', layers: [] } });
    d = applyOperation(d, { op: 'addLayer', sceneId: 's2', layer: { id: 'b', type: 'shape', shape: 'rect', fill: '#ff0000', x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, scale: 1, opacity: 1, startFrame: 0, keyframes: {}, effect: 'none', strokeWidth: 0, radius: 0, locked: false, hidden: false, name: '' } });
    d = applyOperation(d, { op: 'updateLayer', sceneId: 's2', layerId: 'b', patch: { opacity: 0.5 } });
    expect(d.scenes[1]!.layers[0]!.opacity).toBe(0.5);
    expect(() => applyOperation(d, { op: 'updateLayer', sceneId: 's2', layerId: 'b', patch: { opacity: 5 } })).toThrow();
    d = applyOperation(d, { op: 'moveScene', sceneId: 's2', index: 0 });
    expect(d.scenes[0]!.id).toBe('s2');
    expect(() => MotionDocument.parse({ ...d, scenes: [] })).toThrow();
  });
});
