# DENTWEB STUDIO

**Create Motion. Powered by AI.** — monorepo (pnpm + Turborepo) per *Master Architecture v1.1*.

| Path | Isi |
|---|---|
| `apps/api` | NestJS 12 API (`/api/v1`), RBAC 2 role, OTP email login, lisensi & perangkat, koneksi AI |
| `apps/web` | Next.js 16 (Vercel). Member dashboard + Superadmin Control Center |
| `apps/desktop` | Electron 45 (macOS `.dmg`, Windows `.exe`), sandbox + IPC allowlist, SQLite lokal (`node:sqlite`) |
| `apps/render-worker` | Remotion render worker (BullMQ, hanya bicara ke API lewat `/internal`) |
| `packages/database` | Drizzle ORM schema, migrasi SQL, seed idempoten (12 kategori kosong) |
| `packages/shared-types` | Kontrak Zod bersama |
| `content/` | Struktur import kosong (preset, hooks, voices) |
| `packages/content-schema`, `motion-schema`, `remotion-compositions` | Kontrak import, dokumen motion, komposisi Remotion |
| `infrastructure/` | Dockerfile API + render worker, docker-compose VPS, Caddy |
| `scripts/` | `backup.sh`, `restore.sh`, `build-mac.sh` |

## Jalankan lokal

```bash
corepack enable && pnpm install
cp .env.example .env            # isi SECRETS_MASTER_KEY, LICENSE_SIGNING_KEY, DATABASE_URL, SMTP_*
pnpm --filter "./packages/*" build
pnpm db:migrate && pnpm db:seed
pnpm --filter @dentweb/api build && SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm bootstrap:superadmin
pnpm --filter @dentweb/api dev        # :4000, Swagger di /api/docs
pnpm --filter @dentweb/web dev        # :3000
pnpm --filter @dentweb/desktop dev    # Electron (DENTWEB_API_BASE=http://localhost:4000)
```

Tanpa SMTP di development, kode OTP dicetak di log API. Production menolak start tanpa SMTP.

## Installer

- macOS: `./scripts/build-mac.sh` di Mac → `apps/desktop/release/<versi>/*.dmg`
- Windows: `pnpm dist:win` (Windows, atau Linux dengan wine) → `DENTWEB-STUDIO-Setup-<versi>.exe`

## Deploy

- **Web → Vercel**: root `apps/web`, env `API_ORIGIN=https://api.<domain>`.
- **API → VPS Docker**: `docker compose -f infrastructure/docker/docker-compose.yml up -d --build`, Caddy untuk TLS.
- **Postgres**: `DATABASE_URL` (Neon atau profile `local-db`). **Redis**: Upstash `rediss://`.

Detail: `docs/deployment`, `docs/runbooks`, `docs/security`, `docs/import-format`, `docs/desktop-build`, `docs/api/openapi.json`.

## Pengujian

```bash
pnpm --filter @dentweb/api test           # e2e API: fase 1–4 (Postgres + Redis lokal, Remotion + ffprobe nyata)
pnpm --filter @dentweb/motion-schema test
node tests/e2e/web-phase1.mjs | web-phase2.mjs | web-phase34.mjs     # Playwright terhadap stack berjalan
xvfb-run node tests/e2e/desktop-phase1.mjs                            # Electron
```

## Status fase

1. Fondasi: auth OTP, RBAC, lisensi & perangkat, koneksi Claude, dashboard, desktop shell. ✅
2. Konten & studio: import folder/upload, CMS preset/hook/voice, TTS, editor motion, render cloud/lokal, sinkronisasi offline. ✅
3. Produksi multi-agent: wizard Buat Konten, 6 agen + cek fakta + QC, Progress real-time (SSE), Hasil + paket sosial, revisi, scheduler, admin agen/workflow/produksi/kuota. ✅
4. Operasional: rilis desktop + auto-update, support & pusat bantuan, analitik, error monitoring, metrik Prometheus, backup/restore, dokumentasi deploy, installer final. ✅
