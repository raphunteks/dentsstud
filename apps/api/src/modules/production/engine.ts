import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  type Database, agentDefinitions, agentPromptVersions, factCheckReports, hookPresets, hookVersions, memberBrandProfiles, notifications,
  productionEvents, productionOrders, productionRuns, productionStageRuns, qcReports, renderJobs, renderOutputs, researchSources, socialMetadata, videoResults,
  visualPresetVersions, visualPresets, workflowVersions, memberVoicePreferences,
} from '@dentweb/database';
import { FORMAT_SIZE, MotionDocument, DEFAULT_STYLE, type Format, type Layer } from '@dentweb/motion-schema';
import { DB } from '../../infra/tokens.js';
import { StorageService } from '../../infra/storage.js';
import { AnthropicAdapter } from '../ai-connections/anthropic.adapter.js';
import { AiConnectionsService } from '../ai-connections/ai-connections.service.js';
import { VoicesService } from '../voices/voices.service.js';
import { MediaService } from '../media/media.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { RenderService } from '../rendering/render.service.js';
import { CONTRACT, STAGE_WEIGHTS, extractJson, FactOut, ResearchOut, ScriptOut, MotionOut, QcOut, SocialOut } from './agents.js';
import { audioDuration, extractFrame, ffprobe } from './media-tools.js';
import type { z } from 'zod';

export interface OrderConfig {
  format: Format;
  topicMode: 'BEBAS' | 'UMUM' | 'PERSIS';
  topic: string;
  voice: { mode: 'TTS' | 'NONE' | 'UPLOAD'; voiceId?: string | null; uploadAssetId?: string | null; emotion?: string | null; speed?: number; pitch?: number | null; instructions?: string | null };
  presetId?: string | null;
  referenceAssetIds?: string[];
  hook: { mode: 'AUTO' | 'PRESET' | 'NONE'; hookId?: string | null };
  notes?: string;
  workers: number;
  revisionOf?: { resultId: string; runId: string; reuseStages: string[] } | null;
}

class Cancelled extends Error {}
/** Errors that a retry cannot fix (bad credentials, missing content, policy). */
export class Fatal extends Error {}
type Run = typeof productionRuns.$inferSelect;
type Ctx = { run: Run; cfg: OrderConfig; apiKey: string; model: string; outputs: Record<string, unknown>; signal: AbortController };

