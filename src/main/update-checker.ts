import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
  releaseNotes: string;
}

const PENDING_UPDATE_FILE = path.join(app.getPath('userData'), 'pending-update.json');

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

// Configure autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

export function setUpdateWindow(win: BrowserWindow) {
  mainWindow = win;
}

function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function extractReleaseNotes(info: ElectronUpdateInfo): string {
  if (!info.releaseNotes) return '';
  if (typeof info.releaseNotes === 'string') return info.releaseNotes;
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes.map(n => typeof n === 'string' ? n : n.note || '').join('\n');
  }
  return '';
}

// Set up autoUpdater event forwarding to renderer
autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
  sendToRenderer('update:available', {
    currentVersion: app.getVersion(),
    latestVersion: info.version,
    isOutdated: true,
    releaseUrl: `https://github.com/ccowan93/hr-database/releases/tag/v${info.version}`,
    releaseName: info.releaseName || `v${info.version}`,
    publishedAt: info.releaseDate || '',
    releaseNotes: extractReleaseNotes(info),
  } as UpdateInfo);
});

autoUpdater.on('update-not-available', () => {
  sendToRenderer('update:not-available');
});

autoUpdater.on('download-progress', (progress) => {
  sendToRenderer('update:download-progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  } as DownloadProgress);
});

autoUpdater.on('update-downloaded', () => {
  sendToRenderer('update:downloaded');
});

autoUpdater.on('error', (err) => {
  sendToRenderer('update:error', err.message);
});

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) return null;

    const info = result.updateInfo;
    const currentVersion = app.getVersion();
    const latestVersion = info.version;

    // Compare versions
    const c = currentVersion.replace(/^v/, '').split('.').map(Number);
    const l = latestVersion.replace(/^v/, '').split('.').map(Number);
    let isOutdated = false;
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
      const cv = c[i] || 0;
      const lv = l[i] || 0;
      if (lv > cv) { isOutdated = true; break; }
      if (lv < cv) break;
    }

    return {
      currentVersion,
      latestVersion,
      isOutdated,
      releaseUrl: `https://github.com/ccowan93/hr-database/releases/tag/v${latestVersion}`,
      releaseName: info.releaseName || `v${latestVersion}`,
      publishedAt: info.releaseDate || '',
      releaseNotes: extractReleaseNotes(info),
    };
  } catch {
    return null;
  }
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(releaseNotes?: string, version?: string): void {
  // Save pending update info so we can show release notes after restart
  try {
    fs.writeFileSync(PENDING_UPDATE_FILE, JSON.stringify({
      version: version || 'unknown',
      releaseNotes: releaseNotes || '',
      installedAt: new Date().toISOString(),
    }));
  } catch {}
  autoUpdater.quitAndInstall(false, true);
}

/** Check if the app just updated and return the release notes, then clear the flag */
export function getPostUpdateInfo(): { version: string; releaseNotes: string } | null {
  try {
    if (!fs.existsSync(PENDING_UPDATE_FILE)) return null;
    const raw = fs.readFileSync(PENDING_UPDATE_FILE, 'utf-8');
    fs.unlinkSync(PENDING_UPDATE_FILE);
    const data = JSON.parse(raw);
    // Only show if the stored version matches the current running version
    const current = app.getVersion();
    if (data.version === current) {
      return { version: data.version, releaseNotes: data.releaseNotes };
    }
    return null;
  } catch {
    try { fs.unlinkSync(PENDING_UPDATE_FILE); } catch {}
    return null;
  }
}

export function openReleasePage(url?: string) {
  const { shell } = require('electron');
  shell.openExternal(url || 'https://github.com/ccowan93/hr-database/releases');
}
