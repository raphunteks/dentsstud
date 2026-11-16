import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { MEMBER_NAV } from '@/components/shell/nav';

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={MEMBER_NAV} variant="member">
      {children}
    </AppShell>
  );
}
