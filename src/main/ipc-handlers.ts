import { ipcMain, dialog, shell, app } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  getAllEmployees, getEmployee, createEmployee, updateEmployee,
  deleteEmployee, archiveEmployee, restoreEmployee,
  getDashboardStats, getDepartments, getPayHistory,
  getAuditLog, getGlobalAuditLog, getGlobalAuditLogCount,
  getUpcomingBirthdays, getUpcomingAnniversaries, resetDatabase, getCountries, getDbPath, getDb, initDatabase,
  getEmployeeNotes, addEmployeeNote, updateEmployeeNote, deleteEmployeeNote,
  addEmployeeFile, getEmployeeFiles, getEmployeeFile, deleteEmployeeFile,
  getLanguageDistribution, getMonthlyTurnover,
  getPayGrowthByDepartment, getTimeSinceLastRaise, getPayEquity,
  getAgeDistribution, getSupervisorRatio, getAvgAgeByDepartment,
  getHeadcountGrowth, getDepartmentTransfers, getRetentionRate,
  bulkUpdateEmployees, searchEmployees, getSavedReports, upsertSavedReport, deleteSavedReport,
  getRaces, getEthnicities, getLanguages, getEducationLevels,
  getAttendanceByEmployee, getAttendanceByDepartment, getAttendanceSummary,
  getAttendanceImports, deleteAttendanceBatch,
  deleteAttendanceRecord, deleteAttendanceRecords, deleteAttendanceBatchWithAudit, getAllAttendanceRecords,
  createTimeOffRequest, updateTimeOffRequest, getTimeOffRequests,
  getTimeOffBalances, upsertTimeOffBalance,
  getOvertimeReport, getAbsenteeismReport, getTardinessReport, getTimeOffUsageReport,
  getAllShifts, getShift, createShift, updateShift, deleteShift,
  getLeftEarlyReport, getLunchDurationReport
} from './database';
import { extractText } from './ocr';
import { importFromExcel } from './import-xlsx';
import { importUpdateFromExcel } from './import-update-xlsx';
import { parseAttendanceFile, confirmAttendanceImport } from './import-attendance';
import { exportEmployeesToXlsx } from './export-xlsx';
import { exportEmployeePDF, exportDashboardPDF } from './export-pdf';
import { signIn as onedriveSignIn, signOut as onedriveSignOut, uploadBackup, restoreFromOneDrive, downloadBackupFile, getOneDriveStatus, setClientId, startBackupScheduler } from './onedrive-backup';
import { runLocalBackup, getLocalBackupStatus, listLocalBackups, restoreLocalBackup, startLocalBackupScheduler } from './local-backup';
import { saveConfig, getConfig } from './app-config';

