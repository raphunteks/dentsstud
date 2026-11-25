import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, mutate } from '../bridge';
import { Button, Card, Input, Modal, Pill, Textarea, errMsg } from '../components/UI';

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  bodyMd: string;
  updatedAt?: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages?: { id: string; senderRole?: string; body: string; createdAt: string }[];
}

export function BantuanView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [reading, setReading] = useState<HelpArticle | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const articlesQ = useQuery({
    queryKey: ['help-articles'],
    queryFn: () => get<HelpArticle[]>('/help/articles').catch(() => []),
  });

  const ticketsQ = useQuery({
    queryKey: ['member-tickets'],
    queryFn: () => get<Ticket[]>('/support/tickets').catch(() => []),
  });

  const ticketDetailQ = useQuery({
    queryKey: ['member-ticket-detail', activeTicketId],
    queryFn: () => get<Ticket>(`/support/tickets/${activeTicketId}`),
    enabled: !!activeTicketId,
  });

  const createTicket = useMutation({
    mutationFn: () => mutate('POST', '/support/tickets', { subject: subject.trim(), body: body.trim() }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['member-tickets'] });
    },
  });

  const sendReply = useMutation({
    mutationFn: () => mutate('POST', `/support/tickets/${activeTicketId}/messages`, { body: replyText.trim() }),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['member-ticket-detail', activeTicketId] });
      qc.invalidateQueries({ queryKey: ['member-tickets'] });
    },
  });

  const articles = (articlesQ.data ?? []).filter(
    (a) =>
      !search.trim() ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase())
  );

  const tickets = ticketsQ.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">PANDUAN & BANTUAN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Pusat Bantuan & Tiket Support
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cari panduan operasional studio atau kirim tiket langsung ke tim administrator.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Cari artikel panduan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
      </div>

      {/* Live Help Articles */}
      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-text">
          Artikel Panduan ({articles.length})
        </h2>
        {articlesQ.isLoading && <Card className="p-6 text-center text-xs text-muted">Memuat artikel…</Card>}
        {!articlesQ.isLoading && articles.length === 0 && (
          <Card className="p-6 text-center text-xs text-muted">Tidak ada artikel yang cocok dengan pencarian.</Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {articles.map((art) => (
            <Card
              key={art.id}
              onClick={() => setReading(art)}
              className="p-5 space-y-2 cursor-pointer hover:border-accent transition"
            >
              <div className="flex items-center justify-between gap-2">
                <Pill>{art.category || 'Panduan'}</Pill>
                <span className="text-[11px] text-accent">Baca →</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-text">{art.title}</h3>
              <p className="text-xs text-muted line-clamp-2">{art.bodyMd}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Member Support Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-text">Buat Tiket Bantuan Baru</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (subject.trim().length < 3 || body.trim().length < 5) return;
              createTicket.mutate();
            }}
            className="space-y-3"
          >
            <Input
              placeholder="Subjek kendala (min. 3 karakter)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-xs"
            />
            <Textarea
              rows={4}
              placeholder="Jelaskan kendala atau pertanyaan Anda secara detail..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-xs"
            />
            {createTicket.isError && <p className="text-xs text-bad">{errMsg(createTicket.error)}</p>}
            {createTicket.isSuccess && <p className="text-xs text-ok">✓ Tiket berhasil dikirim!</p>}
            <Button type="submit" size="sm" disabled={createTicket.isPending || subject.trim().length < 3 || body.trim().length < 5}>
              {createTicket.isPending ? 'Mengirim…' : 'Kirim Tiket'}
            </Button>
          </form>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-text">Tiket Saya ({tickets.length})</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">Belum ada tiket bantuan yang Anda buat.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setActiveTicketId(t.id)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 p-3 hover:border-accent cursor-pointer transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text truncate">{t.subject}</p>
                    <p className="text-[10px] font-mono text-muted">
                      {new Date(t.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <Pill ok={t.status === 'RESOLVED' || t.status === 'CLOSED' ? true : null}>{t.status}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Article Reader Modal */}
      <Modal open={!!reading} onClose={() => setReading(null)} title={reading?.title ?? ''}>
        {reading && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <Pill>{reading.category || 'Panduan'}</Pill>
            <div className="whitespace-pre-wrap text-xs text-text leading-relaxed">{reading.bodyMd}</div>
          </div>
        )}
      </Modal>

      {/* Ticket Thread Modal */}
      <Modal
        open={!!activeTicketId}
        onClose={() => setActiveTicketId(null)}
        title={ticketDetailQ.data?.subject ?? 'Detail Tiket'}
      >
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {(ticketDetailQ.data?.messages ?? []).map((m) => (
              <div key={m.id} className="rounded-xl border border-line bg-surface-2/50 p-3 text-xs space-y-1">
                <div className="flex justify-between text-[10px] text-muted font-mono">
                  <span>{m.senderRole === 'SUPERADMIN' ? 'Admin' : 'Anda'}</span>
                  <span>{new Date(m.createdAt).toLocaleString('id-ID')}</span>
                </div>
                <p className="text-text whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!replyText.trim()) return;
              sendReply.mutate();
            }}
            className="flex gap-2 pt-2 border-t border-line"
          >
            <Input
              placeholder="Tulis balasan..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1 h-9 text-xs"
            />
            <Button type="submit" size="sm" disabled={sendReply.isPending || !replyText.trim()}>
              Kirim
            </Button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
