import { createPublicKey, verify } from 'node:crypto';

export interface ProofPayload {
  sub: string;
  lic: string;
  dev: string;
  exp: number;
  ent: Record<string, unknown>;
}

/** Verifies an EdDSA (Ed25519) offline license JWT issued by the API. */
export function verifyProof(token: string, publicKeyPem: string, now = Date.now()): ProofPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { alg?: string };
    if (header.alg !== 'EdDSA') return null;
    const ok = verify(null, Buffer.from(`${h}.${p}`), createPublicKey(publicKeyPem), Buffer.from(s, 'base64url'));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as ProofPayload & { iss?: string; aud?: string };
    if (payload.iss !== 'dentweb-studio' || payload.aud !== 'dentweb-desktop') return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}
