import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ROTATED = 3;

let logPath: string | null = null;
let installed = false;

function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function getLogPath(): string {
  if (logPath) return logPath;
  const dir = getLogDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  logPath = path.join(dir, 'app.log');
  return logPath;
}

function rotateIfNeeded() {
  const p = getLogPath();
  try {
    const stat = fs.statSync(p);
    if (stat.size <= MAX_LOG_BYTES) return;
  } catch {
    return;
  }

  // Shift old logs: app.log.2 -> app.log.3, app.log.1 -> app.log.2, app.log -> app.log.1
  for (let i = MAX_ROTATED; i >= 1; i--) {
    const src = i === 1 ? p : `${p}.${i - 1}`;
    const dest = `${p}.${i}`;
    try {
      if (i === MAX_ROTATED) {
        try { fs.unlinkSync(dest); } catch (_) {}
      }
      if (fs.existsSync(src)) fs.renameSync(src, dest);
    } catch (_) {}
  }
}

function write(level: string, message: string, source: string) {
  try {
    rotateIfNeeded();
    const timestamp = new Date().toISOString();
    const safe = message.replace(/\r?\n/g, ' ⏎ ');
    fs.appendFileSync(getLogPath(), `${timestamp} [${level}] [${source}] ${safe}\n`);
  } catch (_) {
    // Never throw from logger
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string, source = 'main') {
  write(level, message, source);
}

export function installLogger() {
  if (installed) return;
  installed = true;

  // Ensure log file exists
  getLogPath();

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);

  console.error = (...args: unknown[]) => {
    write('error', args.map(formatArg).join(' '), 'main');
    origError(...(args as []));
  };
  console.warn = (...args: unknown[]) => {
    write('warn', args.map(formatArg).join(' '), 'main');
    origWarn(...(args as []));
  };
  console.log = (...args: unknown[]) => {
    write('info', args.map(formatArg).join(' '), 'main');
    origLog(...(args as []));
  };

  process.on('uncaughtException', (err) => {
    write('error', `uncaughtException: ${err?.stack || err?.message || String(err)}`, 'main');
  });
  process.on('unhandledRejection', (reason) => {
    const r = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
    write('error', `unhandledRejection: ${r}`, 'main');
  });

  // Receive log entries from the renderer
  ipcMain.on('log:renderer', (_event, entry: { level?: string; message?: string }) => {
    const level = (entry?.level === 'warn' || entry?.level === 'info') ? entry.level : 'error';
    const message = typeof entry?.message === 'string' ? entry.message : String(entry);
    write(level, message, 'renderer');
  });

  log('info', `=== HR Database ${app.getVersion()} started (${process.platform} ${process.arch}) ===`);
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

export function getLogTail(lines: number): string {
  const p = getLogPath();
  try {
    if (!fs.existsSync(p)) return '';
    const data = fs.readFileSync(p, 'utf-8');
    const all = data.split(/\r?\n/);
    const tail = all.slice(Math.max(0, all.length - lines - 1));
    return tail.join('\n');
  } catch {
    return '';
  }
}
