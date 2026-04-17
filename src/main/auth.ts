import crypto from 'crypto';
import { systemPreferences } from 'electron';
import { getConfig, saveConfig } from './app-config';

const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = 'sha512';
const SALT_BYTES = 16;
const MIN_PASSWORD_LENGTH = 6;

export interface AuthStatus {
  configured: boolean;
  touchIdAvailable: boolean;
  touchIdEnabled: boolean;
}

export function isAuthConfigured(): boolean {
  const auth = getConfig().auth;
  return !!(auth && auth.passwordHash && auth.salt);
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
  return !!getConfig().auth?.touchIdEnabled && touchIdAvailable();
}

export function getAuthStatus(): AuthStatus {
  return {
    configured: isAuthConfigured(),
    touchIdAvailable: touchIdAvailable(),
    touchIdEnabled: isTouchIdEnabled(),
  };
}

function hashPassword(password: string, salt: string, iterations: number): string {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString('hex');
}

export function setPassword(password: string, enableTouchId = false): { ok: boolean; error?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const passwordHash = hashPassword(password, salt, ITERATIONS);
  saveConfig({
    auth: {
      passwordHash,
      salt,
      iterations: ITERATIONS,
      touchIdEnabled: enableTouchId && touchIdAvailable(),
    } as any,
  });
  return { ok: true };
}

export function verifyPassword(password: string): boolean {
  const auth = getConfig().auth;
  if (!auth?.passwordHash || !auth?.salt) return false;
  const iterations = auth.iterations || ITERATIONS;
  const candidate = Buffer.from(hashPassword(password, auth.salt, iterations), 'hex');
  const stored = Buffer.from(auth.passwordHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

export function changePassword(oldPassword: string, newPassword: string): { ok: boolean; error?: string } {
  if (!verifyPassword(oldPassword)) return { ok: false, error: 'Current password is incorrect' };
  const prevTouchId = isTouchIdEnabled();
  return setPassword(newPassword, prevTouchId);
}

export async function promptTouchId(reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!touchIdAvailable()) return { ok: false, error: 'Touch ID is not available on this device' };
  try {
    await systemPreferences.promptTouchID(reason);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Touch ID authentication failed' };
  }
}

export function setTouchIdEnabled(enabled: boolean): { ok: boolean; error?: string } {
  if (enabled && !touchIdAvailable()) {
    return { ok: false, error: 'Touch ID is not available on this device' };
  }
  if (!isAuthConfigured()) {
    return { ok: false, error: 'Set a password before enabling Touch ID' };
  }
  saveConfig({ auth: { touchIdEnabled: enabled } as any });
  return { ok: true };
}
