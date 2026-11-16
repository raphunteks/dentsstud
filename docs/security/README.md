# Ringkasan keamanan (diverifikasi oleh tes e2e)

| Kontrol | Implementasi | Tes |
|---|---|---|
| RBAC server-side | Guard global + `@Roles('SUPERADMIN')`; semua query member difilter `userId` | phase1–4 (403/404 lintas akun) |
| Login | Argon2id + OTP email (HMAC, TTL, maks percobaan, rate limit per IP) | phase1 |
| Sesi | Token opaque di-hash; cookie `HttpOnly`, `SameSite=Lax`, `Secure` di production; refresh berotasi | phase1, phase4 |
| Secret pihak ketiga | API key Claude/TTS dienkripsi AES-256-GCM, write-only, di-redact dari log/error | phase1, phase4 |
| Header | helmet (HSTS, nosniff, frame SAMEORIGIN), tanpa `x-powered-by`, CORS hanya `WEB_ORIGIN` | phase4 |
| File | URL file ditandatangani HMAC + kedaluwarsa; key tervalidasi (anti traversal); upload diperiksa magic byte, SVG ditolak | phase2, phase4 |
| Import ZIP | Batas ukuran/jumlah/rasio, tolak symlink & path traversal, checksum manifest | phase2 |
| Worker | `/internal/*` hanya dengan `WORKER_TOKEN` (timing-safe) | phase2b |
| Desktop | sandbox, contextIsolation, IPC allowlist + Zod + cek sender, CSP, navigasi diblokir, token di safeStorage | desktop-phase1 |
| Lisensi offline | JWT EdDSA, diverifikasi dengan public key | desktop-phase1 |
| Telemetri | Hanya pesan, stack, versi; path home dipangkas; rate limit 20/menit | phase4 |

Belum tercakup (butuh pihak luar): tanda tangan kode Windows (Authenticode) dan notarization macOS, pentest eksternal.
