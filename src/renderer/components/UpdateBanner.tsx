import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check on mount, then every 6 hours
    const check = async () => {
      try {
        const info = await api.checkForUpdates();
        if (info && info.isOutdated) {
          setUpdate(info);
        }
      } catch {
        // Silently fail - don't bother user if check fails
      }
    };

    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!update || !update.isOutdated || dismissed) return null;

  return (
    <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
        <span>
          A new version of HR Database is available!{' '}
          <span className="font-semibold">v{update.latestVersion}</span>
          <span className="opacity-75 ml-1">(you have v{update.currentVersion})</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => api.openReleasePage(update.releaseUrl)}
          className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
        >
          Download Update
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-blue-500 rounded transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
