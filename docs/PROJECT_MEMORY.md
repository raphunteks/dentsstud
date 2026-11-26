# DENTSWEB STUDIO — Comprehensive Project Memory (`docs/PROJECT_MEMORY.md`)

**Generated:** 2026-11-20 | **Version:** Monorepo `1.0.9` (Packages & Worker `1.0.0`) | **Target Spec:** `ARCHITECTURE PROMPT.md` v1.1

---

## 1. Shared Packages & Database Schema (`dentweb-studio/packages/`)

| Package | Version | Role & Key Exports | Tests |
|---|---|---|---|
| `@dentweb/database` | `1.0.0` | Drizzle ORM (`0.45.4`), `pg` pool (`createDatabase`), 63 tables in `src/schema/`, constants in `src/catalog.ts`, 4 migrations (`0000`–`0003`), `seeds/seed.ts`, `seeds/seed-presets.ts`. | 0 tests |
| `@dentweb/motion-schema` | `1.0.0` | Zod v4 `MotionDocument`, `Format` (`9:16`, `16:9`, `1:1`), `Layer` (`text`/`shape`/`image`/`video`), `Scene`, `AudioTrack`, `Style`, `Operation`, `valueAt()`, `effectAt()`, `applyOperation()`. | 3 tests (`schema.test.ts`) |
| `@dentweb/content-schema` | `1.0.0` | Import package schemas (`PresetRecipe`, `PresetManifest`, `HookRecipe`, `HookManifest`, `VoiceManifest`), magic-byte validator (`checkFileType`), path traversal check (`safeRelPath`). | 0 tests |
| `@dentweb/remotion-compositions` | `1.0.0` | `Root.tsx` (`DentswebMotion`, `DentwebMotion`, `DentswebCover`, `DentwebCover`), `MotionComp.tsx` (`MotionComp`, `CoverComp`), `node/render.ts` (`renderDocument`, `renderCover`), `scripts/bundle.mjs`. *(Contains uncompilable orphan copy `src/presets/`).* | 0 tests |
| `@dentweb/shared-types` | `1.0.0` | Phase 1 enums (`ROLES`, `USER_STATUSES`, `LICENSE_STATUSES`, `CONTENT_STATUSES`, `AI_CONNECTION_STATUSES`, `PRODUCTION_STAGES`, `PLATFORMS`) + Phase 1 DTOs + `SessionUser`. | No test script |
| `auth-core`, `license-core` | — | Empty orphan directories (0 files). | — |

### 63 PostgreSQL Tables by Domain (`packages/database/src/schema/`)
- **Identity (`identity.ts` — 7):** `users`, `auth_identities`, `sessions`, `otp_challenges`, `oauth_transactions`, `roles`, `role_permissions`.
- **Licensing (`licensing.ts` — 3):** `licenses`, `devices`, `license_activations`.
- **Content (`content.ts` — 13):** `style_categories` (12 seeded), `visual_presets`, `visual_preset_versions`, `preset_assets`, `hook_presets`, `hook_versions`, `import_batches`, `import_items`, `voice_profiles`, `voice_versions`, `voice_samples`, `tts_provider_configs` (`gemini`, `elevenlabs`, `cadangan`), `member_tts_accounts`.
- **Media & Projects (`media.ts` — 6):** `media_assets` (content-addressed `media/<2hex>/<sha>.<ext>`), `projects`, `project_documents`, `project_operations`, `project_versions`, `sync_conflicts`.
- **Settings & AI (`settings.ts` — 11):** `member_voice_preferences`, `member_brand_profiles`, `member_production_settings`, `ai_connections`, `ai_connection_events`, `secret_vault`, `ai_provider_registry` (`anthropic`), `agent_definitions` (6 seeded), `agent_prompt_versions`, `workflow_definitions` (`standard-production`), `workflow_versions`.
- **Production & Render (`production.ts` — 13):** `production_orders`, `production_runs`, `production_stage_runs`, `production_events`, `research_sources`, `fact_check_reports`, `qc_reports`, `worker_nodes`, `render_jobs`, `render_attempts`, `render_outputs`, `video_results`, `social_metadata`.
- **Ops & Admin (`admin.ts` — 10):** `notifications`, `support_tickets`, `support_ticket_messages`, `help_articles` (8 seeded), `app_releases`, `incidents`, `audit_logs`, `system_settings` (12 seeded), `feature_flags` (5 seeded), `error_reports`.

