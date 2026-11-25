import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mutate } from '../bridge';
import { Button, Card, Input, Modal, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';

export type SocialPlatformCode =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'threads'
  | 'pinterest'
  | 'bluesky'
  | 'mastodon';

interface PlatformMeta {
  code: SocialPlatformCode;
  name: string;
  charLimit: number;
  authType?: string;
  supportsVideo?: boolean;
  enabled?: boolean;
  configured?: boolean;
  dailyLimitPerMember?: number;
}

interface SocialAccount {
  id: string;
  platform: SocialPlatformCode;
  handle: string;
  displayName?: string;
  status: string;
  instanceUrl?: string | null;
  createdAt?: string;
}

interface SocialPost {
  id: string;
  title?: string;
  caption: string;
  hashtags?: string[];
  firstComment?: string | null;
  resultId?: string | null;
  accountId?: string | null;
  accountHandle?: string | null;
  platform?: string;
  targetAccountIds?: string[];
  platforms?: string[];
  status: 'IDEA' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  scheduledAt?: string | null;
  publishedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
}

const FALLBACK_PLATFORMS: PlatformMeta[] = [
  { code: 'tiktok', name: 'TikTok', charLimit: 2200, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'instagram', name: 'Instagram', charLimit: 2200, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'youtube', name: 'YouTube Shorts', charLimit: 5000, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'facebook', name: 'Facebook Reels', charLimit: 63206, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'x', name: 'X (Twitter)', charLimit: 280, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'linkedin', name: 'LinkedIn', charLimit: 3000, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'threads', name: 'Threads', charLimit: 500, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'pinterest', name: 'Pinterest', charLimit: 500, authType: 'OAUTH', supportsVideo: true, enabled: true },
  { code: 'bluesky', name: 'Bluesky', charLimit: 300, authType: 'APP_PASSWORD', supportsVideo: true, enabled: true },
  { code: 'mastodon', name: 'Mastodon', charLimit: 500, authType: 'ACCESS_TOKEN', supportsVideo: true, enabled: true },
];

function toArr<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.platforms)) return o.platforms as T[];
    if (Array.isArray(o.posts)) return o.posts as T[];
    if (Array.isArray(o.accounts)) return o.accounts as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

function normalizePlatform(raw: Record<string, unknown>): PlatformMeta {
  const code = String(raw.code ?? raw.id ?? raw.platform ?? 'tiktok') as SocialPlatformCode;
  const fb = FALLBACK_PLATFORMS.find((p) => p.code === code);
  return {
    code,
    name: String(raw.name ?? fb?.name ?? code),
    charLimit: Number(raw.charLimit ?? raw.maxChars ?? fb?.charLimit ?? 2200),
    authType: typeof raw.authType === 'string' ? raw.authType : fb?.authType,
    supportsVideo: raw.supportsVideo !== false,
    enabled: raw.enabled !== false,
    configured: Boolean(raw.configured),
    dailyLimitPerMember: typeof raw.dailyLimitPerMember === 'number' ? raw.dailyLimitPerMember : undefined,
  };
}

