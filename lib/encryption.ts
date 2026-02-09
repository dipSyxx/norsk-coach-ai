import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_KEY_VERSION = 1;

function getKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;

  // Support hex (64 chars) or base64.
  let decoded: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    decoded = Buffer.from(raw, "hex");
  } else {
    decoded = Buffer.from(raw, "base64");
  }

  return decoded.length === KEY_LENGTH ? decoded : null;
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns payload string "v1:base64(iv+authTag+ciphertext)".
 * If DATA_ENCRYPTION_KEY is not set, returns plaintext and keyVersion 0 (no encryption).
 */
export function encrypt(plaintext: string): { payload: string; keyVersion: number } {
  const key = getKey();
  if (!key || key.length !== KEY_LENGTH) {
    return { payload: plaintext, keyVersion: 0 };
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return {
    payload: `${CURRENT_KEY_VERSION}:${payload.toString("base64")}`,
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Decrypt payload. If keyVersion is 0 or missing, returns payload as-is (plaintext).
 */
export function decrypt(payload: string, keyVersion: number): string {
  if (!keyVersion || keyVersion === 0) {
    return payload;
  }

  const key = getKey();
  if (!key || key.length !== KEY_LENGTH) {
    return payload;
  }

  const colon = payload.indexOf(":");
  const base64 = colon >= 0 ? payload.slice(colon + 1) : payload;
  const buf = Buffer.from(base64, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    return payload;
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function isEncryptionRequired(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isEncryptionReadyForRuntime(): boolean {
  return !isEncryptionRequired() || isEncryptionEnabled();
}