---

## 2. Website (`apps/web`) — Complete Route & Architecture Map

- **Proxy:** `next.config.ts` rewrites `/` -> `/landing/index.html` (`beforeFiles`, exposing 355 files under `/assets/:path*`) and `/api/v1/:path*` -> `${API_ORIGIN}/api/v1/:path*` (`afterFiles`).
- **Edge Guard (`src/middleware.ts`):** Matches 10 protected route trees; checks presence of `dw_sid` or `dw_auth` cookie; does NOT verify validity or role; uses deprecated Next.js 16 `middleware.ts` naming instead of `proxy.ts`.
- **Client API (`src/lib/api.ts`):** `credentials: 'include'`, single-flight `401` refresh retry against `POST /auth/refresh`. Uploads (`upload.ts`, `Editor.tsx`, `create-content`, `admin/releases`) bypass `api()`.
- **Theme:** `data-theme` attribute in `localStorage['dentsweb-theme']` (defaults `'light'`; lacks `layout.tsx` anti-FOUC inline script, Tailwind v4 `@custom-variant dark`, `.lit` manual dark rule, and `Toaster` sync).

### Web Routes (34 Pages + Layouts/Boundary)
- **Public / Auth / OAuth:** `/` (`public/landing/index.html`), `/login`, `/register`, `/callback` (OAuth PKCE callback + `dentsweb://oauth-success` trigger), `error.tsx`, `not-found.tsx`.
- **Member `(member)` — 18 routes:**
  - Sidebar visible (11): `/dashboard`, `/create-content`, `/progress`, `/results`, `/results/[id]` *(detail subroute)*, `/styles`, `/voices`, `/studio/projects`, `/studio/editor/[id]` *(detail subroute)*, `/studio/render`, `/settings/claude`, `/settings/license`, `/settings/brand`, `/help`.
  - **Orphaned from `AppShell` sidebar (4):** `/settings/claude/callback`, `/settings/voice-accounts` *(linked only inside `/voices`)*, `/settings/production` *(0 links)*, `/settings/about` *(0 links)*.
- **Superadmin `(superadmin)/admin` — 16 routes:**
  - Sidebar visible (10 + detail): `/admin` *(01 Control Center)*, `/admin/members` *(02)*, `/admin/members/[id]` *(02 detail)*, `/admin/licenses` *(03)*, `/admin/ai-providers` *(06)*, `/admin/workflows` *(07)*, `/admin/production` *(08)*, `/admin/quotas` *(10)*, `/admin/releases` *(11)*, `/admin/support` *(12)*, `/admin/system` *(14)*.
  - **Orphaned from `AppShell` sidebar (5):** `/admin/content` *(04 Content Library)*, `/admin/content/import` *(04 Bulk Import)*, `/admin/voices` *(05 Voice & TTS Center)*, `/admin/results` *(09 Hasil & Media)*, `/admin/analytics` *(13 Analytics & Errors)*.

---

## 3. Desktop App (`apps/desktop`) — Architecture, Views & IPC Channels

