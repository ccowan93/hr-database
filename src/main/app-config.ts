import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface AppConfig {
  onedrive: {
    enabled: boolean;
    accountName: string | null;
    lastBackup: string | null;
    backupFolder: string;
    backupIntervalHours: number;
  };
  localBackup: {
    enabled: boolean;
    folder: string | null;
    lastBackup: string | null;
    intervalHours: number;
    keepCount: number;
  };
  shifts: {
    dayShiftStart: string;
    nightShiftStart: string;
  };
  auth: {
    passwordHash: string | null;
    salt: string | null;
    iterations: number;
    touchIdEnabled: boolean;
    kekSalt: string | null;
    dekCiphertext: string | null;
    dekIv: string | null;
    dekTag: string | null;
    dekSafeStorage: string | null;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  onedrive: {
    enabled: false,
    accountName: null,
    lastBackup: null,
    backupFolder: '/Apps/HR Database Backups',
    backupIntervalHours: 24,
  },
  localBackup: {
    enabled: false,
    folder: null,
    lastBackup: null,
    intervalHours: 24,
    keepCount: 7,
  },
  shifts: {
    dayShiftStart: '07:00',
    nightShiftStart: '19:00',
  },
  auth: {
    passwordHash: null,
    salt: null,
    iterations: 210000,
    touchIdEnabled: false,
    kekSalt: null,
    dekCiphertext: null,
    dekIv: null,
    dekTag: null,
    dekSafeStorage: null,
  },
};

let config: AppConfig = { ...DEFAULT_CONFIG };

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'app-config.json');
}

export function loadConfig(): AppConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = {
        ...DEFAULT_CONFIG,
        ...data,
        onedrive: { ...DEFAULT_CONFIG.onedrive, ...data.onedrive },
        localBackup: { ...DEFAULT_CONFIG.localBackup, ...data.localBackup },
        shifts: { ...DEFAULT_CONFIG.shifts, ...data.shifts },
        auth: { ...DEFAULT_CONFIG.auth, ...data.auth },
      };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
    config = { ...DEFAULT_CONFIG };
  }
  return config;
}

export function saveConfig(updates: Partial<AppConfig>): AppConfig {
  if (updates.onedrive) {
    config.onedrive = { ...config.onedrive, ...updates.onedrive };
  }
  if (updates.localBackup) {
    config.localBackup = { ...config.localBackup, ...updates.localBackup };
  }
  if (updates.shifts) {
    config.shifts = { ...config.shifts, ...updates.shifts };
  }
  if (updates.auth) {
    config.auth = { ...config.auth, ...updates.auth };
  }
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return config;
}

export function getConfig(): AppConfig {
  return config;
}
