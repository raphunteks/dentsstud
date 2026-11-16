import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    /** Public origin of the web app (Vercel). Used for CORS + links in email. */
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    /** Extra comma separated origins (desktop app:// scheme etc.). */
    CORS_EXTRA_ORIGINS: z.string().default('app://dentweb'),
    COOKIE_SECURE: bool.optional(),
    /** 32-byte base64 key for AES-256-GCM secret vault. */
    SECRETS_MASTER_KEY: z.string().min(40),
    /** Ed25519 PKCS8 PEM (base64-encoded) for offline license proofs. */
    LICENSE_SIGNING_KEY: z.string().min(40),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(465),
    SMTP_SECURE: bool.default(true),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    ANTHROPIC_API_BASE: z.string().url().default('https://api.anthropic.com'),
    TRUST_PROXY: bool.default(true),
    /** JSON array of OAuth providers registered to DENTSWEB (generic PKCE). */
    OAUTH_PROVIDERS_JSON: z.string().optional(),
    /** Object storage: local disk (dev / single VPS) or any S3-compatible bucket. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_DIR: z.string().default('./.data/storage'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default(true),
    UPLOAD_MAX_BYTES: z.coerce.number().int().default(524_288_000),
    GEMINI_API_BASE: z.string().url().default('https://generativelanguage.googleapis.com'),
    GEMINI_TTS_MODEL: z.string().default('gemini-3.8-flash-tts'),
    ELEVENLABS_API_BASE: z.string().url().default('https://api.elevenlabs.io'),
    ELEVENLABS_MODEL: z.string().default('eleven_multilingual_v2'),
    /** Shared secret for render/production workers calling /internal (min 32 chars). */
    WORKER_TOKEN: z.string().min(32).optional(),
    /** Public origin the workers use to download signed files (API base, e.g. https://api.example.com). */
    PUBLIC_API_ORIGIN: z.string().url().default('http://localhost:4000'),
    /** Run the multi-agent production + scheduler consumers in this process (set false on API-only replicas). */
    /** BullMQ key prefix; isolates environments sharing one Redis (render workers must use the same value). */
    QUEUE_PREFIX: z.string().regex(/^[\w-]{1,40}$/).default('dentweb'),
    /** Bearer token for GET /api/v1/metrics (Prometheus). Unset = endpoint disabled. */
    METRICS_TOKEN: z.string().min(24).optional(),
    PRODUCTION_WORKER: bool.default(true),
    PRODUCTION_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
    SCHEDULER_ENABLED: bool.default(true),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && !(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS && e.MAIL_FROM)) {
      ctx.addIssue({ code: 'custom', message: 'SMTP_HOST, SMTP_USER, SMTP_PASS dan MAIL_FROM wajib di production (OTP login).' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
export const resetEnvCache = () => (cached = undefined);