- **Main Process (`electron/`):**
  - `main/index.ts`: Single-instance lock, registers `dentsweb://` & `dentweb://` schemes, Chromium GPU + sandbox flags, `BrowserWindow` (`1360×880`), external link allowlist (`dentsweb.my.id`, `*.anthropic.com`, `*.claude.ai`), deep-link parser, crash telemetry hook.
  - `security/protocol.ts`: Serves `dist/renderer` on `app://dentsweb/` with path-traversal block and CSP (`media-src`, `img-src`, `connect-src` allow `motion.dentsweb.my.id`, `*.dentsweb.*`, `localhost:*`).
  - `security/oauth-listener.ts`: HTTP callback server on port `3000` (`server.listen(3000)` all interfaces) -> redirects `dentsweb://oauth-success` -> calls `/ai/connections/callback`.
  - `security/claude-code.ts`: Locates local `claude` CLI binary (`--version`, `claude -p --output-format json`).
  - `local-storage/store.ts` & `projects.ts`: `config.json` (`apiBase`, `installationId`), `session.bin` via OS `safeStorage`, SQLite (`dentweb.db`: `kv`, `operation_journal`, `projects_cache`).
  - `security/license-proof.ts`: Verifies Ed25519 `dw-license+jwt` offline proof against `license.publicKey`.
  - `local-render/render.ts`: Runs `@dentweb/remotion-compositions` using system Chrome/Edge + bundled FFmpeg compositor, reports heartbeat/progress to `/render/jobs/:id/local/*`.
  - `local-import/scan.ts`: Scans folder (`<= 8` depth, `<= 2000` files, `<= 500MB`), chunks 40 files to `/admin/imports/*`.
  - `updater/updater.ts`: Windows `electron-updater` generic YAML feed (`/releases/feed/stable/win32/:arch`); non-Windows polls `/releases/latest?platform=darwin&arch=...` (browser download).
  - `ipc/api-client.ts`: Adds `Bearer <accessToken>`, single-flight `401` refresh (`POST /auth/refresh`), `600s` multipart timeout.

### 28 Allowlisted IPC Channels (`electron/ipc/channels.ts` & `preload/index.ts`)
- **Wired (22):** `app:info`, `auth:register`, `auth:login`, `auth:verify`, `auth:session`, `auth:logout`, `api:get`, `api:mutate`, `license:activate`, `license:offline-status`, `claude:detect`, `claude:oauth-listen`, `claude:test`, `render:capability`, `render:local`, `render:cancel`, `import:folder`, `projects:cache`, `projects:local-list`, `projects:sync`, `telemetry:error`, `shell:open-external`.
- **Unwired in Renderer UI (6):** `config:set-api-base`, `auth:resend`, `projects:local-op`, `update:check`, `update:apply`, `update:state`.

### 21 Desktop Views (`src/App.tsx`, `src/views/*`)
- **Member (8):** `beranda` (`BerandaView`), `buat-konten` (`BuatKontenView`), `progress` (`ProgressView`), `hasil` (`HasilView` + `HasilDetailView`), `galeri-gaya` (`GaleriGayaView`), `suara` (`SuaraView`), `pengaturan` (`PengaturanView`), `bantuan` (`BantuanView`).
- **Engine Desktop (3, visible to all in `Sidebar.tsx` including `import-folder` RBAC leak):** `render-lokal` (`LocalRenderView`), `project-offline` (`OfflineProjectsView`), `import-folder` (`FolderImportView`).
- **Superadmin (10, in `SuperadminViews.tsx`):** `admin-members`, `admin-licenses`, `admin-ai-providers`, `admin-voices`, `admin-workflows` *(includes fake skill upload stub)*, `admin-production`, `admin-quotas`, `admin-system` *(fake green `/health` catch)*, `admin-releases`, `admin-support`.

---

## 4. Backend API (`apps/api` — 16 Modules, 31 Controllers, 152 Routes) & Render Worker

Global prefix `/api/v1`; guards `ThrottlerGuard` (300 req/60s) + global `AuthGuard` (`@Public()`, Authenticated, `@Roles('SUPERADMIN')`, `@UseGuards(WorkerGuard)` via `x-worker-token`).

