import crypto from 'crypto';
import { config } from '@/config';

/**
 * Envelope encryption for target database credentials.
 *
 *  - A random 256-bit Data Encryption Key (DEK) is generated per credential.
 *  - The secret (DB password) is encrypted with AES-256-GCM under the DEK.
 *  - The DEK is itself wrapped (encrypted) under the master Key Encryption Key (KEK).
 *  - Only the wrapped DEK + ciphertext + iv + authTag are persisted. Plaintext never is.
 *
 * In production the KEK should live in KMS/Vault and `wrapDek`/`unwrapDek` should call it.
 * Here we implement local AES-256-GCM wrapping with a KEK from config (KMS-swappable).
 */

const ALGO = 'aes-256-gcm';

function getKek(): Buffer {
  const key = Buffer.from(config.crypto.masterKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_MASTER_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

export interface EncryptedSecret {
  ciphertext: string; // base64
  authTag: string; // base64
  iv: string; // base64
  dekWrapped: string; // base64 (iv:authTag:cipher of the DEK under KEK)
  keyVersion: string;
}

function aesEncrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; tag: Buffer; data: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, data };
}

function aesDecrypt(key: Buffer, iv: Buffer, tag: Buffer, data: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function wrapDek(dek: Buffer): string {
  const { iv, tag, data } = aesEncrypt(getKek(), dek);
  // pack iv:tag:cipher as base64 segments
  return [iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
}

function unwrapDek(wrapped: string): Buffer {
  const [iv, tag, data] = wrapped.split(':');
  return aesDecrypt(getKek(), Buffer.from(iv, 'base64'), Buffer.from(tag, 'base64'), Buffer.from(data, 'base64'));
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const dek = crypto.randomBytes(32);
  const { iv, tag, data } = aesEncrypt(dek, Buffer.from(plaintext, 'utf8'));
  const result: EncryptedSecret = {
    ciphertext: data.toString('base64'),
    authTag: tag.toString('base64'),
    iv: iv.toString('base64'),
    dekWrapped: wrapDek(dek),
    keyVersion: config.crypto.keyVersion,
  };
  // best-effort wipe
  dek.fill(0);
  return result;
}

export function decryptSecret(enc: EncryptedSecret): string {
  const dek = unwrapDek(enc.dekWrapped);
  try {
    const plaintext = aesDecrypt(
      dek,
      Buffer.from(enc.iv, 'base64'),
      Buffer.from(enc.authTag, 'base64'),
      Buffer.from(enc.ciphertext, 'base64'),
    );
    return plaintext.toString('utf8');
  } finally {
    dek.fill(0);
  }
}

/** SHA-256 hex of a buffer/string — used for audit hash chain and artifact checksums. */
export function sha256(input: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Hash an API key for at-rest storage. */
export function hashApiKey(raw: string): string {
  return sha256(raw);
}
