'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Card, ErrorNote, Field, Input, PageHead, Skeleton } from '@/components/ui';
import { Textarea } from '@/components/ui/extra';

interface Brand {
  name: string;
  instagramUsername: string | null;
  openingText: string | null;
  closingText: string | null;
  captionCta: string | null;
  brandSettings: { colors?: string[]; tone?: string | null; logoAssetId?: string | null };
}

export default function BrandPage() {
  const qc = useQueryClient();
  const session = useSession();
  const q = useQuery({ queryKey: ['brand'], queryFn: () => api<Brand>('/settings/brand') });
  const [f, setF] = useState<Brand | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);

  useEffect(() => {
    if (session.data?.user.displayName) setDisplayName(session.data.user.displayName);
  }, [session.data?.user.displayName]);

  const saveBrand = useMutation({
    mutationFn: () =>
      api('/settings/brand', {
        method: 'PUT',
        json: {
          ...f,
          brandSettings: {
            colors: f!.brandSettings.colors ?? [],
            tone: f!.brandSettings.tone ?? null,
            logoAssetId: f!.brandSettings.logoAssetId ?? null,
          },
        },
      }),
    onSuccess: () => {
      toast.success('Brand disimpan');
      qc.invalidateQueries({ queryKey: ['brand'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveProfile = useMutation({
    mutationFn: () => api('/me', { method: 'PATCH', json: { displayName: displayName.trim() } }),
    onSuccess: () => {
      toast.success('Nama profil diperbarui');
      qc.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api('/auth/password/change', {
        method: 'POST',
        json: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      toast.success('Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadLogo = async (file: File | undefined) => {
    if (!file || !f) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar (PNG, JPG, WebP)');
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch('/api/v1/media', { method: 'POST', body: fd, credentials: 'include' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Upload logo gagal');
      const m = body as { id: string; url?: string };
      setF({ ...f, brandSettings: { ...f.brandSettings, logoAssetId: m.id } });
      setLogoPreview(m.url ?? URL.createObjectURL(file));
      toast.success('Logo diunggah. Klik "Simpan brand" untuk menerapkan.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (q.isError) return <><PageHead eyebrow="Pengaturan" title="Brand & akun" /><ErrorNote error={q.error} onRetry={() => q.refetch()} /></>;
  if (!f) return <Skeleton className="h-96 rounded-card" />;

  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const colors = f.brandSettings.colors ?? [];

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Brand & akun" />
      <div className="grid max-w-4xl gap-6">
        <Card className="p-6">
          <h2 className="font-display text-lg font-medium">Identitas Brand & Watermark</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Kosongkan kolom mana pun agar tim AI memilih otomatis.</p>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), saveBrand.mutate())}>
            <Field id="b-name" label="Nama brand"><Input id="b-name" value={f.name} onChange={set('name')} /></Field>
            <Field id="b-ig" label="Username Instagram"><Input id="b-ig" value={f.instagramUsername ?? ''} onChange={set('instagramUsername')} placeholder="@namaakun" /></Field>
            <div className="sm:col-span-2">
              <Field id="b-logo" label="Logo / Watermark video" hint="Format PNG transparan, JPG, atau WebP. Otomatis tampil di pojok video Remotion.">
                <div className="flex flex-wrap items-center gap-3">
                  {logoPreview && (
                    <img src={logoPreview} alt="Preview logo" className="h-12 w-12 rounded-lg border border-line object-contain bg-surface-2 p-1" />
                  )}
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-4 text-sm hover:bg-surface-2">
                    {uploadingLogo ? 'Mengunggah…' : f.brandSettings.logoAssetId ? 'Ganti logo' : 'Unggah logo'}
                    <input id="b-logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
                  </label>
                  {f.brandSettings.logoAssetId && (
                    <>
                      <span className="font-mono text-xs text-muted">Asset: {f.brandSettings.logoAssetId.slice(0, 8)}…</span>
                      <Button
                        type="button"
                        variant="quiet"
                        className="h-9 text-xs text-bad"
                        onClick={() => {
                          setF({ ...f, brandSettings: { ...f.brandSettings, logoAssetId: null } });
                          setLogoPreview(null);
                        }}
                      >
                        Hapus logo
                      </Button>
                    </>
                  )}
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2"><Field id="b-open" label="Kalimat pembuka"><Textarea id="b-open" value={f.openingText ?? ''} onChange={set('openingText')} className="min-h-16" /></Field></div>
            <div className="sm:col-span-2"><Field id="b-close" label="Kalimat penutup"><Textarea id="b-close" value={f.closingText ?? ''} onChange={set('closingText')} className="min-h-16" /></Field></div>
            <div className="sm:col-span-2"><Field id="b-cta" label="CTA caption"><Input id="b-cta" value={f.captionCta ?? ''} onChange={set('captionCta')} /></Field></div>
            <Field id="b-tone" label="Gaya bahasa"><Input id="b-tone" value={f.brandSettings.tone ?? ''} onChange={(e) => setF({ ...f, brandSettings: { ...f.brandSettings, tone: e.target.value } })} placeholder="santai, ilmiah, ramah" /></Field>
            <fieldset className="grid gap-1.5">
              <legend className="text-[13px] font-medium">Warna brand (maks. 6)</legend>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <input type="color" aria-label={`Warna ${i + 1}`} value={c} onChange={(e) => setF({ ...f, brandSettings: { ...f.brandSettings, colors: colors.map((x, k) => (k === i ? e.target.value : x)) } })} className="size-9 rounded" />
                    <button type="button" aria-label={`Hapus warna ${i + 1}`} onClick={() => setF({ ...f, brandSettings: { ...f.brandSettings, colors: colors.filter((_, k) => k !== i) } })} className="text-xs text-muted">✕</button>
                  </span>
                ))}
                {colors.length < 6 && <Button type="button" variant="ghost" className="h-9" onClick={() => setF({ ...f, brandSettings: { ...f.brandSettings, colors: [...colors, '#8c6418'] } })}>Tambah warna</Button>}
              </div>
            </fieldset>
            <div className="sm:col-span-2"><Button type="submit" loading={saveBrand.isPending}>Simpan brand</Button></div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-medium">Profil Akun</h2>
          <p className="mt-1 text-sm text-muted">Kelola nama tampilan dan keamanan password akun Anda.</p>

          <form
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!displayName.trim()) return toast.error('Nama tampilan tidak boleh kosong');
              saveProfile.mutate();
            }}
          >
            <Field id="acc-name" label="Nama tampilan" hint={session.data?.user.email ? `Email: ${session.data.user.email}` : undefined}>
              <Input id="acc-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
            </Field>
            <Button type="submit" loading={saveProfile.isPending} className="h-11">
              Simpan profil
            </Button>
          </form>

          <div className="my-6 h-px bg-line" />

          <h3 className="text-sm font-semibold">Ubah Password</h3>
          <form
            className="mt-3 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!currentPassword) return toast.error('Masukkan password saat ini');
              if (newPassword.length < 8) return toast.error('Password baru minimal 8 karakter');
              changePassword.mutate();
            }}
          >
            <Field id="pw-cur" label="Password saat ini">
              <Input id="pw-cur" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </Field>
            <Field id="pw-new" label="Password baru" hint="Minimal 8 karakter">
              <Input id="pw-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="ghost" loading={changePassword.isPending}>
                Perbarui password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