| Module | Controllers & Route Prefixes | Core Responsibility |
|---|---|---|
| `IdentityModule` | `AuthController` (`/auth/*`), `MeController` (`/me`) | Argon2id auth, HMAC 6-digit email OTP, SHA-256 session cookies (`web`) / Bearer+refresh tokens (`desktop`). |
| `LicensesModule` | `LicensesController` (`/licenses/*`), `DevicesController` (`/devices/*`) | One active license/user, `maxDevices` transactional cap, Ed25519 offline proof JWT. |
| `AdminModule` | `AdminController` (`/admin/{dashboard,metrics,members,sessions,licenses,devices,audit-logs,settings,feature-flags,workers}`) | Platform monitoring & Superadmin CRUD. |
| `AiConnectionsModule` | `AiConnectionsController` (`/ai/*`) | AES-256-GCM `secret_vault`, `API_KEY` / `OAUTH_PKCE` (9Router label, Anthropic CLI headers) / `CLAUDE_CODE_LOCAL`, `resolveApiKey()` with Superadmin fallback. |
| `CatalogModule` | `CatalogController` (`/styles/categories`, `/me/dashboard`) | Public category counts + Member dashboard summary. |
| `MediaModule` | `FilesController` (`/files/:k`), `MediaController` (`/media`) | Content-addressed local/S3 storage, HMAC signed URLs, HTTP 206 Range streaming, 300MB magic-byte uploads. |
| `ImportsModule` | `ImportsController` (`/admin/imports/*`) | ZIP/folder staging, manifest + checksum validation, commit to `DRAFT` catalog items. |
| `StylesModule` | `StylesController` (`/styles/*`), `AdminStylesController` (`/admin/styles/*`) | Categories, versioned Visual Presets (`DRAFT`/`PUBLISHED`/`ARCHIVED`), duplicate, rollback. |
| `HooksModule` | `HooksController` (`/hooks/*`), `AdminHooksController` (`/admin/hooks/*`) | Authenticated Member hook reads + Superadmin CRUD/publish. |
| `VoicesModule` | `VoicesController` (`/voices/*`), `VoiceAccountsController` (`/settings/voice-accounts/*`), `AdminVoicesController` (`/admin/voice*`) | `GeminiTts`, `ElevenLabsTts`, `FallbackTts` (`cadangan` -> VoiceStudio `:8000`), sample upload/base64, `@Public()` preview. |
| `MemberSettingsModule` | `MemberSettingsController` (`/settings/{brand,production}`) | Member brand profile & daily auto-schedule settings. |
| `ProjectsModule` | `ProjectsController` (`/projects/*`) | MotionDocument CRUD, optimistic concurrency `putDocument`, offline op sync (`applyOps`), snapshots. |
| `RenderModule` | `RenderController` (`/render/jobs/*`), `InternalRenderController` (`/internal/*`), `AdminRenderController` (`/admin/render/*`, `/admin/styles/presets/:id/test-render`) | `CLOUD` (BullMQ `dw-render` + `apps/render-worker`) & `LOCAL` (Desktop) render orchestration + worker heartbeats. |
| `ProductionModule` | `ProductionController` (`/production/*`), `ResultsController` (`/results/*`), `AdminProductionController` (`/admin/production/*`, `/admin/{results,agents,workflows}*`) | BullMQ `dw-production` worker, 6-stage AI pipeline + scheduler cron + agent prompt versioning + result revoice/rerender. |
| `HealthModule` | `HealthController` (`/health`) | Public DB + Redis + SMTP probe. |
| `OpsModule` | `ReleasesController` (`/releases/*`), `AdminReleasesController`, `SupportController` (`/help/*`, `/support/*`), `AdminSupportController`, `OpsController` (`/telemetry/errors`, `/metrics`), `AdminInsightsController` (`/admin/{analytics,errors}*`) | Desktop installer feeds (`latest.yml`), support tickets + email/notifications, help CMS, Prometheus `/metrics`, grouped `error_reports`, SQL analytics. |

---

## 5. Complete Script & Deployment Inventory

