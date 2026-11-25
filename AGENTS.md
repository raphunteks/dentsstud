# dentweb-studio — Monorepo Guide, Scripts & Invariants

Monorepo root: `/Users/m.aksaarsyad/Downloads/DENTSWEB STUDIO/dentweb-studio` (`pnpm@10.28.0`, Node `>=22.12.0`, Turborepo `2.11.11`, TypeScript `6.0.3`).
For full exhaustive inventories (all 34 Web routes, 21 Desktop views, 28 IPC channels, 152 API routes, 63 DB tables, and audit bug list), read `docs/PROJECT_MEMORY.md`.

## Repository Topology

- `apps/web` (`@dentweb/web@1.0.9`) — Next.js `16.4.6` + React `19.3.1` + Tailwind v4 + React Query + Zustand + `@remotion/player`. Proxies `/api/v1/*` to `API_ORIGIN` (default `https://motion.dentsweb.my.id`) via `next.config.ts`. Static marketing landing page served from `public/landing/` via `beforeFiles` rewrite.
- `apps/desktop` (`@dentweb/desktop@1.0.9`) — Electron `45.3.3` + Vite `8.3.8` + `electron-builder` `26.18.0`. Custom `app://dentsweb/` protocol + strict CSP + main-process `safeStorage` tokens + Node `node:sqlite` offline journal + local Remotion renderer + folder importer + `dentsweb://`/`dentweb://` OAuth deep links.
- `apps/api` (`@dentweb/api@1.0.9`) — NestJS `12` + Express `5` API (`/api/v1` global prefix) + Drizzle ORM + BullMQ (`dw-production`, `dw-render`) + 6-stage AI pipeline + AES-256-GCM `secret_vault` + Ed25519 offline license proofs.
- `apps/render-worker` (`@dentweb/render-worker@1.0.0`) — Standalone BullMQ worker (`dw-render`) driving `@dentweb/remotion-compositions` + system Chromium/FFmpeg and posting progress/outputs to `/api/v1/internal/*` via `x-worker-token`.
- `packages/database` (`@dentweb/database@1.0.0`) — 63 Postgres tables (`src/schema/`), 4 Drizzle SQL migrations (`migrations/`), `seeds/seed.ts`, and `seeds/seed-presets.ts`.
- `packages/remotion-compositions` (`@dentweb/remotion-compositions@1.0.0`) — `DentswebMotion`/`DentswebCover` (`MotionComp.tsx`, `Root.tsx`) + server node renderer (`node/render.ts`) + prebuilt `bundle/` via `scripts/bundle.mjs`.
- `packages/motion-schema` (`@dentweb/motion-schema@1.0.0`) — Zod v4 `MotionDocument`, `Layer`, `Scene`, `Operation`, keyframe math, `applyOperation()`. *(Build `dist/` before building `web`, `api`, `desktop`, `render-worker`.)*
- `packages/content-schema` (`@dentweb/content-schema@1.0.0`) — Zod import manifests (`PresetRecipe`, `HookRecipe`, `VoiceManifest`), magic-byte validator, path guard. *(Build `dist/` before `web`/`api`.)*
- `packages/shared-types` (`@dentweb/shared-types@1.0.0`) — Phase 1 enums & Zod DTOs. *(Build `dist/` before `apps/*`.)*
- **Empty Orphan Dirs:** `packages/auth-core/`, `packages/license-core/`, `infrastructure/monitoring/`, `docs/database/` (0 files).

## Quick-Reference Script Inventory

### Monorepo Root (`dentweb-studio/package.json`)
| Command | What It Runs | Notes / Caveats |
|---|---|---|
| `pnpm dev` | `turbo run dev --parallel` | Starts all workspace dev tasks |
| `pnpm build` | `turbo run build` | Builds packages -> apps in topo order |
| `pnpm typecheck` / `pnpm lint` | `turbo run typecheck` / `lint` | `lint` is `tsc --noEmit` only (no ESLint/Biome) |
| `pnpm test` | `turbo run test` | Only `motion-schema`, `api`, `desktop` have tests |
| `pnpm test:playwright` | `node tests/e2e/test-login-flow.mjs` | SECURITY LEAK: hardcoded cred; hits `:3000` |
| `pnpm db:migrate` | `pnpm --filter @dentweb/database migrate:deploy` | Runs Drizzle migrations (`DATABASE_URL`) |
| `pnpm db:seed` | `pnpm --filter @dentweb/database seed` | Base taxonomy/agents/settings (zero presets/voices) |
| `pnpm db:generate` | **BROKEN** (`generate` script missing) | Use `pnpm --filter @dentweb/database migrate:generate` |
| `pnpm db:migrate:dev` | **BROKEN** (`migrate:dev` script missing) | No Drizzle dev command defined in `@dentweb/database` |
| `pnpm bootstrap:superadmin` | `pnpm --filter @dentweb/api bootstrap:superadmin` | Seeds initial Superadmin + license (needs compiled API) |
| `pnpm cleanup:scheduler` | `pnpm --filter @dentweb/api cleanup:scheduler` | Cleans legacy scheduler keys in `dist/scripts/` |
| `pnpm dist:mac` / `dist:win` / `dist:all` | `pnpm --filter @dentweb/desktop dist:*` | **WARNING:** See Desktop cross-platform Remotion caveat below |

