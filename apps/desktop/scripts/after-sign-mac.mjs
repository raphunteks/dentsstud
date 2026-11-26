import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entitlementsPath = resolve(here, '../build/entitlements.mac.plist');

/**
 * electron-builder afterSign hook for macOS 15–27 compatibility.
 * When no Developer ID certificate (CSC_LINK) is configured, apply a deep ad-hoc
 * signature bound to studio.dentsweb.desktop + entitlements.mac.plist so
 * Info.plist and Sealed Resources pass `codesign --verify --deep --strict`.
 */
export default async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK) {
    return;
  }
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--identifier',
      'studio.dentsweb.desktop',
      '--entitlements',
      entitlementsPath,
      appPath,
    ],
    { stdio: 'inherit' },
  );
}
