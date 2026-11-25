'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Select, Textarea } from '@/components/ui/extra';

interface PlatformSpec {
  code: string;
  name: string;
  maxChars: number;
  videoSupported: boolean;
  videoRequired: boolean;
  authType: 'OAUTH2' | 'APP_PASSWORD' | 'ACCESS_TOKEN';
  scopes: string[];
  credentialHint: string;
  extraFieldLabel?: string;
  extraFieldKey?: 'externalId' | 'instanceUrl' | 'boardId';
  enabled: boolean;
  dailyLimitPerMember: number;
  oauthConfigured: boolean;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string;
  externalId: string | null;
  instanceUrl: string | null;
  boardId: string | null;
  status: string;
  connectedAt: string;
}

interface SocialPost {
  id: string;
  accountId: string | null;
  accountHandle: string | null;
  resultId: string | null;
  platform: string;
  status: 'IDEA' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  title: string | null;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  mediaUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  lastError: string | null;
  createdAt: string;
}

interface VideoResultLite {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

type Tab = 'queue' | 'compose' | 'ideas' | 'accounts';

function SocialPublisherInner() {
  const sp = useSearchParams();
  const initialResultId = sp.get('resultId') ?? '';
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>(initialResultId ? 'compose' : 'queue');
  const [statusFilter, setStatusFilter] = useState('');

  // Compose state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram']);
  const [resultId, setResultId] = useState(initialResultId);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtagsRaw, setHashtagsRaw] = useState('#edukasigigi #dentsweb');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishNow, setPublishNow] = useState(false);

  // Idea state
  const [ideaPlatform, setIdeaPlatform] = useState('instagram');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaCaption, setIdeaCaption] = useState('');

  // Connect modal state
  const [connectSpec, setConnectSpec] = useState<PlatformSpec | null>(null);
  const [connHandle, setConnHandle] = useState('');
  const [connDisplayName, setConnDisplayName] = useState('');
  const [connToken, setConnToken] = useState('');
  const [connExtra, setConnExtra] = useState('');

  const platformsQ = useQuery({
    queryKey: ['social-platforms'],
    queryFn: () => api<{ autoPublishEnabled: boolean; items: PlatformSpec[] }>('/social/platforms'),
  });
  const accountsQ = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api<{ items: SocialAccount[] }>('/social/accounts'),
  });
  const postsQ = useQuery({
    queryKey: ['social-posts', statusFilter],
    queryFn: () => api<{ items: SocialPost[] }>(`/social/posts${statusFilter ? `?status=${statusFilter}` : ''}`),
  });
  const resultsQ = useQuery({
    queryKey: ['social-video-results'],
    queryFn: () => api<{ items: VideoResultLite[] }>('/results?limit=50'),
  });

  // Prefill from ?resultId=
  const prefillQ = useQuery({
    queryKey: ['social-result-prefill', initialResultId],
    enabled: Boolean(initialResultId),
    queryFn: () =>
      api<{ id: string; title: string; social: { caption: string; hashtags: string[]; firstComment: string } | null }>(
        `/results/${initialResultId}`,
      ),
  });

  useEffect(() => {
    if (!prefillQ.data) return;
    setResultId(prefillQ.data.id);
    setTitle(prefillQ.data.title);
    if (prefillQ.data.social?.caption) setCaption(prefillQ.data.social.caption);
    if (prefillQ.data.social?.hashtags?.length) setHashtagsRaw(prefillQ.data.social.hashtags.join(' '));
    if (prefillQ.data.social?.firstComment) setFirstComment(prefillQ.data.social.firstComment);
    setTab('compose');
  }, [prefillQ.data]);

  const platforms = platformsQ.data?.items ?? [];
  const accounts = accountsQ.data?.items ?? [];
  const allPosts = postsQ.data?.items ?? [];
  const queuePosts = allPosts.filter((p) => p.status !== 'IDEA');
  const ideaPosts = allPosts.filter((p) => p.status === 'IDEA');

  const hashtags = useMemo(
    () => hashtagsRaw.split(/\s+/).map((t) => t.trim()).filter(Boolean),
    [hashtagsRaw],
  );
  const fullLength = useMemo(() => {
    const tags = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    return (caption.trim() ? `${caption.trim()}${tags ? `\n\n${tags}` : ''}` : tags).length;
  }, [caption, hashtags]);

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['social-posts'] });
    qc.invalidateQueries({ queryKey: ['social-accounts'] });
  };

  const connectMut = useMutation({
    mutationFn: () => {
      if (!connectSpec) throw new Error('Platform belum dipilih');
      const body: Record<string, unknown> = {
        platform: connectSpec.code,
        handle: connHandle.trim(),
        displayName: connDisplayName.trim() || undefined,
        accessToken: connToken.trim(),
      };
      if (connectSpec.extraFieldKey && connExtra.trim()) {
        body[connectSpec.extraFieldKey] = connExtra.trim();
      }
      return api('/social/accounts/connect', { method: 'POST', json: body });
    },
    onSuccess: () => {
      toast.success(`Akun ${connectSpec?.name} berhasil terhubung`);
      setConnectSpec(null);
      setConnHandle('');
      setConnDisplayName('');
      setConnToken('');
      setConnExtra('');
      inv();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => api(`/social/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => (toast.success('Akun diputus'), inv()),
    onError: (e) => toast.error((e as Error).message),
  });

  const createPostMut = useMutation({
    mutationFn: async () => {
      if (!selectedPlatforms.length) throw new Error('Pilih minimal satu platform tujuan.');
      const created: SocialPost[] = [];
      for (const code of selectedPlatforms) {
        const acc = accounts.find((a) => a.platform === code);
        const status = scheduledAt && !publishNow ? 'SCHEDULED' : 'DRAFT';
        const res = await api<{ post: SocialPost }>('/social/posts', {
          method: 'POST',
          json: {
            platform: code,
            accountId: acc?.id ?? null,
            resultId: resultId || null,
            status,
            title: title.trim() || null,
            caption,
            hashtags,
            firstComment: firstComment.trim() || null,
            scheduledAt: status === 'SCHEDULED' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          },
        });
        created.push(res.post);
        if (publishNow) {
          await api(`/social/posts/${res.post.id}/publish`, { method: 'POST' });
        }
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(
        publishNow
          ? `${created.length} postingan dipublikasikan`
          : scheduledAt
            ? `${created.length} postingan dijadwalkan`
            : `${created.length} draf disimpan`,
      );
      setTitle('');
      setCaption('');
      setFirstComment('');
      setScheduledAt('');
      setPublishNow(false);
      inv();
      setTab('queue');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const createIdeaMut = useMutation({
    mutationFn: () =>
      api('/social/posts', {
        method: 'POST',
        json: {
          platform: ideaPlatform,
          status: 'IDEA',
          title: ideaTitle.trim() || 'Ide konten baru',
          caption: ideaCaption,
          hashtags: [],
        },
      }),
    onSuccess: () => {
      toast.success('Ide disimpan ke Ideas Board');
      setIdeaTitle('');
      setIdeaCaption('');
      inv();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api(`/social/posts/${id}/publish`, { method: 'POST' }),
    onSuccess: () => (toast.success('Postingan berhasil diterbitkan'), inv()),
    onError: (e) => toast.error((e as Error).message),
  });

  const promoteIdeaMut = useMutation({
    mutationFn: (p: SocialPost) => api(`/social/posts/${p.id}`, { method: 'PATCH', json: { status: 'DRAFT' } }),
    onSuccess: (_res, p) => {
      toast.success('Ide dipromosikan ke Draf');
      setSelectedPlatforms([p.platform]);
      setTitle(p.title ?? '');
      setCaption(p.caption);
      inv();
      setTab('compose');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deletePostMut = useMutation({
    mutationFn: (id: string) => api(`/social/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => (toast.success('Postingan dihapus'), inv()),
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePlatform = (code: string) => {
    setSelectedPlatforms((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]));
  };

  if (platformsQ.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (platformsQ.isError) return <ErrorNote error={platformsQ.error} onRetry={() => platformsQ.refetch()} />;

  return (
    <div className="grid gap-6">
      <PageHead
        eyebrow="PRODUKSI · SOCIAL PUBLISHER"
        title="Sosial Media"
        actions={
          <Button onClick={() => setTab('compose')}>+ Buat Post Baru</Button>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {(
          [
            ['queue', `Kalender & Antrean (${queuePosts.length})`],
            ['compose', 'Buat Post'],
            ['ideas', `Ideas Board (${ideaPosts.length})`],
            ['accounts', `Akun Terhubung (${accounts.length}/10)`],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 rounded-[10px] px-4 text-sm font-medium transition ${
              tab === k ? 'bg-accent text-accent-contrast' : 'border border-line bg-surface hover:bg-surface-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {['', 'SCHEDULED', 'DRAFT', 'PUBLISHED', 'FAILED'].map((st) => (
                <button
                  key={st || 'ALL'}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`h-8 rounded-lg px-3 text-xs font-medium ${
                    statusFilter === st ? 'bg-ink text-surface' : 'border border-line bg-surface hover:bg-surface-2'
                  }`}
                >
                  {st || 'Semua Status'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">
              Auto-Publish: {platformsQ.data?.autoPublishEnabled ? 'Aktif' : 'Dinonaktifkan Superadmin'}
            </span>
          </div>

          {queuePosts.length === 0 ? (
            <Empty
              title="Belum ada postingan di antrean"
              body="Buat postingan baru atau kirim langsung dari halaman Hasil video."
              action={<Button onClick={() => setTab('compose')}>Buat Post Pertama</Button>}
            />
          ) : (
            <div className="grid gap-3">
              {queuePosts.map((p) => {
                const spec = platforms.find((pl) => pl.code === p.platform);
                return (
                  <Card key={p.id} className="grid gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                            {spec?.name ?? p.platform}
                          </span>
                          <Status value={p.status} />
                          {p.accountHandle && <span className="text-xs text-muted">@{p.accountHandle}</span>}
                          {p.scheduledAt && <span className="font-mono text-xs text-muted">Jadwal: {fmtDate(p.scheduledAt)}</span>}
                          {p.publishedAt && <span className="font-mono text-xs text-muted">Terbit: {fmtDate(p.publishedAt)}</span>}
                        </div>
                        {p.title && <p className="text-sm font-medium">{p.title}</p>}
                        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted">{p.caption || '(Tanpa caption)'}</p>
                        {p.lastError && <p className="text-xs text-danger">{p.lastError}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.externalUrl && (
                          <a
                            href={p.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs hover:bg-surface-2"
                          >
                            Buka Post
                          </a>
                        )}
                        {p.status !== 'PUBLISHED' && (
                          <Button
                            className="h-8 px-3 text-xs"
                            disabled={publishMut.isPending}
                            onClick={() => publishMut.mutate(p.id)}
                          >
                            Publish Sekarang
                          </Button>
                        )}
                        <Button
                          className="h-8 px-3 text-xs"
                          variant="ghost"
                          onClick={() => confirm('Hapus postingan ini?') && deletePostMut.mutate(p.id)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'compose' && (
        <Card className="grid gap-5 p-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium">1. Pilih Platform Tujuan (Multi-Channel)</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((pl) => {
                const active = selectedPlatforms.includes(pl.code);
                const connected = accounts.some((a) => a.platform === pl.code);
                const over = active && fullLength > pl.maxChars;
                return (
                  <button
                    key={pl.code}
                    type="button"
                    disabled={!pl.enabled}
                    onClick={() => togglePlatform(pl.code)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      !pl.enabled
                        ? 'cursor-not-allowed border-line opacity-40'
                        : active
                          ? over
                            ? 'border-danger bg-danger/10 text-danger'
                            : 'border-accent bg-accent/10 text-accent'
                          : 'border-line bg-surface hover:bg-surface-2'
                    }`}
                  >
                    {pl.name} {connected ? '· Terhubung' : ''} ({pl.maxChars})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="res-pick" className="text-sm font-medium">2. Lampirkan Video dari Hasil (Opsional)</label>
              <Select id="res-pick" value={resultId} onChange={(e) => setResultId(e.target.value)}>
                <option value="">Tanpa lampiran video (teks saja)</option>
                {(resultsQ.data?.items ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.status})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="post-title" className="text-sm font-medium">Judul (YouTube / Pinterest / Catatan)</label>
              <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Cara Menyikat Gigi yang Benar" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="post-caption" className="text-sm font-medium">3. Caption</label>
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                {selectedPlatforms.map((code) => {
                  const pl = platforms.find((x) => x.code === code);
                  if (!pl) return null;
                  const over = fullLength > pl.maxChars;
                  return (
                    <span key={code} className={over ? 'font-semibold text-danger' : 'text-muted'}>
                      {pl.name}: {fullLength}/{pl.maxChars}
                    </span>
                  );
                })}
              </div>
            </div>
            <Textarea id="post-caption" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Tulis caption edukasi Anda..." />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="post-tags" className="text-sm font-medium">Hashtags (pisahkan spasi)</label>
              <Input id="post-tags" value={hashtagsRaw} onChange={(e) => setHashtagsRaw(e.target.value)} placeholder="#edukasigigi #doktergigi" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="post-fc" className="text-sm font-medium">Komentar Pertama (Opsional)</label>
              <Input id="post-fc" value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="Sumber referensi atau CTA..." />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="post-sched" className="text-sm font-medium">Jadwalkan Waktu Publikasi (Opsional)</label>
              <Input
                id="post-sched"
                type="datetime-local"
                value={scheduledAt}
                disabled={publishNow}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishNow}
                  disabled={!platformsQ.data?.autoPublishEnabled}
                  onChange={(e) => setPublishNow(e.target.checked)}
                />
                <span>Langsung Publish Sekarang (Auto-Publish)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTab('queue')}>Batal</Button>
            <Button
              disabled={createPostMut.isPending || selectedPlatforms.length === 0}
              onClick={() => createPostMut.mutate()}
            >
              {createPostMut.isPending
                ? 'Memproses...'
                : publishNow
                  ? `Publish Sekarang (${selectedPlatforms.length})`
                  : scheduledAt
                    ? `Jadwalkan (${selectedPlatforms.length})`
                    : `Simpan Draf (${selectedPlatforms.length})`}
            </Button>
          </div>
        </Card>
      )}

      {tab === 'ideas' && (
        <div className="grid gap-4">
          <Card className="grid gap-3 p-5">
            <h3 className="text-sm font-semibold">Tangkap Ide Konten Cepat</h3>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <Select value={ideaPlatform} onChange={(e) => setIdeaPlatform(e.target.value)}>
                {platforms.map((pl) => (
                  <option key={pl.code} value={pl.code}>{pl.name}</option>
                ))}
              </Select>
              <Input value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} placeholder="Judul ide konten..." />
            </div>
            <Textarea rows={3} value={ideaCaption} onChange={(e) => setIdeaCaption(e.target.value)} placeholder="Catat hook, poin utama, atau referensi..." />
            <div className="flex justify-end">
              <Button disabled={createIdeaMut.isPending || (!ideaTitle.trim() && !ideaCaption.trim())} onClick={() => createIdeaMut.mutate()}>
                Simpan Ide
              </Button>
            </div>
          </Card>

          {ideaPosts.length === 0 ? (
            <Empty title="Ideas Board masih kosong" body="Catat ide konten cepat lalu promosikan ke Draf kapan saja." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {ideaPosts.map((p) => (
                <Card key={p.id} className="grid gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase">{p.platform}</span>
                    <span className="font-mono text-xs text-muted">{fmtDate(p.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold">{p.title || 'Tanpa judul'}</p>
                  <p className="whitespace-pre-wrap text-xs text-muted">{p.caption}</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button className="h-8 px-3 text-xs" variant="ghost" onClick={() => deletePostMut.mutate(p.id)}>Hapus</Button>
                    <Button className="h-8 px-3 text-xs" onClick={() => promoteIdeaMut.mutate(p)}>Promosikan ke Draf</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((pl) => {
            const connected = accounts.filter((a) => a.platform === pl.code);
            return (
              <Card key={pl.code} className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{pl.name}</h3>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{pl.authType}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Maks {pl.maxChars.toLocaleString()} karakter · Limit {pl.dailyLimitPerMember}/hari
                    </p>
                  </div>
                  <Button
                    className="h-8 px-3 text-xs"
                    disabled={!pl.enabled}
                    onClick={() => {
                      setConnectSpec(pl);
                      setConnHandle('');
                      setConnDisplayName('');
                      setConnToken('');
                      setConnExtra('');
                    }}
                  >
                    {pl.enabled ? '+ Hubungkan' : 'Nonaktif'}
                  </Button>
                </div>

                {connected.length > 0 ? (
                  <div className="grid gap-2 border-t border-line pt-2">
                    {connected.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                        <div>
                          <span className="font-medium">{a.displayName || `@${a.handle}`}</span>
                          <span className="ml-2 text-muted">@{a.handle}</span>
                        </div>
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => confirm(`Putuskan akun @${a.handle}?`) && disconnectMut.mutate(a.id)}
                        >
                          Putus
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Belum ada akun terhubung.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(connectSpec)} onClose={() => setConnectSpec(null)} title={`Hubungkan Akun ${connectSpec?.name ?? ''}`}>
        {connectSpec && (
          <div className="grid gap-3">
            <p className="text-xs text-muted">{connectSpec.credentialHint}. Kredensial dienkripsi AES-256-GCM di Secret Vault.</p>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Handle / Username</label>
              <Input value={connHandle} onChange={(e) => setConnHandle(e.target.value)} placeholder="misal: klinikgigi.id" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">Nama Tampilan (Opsional)</label>
              <Input value={connDisplayName} onChange={(e) => setConnDisplayName(e.target.value)} placeholder="Klinik Gigi Sehat" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium">
                {connectSpec.authType === 'APP_PASSWORD' ? 'App Password' : 'Access Token'}
              </label>
              <Input type="password" value={connToken} onChange={(e) => setConnToken(e.target.value)} placeholder="Tempel token / app password..." />
            </div>
            {connectSpec.extraFieldLabel && (
              <div className="grid gap-1">
                <label className="text-xs font-medium">{connectSpec.extraFieldLabel}</label>
                <Input value={connExtra} onChange={(e) => setConnExtra(e.target.value)} placeholder={connectSpec.extraFieldLabel} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConnectSpec(null)}>Batal</Button>
              <Button disabled={connectMut.isPending || !connHandle.trim() || !connToken.trim()} onClick={() => connectMut.mutate()}>
                {connectMut.isPending ? 'Menyimpan...' : 'Simpan & Hubungkan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <SocialPublisherInner />
    </Suspense>
  );
}