@Injectable()
export class ProductionEngine {
  private readonly log = new Logger('Production');
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly anthropic: AnthropicAdapter,
    private readonly ai: AiConnectionsService,
    private readonly voices: VoicesService,
    private readonly media: MediaService,
    private readonly projects: ProjectsService,
    private readonly render: RenderService,
  ) {}

  // ------------------------------------------------------------------ helpers
  async event(runId: string, eventType: string, message: string, metadata: Record<string, unknown> = {}, agentCode?: string, stageRunId?: string) {
    await this.db.insert(productionEvents).values({ runId, eventType, message, metadata, agentCode: agentCode ?? null, stageRunId: stageRunId ?? null });
  }

  private async progress(runId: string, stage: string, frac: number) {
    const [a, b] = STAGE_WEIGHTS[stage] ?? [0, 100];
    await this.db.update(productionRuns).set({ currentStage: stage, progress: Math.round(a + (b - a) * Math.max(0, Math.min(1, frac))), heartbeatAt: new Date() }).where(eq(productionRuns.id, runId));
  }

  private async checkCancel(ctx: Ctx) {
    const [r] = await this.db.select({ status: productionRuns.status }).from(productionRuns).where(eq(productionRuns.id, ctx.run.id));
    if (r?.status === 'CANCELLING' || r?.status === 'CANCELLED') {
      ctx.signal.abort();
      throw new Cancelled('Dibatalkan oleh pengguna');
    }
  }

  private async agentPrompt(code: string) {
    const [a] = await this.db.select().from(agentDefinitions).where(eq(agentDefinitions.code, code));
    if (!a || !a.isActive) throw new Fatal(`Agent ${code} tidak aktif`);
    const [v] = await this.db.select().from(agentPromptVersions).where(and(eq(agentPromptVersions.agentId, a.id), eq(agentPromptVersions.version, a.currentVersion)));
    return { def: a, prompt: v?.systemPrompt ?? '' };
  }

  /** One agent call with JSON contract validation and corrective retries. Never invents output. */
  private async llm<T extends z.ZodType>(ctx: Ctx, code: string, schema: T, user: unknown[], opts: { webSearch?: boolean; maxTokens?: number; attempts?: number } = {}): Promise<{ data: z.infer<T>; sources: { url: string; title: string }[]; usedWebSearch: boolean }> {
    const { def, prompt } = await this.agentPrompt(code);
    const cfg = def.config as { temperature?: number; maxTokens?: number; model?: string };
    const system = `${prompt}\n\nATURAN KELUARAN: balas HANYA satu objek JSON valid, tanpa teks lain, dengan bentuk:\n${CONTRACT[code]!.shape}`;
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content: user }];
    let webSearch = !!opts.webSearch;
    let lastErr = '';
    const attempts = opts.attempts ?? 3;
    for (let i = 1; i <= attempts; i++) {
      await this.checkCancel(ctx);
      const r = await this.anthropic.messages(
        ctx.apiKey,
        { model: cfg.model ?? ctx.model, system, messages, max_tokens: opts.maxTokens ?? cfg.maxTokens ?? 4096, tools: webSearch ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] : undefined },
        ctx.signal.signal,
      );
      if (!r.ok) {
        if (webSearch && r.status === 400) {
          webSearch = false;
          await this.event(ctx.run.id, 'agent.warning', 'Web search tidak tersedia untuk akun Claude ini; riset memakai pengetahuan model dan klaim akan ditandai belum terverifikasi.', {}, code);
          continue;
        }
        if (r.status === 401 || r.status === 403) throw new Fatal('Koneksi Claude ditolak (API key tidak valid). Periksa Pengaturan → Claude.');
        lastErr = r.error;
        await this.event(ctx.run.id, 'agent.retry', `Percobaan ${i} gagal: ${r.error}`, { status: r.status }, code);
        await new Promise((res) => setTimeout(res, Math.min(8000, 1000 * 2 ** i)));
        continue;
      }
      try {
        const data = schema.parse(extractJson(r.text));
        return { data, sources: r.sources, usedWebSearch: webSearch };
      } catch (e) {
        lastErr = (e as Error).message.slice(0, 500);
        await this.event(ctx.run.id, 'agent.invalid_output', `Keluaran tidak sesuai kontrak (percobaan ${i}), diminta ulang.`, { error: lastErr }, code);
        messages.push({ role: 'assistant', content: r.text.slice(0, 8000) }, { role: 'user', content: `Keluaranmu tidak valid: ${lastErr}. Kirim ulang HANYA JSON yang valid sesuai bentuk yang diminta.` });
      }
    }
    throw new Error(`Agent ${code} gagal setelah ${attempts} percobaan: ${lastErr}`);
  }

  // ------------------------------------------------------------------ entry
  async process(runId: string): Promise<'done' | 'delayed'> {
    const [run] = await this.db.select().from(productionRuns).where(eq(productionRuns.id, runId));
    if (!run || ['COMPLETED', 'CANCELLED'].includes(run.status)) return 'done';
    const [order] = await this.db.select().from(productionOrders).where(eq(productionOrders.id, run.orderId));
    const cfg = order!.requestConfig as OrderConfig;
    // Per-member worker concurrency from the order (entitlement-checked at order time).
    const running = await this.db.select({ id: productionRuns.id }).from(productionRuns).where(and(eq(productionRuns.userId, run.userId), eq(productionRuns.status, 'RUNNING')));
    if (running.filter((r) => r.id !== runId).length >= Math.max(1, cfg.workers)) return 'delayed';

    const apiKey = await this.ai.resolveApiKey(run.userId);
    const ctx: Ctx = { run, cfg, apiKey: apiKey ?? '', model: '', outputs: {}, signal: new AbortController() };
    await this.db.update(productionRuns).set({ status: 'RUNNING', startedAt: run.startedAt ?? new Date(), error: null, heartbeatAt: new Date() }).where(eq(productionRuns.id, runId));
    await this.event(runId, 'run.started', run.startedAt ? 'Produksi dilanjutkan dari checkpoint terakhir.' : 'Produksi dimulai.');
    try {
      if (!apiKey) throw new Fatal('Claude belum terhubung lewat API key. Produksi otomatis berjalan di server dan membutuhkan API key Anthropic milik Anda.');
      const activeConn = (await this.ai.list(run.userId)).find((c) => c.status === 'CONNECTED' && (c.method === 'API_KEY' || c.method === 'OAUTH_PKCE'));
      const caps = activeConn?.capabilities as { defaultModel?: string } | undefined;
      ctx.model = caps?.defaultModel ?? 'claude-3-7-sonnet-20250219';
      const [wv] = await this.db.select().from(workflowVersions).where(eq(workflowVersions.id, run.workflowVersionId));
      const stages = ((wv!.definition as { stages: { code: string; agent: string; maxAttempts: number }[] }).stages);

      // Revisions reuse completed upstream stages from the parent run (no repeated research).
      if (cfg.revisionOf) await this.copyStages(cfg.revisionOf.runId, runId, cfg.revisionOf.reuseStages);

      for (const st of stages) {
        const done = await this.completedStage(runId, st.code);
        if (done) {
          ctx.outputs[st.code] = done.output;
          await this.progress(runId, st.code, 1);
          continue;
        }
        let lastError: Error | null = null;
        for (let tryNo = 1; tryNo <= Math.max(1, st.maxAttempts); tryNo++) {
          await this.checkCancel(ctx);
          const attempt = (await this.lastAttempt(runId, st.code)) + 1;
          const [sr] = await this.db.insert(productionStageRuns).values({ runId, stageCode: st.code, attemptNumber: attempt, status: 'RUNNING' }).returning();
          await this.progress(runId, st.code, 0);
          await this.event(runId, 'stage.started', `Tahap ${st.code} dimulai (percobaan ${attempt}).`, {}, st.agent, sr!.id);
          try {
            const out = await this.runStage(ctx, st.code, sr!.id);
            await this.db.update(productionStageRuns).set({ status: 'COMPLETED', output: out as object, completedAt: new Date() }).where(eq(productionStageRuns.id, sr!.id));
            ctx.outputs[st.code] = out;
            await this.progress(runId, st.code, 1);
            await this.event(runId, 'stage.completed', `Tahap ${st.code} selesai.`, {}, st.agent, sr!.id);
            lastError = null;
            break;
          } catch (e) {
            await this.db.update(productionStageRuns).set({ status: e instanceof Cancelled ? 'CANCELLED' : 'FAILED', output: { error: (e as Error).message }, completedAt: new Date() }).where(eq(productionStageRuns.id, sr!.id));
            if (e instanceof Cancelled || e instanceof Fatal) throw e;
            lastError = e as Error;
            if (tryNo < st.maxAttempts) await this.event(runId, 'stage.retry', `Tahap ${st.code} gagal (${lastError.message.slice(0, 300)}); diulang otomatis.`, {}, st.agent, sr!.id);
          }
        }
        if (lastError) throw lastError;
      }
      await this.db.update(productionRuns).set({ status: 'COMPLETED', progress: 100, completedAt: new Date() }).where(eq(productionRuns.id, runId));
      await this.event(runId, 'run.completed', 'Video siap diunggah.');
      await this.db.insert(notifications).values({ userId: run.userId, type: 'production.completed', payload: { runId, resultId: (ctx.outputs.SOCIAL as { resultId?: string })?.resultId } });
    } catch (e) {
      const cancelled = e instanceof Cancelled;
      const message = (e as Error).message;
      await this.db.update(productionRuns).set({ status: cancelled ? 'CANCELLED' : 'FAILED', error: cancelled ? null : { stage: (await this.currentStage(runId)) ?? null, message }, completedAt: new Date() }).where(eq(productionRuns.id, runId));
      await this.event(runId, cancelled ? 'run.cancelled' : 'run.failed', cancelled ? 'Produksi dihentikan.' : `Produksi gagal: ${message}`, {});
      if (!cancelled) await this.db.insert(notifications).values({ userId: run.userId, type: 'production.failed', payload: { runId, message } });
      if (!cancelled) this.log.warn(`run ${runId} failed: ${message}`);
    }
    await this.syncOrderStatus(run.orderId);
    return 'done';
  }

  private async currentStage(runId: string) {
    return (await this.db.select({ s: productionRuns.currentStage }).from(productionRuns).where(eq(productionRuns.id, runId)))[0]?.s;
  }
  private async completedStage(runId: string, code: string) {
    const [s] = await this.db.select().from(productionStageRuns).where(and(eq(productionStageRuns.runId, runId), eq(productionStageRuns.stageCode, code), eq(productionStageRuns.status, 'COMPLETED'))).orderBy(desc(productionStageRuns.attemptNumber)).limit(1);
    return s ?? null;
  }
  private async lastAttempt(runId: string, code: string) {
    const [s] = await this.db.select({ n: productionStageRuns.attemptNumber }).from(productionStageRuns).where(and(eq(productionStageRuns.runId, runId), eq(productionStageRuns.stageCode, code))).orderBy(desc(productionStageRuns.attemptNumber)).limit(1);
    return s?.n ?? 0;
  }
  private async copyStages(fromRun: string, toRun: string, codes: string[]) {
    for (const code of codes) {
      if (await this.completedStage(toRun, code)) continue;
      const src = await this.completedStage(fromRun, code);
      if (src) await this.db.insert(productionStageRuns).values({ runId: toRun, stageCode: code, attemptNumber: 1, status: 'COMPLETED', output: src.output as object, inputRef: `reuse:${fromRun}`, completedAt: new Date() });
    }
  }
  private async syncOrderStatus(orderId: string) {
    const runs = await this.db.select({ status: productionRuns.status }).from(productionRuns).where(eq(productionRuns.orderId, orderId));
    const st = runs.every((r) => r.status === 'COMPLETED') ? 'COMPLETED' : runs.some((r) => ['QUEUED', 'RUNNING', 'CANCELLING'].includes(r.status)) ? 'RUNNING' : runs.some((r) => r.status === 'COMPLETED') ? 'PARTIAL' : 'FAILED';
    await this.db.update(productionOrders).set({ status: st }).where(eq(productionOrders.id, orderId));
  }

  private async brand(userId: string) {
    const [b] = await this.db.select().from(memberBrandProfiles).where(eq(memberBrandProfiles.userId, userId)).limit(1);
    return b ?? null;
  }

  // ------------------------------------------------------------------ stages
  private async runStage(ctx: Ctx, code: string, stageRunId: string): Promise<unknown> {
    const { run, cfg } = ctx;
    const brand = await this.brand(run.userId);
    const brandRules = brand ? { nama: brand.name || null, instagram: brand.instagramUsername, pembuka: brand.openingText, penutup: brand.closingText, cta: brand.captionCta, gaya: (brand.brandSettings as { tone?: string }).tone ?? null } : null;
    const target = cfg.format === '16:9' ? '60–90 detik' : '40–60 detik';

    if (code === 'RESEARCH') {
      const topic = run.topic ?? cfg.topic;
      const topicLine = cfg.topicMode === 'PERSIS' ? `Topik persis: "${topic}".` : cfg.topicMode === 'UMUM' ? `Tema umum: "${topic}". Pilih satu sudut spesifik yang berbeda untuk video ke-${run.sequence}.` : `Bebas: pilih topik edukasi yang relevan${cfg.topic ? ` dengan arahan "${cfg.topic}"` : ''} untuk video ke-${run.sequence}.`;
      const refs = await this.referenceNotes(ctx);
      const r = await this.llm(ctx, 'research', ResearchOut, [{ type: 'text', text: `${topicLine}\nCatatan tim: ${cfg.notes || '-'}\nBrand: ${JSON.stringify(brandRules)}\n${refs}\nKumpulkan fakta yang bisa diverifikasi, cantumkan URL sumber untuk setiap fakta.` }], { webSearch: true, maxTokens: 6000 });
      const seen = new Set<string>();
      const sources = [...r.sources, ...r.data.keyFacts.flatMap((f) => f.sources.map((u) => ({ url: u, title: u })))].filter((s) => /^https?:\/\//.test(s.url) && !seen.has(s.url) && seen.add(s.url));
      if (sources.length) await this.db.insert(researchSources).values(sources.slice(0, 30).map((s) => ({ runId: run.id, url: s.url, title: s.title.slice(0, 500), metadata: { fromWebSearch: r.sources.some((x) => x.url === s.url) } })));
      await this.db.update(productionRuns).set({ topic: r.data.topic }).where(eq(productionRuns.id, run.id));
      await this.event(run.id, 'agent.output', `Riset selesai: ${r.data.keyFacts.length} fakta, ${sources.length} sumber${r.usedWebSearch ? ' (web search)' : ''}.`, {}, 'research', stageRunId);
      return { ...r.data, sources, usedWebSearch: r.usedWebSearch };
    }

    if (code === 'SCRIPT') {
      const research = ctx.outputs.RESEARCH as z.infer<typeof ResearchOut>;
      const fixes = (ctx.outputs._corrections as string | undefined) ?? '';
      const r = await this.llm(ctx, 'scriptwriter', ScriptOut, [{ type: 'text', text: `Riset:\n${JSON.stringify(research)}\nFormat ${cfg.format}, durasi total ${target}. Bahasa Indonesia yang natural dan akurat.\nAturan brand (kosong = bebas): ${JSON.stringify(brandRules)}\nHook pembuka: ${cfg.hook.mode === 'NONE' ? 'tidak dipakai (isi singkat saja)' : 'wajib kuat, maks 8 kata'}.\nCatatan tim: ${cfg.notes || '-'}\n${fixes ? `PERBAIKAN WAJIB dari cek fakta:\n${fixes}` : ''}` }], { maxTokens: 6000 });
      await this.event(run.id, 'agent.output', `Naskah: "${r.data.title}", ${r.data.scenes.length} scene.`, {}, 'scriptwriter', stageRunId);
      return r.data;
    }

    if (code === 'FACT_CHECK') {
      const research = ctx.outputs.RESEARCH as { sources: { url: string }[]; keyFacts: unknown };
      let script = ctx.outputs.SCRIPT as z.infer<typeof ScriptOut>;
      const check = async (s: typeof script) => (await this.llm(ctx, 'fact_checker', FactOut, [{ type: 'text', text: `Sumber riset: ${JSON.stringify(research.sources.map((x) => x.url))}\nFakta riset: ${JSON.stringify(research.keyFacts)}\nNaskah: ${JSON.stringify(s.scenes.map((x, i) => ({ scene: i + 1, narasi: x.narration, teks: x.onScreenText })))}\nPeriksa setiap klaim. Klaim tanpa sumber = UNVERIFIED. Klaim bertentangan dengan sumber = CONTRADICTED dan beri perbaikan.` }])).data;
      let report = await check(script);
      const contradicted = report.claims.filter((c) => c.status === 'CONTRADICTED');
      if (contradicted.length && report.corrections.length) {
        await this.event(run.id, 'agent.revision', `${contradicted.length} klaim bertentangan; naskah direvisi sekali.`, {}, 'fact_checker', stageRunId);
        ctx.outputs._corrections = report.corrections.map((c) => `Scene ${c.scene}: ${c.fix}`).join('\n');
        script = (await this.runStage(ctx, 'SCRIPT', stageRunId)) as typeof script;
        const att = (await this.lastAttempt(run.id, 'SCRIPT')) + 1;
        await this.db.insert(productionStageRuns).values({ runId: run.id, stageCode: 'SCRIPT', attemptNumber: att, status: 'COMPLETED', output: script, inputRef: 'fact-check-revision', completedAt: new Date() });
        ctx.outputs.SCRIPT = script;
        report = await check(script);
      }
      const verdict = { verified: report.claims.filter((c) => c.status === 'VERIFIED').length, unverified: report.claims.filter((c) => c.status === 'UNVERIFIED').length, contradicted: report.claims.filter((c) => c.status === 'CONTRADICTED').length };
      await this.db.insert(factCheckReports).values({ runId: run.id, claims: report.claims, verdict });
      await this.event(run.id, 'agent.output', `Cek fakta: ${verdict.verified} terverifikasi, ${verdict.unverified} belum terverifikasi, ${verdict.contradicted} bertentangan.`, verdict, 'fact_checker', stageRunId);
      if (verdict.contradicted > 0) throw new Error(`${verdict.contradicted} klaim masih bertentangan dengan sumber setelah revisi. Periksa laporan cek fakta.`);
      return { ...report, verdict };
    }

    if (code === 'MOTION') return this.motionStage(ctx, stageRunId, brandRules);
    if (code === 'QC') return this.qcStage(ctx, stageRunId);
    if (code === 'SOCIAL') return this.socialStage(ctx, stageRunId, brandRules);
    throw new Error(`Tahap tidak dikenal: ${code}`);
  }

  /** Reference videos: three frames per video described by Claude vision (style only). */
  private async referenceNotes(ctx: Ctx) {
    const ids = ctx.cfg.referenceAssetIds ?? [];
    if (!ids.length) return '';
    const notes: string[] = [];
    for (const id of ids.slice(0, 2)) {
      const m = await this.media.get(id);
      if (!m || m.ownerId !== ctx.run.userId || !m.mimeType.startsWith('video/')) continue;
      const dir = join(tmpdir(), 'dw-ref', randomUUID());
      try {
        await mkdir(dir, { recursive: true });
        const file = await this.storage.download(m.objectKey, join(dir, m.filename.replace(/[^\w.-]/g, '_')));
        const info = await ffprobe(file);
        if (!info) { await this.event(ctx.run.id, 'agent.warning', 'FFmpeg tidak tersedia di server; video referensi dicatat tanpa analisis visual.'); notes.push(`Referensi: ${m.filename}`); continue; }
        const frames: string[] = [];
        for (const f of [0.2, 0.5, 0.8]) frames.push((await readFile(await extractFrame(file, join(dir, `f${f}.jpg`), info.durationSec * f))).toString('base64'));
        const r = await this.anthropic.messages(ctx.apiKey, { model: ctx.model, system: 'Deskripsikan gaya visual (warna, tipografi, ritme, komposisi) dari frame video referensi dalam 3 kalimat bahasa Indonesia. Jangan menyalin teks atau logo.', max_tokens: 400, messages: [{ role: 'user', content: [...frames.map((d) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } })), { type: 'text', text: 'Gaya visualnya?' }] }] }, ctx.signal.signal);
        if (r.ok) notes.push(`Gaya referensi: ${r.text}`);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
    return notes.join('\n');
  }

  private async motionStage(ctx: Ctx, stageRunId: string, brandRules: unknown) {
    const { run, cfg } = ctx;
    const script = ctx.outputs.SCRIPT as z.infer<typeof ScriptOut>;
    // Style: the published preset's pinned version, else the default style.
    let style = DEFAULT_STYLE;
    let preset: { id: string; version: number; name: string } | null = null;
    if (cfg.presetId) {
      const [p] = await this.db.select().from(visualPresets).where(and(eq(visualPresets.id, cfg.presetId), eq(visualPresets.status, 'PUBLISHED')));
      if (!p) throw new Fatal('Preset gaya yang dipilih tidak lagi dipublikasikan');
      const [v] = await this.db.select().from(visualPresetVersions).where(and(eq(visualPresetVersions.presetId, p.id), eq(visualPresetVersions.version, p.currentVersion)));
      style = { ...DEFAULT_STYLE, ...(v!.recipe as object), typography: { ...DEFAULT_STYLE.typography, ...((v!.recipe as { typography?: object }).typography ?? {}) } } as typeof style;
      preset = { id: p.id, version: p.currentVersion, name: p.name };
    }
    const direction = await this.llm(ctx, 'motion_director', MotionOut, [{ type: 'text', text: `Naskah: ${JSON.stringify(script.scenes.map((s) => ({ teks: s.onScreenText, visual: s.visual })))}\nGaya: ${JSON.stringify(style)}\nTentukan layout, kata penekanan, efek dan transisi per scene (jumlah scene sama: ${script.scenes.length}).` }]);
    await this.event(run.id, 'agent.output', 'Arahan motion diterima, menyusun komposisi.', {}, 'motion_director', stageRunId);

    const fps = 30;
    const { width, height } = FORMAT_SIZE[cfg.format];
    const audio: MotionDocument['audio'] = [];
    const durations = script.scenes.map((s) => Math.round(s.durationSec * fps));
    // Narration
    if (cfg.voice.mode === 'TTS' && cfg.voice.voiceId) {
      const [pref] = await this.db.select().from(memberVoicePreferences).where(eq(memberVoicePreferences.userId, run.userId));
      const vcfg = { emotion: cfg.voice.emotion ?? pref?.emotion, speed: cfg.voice.speed ?? Number(pref?.speed ?? 1), pitch: cfg.voice.pitch ?? (pref?.pitch ? Number(pref.pitch) : null), instructions: cfg.voice.instructions ?? pref?.instructions };
      let at = 0;
      for (const [i, s] of script.scenes.entries()) {
        await this.checkCancel(ctx);
        const r = await this.voices.synthForMember(run.userId, cfg.voice.voiceId, s.narration, vcfg);
        if (!r.ok) throw new Error('TTS gagal');
        const asset = await this.media.ingestBuffer(run.userId, r.audio, `narasi-${run.id.slice(0, 8)}-${i + 1}.${r.ext}`, r.mime, { kind: 'narration', runId: run.id });
        const tmp = join(tmpdir(), `dw-a-${randomUUID()}.${r.ext}`);
        await writeFile(tmp, r.audio);
        const sec = await audioDuration(tmp, r.audio, s.narration);
        await rm(tmp, { force: true });
        durations[i] = Math.max(durations[i]!, Math.ceil((sec + 0.6) * fps));
        audio.push({ id: `n${i + 1}`, kind: 'narration', assetId: asset.id, startFrame: at, volume: 1 });
        at += durations[i]!;
        await this.progress(run.id, 'MOTION', 0.1 + 0.3 * ((i + 1) / script.scenes.length));
      }
      await this.event(run.id, 'agent.output', `Narasi TTS dibuat untuk ${script.scenes.length} scene.`, {}, 'motion_director', stageRunId);
    } else if (cfg.voice.mode === 'UPLOAD' && cfg.voice.uploadAssetId) {
      const m = await this.media.get(cfg.voice.uploadAssetId);
      if (!m || m.ownerId !== run.userId) throw new Fatal('Rekaman suara tidak ditemukan');
      const tmp = join(tmpdir(), `dw-u-${randomUUID()}`);
      await this.storage.download(m.objectKey, tmp);
      const sec = await audioDuration(tmp, null, script.scenes.map((s) => s.narration).join(' '));
      await rm(tmp, { force: true });
      const total = durations.reduce((a, b) => a + b, 0);
      const scale = (sec * fps + fps) / total;
      if (scale > 1) for (let i = 0; i < durations.length; i++) durations[i] = Math.ceil(durations[i]! * scale);
      audio.push({ id: 'rec', kind: 'narration', assetId: m.id, startFrame: 0, volume: 1 });
    }

    // Hook
    let hook: MotionDocument['hook'] = null;
    if (cfg.hook.mode !== 'NONE') {
      const [h] = cfg.hook.mode === 'PRESET' && cfg.hook.hookId
        ? await this.db.select().from(hookPresets).where(and(eq(hookPresets.id, cfg.hook.hookId), eq(hookPresets.status, 'PUBLISHED')))
        : await this.db.select().from(hookPresets).where(eq(hookPresets.status, 'PUBLISHED')).limit(1);
      if (h) {
        const [hv] = await this.db.select().from(hookVersions).where(and(eq(hookVersions.hookId, h.id), eq(hookVersions.version, h.currentVersion)));
        hook = { id: h.id, version: h.currentVersion, text: script.hook, recipe: hv!.recipe as Record<string, unknown> };
      } else if (cfg.hook.mode === 'AUTO') {
        await this.event(run.id, 'agent.info', 'Belum ada hook yang dipublikasikan; hook ditampilkan sebagai judul scene pertama.', {}, 'motion_director', stageRunId);
      }
    }

    const scenes = script.scenes.map((s, i) => {
      const d = direction.data.scenes[i] ?? { layout: 'title-center', emphasis: '', effect: 'rise', transition: style.motion.transition };
      const layers: Layer[] = [];
      const L = (x: Partial<Layer> & { type: Layer['type'] }) => layers.push({ id: `l${layers.length + 1}`, name: '', x: 0.5, y: 0.5, w: 0.9, h: 0.3, rotation: 0, scale: 1, opacity: 1, startFrame: 0, keyframes: {}, effect: d.effect, locked: false, hidden: false, ...x } as Layer);
      const text = i === 0 && !hook ? script.hook : s.onScreenText;
      if (d.layout === 'big-number' && /\d/.test(d.emphasis)) {
        L({ type: 'text', role: 'title', text: d.emphasis, y: 0.36, h: 0.22, fontSize: Math.min(width, height) * 0.22, effect: 'pop' } as never);
        L({ type: 'text', role: 'body', text, y: 0.62, h: 0.2, startFrame: 8 } as never);
      } else if (d.layout === 'quote') {
        L({ type: 'shape', shape: 'rect', x: 0.06, y: 0.5, w: 0.012, h: 0.3, effect: 'wipe' } as never);
        L({ type: 'text', role: 'title', text: `“${text}”`, x: 0.52, w: 0.84, h: 0.4 } as never);
      } else if (d.layout === 'title-top') {
        L({ type: 'text', role: 'label', text: d.emphasis || script.title, y: 0.12, h: 0.06 } as never);
        L({ type: 'text', role: 'title', text, y: 0.32, h: 0.3 } as never);
      } else {
        if (d.emphasis) L({ type: 'text', role: 'label', text: d.emphasis.toUpperCase(), y: 0.3, h: 0.06, effect: 'fade' } as never);
        L({ type: 'text', role: 'title', text, y: 0.48, h: 0.34 } as never);
        L({ type: 'shape', shape: 'rect', x: 0.2, y: 0.68, w: 0.3, h: 0.008, effect: 'wipe', startFrame: 6 } as never);
      }
      if (i === script.scenes.length - 1 && (script.cta || (brandRules as { cta?: string } | null)?.cta)) L({ type: 'text', role: 'caption', text: script.cta || (brandRules as { cta: string }).cta, y: 0.86, h: 0.08, startFrame: 12 } as never);
      return { id: `s${i + 1}`, name: `Scene ${i + 1}`, durationFrames: durations[i]!, background: d.background, transition: i === 0 ? 'cut' as const : d.transition, narration: s.narration, layers };
    });
    if (hook) {
      const hookFrames = Math.round(((hook.recipe as { durationSec?: number }).durationSec ?? 2) * fps);
      scenes[0]!.durationFrames += hookFrames;
      for (const l of scenes[0]!.layers) l.startFrame += hookFrames;
      for (const a of audio) a.startFrame += hookFrames;
    }
    const doc = MotionDocument.parse({ schemaVersion: 1, title: script.title, format: cfg.format, width, height, fps, preset, hook, style, scenes, audio });
    await this.progress(run.id, 'MOTION', 0.45);

    const project = await this.projects.create(run.userId, { name: script.title, format: cfg.format, document: doc });
    const job = await this.render.create(run.userId, { projectId: project.id, mode: 'CLOUD', format: 'mp4' });
    await this.db.update(productionRuns).set({ projectId: project.id, renderJobId: job.id }).where(eq(productionRuns.id, run.id));
    await this.event(run.id, 'render.queued', 'Komposisi Remotion dikirim ke antrean render cloud.', { renderJobId: job.id }, 'motion_director', stageRunId);
    const deadline = Date.now() + 45 * 60_000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 2500));
      const [j] = await this.db.select().from(renderJobs).where(eq(renderJobs.id, job.id));
      if (!j) throw new Error('Render job hilang');
      await this.progress(run.id, 'MOTION', 0.5 + 0.5 * (j.progress / 100));
      if (j.status === 'COMPLETED') break;
      if (j.status === 'FAILED' || j.status === 'CANCELLED') throw new Error(`Render ${j.status === 'FAILED' ? 'gagal' : 'dibatalkan'}. Lihat Render Center untuk detail.`);
      const [r] = await this.db.select({ status: productionRuns.status }).from(productionRuns).where(eq(productionRuns.id, run.id));
      if (r?.status === 'CANCELLING') {
        await this.render.cancel(null, job.id).catch(() => undefined);
        throw new Cancelled('Dibatalkan oleh pengguna');
      }
      if (Date.now() > deadline) throw new Error('Render melebihi batas waktu 45 menit (tidak ada worker atau worker kelebihan beban)');
    }
    const [out] = await this.db.select().from(renderOutputs).where(eq(renderOutputs.jobId, job.id));
    return { projectId: project.id, renderJobId: job.id, outputId: out!.id, objectKey: out!.objectKey, expectedSec: scenes.reduce((a, s) => a + s.durationFrames, 0) / fps, width, height, hasNarration: audio.length > 0, title: script.title };
  }

  private async qcStage(ctx: Ctx, stageRunId: string) {
    const m = ctx.outputs.MOTION as { objectKey: string; expectedSec: number; width: number; height: number; hasNarration: boolean };
    const script = ctx.outputs.SCRIPT as z.infer<typeof ScriptOut>;
    const dir = join(tmpdir(), 'dw-qc', randomUUID());
    await mkdir(dir, { recursive: true });
    const checks: { name: string; passed: boolean; note: string }[] = [];
    try {
      const file = await this.storage.download(m.objectKey, join(dir, 'out.mp4'));
      const info = await ffprobe(file);
      if (!info) checks.push({ name: 'Probe teknis', passed: true, note: 'ffprobe tidak tersedia di server; pemeriksaan teknis memakai metadata render.' });
      else {
        checks.push({ name: 'Resolusi', passed: info.width === m.width && info.height === m.height, note: `${info.width}×${info.height}` });
        checks.push({ name: 'Durasi', passed: Math.abs(info.durationSec - m.expectedSec) < 0.8, note: `${info.durationSec.toFixed(2)}s (diharapkan ${m.expectedSec.toFixed(2)}s)` });
        checks.push({ name: 'Codec video', passed: info.codec === 'h264', note: info.codec ?? '-' });
        checks.push({ name: 'Audio narasi', passed: !m.hasNarration || info.hasAudio, note: m.hasNarration ? (info.hasAudio ? 'ada' : 'hilang') : 'tanpa narasi' });
      }
      const llm = await this.llm(ctx, 'qc', QcOut, [{ type: 'text', text: `Periksa keterbacaan dan kesesuaian teks layar dengan narasi. Teks layar maksimal 12 kata per scene.\n${JSON.stringify(script.scenes.map((s) => ({ teks: s.onScreenText, narasi: s.narration })))}` }]);
      checks.push(...llm.data.checks.map((c) => ({ ...c, name: `Konten: ${c.name}` })));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    const technicalOk = checks.filter((c) => !c.name.startsWith('Konten:')).every((c) => c.passed);
    await this.db.insert(qcReports).values({ runId: ctx.run.id, checks, passed: technicalOk });
    await this.event(ctx.run.id, 'agent.output', `QC ${technicalOk ? 'lulus' : 'gagal'}: ${checks.filter((c) => c.passed).length}/${checks.length} pemeriksaan lulus.`, {}, 'qc', stageRunId);
    if (!technicalOk) throw new Error(`QC teknis gagal: ${checks.filter((c) => !c.passed && !c.name.startsWith('Konten:')).map((c) => `${c.name} (${c.note})`).join(', ')}`);
    return { checks, passed: technicalOk };
  }

  private async socialStage(ctx: Ctx, stageRunId: string, brandRules: unknown) {
    const { run, cfg } = ctx;
    const script = ctx.outputs.SCRIPT as z.infer<typeof ScriptOut>;
    const research = ctx.outputs.RESEARCH as { sources: { url: string; title: string }[] };
    const motion = ctx.outputs.MOTION as { outputId: string; objectKey: string; expectedSec: number; title: string };
    const fact = ctx.outputs.FACT_CHECK as { verdict?: object } | undefined;
    const r = await this.llm(ctx, 'social_media', SocialOut, [{ type: 'text', text: `Judul: ${script.title}\nNaskah: ${script.scenes.map((s) => s.narration).join(' ')}\nBrand: ${JSON.stringify(brandRules)}\nBuat caption Instagram/TikTok (maks 2200 karakter), 8–20 hashtag relevan, komentar pertama berisi daftar sumber singkat, dan teks cover maks 6 kata.` }]);
    const b = brandRules as { cta?: string; instagram?: string } | null;
    let caption = r.data.caption;
    if (b?.cta && !caption.includes(b.cta)) caption = `${caption}\n\n${b.cta}`;
    if (b?.instagram && !caption.includes(`@${b.instagram}`)) caption = `${caption}\n@${b.instagram}`;
    const hashtags = [...new Set(r.data.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)))];
    // Cover: a real frame from the rendered video.
    let coverId: string | null = null;
    const dir = join(tmpdir(), 'dw-cover', randomUUID());
    try {
      await mkdir(dir, { recursive: true });
      const file = await this.storage.download(motion.objectKey, join(dir, 'v.mp4'));
      const png = await extractFrame(file, join(dir, 'cover.png'), Math.min(motion.expectedSec * 0.3, 3));
      coverId = (await this.media.ingestFile(run.userId, png, `cover-${run.id.slice(0, 8)}.png`, { move: true, metadata: { kind: 'cover', runId: run.id } })).id;
    } catch (e) {
      await this.event(run.id, 'agent.warning', `Cover tidak dapat dibuat otomatis: ${(e as Error).message.slice(0, 200)}`, {}, 'social_media', stageRunId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    const parent = cfg.revisionOf ? (await this.db.select().from(videoResults).where(eq(videoResults.id, cfg.revisionOf.resultId)))[0] : undefined;
    const [res] = await this.db
      .insert(videoResults)
      .values({ userId: run.userId, runId: run.id, renderOutputId: motion.outputId, title: motion.title.slice(0, 255), status: 'READY', coverAssetId: coverId, revision: parent ? parent.revision + 1 : 1, parentResultId: parent?.id ?? null })
      .returning();
    await this.db.insert(socialMetadata).values({ resultId: res!.id, caption, hashtags, firstComment: r.data.firstComment, sourceRefs: { sources: research.sources, factCheck: fact?.verdict ?? null }, coverText: r.data.coverText });
    await this.db.update(productionRuns).set({ resultId: res!.id }).where(eq(productionRuns.id, run.id));
    await this.event(run.id, 'agent.output', 'Paket sosial media siap: caption, hashtag, komentar pertama, sumber, cover.', {}, 'social_media', stageRunId);
    return { resultId: res!.id, caption, hashtags, coverAssetId: coverId };
  }
}

