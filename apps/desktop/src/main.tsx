import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import { App } from './App';

// Ensure default theme is light immediately on initial load
const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('dentsweb-theme')) || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

const report = (err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  void window.dentweb?.invoke('telemetry:error', { message: e.message.slice(0, 2000) || 'Unknown error', stack: e.stack?.slice(0, 8000) }).catch(() => undefined);
};
window.addEventListener('error', (e) => report(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => report(e.reason));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <App />
  </QueryClientProvider>,
);
