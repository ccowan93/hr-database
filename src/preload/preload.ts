import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Employee CRUD
  getAllEmployees: (filters?: any) => ipcRenderer.invoke('db:get-all-employees', filters),
  getEmployee: (id: number) => ipcRenderer.invoke('db:get-employee', id),
  createEmployee: (data: any) => ipcRenderer.invoke('db:create-employee', data),
  updateEmployee: (id: number, data: any) => ipcRenderer.invoke('db:update-employee', id, data),
  deleteEmployee: (id: number) => ipcRenderer.invoke('db:delete-employee', id),
  archiveEmployee: (id: number) => ipcRenderer.invoke('db:archive-employee', id),
  restoreEmployee: (id: number) => ipcRenderer.invoke('db:restore-employee', id),

  // Pay History
  getPayHistory: (employeeId: number) => ipcRenderer.invoke('db:get-pay-history', employeeId),

  // Audit Log
  getAuditLog: (employeeId: number) => ipcRenderer.invoke('db:get-audit-log', employeeId),
  getGlobalAuditLog: (limit: number, offset: number) => ipcRenderer.invoke('db:get-global-audit-log', limit, offset),
  getGlobalAuditLogCount: () => ipcRenderer.invoke('db:get-global-audit-log-count'),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('db:get-dashboard-stats'),
  getDepartments: () => ipcRenderer.invoke('db:get-departments'),

  // Alerts
  getUpcomingBirthdays: (days: number) => ipcRenderer.invoke('db:get-upcoming-birthdays', days),
  getUpcomingAnniversaries: (days: number) => ipcRenderer.invoke('db:get-upcoming-anniversaries', days),

  // Import
  importXlsx: () => ipcRenderer.invoke('db:import-xlsx'),
  importXlsxPath: (filePath: string) => ipcRenderer.invoke('db:import-xlsx-path', filePath),
  importUpdateXlsx: () => ipcRenderer.invoke('db:import-update-xlsx'),

  // Export
  exportEmployeesXlsx: (filters?: any) => ipcRenderer.invoke('export:employees-xlsx', filters),
  exportEmployeePDF: (id: number) => ipcRenderer.invoke('export:employee-pdf', id),
  exportDashboardPDF: () => ipcRenderer.invoke('export:dashboard-pdf'),

  // Misc
  getCountries: () => ipcRenderer.invoke('db:get-countries'),
  getRaces: () => ipcRenderer.invoke('db:get-races'),
  getEthnicities: () => ipcRenderer.invoke('db:get-ethnicities'),
  getLanguages: () => ipcRenderer.invoke('db:get-languages'),
  getEducationLevels: () => ipcRenderer.invoke('db:get-education-levels'),

  // Employee Notes
  getEmployeeNotes: (employeeId: number) => ipcRenderer.invoke('db:get-employee-notes', employeeId),
  addEmployeeNote: (employeeId: number, content: string) => ipcRenderer.invoke('db:add-employee-note', employeeId, content),
  updateEmployeeNote: (noteId: number, content: string) => ipcRenderer.invoke('db:update-employee-note', noteId, content),
  deleteEmployeeNote: (noteId: number) => ipcRenderer.invoke('db:delete-employee-note', noteId),
  getLanguageDistribution: () => ipcRenderer.invoke('db:get-language-distribution'),
  getMonthlyTurnover: (months: number) => ipcRenderer.invoke('db:get-monthly-turnover', months),
  getPayGrowth: () => ipcRenderer.invoke('db:get-pay-growth'),
  getTimeSinceRaise: () => ipcRenderer.invoke('db:get-time-since-raise'),
  getPayEquity: () => ipcRenderer.invoke('db:get-pay-equity'),
  getAgeDistribution: () => ipcRenderer.invoke('db:get-age-distribution'),
  getSupervisorRatio: () => ipcRenderer.invoke('db:get-supervisor-ratio'),
  getAvgAgeByDept: () => ipcRenderer.invoke('db:get-avg-age-by-dept'),
  getHeadcountGrowth: (months: number) => ipcRenderer.invoke('db:get-headcount-growth', months),
  getDepartmentTransfers: () => ipcRenderer.invoke('db:get-department-transfers'),
  getRetentionRate: () => ipcRenderer.invoke('db:get-retention-rate'),
  getEmployeeCount: () => ipcRenderer.invoke('db:get-employee-count'),
  bulkUpdateEmployees: (ids: number[], data: any) => ipcRenderer.invoke('db:bulk-update-employees', ids, data),
  searchEmployees: (query: string, limit?: number) => ipcRenderer.invoke('db:search-employees', query, limit),
  saveEmployeePhoto: (employeeId: number) => ipcRenderer.invoke('db:save-employee-photo', employeeId),
  removeEmployeePhoto: (employeeId: number) => ipcRenderer.invoke('db:remove-employee-photo', employeeId),
  getEmployeePhoto: (employeeId: number) => ipcRenderer.invoke('db:get-employee-photo', employeeId),
  // Employee Files
  uploadEmployeeFile: (employeeId: number) => ipcRenderer.invoke('db:upload-employee-file', { employeeId }),
  getEmployeeFiles: (employeeId: number) => ipcRenderer.invoke('db:get-employee-files', employeeId),
  deleteEmployeeFile: (id: number) => ipcRenderer.invoke('db:delete-employee-file', id),
  openEmployeeFile: (id: number) => ipcRenderer.invoke('db:open-employee-file', id),

  resetDatabase: () => ipcRenderer.invoke('db:reset-database'),
  backupDatabase: () => ipcRenderer.invoke('db:backup'),
  restoreDatabase: () => ipcRenderer.invoke('db:restore'),

  // Attendance
  parseAttendance: () => ipcRenderer.invoke('db:parse-attendance'),
  confirmAttendanceImport: (data: any) => ipcRenderer.invoke('db:confirm-attendance-import', data),
  getAttendance: (employeeId: number, startDate: string, endDate: string) => ipcRenderer.invoke('db:get-attendance', employeeId, startDate, endDate),
  getAttendanceByDept: (department: string, startDate: string, endDate: string) => ipcRenderer.invoke('db:get-attendance-by-dept', department, startDate, endDate),
  getAttendanceSummary: (filters: any) => ipcRenderer.invoke('db:get-attendance-summary', filters),
  getAttendanceImports: () => ipcRenderer.invoke('db:get-attendance-imports'),
  deleteAttendanceBatch: (batchId: string) => ipcRenderer.invoke('db:delete-attendance-batch', batchId),
  deleteAttendanceRecord: (id: number) => ipcRenderer.invoke('db:delete-attendance-record', id),
  deleteAttendanceRecords: (ids: number[]) => ipcRenderer.invoke('db:delete-attendance-records', ids),
  getAllAttendance: (startDate: string, endDate: string) => ipcRenderer.invoke('db:get-all-attendance', startDate, endDate),

  // Time Off
  createTimeOffRequest: (data: any) => ipcRenderer.invoke('db:create-time-off-request', data),
  updateTimeOffRequest: (id: number, data: any) => ipcRenderer.invoke('db:update-time-off-request', id, data),
  getTimeOffRequests: (filters?: any) => ipcRenderer.invoke('db:get-time-off-requests', filters),
  getTimeOffBalances: (employeeId: number, year: number) => ipcRenderer.invoke('db:get-time-off-balances', employeeId, year),
  upsertTimeOffBalance: (employeeId: number, year: number, requestType: string, allocatedHours: number) => ipcRenderer.invoke('db:upsert-time-off-balance', employeeId, year, requestType, allocatedHours),

  // Attendance Reports
  getOvertimeReport: (startDate: string, endDate: string, groupBy: string) => ipcRenderer.invoke('db:get-overtime-report', startDate, endDate, groupBy),
  getAbsenteeismReport: (startDate: string, endDate: string) => ipcRenderer.invoke('db:get-absenteeism-report', startDate, endDate),
  getTardinessReport: (startDate: string, endDate: string, dayThreshold?: string, nightThreshold?: string) => ipcRenderer.invoke('db:get-tardiness-report', startDate, endDate, dayThreshold, nightThreshold),
  getTimeOffUsageReport: (year: number) => ipcRenderer.invoke('db:get-timeoff-usage-report', year),

  // OneDrive Cloud Backup
  onedriveGetStatus: () => ipcRenderer.invoke('onedrive:get-status'),
  onedriveSetClientId: (clientId: string) => ipcRenderer.invoke('onedrive:set-client-id', clientId),
  onedriveSignIn: () => ipcRenderer.invoke('onedrive:sign-in'),
  onedriveSignOut: () => ipcRenderer.invoke('onedrive:sign-out'),
  onedriveBackupNow: () => ipcRenderer.invoke('onedrive:backup-now'),
  onedriveListBackups: () => ipcRenderer.invoke('onedrive:list-backups'),
  onedriveRestoreBackup: (fileId: string) => ipcRenderer.invoke('onedrive:restore-backup', fileId),
  onedriveUpdateSettings: (settings: { backupFolder?: string; backupIntervalHours?: number }) => ipcRenderer.invoke('onedrive:update-settings', settings),

  // Local Backup
  localBackupGetStatus: () => ipcRenderer.invoke('local-backup:get-status'),
  localBackupChooseFolder: () => ipcRenderer.invoke('local-backup:choose-folder'),
  localBackupEnable: (folder: string, intervalHours: number, keepCount: number) => ipcRenderer.invoke('local-backup:enable', folder, intervalHours, keepCount),
  localBackupDisable: () => ipcRenderer.invoke('local-backup:disable'),
  localBackupNow: () => ipcRenderer.invoke('local-backup:backup-now'),
  localBackupList: () => ipcRenderer.invoke('local-backup:list'),
  localBackupRestore: (backupPath: string) => ipcRenderer.invoke('local-backup:restore', backupPath),
  localBackupUpdateSettings: (settings: { intervalHours?: number; keepCount?: number }) => ipcRenderer.invoke('local-backup:update-settings', settings),

  // Shift Configuration
  getShiftConfig: () => ipcRenderer.invoke('app:get-shift-config'),
  saveShiftConfig: (config: { dayShiftStart: string; nightShiftStart: string }) => ipcRenderer.invoke('app:save-shift-config', config),

  // App Updates
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openReleasePage: (url?: string) => ipcRenderer.invoke('app:open-release-page', url),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
export type ElectronAPI = typeof electronAPI;
