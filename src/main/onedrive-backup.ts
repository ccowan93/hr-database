import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo, AuthenticationResult } from '@azure/msal-node';
import { BrowserWindow, net } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDbPath, getDb, getActiveKeyHex } from './database';
import { getConfig, saveConfig } from './app-config';

// Azure AD app registration for HR Database
// Users should register their own app at https://portal.azure.com
// Required: Public client/native app, redirect URI: http://localhost
// API permissions: Files.ReadWrite (delegated), User.Read (delegated)
const CLIENT_ID = '00000000-0000-0000-0000-000000000000'; // Placeholder - user must configure
const AUTHORITY = 'https://login.microsoftonline.com/common';
const REDIRECT_URI = 'http://localhost';
const SCOPES = ['Files.ReadWrite', 'User.Read', 'offline_access'];

let msalApp: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;

function getTokenCachePath(): string {
  return path.join(app.getPath('userData'), 'msal-token-cache.json');
}

function getClientId(): string {
  // Check if user has configured a custom client ID
  const configPath = path.join(app.getPath('userData'), 'azure-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (data.clientId) return data.clientId;
    }
  } catch (_) {}
  return CLIENT_ID;
}

function saveClientId(clientId: string): void {
  const configPath = path.join(app.getPath('userData'), 'azure-config.json');
  fs.writeFileSync(configPath, JSON.stringify({ clientId }, null, 2));
}

async function getMsalApp(): Promise<PublicClientApplication> {
  if (msalApp) return msalApp;

  const clientId = getClientId();

  msalApp = new PublicClientApplication({
    auth: {
      clientId,
      authority: AUTHORITY,
    },
    cache: {
      cachePlugin: {
        beforeCacheAccess: async (context) => {
          const cachePath = getTokenCachePath();
          if (fs.existsSync(cachePath)) {
            context.tokenCache.deserialize(fs.readFileSync(cachePath, 'utf-8'));
          }
        },
        afterCacheAccess: async (context) => {
          if (context.cacheHasChanged) {
            fs.writeFileSync(getTokenCachePath(), context.tokenCache.serialize());
          }
        },
      },
    },
  });

  return msalApp;
}

async function getAccessToken(): Promise<string> {
  const pca = await getMsalApp();

  // Try silent token acquisition first
  if (cachedAccount) {
    try {
      const result = await pca.acquireTokenSilent({
        account: cachedAccount,
        scopes: SCOPES,
      });
      return result.accessToken;
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
    }
  }

  // Check cached accounts
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    cachedAccount = accounts[0];
    try {
      const result = await pca.acquireTokenSilent({
        account: cachedAccount,
        scopes: SCOPES,
      });
      return result.accessToken;
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
    }
  }

  throw new Error('No cached credentials. Please sign in first.');
}

