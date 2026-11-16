import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { type Database, memberTtsAccounts, memberVoicePreferences, secretVault, ttsProviderConfigs, voiceProfiles, voiceSamples } from '@dentweb/database';
import type { TtsProvider } from '@dentweb/content-schema';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { Cipher } from '../../infra/crypto.js';
import { Errors } from '../../infra/errors.js';
import { MediaService } from '../media/media.service.js';
import { ElevenLabsTts, FallbackTts, GeminiTts, type Credentials, type TtsAdapter } from './tts.adapters.js';

type Voice = typeof voiceProfiles.$inferSelect;
const SAMPLE_TEXT = 'Halo, ini contoh suara narator untuk video edukasi DENTSWEB STUDIO.';

@Injectable()
export class VoicesService {
  private readonly adapters: Record<TtsProvider, TtsAdapter>;
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cipher: Cipher,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    gemini: GeminiTts,
    eleven: ElevenLabsTts,
    fallback: FallbackTts,
  ) {
    this.adapters = { gemini, elevenlabs: eleven, cadangan: fallback };
  }

  adapter(p: string) {
    const a = this.adapters[p as TtsProvider];
    if (!a) throw Errors.invalid('TTS_PROVIDER', `Provider tidak dikenal: ${p}`);
    return a;
  }

  // ---------- secrets ----------
  private async putSecret(ownerId: string | null, purpose: string, plain: string, ref?: string | null) {
    const ciphertext = this.cipher.encrypt(plain, `${purpose}:${ownerId ?? 'global'}`);
    if (ref) {
      await this.db.update(secretVault).set({ ciphertext }).where(eq(secretVault.id, ref));
      return ref;
    }
    const [s] = await this.db.insert(secretVault).values({ ownerId, purpose, ciphertext }).returning({ id: secretVault.id });
    return s!.id;
  }
  private async getSecret(ownerId: string | null, purpose: string, ref: string | null | undefined) {
    if (!ref) return undefined;
    const [s] = await this.db.select().from(secretVault).where(eq(secretVault.id, ref));
    return s ? this.cipher.decrypt(s.ciphertext, `${purpose}:${ownerId ?? 'global'}`) : undefined;
  }

  // ---------- global provider config (Superadmin) ----------
  async providersAdmin() {
    const rows = await this.db.select().from(ttsProviderConfigs).orderBy(asc(ttsProviderConfigs.provider));
    return rows.map(({ secretRef, ...r }) => ({ ...r, hasCredential: !!secretRef, capabilities: this.adapters[r.provider as TtsProvider]?.capabilities }));
  }

  private async globalCreds(provider: string): Promise<Credentials & { enabled: boolean; model?: string }> {
    const [c] = await this.db.select().from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, provider));
    if (!c) throw Errors.notFound('Provider');
    const cfg = c.config as { baseUrl?: string; model?: string };
    return { enabled: c.isEnabled, apiKey: await this.getSecret(null, `tts:${provider}`, c.secretRef), baseUrl: cfg.baseUrl, model: cfg.model };
  }

  async patchProvider(actorId: string, provider: string, i: { isEnabled?: boolean; apiKey?: string; baseUrl?: string | null; model?: string | null }) {
    const a = this.adapter(provider);
    const [c] = await this.db.select().from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, provider));
    if (!c) throw Errors.notFound('Provider');
    const cfg = { ...(c.config as object), ...(i.baseUrl !== undefined ? { baseUrl: i.baseUrl } : {}), ...(i.model !== undefined ? { model: i.model } : {}) };
    let secretRef = c.secretRef;
    if (i.apiKey) secretRef = await this.putSecret(null, `tts:${provider}`, i.apiKey, c.secretRef);
    const creds = { apiKey: i.apiKey ?? (await this.getSecret(null, `tts:${provider}`, secretRef)), baseUrl: (cfg as { baseUrl?: string }).baseUrl };
    const probe = i.apiKey || i.baseUrl || i.isEnabled ? await a.probe(creds) : null;
    if (i.isEnabled && probe && probe.status !== 'CONNECTED') throw Errors.invalid('TTS_PROVIDER_UNVERIFIED', `Provider belum bisa diaktifkan: ${probe.error ?? probe.status}`);
    const [u] = await this.db
      .update(ttsProviderConfigs)
      .set({
        isEnabled: i.isEnabled ?? c.isEnabled,
        config: cfg,
        secretRef,
        publicCapabilities: { ...a.capabilities, ...(probe?.info ?? {}) },
        lastStatus: probe?.status ?? c.lastStatus,
        lastCheckedAt: probe ? new Date() : c.lastCheckedAt,
      })
      .where(eq(ttsProviderConfigs.provider, provider))
      .returning();
    await this.audit.log({ actorId, action: 'tts.provider.update', targetType: 'tts_provider', metadata: { provider, isEnabled: u!.isEnabled, status: probe?.status } });
    const { secretRef: _s, ...rest } = u!;
    return { ...rest, hasCredential: !!_s, probe };
  }

  // ---------- catalog ----------
  private async view(v: Voice) {
    return { ...v, sampleUrl: await this.media.url(v.sampleAssetId) };
  }

  async list(q: { provider?: string; gender?: string; status?: string }, publishedOnly: boolean) {
    const where: SQL[] = [];
    if (publishedOnly) where.push(eq(voiceProfiles.status, 'PUBLISHED'), sql`exists (select 1 from ${ttsProviderConfigs} t where t.provider = ${voiceProfiles.provider} and t.is_enabled)`);
    else if (q.status) where.push(eq(voiceProfiles.status, q.status));
    if (q.provider) where.push(eq(voiceProfiles.provider, q.provider));
    if (q.gender) where.push(sql`${voiceProfiles.voiceAttributes}->>'gender' = ${q.gender}`);
    const rows = await this.db.select().from(voiceProfiles).where(where.length ? and(...where) : undefined).orderBy(asc(voiceProfiles.name));
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async get(id: string, publishedOnly: boolean) {
    const [v] = await this.db.select().from(voiceProfiles).where(publishedOnly ? and(eq(voiceProfiles.id, id), eq(voiceProfiles.status, 'PUBLISHED')) : eq(voiceProfiles.id, id));
    if (!v) throw Errors.notFound('Suara');
    return this.view(v);
  }

  async create(actorId: string, i: { provider: TtsProvider; providerVoiceId: string; slug: string; name: string; language: string; description?: string; voiceAttributes?: object; capabilities?: object; synthesisConfig?: object }) {
    this.adapter(i.provider);
    try {
      const [v] = await this.db.insert(voiceProfiles).values({ ...i, description: i.description ?? '', status: 'DRAFT', createdBy: actorId }).returning();
      await this.audit.log({ actorId, action: 'voice.create', targetType: 'voice_profile', targetId: v!.id });
      return this.view(v!);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw Errors.conflict('SLUG_TAKEN', 'Slug suara sudah dipakai');
      throw e;
    }
  }

  async update(actorId: string, id: string, i: Partial<{ name: string; description: string; language: string; providerVoiceId: string; voiceAttributes: object; capabilities: object; synthesisConfig: object }>) {
    const cur = await this.get(id, false);
    // Changing the engine identity invalidates the previous verification.
    const synthesisConfig = i.providerVoiceId && i.providerVoiceId !== cur.providerVoiceId ? { ...(i.synthesisConfig ?? (cur.synthesisConfig as object)), verified: null } : i.synthesisConfig;
    const [v] = await this.db.update(voiceProfiles).set({ ...i, synthesisConfig }).where(eq(voiceProfiles.id, id)).returning();
    await this.audit.log({ actorId, action: 'voice.update', targetType: 'voice_profile', targetId: id });
    return this.view(v!);
  }

  async remove(actorId: string, id: string) {
    const v = await this.get(id, false);
    if (v.status === 'PUBLISHED') throw Errors.conflict('VOICE_PUBLISHED', 'Nonaktifkan suara sebelum dihapus');
    await this.db.delete(voiceProfiles).where(eq(voiceProfiles.id, id));
    await this.audit.log({ actorId, action: 'voice.delete', targetType: 'voice_profile', targetId: id });
    return { ok: true };
  }

  /** Test synthesis with the global provider credential. A pass is required before publish. */
  async adminTest(actorId: string, id: string, text?: string) {
    const v = await this.get(id, false);
    const creds = await this.globalCreds(v.provider);
    const sc = v.synthesisConfig as { model?: string; stability?: number; similarityBoost?: number };
    const r = await this.adapter(v.provider).synthesize(creds, { text: text ?? SAMPLE_TEXT, voiceId: v.providerVoiceId ?? '', model: sc.model ?? creds.model, stability: sc.stability, similarityBoost: sc.similarityBoost });
    const verified = { ok: r.ok, at: new Date().toISOString(), error: r.ok ? null : r.error };
    await this.db.update(voiceProfiles).set({ synthesisConfig: { ...(v.synthesisConfig as object), verified } }).where(eq(voiceProfiles.id, id));
    await this.audit.log({ actorId, action: r.ok ? 'voice.test.ok' : 'voice.test.failed', targetType: 'voice_profile', targetId: id });
    if (!r.ok) throw Errors.unavailable('TTS_TEST_FAILED', r.error);
    const asset = await this.media.ingestBuffer(actorId, r.audio, `${v.slug}-test.${r.ext}`, r.mime, { voiceId: id, kind: 'voice-test' });
    if (!v.sampleAssetId) {
      await this.db.update(voiceProfiles).set({ sampleAssetId: asset.id }).where(eq(voiceProfiles.id, id));
      await this.db.insert(voiceSamples).values({ voiceId: id, assetId: asset.id, language: v.language, sampleText: text ?? SAMPLE_TEXT });
    }
    return { ok: true, audioUrl: await this.media.url(asset.id), bytes: r.audio.length };
  }

  async setStatus(actorId: string, id: string, to: 'PUBLISHED' | 'DISABLED') {
    const v = await this.get(id, false);
    if (to === 'PUBLISHED') {
      const [p] = await this.db.select().from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, v.provider));
      if (!p?.isEnabled) throw Errors.invalid('TTS_PROVIDER_DISABLED', 'Aktifkan provider suara ini terlebih dahulu');
      if (!(v.synthesisConfig as { verified?: { ok?: boolean } }).verified?.ok) throw Errors.invalid('VOICE_UNVERIFIED', 'Jalankan Test Synthesis yang berhasil sebelum publish');
    }
    const [u] = await this.db.update(voiceProfiles).set({ status: to }).where(eq(voiceProfiles.id, id)).returning();
    await this.audit.log({ actorId, action: to === 'PUBLISHED' ? 'voice.publish' : 'voice.disable', targetType: 'voice_profile', targetId: id });
    return this.view(u!);
  }

  // ---------- member accounts ----------
  async memberAccounts(userId: string) {
    const rows = await this.db.select().from(memberTtsAccounts).where(eq(memberTtsAccounts.userId, userId));
    const providers = await this.db.select().from(ttsProviderConfigs).orderBy(asc(ttsProviderConfigs.provider));
    return providers.map((p) => {
      const a = rows.find((r) => r.provider === p.provider);
      return {
        provider: p.provider,
        displayName: p.displayName,
        providerEnabled: p.isEnabled,
        status: a?.status ?? 'NOT_CONFIGURED',
        credentialHint: a?.credentialHint ?? null,
        config: a?.config ?? {},
        lastError: a?.lastError ?? null,
        lastCheckedAt: a?.lastCheckedAt ?? null,
        capabilities: this.adapters[p.provider as TtsProvider]?.capabilities,
      };
    });
  }

  private async memberCreds(userId: string, provider: string): Promise<Credentials> {
    const [a] = await this.db.select().from(memberTtsAccounts).where(and(eq(memberTtsAccounts.userId, userId), eq(memberTtsAccounts.provider, provider)));
    if (!a) return {};
    return { apiKey: await this.getSecret(userId, `tts:${provider}`, a.credentialRef), baseUrl: (a.config as { baseUrl?: string }).baseUrl };
  }

  async putMemberAccount(userId: string, provider: string, i: { apiKey?: string; baseUrl?: string }) {
    const a = this.adapter(provider);
    const probe = await a.probe(i);
    if (probe.status === 'INVALID') throw Errors.invalid('TTS_KEY_INVALID', probe.error ?? 'Kredensial ditolak provider');
    const [cur] = await this.db.select().from(memberTtsAccounts).where(and(eq(memberTtsAccounts.userId, userId), eq(memberTtsAccounts.provider, provider)));
    const ref = i.apiKey ? await this.putSecret(userId, `tts:${provider}`, i.apiKey, cur?.credentialRef) : (cur?.credentialRef ?? null);
    const values = {
      status: probe.status, credentialRef: ref, credentialHint: i.apiKey ? `…${i.apiKey.slice(-4)}` : (cur?.credentialHint ?? null),
      config: i.baseUrl ? { baseUrl: i.baseUrl } : (cur?.config ?? {}), lastError: probe.error ?? null, lastCheckedAt: new Date(),
    };
    await this.db.insert(memberTtsAccounts).values({ userId, provider, ...values }).onConflictDoUpdate({ target: [memberTtsAccounts.userId, memberTtsAccounts.provider], set: values });
    await this.audit.log({ actorId: userId, action: 'tts.account.save', targetType: 'member_tts_account', metadata: { provider, status: probe.status } });
    return (await this.memberAccounts(userId)).find((x) => x.provider === provider);
  }

  async testMemberAccount(userId: string, provider: string) {
    const probe = await this.adapter(provider).probe(await this.memberCreds(userId, provider));
    await this.db.update(memberTtsAccounts).set({ status: probe.status, lastError: probe.error ?? null, lastCheckedAt: new Date() }).where(and(eq(memberTtsAccounts.userId, userId), eq(memberTtsAccounts.provider, provider)));
    return probe;
  }

  async deleteMemberAccount(userId: string, provider: string) {
    const [a] = await this.db.delete(memberTtsAccounts).where(and(eq(memberTtsAccounts.userId, userId), eq(memberTtsAccounts.provider, provider))).returning();
    if (a?.credentialRef) await this.db.delete(secretVault).where(and(eq(secretVault.id, a.credentialRef), eq(secretVault.ownerId, userId)));
    return { ok: true };
  }

  /** Member "Coba Suara": real synthesis with the member's own provider account. */
  async memberPreview(userId: string, id: string, i: { text?: string; emotion?: string | null; speed?: number; pitch?: number | null; instructions?: string | null }) {
    const v = await this.get(id, true);
    const a = this.adapter(v.provider);
    const caps = a.capabilities;
    if ((i.pitch && !caps.pitch) || (i.emotion && !caps.emotion) || (i.instructions && !caps.instructions)) {
      throw Errors.invalid('TTS_CAPABILITY', 'Pengaturan ini tidak didukung provider suara tersebut');
    }
    const creds = await this.memberCreds(userId, v.provider);
    if (!creds.apiKey && !creds.baseUrl) throw Errors.invalid('TTS_ACCOUNT_MISSING', 'Atur akun suara Anda di Pengaturan → Akun Suara');
    const sc = v.synthesisConfig as { model?: string; stability?: number; similarityBoost?: number };
    const r = await a.synthesize(creds, { text: i.text ?? SAMPLE_TEXT, voiceId: v.providerVoiceId ?? '', emotion: i.emotion, speed: i.speed, pitch: i.pitch, instructions: i.instructions, model: sc.model, stability: sc.stability, similarityBoost: sc.similarityBoost });
    if (!r.ok) throw Errors.unavailable('TTS_PREVIEW_FAILED', r.error);
    const asset = await this.media.ingestBuffer(userId, r.audio, `preview-${v.slug}.${r.ext}`, r.mime, { voiceId: id, kind: 'voice-preview' });
    return { audioUrl: await this.media.url(asset.id), mime: r.mime };
  }

  /** Narration for production: member's own account, published voice only. */
  async synthForMember(userId: string, voiceId: string, text: string, cfg: { emotion?: string | null; speed?: number; pitch?: number | null; instructions?: string | null }) {
    const v = await this.get(voiceId, true);
    const a = this.adapter(v.provider);
    const creds = await this.memberCreds(userId, v.provider);
    if (!creds.apiKey && !creds.baseUrl) throw Errors.invalid('TTS_ACCOUNT_MISSING', `Akun suara ${v.provider} belum diatur`);
    const sc = v.synthesisConfig as { model?: string; stability?: number; similarityBoost?: number };
    const r = await a.synthesize(creds, {
      text, voiceId: v.providerVoiceId ?? '', model: sc.model, stability: sc.stability, similarityBoost: sc.similarityBoost,
      emotion: a.capabilities.emotion ? cfg.emotion : null, speed: a.capabilities.speed ? cfg.speed : 1, pitch: a.capabilities.pitch ? cfg.pitch : null, instructions: a.capabilities.instructions ? cfg.instructions : null,
    });
    if (!r.ok) throw Errors.unavailable('TTS_FAILED', r.error);
    return r;
  }

  async getPreference(userId: string) {
    const [p] = await this.db.select().from(memberVoicePreferences).where(eq(memberVoicePreferences.userId, userId));
    if (!p) return { voiceId: null, emotion: null, speed: 1, pitch: null, instructions: null, voice: null, voiceActive: false };
    const voice = p.voiceId ? (await this.db.select().from(voiceProfiles).where(eq(voiceProfiles.id, p.voiceId)))[0] : undefined;
    return { ...p, voice: voice ? { id: voice.id, name: voice.name, provider: voice.provider } : null, voiceActive: voice?.status === 'PUBLISHED' };
  }

  async putPreference(userId: string, i: { voiceId: string | null; emotion?: string | null; speed: number; pitch?: number | null; instructions?: string | null }) {
    if (i.voiceId) {
      const v = await this.get(i.voiceId, true);
      const caps = this.adapter(v.provider).capabilities;
      if ((i.pitch && !caps.pitch) || (i.emotion && !caps.emotion)) throw Errors.invalid('TTS_CAPABILITY', 'Pengaturan ini tidak didukung provider suara tersebut');
    }
    const values = { voiceId: i.voiceId, emotion: i.emotion ?? null, speed: i.speed, pitch: i.pitch ?? null, instructions: i.instructions ?? null };
    await this.db.insert(memberVoicePreferences).values({ userId, ...values }).onConflictDoUpdate({ target: memberVoicePreferences.userId, set: values });
    return this.getPreference(userId);
  }

  async providersPublic(userId: string) {
    const rows = await this.db
      .select({
        provider: ttsProviderConfigs.provider, displayName: ttsProviderConfigs.displayName, isEnabled: ttsProviderConfigs.isEnabled,
        voiceCount: sql<number>`(select count(*) from ${voiceProfiles} v where v.provider = ${ttsProviderConfigs.provider} and v.status = 'PUBLISHED')`.mapWith(Number),
      })
      .from(ttsProviderConfigs)
      .orderBy(asc(ttsProviderConfigs.provider));
    const accounts = await this.memberAccounts(userId);
    return rows.map((r) => ({ ...r, capabilities: this.adapters[r.provider as TtsProvider]?.capabilities, accountStatus: accounts.find((a) => a.provider === r.provider)?.status ?? 'NOT_CONFIGURED' }));
  }
}
