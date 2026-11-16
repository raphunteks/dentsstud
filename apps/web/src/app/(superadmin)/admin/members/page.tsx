'use client';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';

interface Row {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  licenseStatus: string | null;
}

export default function MembersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDeferredValue(q);
  const list = useInfiniteQuery({
    queryKey: ['admin-members', dq, status],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ limit: '25' });
      if (dq) p.set('q', dq);
      if (status) p.set('status', status);
      if (pageParam) p.set('cursor', pageParam);
      return api<{ items: Row[]; nextCursor: string | null }>(`/admin/members?${p}`);
    },
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHead eyebrow="02 · Member management" title="Member" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input aria-label="Cari member" placeholder="Cari email atau nama" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-3 text-sm">
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PENDING_VERIFICATION">Menunggu verifikasi</option>
          <option value="SUSPENDED">Ditangguhkan</option>
          <option value="DISABLED">Nonaktif</option>
        </select>
      </div>
      {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <Skeleton className="h-64 rounded-card" />}
      {list.isSuccess && rows.length === 0 && <Empty title="Tidak ada member" body="Tidak ada akun yang cocok dengan filter ini." />}
      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Lisensi</th>
                <th className="px-5 py-3 font-medium">Terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/members/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                      {r.displayName}
                    </Link>
                    <p className="text-muted">{r.email}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{r.role}</td>
                  <td className="px-5 py-3">
                    <Status value={r.status} />
                  </td>
                  <td className="px-5 py-3">{r.licenseStatus ? <Status value={r.licenseStatus} /> : <span className="text-muted">—</span>}</td>
                  <td className="px-5 py-3 text-muted">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.hasNextPage && (
        <div className="mt-4">
          <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            Muat lebih banyak
          </Button>
        </div>
      )}
    </>
  );
}
