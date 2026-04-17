import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface AuthStatus {
  configured: boolean;
  touchIdAvailable: boolean;
  touchIdEnabled: boolean;
  encryptionReady: boolean;
}

const MIN_PASSWORD_LENGTH = 6;

function LockIcon() {
  return (
    <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function FingerprintIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.597a18.666 18.666 0 01-2.485 5.33" />
    </svg>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableTouchId, setEnableTouchId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touchIdAttempted = useRef(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.authGetStatus().then(s => {
      setStatus(s);
      setEnableTouchId(s.touchIdAvailable);
    }).catch(() => {
      setStatus({ configured: false, touchIdAvailable: false, touchIdEnabled: false, encryptionReady: false });
    });
  }, []);

  const handleTouchIdUnlock = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.authUnlockTouchId('unlock HR Database');
      if (result.ok) {
        setUnlocked(true);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Touch ID failed');
    } finally {
      setBusy(false);
    }
  };

  // Auto-prompt Touch ID on first render of unlock screen
  useEffect(() => {
    if (!status || status.configured === false || unlocked) return;
    if (!status.touchIdEnabled || touchIdAttempted.current) return;
    touchIdAttempted.current = true;
    handleTouchIdUnlock();
  }, [status, unlocked]);

  useEffect(() => {
    if (status && !unlocked && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [status, unlocked]);

  if (!status) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const result = await api.authSetPassword(password, enableTouchId && status.touchIdAvailable);
      if (!result.ok) {
        setError(result.error || 'Failed to set password');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      const next = await api.authGetStatus();
      setStatus(next);
      setUnlocked(true);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.authUnlockPassword(password);
      if (result.ok) {
        setPassword('');
        setUnlocked(true);
      } else {
        setError(result.error || 'Incorrect password');
      }
    } finally {
      setBusy(false);
    }
  };

  const containerClass = 'flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-6';
  const cardClass = 'w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8';
  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const primaryButtonClass = 'w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

  if (!status.configured) {
    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <LockIcon />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Set up app password</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Protect access to employee data on this device</p>
            </div>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter password"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            {status.touchIdAvailable && (
              <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTouchId}
                  onChange={e => setEnableTouchId(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <FingerprintIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Enable Touch ID
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Use your fingerprint to unlock the app instead of typing the password.</p>
                </div>
              </label>
            )}

            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} className={primaryButtonClass}>
              {busy ? 'Saving…' : 'Create password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <LockIcon />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unlock HR Database</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Enter your app password to continue</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              placeholder="App password"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy || !password} className={primaryButtonClass}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>

          {status.touchIdEnabled && (
            <button
              type="button"
              onClick={handleTouchIdUnlock}
              disabled={busy}
              className="w-full px-4 py-2.5 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FingerprintIcon />
              Use Touch ID
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
