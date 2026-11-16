# Build installer desktop

- **macOS (.dmg arm64 + x64)**: di Mac, `./scripts/build-mac.sh`. Tanpa sertifikat Developer ID, Gatekeeper memperingatkan saat pertama dibuka: klik kanan → Open. Untuk tanda tangan + notarization set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` dan `notarize: true`.
- **Windows (.exe NSIS x64)**: `pnpm --filter @dentweb/desktop dist:win` di Windows, atau Linux dengan `wine` + `wine32`. Tanda tangan: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.
- Render lokal memakai Chrome/Edge/Chromium yang terpasang di komputer (dicari otomatis); bundle Remotion ikut di dalam app.
- Setelah build: unggah installer di Superadmin → 11 Desktop & Rilis. Aplikasi Windows yang sudah terpasang akan menawarkan pembaruan dari feed tersebut.
- URL API default diatur lewat `DENTWEB_API_BASE` saat build atau diubah pengguna di layar "Server API".
