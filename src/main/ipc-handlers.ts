import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  getAllEmployees, getEmployee, createEmployee, updateEmployee,
  deleteEmployee, archiveEmployee, restoreEmployee,
  getDashboardStats, getDepartments, getPayHistory,
  getAuditLog, getGlobalAuditLog, getGlobalAuditLogCount,
  getUpcomingBirthdays, getUpcomingAnniversaries, resetDatabase, getCountries, getDbPath, getDb, initDatabase,
  getEmployeeNotes, addEmployeeNote, updateEmployeeNote, deleteEmployeeNote,
  getLanguageDistribution, getMonthlyTurnover,
  getPayGrowthByDepartment, getTimeSinceLastRaise, getPayEquity,
  getAgeDistribution, getSupervisorRatio, getAvgAgeByDepartment,
  getHeadcountGrowth, getDepartmentTransfers, getRetentionRate,
  bulkUpdateEmployees, searchEmployees,
  getRaces, getEthnicities, getLanguages, getEducationLevels
} from './database';
import { importFromExcel } from './import-xlsx';
import { importUpdateFromExcel } from './import-update-xlsx';
import { exportEmployeesToXlsx } from './export-xlsx';
import { exportEmployeePDF, exportDashboardPDF } from './export-pdf';

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

  ipcMain.handle('db:import-xlsx-path', (_event, filePath: string) => importFromExcel(filePath));

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
}
