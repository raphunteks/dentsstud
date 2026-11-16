'use client';
import clsx from 'clsx';
import { useEffect, useRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx('h-9 rounded-lg px-3 text-sm transition-colors', value === it.value ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:text-text')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('h-11 rounded-[10px] border border-line bg-surface px-3 text-sm text-text', className)} {...p} />;
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('min-h-24 w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-text outline-none focus:border-accent', className)} {...p} />;
}

/** Native <dialog> modal: focus trap, Esc to close, backdrop click closes. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx('m-auto w-[calc(100%-32px)] rounded-card border border-line bg-surface p-0 text-text backdrop:bg-black/50', wide ? 'max-w-4xl' : 'max-w-lg')}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        <button onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2">✕</button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

export function Table({ head, children, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="text-left text-muted">
          <tr className="border-b border-line">{head.map((h, i) => <th key={i} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded bg-surface-2">
      <div className="h-full origin-left rounded bg-accent transition-transform duration-500" style={{ transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})` }} />
    </div>
  );
}

export function Audio({ src }: { src: string | null | undefined }) {
  if (!src) return null;
  return <audio controls preload="none" src={src} className="h-9 w-full" />;
}
