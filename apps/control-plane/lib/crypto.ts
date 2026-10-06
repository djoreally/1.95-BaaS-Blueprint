/**
 * AES-256-GCM encryption for secrets at rest (cPanel API tokens).
 *
 * Key: CONTROL_PLANE_ENCRYPTION_KEY env var — 32 random bytes, base64.
 * Generate: `openssl rand -base64 32`. Set it in Vercel env, never in git.
 *
 * Format: base64(iv | authTag | ciphertext), all-in-one string.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const b64 = process.env.CONTROL_PLANE_ENCRYPTION_KEY;
  if (!b64) throw new Error('CONTROL_PLANE_ENCRYPTION_KEY is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('CONTROL_PLANE_ENCRYPTION_KEY must be 32 bytes (base64)');
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const ct = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
