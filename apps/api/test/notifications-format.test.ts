import { describe, expect, it } from 'vitest';
import { formatNotification } from '../src/infra/notifications.service.js';

describe('formatNotification', () => {
  const base = { id: 'n-1', readAt: null, createdAt: new Date('2026-11-22T00:00:00Z') };

  it('formats known notification types with non-empty title, body, actionTab, targetId', () => {
    const completed = formatNotification({ ...base, type: 'production.completed', payload: { runId: 'r-1', resultId: 'res-1', topic: 'Gigi Sehat' } });
    expect(completed.title).toBe('Video selesai diproduksi');
    expect(completed.body).toContain('Gigi Sehat');
    expect(completed.actionTab).toBe('hasil');
    expect(completed.targetId).toBe('res-1');

    const failed = formatNotification({ ...base, type: 'production.failed', payload: { runId: 'r-2', message: 'Quota exceeded' } });
    expect(failed.title).toBe('Produksi video gagal');
    expect(failed.body).toBe('Quota exceeded');
    expect(failed.actionTab).toBe('progress');
    expect(failed.targetId).toBe('r-2');

    const skipped = formatNotification({ ...base, type: 'schedule.skipped', payload: { slot: '2026-11-22 08:00', message: 'Claude offline' } });
    expect(skipped.title).toBe('Jadwal produksi dilewati');
    expect(skipped.body).toContain('2026-11-22 08:00');
    expect(skipped.actionTab).toBe('pengaturan');

    const reply = formatNotification({ ...base, type: 'support.reply', payload: { ticketId: 't-1', subject: 'Kendala Login' } });
    expect(reply.title).toBe('Balasan tiket bantuan');
    expect(reply.body).toContain('Kendala Login');
    expect(reply.actionTab).toBe('bantuan');
    expect(reply.targetId).toBe('t-1');

    const granted = formatNotification({ ...base, type: 'license.granted', payload: { licenseId: 'l-1', maxDevices: 3 } });
    expect(granted.title).toBe('Lisensi aktif diberikan');
    expect(granted.body).toContain('3 perangkat');
    expect(granted.targetId).toBe('l-1');

    const revoked = formatNotification({ ...base, type: 'license.revoked', payload: { licenseId: 'l-1' } });
    expect(revoked.title).toBe('Lisensi dicabut');
    expect(revoked.body.length).toBeGreaterThan(10);

    const status = formatNotification({ ...base, type: 'member.status_changed', payload: { status: 'SUSPENDED', reason: 'Audit' } });
    expect(status.title).toBe('Status akun diperbarui');
    expect(status.body).toContain('SUSPENDED');
    expect(status.body).toContain('Audit');
  });

  it('formats unknown notification types cleanly without empty strings', () => {
    const custom = formatNotification({ ...base, type: 'system.maintenance_notice', payload: { message: 'Update 02:00' } });
    expect(custom.title).toBe('System Maintenance Notice');
    expect(custom.body).toBe('Update 02:00');
  });
});