### App & Package Specific Scripts
- **Web (`apps/web`):** `pnpm --filter @dentweb/web dev|build|start|typecheck` (`next dev -p 3000`, `vercel.json` currently misses building `motion-schema` & `content-schema`).
- **API (`apps/api`):** `pnpm --filter @dentweb/api build|dev|start|typecheck|test|openapi` (`openapi` exports `docs/api/openapi.json` from `dist/scripts/export-openapi.js`).
- **Desktop (`apps/desktop`):** `build:renderer` (`vite build`), `build:electron` (`node scripts/build-electron.mjs`), `build`, `dev`, `start`, `typecheck`, `test`, `dist:mac`, `dist:win`, `dist:all`, `dist:linux`.
- **Database (`packages/database`):** `build`, `migrate:generate`, `migrate:deploy`, `seed`, `seed:presets` (seeds 10 `PUBLISHED` presets bypassing import flow).
- **Remotion (`packages/remotion-compositions`):** `build` (`tsc -p tsconfig.node.json && node scripts/bundle.mjs`).

### Standalone Utility & E2E Scripts
- `scripts/build-mac.sh` — Clean macOS ARM64 build + SHA-256 verification.
- `scripts/backup.sh` & `scripts/restore.sh` — Postgres + local media backup/restore (uses Linux `sha256sum`, fails on stock macOS).
- `scripts/generate-walking-presets.mjs` — Playwright + Chrome + `/opt/homebrew/bin/ffmpeg` 10-preset MP4/JPG generator -> `.temp-walking-presets/`.
- `tests/e2e/`: `web-phase1.mjs`, `web-phase2.mjs`, `web-phase34.mjs`, `desktop-phase1.mjs`, `test-claude-oauth-e2e.mjs`, `test-gallery-and-voices-e2e.mjs` *(also duplicated at root `/test-gallery-and-voices-e2e.mjs`)*, `test-login-flow.mjs`, `test-oauth-and-ui.mjs`.
- Outer `../vps-deploy/scripts/{deploy.sh,check-status.sh}` — PM2 deploy & health check against `43.153.199.122`. *(Warning: `deploy.sh` skips building several workspace packages & DB migrations).*
- Outer `../scratch/{render_all_videos.mjs,compute_hashes.mjs,generate_sql.mjs,upload_and_update_vps.sh}` — Generates `../presets_mp4/` and directly patches VPS storage/Postgres.

## Critical Architecture Invariants & Gotchas

1. **Dual Branding Aliases (`dentsweb` vs `dentweb`):** Spec used `dentweb`; product uses `DENTSWEB`. Desktop exposes BOTH `window.dentsweb` and `window.dentweb`, registers both `dentsweb://` and `dentweb://`, and Remotion registers both `DentswebMotion` and `DentwebMotion`. Do not break one alias without updating callers.
2. **Desktop Packaging Caveat (`release/1.0.9/`):** Building `-mw` (`dist:all`) on Apple Silicon macOS bundles **ONLY `@remotion/compositor-darwin-arm64`** inside `mac-arm64`, `mac` (x64), AND `win-unpacked`! Local Remotion rendering will fail on Intel Macs & Windows unless built natively per OS/arch or explicitly unpacking matching `@remotion/compositor-*` packages. Also `dist/remotion-bundle` is currently inside `app.asar` instead of `asarUnpack`.
3. **Web `AppShell` Sidebar Trap:** `apps/web/src/components/shell/app-shell.tsx` accepts `nav` prop from `nav.ts` (`MEMBER_NAV`, `ADMIN_NAV`) but **ignores it**, rendering a hardcoded `sections` array. Consequently 7 real pages (`/settings/voice-accounts`, `/settings/production`, `/settings/about`, `/admin/content`, `/admin/content/import`, `/admin/voices`, `/admin/results`, `/admin/analytics`) are orphaned from the Web sidebar!
4. **VoiceStudio (`cadangan`) Validation Split:** `VoicesService` treats global `cadangan` (VPS VoiceStudio `:8000` with Kokoro ONNX) as `CONNECTED` without needing a `member_tts_accounts` row, **but `ProductionService.validate()` strictly checks `member_tts_accounts`**, causing `422 TTS_ACCOUNT_MISSING` on order creation until fixed! Meanwhile `@Public() POST /voices/:id/preview` falls back to global enabled Gemini/ElevenLabs paid keys if configured.
5. **Claude AI Resolution & Models:** Server `AiConnectionsService.resolveApiKey()` falls back to `SUPERADMIN` `OAUTH_PKCE`/`API_KEY` if a Member has no connection. Client lists hardcode models (and `anthropic.adapter.ts` + `ai-connections.service.ts` contain non-existent `claude-*-5-5` IDs while rejecting some dated Anthropic model IDs).
6. **6-Stage Production Pipeline & Remotion Engine:** Stages run `RESEARCH` -> `SCRIPT` -> `FACT_CHECK` (1 auto-revision loop) -> `MOTION` -> `QC` -> `SOCIAL`. Currently `MotionComp.tsx` ignores `Seed` extra fields (`fontFiles`, `textures`, `sfx`, `src/presets/` demos) and hardcodes `"KITA BONGKAR"` on hooks/covers.
7. **Desktop Dual Build Needed:** After modifying `apps/desktop/electron/**` or `apps/desktop/src/**`, run `pnpm --filter @dentweb/desktop build` before testing, and remember CI workflow lives misplaced at `infrastructure/workflows/ci.yml` (not `.github/workflows/`).
8. **Never Store Secrets in Git or Docs:** `tests/e2e/test-login-flow.mjs` and `test-oauth-and-ui.mjs` already leaked a real password in git history — never add credentials anywhere; use env vars (`E2E_EMAIL`, `E2E_PASSWORD`).
9. **Mandatory Release & Duplicate App Cleanup Rule:** Whenever a new Desktop version is built (`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm dist:all`), ALWAYS delete all older version files from outer `installers/` and `apps/desktop/release/`, and remove unpacked `mac/`, `mac-arm64/`, and `win-unpacked/` folders after copying the final `.dmg` & `.exe` to `installers/` so only the single latest version exists and macOS LaunchServices never accumulates duplicate `DENTSWEB STUDIO.app` entries.
