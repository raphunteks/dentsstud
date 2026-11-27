import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, openSync, readdirSync, readSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entitlementsPath = resolve(here, '../build/entitlements.mac.plist');

const MACHO_MAGICS = new Set([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);

function isMachO(filePath) {
  let fd;
  try {
    const st = lstatSync(filePath);
    if (!st.isFile() || st.size < 4) return false;
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    if (readSync(fd, buf, 0, 4, 0) < 4) return false;
    return MACHO_MAGICS.has(buf.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function collectInsideOut(rootDir) {
  const binaries = [];
  const frameworks = [];
  const helperApps = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(full);
        if (entry.name.endsWith('.framework')) {
          frameworks.push(full);
        } else if (entry.name.endsWith('.app')) {
          helperApps.push(full);
        }
      } else if (entry.isFile()) {
        if (
          entry.name.endsWith('.dylib') ||
          entry.name.endsWith('.so') ||
          entry.name.endsWith('.node') ||
          isMachO(full)
        ) {
          binaries.push(full);
        }
      }
    }
  }

  if (existsSync(rootDir)) walk(rootDir);
  return { binaries, frameworks, helperApps };
}

function signTarget(targetPath, withEntitlements = false) {
  const args = ['--force', '--sign', '-'];
  if (withEntitlements) args.push('--entitlements', entitlementsPath);
  args.push(targetPath);
  execFileSync('codesign', args, { stdio: 'inherit' });
}

/**
 * electron-builder afterSign hook for macOS 13–27 compatibility (Ventura, Sonoma, Sequoia, Tahoe, 27).
 * When no Developer ID certificate (CSC_LINK) is configured, performs clean inside-out ad-hoc signing
 * without overwriting nested Helper/Framework CFBundleIdentifiers so macOS 15 Sequoia AMFI/Gatekeeper
 * validates every nested bundle cleanly.
 */
export default async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK) {
    return;
  }
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const contentsDir = join(appPath, 'Contents');

  // 1. Strip any quarantine/resource-fork extended attributes before signing
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' });

  // 2. Inside-out signing: deepest Mach-O binaries first -> nested .framework -> nested Helper .app
  const byDepthDesc = (a, b) => b.split('/').length - a.split('/').length;
  const { binaries, frameworks, helperApps } = collectInsideOut(join(contentsDir, 'Frameworks'));
  const unpacked = collectInsideOut(join(contentsDir, 'Resources', 'app.asar.unpacked'));

  for (const bin of [...unpacked.binaries, ...binaries].sort(byDepthDesc)) {
    signTarget(bin, false);
  }
  for (const fw of [...unpacked.frameworks, ...frameworks].sort(byDepthDesc)) {
    signTarget(fw, false);
  }
  for (const helper of [...unpacked.helperApps, ...helperApps].sort(byDepthDesc)) {
    signTarget(helper, true);
  }

  // 3. Sign main .app bundle last (automatically binds CFBundleIdentifier from Info.plist)
  signTarget(appPath, true);
}
