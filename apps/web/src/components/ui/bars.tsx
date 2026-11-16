'use client';
import { useState } from 'react';

/**
 * Single-series bar chart (magnitude). One hue (accent), 4px rounded data-end anchored to the baseline,
 * recessive axis, per-bar hover tooltip with hit targets larger than the mark, and a visually-hidden table.
 */
export function Bars({ data, label, unit = '', height = 180 }: { data: { key: string; label: string; value: number }[]; label: string; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const nice = Math.max(4, Math.ceil(max / mag) * mag);
  const h = height - 24;
  return (
    <figure className="relative">
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <div key={t} aria-hidden className="absolute inset-x-0 border-t border-line/60" style={{ bottom: 24 + t * h }}>
            <span className="num absolute -top-2.5 right-0 bg-surface pl-1 font-mono text-[10px] text-muted">{Math.round(nice * t)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-[2px] pr-8">
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.label}: ${d.value}${unit}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="group relative flex h-full flex-1 items-end focus:outline-none"
            >
              <span
                className="block w-full rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-text"
                style={{ height: `${(d.value / nice) * 100}%`, minHeight: d.value > 0 ? 2 : 0, maxWidth: 28, margin: '0 auto' }}
              />
            </button>
          ))}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between pr-8 font-mono text-[10px] text-muted">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
        {hover !== null && data[hover] && (
          <div role="status" className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm">
            <span className="text-muted">{data[hover].label}</span> <span className="num font-medium text-text">{data[hover].value}{unit}</span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{data.map((d) => <tr key={d.key}><th>{d.label}</th><td>{d.value}{unit}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
