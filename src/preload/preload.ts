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

  getSavedReports: () => ipcRenderer.invoke('db:get-saved-reports'),
  upsertSavedReport: (name: string, config: string) => ipcRenderer.invoke('db:upsert-saved-report', name, config),
  deleteSavedReport: (name: string) => ipcRenderer.invoke('db:delete-saved-report', name),

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
  getOvertimeReport: (startDate: string, endDate: string, groupBy: string, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-overtime-report', startDate, endDate, groupBy, filters),
  getAbsenteeismReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-absenteeism-report', startDate, endDate, filters),
  getTardinessReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-tardiness-report', startDate, endDate, filters),
  getLeftEarlyReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-left-early-report', startDate, endDate, filters),
  getLunchDurationReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-lunch-duration-report', startDate, endDate, filters),
  getTimeOffUsageReport: (year: number, filters?: { employeeIds?: number[]; department?: string }) => ipcRenderer.invoke('db:get-timeoff-usage-report', year, filters),

  // Calendar Attendance Flags
  getCalendarAttendanceFlags: (employeeId: number, startDate: string, endDate: string) => ipcRenderer.invoke('db:get-calendar-attendance-flags', employeeId, startDate, endDate),
  getSalaryAttendanceFlags: (employeeId: number, startDate: string, endDate: string) => ipcRenderer.invoke('db:get-salary-attendance-flags', employeeId, startDate, endDate),
  setSalaryAttendanceFlag: (employeeId: number, date: string, flagType: string, notes?: string) => ipcRenderer.invoke('db:set-salary-attendance-flag', employeeId, date, flagType, notes),
  removeSalaryAttendanceFlag: (employeeId: number, date: string, flagType: string) => ipcRenderer.invoke('db:remove-salary-attendance-flag', employeeId, date, flagType),

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

  // FMLA
  getFmlaConfig: () => ipcRenderer.invoke('db:get-fmla-config'),
  updateFmlaConfig: (data: any) => ipcRenderer.invoke('db:update-fmla-config', data),
  checkFmlaEligibility: (employeeId: number) => ipcRenderer.invoke('db:check-fmla-eligibility', employeeId),
  createFmlaCase: (data: any) => ipcRenderer.invoke('db:create-fmla-case', data),
  updateFmlaCase: (id: number, data: any) => ipcRenderer.invoke('db:update-fmla-case', id, data),
  getFmlaCase: (id: number) => ipcRenderer.invoke('db:get-fmla-case', id),
  getFmlaCases: (filters?: any) => ipcRenderer.invoke('db:get-fmla-cases', filters),
  addFmlaEpisode: (data: any) => ipcRenderer.invoke('db:add-fmla-episode', data),
  addFmlaEpisodeBulk: (data: any) => ipcRenderer.invoke('db:add-fmla-episode-bulk', data),
  deleteFmlaEpisode: (id: number) => ipcRenderer.invoke('db:delete-fmla-episode', id),
  getFmlaEpisodes: (caseId: number) => ipcRenderer.invoke('db:get-fmla-episodes', caseId),
  getFmlaAlerts: () => ipcRenderer.invoke('db:get-fmla-alerts'),

  // Disciplinary Actions
  getDisciplinaryActions: (employeeId: number) => ipcRenderer.invoke('db:get-disciplinary-actions', employeeId),
  getAllDisciplinaryActions: (filters?: any) => ipcRenderer.invoke('db:get-all-disciplinary-actions', filters),
  getDisciplinaryAction: (id: number) => ipcRenderer.invoke('db:get-disciplinary-action', id),
  createDisciplinaryAction: (data: any) => ipcRenderer.invoke('db:create-disciplinary-action', data),
  updateDisciplinaryAction: (id: number, data: any) => ipcRenderer.invoke('db:update-disciplinary-action', id, data),
  deleteDisciplinaryAction: (id: number) => ipcRenderer.invoke('db:delete-disciplinary-action', id),
  getDisciplinaryStats: () => ipcRenderer.invoke('db:get-disciplinary-stats'),

  // Benefit Plans
  getBenefitPlans: (activeOnly?: boolean) => ipcRenderer.invoke('db:get-benefit-plans', activeOnly),
  createBenefitPlan: (data: any) => ipcRenderer.invoke('db:create-benefit-plan', data),
  updateBenefitPlan: (id: number, data: any) => ipcRenderer.invoke('db:update-benefit-plan', id, data),
  deleteBenefitPlan: (id: number) => ipcRenderer.invoke('db:delete-benefit-plan', id),

  // Benefit Enrollments
  getEnrollments: (employeeId: number) => ipcRenderer.invoke('db:get-enrollments', employeeId),
  getAllEnrollments: (filters?: any) => ipcRenderer.invoke('db:get-all-enrollments', filters),
  createEnrollment: (data: any) => ipcRenderer.invoke('db:create-enrollment', data),
  updateEnrollment: (id: number, data: any) => ipcRenderer.invoke('db:update-enrollment', id, data),
  deleteEnrollment: (id: number) => ipcRenderer.invoke('db:delete-enrollment', id),

  // Dependents
  getDependents: (employeeId: number) => ipcRenderer.invoke('db:get-dependents', employeeId),
  createDependent: (data: any) => ipcRenderer.invoke('db:create-dependent', data),
  updateDependent: (id: number, data: any) => ipcRenderer.invoke('db:update-dependent', id, data),
  deleteDependent: (id: number) => ipcRenderer.invoke('db:delete-dependent', id),

  // Benefits Stats
  getBenefitsStats: () => ipcRenderer.invoke('db:get-benefits-stats'),

  // Shift Configuration (legacy)
  getShiftConfig: () => ipcRenderer.invoke('app:get-shift-config'),
  saveShiftConfig: (config: { dayShiftStart: string; nightShiftStart: string }) => ipcRenderer.invoke('app:save-shift-config', config),

  // Shifts CRUD
  getAllShifts: () => ipcRenderer.invoke('db:get-all-shifts'),
  getShiftById: (id: number) => ipcRenderer.invoke('db:get-shift', id),
  createShift: (data: { shift_name: string; scheduled_in: string; scheduled_out: string; scheduled_lunch_start?: string | null; scheduled_lunch_end?: string | null }) => ipcRenderer.invoke('db:create-shift', data),
  updateShift: (id: number, data: Record<string, any>) => ipcRenderer.invoke('db:update-shift', id, data),
  deleteShift: (id: number) => ipcRenderer.invoke('db:delete-shift', id),

  // App Updates
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  installUpdate: (releaseNotes?: string, version?: string) => ipcRenderer.invoke('app:install-update', releaseNotes, version),
  getPostUpdateInfo: () => ipcRenderer.invoke('app:get-post-update-info'),
  openReleasePage: (url?: string) => ipcRenderer.invoke('app:open-release-page', url),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // Update event listeners
  onUpdateDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('update:download-progress', listener);
    return () => ipcRenderer.removeListener('update:download-progress', listener);
  },
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
  onUpdateError: (callback: (message: string) => void) => {
    const listener = (_event: any, message: string) => callback(message);
    ipcRenderer.on('update:error', listener);
    return () => ipcRenderer.removeListener('update:error', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
export type ElectronAPI = typeof electronAPI;
