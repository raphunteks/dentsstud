import { z } from 'zod';

/** Single source of truth for the preload allowlist and main-process validation. */
export const CHANNELS = {
  'app:info': z.void(),
  'config:set-api-base': z.object({ apiBase: z.url().refine((u) => u.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u), 'Harus HTTPS (atau localhost)') }),
  'auth:register': z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128), displayName: z.string().min(2).max(100) }),
  'auth:login': z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }),
  'auth:verify': z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/) }),
  'auth:resend': z.object({ challengeId: z.uuid() }),
  'auth:session': z.void(),
  'auth:logout': z.void(),
  'api:get': z.object({ path: z.string().regex(/^\/[A-Za-z0-9/_\-?=&.%]+$/).max(300) }),
  'api:mutate': z.object({
    method: z.enum(['POST', 'PATCH', 'PUT', 'DELETE']),
    path: z.string().regex(/^\/[A-Za-z0-9/_\-?=&.%]+$/).max(300),
    body: z.record(z.string(), z.unknown()).optional(),
  }),
  'license:activate': z.void(),
  'license:offline-status': z.void(),
  'claude:detect': z.void(),
  'claude:oauth-listen': z.void(),
  'claude:test': z.object({ prompt: z.string().min(1).max(2000) }),
  'render:local': z.object({ jobId: z.uuid() }),
  'render:cancel': z.object({ jobId: z.uuid() }),
  'render:capability': z.void(),
  'import:folder': z.object({ kind: z.enum(['preset', 'voice', 'hook']) }),
  'projects:cache': z.object({ projectId: z.uuid() }),
  'projects:local-list': z.void(),
  'projects:local-op': z.object({ projectId: z.uuid(), ops: z.array(z.record(z.string(), z.unknown())).min(1).max(100) }),
  'projects:sync': z.void(),
  'update:check': z.void(),
  'update:apply': z.void(),
  'update:state': z.void(),
  'telemetry:error': z.object({ message: z.string().min(1).max(2000), stack: z.string().max(8000).optional() }),
  'shell:open-external': z.object({ url: z.url().refine((u) => u.startsWith('https://'), 'Hanya HTTPS') }),
} as const;

export type Channel = keyof typeof CHANNELS;
export const CHANNEL_NAMES = Object.keys(CHANNELS) as Channel[];
