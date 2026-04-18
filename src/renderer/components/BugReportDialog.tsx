import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type SubmitState = 'idle' | 'opening' | 'saving' | 'submitting' | 'saved' | 'submitted' | 'error';

export default function BugReportDialog({ open, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [logPreview, setLogPreview] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [relayAvailable, setRelayAvailable] = useState(false);
  const [submitted, setSubmitted] = useState<{ issueUrl: string; issueNumber?: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setState('idle');
    setError(null);
    setSavedPath(null);
    setSubmitted(null);
    api.bugGetLogTail(80).then(setLogPreview).catch(() => setLogPreview(''));
    api.bugRelayConfigured().then(setRelayAvailable).catch(() => setRelayAvailable(false));
  }, [open]);

  if (!open) return null;

  const composedBody = () => {
    const lines: string[] = [];
    if (description.trim()) lines.push(description.trim());
    if (stepsToReproduce.trim()) {
      lines.push('');
      lines.push('### Steps to reproduce');
      lines.push(stepsToReproduce.trim());
    }
    return lines.join('\n');
  };

  const handleOpenGithubIssue = async () => {
    setState('opening');
    setError(null);
    try {
      const summary = description.split(/\r?\n/)[0]?.slice(0, 100) || 'Bug report';
      const url = await api.bugGetGithubUrl({ description: composedBody(), summary });
      await api.openReleasePage(url);
      // Give GitHub a moment, then close
      setTimeout(() => {
        setState('idle');
        onClose();
      }, 400);
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Failed to open GitHub issue');
    }
  };

  const handleSubmitToRelay = async () => {
    setState('submitting');
    setError(null);
    try {
      const result = await api.bugSubmitToRelay({
        description,
        stepsToReproduce: stepsToReproduce || undefined,
        includeLogs,
      });
      if (result.success && result.issueUrl) {
        setSubmitted({ issueUrl: result.issueUrl, issueNumber: result.issueNumber });
        setState('submitted');
      } else {
        setState('error');
        setError(result.error || 'Failed to submit report');
      }
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Failed to submit report');
    }
  };

  const handleSaveReport = async () => {
    setState('saving');
    setError(null);
    try {
      const result = await api.bugSaveReport({
        description,
        stepsToReproduce: stepsToReproduce || undefined,
        includeLogs,
      });
      if (result.cancelled) {
        setState('idle');
        return;
      }
      if (result.success) {
        setSavedPath(result.path || null);
        setState('saved');
      } else {
        setState('error');
        setError(result.error || 'Failed to save report');
      }
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Failed to save report');
    }
  };

  const busy = state === 'opening' || state === 'saving' || state === 'submitting';
  const disabled = busy || description.trim().length === 0;

  return (
    <div
      className="kin-modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="kin-modal" style={{ maxWidth: 640, maxHeight: '90vh' }}>
        <div className="kin-modal-head">
          <div style={{ flex: 1 }}>
            <h2 className="kin-modal-title">Report a bug</h2>
            <div className="small muted">
              {relayAvailable
                ? 'Sends your report directly to the dev team — no GitHub account needed.'
                : 'Opens a new issue in the GitHub repo with system info pre-filled.'}
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="kin-modal-body">
          <label className="field">
            <span className="field-label">What went wrong? <span style={{ color: 'var(--danger)' }}>*</span></span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="input"
              style={{ resize: 'vertical' }}
              placeholder="Describe the problem. What did you expect to happen?"
            />
          </label>

          <label className="field">
            <span className="field-label">Steps to reproduce (optional)</span>
            <textarea
              value={stepsToReproduce}
              onChange={e => setStepsToReproduce(e.target.value)}
              rows={3}
              className="input"
              style={{ resize: 'vertical' }}
              placeholder={'1. Go to…\n2. Click…\n3. See error'}
            />
          </label>

          <div className="kin-alert info">
            <div className="kin-alert-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {relayAvailable ? 'Submitted directly to the dev team' : 'GitHub will open in your browser'}
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              {relayAvailable
                ? 'Your report, system info, config snapshot, and recent logs are sent securely. A GitHub issue is created on your behalf — no account required. No employee data is included.'
                : 'Your description and steps are pre-filled, along with app version, platform, and OS. You can review and edit before submitting. No employee data is sent.'}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={includeLogs}
              onChange={e => setIncludeLogs(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Include app logs in saved report</div>
              <div className="small muted">
                If you save a diagnostic bundle below, it will include the last ~400 log lines. Logs are <strong>not</strong> attached to the GitHub issue automatically.
              </div>
              <button
                type="button"
                onClick={() => setShowLogs(v => !v)}
                style={{ background: 'none', border: 0, padding: 0, marginTop: 4, color: 'var(--accent-ink)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showLogs ? 'Hide' : 'Preview'} recent logs
              </button>
              {showLogs && (
                <pre className="mono" style={{ marginTop: 8, maxHeight: 192, overflow: 'auto', fontSize: 11, background: 'var(--surface-2)', color: 'var(--ink)', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
{logPreview || '(no logs yet)'}
                </pre>
              )}
            </div>
          </label>

          {state === 'saved' && savedPath && (
            <div className="kin-alert" style={{ borderColor: 'var(--success)' }}>
              <div className="kin-alert-title" style={{ color: 'var(--success)' }}>Report saved</div>
              <div className="small mono" style={{ wordBreak: 'break-all' }}>{savedPath}</div>
              <div className="small muted" style={{ marginTop: 4 }}>You can attach this file to the GitHub issue.</div>
            </div>
          )}
          {state === 'submitted' && submitted && (
            <div className="kin-alert" style={{ borderColor: 'var(--success)' }}>
              <div className="kin-alert-title" style={{ color: 'var(--success)' }}>
                Report submitted{submitted.issueNumber ? ` (#${submitted.issueNumber})` : ''}
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                Thanks — the dev team has been notified.{' '}
                <a
                  href={submitted.issueUrl}
                  onClick={e => { e.preventDefault(); api.openReleasePage(submitted.issueUrl); }}
                  style={{ color: 'var(--accent-ink)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  View issue
                </a>
              </div>
            </div>
          )}
          {state === 'error' && error && (
            <div className="kin-alert danger">
              <div className="kin-alert-title">Error</div>
              <div className="small">{error}</div>
            </div>
          )}
        </div>

        <div className="kin-modal-foot" style={{ justifyContent: 'space-between' }}>
          {state === 'submitted' ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={handleSaveReport}
              disabled={busy}
              className="btn ghost"
            >
              {state === 'saving' ? 'Saving…' : 'Save diagnostic bundle'}
            </button>
          )}

          <div className="hstack" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn ghost"
            >
              {state === 'submitted' ? 'Close' : 'Cancel'}
            </button>
            {state !== 'submitted' && (
              <button
                type="button"
                onClick={relayAvailable ? handleSubmitToRelay : handleOpenGithubIssue}
                disabled={disabled}
                className="btn primary"
              >
                {state === 'submitting'
                  ? 'Submitting…'
                  : state === 'opening'
                    ? 'Opening…'
                    : relayAvailable
                      ? 'Submit bug report'
                      : 'Open GitHub issue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
