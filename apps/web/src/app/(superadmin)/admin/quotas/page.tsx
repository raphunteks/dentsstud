'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, PageHead, Skeleton } from '@/components/ui';
import { Progress, Table } from '@/components/ui/extra';

interface Row { id: string; userId?: string; email: string; displayName: string; entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean }; usedToday: number; active: number }

export default function AdminQuotas() {
  const q = useQuery({ queryKey: ['admin-quotas'], queryFn: () => api<Row[]>('/admin/production/quotas'), refetchInterval: 15_000 });
  const tick = useMutation({
    mutationFn: () => api<{ created: number }>('/admin/production/scheduler/tick', { method: 'POST' }),
    onSuccess: (r) => toast.success(r.created ? `${r.created} pesanan terjadwal dibuat` : 'Tidak ada slot jadwal yang jatuh tempo saat ini'),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHead eyebrow="10 · Superadmin" title="Otomasi & Kuota" actions={<Button variant="ghost" loading={tick.isPending} onClick={() => tick.mutate()}>Jalankan scheduler sekarang</Button>} />
      <Card className="mb-5 p-5 text-sm text-muted">
        Batas per member berasal dari entitlement lisensi (<Link href="/admin/licenses" className="underline">03 Lisensi</Link>). Batas render cloud bersamaan global ada di <Link href="/admin/system" className="underline">14 Sistem</Link> (quota.perMemberConcurrency). Scheduler berjalan tiap menit; slot jadwal yang sama tidak pernah membuat pesanan ganda.
      </Card>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <Skeleton className="h-64 rounded-card" />}
      {q.data?.length === 0 && <Empty title="Belum ada member berlisensi aktif" body="Member dengan lisensi aktif dan pemakaian kuotanya tampil di sini." />}
      {!!q.data?.length && (
        <Table head={['Member', 'Video hari ini', 'Produksi aktif', 'Worker maks', 'Render cloud']} minWidth={760}>
          {q.data.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/members/${r.userId ?? r.id}`} className="font-medium hover:underline">
                  {r.displayName}
                </Link>
                <br />
                <span className="text-xs text-muted">{r.email}</span>
              </td>
              <td className="w-56"><Progress value={(r.usedToday / Math.max(1, r.entitlements.maxVideosPerDay)) * 100} label={`Kuota ${r.email}`} /><span className="num font-mono text-xs text-muted">{r.usedToday} / {r.entitlements.maxVideosPerDay}</span></td>
              <td className="num font-mono">{r.active}</td>
              <td className="num font-mono">{r.entitlements.maxWorkers}</td>
              <td>{r.entitlements.cloudRender ? 'Ya' : 'Tidak'}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
