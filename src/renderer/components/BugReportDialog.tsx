import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type SubmitState = 'idle' | 'saving' | 'saved' | 'error';

export default function BugReportDialog({ open, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [email, setEmail] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [logPreview, setLogPreview] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setState('idle');
    setError(null);
    setSavedPath(null);
    api.bugGetLogTail(80).then(setLogPreview).catch(() => setLogPreview(''));
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setState('saving');
    setError(null);
    try {
      const result = await api.bugSaveReport({
        description,
        email: email || undefined,
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

  const handleOpenGithubIssue = async () => {
    const summary = description.split(/\r?\n/)[0]?.slice(0, 100) || 'Bug report';
    const url = await api.bugGetGithubUrl({ description, summary });
    await api.openReleasePage(url);
  };

  const disabled = state === 'saving' || description.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Report a bug</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Save a diagnostic bundle and optionally open a GitHub issue.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What went wrong? <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="Describe the problem. What did you expect to happen?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Steps to reproduce (optional)</label>
            <textarea
              value={stepsToReproduce}
              onChange={e => setStepsToReproduce(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder={'1. Go to…\n2. Click…\n3. See error'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="So we can follow up if needed"
            />
          </div>

          <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              checked={includeLogs}
              onChange={e => setIncludeLogs(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Include app logs</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Attaches the last ~400 log lines (app version, OS, errors). Employee data is not included.
              </p>
              <button
                type="button"
                onClick={() => setShowLogs(v => !v)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                {showLogs ? 'Hide' : 'Preview'} recent logs
              </button>
              {showLogs && (
                <pre className="mt-2 max-h-48 overflow-auto text-xs bg-gray-900 text-gray-100 p-2 rounded">
{logPreview || '(no logs yet)'}
                </pre>
              )}
            </div>
          </label>

          {state === 'saved' && savedPath && (
            <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
              Report saved to <span className="font-mono text-xs break-all">{savedPath}</span>
            </div>
          )}
          {state === 'error' && error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 justify-between">
          <button
            type="button"
            onClick={handleOpenGithubIssue}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Open GitHub issue…
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === 'saving' ? 'Saving…' : 'Save report…'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
