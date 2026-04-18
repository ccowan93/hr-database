import crypto from 'crypto';
import { systemPreferences, safeStorage } from 'electron';
import { getConfig, saveConfig, type AppConfig } from './app-config';
import { initDatabase, closeDatabase } from './database';

const ITERATIONS = 210000;
const HASH_LEN = 32;
const DEK_LEN = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DIGEST = 'sha512';
const MIN_PASSWORD_LENGTH = 6;

export interface AuthStatus {
  configured: boolean;
  touchIdAvailable: boolean;
  touchIdEnabled: boolean;
  encryptionReady: boolean;
}

type AuthCfg = AppConfig['auth'];

export function isAuthConfigured(): boolean {
  const a = getConfig().auth;
  return !!(a && a.passwordHash && a.salt);
}

export function touchIdAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    return systemPreferences.canPromptTouchID();
  } catch {
    return false;
  }
}

export function isTouchIdEnabled(): boolean {
  const a = getConfig().auth;
  return !!(a?.touchIdEnabled && a?.dekSafeStorage && touchIdAvailable() && safeStorage.isEncryptionAvailable());
}

export function getAuthStatus(): AuthStatus {
  const a = getConfig().auth;
  return {
    configured: isAuthConfigured(),
    touchIdAvailable: touchIdAvailable(),
    touchIdEnabled: isTouchIdEnabled(),
    encryptionReady: !!(a?.dekCiphertext && a?.dekIv && a?.dekTag && a?.kekSalt),
  };
}

function deriveKek(password: string, saltHex: string): Buffer {
  return crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), ITERATIONS, HASH_LEN, DIGEST);
}

function hashPassword(password: string, saltHex: string, iterations: number): string {
  return crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, HASH_LEN, DIGEST).toString('hex');
}

