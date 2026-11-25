import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Database } from '@dentweb/database';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { Errors } from '../../infra/errors.js';
import {
  buildDentswebMotionSkillZip,
  SEED_EFFECTS,
  SEED_GLOSSARY,
  SEED_LESSONS,
  SEED_MODULES,
  SEED_PROMPTS,
  SEED_RECIPES,
  SEED_UPDATES,
} from './lms-seed.js';

interface ProgressState {
  completedLessonIds: string[];
  checklistState: Record<string, number[]>;
  favoritePromptIds: string[];
  promptsCopied: number;
  recentHistory: { lessonId: string; slug: string; title: string; at: string }[];
}

function emptyProgress(): ProgressState {
  return { completedLessonIds: [], checklistState: {}, favoritePromptIds: [], promptsCopied: 0, recentHistory: [] };
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

@Injectable()
export class LmsService implements OnModuleInit {
  private readonly log = new Logger('LMS');
  private readonly skillZip = buildDentswebMotionSkillZip();

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit() {
    if (this.env.NODE_ENV === 'test') return;
    try {
      await this.ensureSchemaAndSeed();
    } catch (err) {
      this.log.warn(`LMS init warning: ${(err as Error).message}`);
    }
  }

  async ensureSchemaAndSeed() {
    await this.db.$client.query(`
      CREATE TABLE IF NOT EXISTS lms_modules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text UNIQUE NOT NULL,
        title text NOT NULL,
        subtitle text NOT NULL DEFAULT '',
        badge text NOT NULL DEFAULT '',
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_lessons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id uuid NOT NULL REFERENCES lms_modules(id) ON DELETE CASCADE,
        slug text UNIQUE NOT NULL,
        title text NOT NULL,
        duration text NOT NULL DEFAULT '05:00',
        video_url text NOT NULL DEFAULT '',
        chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
        summary text NOT NULL DEFAULT '',
        checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
        lesson_prompt text NOT NULL DEFAULT '',
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_prompts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stage text NOT NULL,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        prompt_text text NOT NULL,
        tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_recipes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text NOT NULL,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        palette jsonb NOT NULL DEFAULT '[]'::jsonb,
        fonts text NOT NULL DEFAULT '',
        pacing text NOT NULL DEFAULT '',
        mode_cerita text NOT NULL DEFAULT '',
        prompt_template text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_glossary (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text NOT NULL,
        term text NOT NULL,
        definition text NOT NULL,
        example text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_effects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text NOT NULL,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        use_case text NOT NULL DEFAULT '',
        prompt_snippet text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_updates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version text NOT NULL,
        title text NOT NULL,
        released_at text NOT NULL DEFAULT '',
        highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lms_member_progress (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        completed_lesson_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
        favorite_prompt_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        prompts_copied int NOT NULL DEFAULT 0,
        recent_history jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const countOf = async (table: string) => {
      const r = await this.db.$client.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
      return Number((r.rows[0] as { c?: number } | undefined)?.c ?? 0);
    };

    if ((await countOf('lms_modules')) === 0) {
      const modMap = new Map<string, string>();
      for (const m of SEED_MODULES) {
        const res = await this.db.$client.query(
          `INSERT INTO lms_modules (slug, title, subtitle, badge, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [m.slug, m.title, m.subtitle, m.badge, m.sortOrder],
        );
        modMap.set(m.slug, String(res.rows[0]?.id));
      }
      for (const l of SEED_LESSONS) {
        const mid = modMap.get(l.moduleSlug);
        if (!mid) continue;
        await this.db.$client.query(
          `INSERT INTO lms_lessons (module_id, slug, title, duration, video_url, chapters, summary, checklist, lesson_prompt, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10)`,
          [mid, l.slug, l.title, l.duration, l.videoUrl, JSON.stringify(l.chapters), l.summary, JSON.stringify(l.checklist), l.lessonPrompt, l.sortOrder],
        );
      }
    }

    if ((await countOf('lms_prompts')) === 0) {
      for (const p of SEED_PROMPTS) {
        await this.db.$client.query(
          `INSERT INTO lms_prompts (stage, title, description, prompt_text, tags) VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [p.stage, p.title, p.description, p.promptText, JSON.stringify(p.tags)],
        );
      }
    }

    if ((await countOf('lms_recipes')) === 0) {
      for (const r of SEED_RECIPES) {
        await this.db.$client.query(
          `INSERT INTO lms_recipes (category, title, description, palette, fonts, pacing, mode_cerita, prompt_template)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)`,
          [r.category, r.title, r.description, JSON.stringify(r.palette), r.fonts, r.pacing, r.modeCerita, r.promptTemplate],
        );
      }
    }

    if ((await countOf('lms_glossary')) === 0) {
      for (const g of SEED_GLOSSARY) {
        await this.db.$client.query(
          `INSERT INTO lms_glossary (category, term, definition, example) VALUES ($1,$2,$3,$4)`,
          [g.category, g.term, g.definition, g.example],
        );
      }
    }

    if ((await countOf('lms_effects')) === 0) {
      for (const e of SEED_EFFECTS) {
        await this.db.$client.query(
          `INSERT INTO lms_effects (category, name, description, use_case, prompt_snippet) VALUES ($1,$2,$3,$4,$5)`,
          [e.category, e.name, e.description, e.useCase, e.promptSnippet],
        );
      }
    }

    if ((await countOf('lms_updates')) === 0) {
      for (const u of SEED_UPDATES) {
        await this.db.$client.query(
          `INSERT INTO lms_updates (version, title, released_at, highlights) VALUES ($1,$2,$3,$4::jsonb)`,
          [u.version, u.title, u.releasedAt, JSON.stringify(u.highlights)],
        );
      }
    }
  }

  private async getProgress(userId: string): Promise<ProgressState> {
    const { rows } = await this.db.$client.query(`SELECT * FROM lms_member_progress WHERE user_id = $1`, [userId]);
    if (!rows.length) return emptyProgress();
    const r = rows[0] as Record<string, unknown>;
    return {
      completedLessonIds: parseJson<string[]>(r.completed_lesson_ids, []),
      checklistState: parseJson<Record<string, number[]>>(r.checklist_state, {}),
      favoritePromptIds: parseJson<string[]>(r.favorite_prompt_ids, []),
      promptsCopied: Number(r.prompts_copied ?? 0),
      recentHistory: parseJson<ProgressState['recentHistory']>(r.recent_history, []),
    };
  }

  private async saveProgress(userId: string, state: ProgressState) {
    await this.db.$client.query(
      `INSERT INTO lms_member_progress (user_id, completed_lesson_ids, checklist_state, favorite_prompt_ids, prompts_copied, recent_history, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         completed_lesson_ids = EXCLUDED.completed_lesson_ids,
         checklist_state = EXCLUDED.checklist_state,
         favorite_prompt_ids = EXCLUDED.favorite_prompt_ids,
         prompts_copied = EXCLUDED.prompts_copied,
         recent_history = EXCLUDED.recent_history,
         updated_at = now()`,
      [
        userId,
        JSON.stringify(state.completedLessonIds),
        JSON.stringify(state.checklistState),
        JSON.stringify(state.favoritePromptIds),
        state.promptsCopied,
        JSON.stringify(state.recentHistory.slice(0, 12)),
      ],
    );
  }

  async listModules(userId: string) {
    const [modRes, lesRes, prog] = await Promise.all([
      this.db.$client.query(`SELECT * FROM lms_modules ORDER BY sort_order ASC, created_at ASC`),
      this.db.$client.query(`SELECT * FROM lms_lessons ORDER BY sort_order ASC, created_at ASC`),
      this.getProgress(userId),
    ]);
    const completedSet = new Set(prog.completedLessonIds);
    type LessonRowDto = {
      id: string;
      moduleId: string;
      slug: string;
      title: string;
      duration: string;
      videoUrl: string;
      summary: string;
      checklistCount: number;
      checkedCount: number;
      completed: boolean;
      sortOrder: number;
    };
    const lessonsByMod = new Map<string, LessonRowDto[]>();
    for (const row of lesRes.rows) {
      const r = row as Record<string, unknown>;
      const mid = String(r.module_id);
      const list = lessonsByMod.get(mid) ?? [];
      const checklist = parseJson<string[]>(r.checklist, []);
      const checkedItems = prog.checklistState[String(r.id)] ?? [];
      list.push({
        id: String(r.id),
        moduleId: mid,
        slug: String(r.slug),
        title: String(r.title),
        duration: String(r.duration),
        videoUrl: String(r.video_url ?? ''),
        summary: String(r.summary ?? ''),
        checklistCount: checklist.length,
        checkedCount: checkedItems.length,
        completed: completedSet.has(String(r.id)),
        sortOrder: Number(r.sort_order ?? 0),
      });
      lessonsByMod.set(mid, list);
    }
    const items = modRes.rows.map((row) => {
      const r = row as Record<string, unknown>;
      const id = String(r.id);
      const lessons = lessonsByMod.get(id) ?? [];
      const completedCount = lessons.filter((l) => Boolean(l.completed)).length;
      return {
        id,
        slug: String(r.slug),
        title: String(r.title),
        subtitle: String(r.subtitle ?? ''),
        badge: String(r.badge ?? ''),
        sortOrder: Number(r.sort_order ?? 0),
        lessons,
        completedCount,
        totalLessons: lessons.length,
        completed: lessons.length > 0 && completedCount === lessons.length,
      };
    });
    return { items };
  }

  async overview(userId: string) {
    const [{ items: modules }, prog, updRes, glosRes] = await Promise.all([
      this.listModules(userId),
      this.getProgress(userId),
      this.db.$client.query(`SELECT * FROM lms_updates ORDER BY released_at DESC, created_at DESC LIMIT 1`),
      this.db.$client.query(`SELECT * FROM lms_glossary ORDER BY created_at ASC`),
    ]);
    const flatLessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
    const totalLessons = flatLessons.length;
    const completedLessons = flatLessons.filter((l) => Boolean(l.completed)).length;
    const checklistTotal = flatLessons.reduce((acc, l) => acc + Number(l.checklistCount ?? 0), 0);
    const checklistDone = flatLessons.reduce((acc, l) => acc + Number(l.checkedCount ?? 0), 0);
    const completedModules = modules.filter((m) => m.completed).length;
    const nextLesson = flatLessons.find((l) => !l.completed) ?? flatLessons[0] ?? null;

    const latestUpdateRow = updRes.rows[0] as Record<string, unknown> | undefined;
    const latestUpdate = latestUpdateRow
      ? {
          id: String(latestUpdateRow.id),
          version: String(latestUpdateRow.version),
          title: String(latestUpdateRow.title),
          releasedAt: String(latestUpdateRow.released_at ?? ''),
          highlights: parseJson<string[]>(latestUpdateRow.highlights, []),
        }
      : null;

    const glossaryRows = glosRes.rows as Record<string, unknown>[];
    const dayIndex = Math.floor(Date.now() / 86_400_000) % Math.max(1, glossaryRows.length);
    const termRow = glossaryRows[dayIndex];
    const termOfDay = termRow
      ? {
          id: String(termRow.id),
          category: String(termRow.category),
          term: String(termRow.term),
          definition: String(termRow.definition),
          example: String(termRow.example ?? ''),
        }
      : null;

    return {
      stats: {
        completedLessons,
        totalLessons,
        percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
        completedModules,
        totalModules: modules.length,
        checklistDone,
        checklistTotal,
        promptsCopied: prog.promptsCopied,
        favoritePromptsCount: prog.favoritePromptIds.length,
      },
      nextLesson,
      modules,
      recentHistory: prog.recentHistory,
      latestUpdate,
      termOfDay,
    };
  }

  async getLessonBySlug(userId: string, slug: string) {
    const [allRes, prog] = await Promise.all([
      this.db.$client.query(
        `SELECT l.*, m.title AS module_title, m.slug AS module_slug, m.sort_order AS mod_sort
         FROM lms_lessons l
         JOIN lms_modules m ON m.id = l.module_id
         ORDER BY m.sort_order ASC, l.sort_order ASC, l.created_at ASC`,
      ),
      this.getProgress(userId),
    ]);
    const rows = allRes.rows as Record<string, unknown>[];
    const idx = rows.findIndex((r) => String(r.slug) === slug);
    if (idx < 0) throw Errors.notFound('Materi kelas');
    const r = rows[idx]!;
    const id = String(r.id);
    const prev = idx > 0 ? { slug: String(rows[idx - 1]!.slug), title: String(rows[idx - 1]!.title) } : null;
    const next = idx < rows.length - 1 ? { slug: String(rows[idx + 1]!.slug), title: String(rows[idx + 1]!.title) } : null;

    // Record recent history asynchronously
    const nextHistory = [
      { lessonId: id, slug, title: String(r.title), at: new Date().toISOString() },
      ...prog.recentHistory.filter((h) => h.lessonId !== id),
    ].slice(0, 10);
    await this.saveProgress(userId, { ...prog, recentHistory: nextHistory }).catch(() => undefined);

    return {
      id,
      moduleId: String(r.module_id),
      moduleTitle: String(r.module_title),
      moduleSlug: String(r.module_slug),
      slug,
      title: String(r.title),
      duration: String(r.duration),
      videoUrl: String(r.video_url ?? ''),
      chapters: parseJson<{ time: string; label: string }[]>(r.chapters, []),
      summary: String(r.summary ?? ''),
      checklist: parseJson<string[]>(r.checklist, []),
      lessonPrompt: String(r.lesson_prompt ?? ''),
      completed: prog.completedLessonIds.includes(id),
      checkedItems: prog.checklistState[id] ?? [],
      prevLesson: prev,
      nextLesson: next,
    };
  }

  async setLessonComplete(userId: string, lessonId: string, completed: boolean) {
    const prog = await this.getProgress(userId);
    const set = new Set(prog.completedLessonIds);
    if (completed) set.add(lessonId);
    else set.delete(lessonId);
    prog.completedLessonIds = Array.from(set);
    await this.saveProgress(userId, prog);
    return { ok: true, completed };
  }

  async setChecklistItem(userId: string, lessonId: string, index: number, checked: boolean) {
    const prog = await this.getProgress(userId);
    const set = new Set(prog.checklistState[lessonId] ?? []);
    if (checked) set.add(index);
    else set.delete(index);
    prog.checklistState[lessonId] = Array.from(set).sort((a, b) => a - b);
    await this.saveProgress(userId, prog);
    return { ok: true, checkedItems: prog.checklistState[lessonId] };
  }

  async listPrompts(userId: string, filter?: { stage?: string; q?: string; fav?: string }) {
    const [res, prog] = await Promise.all([
      this.db.$client.query(`SELECT * FROM lms_prompts ORDER BY created_at ASC`),
      this.getProgress(userId),
    ]);
    const favSet = new Set(prog.favoritePromptIds);
    const all = (res.rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      stage: String(r.stage),
      title: String(r.title),
      description: String(r.description ?? ''),
      promptText: String(r.prompt_text),
      tags: parseJson<string[]>(r.tags, []),
      isFavorite: favSet.has(String(r.id)),
    }));
    const stages = Array.from(new Set(all.map((p) => p.stage)));
    const qLower = filter?.q?.trim().toLowerCase() ?? '';
    const items = all.filter((p) => {
      if (filter?.stage && p.stage !== filter.stage) return false;
      if (filter?.fav === '1' && !p.isFavorite) return false;
      if (qLower && !`${p.title} ${p.description} ${p.promptText} ${p.tags.join(' ')}`.toLowerCase().includes(qLower)) return false;
      return true;
    });
    return { items, stages };
  }

  async togglePromptFavorite(userId: string, promptId: string) {
    const prog = await this.getProgress(userId);
    const set = new Set(prog.favoritePromptIds);
    const isFavorite = !set.has(promptId);
    if (isFavorite) set.add(promptId);
    else set.delete(promptId);
    prog.favoritePromptIds = Array.from(set);
    await this.saveProgress(userId, prog);
    return { ok: true, isFavorite };
  }

  async recordPromptCopy(userId: string, _promptId: string) {
    const prog = await this.getProgress(userId);
    prog.promptsCopied = (prog.promptsCopied ?? 0) + 1;
    await this.saveProgress(userId, prog);
    return { ok: true, promptsCopied: prog.promptsCopied };
  }

  async listRecipes(filter?: { q?: string; category?: string }) {
    const { rows } = await this.db.$client.query(`SELECT * FROM lms_recipes ORDER BY created_at ASC`);
    const all = (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      category: String(r.category),
      title: String(r.title),
      description: String(r.description ?? ''),
      palette: parseJson<string[]>(r.palette, []),
      fonts: String(r.fonts ?? ''),
      pacing: String(r.pacing ?? ''),
      modeCerita: String(r.mode_cerita ?? ''),
      promptTemplate: String(r.prompt_template ?? ''),
    }));
    const categories = Array.from(new Set(all.map((x) => x.category)));
    const qLower = filter?.q?.trim().toLowerCase() ?? '';
    const items = all.filter((x) => {
      if (filter?.category && x.category !== filter.category) return false;
      if (qLower && !`${x.title} ${x.description} ${x.modeCerita} ${x.fonts}`.toLowerCase().includes(qLower)) return false;
      return true;
    });
    return { items, categories };
  }

  async listGlossary(filter?: { q?: string; category?: string }) {
    const { rows } = await this.db.$client.query(`SELECT * FROM lms_glossary ORDER BY category ASC, term ASC`);
    const all = (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      category: String(r.category),
      term: String(r.term),
      definition: String(r.definition),
      example: String(r.example ?? ''),
    }));
    const categories = Array.from(new Set(all.map((x) => x.category)));
    const qLower = filter?.q?.trim().toLowerCase() ?? '';
    const items = all.filter((x) => {
      if (filter?.category && x.category !== filter.category) return false;
      if (qLower && !`${x.term} ${x.definition} ${x.example}`.toLowerCase().includes(qLower)) return false;
      return true;
    });
    return { items, categories };
  }

  async listEffects(filter?: { q?: string; category?: string }) {
    const { rows } = await this.db.$client.query(`SELECT * FROM lms_effects ORDER BY category ASC, name ASC`);
    const all = (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      category: String(r.category),
      name: String(r.name),
      description: String(r.description ?? ''),
      useCase: String(r.use_case ?? ''),
      promptSnippet: String(r.prompt_snippet ?? ''),
    }));
    const categories = Array.from(new Set(all.map((x) => x.category)));
    const qLower = filter?.q?.trim().toLowerCase() ?? '';
    const items = all.filter((x) => {
      if (filter?.category && x.category !== filter.category) return false;
      if (qLower && !`${x.name} ${x.description} ${x.useCase} ${x.promptSnippet}`.toLowerCase().includes(qLower)) return false;
      return true;
    });
    return { items, categories };
  }

  async listUpdates() {
    const { rows } = await this.db.$client.query(`SELECT * FROM lms_updates ORDER BY released_at DESC, created_at DESC`);
    return {
      items: (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        version: String(r.version),
        title: String(r.title),
        releasedAt: String(r.released_at ?? ''),
        highlights: parseJson<string[]>(r.highlights, []),
      })),
    };
  }

  getSkillDownloadInfo() {
    return {
      filename: 'dentsweb-motion-v2.3.0.zip',
      version: '2.3.0',
      sizeBytes: this.skillZip.length,
      downloadUrl: '/api/v1/lms/skill-download/file',
      contents: ['dentsweb-motion/SKILL.md', 'dentsweb-motion/README.md', 'dentsweb-motion/presets.json'],
    };
  }

  getSkillZipBuffer() {
    return this.skillZip;
  }

  async resetProgress(userId: string) {
    await this.saveProgress(userId, emptyProgress());
    return { ok: true };
  }

  // ---- Superadmin Analytics & CRUD ----
  async adminAnalytics() {
    const [lesCountRes, usersRes] = await Promise.all([
      this.db.$client.query(`SELECT COUNT(*)::int AS c FROM lms_lessons`),
      this.db.$client.query(
        `SELECT u.id AS user_id, u.display_name, u.email,
                p.completed_lesson_ids, p.checklist_state, p.prompts_copied, p.updated_at
         FROM users u
         LEFT JOIN lms_member_progress p ON p.user_id = u.id
         ORDER BY p.updated_at DESC NULLS LAST, u.created_at DESC
         LIMIT 200`,
      ),
    ]);
    const totalLessons = Number((lesCountRes.rows[0] as { c?: number } | undefined)?.c ?? 0);
    const items = (usersRes.rows as Record<string, unknown>[]).map((r) => {
      const comp = parseJson<string[]>(r.completed_lesson_ids, []);
      const chk = parseJson<Record<string, number[]>>(r.checklist_state, {});
      const checklistDone = Object.values(chk).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
      return {
        userId: String(r.user_id),
        displayName: String(r.display_name ?? ''),
        email: String(r.email ?? ''),
        completedLessons: comp.length,
        totalLessons,
        percent: totalLessons ? Math.round((comp.length / totalLessons) * 100) : 0,
        checklistDone,
        promptsCopied: Number(r.prompts_copied ?? 0),
        updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : null,
      };
    });
    return { items, totalLessons };
  }

  async createModule(b: { slug: string; title: string; subtitle?: string; badge?: string; sortOrder?: number }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_modules (slug, title, subtitle, badge, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.slug, b.title, b.subtitle ?? '', b.badge ?? '', b.sortOrder ?? 0],
    );
    return { module: rows[0] };
  }
  async updateModule(id: string, b: { slug?: string; title?: string; subtitle?: string; badge?: string; sortOrder?: number }) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_modules SET slug = COALESCE($1, slug), title = COALESCE($2, title), subtitle = COALESCE($3, subtitle),
       badge = COALESCE($4, badge), sort_order = COALESCE($5, sort_order) WHERE id = $6 RETURNING *`,
      [b.slug ?? null, b.title ?? null, b.subtitle ?? null, b.badge ?? null, b.sortOrder ?? null, id],
    );
    if (!rows.length) throw Errors.notFound('Modul LMS');
    return { module: rows[0] };
  }
  async deleteModule(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_modules WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Modul LMS');
    return { ok: true };
  }

  async createLesson(b: {
    moduleId: string; slug: string; title: string; duration?: string; videoUrl?: string;
    chapters?: { time: string; label: string }[]; summary?: string; checklist?: string[]; lessonPrompt?: string; sortOrder?: number;
  }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_lessons (module_id, slug, title, duration, video_url, chapters, summary, checklist, lesson_prompt, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10) RETURNING *`,
      [
        b.moduleId, b.slug, b.title, b.duration ?? '05:00', b.videoUrl ?? '',
        JSON.stringify(b.chapters ?? []), b.summary ?? '', JSON.stringify(b.checklist ?? []), b.lessonPrompt ?? '', b.sortOrder ?? 0,
      ],
    );
    return { lesson: rows[0] };
  }
  async updateLesson(id: string, b: Record<string, unknown>) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_lessons SET
         module_id = COALESCE($1, module_id), slug = COALESCE($2, slug), title = COALESCE($3, title),
         duration = COALESCE($4, duration), video_url = COALESCE($5, video_url),
         chapters = COALESCE($6::jsonb, chapters), summary = COALESCE($7, summary),
         checklist = COALESCE($8::jsonb, checklist), lesson_prompt = COALESCE($9, lesson_prompt),
         sort_order = COALESCE($10, sort_order)
       WHERE id = $11 RETURNING *`,
      [
        b.moduleId ?? null, b.slug ?? null, b.title ?? null, b.duration ?? null, b.videoUrl ?? null,
        b.chapters ? JSON.stringify(b.chapters) : null, b.summary ?? null,
        b.checklist ? JSON.stringify(b.checklist) : null, b.lessonPrompt ?? null, b.sortOrder ?? null, id,
      ],
    );
    if (!rows.length) throw Errors.notFound('Lesson LMS');
    return { lesson: rows[0] };
  }
  async deleteLesson(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_lessons WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Lesson LMS');
    return { ok: true };
  }

  async createPrompt(b: { stage: string; title: string; description?: string; promptText: string; tags?: string[] }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_prompts (stage, title, description, prompt_text, tags) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [b.stage, b.title, b.description ?? '', b.promptText, JSON.stringify(b.tags ?? [])],
    );
    return { prompt: rows[0] };
  }
  async updatePrompt(id: string, b: { stage?: string; title?: string; description?: string; promptText?: string; tags?: string[] }) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_prompts SET stage = COALESCE($1, stage), title = COALESCE($2, title), description = COALESCE($3, description),
       prompt_text = COALESCE($4, prompt_text), tags = COALESCE($5::jsonb, tags) WHERE id = $6 RETURNING *`,
      [b.stage ?? null, b.title ?? null, b.description ?? null, b.promptText ?? null, b.tags ? JSON.stringify(b.tags) : null, id],
    );
    if (!rows.length) throw Errors.notFound('Prompt LMS');
    return { prompt: rows[0] };
  }
  async deletePrompt(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_prompts WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Prompt LMS');
    return { ok: true };
  }

  async createRecipe(b: { category: string; title: string; description?: string; palette?: string[]; fonts?: string; pacing?: string; modeCerita?: string; promptTemplate?: string }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_recipes (category, title, description, palette, fonts, pacing, mode_cerita, prompt_template)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING *`,
      [b.category, b.title, b.description ?? '', JSON.stringify(b.palette ?? []), b.fonts ?? '', b.pacing ?? '', b.modeCerita ?? '', b.promptTemplate ?? ''],
    );
    return { recipe: rows[0] };
  }
  async updateRecipe(id: string, b: Record<string, unknown>) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_recipes SET category = COALESCE($1, category), title = COALESCE($2, title), description = COALESCE($3, description),
       palette = COALESCE($4::jsonb, palette), fonts = COALESCE($5, fonts), pacing = COALESCE($6, pacing),
       mode_cerita = COALESCE($7, mode_cerita), prompt_template = COALESCE($8, prompt_template) WHERE id = $9 RETURNING *`,
      [b.category ?? null, b.title ?? null, b.description ?? null, b.palette ? JSON.stringify(b.palette) : null, b.fonts ?? null, b.pacing ?? null, b.modeCerita ?? null, b.promptTemplate ?? null, id],
    );
    if (!rows.length) throw Errors.notFound('Resep Gaya');
    return { recipe: rows[0] };
  }
  async deleteRecipe(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_recipes WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Resep Gaya');
    return { ok: true };
  }

  async createGlossary(b: { category: string; term: string; definition: string; example?: string }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_glossary (category, term, definition, example) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.category, b.term, b.definition, b.example ?? ''],
    );
    return { glossary: rows[0] };
  }
  async updateGlossary(id: string, b: { category?: string; term?: string; definition?: string; example?: string }) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_glossary SET category = COALESCE($1, category), term = COALESCE($2, term), definition = COALESCE($3, definition),
       example = COALESCE($4, example) WHERE id = $5 RETURNING *`,
      [b.category ?? null, b.term ?? null, b.definition ?? null, b.example ?? null, id],
    );
    if (!rows.length) throw Errors.notFound('Istilah Kamus');
    return { glossary: rows[0] };
  }
  async deleteGlossary(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_glossary WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Istilah Kamus');
    return { ok: true };
  }

  async createEffect(b: { category: string; name: string; description?: string; useCase?: string; promptSnippet?: string }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_effects (category, name, description, use_case, prompt_snippet) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.category, b.name, b.description ?? '', b.useCase ?? '', b.promptSnippet ?? ''],
    );
    return { effect: rows[0] };
  }
  async updateEffect(id: string, b: { category?: string; name?: string; description?: string; useCase?: string; promptSnippet?: string }) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_effects SET category = COALESCE($1, category), name = COALESCE($2, name), description = COALESCE($3, description),
       use_case = COALESCE($4, use_case), prompt_snippet = COALESCE($5, prompt_snippet) WHERE id = $6 RETURNING *`,
      [b.category ?? null, b.name ?? null, b.description ?? null, b.useCase ?? null, b.promptSnippet ?? null, id],
    );
    if (!rows.length) throw Errors.notFound('Efek Video');
    return { effect: rows[0] };
  }
  async deleteEffect(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_effects WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Efek Video');
    return { ok: true };
  }

  async createUpdate(b: { version: string; title: string; releasedAt?: string; highlights?: string[] }) {
    const { rows } = await this.db.$client.query(
      `INSERT INTO lms_updates (version, title, released_at, highlights) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
      [b.version, b.title, b.releasedAt ?? new Date().toISOString().slice(0, 10), JSON.stringify(b.highlights ?? [])],
    );
    return { update: rows[0] };
  }
  async updateUpdate(id: string, b: { version?: string; title?: string; releasedAt?: string; highlights?: string[] }) {
    const { rows } = await this.db.$client.query(
      `UPDATE lms_updates SET version = COALESCE($1, version), title = COALESCE($2, title),
       released_at = COALESCE($3, released_at), highlights = COALESCE($4::jsonb, highlights) WHERE id = $5 RETURNING *`,
      [b.version ?? null, b.title ?? null, b.releasedAt ?? null, b.highlights ? JSON.stringify(b.highlights) : null, id],
    );
    if (!rows.length) throw Errors.notFound('Log Update');
    return { update: rows[0] };
  }
  async deleteUpdate(id: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM lms_updates WHERE id = $1`, [id]);
    if (!rowCount) throw Errors.notFound('Log Update');
    return { ok: true };
  }
}
