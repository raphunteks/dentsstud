'use client';
import { useQuery } from '@tanstack/react-query';
import type { SessionUser } from '@dentweb/shared-types';
import { api } from './api';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ user: SessionUser; sessionId: string }>('/auth/session'),
    staleTime: 60_000,
    retry: false,
  });
}
