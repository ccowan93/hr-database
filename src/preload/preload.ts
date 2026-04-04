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
  resetDatabase: () => ipcRenderer.invoke('db:reset-database'),
  backupDatabase: () => ipcRenderer.invoke('db:backup'),
  restoreDatabase: () => ipcRenderer.invoke('db:restore'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
export type ElectronAPI = typeof electronAPI;
