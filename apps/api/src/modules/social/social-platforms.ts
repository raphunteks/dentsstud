export const SOCIAL_PLATFORM_CODES = [
  'tiktok',
  'instagram',
  'youtube',
  'facebook',
  'x',
  'linkedin',
  'threads',
  'pinterest',
  'bluesky',
  'mastodon',
] as const;

export type SocialPlatformCode = (typeof SOCIAL_PLATFORM_CODES)[number];
export type SocialAuthType = 'OAUTH2' | 'APP_PASSWORD' | 'ACCESS_TOKEN';

export interface SocialPlatformSpec {
  code: SocialPlatformCode;
  name: string;
  maxChars: number;
  videoSupported: boolean;
  videoRequired: boolean;
  authType: SocialAuthType;
  oauthAuthorizeUrl: string | null;
  oauthTokenUrl: string | null;
  scopes: string[];
  credentialHint: string;
  extraFieldLabel?: string;
  extraFieldKey?: 'externalId' | 'instanceUrl' | 'boardId';
}

export const SOCIAL_PLATFORMS: Record<SocialPlatformCode, SocialPlatformSpec> = {
  tiktok: {
    code: 'tiktok',
    name: 'TikTok',
    maxChars: 2200,
    videoSupported: true,
    videoRequired: true,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    oauthTokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    credentialHint: 'Access Token TikTok Content Posting API (OAuth2)',
  },
  instagram: {
    code: 'instagram',
    name: 'Instagram',
    maxChars: 2200,
    videoSupported: true,
    videoRequired: true,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    oauthTokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    credentialHint: 'Meta Graph Access Token + IG Business User ID',
    extraFieldLabel: 'Instagram Business User ID',
    extraFieldKey: 'externalId',
  },
  youtube: {
    code: 'youtube',
    name: 'YouTube',
    maxChars: 5000,
    videoSupported: true,
    videoRequired: true,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    oauthTokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    credentialHint: 'Google OAuth2 Access Token (scope youtube.upload)',
  },
  facebook: {
    code: 'facebook',
    name: 'Facebook',
    maxChars: 63206,
    videoSupported: true,
    videoRequired: false,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    oauthTokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement'],
    credentialHint: 'Meta Page Access Token + Facebook Page ID',
    extraFieldLabel: 'Facebook Page ID',
    extraFieldKey: 'externalId',
  },
  x: {
    code: 'x',
    name: 'X (Twitter)',
    maxChars: 280,
    videoSupported: true,
    videoRequired: false,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    oauthTokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    credentialHint: 'X OAuth 2.0 User Access Token (tweet.write)',
  },
  linkedin: {
    code: 'linkedin',
    name: 'LinkedIn',
    maxChars: 3000,
    videoSupported: true,
    videoRequired: false,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    oauthTokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
    credentialHint: 'LinkedIn OAuth2 Access Token + Member/Org URN ID',
    extraFieldLabel: 'LinkedIn Author URN (urn:li:person:...)',
    extraFieldKey: 'externalId',
  },
  threads: {
    code: 'threads',
    name: 'Threads',
    maxChars: 500,
    videoSupported: true,
    videoRequired: false,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://threads.net/oauth/authorize',
    oauthTokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
    credentialHint: 'Threads Graph Access Token + Threads User ID',
    extraFieldLabel: 'Threads User ID',
    extraFieldKey: 'externalId',
  },
  pinterest: {
    code: 'pinterest',
    name: 'Pinterest',
    maxChars: 500,
    videoSupported: true,
    videoRequired: false,
    authType: 'OAUTH2',
    oauthAuthorizeUrl: 'https://www.pinterest.com/oauth/',
    oauthTokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['boards:read', 'pins:read', 'pins:write'],
    credentialHint: 'Pinterest API v5 Access Token + Target Board ID',
    extraFieldLabel: 'Pinterest Board ID',
    extraFieldKey: 'boardId',
  },
  bluesky: {
    code: 'bluesky',
    name: 'Bluesky',
    maxChars: 300,
    videoSupported: true,
    videoRequired: false,
    authType: 'APP_PASSWORD',
    oauthAuthorizeUrl: null,
    oauthTokenUrl: 'https://bsky.social/xrpc/com.atproto.server.createSession',
    scopes: ['com.atproto.repo.createRecord'],
    credentialHint: 'Handle Bluesky (contoh: nama.bsky.social) + App Password',
  },
  mastodon: {
    code: 'mastodon',
    name: 'Mastodon',
    maxChars: 500,
    videoSupported: true,
    videoRequired: false,
    authType: 'ACCESS_TOKEN',
    oauthAuthorizeUrl: null,
    oauthTokenUrl: null,
    scopes: ['write:statuses', 'write:media'],
    credentialHint: 'Access Token Mastodon + URL Instance (contoh: https://mastodon.social)',
    extraFieldLabel: 'Mastodon Instance URL',
    extraFieldKey: 'instanceUrl',
  },
};

