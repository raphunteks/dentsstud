import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV } from './tokens.js';
import type { Env } from '../config/env.js';

export interface StoredObject {
  key: string;
  size: number;
  sha256: string;
}

/** Object storage with content-addressed keys. Local driver serves signed URLs through /api/v1/files. */
@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly s3?: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.root = resolve(env.STORAGE_DIR);
    if (env.STORAGE_DRIVER === 's3') {
      if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw new Error('S3_* belum lengkap untuk STORAGE_DRIVER=s3');
      this.s3 = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      });
    }
  }

  get driver() {
    return this.env.STORAGE_DRIVER;
  }

  /** Absolute path for a scratch area (staging, render temp). Always under STORAGE_DIR. */
  scratch(...parts: string[]) {
    const p = resolve(this.root, '_scratch', ...parts);
    if (!p.startsWith(resolve(this.root, '_scratch'))) throw new Error('Path di luar scratch');
    return p;
  }

  private localPath(key: string) {
    const p = resolve(this.root, 'objects', key);
    if (!p.startsWith(resolve(this.root, 'objects') + '/')) throw new Error('Key tidak valid');
    return p;
  }

  static async hashFile(path: string) {
    const h = createHash('sha256');
    await pipeline(createReadStream(path), h);
    return h.digest('hex');
  }

  /** Stores a local file under a key. Moves (local) or uploads (s3). */
  async putFile(key: string, file: string, mime: string, opts: { move?: boolean } = {}): Promise<StoredObject> {
    const { size } = await stat(file);
    const sha = await StorageService.hashFile(file);
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key, Body: createReadStream(file), ContentType: mime, ContentLength: size, ChecksumSHA256: Buffer.from(sha, 'hex').toString('base64') }));
      if (opts.move) await rm(file, { force: true });
    } else {
      const dest = this.localPath(key);
      await mkdir(dirname(dest), { recursive: true });
      if (opts.move) await rename(file, dest).catch(async () => (await copyFile(file, dest), rm(file, { force: true })));
      else await copyFile(file, dest);
    }
    return { key, size, sha256: sha };
  }

  async putBuffer(key: string, buf: Buffer, mime: string): Promise<StoredObject> {
    const tmp = this.scratch('buf', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dirname(tmp), { recursive: true });
    await pipeline(async function* () { yield buf; }, createWriteStream(tmp));
    return this.putFile(key, tmp, mime, { move: true });
  }

  async exists(key: string) {
    try {
      if (this.s3) {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
        return true;
      }
      await stat(this.localPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<Readable> {
    if (this.s3) {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      return r.Body as Readable;
    }
    return createReadStream(this.localPath(key));
  }

  /** Copies an object to a local file (render workers need files on disk). */
  async download(key: string, dest: string) {
    await mkdir(dirname(dest), { recursive: true });
    await pipeline(await this.read(key), createWriteStream(dest));
    return dest;
  }

  async remove(key: string) {
    if (this.s3) await this.s3.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
    else await rm(this.localPath(key), { force: true });
  }

  private sign(payload: string) {
    return createHmac('sha256', this.env.SECRETS_MASTER_KEY).update(`file:${payload}`).digest('base64url');
  }

  /** Short-lived URL (default 10 minutes). */
  async signedUrl(key: string, opts: { ttlSec?: number; filename?: string; mime?: string } = {}) {
    const ttl = opts.ttlSec ?? 600;
    if (this.s3) {
      return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key, ResponseContentDisposition: opts.filename ? `attachment; filename="${opts.filename}"` : undefined }), { expiresIn: ttl });
    }
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const k = Buffer.from(key).toString('base64url');
    const fn = opts.filename ? Buffer.from(opts.filename).toString('base64url') : '';
    const sig = this.sign(`${k}.${exp}.${fn}`);
    return `/api/v1/files/${k}?exp=${exp}${fn ? `&fn=${fn}` : ''}&sig=${sig}`;
  }

  verifySigned(k: string, exp: string, fn: string | undefined, sig: string): string | null {
    if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(`${k}.${exp}.${fn ?? ''}`));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    return Buffer.from(k, 'base64url').toString();
  }

  localFile(key: string) {
    return this.localPath(key);
  }
}

export const objectKeyFor = (sha: string, ext: string) => `media/${sha.slice(0, 2)}/${sha}.${ext}`;