- **Monorepo Root (`dentweb-studio/`):** `package.json` (`dev`, `build`, `lint`, `typecheck`, `test`, `test:playwright`, `db:migrate`, `db:seed`, `bootstrap:superadmin`, `cleanup:scheduler`, `dist:*`; *broken*: `db:generate`, `db:migrate:dev`), `scripts/{backup.sh,restore.sh,build-mac.sh,generate-walking-presets.mjs}`, `test-gallery-and-voices-e2e.mjs` (root duplicate), `infrastructure/{docker/{api.Dockerfile,render-worker.Dockerfile,docker-compose.yml},reverse-proxy/Caddyfile,workflows/ci.yml}`.
- **Outer Workspace (`DENTSWEB STUDIO/`):**
  - `vps-deploy/`: `scripts/{deploy.sh,check-status.sh}`, `configs/{ecosystem.config.cjs,.env.production.template}`, `README_VPS_UPGRADE.md`, `DEPLOY_CHECKSUM.json` (`v1.0.7`), duplicate presets & reference skills.
  - `scratch/`: `render_all_videos.mjs`, `walk_canvas.html`, `render_walk_cycles.mjs`, `test_render_thumbnails.mjs`, `compute_hashes.mjs`, `generate_sql.mjs`, `upload_and_update_vps.sh`.

---

## 6. Live VPS Snapshot (`43.153.199.122`, Verified 2026-11-20)

- **Host:** 7.4 GiB RAM (3.6 GiB available), 21G/99G disk used. Dokploy + Coolify also co-hosted.
- **PM2 Processes:** `dentsweb-api` (online, 21 restarts, `150MB`, `1.0.9`), `dentsweb-worker` (online, 15 restarts, `118MB`, `1.0.0`), `voicestudio` (online, 2 restarts, `1032MB`).
- **Services:** VoiceStudio `:8000` (`kokoro_loaded: true`, `voiceCount: 32`), API `:4000/api/v1/health` (`db: up, redis: up, smtp: configured`).
- **Database Counts:** `users: 2`, `visual_presets: 10`, `style_categories: 12`, `voice_profiles: 38` (incl. 6 Kokoro), `hook_presets: 5`, `agent_definitions: 6`, `media_assets: 87`, `production_runs: 1`, `video_results: 1`, `app_releases: 0`, `support_tickets: 0`, `error_reports: 7` (open).
- **Feature Flags:** `claude_code_local: true`, `cloud_render: true`, `local_render: true`, `scheduler: true`, `oauth_generic_pkce: false` *(dead — never queried by API)*.

---

## 7. Prioritized Bug & Drift Register (Audit 2026-11-20)

### P0 Security & Critical Blockers
1. `dentweb-postgres` on VPS bound to `0.0.0.0:5432`.
2. Real Superadmin password hardcoded in git (`tests/e2e/test-login-flow.mjs:26-27`, `test-oauth-and-ui.mjs:51-52`).
3. OAuth CSRF bypass & transaction replay (`oauth-pkce.service.ts:219-248` ignores `consumedAt`, falls back when `state` missing).
4. SSRF via member `cadangan` `baseUrl` (`voices.controller.ts:25`, `tts.adapters.ts:156-181`).
5. `@Public() POST /voices/:id/preview` exposes global Gemini/ElevenLabs paid keys unauthenticated (`voices.service.ts:207-224,254-273`).
6. Silent Superadmin Anthropic API key/OAuth fallback for Members (`ai-connections.service.ts:355-376`).
7. Member can hijack own `CLOUD` render job via `/render/jobs/:id/local/{progress,output,fail}` (`render.controller.ts:82-104`) + IDOR in `applyOps` (`projects.service.ts:98-99`) + cross-tenant `voice-preview` asset resolution (`render.service.ts:51`).
8. Desktop `1.0.9` Intel Mac & Windows builds ship ONLY `@remotion/compositor-darwin-arm64` (`render:local` fails on Intel/Win).
9. `ProductionService.validate()` (`production.service.ts:112-113`) rejects server-managed VoiceStudio `cadangan` voices (`422 TTS_ACCOUNT_MISSING`).