export async function signIn(): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const clientId = getClientId();
    if (clientId === CLIENT_ID) {
      return { success: false, error: 'Please configure your Azure App Client ID first.' };
    }

    const pca = await getMsalApp();

    // Use device code flow - works reliably in Electron without browser redirect issues
    const result = await new Promise<AuthenticationResult>((resolve, reject) => {
      // Use interactive auth via a popup window
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&response_mode=query`;

      authWindow.loadURL(authUrl);
      authWindow.show();

      authWindow.webContents.on('will-redirect', async (_event, url) => {
        try {
          const urlObj = new URL(url);
          if (urlObj.origin === 'http://localhost') {
            const code = urlObj.searchParams.get('code');
            const error = urlObj.searchParams.get('error');
            authWindow.close();

            if (error) {
              reject(new Error(urlObj.searchParams.get('error_description') || error));
              return;
            }

            if (code) {
              const tokenResult = await pca.acquireTokenByCode({
                code,
                scopes: SCOPES,
                redirectUri: REDIRECT_URI,
              });
              resolve(tokenResult);
            }
          }
        } catch (err) {
          authWindow.close();
          reject(err);
        }
      });

      authWindow.on('closed', () => {
        reject(new Error('Authentication window was closed.'));
      });
    });

    cachedAccount = result.account;
    const accountName = result.account?.name || result.account?.username || 'Microsoft Account';

    saveConfig({
      onedrive: {
        enabled: true,
        accountName,
        lastBackup: getConfig().onedrive.lastBackup,
        backupFolder: getConfig().onedrive.backupFolder,
        backupIntervalHours: getConfig().onedrive.backupIntervalHours,
      },
    });

    return { success: true, accountName };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function signOut(): Promise<void> {
  cachedAccount = null;
  msalApp = null;

  // Clear token cache
  const cachePath = getTokenCachePath();
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }

  saveConfig({
    onedrive: {
      enabled: false,
      accountName: null,
      lastBackup: getConfig().onedrive.lastBackup,
      backupFolder: getConfig().onedrive.backupFolder,
      backupIntervalHours: getConfig().onedrive.backupIntervalHours,
    },
  });
}

async function graphRequest(method: string, endpoint: string, body?: Buffer | string, contentType?: string): Promise<any> {
  const token = await getAccessToken();

  return new Promise((resolve, reject) => {
    const url = `https://graph.microsoft.com/v1.0${endpoint}`;
    const request = net.request({
      method,
      url,
    });

    request.setHeader('Authorization', `Bearer ${token}`);
    if (contentType) {
      request.setHeader('Content-Type', contentType);
    }

    let responseData = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { responseData += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try { resolve(JSON.parse(responseData)); } catch { resolve(responseData); }
        } else {
          reject(new Error(`Graph API ${response.statusCode}: ${responseData}`));
        }
      });
    });

    request.on('error', reject);

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

export async function uploadBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const config = getConfig();
    const dbPath = getDbPath();
    const db = getDb();

    // Checkpoint WAL before backup
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Read the database file
    const fileData = fs.readFileSync(dbPath);

    // Build the OneDrive path
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `hr-database-backup-${timestamp}.sqlite`;
    const folderPath = config.onedrive.backupFolder.replace(/^\//, '').replace(/\/$/, '');
    const fullPath = `/${folderPath}/${fileName}`;

    // Upload using simple upload (< 4MB) or upload session for larger files
    if (fileData.length < 4 * 1024 * 1024) {
      // Simple upload
      const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
      await graphRequest('PUT', `/me/drive/root:${encodedPath}:/content`, fileData, 'application/octet-stream');
    } else {
      // Create upload session for large files
      const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
      const session = await graphRequest('POST', `/me/drive/root:${encodedPath}:/createUploadSession`, JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'replace' },
      }), 'application/json');

      // Upload in chunks
      const chunkSize = 3.25 * 1024 * 1024; // 3.25 MB chunks
      const uploadUrl = session.uploadUrl;

      for (let offset = 0; offset < fileData.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, fileData.length);
        const chunk = fileData.subarray(offset, end);

        await new Promise((resolve, reject) => {
          const request = net.request({ method: 'PUT', url: uploadUrl });
          request.setHeader('Content-Range', `bytes ${offset}-${end - 1}/${fileData.length}`);
          request.setHeader('Content-Type', 'application/octet-stream');

          let responseData = '';
          request.on('response', (response) => {
            response.on('data', (c) => { responseData += c.toString(); });
            response.on('end', () => {
              if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                resolve(responseData);
              } else {
                reject(new Error(`Upload chunk failed: ${response.statusCode}`));
              }
            });
          });
          request.on('error', reject);
          request.write(chunk);
          request.end();
        });
      }
    }

    // Update last backup time
    const now = new Date().toISOString();
    saveConfig({
      onedrive: { ...config.onedrive, lastBackup: now },
    });

    // Also keep only last 7 daily backups (cleanup old ones)
    try {
      await cleanupOldBackups(folderPath, 7);
    } catch (_) {
      // Non-critical, don't fail the backup
    }

    return { success: true, path: fullPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function cleanupOldBackups(folderPath: string, keepCount: number): Promise<void> {
  const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
  const result = await graphRequest('GET', `/me/drive/root:/${encodedPath}:/children?$filter=startswith(name,'hr-database-backup')&$orderby=name desc`);

  if (result.value && result.value.length > keepCount) {
    const toDelete = result.value.slice(keepCount);
    for (const item of toDelete) {
      try {
        await graphRequest('DELETE', `/me/drive/items/${item.id}`);
      } catch (_) {}
    }
  }
}

export async function restoreFromOneDrive(): Promise<{ success: boolean; files?: { name: string; id: string; lastModified: string }[]; error?: string }> {
  try {
    const config = getConfig();
    const folderPath = config.onedrive.backupFolder.replace(/^\//, '').replace(/\/$/, '');
    const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');

    const result = await graphRequest('GET', `/me/drive/root:/${encodedPath}:/children?$filter=startswith(name,'hr-database-backup')&$orderby=name desc&$top=10`);

    const files = (result.value || []).map((item: any) => ({
      name: item.name,
      id: item.id,
      lastModified: item.lastModifiedDateTime,
    }));

    return { success: true, files };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function downloadBackupFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const dbPath = getDbPath();

    // Get download URL
    const metadata = await graphRequest('GET', `/me/drive/items/${fileId}`);
    const downloadUrl = metadata['@microsoft.graph.downloadUrl'];

    if (!downloadUrl) throw new Error('Could not get download URL');

    // Download the file
    const fileData = await new Promise<Buffer>((resolve, reject) => {
      const request = net.request(downloadUrl);
      const chunks: Buffer[] = [];
      request.on('response', (response) => {
        response.on('data', (chunk) => { chunks.push(Buffer.from(chunk)); });
        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error(`Download failed: ${response.statusCode}`));
          }
        });
      });
      request.on('error', reject);
      request.end();
    });

    // Close current DB, write new file, reinitialize
    const keyHex = getActiveKeyHex();
    const db = getDb();
    db.close();

    fs.writeFileSync(dbPath, fileData);

    // Clean up WAL/SHM files
    try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}

    // Reinitialize database with the active key
    const { initDatabase } = require('./database');
    initDatabase(keyHex || undefined);

    return { success: true };
  } catch (err: any) {
    // Try to reinitialize DB even on failure
    try {
      const keyHex = getActiveKeyHex();
      const { initDatabase } = require('./database');
      initDatabase(keyHex || undefined);
    } catch (_) {}
    return { success: false, error: err.message || 'Restore failed. The backup may be from a different install.' };
  }
}

