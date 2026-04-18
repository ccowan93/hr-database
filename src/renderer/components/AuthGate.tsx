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
    <svg style={{ width: 22, height: 22, color: 'var(--accent-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function FingerprintIcon({ size = 16 }: { size?: number }) {
  return (
    <svg style={{ width: size, height: size }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
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

  const shellStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: 24,
  };

  if (!status) {
    return (
      <div style={shellStyle}>
        <div className="small muted">Loading…</div>
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

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 440,
    padding: 32,
  };

  const iconWrapStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--accent-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const errorBanner = (
    <div className="banner" style={{ borderColor: 'color-mix(in oklch, var(--danger) 40%, transparent)', background: 'color-mix(in oklch, var(--danger) 10%, var(--surface))', color: 'var(--danger)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 16, height: 16, flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span style={{ fontSize: 13 }}>{error}</span>
    </div>
  );

  if (!status.configured) {
    return (
      <div style={shellStyle}>
        <div className="card" style={cardStyle}>
          <div className="hstack" style={{ gap: 14, marginBottom: 22 }}>
            <div style={iconWrapStyle}><LockIcon /></div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Set up app password</h1>
              <p className="small muted" style={{ margin: '2px 0 0' }}>Protect access to employee data on this device</p>
            </div>
          </div>

          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="field-label">New password</label>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="field-label">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Re-enter password"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            {status.touchIdAvailable && (
              <label
                className="hstack"
                style={{
                  gap: 10,
                  padding: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  alignItems: 'flex-start',
                }}
              >
                <input
                  type="checkbox"
                  checked={enableTouchId}
                  onChange={e => setEnableTouchId(e.target.checked)}
                  disabled={busy}
                  style={{ marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <div className="hstack" style={{ gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    <FingerprintIcon size={14} />
                    Enable Touch ID
                  </div>
                  <p className="small muted" style={{ margin: '2px 0 0' }}>Use your fingerprint to unlock the app instead of typing the password.</p>
                </div>
              </label>
            )}

            {error && errorBanner}

            <button type="submit" disabled={busy} className="btn primary" style={{ justifyContent: 'center', padding: '10px 16px' }}>
              {busy ? 'Saving…' : 'Create password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div className="card" style={cardStyle}>
        <div className="hstack" style={{ gap: 14, marginBottom: 22 }}>
          <div style={iconWrapStyle}><LockIcon /></div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Unlock HR Database</h1>
            <p className="small muted" style={{ margin: '2px 0 0' }}>Enter your app password to continue</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field-label">Password</label>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="App password"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && errorBanner}

          <button type="submit" disabled={busy || !password} className="btn primary" style={{ justifyContent: 'center', padding: '10px 16px' }}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>

          {status.touchIdEnabled && (
            <button
              type="button"
              onClick={handleTouchIdUnlock}
              disabled={busy}
              className="btn"
              style={{ justifyContent: 'center', padding: '10px 16px', gap: 8 }}
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
