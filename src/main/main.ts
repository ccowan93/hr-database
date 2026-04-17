import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { loadConfig } from './app-config';
import { startBackupScheduler, stopBackupScheduler } from './onedrive-backup';
import { startLocalBackupScheduler, stopLocalBackupScheduler } from './local-backup';
import { setUpdateWindow } from './update-checker';
import { setOnUnlock } from './auth';
import { installLogger } from './logger';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    title: 'HR Database',
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  setUpdateWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  installLogger();
  loadConfig();
  registerIpcHandlers();

  // Start backup schedulers only after the user unlocks the app; the DB
  // cannot be opened until the encryption key is derived from the password.
  setOnUnlock(() => {
    try { startBackupScheduler(); } catch (err) { console.error('[main] onedrive scheduler failed:', err); }
    try { startLocalBackupScheduler(); } catch (err) { console.error('[main] local scheduler failed:', err); }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackupScheduler();
  stopLocalBackupScheduler();
});
