# Deploy produksi

Topologi: **Vercel** (web Next.js) → **VPS Docker** (API NestJS + engine produksi + scheduler + render worker Remotion, di belakang Caddy TLS) → **PostgreSQL** (managed atau container `local-db`) + **Upstash Redis** (`rediss://`). Penyimpanan objek: `STORAGE_DRIVER=s3` (S3/R2/MinIO) disarankan; `local` memakai volume `storage`.

## 1. Siapkan secret (sekali)
```bash
openssl rand -base64 32                       # SECRETS_MASTER_KEY
openssl genpkey -algorithm ed25519 | base64 -w0   # LICENSE_SIGNING_KEY
openssl rand -hex 32                          # WORKER_TOKEN (sama di API dan render worker)
openssl rand -hex 24                          # METRICS_TOKEN (opsional)
```
Isi `.env` di VPS dari `.env.example`. Wajib di production: `DATABASE_URL`, `REDIS_URL`, `SECRETS_MASTER_KEY`, `LICENSE_SIGNING_KEY`, `WEB_ORIGIN=https://<domain-web>`, `PUBLIC_API_ORIGIN=https://api.<domain>`, `TRUST_PROXY=true`, `SMTP_HOST/PORT/USER/PASS` (App Password Gmail/Workspace) dan `MAIL_FROM`. API menolak start tanpa SMTP di production. Jangan pernah commit `.env`.

> Mengganti `SECRETS_MASTER_KEY` membuat semua API key member yang tersimpan tidak bisa dibuka. Simpan cadangannya di password manager.

## 2. VPS
```bash
git clone <repo> dentweb && cd dentweb
docker compose -f infrastructure/docker/docker-compose.yml --profile ops run --rm migrate
docker compose -f infrastructure/docker/docker-compose.yml up -d --build api render-worker
docker compose -f infrastructure/docker/docker-compose.yml exec api node dist/scripts/bootstrap-superadmin.js   # SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD di env
```
Seed (12 kategori kosong, agen, workflow, artikel bantuan) dijalankan sekali: `pnpm db:seed` dari mesin yang bisa mengakses `DATABASE_URL`.
Caddy: `API_DOMAIN=api.<domain> caddy run --config infrastructure/reverse-proxy/Caddyfile`.
Skala render: `docker compose ... up -d --scale render-worker=3` (setiap worker 1 job; atur `RENDER_CONCURRENCY`). Untuk API multi-replika, aktifkan `PRODUCTION_WORKER`/`SCHEDULER_ENABLED` di satu replika atau semua (job scheduler idempoten per slot).

## 3. Vercel
Root `apps/web`, build `pnpm --filter @dentweb/web build`, env `API_ORIGIN=https://api.<domain>`. Domain web harus sama dengan `WEB_ORIGIN`.

## 4. Pasca deploy
- `curl https://api.<domain>/api/v1/health` → `status: ok`.
- Login Superadmin → 14 Sistem: cek worker render aktif (heartbeat).
- 11 Desktop & Rilis: unggah installer `.exe` / `.dmg` → tersedia di halaman unduhan dan feed pembaruan.
- Jadwalkan backup: `0 2 * * * cd /opt/dentweb && scripts/backup.sh /var/backups/dentweb` (lihat `docs/runbooks`).
- Prometheus (opsional): scrape `https://api.<domain>/api/v1/metrics` dengan header `Authorization: Bearer $METRICS_TOKEN`.