export function registerIpcHandlers() {
  // ── Employee CRUD ──
  ipcMain.handle('db:get-all-employees', (_event, filters) => getAllEmployees(filters || {}));
  ipcMain.handle('db:get-employee', (_event, id: number) => getEmployee(id));
  ipcMain.handle('db:create-employee', (_event, data) => createEmployee(data));
  ipcMain.handle('db:update-employee', (_event, id: number, data) => {
    updateEmployee(id, data);
    return getEmployee(id);
  });
  ipcMain.handle('db:delete-employee', (_event, id: number) => { deleteEmployee(id); return true; });
  ipcMain.handle('db:archive-employee', (_event, id: number) => { archiveEmployee(id); return getEmployee(id); });
  ipcMain.handle('db:restore-employee', (_event, id: number) => { restoreEmployee(id); return getEmployee(id); });

  // ── Pay History ──
  ipcMain.handle('db:get-pay-history', (_event, employeeId: number) => getPayHistory(employeeId));

  // ── Audit Log ──
  ipcMain.handle('db:get-audit-log', (_event, employeeId: number) => getAuditLog(employeeId));
  ipcMain.handle('db:get-global-audit-log', (_event, limit: number, offset: number) => getGlobalAuditLog(limit, offset));
  ipcMain.handle('db:get-global-audit-log-count', () => getGlobalAuditLogCount());

  // ── Dashboard & Departments ──
  ipcMain.handle('db:get-dashboard-stats', () => getDashboardStats());
  ipcMain.handle('db:get-departments', () => getDepartments());
  ipcMain.handle('db:get-countries', () => getCountries());
  ipcMain.handle('db:get-races', () => getRaces());
  ipcMain.handle('db:get-ethnicities', () => getEthnicities());
  ipcMain.handle('db:get-languages', () => getLanguages());
  ipcMain.handle('db:get-education-levels', () => getEducationLevels());

  // ── Birthday & Anniversary Alerts ──
  ipcMain.handle('db:get-upcoming-birthdays', (_event, days: number) => getUpcomingBirthdays(days));
  ipcMain.handle('db:get-upcoming-anniversaries', (_event, days: number) => getUpcomingAnniversaries(days));

  // ── Import ──
  ipcMain.handle('db:import-xlsx', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Excel File to Import',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { imported: 0, skipped: 0, errors: ['Import cancelled'] };
    return importFromExcel(result.filePaths[0]);
  });

  ipcMain.handle('db:import-xlsx-path', async (_event, filePath: string) => importFromExcel(filePath));

  ipcMain.handle('db:import-update-xlsx', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Excel File to Update Employees',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { updated: 0, notFound: [], skipped: 0, errors: ['Import cancelled'] };
    return importUpdateFromExcel(result.filePaths[0]);
  });

  // ── Export ──
  ipcMain.handle('export:employees-xlsx', async (_event, filters) => {
    const employees = getAllEmployees(filters || {});
    return exportEmployeesToXlsx(employees);
  });

  ipcMain.handle('export:employee-pdf', async (_event, id: number) => {
    const employee = getEmployee(id);
    if (!employee) return { success: false, error: 'Employee not found' };
    const payHistory = getPayHistory(id);
    return exportEmployeePDF(employee, payHistory);
  });

  ipcMain.handle('export:dashboard-pdf', async () => {
    const stats = getDashboardStats();
    return exportDashboardPDF(stats);
  });

  // ── Language Distribution & Turnover ──
  ipcMain.handle('db:get-language-distribution', () => getLanguageDistribution());
  ipcMain.handle('db:get-monthly-turnover', (_event, months: number) => getMonthlyTurnover(months));

  // ── Advanced Analytics ──
  ipcMain.handle('db:get-pay-growth', () => getPayGrowthByDepartment());
  ipcMain.handle('db:get-time-since-raise', () => getTimeSinceLastRaise());
  ipcMain.handle('db:get-pay-equity', () => getPayEquity());
  ipcMain.handle('db:get-age-distribution', () => getAgeDistribution());
  ipcMain.handle('db:get-supervisor-ratio', () => getSupervisorRatio());
  ipcMain.handle('db:get-avg-age-by-dept', () => getAvgAgeByDepartment());
  ipcMain.handle('db:get-headcount-growth', (_event, months: number) => getHeadcountGrowth(months));
  ipcMain.handle('db:get-department-transfers', () => getDepartmentTransfers());
  ipcMain.handle('db:get-retention-rate', () => getRetentionRate());

  // ── Employee Count ──
  ipcMain.handle('db:get-employee-count', () => {
    const { getDb } = require('./database');
    const row = getDb().prepare(`SELECT COUNT(*) as count FROM employees WHERE (status = 'active' OR status IS NULL)`).get() as any;
    return row.count;
  });

  // ── Employee Notes ──
  ipcMain.handle('db:get-employee-notes', (_event, employeeId: number) => getEmployeeNotes(employeeId));
  ipcMain.handle('db:add-employee-note', (_event, employeeId: number, content: string) => addEmployeeNote(employeeId, content));
  ipcMain.handle('db:update-employee-note', (_event, noteId: number, content: string) => { updateEmployeeNote(noteId, content); return true; });
  ipcMain.handle('db:delete-employee-note', (_event, noteId: number) => { deleteEmployeeNote(noteId); return true; });

  // ── Bulk Update ──
  ipcMain.handle('db:bulk-update-employees', (_event, ids: number[], data: any) => {
    bulkUpdateEmployees(ids, data);
    return true;
  });

  // ── Search Autocomplete ──
  ipcMain.handle('db:search-employees', (_event, query: string, limit?: number) => searchEmployees(query, limit));

  // ── Employee Photo ──
  ipcMain.handle('db:save-employee-photo', async (_event, employeeId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Employee Photo',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false };
    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath);
    const photosDir = path.join(path.dirname(getDbPath()), 'employee-photos');
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
    const destPath = path.join(photosDir, `${employeeId}${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    // Update the employee record
    getDb().prepare('UPDATE employees SET photo_path = ? WHERE id = ?').run(destPath, employeeId);
    return { success: true, path: destPath };
  });

  ipcMain.handle('db:remove-employee-photo', (_event, employeeId: number) => {
    const emp = getDb().prepare('SELECT photo_path FROM employees WHERE id = ?').get(employeeId) as any;
    if (emp?.photo_path) {
      try { fs.unlinkSync(emp.photo_path); } catch (_) {}
    }
    getDb().prepare('UPDATE employees SET photo_path = NULL WHERE id = ?').run(employeeId);
    return true;
  });

  ipcMain.handle('db:get-employee-photo', (_event, employeeId: number) => {
    const emp = getDb().prepare('SELECT photo_path FROM employees WHERE id = ?').get(employeeId) as any;
    if (!emp?.photo_path || !fs.existsSync(emp.photo_path)) return null;
    const data = fs.readFileSync(emp.photo_path);
    const ext = path.extname(emp.photo_path).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${data.toString('base64')}`;
  });

  // ── Employee Files ──
  ipcMain.handle('db:upload-employee-file', async (_event, { employeeId, filePath }: { employeeId: number; filePath?: string }) => {
    let sourcePath = filePath;
    if (!sourcePath) {
      const result = await dialog.showOpenDialog({
        title: 'Select File to Attach',
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      sourcePath = result.filePaths[0];
    }
    const fileName = path.basename(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();
    const filesDir = path.join(app.getPath('userData'), 'files', String(employeeId));
    fs.mkdirSync(filesDir, { recursive: true });
    const destPath = path.join(filesDir, fileName);
    fs.copyFileSync(sourcePath, destPath);
    const stats = fs.statSync(destPath);

    // Run OCR on images
    let ocrText = '';
    try {
      ocrText = await extractText(destPath);
    } catch (_) {}

    // Save OCR text file alongside original
    if (ocrText) {
      fs.writeFileSync(destPath + '.txt', ocrText, 'utf-8');
    }

    const record = addEmployeeFile({
      employee_id: employeeId,
      file_name: fileName,
      file_path: destPath,
      file_type: ext.replace('.', ''),
      file_size: stats.size,
      ocr_text: ocrText || undefined,
    });
    return record;
  });

  ipcMain.handle('db:get-employee-files', (_event, employeeId: number) => getEmployeeFiles(employeeId));

  ipcMain.handle('db:delete-employee-file', (_event, id: number) => {
    deleteEmployeeFile(id);
    return true;
  });

  ipcMain.handle('db:open-employee-file', async (_event, id: number) => {
    const file = getEmployeeFile(id);
    if (file && fs.existsSync(file.file_path)) {
      await shell.openPath(file.file_path);
      return true;
    }
    return false;
  });

  // ── Saved Reports ──
  ipcMain.handle('db:get-saved-reports', () => getSavedReports());
  ipcMain.handle('db:upsert-saved-report', (_event, name: string, config: string) => { upsertSavedReport(name, config); return true; });
  ipcMain.handle('db:delete-saved-report', (_event, name: string) => { deleteSavedReport(name); return true; });

  // ── Reset Database ──
  ipcMain.handle('db:reset-database', () => {
    resetDatabase();
    return true;
  });

  // ── Backup & Restore ──
  ipcMain.handle('db:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: `hr-database-backup-${new Date().toISOString().split('T')[0]}.sqlite`,
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };
    try {
      const dbPath = getDbPath();
      getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(dbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore Database from Backup',
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' };
    try {
      const dbPath = getDbPath();
      const backupPath = result.filePaths[0];
      getDb().close();
      fs.copyFileSync(backupPath, dbPath);
      // Remove WAL/SHM files if they exist
      try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
      try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}
      initDatabase();
      return { success: true };
    } catch (err: any) {
      try { initDatabase(); } catch (_) {}
      return { success: false, error: err.message };
    }
  });

  // ── Attendance Import (two-step) ──
  ipcMain.handle('db:parse-attendance', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import CompuTime101 Attendance File',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return parseAttendanceFile(result.filePaths[0]);
  });

  ipcMain.handle('db:confirm-attendance-import', (_event, data: { records: any[]; manualMappings: { rawName: string; employeeId: number }[]; updateNames: boolean }) => {
    return confirmAttendanceImport(data);
  });

  // ── Attendance Queries ──
  ipcMain.handle('db:get-attendance', (_event, employeeId: number, startDate: string, endDate: string) =>
    getAttendanceByEmployee(employeeId, startDate, endDate));
  ipcMain.handle('db:get-attendance-by-dept', (_event, department: string, startDate: string, endDate: string) =>
    getAttendanceByDepartment(department, startDate, endDate));
  ipcMain.handle('db:get-attendance-summary', (_event, filters: any) => getAttendanceSummary(filters));
  ipcMain.handle('db:get-attendance-imports', () => getAttendanceImports());
  ipcMain.handle('db:delete-attendance-batch', (_event, batchId: string) => { return deleteAttendanceBatchWithAudit(batchId); });
  ipcMain.handle('db:delete-attendance-record', (_event, recordId: number) => deleteAttendanceRecord(recordId));
  ipcMain.handle('db:delete-attendance-records', (_event, recordIds: number[]) => deleteAttendanceRecords(recordIds));
  ipcMain.handle('db:get-all-attendance', (_event, startDate: string, endDate: string) => getAllAttendanceRecords(startDate, endDate));

  // ── Time-Off Requests ──
  ipcMain.handle('db:create-time-off-request', (_event, data: any) => createTimeOffRequest(data));
  ipcMain.handle('db:update-time-off-request', (_event, id: number, data: any) => { updateTimeOffRequest(id, data); return true; });
  ipcMain.handle('db:get-time-off-requests', (_event, filters: any) => getTimeOffRequests(filters || {}));
  ipcMain.handle('db:get-time-off-balances', (_event, employeeId: number, year: number) => getTimeOffBalances(employeeId, year));
  ipcMain.handle('db:upsert-time-off-balance', (_event, employeeId: number, year: number, requestType: string, allocatedHours: number) =>
    { upsertTimeOffBalance(employeeId, year, requestType, allocatedHours); return true; });

  // ── Attendance Reports ──
  ipcMain.handle('db:get-overtime-report', (_event, startDate: string, endDate: string, groupBy: 'employee' | 'department') =>
    getOvertimeReport(startDate, endDate, groupBy));
  ipcMain.handle('db:get-absenteeism-report', (_event, startDate: string, endDate: string) =>
    getAbsenteeismReport(startDate, endDate));
  ipcMain.handle('db:get-tardiness-report', (_event, startDate: string, endDate: string) =>
    getTardinessReport(startDate, endDate));
  ipcMain.handle('db:get-left-early-report', (_event, startDate: string, endDate: string) =>
    getLeftEarlyReport(startDate, endDate));
  ipcMain.handle('db:get-lunch-duration-report', (_event, startDate: string, endDate: string) =>
    getLunchDurationReport(startDate, endDate));
  ipcMain.handle('db:get-timeoff-usage-report', (_event, year: number) => getTimeOffUsageReport(year));

  // ── Shifts CRUD ──
  ipcMain.handle('db:get-all-shifts', () => getAllShifts());
  ipcMain.handle('db:get-shift', (_event, id: number) => getShift(id));
  ipcMain.handle('db:create-shift', (_event, data: { shift_name: string; scheduled_in: string; scheduled_out: string; scheduled_lunch_start?: string | null; scheduled_lunch_end?: string | null }) => createShift(data));
  ipcMain.handle('db:update-shift', (_event, id: number, data: Record<string, any>) => {
    updateShift(id, data);
    return getShift(id);
  });
  ipcMain.handle('db:delete-shift', (_event, id: number) => deleteShift(id));

  // ── OneDrive Cloud Backup ──
  ipcMain.handle('onedrive:get-status', () => getOneDriveStatus());
  ipcMain.handle('onedrive:set-client-id', (_event, clientId: string) => { setClientId(clientId); return true; });
  ipcMain.handle('onedrive:sign-in', () => onedriveSignIn());
  ipcMain.handle('onedrive:sign-out', async () => { await onedriveSignOut(); return true; });
  ipcMain.handle('onedrive:backup-now', () => uploadBackup());
  ipcMain.handle('onedrive:list-backups', () => restoreFromOneDrive());
  ipcMain.handle('onedrive:restore-backup', (_event, fileId: string) => downloadBackupFile(fileId));
  ipcMain.handle('onedrive:update-settings', (_event, settings: { backupFolder?: string; backupIntervalHours?: number }) => {
    saveConfig({ onedrive: settings as any });
    startBackupScheduler();
    return true;
  });

  // ── Local Backup ──
  ipcMain.handle('local-backup:get-status', () => getLocalBackupStatus());
  ipcMain.handle('local-backup:choose-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Local Backup Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle('local-backup:enable', (_event, folder: string, intervalHours: number, keepCount: number) => {
    saveConfig({ localBackup: { enabled: true, folder, lastBackup: null, intervalHours, keepCount } });
    startLocalBackupScheduler();
    return true;
  });
  ipcMain.handle('local-backup:disable', () => {
    saveConfig({ localBackup: { enabled: false, folder: null, lastBackup: null, intervalHours: 24, keepCount: 7 } });
    startLocalBackupScheduler();
    return true;
  });
  ipcMain.handle('local-backup:backup-now', () => runLocalBackup());
  ipcMain.handle('local-backup:list', () => listLocalBackups());
  ipcMain.handle('local-backup:restore', (_event, backupPath: string) => restoreLocalBackup(backupPath));
  ipcMain.handle('local-backup:update-settings', (_event, settings: { intervalHours?: number; keepCount?: number }) => {
    saveConfig({ localBackup: settings as any });
    startLocalBackupScheduler();
    return true;
  });

  // ── Update Checker ──
  ipcMain.handle('app:check-for-updates', async () => {
    const { checkForUpdates } = await import('./update-checker');
    try {
      return await checkForUpdates();
    } catch {
      return null;
    }
  });

  ipcMain.handle('app:download-update', async () => {
    const { downloadUpdate } = await import('./update-checker');
    try {
      await downloadUpdate();
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('app:install-update', (_event, releaseNotes?: string, version?: string) => {
    const { installUpdate } = require('./update-checker');
    installUpdate(releaseNotes, version);
  });

  ipcMain.handle('app:get-post-update-info', () => {
    const { getPostUpdateInfo } = require('./update-checker');
    return getPostUpdateInfo();
  });

  ipcMain.handle('app:open-release-page', async (_event, url?: string) => {
    const { openReleasePage } = await import('./update-checker');
    openReleasePage(url);
  });

  // ── Shift Configuration ──
  ipcMain.handle('app:get-shift-config', () => {
    const config = getConfig();
    return config.shifts || { dayShiftStart: '07:00', nightShiftStart: '19:00' };
  });

  ipcMain.handle('app:save-shift-config', (_event, shiftConfig: { dayShiftStart: string; nightShiftStart: string }) => {
    saveConfig({ shifts: shiftConfig });
    return true;
  });

  ipcMain.handle('app:get-version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });
}
