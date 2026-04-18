import { app, dialog, shell, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getConfig } from './app-config';
import { getLogTail, getLogPath } from './logger';
import { BUG_RELAY_URL, BUG_RELAY_SECRET } from './bug-relay-config';

const GITHUB_ISSUE_URL = 'https://github.com/ccowan93/hr-database/issues/new';

export interface BugReportInput {
  description: string;
  email?: string;
  stepsToReproduce?: string;
  includeLogs?: boolean;
}

export interface BugReport {
  generatedAt: string;
  app: {
    name: string;
    version: string;
  };
  system: {
    platform: NodeJS.Platform;
    arch: string;
    osRelease: string;
    osVersion: string;
    cpu: string;
    totalMemoryMB: number;
    electronVersion: string;
    nodeVersion: string;
    chromeVersion: string;
    displays: { width: number; height: number; scale: number }[];
    locale: string;
    uptimeSeconds: number;
  };
  user: {
    description: string;
    email?: string;
    stepsToReproduce?: string;
  };
  config: {
    theme: string | null;
    localBackupEnabled: boolean;
    localBackupIntervalHours: number;
    onedriveEnabled: boolean;
    onedriveIntervalHours: number;
    authConfigured: boolean;
    touchIdEnabled: boolean;
    encryptionReady: boolean;
  };
  logs: string | null;
  logPath: string;
}

function sanitizedConfigSnapshot() {
  const c = getConfig();
  return {
    theme: null, // renderer-held
    localBackupEnabled: !!c.localBackup?.enabled,
    localBackupIntervalHours: c.localBackup?.intervalHours ?? 0,
    onedriveEnabled: !!c.onedrive?.enabled,
    onedriveIntervalHours: c.onedrive?.backupIntervalHours ?? 0,
    authConfigured: !!(c.auth?.passwordHash && c.auth?.salt),
    touchIdEnabled: !!c.auth?.touchIdEnabled,
    encryptionReady: !!(c.auth?.dekCiphertext && c.auth?.dekIv && c.auth?.dekTag),
  };
}

function sanitizeText(input: string): string {
  // Strip things that look like emails (other than the reporter's own), long
  // digit sequences that might be phone numbers/ssn-like, and collapse super
  // long tokens. Conservative — preserves error stacks.
  let out = input;
  out = out.replace(/(\d{3}[-\s]?)?(\d{2})[-\s]?(\d{4})(?!\d)/g, (m) => {
    // Redact US phone-like and ssn-like sequences, but leave short numeric runs alone
    if (m.replace(/\D/g, '').length >= 9) return '[redacted-number]';
    return m;
  });
  return out;
}

export function buildBugReport(input: BugReportInput): BugReport {
  const displays = screen.getAllDisplays().map(d => ({
    width: d.size.width,
    height: d.size.height,
    scale: d.scaleFactor,
  }));

  return {
    generatedAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      osVersion: (os as { version?: () => string }).version?.() || '',
      cpu: os.cpus()[0]?.model || 'unknown',
      totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      electronVersion: process.versions.electron || '',
      nodeVersion: process.versions.node || '',
      chromeVersion: process.versions.chrome || '',
      displays,
      locale: app.getLocale(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    user: {
      description: sanitizeText(input.description || ''),
      email: input.email?.trim() || undefined,
      stepsToReproduce: input.stepsToReproduce ? sanitizeText(input.stepsToReproduce) : undefined,
    },
    config: sanitizedConfigSnapshot(),
    logs: input.includeLogs === false ? null : getLogTail(400),
    logPath: getLogPath(),
  };
}

export async function saveBugReport(
  report: BugReport,
): Promise<{ success: boolean; path?: string; error?: string; cancelled?: boolean }> {
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const defaultName = `hr-database-bug-report-${stamp}.json`;

  const result = await dialog.showSaveDialog({
    title: 'Save Bug Report',
    defaultPath: path.join(app.getPath('desktop'), defaultName),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, cancelled: true };

  try {
    fs.writeFileSync(result.filePath, JSON.stringify(report, null, 2), 'utf-8');
    // Reveal in explorer/finder for convenience
    try { shell.showItemInFolder(result.filePath); } catch (_) {}
    return { success: true, path: result.filePath };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save report' };
  }
}

export function isRelayConfigured(): boolean {
  return !!(BUG_RELAY_URL && BUG_RELAY_SECRET);
}

export interface RelaySubmitResult {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  gistUrl?: string | null;
  error?: string;
}

/**
 * Submit the bug report to the Cloudflare Worker relay, which creates a GitHub
 * issue using a server-side token and returns the issue URL. This lets end
 * users file bugs without a GitHub account or repo access.
 */
export async function submitBugReportViaRelay(input: BugReportInput): Promise<RelaySubmitResult> {
  if (!isRelayConfigured()) {
    return { success: false, error: 'Bug-report relay is not configured in this build.' };
  }
  const report = buildBugReport(input);
  const { installId } = getConfig();
  const payload = { ...report, installId };

  try {
    const res = await fetch(`${BUG_RELAY_URL.replace(/\/$/, '')}/report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-secret': BUG_RELAY_SECRET,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      error?: string;
      issueUrl?: string;
      issueNumber?: number;
      gistUrl?: string | null;
    };
    if (!res.ok || !data.issueUrl) {
      return { success: false, error: data.error || `Relay returned HTTP ${res.status}` };
    }
    return {
      success: true,
      issueUrl: data.issueUrl,
      issueNumber: data.issueNumber,
      gistUrl: data.gistUrl ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Network error reaching relay: ${msg}` };
  }
}

export function getGithubIssueUrl(input: { description?: string; summary?: string }): string {
  const title = (input.summary || 'Bug report').slice(0, 120);
  const bodyLines = [
    '<!-- Thanks for reporting! Please describe the problem below. -->',
    '',
    '### What happened',
    input.description || '',
    '',
    '### App info',
    `- Version: ${app.getVersion()}`,
    `- Platform: ${process.platform} ${process.arch}`,
    `- OS: ${os.release()}`,
    '',
    '### Steps to reproduce',
    '1. ',
    '',
    '_Please attach the saved bug-report JSON file if you have one._',
  ].join('\n');
  const url = `${GITHUB_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(bodyLines)}`;
  return url;
}