export function getOneDriveStatus(): {
  connected: boolean;
  accountName: string | null;
  lastBackup: string | null;
  backupFolder: string;
  backupIntervalHours: number;
  clientConfigured: boolean;
} {
  const config = getConfig();
  const clientId = getClientId();
  return {
    connected: config.onedrive.enabled,
    accountName: config.onedrive.accountName,
    lastBackup: config.onedrive.lastBackup,
    backupFolder: config.onedrive.backupFolder,
    backupIntervalHours: config.onedrive.backupIntervalHours,
    clientConfigured: clientId !== CLIENT_ID,
  };
}

export function setClientId(clientId: string): void {
  saveClientId(clientId);
  // Reset MSAL app so it picks up new client ID
  msalApp = null;
  cachedAccount = null;
}

// ── Backup Scheduler ──

let backupInterval: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): void {
  stopBackupScheduler();

  const config = getConfig();
  if (!config.onedrive.enabled) return;

  const intervalMs = config.onedrive.backupIntervalHours * 60 * 60 * 1000;

  // Check if a backup is due
  const checkAndBackup = async () => {
    const cfg = getConfig();
    if (!cfg.onedrive.enabled) return;

    const lastBackup = cfg.onedrive.lastBackup ? new Date(cfg.onedrive.lastBackup).getTime() : 0;
    const now = Date.now();

    if (now - lastBackup >= intervalMs) {
      console.log('[OneDrive] Running scheduled backup...');
      const result = await uploadBackup();
      if (result.success) {
        console.log('[OneDrive] Backup completed:', result.path);
      } else {
        console.error('[OneDrive] Backup failed:', result.error);
      }
    }
  };

  // Check immediately on start, then every hour
  checkAndBackup();
  backupInterval = setInterval(checkAndBackup, 60 * 60 * 1000); // Check every hour
}

export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}
