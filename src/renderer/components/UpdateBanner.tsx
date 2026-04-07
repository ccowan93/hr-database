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
      parts.push(<code key={key++} className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{match[3]}</code>);
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
  if (!text) return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No release notes available.</p>;

  // electron-updater returns HTML from GitHub releases; sanitize and render it
  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  if (isHtml) {
    const sanitized = DOMPurify.sanitize(text);
    return (
      <div
        className="release-notes-html space-y-1.5 text-sm text-gray-700 dark:text-gray-300 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-gray-900 dark:[&_h1]:text-gray-100 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-800 dark:[&_h3]:text-gray-200 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_strong]:font-semibold [&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:rounded [&_code]:text-xs"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // Fallback: render as markdown
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        if (trimmed.startsWith('## ')) {
          return <h3 key={i} className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1"><InlineText text={trimmed.slice(3)} /></h3>;
        }
        if (trimmed.startsWith('### ')) {
          return <h4 key={i} className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-0.5"><InlineText text={trimmed.slice(4)} /></h4>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><InlineText text={trimmed.slice(2)} /></span>
            </div>
          );
        }
        return <p key={i}><InlineText text={trimmed} /></p>;
      })}
    </div>
  );
}

/** Modal shown after an update has been installed */
function PostUpdateModal({ version, releaseNotes, onClose }: { version: string; releaseNotes: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Updated to v{version}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">HR Database has been updated successfully</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ReleaseNotes text={releaseNotes} />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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

  // Check if we just updated
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
        <div className={`px-4 py-2.5 flex items-center justify-between text-sm flex-shrink-0 ${
          state === 'downloaded' ? 'bg-emerald-600 text-white' : state === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>

            {state === 'available' && (
              <span>
                A new version is available!{' '}
                <span className="font-semibold">v{update.latestVersion}</span>
                <span className="opacity-75 ml-1">(you have v{update.currentVersion})</span>
              </span>
            )}

            {state === 'downloading' && (
              <div className="flex items-center gap-3 flex-1">
                <span>Downloading update...</span>
                <div className="flex-1 max-w-xs bg-blue-400/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs opacity-75 tabular-nums">{progress}%</span>
              </div>
            )}

            {state === 'downloaded' && (
              <span>
                Update <span className="font-semibold">v{update.latestVersion}</span> is ready to install!
              </span>
            )}

            {state === 'error' && (
              <span>Update failed: {error || 'Unknown error'}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {state === 'available' && (
              <button
                onClick={handleDownload}
                className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
              >
                Download & Install
              </button>
            )}

            {state === 'downloaded' && (
              <button
                onClick={handleInstall}
                className="px-3 py-1 bg-white text-emerald-600 rounded font-medium hover:bg-emerald-50 transition-colors"
              >
                Restart & Install
              </button>
            )}

            {state === 'error' && (
              <>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1 bg-white text-red-600 rounded font-medium hover:bg-red-50 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => api.openReleasePage(update.releaseUrl)}
                  className="px-3 py-1 bg-red-500 text-white rounded font-medium hover:bg-red-400 transition-colors"
                >
                  Manual Download
                </button>
              </>
            )}

            {state !== 'downloading' && (
              <button
                onClick={() => setDismissed(true)}
                className={`p-1 rounded transition-colors ${
                  state === 'downloaded' ? 'hover:bg-emerald-500' : state === 'error' ? 'hover:bg-red-500' : 'hover:bg-blue-500'
                }`}
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
