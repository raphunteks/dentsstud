import clsx from 'clsx';
import { Component, type ButtonHTMLAttributes, type ErrorInfo, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { BridgeError } from '../bridge';
import logoSvg from '../assets/logo.svg';

export const errMsg = (e: unknown) => (e instanceof BridgeError ? e.message : (e as Error)?.message ?? 'Gagal');

export function Mark({ className }: { className?: string }) {
  return (
    <div className={clsx('inline-flex items-center gap-2.5 font-display font-medium tracking-tight', className)}>
      <span aria-hidden className="grid size-8 place-items-center rounded-xl bg-[#10131F] p-1 shadow-sm ring-1 ring-white/10">
        <img src={logoSvg} alt="" className="size-full object-contain" />
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-[-0.02em] text-text">
          DENTSWEB <span className="font-normal text-muted">STUDIO</span>
        </span>
        <span className="mt-0.5 text-[10px] font-normal text-muted">Motion graphic otomatis</span>
      </div>
    </div>
  );
}

export function Pill({
  ok,
  variant,
  children,
  className,
}: {
  ok?: boolean | null;
  variant?: 'blue' | 'accent' | 'default';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-normal',
        variant === 'blue'
          ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : variant === 'accent'
          ? 'border-accent/40 bg-accent/10 text-accent font-semibold'
          : 'border-line bg-surface text-text',
        className
      )}
    >
      {ok !== undefined && (
        <span
          className={clsx(
            'size-1.5 rounded-full',
            ok === true ? 'bg-ok' : ok === false ? 'bg-bad' : 'bg-warn'
          )}
        />
      )}
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section
      onClick={onClick}
      className={clsx(
        'min-w-0 rounded-card border border-line bg-surface p-5 shadow-xs transition-[border-color,background-color] duration-150',
        className
      )}
    >
      {children}
    </section>
  );
}

export const btnBase =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      {...props}
      className={clsx(
        btnBase,
        size === 'sm' && 'h-8 px-3 text-xs rounded-[8px]',
        size === 'lg' && 'h-12 px-6 text-base rounded-xl',
        variant === 'primary' && 'bg-accent text-accent-contrast hover:brightness-110 shadow-xs',
        variant === 'ghost' && 'border border-line bg-surface hover:bg-surface-2 text-text',
        variant === 'outline' && 'border border-line/80 hover:border-text/40 text-text',
        variant === 'danger' && 'bg-bad text-white hover:brightness-110',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent',
        className
      )}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'w-full rounded-[10px] border border-line bg-surface p-3 text-sm text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent',
        className
      )}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'h-11 rounded-[10px] border border-line bg-surface px-3 text-sm text-text outline-none transition focus:border-accent',
        className
      )}
    >
      {children}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-text">{title}</h3>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg border border-line text-muted hover:text-text cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="grid place-items-center min-h-[360px] p-6">
          <Card className="max-w-md w-full p-6 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-bad/10 text-bad font-bold text-lg">
              ✕
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-text">Terjadi Kendala Memuat Tampilan</h2>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {this.state.error?.message || 'Gagal merender komponen UI.'}
              </p>
            </div>
            <div className="pt-2 flex gap-2 justify-center">
              <Button size="sm" onClick={this.handleReset}>
                Muat Ulang Tampilan
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
