'use client';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }>(
  function Button({ variant = 'primary', loading, className, children, disabled, ...p }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={clsx(
          'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-[transform,background-color,opacity] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'primary' && 'bg-accent text-accent-contrast hover:brightness-110',
          variant === 'ghost' && 'border border-line bg-surface text-text hover:bg-surface-2',
          variant === 'quiet' && 'text-muted hover:bg-surface-2 hover:text-text',
          variant === 'danger' && 'border border-bad/40 text-bad hover:bg-bad/10',
          className,
        )}
        {...p}
      >
        {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        'h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-muted/70 focus:border-accent',
        invalid ? 'border-bad' : 'border-line',
        className,
      )}
      {...p}
    />
  );
});

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={clsx('rounded-card border border-line bg-surface', className)}>{children}</As>;
}

const tone: Record<string, string> = {
  CONNECTED: 'ok', ACTIVE: 'ok', PUBLISHED: 'ok', COMPLETED: 'ok', ok: 'ok',
  INVALID: 'bad', REVOKED: 'bad', FAILED: 'bad', SUSPENDED: 'bad', DISABLED: 'bad', bad: 'bad',
  UNAVAILABLE: 'warn', PENDING_VERIFICATION: 'warn', RUNNING: 'warn', QUEUED: 'warn', EXPIRED: 'warn', CANCELLING: 'warn', warn: 'warn',
  READY: 'ok', UPLOADED: 'ok', VERIFIED: 'ok', CONTRADICTED: 'bad', UNVERIFIED: 'warn',
};
export function Status({ value, label }: { value: string; label?: string }) {
  const t = tone[value] ?? 'neutral';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-text">
      <span
        aria-hidden
        className={clsx('size-1.5 rounded-full', t === 'ok' && 'bg-ok', t === 'bad' && 'bg-bad', t === 'warn' && 'bg-warn', t === 'neutral' && 'bg-muted')}
      />
      {label ?? value.replaceAll('_', ' ')}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      <div aria-hidden className="grid size-10 place-items-center rounded-full border border-line">
        <span className="size-2 rounded-full bg-accent" />
      </div>
      <h3 className="font-display text-lg font-medium">{title}</h3>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-md bg-surface-2', className)} />;
}

export function PageHead({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        {eyebrow && <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[28px] font-medium leading-tight  md:text-[34px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad/5 px-4 py-3 text-sm">
      <span>{error instanceof Error ? error.message : 'Gagal memuat data'}</span>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 font-display font-medium tracking-[-0.02em]', className)}>
      <img src="/logo.svg" alt="" className="h-6 w-6 rounded-md object-contain" />
      <span>
        DENTSWEB<span className="ml-1 font-normal text-muted">STUDIO</span>
      </span>
    </span>
  );
}
