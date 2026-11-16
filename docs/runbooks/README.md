# Runbook operasional

## Backup & restore
- Backup: `scripts/backup.sh [dir]` → `dentweb-db-<ts>.dump` (pg_dump custom), `dentweb-storage-<ts>.tar.gz` (bila storage lokal), `dentweb-<ts>.sha256`. Retensi `BACKUP_KEEP` set (default 14).
- Restore: `DATABASE_URL=<target> scripts/restore.sh <dir> <ts> --yes` (memverifikasi checksum dulu). Variabel lingkungan menang atas `.env`, jadi selalu set `DATABASE_URL` target secara eksplisit. Setelah restore dari versi lama: `pnpm db:migrate`.
- Diuji: backup DB dev → restore ke database kosong → jumlah user & artikel sama.

## Produksi macet
1. 08 Produksi → filter Aktif. Run tanpa heartbeat 5 menit otomatis di-requeue oleh scheduler (`run.recovered` di log).
2. Render tertahan `QUEUED`: cek 14 Sistem → worker. Pastikan `QUEUE_PREFIX` dan `WORKER_TOKEN` worker sama dengan API.
3. Banyak gagal "Koneksi Claude ditolak": masalah API key member, bukan platform.

## Insiden
Catat di 14 Sistem → Insiden (judul, severity, layanan terdampak, akar masalah, langkah pemulihan, pencegahan). Error berulang terlihat di 13 Analitik → Error (dikelompokkan per fingerprint).

## Rotasi secret
- `WORKER_TOKEN`: ganti di API + semua worker, restart bersamaan.
- `LICENSE_SIGNING_KEY`: bukti offline lama tidak valid; perangkat perlu online sekali untuk aktivasi ulang.
- `SECRETS_MASTER_KEY`: jangan dirotasi tanpa skrip re-enkripsi; member harus memasukkan ulang API key.
