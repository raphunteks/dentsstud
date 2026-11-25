'use client';
import { useQuery } from '@tanstack/react-query';
import { api, fmtBytes, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.15';

interface ReleaseInfo {
  id: string;
  version: string;
  platform: string;
  arch: string;
  filename: string;
  sizeBytes: number;
  checksum?: string;
  releaseNotes?: string | null;
  publishedAt?: string;
  downloadUrl?: string;
}

const TARGETS = [
  { key: 'mac-arm64', title: 'macOS (Apple Silicon)', subtitle: 'M1 / M2 / M3 / M4 (.dmg)', platform: 'darwin', arch: 'arm64' },
  { key: 'mac-x64', title: 'macOS (Intel)', subtitle: 'Prosesor Intel x64 (.dmg)', platform: 'darwin', arch: 'x64' },
  { key: 'win-x64', title: 'Windows (64-bit)', subtitle: 'Windows 10 / 11 (.exe)', platform: 'win32', arch: 'x64' },
] as const;

export default function AboutPage() {
  const releases = useQuery({
    queryKey: ['desktop-releases-latest'],
    queryFn: async () => {
      const results = await Promise.all(
        TARGETS.map(async (t) => {
          try {
            const data = await api<ReleaseInfo | null>(`/releases/latest?platform=${t.platform}&arch=${t.arch}`);
            return [t.key, data] as const;
          } catch {
            return [t.key, null] as const;
          }
        }),
      );
      return Object.fromEntries(results) as Record<(typeof TARGETS)[number]['key'], ReleaseInfo | null>;
    },
  });

  return (
    <>
      <PageHead
        eyebrow="Pengaturan"
        title="Tentang & Unduh Desktop"
        actions={
          <Button variant="ghost" loading={releases.isFetching} onClick={() => releases.refetch()}>
            Cek pembaruan
          </Button>
        }
      />

      <div className="grid gap-6 max-w-4xl">
        <Card className="grid gap-2 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-medium">
              DENTSWEB STUDIO <span className="num text-sm text-muted">web v{VERSION}</span>
            </p>
            <Status value="ACTIVE" label={`v${VERSION}`} />
          </div>
          <p className="text-sm text-muted">
            Create Motion. Powered by DENTSWEB STUDIO. Aplikasi Desktop mendukung render lokal Remotion, mode offline, dan integrasi Claude Code CLI.
          </p>
        </Card>

        <section className="grid gap-3">
          <h2 className="font-display text-xl font-medium">Unduh Aplikasi Desktop Resmi</h2>
          {releases.isError && <ErrorNote error={releases.error} onRetry={() => releases.refetch()} />}
          {releases.isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {TARGETS.map((t) => (
                <Skeleton key={t.key} className="h-44 rounded-card" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {TARGETS.map((t) => {
                const rel = releases.data?.[t.key] ?? null;
                const href = rel?.downloadUrl || (rel?.id ? `/api/v1/releases/${rel.id}/download` : null);
                return (
                  <Card key={t.key} className="flex flex-col justify-between gap-4 p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-semibold">{t.title}</h3>
                        {rel ? <Status value="ACTIVE" label={`v${rel.version}`} /> : <Status value="UNAVAILABLE" label="Belum tersedia" />}
                      </div>
                      <p className="mt-1 text-xs text-muted">{t.subtitle}</p>
                      {rel && (
                        <div className="mt-3 space-y-1 text-xs text-muted">
                          <p className="truncate font-mono" title={rel.filename}>{rel.filename}</p>
                          <p className="num">{fmtBytes(rel.sizeBytes)}{rel.publishedAt ? ` · ${fmtDate(rel.publishedAt)}` : ''}</p>
                          {rel.releaseNotes && <p className="line-clamp-2 pt-1 text-text/80">{rel.releaseNotes}</p>}
                        </div>
                      )}
                    </div>
                    {href ? (
                      <a
                        href={href}
                        className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast hover:brightness-110 transition"
                      >
                        Unduh Installer
                      </a>
                    ) : (
                      <Button variant="ghost" disabled className="w-full">
                        Menunggu rilis admin
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {(() => {
          const withNotes = TARGETS.map((t) => releases.data?.[t.key]).find((r) => r?.releaseNotes?.trim());
          if (!withNotes) return null;
          return (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-medium">Catatan Rilis Terbaru (v{withNotes.version})</h2>
                {withNotes.publishedAt && <span className="font-mono text-xs text-muted">{fmtDate(withNotes.publishedAt)}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted leading-relaxed">{withNotes.releaseNotes}</p>
            </Card>
          );
        })()}
      </div>
    </>
  );
}
