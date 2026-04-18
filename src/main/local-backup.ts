import fs from 'fs';
import path from 'path';
import { getDbPath, getDb, getActiveKeyHex } from './database';
import { getConfig, saveConfig } from './app-config';

export function runLocalBackup(): { success: boolean; path?: string; error?: string } {
  try {
    const config = getConfig();
    if (!config.localBackup.folder) {
      return { success: false, error: 'No backup folder configured.' };
    }

    const folder = config.localBackup.folder;
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const dbPath = getDbPath();
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const fileName = `hr-database-backup-${timestamp[0]}_${timestamp[1].slice(0, 8)}.sqlite`;
    const destPath = path.join(folder, fileName);

    fs.copyFileSync(dbPath, destPath);

    saveConfig({
      localBackup: { ...config.localBackup, lastBackup: new Date().toISOString() },
    });

    // Cleanup old backups
    cleanupOldBackups(folder, config.localBackup.keepCount);

    return { success: true, path: destPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function cleanupOldBackups(folder: string, keepCount: number): void {
  try {
    const files = fs.readdirSync(folder)
      .filter(f => f.startsWith('hr-database-backup-') && f.endsWith('.sqlite'))
      .sort()
      .reverse();

    if (files.length > keepCount) {
      for (const file of files.slice(keepCount)) {
        fs.unlinkSync(path.join(folder, file));
      }
    }
  } catch (_) {}
}

export function getLocalBackupStatus(): {
  enabled: boolean;
  folder: string | null;
  lastBackup: string | null;
  intervalHours: number;
  keepCount: number;
} {
  const config = getConfig();
  return { ...config.localBackup };
}

export function listLocalBackups(): { name: string; path: string; size: number; modified: string }[] {
  const config = getConfig();
  if (!config.localBackup.folder || !fs.existsSync(config.localBackup.folder)) return [];

  return fs.readdirSync(config.localBackup.folder)
    .filter(f => f.startsWith('hr-database-backup-') && f.endsWith('.sqlite'))
    .sort()
    .reverse()
    .map(f => {
      const fullPath = path.join(config.localBackup.folder!, f);
      const stats = fs.statSync(fullPath);
      return {
        name: f,
        path: fullPath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    });
}

export function restoreLocalBackup(backupPath: string): { success: boolean; error?: string } {
  const keyHex = getActiveKeyHex();
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found.' };
    }

    const dbPath = getDbPath();
    const db = getDb();
    db.close();

    fs.copyFileSync(backupPath, dbPath);

    try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}

    const { initDatabase } = require('./database');
    initDatabase(keyHex || undefined);

    return { success: true };
  } catch (err: any) {
    try {
      const { initDatabase } = require('./database');
      initDatabase(keyHex || undefined);
    } catch (_) {}
    return { success: false, error: err.message || 'Restore failed. The backup file may be from a different device or encrypted with a different password.' };
  }
}

// ── Scheduler ──

let localBackupInterval: ReturnType<typeof setInterval> | null = null;

export function startLocalBackupScheduler(): void {
  stopLocalBackupScheduler();

  const config = getConfig();
  if (!config.localBackup.enabled || !config.localBackup.folder) return;

  const intervalMs = config.localBackup.intervalHours * 60 * 60 * 1000;

  const checkAndBackup = () => {
    const cfg = getConfig();
    if (!cfg.localBackup.enabled || !cfg.localBackup.folder) return;

    const lastBackup = cfg.localBackup.lastBackup ? new Date(cfg.localBackup.lastBackup).getTime() : 0;
    const now = Date.now();

    if (now - lastBackup >= intervalMs) {
      console.log('[LocalBackup] Running scheduled backup...');
      const result = runLocalBackup();
      if (result.success) {
        console.log('[LocalBackup] Backup completed:', result.path);
      } else {
        console.error('[LocalBackup] Backup failed:', result.error);
      }
    }
  };

  checkAndBackup();
  localBackupInterval = setInterval(checkAndBackup, 60 * 60 * 1000);
}

export function stopLocalBackupScheduler(): void {
  if (localBackupInterval) {
    clearInterval(localBackupInterval);
    localBackupInterval = null;
  }
}
