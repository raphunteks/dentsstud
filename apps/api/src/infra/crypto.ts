import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const otpCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** AES-256-GCM envelope: v1.<iv>.<tag>.<ciphertext> (base64url). */
export class Cipher {
  private readonly key: Buffer;
  constructor(masterKeyBase64: string) {
    this.key = Buffer.from(masterKeyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('SECRETS_MASTER_KEY must decode to 32 bytes');
  }
  encrypt(plain: string, aad = ''): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    c.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
  }
  decrypt(payload: string, aad = ''): string {
    const [v, iv, tag, ct] = payload.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unsupported ciphertext');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  }
}

/** Remove anything that looks like a credential before logging/returning errors. */
export function redact(input: string): string {
  return input
    .replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, 'sk-ant-***')
    .replace(/(authorization|x-api-key|api[_-]?key|token|secret|password)(["':=\s]+)([^"',\s]+)/gi, '$1$2***');
}
