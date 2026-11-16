'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { fmtDate } from '@/lib/api';
import { Button } from '@/components/ui';
import { Textarea } from '@/components/ui/extra';

export interface Ticket {
  id: string;
  subject: string;
  status: string;
  diagnostics: Record<string, unknown> | null;
  messages: { id: string; body: string; createdAt: string; authorName: string; authorRole: string }[];
}

export function Thread({ t, onReply, sending, staffView }: { t: Ticket; onReply: (body: string) => Promise<unknown>; sending: boolean; staffView?: boolean }) {
  const [body, setBody] = useState('');
  return (
    <div className="grid gap-4">
      <ol className="grid gap-3">
        {t.messages.map((m) => {
          const staff = m.authorRole === 'SUPERADMIN';
          return (
            <li key={m.id} className={clsx('max-w-[85%] rounded-2xl border px-4 py-3', staff === !!staffView ? 'ml-auto border-accent/40 bg-accent/5' : 'border-line bg-surface')}>
              <p className="text-xs text-muted">{staff ? `${m.authorName} · Tim DENTSWEB` : m.authorName} · {fmtDate(m.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
            </li>
          );
        })}
      </ol>
      {t.status === 'CLOSED' ? (
        <p className="text-sm text-muted">Tiket ditutup.</p>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            await onReply(body.trim()).then(() => setBody('')).catch(() => undefined);
          }}
        >
          <Textarea aria-label="Balasan" rows={3} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tulis balasan…" />
          <Button type="submit" loading={sending} disabled={!body.trim()} className="justify-self-end">Kirim</Button>
        </form>
      )}
    </div>
  );
}
