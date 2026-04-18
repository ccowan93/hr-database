import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../api';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
  releaseNotes: string;
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

/** Parse inline markdown: **bold** and `code` into React nodes */
function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={key++} className="mono" style={{ padding: '1px 4px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>{match[3]}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

/** Detect whether text is HTML or markdown and render accordingly */
function ReleaseNotes({ text }: { text: string }) {
  if (!text) return <p className="small muted" style={{ fontStyle: 'italic' }}>No release notes available.</p>;

  // electron-updater returns HTML from GitHub releases; sanitize and render it
  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  if (isHtml) {
    const sanitized = DOMPurify.sanitize(text);
    return (
      <div
        className="release-notes-html"
        style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // Fallback: render as markdown
  const lines = text.split('\n');
  return (
    <div className="vstack" style={{ gap: 6, fontSize: 13, color: 'var(--ink-2)' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 8 }} />;

        if (trimmed.startsWith('## ')) {
          return <h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 12, marginBottom: 4 }}><InlineText text={trimmed.slice(3)} /></h3>;
        }
        if (trimmed.startsWith('### ')) {
          return <h4 key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 8, marginBottom: 2 }}><InlineText text={trimmed.slice(4)} /></h4>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 8 }}>
              <span style={{ color: 'var(--ink-4)', marginTop: 2 }}>•</span>
              <span><InlineText text={trimmed.slice(2)} /></span>
            </div>
          );
        }
        return <p key={i} style={{ margin: 0 }}><InlineText text={trimmed} /></p>;
      })}
    </div>
  );
}

/** Modal shown after an update has been installed */
function PostUpdateModal({ version, releaseNotes, onClose }: { version: string; releaseNotes: string; onClose: () => void }) {
  return (
    <div
      className="kin-modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="kin-modal" style={{ maxWidth: 520, maxHeight: '80vh' }}>
        <div className="kin-modal-head">
          <div className="hstack" style={{ gap: 10, alignItems: 'center', flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke="var(--success)" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="kin-modal-title">Updated to v{version}</h2>
              <div className="small muted">HR Database has been updated successfully</div>
            </div>
          </div>
        </div>

        <div className="kin-modal-body">
          <ReleaseNotes text={releaseNotes} />
        </div>

        <div className="kin-modal-foot">
          <button
            onClick={onClose}
            className="btn primary"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<UpdateState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [postUpdate, setPostUpdate] = useState<{ version: string; releaseNotes: string } | null>(null);

  useEffect(() => {
    api.getPostUpdateInfo().then(info => {
      if (info) setPostUpdate(info);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const info = await api.checkForUpdates();
        if (info && info.isOutdated) {
          setUpdate(info);
          setState('available');
        }
      } catch {
        // Silently fail
      }
    };

    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const removeProgress = api.onUpdateDownloadProgress((p) => {
      setProgress(Math.round(p.percent));
    });
    const removeDownloaded = api.onUpdateDownloaded(() => {
      setState('downloaded');
      setProgress(100);
    });
    const removeError = api.onUpdateError((msg) => {
      setState('error');
      setError(msg);
    });

    return () => {
      removeProgress();
      removeDownloaded();
      removeError();
    };
  }, []);

  const handleDownload = async () => {
    setState('downloading');
    setProgress(0);
    setError(null);
    try {
      await api.downloadUpdate();
    } catch {
      setState('error');
      setError('Download failed. Try downloading manually.');
    }
  };

  const handleInstall = () => {
    api.installUpdate(update?.releaseNotes, update?.latestVersion);
  };

  const bannerBg = state === 'downloaded' ? 'var(--success)' : state === 'error' ? 'var(--danger)' : 'var(--accent)';

  return (
    <>
      {postUpdate && (
        <PostUpdateModal
          version={postUpdate.version}
          releaseNotes={postUpdate.releaseNotes}
          onClose={() => setPostUpdate(null)}
        />
      )}

      {update && update.isOutdated && !dismissed && (
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            flexShrink: 0,
            background: bannerBg,
            color: '#fff',
          }}
        >
          <div className="hstack" style={{ gap: 12, flex: 1, minWidth: 0, alignItems: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>

            {state === 'available' && (
              <span>
                A new version is available!{' '}
                <span style={{ fontWeight: 600 }}>v{update.latestVersion}</span>
                <span style={{ opacity: 0.75, marginLeft: 4 }}>(you have v{update.currentVersion})</span>
              </span>
            )}

            {state === 'downloading' && (
              <div className="hstack" style={{ gap: 12, flex: 1, alignItems: 'center' }}>
                <span>Downloading update...</span>
                <div style={{ flex: 1, maxWidth: 320, background: 'rgba(255,255,255,0.3)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div
                    style={{ background: '#fff', height: '100%', borderRadius: 999, transition: 'width 300ms', width: `${progress}%` }}
                  />
                </div>
                <span style={{ fontSize: 11, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
              </div>
            )}

            {state === 'downloaded' && (
              <span>
                Update <span style={{ fontWeight: 600 }}>v{update.latestVersion}</span> is ready to install!
              </span>
            )}

            {state === 'error' && (
              <span>Update failed: {error || 'Unknown error'}</span>
            )}
          </div>

          <div className="hstack" style={{ gap: 8, flexShrink: 0, marginLeft: 12, alignItems: 'center' }}>
            {state === 'available' && (
              <button
                onClick={handleDownload}
                style={{ padding: '4px 12px', background: '#fff', color: 'var(--accent)', borderRadius: 'var(--radius-sm)', fontWeight: 500, border: 0, cursor: 'pointer', fontSize: 12 }}
              >
                Download & Install
              </button>
            )}

            {state === 'downloaded' && (
              <button
                onClick={handleInstall}
                style={{ padding: '4px 12px', background: '#fff', color: 'var(--success)', borderRadius: 'var(--radius-sm)', fontWeight: 500, border: 0, cursor: 'pointer', fontSize: 12 }}
              >
                Restart & Install
              </button>
            )}

            {state === 'error' && (
              <>
                <button
                  onClick={handleDownload}
                  style={{ padding: '4px 12px', background: '#fff', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontWeight: 500, border: 0, cursor: 'pointer', fontSize: 12 }}
                >
                  Retry
                </button>
                <button
                  onClick={() => api.openReleasePage(update.releaseUrl)}
                  style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
                >
                  Manual Download
                </button>
              </>
            )}

            {state !== 'downloading' && (
              <button
                onClick={() => setDismissed(true)}
                style={{ padding: 4, borderRadius: 'var(--radius-sm)', background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Dismiss"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