### P1 Broken Features & Core Flow Bugs
- **Web:** `AppShell` ignores `nav` prop (7 pages orphaned from sidebar); `/voices` link to `/editor` 404s; `settings/production` strips `,` & `\n`; wrong query keys on Claude model change; VoiceStudio tab-switch stale `sel`; `Editor.tsx` drag double-translate; Open Redirect `?next=//...`; `vercel.json` missing `motion-schema`/`content-schema` build; `/callback` `useSession()` race condition; `typeof null === 'object'` blocks null settings; dark mode `dark:*` / `.lit` / `Toaster` out of sync.
- **Desktop:** `HasilView` calls nonexistent `POST /results/:id/mark-uploaded` & crashes on `FAILED` tab clicks; `OfflineProjectsView` has no JSX for cached projects; `App.tsx` offline error screen locks out offline mode; `AdminWorkflowsView` skill upload is a fake `alert()` stub; `AdminSystemView` fakes green `/health` on failure; `AdminVoicesView` audio stop broken; 6 IPC channels unwired; `import-folder` visible to Member; `LocalRenderView` corrupts relative URLs (`https:///...`); OAuth listener emits double events on all interfaces `:3000`; `BerandaView` & `BuatKontenView` missing hooks/uploads/style images.
- **Backend/Infra:** BullMQ render retry #2 always aborted (`status === 'FAILED'`) & cancel overwrites `CANCELLING`->`FAILED`; SSE sends duplicate events (ms vs µs); Gemini TTS uses nonexistent model & wrong JSON field; expired licenses report `ACTIVE`; license `grant()` breaks existing desktop activations; `api.Dockerfile` missing schema package builds; `infrastructure/workflows/ci.yml` misplaced; `MotionComp.tsx` hardcodes `"KITA BONGKAR"`, particle bounds `1080x1920`, ignores `src/presets/` demos.
---

## 8. Releases Evolution: v1.0.10 through v1.0.18

### v1.0.10 – v1.0.12 Base Stabilization
- Master vector branding: `dentsweb-logo.svg` (`viewBox="0 0 1024 1024"`), `build/icon.png` (1024x1024 RGBA), and high-resolution DMG backgrounds (`background.png`, `background@2x.png`, `background.tiff`).
- Unlimited Skills `.zip` and folder upload UI in `AdminWorkflowsView`, eliminating the previous 15MB limit.
- Analytics resolved KPI card (`Total Selesai`) and `POST /admin/errors/resolve-all`.

### v1.0.13 Releases & Sidebar Upgrades
- Vector logo tiles in sidebar branding (`apps/desktop/src/assets/logo.svg`).
- Superadmin `11 Rilis Desktop`: added `admin:pick-installer` and `admin:upload-release` IPC handlers streaming installers directly from disk via `FormData` in the main process, eliminating renderer memory bloat.
- Member `Pengaturan → Update & Rilis`: dedicated sub-tab with live update status, `update:check`, `update:apply`, and manual download links for macOS & Windows.

### v1.0.14 Preload Parity, Office & Member Management
- Preload allowlist parity: automated Vitest regression test in `views.test.tsx` verifying 100% sync between `electron/ipc/channels.ts` and `electron/preload/index.ts`.
- Reusable `AiProvidersPanel.tsx`: added `Segarkan Model` button (`POST /ai/connections/:id/check`) to refresh all models (500+ from 9Router) and maintain `CONNECTED` status.
- `AdminOfficeView.tsx` (`15 Kantor & RBAC`): pure SVG + CSS 4-room isometric pixel-art office (`Ruang Kerja`, `Ruang Render & Server`, `Ruang Meeting`, `Lounge Istirahat`) with live presence polling (10s) and Member vs Superadmin RBAC matrix.
- `SuperadminViews.tsx` (`02 Member & Akses`): KPI cards, license filter, CSV export, `+ Registrasi Member` modal (Argon2id auto-generated password), license expiry badge, password reset with 1-click copy, force logout all sessions, and quick license extend (`+30h`, `+90h`, `+365h`).

### v1.0.15 Native TryPost Social Publisher
- `SocialView.tsx`: Member `Sosial Media` view with 4 sub-tabs (`Kalender & Antrean`, `Buat Post`, `Ideas Board`, `Akun Terhubung` for all 10 TryPost platforms: TikTok, Instagram, YouTube, Facebook, X, LinkedIn, Threads, Pinterest, Bluesky, Mastodon).
- `HasilView.tsx`: added 1-click `Publish Sosmed` button passing `resultId` to `SocialView`.
- `AdminSocialView`: Superadmin `16 Social Publisher` with KPI cards, `Auto-Publish` toggle, 10-platform configuration modal, and global queue monitor.

