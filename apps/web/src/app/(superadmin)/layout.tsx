import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { ADMIN_NAV } from '@/components/shell/nav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={ADMIN_NAV} variant="admin" requireRole="SUPERADMIN">
      {children}
    </AppShell>
  );
}
