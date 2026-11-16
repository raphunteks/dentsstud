import type { ReactNode } from 'react';

export interface Info {
  version: string;
  platform: string;
  arch: string;
  apiBase: string;
  secureStorage: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'SUPERADMIN' | 'MEMBER' | string;
}

export interface DashStats {
  readyToUpload: number;
  inProduction: number;
  uploaded: number;
  failed: number;
}

export interface Dash {
  stats: DashStats;
  activeRuns: { id: string; status: string; currentStage: string | null; progress: number; topic: string | null }[];
  catalog: { publishedPresets: number; publishedVoices: number; publishedHooks: number };
  ai: { status: string; method: string | null };
  license: {
    status: string;
    activeDevices: number;
    entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean };
  };
}

export interface OfflineStatus {
  valid: boolean;
  until?: string;
  reason?: string;
  entitlements?: Record<string, unknown>;
}

export interface StyleCategory {
  id: string;
  slug: string;
  name: string;
  presetCount: number;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  category: { name: string; slug?: string };
}

export interface VoiceItem {
  id: string;
  name: string;
  provider: string;
  language: string;
  description?: string;
  voiceAttributes: { gender?: string; tone?: string };
  sampleUrl: string | null;
}

export interface HookItem {
  id: string;
  name: string;
}

export interface ResultItem {
  kind: 'result';
  id: string;
  title: string;
  status: string;
  coverUrl: string | null;
  captionPreview: string;
  createdAt: string;
  revision: number;
  deletedAt: string | null;
}

export interface RunItem {
  id: string;
  status: string;
  progress: number;
  currentStage: string | null;
  topic: string | null;
  kind: string;
  sequence: number;
  createdAt: string;
  resultId: string | null;
  error: { message?: string; stage?: string } | null;
}

export type NavTab =
  | 'beranda'
  | 'buat-konten'
  | 'progress'
  | 'hasil'
  | 'galeri-gaya'
  | 'suara'
  | 'pengaturan'
  | 'bantuan'
  | 'render-lokal'
  | 'project-offline'
  | 'import-folder'
  | 'admin-members'
  | 'admin-licenses'
  | 'admin-system';
