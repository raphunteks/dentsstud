'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, fmtDate } from '@/lib/api';
import { Card, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

interface Row {
  license: { id: string; userId: string; status: string; maxDevices: number; validUntil: string | null; createdAt: string; entitlements: { maxWorkers: number; maxVideosPerDay: number } };
  email: string;
  displayName: string;
}

export default function LicensesPage() {
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['admin-licenses', status], queryFn: () => api<{ items: Row[] }>(`/admin/licenses?limit=100${status ? `&status=${status}` : ''}`) });
  return (
    <>
      <PageHead eyebrow="03 · License manager" title="Lisensi" />
      <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 h-11 rounded-[10px] border border-line bg-surface px-3 text-sm">
        <option value="">Semua</option>
        <option value="ACTIVE">Aktif</option>
        <option value="REVOKED">Dicabut</option>
      </select>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <Skeleton className="h-48 rounded-card" />}
      {q.data?.items.length === 0 && <Empty title="Belum ada lisensi" body="Berikan lisensi dari halaman detail member." />}
      {!!q.data?.items.length && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Perangkat</th>
                <th className="px-5 py-3 font-medium">Worker · video/hari</th>
                <th className="px-5 py-3 font-medium">Berlaku</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.license.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <Link className="font-medium hover:underline" href={`/admin/members/${r.license.userId}`}>
                      {r.displayName}
                    </Link>
                    <p className="text-muted">{r.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Status value={r.license.status} />
                  </td>
                  <td className="num px-5 py-3">{r.license.maxDevices}</td>
                  <td className="num px-5 py-3">
                    {r.license.entitlements.maxWorkers} · {r.license.entitlements.maxVideosPerDay}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {fmtDate(r.license.createdAt)} → {r.license.validUntil ? fmtDate(r.license.validUntil) : 'tanpa batas'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
