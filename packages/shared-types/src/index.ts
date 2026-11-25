import { z } from 'zod';

/** Only two human roles exist. AI agents are never an RBAC role. */
export const ROLES = ['SUPERADMIN', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LICENSE_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Honest connection states — never report CONNECTED without a verified call. */
export const AI_CONNECTION_STATUSES = ['NOT_CONFIGURED', 'CONNECTED', 'INVALID', 'UNAVAILABLE', 'UNSUPPORTED'] as const;
export type AiConnectionStatus = (typeof AI_CONNECTION_STATUSES)[number];

export const PRODUCTION_STAGES = ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'MOTION', 'QC', 'SOCIAL'] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PLATFORMS = ['web', 'darwin', 'win32', 'linux'] as const;

// ---------- Request contracts (shared by API, web and desktop) ----------
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z
  .string()
  .min(10, 'Password minimal 10 karakter')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password harus memuat huruf dan angka');

export const RegisterInput = z.object({
  email,
  password,
  displayName: z.string().trim().min(2).max(120),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({ email, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof LoginInput>;

export const OtpVerifyInput = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, 'Kode OTP 6 digit'),
  client: z.enum(['web', 'desktop']).default('web'),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifyInput>;

export const OtpResendInput = z.object({ challengeId: z.uuid() });

export const UpdateMeInput = z.object({ displayName: z.string().trim().min(2).max(120) });

export const DeviceActivateInput = z.object({
  installationId: z.string().min(16).max(256),
  platform: z.enum(['darwin', 'win32', 'linux']),
  architecture: z.string().min(2).max(20),
  label: z.string().trim().min(1).max(120),
});
export type DeviceActivateInput = z.infer<typeof DeviceActivateInput>;

export const LicenseGrantInput = z.object({
  userId: z.uuid(),
  maxDevices: z.number().int().min(1).max(20).default(2),
  validUntil: z.iso.datetime().nullable().optional(),
  entitlements: z
    .object({
      maxWorkers: z.number().int().min(1).max(16).default(2),
      maxVideosPerDay: z.number().int().min(0).max(500).default(10),
      cloudRender: z.boolean().default(true),
      cloudRenderMinutesPerMonth: z.number().int().min(0).default(120),
    })
    .default({ maxWorkers: 2, maxVideosPerDay: 10, cloudRender: true, cloudRenderMinutesPerMonth: 120 }),
});
export type LicenseGrantInput = z.infer<typeof LicenseGrantInput>;

export const MemberStatusInput = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
  reason: z.string().max(500).optional(),
});

export const AI_PROVIDERS = ['anthropic', 'gemini', 'openai', 'openrouter', 'custom_gateway'] as const;
export type AiProviderCode = (typeof AI_PROVIDERS)[number];

const aiConnMeta = {
  label: z.string().trim().max(80).optional(),
  priority: z.number().int().min(1).max(99).optional(),
};

export const AiConnectionStartInput = z.discriminatedUnion('method', [
  z.object({
    provider: z.enum(AI_PROVIDERS).default('anthropic'),
    method: z.literal('API_KEY'),
    apiKey: z.string().min(8).max(500),
    baseUrl: z.url().optional(),
    ...aiConnMeta,
  }),
  z.object({
    provider: z.enum(AI_PROVIDERS).default('custom_gateway'),
    method: z.literal('GATEWAY_KEY'),
    apiKey: z.string().min(4).max(500),
    baseUrl: z.url(),
    ...aiConnMeta,
  }),
  z.object({
    provider: z.string().min(2).max(60).default('anthropic'),
    method: z.literal('OAUTH_PKCE'),
    redirectUri: z.url().optional(),
    ...aiConnMeta,
  }),
  z.object({
    provider: z.literal('anthropic').default('anthropic'),
    method: z.literal('CLAUDE_CODE_LOCAL'),
    version: z.string().min(1).max(80),
    authenticated: z.boolean(),
    ...aiConnMeta,
  }),
]);
export type AiConnectionStartInput = z.infer<typeof AiConnectionStartInput>;

export const AiConnectionPatchInput = z.object({
  priority: z.number().int().min(1).max(99).optional(),
  active: z.boolean().optional(),
  label: z.string().trim().max(80).optional(),
  defaultModel: z.string().min(2).max(160).optional(),
  resetCooldown: z.boolean().optional(),
});
export type AiConnectionPatchInput = z.infer<typeof AiConnectionPatchInput>;

export const AiTestInput = z.object({ prompt: z.string().min(1).max(2000).default('Jawab singkat: apa ibu kota Indonesia?') });

export const SettingPatchInput = z.object({ value: z.unknown() });

export const PageQuery = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().max(200).optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
}