### v1.0.16 Bulletproof Notification Popover Portal
- `apps/desktop/src/App.tsx`: rendered notification dropdown via `createPortal(..., document.body)` with `fixed` coordinates anchored to the bell button, `z-[9999]`, backdrop `z-[9998]`, Escape key handler, and resize listener. Header given `z-40` to prevent stacking context clipping from backdrop-blur or page cards.

### v1.0.17 DENTSWEB MOTION LMS & Global Rebrand
- Rebranded all occurrences of `One Line Motion` / `one-line-motion` → `DENTSWEB MOTION` / `dentsweb-motion` across the codebase, database, and skill ZIP (0 legacy brand occurrences remaining).
- `LmsView.tsx` (`Kelas & Materi` under `BELAJAR` group): topbar with `⌘K` global search modal, progress ring %, `Lanjut Belajar` CTA, and 8 sub-tabs (`Beranda Kelas`, `Daftar Kelas` & Lesson Player with chapters/checklist/prompt box, 1-click `Kirim ke Buat Konten`, `Racik Prompt` 6-stage builder, `Koleksi Prompt`, `Resep Gaya`, `Kamus Motion`, `Video Efek`, `Update & Download Skill`).
- Dedicated Member Web `/kelas/*` routing (`/kelas`, `/kelas/login`, `/kelas/register`, `/kelas/materi/[slug]`, `/kelas/racik`, `/kelas/prompt`, `/kelas/gaya`, `/kelas/kamus`, `/kelas/efek`, `/kelas/update`, `/kelas/unduh`).
- `AdminLmsView`: Superadmin `17 Kelas & LMS` CRUD control center and member progress analytics.

### v1.0.18 88 Gaya Viral DENTSWEB MOTION & Galeri Gaya Enhancements
- **88 Gaya Viral Full Production**: 88 viral social media motion video styles rendered in vertical 9:16 (1080×1920 60fps) MP4 with Kokoro ONNX neural voiceovers (6 voices: adam, michael, heart, bella, sarah, emma), dynamic audio waveforms, pink noise ambient SFX, and JPG thumbnails.
- **Database Full Parity**: VPS PostgreSQL `visual_presets` updated so 100% of presets (88/88) point to rendered MP4/JPG assets (`presets_rendered/`), completely eliminating legacy fallback videos. Total active presets: 98.
- **Superadmin CMS Limit Fix**: Updated presets query in `apps/desktop/src/views/SuperadminExtraViews.tsx` to `GET /admin/styles/presets?limit=100` so all 98 styles display in CMS (previously limited to default 50).
- **Web Galeri Gaya Optimization**: Lazy image loading (`loading="lazy"`) on 98 cards prevents network rate limits, and modal video preview features unmuted `<video controls autoPlay loop playsInline />` for smooth Kokoro VO + SFX playback.
- **Desktop Galeri Gaya Audio Unmuted**: Desktop video preview modal includes interactive controls with unmuted playback.
- **mf.py Automation**: Added Linux headless Chromium flags (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) and added `batch` command for sequential headless project rendering.
- **Desktop Release Packaging**: Packaged native installers for `darwin-arm64`, `darwin-x64`, and `win32-x64` with strict release cleanup and version parity across the monorepo.

### v1.0.19 Zero-Delay Playback & Diverse Full-Screen Motion Renders
- **Desktop Zero-Delay Grid**: Removed `<video autoPlay>` from 98-card grid in `GaleriGayaView.tsx`, replacing it with lazy/async images (`<img loading="lazy" decoding="async" />`) and pure monochrome SVG play badge on hover. Completely eliminates the 6 concurrent media connection exhaustion in Chromium/Electron.
- **Instant Video Modal Preview**: Video preview modal in Desktop and Web equipped with dynamic `key={id}`, thumbnail `poster`, `preload="auto"`, unmuted interactive `controls`, and `autoPlay loop playsInline`.
- **DENTSWEB MOTION Authentic Motion Production**: Upgraded render pipeline with 8 official original templates (rendered via Chromium Headless `mf.py`) and 12 distinct full-screen visual motion engines for 80 gallery styles (incorporating `-movflags +faststart` for zero-buffering HTTP 206 streaming, rich animated illustrations, kinetic subtitles, Kokoro neural voiceover, and pink noise ambient SFX).
- **Monorepo Version Bump**: Unified `@dentweb/api`, `@dentweb/web`, and `@dentweb/desktop` to `1.0.19`.

