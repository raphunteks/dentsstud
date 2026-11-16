import { z } from 'zod';

/** Output contracts per agent. The engine appends the JSON contract to the (Superadmin-editable) system prompt. */
export const ResearchOut = z.object({
  topic: z.string().min(3).max(300),
  angle: z.string().max(500).default(''),
  summary: z.string().min(20).max(4000),
  keyFacts: z.array(z.object({ fact: z.string().min(5).max(600), sources: z.array(z.string()).max(10).default([]) })).min(2).max(20),
});
export const ScriptOut = z.object({
  title: z.string().min(3).max(120),
  hook: z.string().min(2).max(120),
  scenes: z
    .array(z.object({ narration: z.string().min(5).max(700), onScreenText: z.string().min(1).max(140), durationSec: z.number().min(2).max(30), visual: z.string().max(300).default('') }))
    .min(2)
    .max(14),
  cta: z.string().max(200).default(''),
});
export const FactOut = z.object({
  claims: z.array(z.object({ claim: z.string().min(3).max(600), status: z.enum(['VERIFIED', 'UNVERIFIED', 'CONTRADICTED']), sources: z.array(z.string()).max(10).default([]), note: z.string().max(600).default('') })).min(1).max(40),
  corrections: z.array(z.object({ scene: z.number().int().min(1), fix: z.string().max(600) })).max(20).default([]),
});
export const MotionOut = z.object({
  scenes: z
    .array(z.object({
      layout: z.enum(['title-center', 'title-top', 'split', 'list', 'quote', 'big-number']).default('title-center'),
      emphasis: z.string().max(60).default(''),
      effect: z.enum(['fade', 'rise', 'pop', 'wipe', 'typewriter', 'blur']).default('rise'),
      transition: z.enum(['cut', 'fade', 'slide', 'wipe', 'zoom']).default('fade'),
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .min(1),
});
export const QcOut = z.object({ checks: z.array(z.object({ name: z.string().max(80), passed: z.boolean(), note: z.string().max(400).default('') })).min(1).max(20) });
export const SocialOut = z.object({
  caption: z.string().min(20).max(2200),
  hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_]{2,40}$/u)).min(3).max(30),
  firstComment: z.string().max(500).default(''),
  coverText: z.string().min(2).max(80),
});

export const CONTRACT: Record<string, { schema: z.ZodType; shape: string }> = {
  research: { schema: ResearchOut, shape: '{"topic": string, "angle": string, "summary": string, "keyFacts": [{"fact": string, "sources": [url]}]}' },
  scriptwriter: { schema: ScriptOut, shape: '{"title": string, "hook": string (maks 8 kata), "scenes": [{"narration": string, "onScreenText": string (maks 12 kata), "durationSec": number, "visual": string}], "cta": string}' },
  fact_checker: { schema: FactOut, shape: '{"claims": [{"claim": string, "status": "VERIFIED"|"UNVERIFIED"|"CONTRADICTED", "sources": [url], "note": string}], "corrections": [{"scene": number, "fix": string}]}' },
  motion_director: { schema: MotionOut, shape: '{"scenes": [{"layout": "title-center"|"title-top"|"split"|"list"|"quote"|"big-number", "emphasis": string, "effect": "fade"|"rise"|"pop"|"wipe"|"typewriter"|"blur", "transition": "cut"|"fade"|"slide"|"wipe"|"zoom", "background"?: "#RRGGBB"}]}' },
  qc: { schema: QcOut, shape: '{"checks": [{"name": string, "passed": boolean, "note": string}]}' },
  social_media: { schema: SocialOut, shape: '{"caption": string, "hashtags": [string], "firstComment": string, "coverText": string}' },
};

/** Extracts the first JSON object from a model reply (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Balasan agent tidak berisi JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

export const STAGE_WEIGHTS: Record<string, [number, number]> = {
  RESEARCH: [0, 15], SCRIPT: [15, 30], FACT_CHECK: [30, 42], MOTION: [42, 85], QC: [85, 93], SOCIAL: [93, 100],
};
