import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/** Locates the official, unmodified Claude Code CLI. Never bundles or patches it. */
export function claudeCandidates(): string[] {
  const home = homedir();
  const extra =
    process.platform === 'win32'
      ? [join(process.env.APPDATA ?? '', 'npm'), join(home, '.local', 'bin'), join(process.env.LOCALAPPDATA ?? '', 'Programs', 'claude')]
      : [join(home, '.local', 'bin'), join(home, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  const dirs = [...(process.env.PATH ?? '').split(delimiter), ...extra].filter(Boolean);
  const names = process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
  return [...new Set(dirs.flatMap((d) => names.map((n) => join(d, n))))].filter((p) => existsSync(p));
}

const run = (file: string, args: string[], timeout: number, input?: string) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const isCmd = file.toLowerCase().endsWith('.cmd');
    // .cmd shims need cmd.exe; arguments are fixed literals, the prompt goes through stdin only.
    const child = isCmd ? spawn('cmd.exe', ['/d', '/s', '/c', `"${file}"`, ...args], { windowsHide: true }) : spawn(file, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });

export async function detectClaudeCode() {
  for (const path of claudeCandidates()) {
    const r = await run(path, ['--version'], 10_000);
    if (r.code === 0) return { installed: true as const, path, version: r.stdout.trim().split(/\s+/)[0] ?? r.stdout.trim() };
  }
  return { installed: false as const };
}

/** Real inference through the member's own Claude Code login. Prompt is sent via stdin. */
export async function askClaudeCode(path: string, prompt: string) {
  const clean = prompt.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 2000);
  const started = Date.now();
  const r = await run(path, ['-p', '--output-format', 'json'], 90_000, clean);
  if (r.code !== 0) {
    const notLoggedIn = /login|auth|credential|api key/i.test(r.stderr + r.stdout);
    return { ok: false as const, authenticated: !notLoggedIn ? null : false, error: (r.stderr || r.stdout).slice(0, 400) || `exit ${r.code}` };
  }
  try {
    const j = JSON.parse(r.stdout) as { result?: string; is_error?: boolean };
    if (j.is_error) return { ok: false as const, authenticated: false, error: String(j.result ?? 'error').slice(0, 400) };
    return { ok: true as const, authenticated: true, answer: j.result ?? '', latencyMs: Date.now() - started };
  } catch {
    return { ok: true as const, authenticated: true, answer: r.stdout.trim(), latencyMs: Date.now() - started };
  }
}