### v1.0.20 Remotion Full Multi-Scene Visual Storytelling (`ViralStyleComp`)
- **Multi-Scene Remotion Composition (`packages/remotion-compositions/src/ViralStyleComp.tsx`)**: Registered `ViralStyleComp` in `Root.tsx` (720×1280, 30fps, dynamic `durationInFrames`) featuring 4 sequential storytelling scenes following narration progress: Scene 1 (0–25% cinematic hook + 12 full-screen visual archetypes + 12 animated SVG subject illustrations), Scene 2 (25–55% camera pan/zoom + scale wireframe + thin callout pointers + auto-extracted key facts/numbers), Scene 3 (55–82% dynamic climax + particles + camera shake), Scene 4 (82–100% atmospheric outro + compact `DENTSWEB MOTION` watermark).
- **Clean Karaoke Subtitles & Human Audio**: Word-synced karaoke subtitles with crisp `text-shadow` and accent highlight (no black box, no `showwaves`, no technical overlay text) paired with Indonesian human VO (`VO_<slug>.mp3`).
- **88/88 Remotion Batch Render & VPS Sync**: Re-rendered all 88 gallery styles via `@remotion/renderer` (`scripts/render-88-viral.mjs`) + `-movflags +faststart` + rich JPG thumbnails at 2.8s, synced to VPS storage and PostgreSQL `media_assets` / `visual_presets` (88/88 `faststart`, 88/88 `SYNC_OK`).
- **Monorepo Release `v1.0.20`**: Unified `@dentweb/api`, `@dentweb/web`, and `@dentweb/desktop` to `1.0.20` with fresh desktop installers (`arm64.dmg`, `x64.dmg`, `Setup-1.0.20.exe`).

### v1.0.21 12 Distinct Category Visual Layouts & 88 Category-Matched Scripts
- **88 Category-Matched Scripts (`viral_88_naskah.json`)**: Rewrote and mapped all 88 styles 1:1 against DB `style_categories` with validated `hookTitle` (100% ≤ 22 chars, 0 clipped titles), `categorySlug`, `visualLayout`, and 4 script-specific factual `scenes` (`{ label, metric, detail }`), plus re-synthesized 88/88 Indonesian human VO (`VO_<slug>.mp3`) and enriched WordBoundary JSON timestamps.
- **12 Distinct Remotion Visual Layouts (`viral-layouts.tsx` + `ViralStyleComp.tsx`)**: Replaced single layout with 12 category-tailored Remotion components (`news-broadcast`, `forensic-dossier`, `handdrawn-board`, `isometric-cutaway`, `comic-panel`, `swiss-editorial`, `dataviz-hud`, `arcade-game`, `cinema-reel`, `east-asian-scroll`, `cinematic-3d`, `product-keynote`) featuring `clampHookTitle` + `fitHookFontSize` safe-area guards, scene-specific metrics/details, high-contrast karaoke subtitles, and `DENTSWEB MOTION` watermark.
- **88/88 Remotion Re-Render & VPS Sync**: Re-rendered all 88 styles (`720x1280`, `30fps`, `-movflags +faststart`, 3.0s JPG thumbnails) and synced `media_assets` (`size_bytes`, `sha256`) + `visual_presets` (`name`, `description`) on VPS PostgreSQL (`88/88` `SYNC_OK`, `88/88` `FASTSTART`, `12/12` layouts active).
- **Monorepo Release `v1.0.21`**: Unified `@dentweb/api`, `@dentweb/web`, and `@dentweb/desktop` to `1.0.21` with fresh desktop installers (`arm64.dmg`, `x64.dmg`, `Setup-1.0.21.exe`).
