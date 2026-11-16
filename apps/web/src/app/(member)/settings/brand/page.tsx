'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Field, Input, PageHead, Skeleton } from '@/components/ui';
import { Textarea } from '@/components/ui/extra';

interface Brand { name: string; instagramUsername: string | null; openingText: string | null; closingText: string | null; captionCta: string | null; brandSettings: { colors?: string[]; tone?: string | null } }

export default function BrandPage() {
  const q = useQuery({ queryKey: ['brand'], queryFn: () => api<Brand>('/settings/brand') });
  const [f, setF] = useState<Brand | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const save = useMutation({ mutationFn: () => api('/settings/brand', { method: 'PUT', json: { ...f, brandSettings: { colors: f!.brandSettings.colors ?? [], tone: f!.brandSettings.tone ?? null } } }), onSuccess: () => toast.success('Brand disimpan'), onError: (e) => toast.error((e as Error).message) });
  if (!f) return <Skeleton className="h-96 rounded-card" />;
  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const colors = f.brandSettings.colors ?? [];
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Brand & akun" />
      <Card className="max-w-3xl p-6">
        <p className="mb-5 text-sm text-muted">Kosongkan kolom mana pun agar tim AI memilih otomatis.</p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), save.mutate())}>
          <Field id="b-name" label="Nama brand"><Input id="b-name" value={f.name} onChange={set('name')} /></Field>
          <Field id="b-ig" label="Username Instagram"><Input id="b-ig" value={f.instagramUsername ?? ''} onChange={set('instagramUsername')} placeholder="@namaakun" /></Field>
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
          <div className="sm:col-span-2"><Button type="submit" loading={save.isPending}>Simpan brand</Button></div>
        </form>
      </Card>
    </>
  );
}
