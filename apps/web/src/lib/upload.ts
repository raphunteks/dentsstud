import { ApiError } from './api';

/** Multipart upload with progress (XHR keeps upload progress events). */
export function uploadFiles(url: string, files: { file: File; path: string }[], onProgress?: (p: number) => void, extra: Record<string, string> = {}) {
  return new Promise<unknown>((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    fd.append('paths', JSON.stringify(files.map((f) => f.path)));
    for (const f of files) fd.append('files', f.file, f.file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/v1${url}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body: { error?: { code?: string; message?: string } } | null = null;
      if (xhr.responseText) {
        try {
          body = JSON.parse(xhr.responseText) as { error?: { code?: string; message?: string } };
        } catch {
          body = null;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? `Upload gagal (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Koneksi terputus saat upload'));
    xhr.send(fd);
  });
}
