import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';

interface OneDriveStatus {
  connected: boolean;
  accountName: string | null;
  lastBackup: string | null;
  backupFolder: string;
  backupIntervalHours: number;
  clientConfigured: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showReset, setShowReset] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  // Local backup state
  interface LocalBackupStatus {
    enabled: boolean;
    folder: string | null;
    lastBackup: string | null;
    intervalHours: number;
    keepCount: number;
  }
  const [lbStatus, setLbStatus] = useState<LocalBackupStatus | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbMessage, setLbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showLocalRestoreList, setShowLocalRestoreList] = useState(false);
  const [localRestoreFiles, setLocalRestoreFiles] = useState<{ name: string; path: string; size: number; modified: string }[]>([]);

  // OneDrive state
  const [odStatus, setOdStatus] = useState<OneDriveStatus | null>(null);
  const [odLoading, setOdLoading] = useState(false);
  const [odMessage, setOdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [showRestoreList, setShowRestoreList] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState<{ name: string; id: string; lastModified: string }[]>([]);

  useEffect(() => {
    api.onedriveGetStatus().then(setOdStatus).catch(() => {});
    api.localBackupGetStatus().then(setLbStatus).catch(() => {});
  }, []);

  const handleEnableLocalBackup = async () => {
    const folder = await api.localBackupChooseFolder();
    if (!folder) return;
    await api.localBackupEnable(folder, 24, 7);
    setLbStatus(await api.localBackupGetStatus());
    setLbMessage({ type: 'success', text: `Local backups enabled. Saving to ${folder}` });
  };

  const handleDisableLocalBackup = async () => {
    await api.localBackupDisable();
    setLbStatus(await api.localBackupGetStatus());
    setLbMessage({ type: 'success', text: 'Local backups disabled.' });
  };

  const handleLocalBackupNow = async () => {
    setLbLoading(true);
    setLbMessage(null);
    const result = await api.localBackupNow();
    if (result.success) {
      setLbMessage({ type: 'success', text: `Backup saved to ${result.path}` });
      setLbStatus(await api.localBackupGetStatus());
    } else {
      setLbMessage({ type: 'error', text: result.error || 'Backup failed' });
    }
    setLbLoading(false);
  };

  const handleShowLocalRestoreList = async () => {
    const files = await api.localBackupList();
    setLocalRestoreFiles(files);
    setShowLocalRestoreList(true);
  };

  const handleLocalRestore = async (backupPath: string) => {
    if (!confirm('This will replace ALL current data with this backup. Continue?')) return;
    setLbLoading(true);
    const result = await api.localBackupRestore(backupPath);
    if (result.success) {
      alert('Database restored from local backup.');
      window.location.reload();
    } else {
      setLbMessage({ type: 'error', text: result.error || 'Restore failed' });
    }
    setLbLoading(false);
    setShowLocalRestoreList(false);
  };

  const handleUpdateLocalInterval = async (hours: number) => {
    await api.localBackupUpdateSettings({ intervalHours: hours });
    setLbStatus(await api.localBackupGetStatus());
  };

  const handleUpdateLocalKeepCount = async (count: number) => {
    await api.localBackupUpdateSettings({ keepCount: count });
    setLbStatus(await api.localBackupGetStatus());
  };

  const handleSetClientId = async () => {
    if (!clientIdInput.trim()) return;
    await api.onedriveSetClientId(clientIdInput.trim());
    setShowClientIdInput(false);
    setClientIdInput('');
    setOdStatus(await api.onedriveGetStatus());
    setOdMessage({ type: 'success', text: 'Client ID saved. You can now sign in.' });
  };

  const handleSignIn = async () => {
    setOdLoading(true);
    setOdMessage(null);
    const result = await api.onedriveSignIn();
    if (result.success) {
      setOdMessage({ type: 'success', text: `Connected as ${result.accountName}` });
      setOdStatus(await api.onedriveGetStatus());
    } else {
      setOdMessage({ type: 'error', text: result.error || 'Sign-in failed' });
    }
    setOdLoading(false);
  };

  const handleSignOut = async () => {
    await api.onedriveSignOut();
    setOdStatus(await api.onedriveGetStatus());
    setOdMessage({ type: 'success', text: 'Disconnected from OneDrive.' });
  };

  const handleBackupNow = async () => {
    setOdLoading(true);
    setOdMessage(null);
    const result = await api.onedriveBackupNow();
    if (result.success) {
      setOdMessage({ type: 'success', text: `Backup saved to ${result.path}` });
      setOdStatus(await api.onedriveGetStatus());
    } else {
      setOdMessage({ type: 'error', text: result.error || 'Backup failed' });
    }
    setOdLoading(false);
  };

  const handleShowRestoreList = async () => {
    setOdLoading(true);
    const result = await api.onedriveListBackups();
    if (result.success && result.files) {
      setRestoreFiles(result.files);
      setShowRestoreList(true);
    } else {
      setOdMessage({ type: 'error', text: result.error || 'Could not list backups' });
    }
    setOdLoading(false);
  };

  const handleRestore = async (fileId: string) => {
    if (!confirm('This will replace ALL current data with this backup. Continue?')) return;
    setOdLoading(true);
    const result = await api.onedriveRestoreBackup(fileId);
    if (result.success) {
      alert('Database restored from OneDrive backup.');
      window.location.reload();
    } else {
      setOdMessage({ type: 'error', text: result.error || 'Restore failed' });
    }
    setOdLoading(false);
    setShowRestoreList(false);
  };

  const handleUpdateInterval = async (hours: number) => {
    await api.onedriveUpdateSettings({ backupIntervalHours: hours });
    setOdStatus(await api.onedriveGetStatus());
  };

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

        {/* Local Auto-Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Local Auto-Backup</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Automatically save database backups to a local folder on a schedule.
          </p>

          {lbMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              lbMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {lbMessage.text}
            </div>
          )}

          {lbStatus && (
            <div className="space-y-0">
              {/* Enable / Choose Folder */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {lbStatus.enabled ? 'Backup Folder' : 'Enable Local Backups'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {lbStatus.enabled && lbStatus.folder
                      ? lbStatus.folder
                      : 'Choose a folder to save automatic backups'}
                  </p>
                </div>
                {lbStatus.enabled ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEnableLocalBackup}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleDisableLocalBackup}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                    >
                      Disable
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleEnableLocalBackup}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex-shrink-0"
                  >
                    Choose Folder
                  </button>
                )}
              </div>

              {lbStatus.enabled && (
                <>
                  {/* Backup Now */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backup Now</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lbStatus.lastBackup
                          ? `Last backup: ${new Date(lbStatus.lastBackup).toLocaleString()}`
                          : 'No backups yet'}
                      </p>
                    </div>
                    <button
                      onClick={handleLocalBackupNow}
                      disabled={lbLoading}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-emerald-400 transition-colors flex-shrink-0"
                    >
                      {lbLoading ? 'Backing up...' : 'Backup Now'}
                    </button>
                  </div>

                  {/* Restore */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Restore from Local Backup</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Restore a previous backup from your local folder</p>
                    </div>
                    <button
                      onClick={handleShowLocalRestoreList}
                      disabled={lbLoading}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:bg-amber-400 transition-colors flex-shrink-0"
                    >
                      Restore
                    </button>
                  </div>

                  {/* Interval */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backup Interval</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">How often to automatically save a backup</p>
                    </div>
                    <select
                      value={lbStatus.intervalHours}
                      onChange={e => handleUpdateLocalInterval(Number(e.target.value))}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value={6}>Every 6 hours</option>
                      <option value={12}>Every 12 hours</option>
                      <option value={24}>Daily</option>
                      <option value={48}>Every 2 days</option>
                      <option value={168}>Weekly</option>
                    </select>
                  </div>

                  {/* Keep Count */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backups to Keep</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Older backups are automatically deleted</p>
                    </div>
                    <select
                      value={lbStatus.keepCount}
                      onChange={e => handleUpdateLocalKeepCount(Number(e.target.value))}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value={3}>Last 3</option>
                      <option value={7}>Last 7</option>
                      <option value={14}>Last 14</option>
                      <option value={30}>Last 30</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Local Restore Modal */}
        {showLocalRestoreList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLocalRestoreList(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore from Local Backup</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a backup to restore</p>
              </div>
              <div className="px-6 py-4 max-h-80 overflow-y-auto">
                {localRestoreFiles.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No backups found.</p>
                ) : (
                  <div className="space-y-2">
                    {localRestoreFiles.map(file => (
                      <div key={file.path} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(file.modified).toLocaleString()} &middot; {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          onClick={() => handleLocalRestore(file.path)}
                          disabled={lbLoading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowLocalRestoreList(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OneDrive Cloud Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.39 2.15C10.46 2.15 8.72 3.25 7.87 4.92 6.27 3.88 4.15 4.54 3.13 6.14 2.12 7.75 2.78 9.87 4.38 10.88L4.38 10.88C3.56 11.41 3 12.35 3 13.42 3 15.07 4.34 16.42 6 16.42L18 16.42C20.21 16.42 22 14.63 22 12.42 22 10.21 20.21 8.42 18 8.42 18 8.42 18 8.42 17.97 8.42 17.82 4.92 15.39 2.15 12.39 2.15Z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">OneDrive Cloud Backup</h3>
            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">(Gabe needs to set this up on his side for this to work.)</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Automatically back up your database to Microsoft OneDrive for safekeeping.
          </p>

          {odMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              odMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {odMessage.text}
            </div>
          )}

          {odStatus && (
            <div className="space-y-0">
              {/* Azure App Configuration */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Azure App Registration</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {odStatus.clientConfigured
                      ? 'Client ID configured'
                      : 'Register an app at portal.azure.com and enter the Client ID'}
                  </p>
                </div>
                <button
                  onClick={() => setShowClientIdInput(!showClientIdInput)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                    odStatus.clientConfigured
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {odStatus.clientConfigured ? 'Update' : 'Configure'}
                </button>
              </div>

              {showClientIdInput && (
                <div className="py-3 pl-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Register a "Public client/native" app at{' '}
                    <span className="font-mono text-blue-600 dark:text-blue-400">portal.azure.com</span>{' '}
                    with redirect URI <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">http://localhost</span>{' '}
                    and API permissions: <span className="font-semibold">Files.ReadWrite</span>, <span className="font-semibold">User.Read</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={e => setClientIdInput(e.target.value)}
                      placeholder="Paste Application (Client) ID"
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={handleSetClientId}
                      disabled={!clientIdInput.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Account Connection */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Microsoft Account</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {odStatus.connected
                      ? `Connected as ${odStatus.accountName}`
                      : 'Sign in with your Microsoft work account'}
                  </p>
                </div>
                {odStatus.connected ? (
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={odLoading || !odStatus.clientConfigured}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex-shrink-0"
                  >
                    {odLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                )}
              </div>

              {/* Backup Controls (only show when connected) */}
              {odStatus.connected && (
                <>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backup Now</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {odStatus.lastBackup
                          ? `Last backup: ${new Date(odStatus.lastBackup).toLocaleString()}`
                          : 'No backups yet'}
                      </p>
                    </div>
                    <button
                      onClick={handleBackupNow}
                      disabled={odLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex-shrink-0"
                    >
                      {odLoading ? 'Backing up...' : 'Backup Now'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Restore from OneDrive</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Download and restore a previous backup</p>
                    </div>
                    <button
                      onClick={handleShowRestoreList}
                      disabled={odLoading}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:bg-amber-400 transition-colors flex-shrink-0"
                    >
                      Restore
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Auto-Backup Interval</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">How often to automatically backup to OneDrive</p>
                    </div>
                    <select
                      value={odStatus.backupIntervalHours}
                      onChange={e => handleUpdateInterval(Number(e.target.value))}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value={6}>Every 6 hours</option>
                      <option value={12}>Every 12 hours</option>
                      <option value={24}>Daily</option>
                      <option value={48}>Every 2 days</option>
                      <option value={168}>Weekly</option>
                    </select>
                  </div>

                  <div className="py-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Backups are stored in <span className="font-mono">{odStatus.backupFolder}</span> on your OneDrive. Only the last 7 backups are kept.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Restore from OneDrive Modal */}
        {showRestoreList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRestoreList(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore from OneDrive</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a backup to restore</p>
              </div>
              <div className="px-6 py-4 max-h-80 overflow-y-auto">
                {restoreFiles.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No backups found on OneDrive.</p>
                ) : (
                  <div className="space-y-2">
                    {restoreFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(file.lastModified).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestore(file.id)}
                          disabled={odLoading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowRestoreList(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* About & Updates */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">About & Updates</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                HR Database <span className="font-mono font-medium" id="app-version-display">v{(window as any).__appVersion || '...'}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" id="update-status-text">
                Click to check for updates
              </div>
            </div>
            <button
              onClick={async () => {
                const statusEl = document.getElementById('update-status-text');
                if (statusEl) statusEl.textContent = 'Checking...';
                try {
                  const info = await api.checkForUpdates();
                  if (!info) {
                    if (statusEl) statusEl.textContent = 'Could not check for updates';
                  } else if (info.isOutdated) {
                    if (statusEl) statusEl.textContent = `Downloading v${info.latestVersion}...`;
                    try {
                      await api.downloadUpdate();
                      // The UpdateBanner listeners will handle download-progress and downloaded events
                    } catch {
                      if (statusEl) statusEl.textContent = `Update available: v${info.latestVersion} (download failed)`;
                    }
                  } else {
                    if (statusEl) statusEl.textContent = 'You are on the latest version!';
                  }
                } catch {
                  if (statusEl) statusEl.textContent = 'Update check failed';
                }
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Check for Updates
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