/** Member: Sosial Media (TryPost-class Native Social Publisher — 4 Sub-tabs) */
export function SocialView({ initialResultId }: { initialResultId?: string | null }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'queue' | 'compose' | 'ideas' | 'accounts'>(initialResultId ? 'compose' : 'queue');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Compose state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string>(initialResultId ?? '');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // Idea state
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaBody, setIdeaBody] = useState('');

  // Connect Account Modal state
  const [connectPlat, setConnectPlat] = useState<PlatformMeta | null>(null);
  const [connHandle, setConnHandle] = useState('');
  const [connToken, setConnToken] = useState('');
  const [connInstance, setConnInstance] = useState('');

  useEffect(() => {
    if (initialResultId) {
      setSelectedResultId(initialResultId);
      setSubTab('compose');
    }
  }, [initialResultId]);

  const platformsQ = useQuery({
    queryKey: ['social-platforms'],
    queryFn: () =>
      get<unknown>('/social/platforms')
        .then((r) => {
          const list = toArr<Record<string, unknown>>(r).map(normalizePlatform);
          return list.length >= 10 ? list : FALLBACK_PLATFORMS;
        })
        .catch(() => FALLBACK_PLATFORMS),
  });

  const accountsQ = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => get<unknown>('/social/accounts').then((r) => toArr<SocialAccount>(r)).catch(() => []),
  });

  const postsQ = useQuery({
    queryKey: ['social-posts'],
    queryFn: () => get<unknown>('/social/posts').then((r) => toArr<SocialPost>(r)).catch(() => []),
    refetchInterval: 15_000,
  });

  const resultsQ = useQuery({
    queryKey: ['results-for-social'],
    queryFn: () => get<unknown>('/results?limit=50').then((r) => toArr<any>(r)).catch(() => []),
    enabled: subTab === 'compose',
  });

  const platforms = platformsQ.data ?? FALLBACK_PLATFORMS;
  const accounts = accountsQ.data ?? [];
  const posts = postsQ.data ?? [];
  const queuePosts = posts.filter((p) => p.status !== 'IDEA');
  const ideaPosts = posts.filter((p) => p.status === 'IDEA');

  const invalidateSocial = () => {
    qc.invalidateQueries({ queryKey: ['social-posts'] });
    qc.invalidateQueries({ queryKey: ['social-accounts'] });
  };

  // Compute tightest char limit across selected target accounts
  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const tightestLimit = selectedAccounts.reduce((min, a) => {
    const meta = platforms.find((p) => p.code === a.platform);
    return Math.min(min, meta?.charLimit ?? 2200);
  }, 2200);
  const fullCaptionLen = caption.length + (hashtags.trim() ? hashtags.trim().length + 2 : 0);
  const overLimit = selectedAccounts.length > 0 && fullCaptionLen > tightestLimit;

  const savePostMut = useMutation({
    mutationFn: async (mode: 'DRAFT' | 'SCHEDULED' | 'PUBLISH_NOW') => {
      const tagsArr = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const targets =
        selectedAccounts.length > 0
          ? selectedAccounts.map((a) => ({ platform: a.platform, accountId: a.id }))
          : [{ platform: 'tiktok' as SocialPlatformCode, accountId: undefined }];

      if (editingPostId) {
        const t = targets[0]!;
        const res = await mutate<{ post?: SocialPost }>('PATCH', `/social/posts/${editingPostId}`, {
          platform: t.platform,
          accountId: t.accountId,
          caption: caption.trim(),
          hashtags: tagsArr,
          firstComment: firstComment.trim() || undefined,
          status: mode === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: mode === 'SCHEDULED' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        });
        const pid = res?.post?.id ?? editingPostId;
        if (mode === 'PUBLISH_NOW' && pid) {
          await mutate('POST', `/social/posts/${pid}/publish`, {});
        }
        return { mode, count: 1 };
      }

      for (const t of targets) {
        const res = await mutate<{ post?: SocialPost }>('POST', '/social/posts', {
          platform: t.platform,
          accountId: t.accountId,
          resultId: selectedResultId || undefined,
          caption: caption.trim(),
          hashtags: tagsArr,
          firstComment: firstComment.trim() || undefined,
          status: mode === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: mode === 'SCHEDULED' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        });
        const pid = res?.post?.id;
        if (mode === 'PUBLISH_NOW' && pid) {
          await mutate('POST', `/social/posts/${pid}/publish`, {});
        }
      }
      return { mode, count: targets.length };
    },
    onSuccess: ({ mode }) => {
      setEditingPostId(null);
      setCaption('');
      setHashtags('');
      setFirstComment('');
      setScheduledAt('');
      setSelectedAccountIds([]);
      invalidateSocial();
      setSubTab('queue');
      setFeedback({
        ok: true,
        text:
          mode === 'PUBLISH_NOW'
            ? 'Post dikirim untuk Auto-Publish sekarang.'
            : mode === 'SCHEDULED'
              ? 'Post berhasil dijadwalkan.'
              : 'Draft post berhasil disimpan.',
      });
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const publishNowMut = useMutation({
    mutationFn: (id: string) => mutate('POST', `/social/posts/${id}/publish`, {}),
    onSuccess: () => {
      invalidateSocial();
      setFeedback({ ok: true, text: 'Publikasi dijalankan.' });
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const deletePostMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/social/posts/${id}`),
    onSuccess: () => invalidateSocial(),
  });

  const createIdeaMut = useMutation({
    mutationFn: () =>
      mutate('POST', '/social/posts', {
        platform: 'tiktok',
        title: ideaTitle.trim() || undefined,
        caption: ideaBody.trim(),
        status: 'IDEA',
      }),
    onSuccess: () => {
      setIdeaTitle('');
      setIdeaBody('');
      invalidateSocial();
      setFeedback({ ok: true, text: 'Ide konten ditambahkan ke Ideas Board.' });
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const connectAccountMut = useMutation({
    mutationFn: () =>
      mutate('POST', '/social/accounts/connect', {
        platform: connectPlat!.code,
        handle: connHandle.trim(),
        accessToken: connToken.trim(),
        ...(connInstance.trim() ? { instanceUrl: connInstance.trim() } : {}),
      }),
    onSuccess: () => {
      setConnectPlat(null);
      setConnHandle('');
      setConnToken('');
      setConnInstance('');
      invalidateSocial();
      setFeedback({ ok: true, text: 'Akun sosial media berhasil terhubung.' });
    },
    onError: (e) => setFeedback({ ok: false, text: errMsg(e) }),
  });

  const disconnectAccountMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/social/accounts/${id}`),
    onSuccess: () => invalidateSocial(),
  });

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function loadPostToComposer(p: SocialPost) {
    setEditingPostId(p.id);
    setCaption(p.caption ?? '');
    setHashtags((p.hashtags ?? []).join(' '));
    setFirstComment(p.firstComment ?? '');
    setSelectedResultId(p.resultId ?? '');
    setSelectedAccountIds(p.accountId ? [p.accountId] : p.targetAccountIds ?? []);
    setScheduledAt(p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 16) : '');
    setSubTab('compose');
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">PUBLISHER · 10 PLATFORM</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Sosial Media Publisher</h1>
          <p className="mt-1 text-sm text-muted">Jadwalkan atau auto-publish video hasil produksi ke 10 platform sosial media sekaligus.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={subTab === 'queue' ? 'primary' : 'ghost'} onClick={() => setSubTab('queue')}>
            Kalender &amp; Antrean ({queuePosts.length})
          </Button>
          <Button size="sm" variant={subTab === 'compose' ? 'primary' : 'ghost'} onClick={() => setSubTab('compose')}>
            <Icon name="plus" className="w-3.5 h-3.5 mr-1 inline" />
            Buat Post
          </Button>
          <Button size="sm" variant={subTab === 'ideas' ? 'primary' : 'ghost'} onClick={() => setSubTab('ideas')}>
            Ideas Board ({ideaPosts.length})
          </Button>
          <Button size="sm" variant={subTab === 'accounts' ? 'primary' : 'ghost'} onClick={() => setSubTab('accounts')}>
            Akun Terhubung ({accounts.length}/10)
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between gap-3 ${
            feedback.ok ? 'border-accent/40 bg-accent/10 text-text' : 'border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Sub-tab 1: Kalender & Antrean */}
      {subTab === 'queue' && (
        <div className="space-y-3">
          {queuePosts.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-muted">Belum ada post di antrean atau kalender publikasi.</p>
              <Button size="sm" onClick={() => setSubTab('compose')}>
                <Icon name="plus" className="w-3.5 h-3.5 mr-1 inline" />
                Buat Post Pertama
              </Button>
            </Card>
          ) : (
            queuePosts.map((p) => (
              <Card key={p.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill ok={p.status === 'PUBLISHED' ? true : p.status === 'FAILED' ? false : null}>{p.status}</Pill>
                    {(p.platform ? [p.platform] : p.platforms ?? []).map((pl) => (
                      <span key={pl} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted">
                        {pl}
                      </span>
                    ))}
                    {p.accountHandle && (
                      <span className="text-[11px] font-mono text-muted">@{p.accountHandle}</span>
                    )}
                    {p.scheduledAt && (
                      <span className="text-[11px] font-mono text-muted">
                        Jadwal: {new Date(p.scheduledAt).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text whitespace-pre-wrap line-clamp-3">{p.caption}</p>
                  {p.lastError && <p className="text-[11px] text-bad">{p.lastError}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {(p.status === 'DRAFT' || p.status === 'SCHEDULED' || p.status === 'FAILED') && (
                    <Button size="sm" disabled={publishNowMut.isPending} onClick={() => publishNowMut.mutate(p.id)}>
                      Publish Sekarang
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => loadPostToComposer(p)}>Edit</Button>
                  <Button size="sm" variant="danger" disabled={deletePostMut.isPending} onClick={() => deletePostMut.mutate(p.id)}>Hapus</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Sub-tab 2: Buat Post */}
      {subTab === 'compose' && (
        <Card className="p-5 space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-text">
              {editingPostId ? 'Edit Post Sosial Media' : 'Buat Post Multi-Platform'}
            </h2>
            {editingPostId && (
              <Button size="sm" variant="ghost" onClick={() => setEditingPostId(null)}>Reset Editor</Button>
            )}
          </div>

          <label className="grid gap-1 text-xs text-muted">
            Pilih Video Hasil Produksi (opsional)
            <Select value={selectedResultId} onChange={(e) => setSelectedResultId(e.target.value)} className="h-9 text-xs">
              <option value="">-- Tanpa video / teks saja --</option>
              {(resultsQ.data ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.status})
                </option>
              ))}
            </Select>
          </label>

          <div className="space-y-1.5">
            <p className="text-xs text-muted">Target Akun ({selectedAccountIds.length} dipilih)</p>
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-3 text-xs text-muted flex items-center justify-between">
                <span>Belum ada akun sosial media terhubung.</span>
                <Button size="sm" variant="outline" onClick={() => setSubTab('accounts')}>Hubungkan Akun</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const active = selectedAccountIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                        active ? 'border-accent bg-accent/15 text-text' : 'border-line bg-surface-2/40 text-muted hover:text-text'
                      }`}
                    >
                      <span className="font-mono uppercase mr-1.5">{a.platform}</span>
                      @{a.handle}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Caption</span>
              <span className={`font-mono ${overLimit ? 'text-bad font-bold' : 'text-muted'}`}>
                {fullCaptionLen} / {tightestLimit} karakter
              </span>
            </div>
            <Textarea
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tulis caption menarik untuk audiens Anda..."
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs text-muted">
              Hashtags (pisahkan spasi/koma)
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#edukasigigi #dentsweb" className="h-9 text-xs font-mono" />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Jadwal Publikasi (opsional)
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9 text-xs font-mono" />
            </label>
          </div>

          <label className="grid gap-1 text-xs text-muted">
            First Comment (opsional)
            <Input value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="Komentar pertama otomatis / CTA..." className="h-9 text-xs" />
          </label>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
            <Button size="sm" variant="outline" disabled={!caption.trim() || savePostMut.isPending} onClick={() => savePostMut.mutate('DRAFT')}>
              Simpan Draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!caption.trim() || !scheduledAt || overLimit || savePostMut.isPending}
              onClick={() => savePostMut.mutate('SCHEDULED')}
            >
              Jadwalkan Post
            </Button>
            <Button
              size="sm"
              disabled={!caption.trim() || overLimit || savePostMut.isPending}
              onClick={() => savePostMut.mutate('PUBLISH_NOW')}
            >
              <Icon name="upload" className="w-3.5 h-3.5 mr-1.5 inline" />
              Auto-Publish Sekarang
            </Button>
          </div>
        </Card>
      )}

      {/* Sub-tab 3: Ideas Board */}
      {subTab === 'ideas' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3 max-w-2xl">
            <h2 className="font-display text-sm font-semibold text-text">Catat Ide Konten Baru</h2>
            <Input value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} placeholder="Judul ide singkat" className="h-9 text-xs" />
            <Textarea rows={3} value={ideaBody} onChange={(e) => setIdeaBody(e.target.value)} placeholder="Hook, poin utama, atau draf caption ide..." className="text-xs" />
            <div>
              <Button size="sm" disabled={!ideaBody.trim() || createIdeaMut.isPending} onClick={() => createIdeaMut.mutate()}>
                + Simpan ke Ideas Board
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ideaPosts.map((idea) => (
              <Card key={idea.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-text truncate">{idea.title || 'Ide Konten'}</p>
                  <Pill variant="accent">IDEA</Pill>
                </div>
                <p className="text-xs text-muted whitespace-pre-wrap line-clamp-4">{idea.caption}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => loadPostToComposer(idea)}>
                    Promosikan ke Draft / Jadwal
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deletePostMut.mutate(idea.id)}>Hapus</Button>
                </div>
              </Card>
            ))}
            {ideaPosts.length === 0 && (
              <Card className="p-6 text-center text-xs text-muted md:col-span-2">Belum ada ide tersimpan.</Card>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 4: Akun Terhubung (10 Platform) */}
      {subTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {platforms.map((plat) => {
            const linked = accounts.filter((a) => a.platform === plat.code);
            return (
              <Card key={plat.code} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold text-text">{plat.name}</p>
                    <p className="text-[11px] font-mono text-muted">
                      Maks {plat.charLimit.toLocaleString('id-ID')} karakter · {plat.authType || 'OAUTH'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={plat.enabled === false} onClick={() => setConnectPlat(plat)}>
                    + Hubungkan
                  </Button>
                </div>
                {linked.length > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-line/60">
                    {linked.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Pill ok={a.status === 'CONNECTED'}>{a.status}</Pill>
                          <span className="font-mono text-text truncate">@{a.handle}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => disconnectAccountMut.mutate(a.id)}>Putuskan</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">Belum terhubung</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Connect Account Modal */}
      <Modal open={!!connectPlat} onClose={() => setConnectPlat(null)} title={`Hubungkan ${connectPlat?.name ?? ''}`}>
        {connectPlat && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              connectAccountMut.mutate();
            }}
            className="space-y-3 text-xs"
          >
            <p className="text-muted">
              Masukkan handle &amp; kredensial {connectPlat.authType === 'APP_PASSWORD' ? 'App Password' : 'Access Token / OAuth Token'} (dienkripsi AES-256-GCM di server).
            </p>
            <Input required placeholder="Handle / Username (tanpa @)" value={connHandle} onChange={(e) => setConnHandle(e.target.value)} className="h-9 text-xs" />
            {connectPlat.code === 'mastodon' && (
              <Input required placeholder="Instance URL (mis. https://mastodon.social)" value={connInstance} onChange={(e) => setConnInstance(e.target.value)} className="h-9 text-xs font-mono" />
            )}
            <Input required type="password" placeholder="Access Token / App Password" value={connToken} onChange={(e) => setConnToken(e.target.value)} className="h-9 text-xs font-mono" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setConnectPlat(null)}>Batal</Button>
              <Button type="submit" size="sm" disabled={!connHandle.trim() || !connToken.trim() || connectAccountMut.isPending}>
                {connectAccountMut.isPending ? 'Menghubungkan…' : 'Simpan & Hubungkan'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** 16. Superadmin Social Publisher Control Center */
export function AdminSocialView() {
  const qc = useQueryClient();
  const [editingPlat, setEditingPlat] = useState<PlatformMeta | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [feedback, setFeedback] = useState<string | null>(null);

  const configQ = useQuery({
    queryKey: ['admin-social-config'],
    queryFn: () => get<Record<string, any>>('/admin/social/config').catch(() => null),
  });

  const overviewQ = useQuery({
    queryKey: ['admin-social-overview'],
    queryFn: () => get<Record<string, any>>('/admin/social/overview').catch(() => null),
    refetchInterval: 15_000,
  });

  const patchConfigMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => mutate('PATCH', '/admin/social/config', body),
    onSuccess: () => {
      setEditingPlat(null);
      setClientSecret('');
      qc.invalidateQueries({ queryKey: ['admin-social-config'] });
      qc.invalidateQueries({ queryKey: ['social-platforms'] });
      setFeedback('Konfigurasi Social Publisher diperbarui.');
    },
    onError: (e) => setFeedback(`Gagal: ${errMsg(e)}`),
  });

  const cfg = configQ.data ?? {};
  const autoPublishEnabled = cfg.autoPublishEnabled !== false;
  const platConfigs: Record<string, any> = cfg.platforms ?? {};
  const ov = overviewQ.data ?? {};
  const stats = ov.stats ?? ov.summary ?? {};
  const globalQueue = toArr<SocialPost>(ov.queue ?? ov.recentPosts ?? ov.posts);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">16 · SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">Social Publisher Control Center</h1>
          <p className="mt-1 text-sm text-muted">Kelola izin auto-publish member, kredensial OAuth 10 platform, kuota harian, dan pantau antrean publikasi global.</p>
        </div>
        <Button
          size="sm"
          variant={autoPublishEnabled ? 'primary' : 'outline'}
          disabled={patchConfigMut.isPending}
          onClick={() => patchConfigMut.mutate({ autoPublishEnabled: !autoPublishEnabled })}
        >
          Member Auto-Publish Langsung: {autoPublishEnabled ? 'ON' : 'OFF'}
        </Button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-text flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-muted cursor-pointer">Tutup</button>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-mono uppercase text-muted">Akun Terhubung</p>
          <p className="num text-2xl font-semibold text-text mt-0.5">{stats.connectedAccounts ?? stats.accounts ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-mono uppercase text-muted">Terjadwal</p>
          <p className="num text-2xl font-semibold text-accent mt-0.5">{stats.scheduled ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-mono uppercase text-muted">Terbit</p>
          <p className="num text-2xl font-semibold text-ok mt-0.5">{stats.published ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-mono uppercase text-muted">Gagal</p>
          <p className="num text-2xl font-semibold text-bad mt-0.5">{stats.failed ?? 0}</p>
        </Card>
      </div>

      {/* 10-Platform Config Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="font-display text-sm font-semibold text-text">Konfigurasi 10 Platform Sosial Media</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-2.5">Platform</th>
                <th className="px-4 py-2.5">Batas Karakter</th>
                <th className="px-4 py-2.5">Kuota / Hari</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {FALLBACK_PLATFORMS.map((p) => {
                const pc = platConfigs[p.code] ?? {};
                const enabled = pc.enabled !== false;
                return (
                  <tr key={p.code} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2.5 font-medium text-text">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{p.charLimit.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{pc.dailyLimitPerMember ?? 20} post</td>
                    <td className="px-4 py-2.5">
                      <Pill ok={enabled}>{enabled ? 'Aktif' : 'Nonaktif'}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={patchConfigMut.isPending}
                        onClick={() => patchConfigMut.mutate({ platforms: { [p.code]: { enabled: !enabled } } })}
                      >
                        {enabled ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingPlat(p);
                          setClientId(pc.clientId ?? '');
                          setClientSecret('');
                          setRedirectUri(pc.redirectUri ?? '');
                          setDailyLimit(Number(pc.dailyLimitPerMember ?? 20));
                        }}
                      >
                        OAuth &amp; Limit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Global Queue Monitor */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text">Antrean Publikasi Global ({globalQueue.length})</h2>
          <Button size="sm" variant="ghost" onClick={() => void overviewQ.refetch()}>Segarkan</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-mono uppercase border-b border-line">
              <tr>
                <th className="px-4 py-2.5">Caption</th>
                <th className="px-4 py-2.5">Platform</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Jadwal / Terbit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {globalQueue.map((q) => (
                <tr key={q.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-2.5 text-text max-w-md truncate">{q.caption}</td>
                  <td className="px-4 py-2.5 font-mono text-muted">{q.platform || (q.platforms ?? []).join(', ') || '-'}</td>
                  <td className="px-4 py-2.5">
                    <Pill ok={q.status === 'PUBLISHED' ? true : q.status === 'FAILED' ? false : null}>{q.status}</Pill>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted">
                    {q.publishedAt
                      ? new Date(q.publishedAt).toLocaleString('id-ID')
                      : q.scheduledAt
                        ? new Date(q.scheduledAt).toLocaleString('id-ID')
                        : '-'}
                  </td>
                </tr>
              ))}
              {globalQueue.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">Belum ada antrean publikasi global.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Platform OAuth & Limit Modal */}
      <Modal open={!!editingPlat} onClose={() => setEditingPlat(null)} title={`Konfigurasi ${editingPlat?.name ?? ''}`}>
        {editingPlat && (
          <div className="space-y-3 text-xs">
            <Input placeholder="OAuth Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-9 text-xs font-mono" />
            <Input type="password" placeholder="OAuth Client Secret (kosongkan jika tetap)" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="h-9 text-xs font-mono" />
            <Input placeholder="Redirect URI (opsional)" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} className="h-9 text-xs font-mono" />
            <label className="grid gap-1 text-muted">
              Kuota Harian per Member
              <Input type="number" min={1} max={500} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="h-9 text-xs font-mono" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingPlat(null)}>Batal</Button>
              <Button
                size="sm"
                disabled={patchConfigMut.isPending}
                onClick={() =>
                  patchConfigMut.mutate({
                    platforms: {
                      [editingPlat.code]: {
                        ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
                        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
                        ...(redirectUri.trim() ? { redirectUri: redirectUri.trim() } : {}),
                        dailyLimitPerMember: dailyLimit,
                      },
                    },
                  })
                }
              >
                Simpan Konfigurasi
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