export function getPlatformSpec(code: string): SocialPlatformSpec | null {
  return (SOCIAL_PLATFORMS as Record<string, SocialPlatformSpec>)[code] ?? null;
}

export function composeCaption(caption: string, hashtags: string[]): string {
  const cleanTags = hashtags
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith('#') ? h : `#${h.replace(/\s+/g, '')}`));
  const base = caption.trim();
  if (!cleanTags.length) return base;
  return base ? `${base}\n\n${cleanTags.join(' ')}` : cleanTags.join(' ');
}

export function validatePostForPlatform(
  platform: SocialPlatformCode,
  fullText: string,
  hasVideo: boolean,
): { ok: true } | { ok: false; error: string } {
  const spec = SOCIAL_PLATFORMS[platform];
  if (!spec) return { ok: false, error: `Platform tidak dikenal: ${platform}` };
  if (!fullText.trim() && !hasVideo) return { ok: false, error: 'Caption atau video wajib diisi.' };
  if (fullText.length > spec.maxChars) {
    return { ok: false, error: `Teks melebihi batas ${spec.name} (${fullText.length}/${spec.maxChars} karakter).` };
  }
  if (spec.videoRequired && !hasVideo) {
    return { ok: false, error: `${spec.name} membutuhkan media video untuk dipublikasikan.` };
  }
  return { ok: true };
}

export interface PlatformCredentials {
  accessToken: string;
  handle?: string;
  externalId?: string;
  instanceUrl?: string;
  boardId?: string;
}

export interface PublishPlatformInput {
  platform: SocialPlatformCode;
  caption: string;
  hashtags: string[];
  firstComment?: string | null;
  title?: string | null;
  mediaUrl?: string | null;
  credentials: PlatformCredentials;
}

export interface PublishPlatformResult {
  externalPostId: string;
  externalUrl: string | null;
  raw?: unknown;
}

async function fetchJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

function errMsg(platform: string, status: number, data: Record<string, unknown>): string {
  const detail =
    (typeof data.error === 'string' && data.error) ||
    (typeof (data.error as Record<string, unknown> | undefined)?.message === 'string' &&
      String((data.error as Record<string, unknown>).message)) ||
    (typeof data.message === 'string' && data.message) ||
    (typeof data.detail === 'string' && data.detail) ||
    `HTTP ${status}`;
  return `Gagal publish ke ${platform}: ${detail}`;
}

