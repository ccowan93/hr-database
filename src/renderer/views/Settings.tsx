import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import BugReportDialog from '../components/BugReportDialog';
import ComboSelect from '../components/ComboSelect';

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
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">App preferences, backups, and account</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="card shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Appearance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Customize how the app looks.</p>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark themes.</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`kin-switch${theme === 'dark' ? ' on' : ''}`}
              aria-label="Toggle dark mode"
            >
              <span className="kin-switch-thumb" />
            </button>
          </div>
        </div>

        {/* Local Auto-Backup */}
        <div className="card shadow-sm p-6">
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
            <div className={`kin-alert ${lbMessage.type === 'success' ? '' : 'danger'}`} style={{ marginBottom: 16 }}>
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
                  <div className="hstack" style={{ gap: 8 }}>
                    <button onClick={handleEnableLocalBackup} className="btn ghost">
                      Change
                    </button>
                    <button onClick={handleDisableLocalBackup} className="btn ghost">
                      Disable
                    </button>
                  </div>
                ) : (
                  <button onClick={handleEnableLocalBackup} className="btn accent">
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
                    <button onClick={handleLocalBackupNow} disabled={lbLoading} className="btn accent">
                      {lbLoading ? 'Backing up...' : 'Backup Now'}
                    </button>
                  </div>

                  {/* Restore */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Restore from Local Backup</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Restore a previous backup from your local folder</p>
                    </div>
                    <button onClick={handleShowLocalRestoreList} disabled={lbLoading} className="btn" style={{ background: 'var(--warn)', color: '#fff' }}>
                      Restore
                    </button>
                  </div>

                  {/* Interval */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backup Interval</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">How often to automatically save a backup</p>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      <ComboSelect
                        value={String(lbStatus.intervalHours)}
                        options={[
                          { value: '6', label: 'Every 6 hours' },
                          { value: '12', label: 'Every 12 hours' },
                          { value: '24', label: 'Daily' },
                          { value: '48', label: 'Every 2 days' },
                          { value: '168', label: 'Weekly' },
                        ]}
                        onChange={v => handleUpdateLocalInterval(Number(v) || 24)}
                        includeNone={false}
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* Keep Count */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Backups to Keep</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Older backups are automatically deleted</p>
                    </div>
                    <div style={{ minWidth: 160 }}>
                      <ComboSelect
                        value={String(lbStatus.keepCount)}
                        options={[
                          { value: '3', label: 'Last 3' },
                          { value: '7', label: 'Last 7' },
                          { value: '14', label: 'Last 14' },
                          { value: '30', label: 'Last 30' },
                        ]}
                        onChange={v => handleUpdateLocalKeepCount(Number(v) || 7)}
                        includeNone={false}
                        searchable={false}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Local Restore Modal */}
        {showLocalRestoreList && (
          <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowLocalRestoreList(false); }}>
            <div className="kin-modal" style={{ maxWidth: 500 }}>
              <div className="kin-modal-head">
                <h2 className="kin-modal-title">Restore from Local Backup</h2>
              </div>
              <div className="kin-modal-body">
                <p className="small muted">Select a backup to restore</p>
                {localRestoreFiles.length === 0 ? (
                  <p className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>No backups found.</p>
                ) : (
                  <div className="vstack" style={{ gap: 8 }}>
                    {localRestoreFiles.map(file => (
                      <div key={file.path} className="hstack" style={{ justifyContent: 'space-between', padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{file.name}</p>
                          <p className="small muted" style={{ margin: 0 }}>
                            {new Date(file.modified).toLocaleString()} &middot; {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          onClick={() => handleLocalRestore(file.path)}
                          disabled={lbLoading}
                          className="btn"
                          style={{ background: 'var(--warn)', color: '#fff', padding: '6px 10px', fontSize: 12 }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="kin-modal-foot">
                <button onClick={() => setShowLocalRestoreList(false)} className="btn ghost">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OneDrive Cloud Backup */}
        <div className="card shadow-sm p-6">
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
            <div className={`kin-alert ${odMessage.type === 'success' ? '' : 'danger'}`} style={{ marginBottom: 16 }}>
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
                  className={odStatus.clientConfigured ? 'btn ghost' : 'btn primary'}
                >
                  {odStatus.clientConfigured ? 'Update' : 'Configure'}
                </button>
              </div>

              {showClientIdInput && (
                <div style={{ padding: '12px 0 12px 16px', borderTop: '1px solid var(--line)' }}>
                  <p className="small muted" style={{ marginBottom: 8 }}>
                    Register a "Public client/native" app at{' '}
                    <span className="mono" style={{ color: 'var(--accent)' }}>portal.azure.com</span>{' '}
                    with redirect URI <span className="mono" style={{ background: 'var(--surface-2)', padding: '0 4px', borderRadius: 3 }}>http://localhost</span>{' '}
                    and API permissions: <span style={{ fontWeight: 600 }}>Files.ReadWrite</span>, <span style={{ fontWeight: 600 }}>User.Read</span>
                  </p>
                  <div className="hstack" style={{ gap: 8 }}>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={e => setClientIdInput(e.target.value)}
                      placeholder="Paste Application (Client) ID"
                      className="input"
                      style={{ flex: 1 }}
                    />
                    <button onClick={handleSetClientId} disabled={!clientIdInput.trim()} className="btn primary">
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
                  <button onClick={handleSignOut} className="btn ghost">
                    Disconnect
                  </button>
                ) : (
                  <button onClick={handleSignIn} disabled={odLoading || !odStatus.clientConfigured} className="btn primary">
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
                    <button onClick={handleBackupNow} disabled={odLoading} className="btn primary">
                      {odLoading ? 'Backing up...' : 'Backup Now'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Restore from OneDrive</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Download and restore a previous backup</p>
                    </div>
                    <button onClick={handleShowRestoreList} disabled={odLoading} className="btn" style={{ background: 'var(--warn)', color: '#fff' }}>
                      Restore
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Auto-Backup Interval</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">How often to automatically backup to OneDrive</p>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      <ComboSelect
                        value={String(odStatus.backupIntervalHours)}
                        options={[
                          { value: '6', label: 'Every 6 hours' },
                          { value: '12', label: 'Every 12 hours' },
                          { value: '24', label: 'Daily' },
                          { value: '48', label: 'Every 2 days' },
                          { value: '168', label: 'Weekly' },
                        ]}
                        onChange={v => handleUpdateInterval(Number(v) || 24)}
                        includeNone={false}
                        searchable={false}
                      />
                    </div>
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
          <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowRestoreList(false); }}>
            <div className="kin-modal" style={{ maxWidth: 500 }}>
              <div className="kin-modal-head">
                <h2 className="kin-modal-title">Restore from OneDrive</h2>
              </div>
              <div className="kin-modal-body">
                <p className="small muted">Select a backup to restore</p>
                {restoreFiles.length === 0 ? (
                  <p className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>No backups found on OneDrive.</p>
                ) : (
                  <div className="vstack" style={{ gap: 8 }}>
                    {restoreFiles.map(file => (
                      <div key={file.id} className="hstack" style={{ justifyContent: 'space-between', padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{file.name}</p>
                          <p className="small muted" style={{ margin: 0 }}>
                            {new Date(file.lastModified).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestore(file.id)}
                          disabled={odLoading}
                          className="btn"
                          style={{ background: 'var(--warn)', color: '#fff', padding: '6px 10px', fontSize: 12 }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="kin-modal-foot">
                <button onClick={() => setShowRestoreList(false)} className="btn ghost">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* About & Updates */}
        <div className="card shadow-sm p-6">
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
              className="btn ghost"
            >
              Check for Updates
            </button>
          </div>
        </div>

        {/* Security */}
        <SecuritySection />

        {/* Support */}
        <SupportSection />

        {/* Danger Zone */}
        <div className="card shadow-sm p-6" style={{ borderColor: 'oklch(from var(--danger) l c h / 0.35)' }}>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--danger)' }}>Danger Zone</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Irreversible actions that affect your entire database.</p>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Reset Application</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Delete all employees, pay history, and audit logs. This cannot be undone.</p>
            </div>
            <button onClick={openReset} className="btn" style={{ background: 'var(--danger)', color: '#fff' }}>
              Reset App
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showReset && (
        <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeReset(); }}>
          <div className="kin-modal" style={{ maxWidth: 440 }}>
            {step === 1 && (
              <>
                <div className="kin-modal-head">
                  <h2 className="kin-modal-title">Reset Application?</h2>
                </div>
                <div className="kin-modal-body">
                  <p className="small" style={{ color: 'var(--ink-2)' }}>
                    This will permanently delete <span style={{ fontWeight: 600, color: 'var(--danger)' }}>all employees, pay history, and audit logs</span> from the database.
                  </p>
                  <p className="small" style={{ color: 'var(--ink-2)' }}>This action cannot be undone.</p>
                </div>
                <div className="kin-modal-foot">
                  <button onClick={closeReset} className="btn ghost">
                    Cancel
                  </button>
                  <button onClick={() => setStep(2)} className="btn" style={{ background: 'var(--danger)', color: '#fff' }}>
                    Continue with Reset
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="kin-modal-head">
                  <h2 className="kin-modal-title">Final Confirmation</h2>
                </div>
                <div className="kin-modal-body">
                  <p className="small" style={{ color: 'var(--ink-2)' }}>
                    Type <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)', background: 'oklch(from var(--danger) l c h / 0.12)', padding: '2px 6px', borderRadius: 3 }}>delete</span> below to confirm you want to wipe all data.
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="Type 'delete' to confirm"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="kin-modal-foot">
                  <button onClick={closeReset} className="btn ghost">
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={confirmText !== 'delete' || resetting}
                    className="btn"
                    style={{ background: 'var(--danger)', color: '#fff' }}
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

function SecuritySection() {
  const [status, setStatus] = useState<{ configured: boolean; touchIdAvailable: boolean; touchIdEnabled: boolean; encryptionReady: boolean } | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [touchIdPw, setTouchIdPw] = useState('');
  const [askTouchIdPassword, setAskTouchIdPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = () => { api.authGetStatus().then(setStatus).catch(() => {}); };
  useEffect(() => { refresh(); }, []);

  const handleChangePassword = async () => {
    setMessage(null);
    if (newPw.length < 6) { setMessage({ type: 'error', text: 'New password must be at least 6 characters' }); return; }
    if (newPw !== confirmPw) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    setBusy(true);
    try {
      const result = await api.authChangePassword(oldPw, newPw);
      if (result.ok) {
        setMessage({ type: 'success', text: 'Password updated' });
        setShowChange(false);
        setOldPw(''); setNewPw(''); setConfirmPw('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to change password' });
      }
    } finally { setBusy(false); }
  };

  const handleToggleTouchId = async (enable: boolean) => {
    setMessage(null);
    if (enable) {
      setAskTouchIdPassword(true);
      return;
    }
    setBusy(true);
    try {
      const result = await api.authSetTouchIdEnabled(false);
      if (result.ok) { setMessage({ type: 'success', text: 'Touch ID disabled' }); refresh(); }
      else setMessage({ type: 'error', text: result.error || 'Failed' });
    } finally { setBusy(false); }
  };

  const confirmEnableTouchId = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.authSetTouchIdEnabled(true, touchIdPw);
      if (result.ok) {
        setMessage({ type: 'success', text: 'Touch ID enabled' });
        setAskTouchIdPassword(false);
        setTouchIdPw('');
        refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed' });
      }
    } finally { setBusy(false); }
  };

  if (!status) return null;

  return (
    <div className="card shadow-sm p-6">
      <div className="flex items-center gap-3 mb-1">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Security</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        The database is encrypted at rest with a key derived from your app password{status.encryptionReady ? ' and AES-256-GCM.' : '.'}
      </p>

      {message && (
        <div className={`kin-alert ${message.type === 'success' ? '' : 'danger'}`} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">App Password</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Required every time the app launches.</p>
        </div>
        <button
          onClick={() => { setShowChange(v => !v); setMessage(null); }}
          className="btn ghost"
        >
          {showChange ? 'Cancel' : 'Change'}
        </button>
      </div>

      {showChange && (
        <div className="vstack" style={{ gap: 12, padding: '12px 0' }}>
          <input type="password" placeholder="Current password" value={oldPw} onChange={e => setOldPw(e.target.value)} className="input" autoComplete="current-password" />
          <input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input" autoComplete="new-password" />
          <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input" autoComplete="new-password" />
          <button onClick={handleChangePassword} disabled={busy || !oldPw || !newPw} className="btn primary" style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      )}

      {status.touchIdAvailable && (
        <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Touch ID Unlock</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status.touchIdEnabled ? 'Enabled — unlock with your fingerprint.' : 'Use your fingerprint instead of typing your password.'}
            </p>
          </div>
          <button
            onClick={() => handleToggleTouchId(!status.touchIdEnabled)}
            disabled={busy}
            className={status.touchIdEnabled ? 'btn ghost' : 'btn primary'}
          >
            {status.touchIdEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      )}

      {askTouchIdPassword && (
        <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAskTouchIdPassword(false); }}>
          <div className="kin-modal" style={{ maxWidth: 420 }}>
            <div className="kin-modal-head">
              <h2 className="kin-modal-title">Confirm password</h2>
            </div>
            <div className="kin-modal-body">
              <p className="small muted">Enter your password to enable Touch ID unlock.</p>
              <input type="password" value={touchIdPw} onChange={e => setTouchIdPw(e.target.value)} className="input" autoFocus />
            </div>
            <div className="kin-modal-foot">
              <button onClick={() => { setAskTouchIdPassword(false); setTouchIdPw(''); }} className="btn ghost">Cancel</button>
              <button onClick={confirmEnableTouchId} disabled={busy || !touchIdPw} className="btn primary">
                {busy ? 'Enabling…' : 'Enable Touch ID'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupportSection() {
  const [showReport, setShowReport] = useState(false);

  return (
    <div className="card shadow-sm p-6">
      <div className="flex items-center gap-3 mb-1">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Support</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Save a diagnostic bundle you can send to the developer to help fix an issue.</p>
      <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Report a bug</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Collects app version, OS details, and recent logs. No employee data is included.</p>
        </div>
        <button onClick={() => setShowReport(true)} className="btn ghost">
          Report bug…
        </button>
      </div>
      <BugReportDialog open={showReport} onClose={() => setShowReport(false)} />
    </div>
  );
}