function wrapDek(dek: Buffer, kek: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function unwrapDek(password: string, cfg: AuthCfg): Buffer {
  if (!cfg.kekSalt || !cfg.dekCiphertext || !cfg.dekIv || !cfg.dekTag) {
    throw new Error('Database key material missing');
  }
  const kek = deriveKek(password, cfg.kekSalt);
  const iv = Buffer.from(cfg.dekIv, 'base64');
  const ct = Buffer.from(cfg.dekCiphertext, 'base64');
  const tag = Buffer.from(cfg.dekTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function persistWrappedDek(
  updates: {
    passwordHash: string;
    salt: string;
    kekSalt: string;
    wrapped: { ciphertext: string; iv: string; tag: string };
    touchIdEnabled?: boolean;
    dekSafeStorage?: string | null;
  },
) {
  saveConfig({
    auth: {
      passwordHash: updates.passwordHash,
      salt: updates.salt,
      iterations: ITERATIONS,
      kekSalt: updates.kekSalt,
      dekCiphertext: updates.wrapped.ciphertext,
      dekIv: updates.wrapped.iv,
      dekTag: updates.wrapped.tag,
      touchIdEnabled: !!updates.touchIdEnabled,
      ...(updates.dekSafeStorage !== undefined ? { dekSafeStorage: updates.dekSafeStorage } : {}),
    } as any,
  });
}

function encryptDekForTouchId(dek: Buffer): string | null {
  if (!touchIdAvailable() || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.encryptString(dek.toString('hex')).toString('base64');
  } catch {
    return null;
  }
}

function decryptDekFromTouchId(): Buffer | null {
  const cfg = getConfig().auth;
  if (!cfg?.dekSafeStorage) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const hex = safeStorage.decryptString(Buffer.from(cfg.dekSafeStorage, 'base64'));
    return Buffer.from(hex, 'hex');
  } catch {
    return null;
  }
}

let onUnlockHandler: (() => void) | null = null;
export function setOnUnlock(handler: () => void) {
  onUnlockHandler = handler;
}

function runOnUnlock() {
  if (onUnlockHandler) {
    try { onUnlockHandler(); } catch (err) { console.error('[auth] onUnlock handler failed:', err); }
  }
}

function openDbWithDek(dek: Buffer): { ok: boolean; error?: string } {
  try {
    closeDatabase();
    initDatabase(dek.toString('hex'));
    runOnUnlock();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to open encrypted database' };
  }
}

export function setPassword(
  password: string,
  enableTouchId = false,
): { ok: boolean; error?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const kekSalt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const passwordHash = hashPassword(password, salt, ITERATIONS);
  const dek = crypto.randomBytes(DEK_LEN);
  const kek = deriveKek(password, kekSalt);
  const wrapped = wrapDek(dek, kek);
  const dekSafeStorage = (enableTouchId && touchIdAvailable()) ? encryptDekForTouchId(dek) : null;

  persistWrappedDek({
    passwordHash,
    salt,
    kekSalt,
    wrapped,
    touchIdEnabled: !!dekSafeStorage,
    dekSafeStorage,
  });

  return openDbWithDek(dek);
}

function verifyPasswordHash(password: string): boolean {
  const a = getConfig().auth;
  if (!a?.passwordHash || !a?.salt) return false;
  const iterations = a.iterations || ITERATIONS;
  const candidate = Buffer.from(hashPassword(password, a.salt, iterations), 'hex');
  const stored = Buffer.from(a.passwordHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

/** Unlock the app with a password. Opens the encrypted database. */
export function unlockWithPassword(password: string): { ok: boolean; error?: string } {
  const cfg = getConfig().auth;
  if (!cfg?.passwordHash || !cfg?.salt) return { ok: false, error: 'Password not set' };
  if (!verifyPasswordHash(password)) return { ok: false, error: 'Incorrect password' };

  let dek: Buffer;
  if (cfg.dekCiphertext && cfg.dekIv && cfg.dekTag && cfg.kekSalt) {
    try {
      dek = unwrapDek(password, cfg);
    } catch (err: any) {
      return { ok: false, error: 'Failed to unwrap database key' };
    }
  } else {
    // Upgrade path from a v1.6.0 install (password-only, no DEK yet):
    // generate DEK now so we can encrypt the DB on next init.
    dek = crypto.randomBytes(DEK_LEN);
    const kekSalt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const kek = deriveKek(password, kekSalt);
    const wrapped = wrapDek(dek, kek);
    persistWrappedDek({
      passwordHash: cfg.passwordHash,
      salt: cfg.salt,
      kekSalt,
      wrapped,
      touchIdEnabled: !!cfg.touchIdEnabled,
      dekSafeStorage: cfg.touchIdEnabled ? encryptDekForTouchId(dek) : null,
    });
  }

  return openDbWithDek(dek);
}

/** Unlock via Touch ID. Uses safeStorage-encrypted DEK copy. */
export async function unlockWithTouchId(reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!touchIdAvailable()) return { ok: false, error: 'Touch ID is not available on this device' };
  if (!isTouchIdEnabled()) return { ok: false, error: 'Touch ID is not enabled' };

  try {
    await systemPreferences.promptTouchID(reason);
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Touch ID authentication failed' };
  }

  const dek = decryptDekFromTouchId();
  if (!dek) return { ok: false, error: 'Unable to decrypt database key via Touch ID' };
  return openDbWithDek(dek);
}

export function changePassword(
  oldPassword: string,
  newPassword: string,
): { ok: boolean; error?: string } {
  if (!verifyPasswordHash(oldPassword)) return { ok: false, error: 'Current password is incorrect' };
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  const cfg = getConfig().auth;
  if (!cfg) return { ok: false, error: 'Password not configured' };

  // Decrypt current DEK (create one if upgrading)
  let dek: Buffer;
  if (cfg.dekCiphertext && cfg.dekIv && cfg.dekTag && cfg.kekSalt) {
    try {
      dek = unwrapDek(oldPassword, cfg);
    } catch {
      return { ok: false, error: 'Failed to unwrap database key' };
    }
  } else {
    dek = crypto.randomBytes(DEK_LEN);
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const kekSalt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const passwordHash = hashPassword(newPassword, salt, ITERATIONS);
  const kek = deriveKek(newPassword, kekSalt);
  const wrapped = wrapDek(dek, kek);
  const reEncryptForTouchId = cfg.touchIdEnabled ? encryptDekForTouchId(dek) : null;

  persistWrappedDek({
    passwordHash,
    salt,
    kekSalt,
    wrapped,
    touchIdEnabled: !!reEncryptForTouchId,
    dekSafeStorage: reEncryptForTouchId,
  });

  return { ok: true };
}

/** Enable or disable Touch ID. Enabling requires the password (to obtain the DEK). */
export function setTouchIdEnabled(
  enabled: boolean,
  password?: string,
): { ok: boolean; error?: string } {
  if (enabled) {
    if (!touchIdAvailable()) return { ok: false, error: 'Touch ID is not available on this device' };
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Secure key storage is unavailable' };
    if (!password) return { ok: false, error: 'Password is required to enable Touch ID' };
    if (!verifyPasswordHash(password)) return { ok: false, error: 'Incorrect password' };
    const cfg = getConfig().auth;
    if (!cfg?.dekCiphertext || !cfg?.dekIv || !cfg?.dekTag || !cfg?.kekSalt) {
      return { ok: false, error: 'Database key not initialized' };
    }
    let dek: Buffer;
    try { dek = unwrapDek(password, cfg); } catch { return { ok: false, error: 'Failed to unwrap database key' }; }
    const stored = encryptDekForTouchId(dek);
    if (!stored) return { ok: false, error: 'Unable to encrypt key via secure storage' };
    saveConfig({ auth: { touchIdEnabled: true, dekSafeStorage: stored } as any });
    return { ok: true };
  } else {
    saveConfig({ auth: { touchIdEnabled: false, dekSafeStorage: null } as any });
    return { ok: true };
  }
}
