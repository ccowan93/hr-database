import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showReset, setShowReset] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.resetDatabase();
      navigate('/');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to reset database.');
      setResetting(false);
    }
  };

  const openReset = () => {
    setShowReset(true);
    setStep(1);
    setConfirmText('');
  };

  const closeReset = () => {
    setShowReset(false);
    setStep(1);
    setConfirmText('');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Appearance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Customize how the app looks.</p>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark themes.</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Data Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Backup and restore your database.</p>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backup Database</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Export the entire database to a file for safekeeping.</p>
            </div>
            <button
              onClick={async () => {
                const result = await api.backupDatabase();
                if (result.success) alert(`Backup saved to ${result.path}`);
                else if (result.error !== 'Cancelled') alert('Backup failed: ' + result.error);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              Backup
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Restore from Backup</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Replace current data with a previously saved backup file.</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('This will replace ALL current data with the backup. Continue?')) return;
                const result = await api.restoreDatabase();
                if (result.success) {
                  alert('Database restored successfully.');
                  window.location.reload();
                } else if (result.error !== 'Cancelled') {
                  alert('Restore failed: ' + result.error);
                }
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors flex-shrink-0"
            >
              Restore
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">Danger Zone</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Irreversible actions that affect your entire database.</p>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Reset Application</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Delete all employees, pay history, and audit logs. This cannot be undone.</p>
            </div>
            <button
              onClick={openReset}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex-shrink-0"
            >
              Reset App
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeReset}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[440px] p-6" onClick={e => e.stopPropagation()}>
            {step === 1 && (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Reset Application?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  This will permanently delete <span className="font-semibold text-red-600 dark:text-red-400">all employees, pay history, and audit logs</span> from the database.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeReset}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Continue with Reset
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Final Confirmation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Type <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">delete</span> below to confirm you want to wipe all data.
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Type 'delete' to confirm"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-gray-200 mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeReset}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={confirmText !== 'delete' || resetting}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700"
                  >
                    {resetting ? 'Resetting...' : 'Delete Everything'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
