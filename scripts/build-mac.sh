#!/usr/bin/env bash
# Build DENTSWEB STUDIO .dmg (arm64 + x64) on a Mac.
#   ./scripts/build-mac.sh
# Without an Apple Developer ID the app is ad-hoc signed (runs locally; first launch: right-click → Open).
# Signing + notarization: export CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
# and set `notarize: true` in apps/desktop/electron-builder.yml.
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(uname -s)" = "Darwin" ] || { echo "Jalankan skrip ini di macOS."; exit 1; }
command -v node >/dev/null || { echo "Node.js 22 belum terpasang: https://nodejs.org (LTS 22) atau 'brew install node@22'"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Butuh Node.js 22+, terpasang $(node -v)"; exit 1; }
command -v pnpm >/dev/null || { corepack enable && corepack prepare pnpm@10.28.0 --activate; }
export DENTSWEB_API_BASE="${DENTSWEB_API_BASE:-${DENTWEB_API_BASE:-https://motion.dentsweb.my.id}}"
export DENTWEB_API_BASE="$DENTSWEB_API_BASE"
pnpm install --frozen-lockfile
pnpm --filter "./packages/*" build
pnpm --filter @dentweb/desktop dist:mac
echo
ls -lh apps/desktop/release/*/*.dmg
shasum -a 256 apps/desktop/release/*/*.dmg
echo "Selesai. Buka DMG sesuai chip Mac Anda (arm64 = Apple Silicon, x64 = Intel)."