export async function publishToPlatform(input: PublishPlatformInput): Promise<PublishPlatformResult> {
  const fullText = composeCaption(input.caption, input.hashtags);
  const v = validatePostForPlatform(input.platform, fullText, Boolean(input.mediaUrl));
  if (!v.ok) throw new Error(v.error);

  const token = input.credentials.accessToken?.trim();
  if (!token) throw new Error(`Kredensial ${SOCIAL_PLATFORMS[input.platform].name} kosong atau belum terhubung.`);

  switch (input.platform) {
    case 'bluesky': {
      const identifier = input.credentials.handle?.trim();
      if (!identifier) throw new Error('Bluesky memerlukan handle (misal: akun.bsky.social).');
      const session = await fetchJson('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: token }),
      });
      if (!session.ok || typeof session.data.accessJwt !== 'string' || typeof session.data.did !== 'string') {
        throw new Error(errMsg('Bluesky', session.status, session.data));
      }
      const postRes = await fetchJson('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.accessJwt}` },
        body: JSON.stringify({
          repo: session.data.did,
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text: fullText, createdAt: new Date().toISOString() },
        }),
      });
      if (!postRes.ok) throw new Error(errMsg('Bluesky', postRes.status, postRes.data));
      const uri = String(postRes.data.uri ?? '');
      const rkey = uri.split('/').pop() ?? '';
      return { externalPostId: uri || String(postRes.data.cid ?? 'bsky'), externalUrl: rkey ? `https://bsky.app/profile/${identifier}/post/${rkey}` : null, raw: postRes.data };
    }

    case 'mastodon': {
      const base = (input.credentials.instanceUrl || 'https://mastodon.social').replace(/\/+$/, '');
      if (!/^https:\/\/[^/\s]+/i.test(base)) throw new Error('URL instance Mastodon tidak valid (harus https://).');
      const res = await fetchJson(`${base}/api/v1/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: fullText, visibility: 'public' }),
      });
      if (!res.ok) throw new Error(errMsg('Mastodon', res.status, res.data));
      return { externalPostId: String(res.data.id ?? 'mastodon'), externalUrl: typeof res.data.url === 'string' ? res.data.url : null, raw: res.data };
    }

    case 'x': {
      const res = await fetchJson('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: fullText }),
      });
      if (!res.ok) throw new Error(errMsg('X', res.status, res.data));
      const id = String((res.data.data as Record<string, unknown> | undefined)?.id ?? 'x');
      return { externalPostId: id, externalUrl: `https://x.com/i/web/status/${id}`, raw: res.data };
    }

    case 'linkedin': {
      const author = input.credentials.externalId?.trim();
      if (!author) throw new Error('LinkedIn memerlukan Author URN (misal: urn:li:person:xxxx).');
      const res = await fetchJson('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
        body: JSON.stringify({
          author,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': { shareCommentary: { text: fullText }, shareMediaCategory: 'NONE' },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      if (!res.ok) throw new Error(errMsg('LinkedIn', res.status, res.data));
      const id = String(res.data.id ?? 'linkedin');
      return { externalPostId: id, externalUrl: `https://www.linkedin.com/feed/update/${id}`, raw: res.data };
    }

    case 'facebook': {
      const pageId = input.credentials.externalId?.trim();
      if (!pageId) throw new Error('Facebook memerlukan Facebook Page ID.');
      const endpoint = input.mediaUrl
        ? `https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/videos`
        : `https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/feed`;
      const body = input.mediaUrl
        ? { file_url: input.mediaUrl, description: fullText, access_token: token }
        : { message: fullText, access_token: token };
      const res = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(errMsg('Facebook', res.status, res.data));
      const id = String(res.data.id ?? 'fb');
      return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}`, raw: res.data };
    }

    case 'instagram': {
      const igUserId = input.credentials.externalId?.trim();
      if (!igUserId) throw new Error('Instagram memerlukan Instagram Business User ID.');
      const container = await fetchJson(`https://graph.facebook.com/v20.0/${encodeURIComponent(igUserId)}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: 'REELS', video_url: input.mediaUrl, caption: fullText, access_token: token }),
      });
      if (!container.ok || !container.data.id) throw new Error(errMsg('Instagram', container.status, container.data));
      const pub = await fetchJson(`https://graph.facebook.com/v20.0/${encodeURIComponent(igUserId)}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.data.id, access_token: token }),
      });
      if (!pub.ok) throw new Error(errMsg('Instagram', pub.status, pub.data));
      const id = String(pub.data.id ?? container.data.id);
      return { externalPostId: id, externalUrl: `https://www.instagram.com/reel/${id}/`, raw: pub.data };
    }

    case 'threads': {
      const userId = input.credentials.externalId?.trim();
      if (!userId) throw new Error('Threads memerlukan Threads User ID.');
      const createBody: Record<string, unknown> = input.mediaUrl
        ? { media_type: 'VIDEO', video_url: input.mediaUrl, text: fullText, access_token: token }
        : { media_type: 'TEXT', text: fullText, access_token: token };
      const container = await fetchJson(`https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      });
      if (!container.ok || !container.data.id) throw new Error(errMsg('Threads', container.status, container.data));
      const pub = await fetchJson(`https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.data.id, access_token: token }),
      });
      if (!pub.ok) throw new Error(errMsg('Threads', pub.status, pub.data));
      return { externalPostId: String(pub.data.id ?? container.data.id), externalUrl: null, raw: pub.data };
    }

    case 'pinterest': {
      const boardId = input.credentials.boardId?.trim() || input.credentials.externalId?.trim();
      if (!boardId) throw new Error('Pinterest memerlukan Board ID.');
      const res = await fetchJson('https://api.pinterest.com/v5/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          board_id: boardId,
          title: (input.title || fullText).slice(0, 100),
          description: fullText,
          ...(input.mediaUrl ? { media_source: { source_type: 'video_id', cover_image_url: input.mediaUrl } } : {}),
        }),
      });
      if (!res.ok) throw new Error(errMsg('Pinterest', res.status, res.data));
      const id = String(res.data.id ?? 'pin');
      return { externalPostId: id, externalUrl: `https://www.pinterest.com/pin/${id}/`, raw: res.data };
    }

    case 'tiktok': {
      const res = await fetchJson('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          post_info: { title: fullText.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'PULL_FROM_URL', video_url: input.mediaUrl },
        }),
      });
      if (!res.ok) throw new Error(errMsg('TikTok', res.status, res.data));
      const publishId = String((res.data.data as Record<string, unknown> | undefined)?.publish_id ?? 'tiktok');
      return { externalPostId: publishId, externalUrl: null, raw: res.data };
    }

    case 'youtube': {
      const res = await fetchJson('https://www.googleapis.com/youtube/v3/videos?part=snippet,status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          snippet: { title: (input.title || fullText).slice(0, 100), description: fullText, categoryId: '27' },
          status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
        }),
      });
      if (!res.ok) throw new Error(errMsg('YouTube', res.status, res.data));
      const id = String(res.data.id ?? 'yt');
      return { externalPostId: id, externalUrl: `https://www.youtube.com/watch?v=${id}`, raw: res.data };
    }
  }
}
