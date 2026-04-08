import type { Employee, DashboardStats, EmployeeFilters, PayHistory, AuditLogEntry, BirthdayAlert, AnniversaryAlert, ExportResult, EmployeeNote, EmployeeFile, Shift } from './types/employee';
import type { AttendanceRecord, AttendanceImportResult, AttendanceImportBatch, AttendanceSummary, TimeOffRequest, TimeOffBalance, OvertimeReportEntry, AbsenteeismReportEntry, TardinessReportEntry, LeftEarlyReportEntry, LunchDurationEntry, TimeOffUsageEntry, ParsedAttendanceResult, ConfirmImportData } from './types/attendance';

declare global {
  interface Window {
    electronAPI: {
      getAllEmployees: (filters?: EmployeeFilters) => Promise<Employee[]>;
      getEmployee: (id: number) => Promise<Employee | undefined>;
      createEmployee: (data: Partial<Employee>) => Promise<number>;
      updateEmployee: (id: number, data: Partial<Employee>) => Promise<Employee>;
      deleteEmployee: (id: number) => Promise<boolean>;
      archiveEmployee: (id: number) => Promise<Employee>;
      restoreEmployee: (id: number) => Promise<Employee>;
      getPayHistory: (employeeId: number) => Promise<PayHistory[]>;
      getAuditLog: (employeeId: number) => Promise<AuditLogEntry[]>;
      getGlobalAuditLog: (limit: number, offset: number) => Promise<AuditLogEntry[]>;
      getGlobalAuditLogCount: () => Promise<number>;
      getDashboardStats: () => Promise<DashboardStats>;
      getDepartments: () => Promise<string[]>;
      getCountries: () => Promise<string[]>;
      getRaces: () => Promise<string[]>;
      getEthnicities: () => Promise<string[]>;
      getLanguages: () => Promise<string[]>;
      getEducationLevels: () => Promise<string[]>;
      getUpcomingBirthdays: (days: number) => Promise<BirthdayAlert[]>;
      getUpcomingAnniversaries: (days: number) => Promise<AnniversaryAlert[]>;
      importXlsx: () => Promise<{ imported: number; skipped: number; errors: string[] }>;
      importXlsxPath: (filePath: string) => Promise<{ imported: number; skipped: number; errors: string[] }>;
      importUpdateXlsx: () => Promise<{ updated: number; notFound: string[]; skipped: number; errors: string[] }>;
      exportEmployeesXlsx: (filters?: EmployeeFilters) => Promise<ExportResult>;
      exportEmployeePDF: (id: number) => Promise<ExportResult>;
      exportDashboardPDF: () => Promise<ExportResult>;
      getEmployeeNotes: (employeeId: number) => Promise<EmployeeNote[]>;
      addEmployeeNote: (employeeId: number, content: string) => Promise<number>;
      updateEmployeeNote: (noteId: number, content: string) => Promise<boolean>;
      deleteEmployeeNote: (noteId: number) => Promise<boolean>;
      getLanguageDistribution: () => Promise<{ language: string; count: number }[]>;
      getMonthlyTurnover: (months: number) => Promise<{ month: string; archived: number; hired: number }[]>;
      getPayGrowth: () => Promise<{ department: string; avg_starting: number; avg_current: number; avg_growth_pct: number }[]>;
      getTimeSinceRaise: () => Promise<{ id: number; employee_name: string; current_department: string; current_position: string; date_last_raise: string; current_pay_rate: number; days_since_raise: number }[]>;
      getPayEquity: () => Promise<{ byGender: any[]; byRace: any[]; byEducation: any[] }>;
      getAgeDistribution: () => Promise<{ bracket: string; count: number }[]>;
      getSupervisorRatio: () => Promise<{ department: string; supervisors: number; employees: number; total: number; ratio: number }[]>;
      getAvgAgeByDept: () => Promise<{ department: string; avg_age: number; min_age: number; max_age: number }[]>;
      getHeadcountGrowth: (months: number) => Promise<{ month: string; cumulative: number; newHires: number }[]>;
      getDepartmentTransfers: () => Promise<{ department: string; transferred: number; total: number }[]>;
      getRetentionRate: () => Promise<{ milestone: string; total: number; retained: number; rate: number }[]>;
      getEmployeeCount: () => Promise<number>;
      bulkUpdateEmployees: (ids: number[], data: Partial<Employee>) => Promise<boolean>;
      searchEmployees: (query: string, limit?: number) => Promise<{ id: number; employee_name: string; current_department: string | null; current_position: string | null; photo_path: string | null }[]>;
      saveEmployeePhoto: (employeeId: number) => Promise<{ success: boolean; path?: string }>;
      removeEmployeePhoto: (employeeId: number) => Promise<boolean>;
      getEmployeePhoto: (employeeId: number) => Promise<string | null>;
      // Employee Files
      uploadEmployeeFile: (employeeId: number) => Promise<EmployeeFile | null>;
      getEmployeeFiles: (employeeId: number) => Promise<EmployeeFile[]>;
      deleteEmployeeFile: (id: number) => Promise<boolean>;
      openEmployeeFile: (id: number) => Promise<boolean>;

      getSavedReports: () => Promise<{ id: number; name: string; config: string }[]>;
      upsertSavedReport: (name: string, config: string) => Promise<boolean>;
      deleteSavedReport: (name: string) => Promise<boolean>;

      resetDatabase: () => Promise<boolean>;
      backupDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreDatabase: () => Promise<{ success: boolean; error?: string }>;

      // Attendance
      parseAttendance: () => Promise<ParsedAttendanceResult | null>;
      confirmAttendanceImport: (data: ConfirmImportData) => Promise<AttendanceImportResult>;
      getAttendance: (employeeId: number, startDate: string, endDate: string) => Promise<AttendanceRecord[]>;
      getAttendanceByDept: (department: string, startDate: string, endDate: string) => Promise<AttendanceRecord[]>;
      getAttendanceSummary: (filters: { employeeId?: number; department?: string; startDate: string; endDate: string }) => Promise<AttendanceSummary>;
      getAttendanceImports: () => Promise<AttendanceImportBatch[]>;
      deleteAttendanceBatch: (batchId: string) => Promise<boolean>;
      deleteAttendanceRecord: (id: number) => Promise<boolean>;
      deleteAttendanceRecords: (ids: number[]) => Promise<number>;
      getAllAttendance: (startDate: string, endDate: string) => Promise<AttendanceRecord[]>;

      // Time Off
      createTimeOffRequest: (data: { employee_id: number; request_type: string; start_date: string; end_date: string; notes?: string }) => Promise<number>;
      updateTimeOffRequest: (id: number, data: { status?: string; notes?: string; reviewed_by?: string }) => Promise<boolean>;
      getTimeOffRequests: (filters?: { employeeId?: number; status?: string; startDate?: string; endDate?: string }) => Promise<TimeOffRequest[]>;
      getTimeOffBalances: (employeeId: number, year: number) => Promise<TimeOffBalance[]>;
      upsertTimeOffBalance: (employeeId: number, year: number, requestType: string, allocatedHours: number) => Promise<boolean>;

      // Attendance Reports
      getOvertimeReport: (startDate: string, endDate: string, groupBy: string, filters?: { employeeIds?: number[]; department?: string }) => Promise<OvertimeReportEntry[]>;
      getAbsenteeismReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => Promise<AbsenteeismReportEntry[]>;
      getTardinessReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => Promise<TardinessReportEntry[]>;
      getLeftEarlyReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => Promise<LeftEarlyReportEntry[]>;
      getLunchDurationReport: (startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) => Promise<LunchDurationEntry[]>;
      getTimeOffUsageReport: (year: number, filters?: { employeeIds?: number[]; department?: string }) => Promise<TimeOffUsageEntry[]>;

      // Calendar Attendance Flags
      getCalendarAttendanceFlags: (employeeId: number, startDate: string, endDate: string) => Promise<{ date: string; flag_type: string }[]>;
      getSalaryAttendanceFlags: (employeeId: number, startDate: string, endDate: string) => Promise<{ id: number; employee_id: number; date: string; flag_type: string; notes: string | null }[]>;
      setSalaryAttendanceFlag: (employeeId: number, date: string, flagType: string, notes?: string) => Promise<boolean>;
      removeSalaryAttendanceFlag: (employeeId: number, date: string, flagType: string) => Promise<boolean>;

      // Shift Configuration (legacy)
      getShiftConfig: () => Promise<{ dayShiftStart: string; nightShiftStart: string }>;
      saveShiftConfig: (config: { dayShiftStart: string; nightShiftStart: string }) => Promise<boolean>;

      // Shifts CRUD
      getAllShifts: () => Promise<Shift[]>;
      getShiftById: (id: number) => Promise<Shift | undefined>;
      createShift: (data: { shift_name: string; scheduled_in: string; scheduled_out: string; scheduled_lunch_start?: string | null; scheduled_lunch_end?: string | null }) => Promise<number>;
      updateShift: (id: number, data: Record<string, any>) => Promise<Shift>;
      deleteShift: (id: number) => Promise<{ success: boolean; error?: string }>;

      // OneDrive Cloud Backup
      onedriveGetStatus: () => Promise<{ connected: boolean; accountName: string | null; lastBackup: string | null; backupFolder: string; backupIntervalHours: number; clientConfigured: boolean }>;
      onedriveSetClientId: (clientId: string) => Promise<boolean>;
      onedriveSignIn: () => Promise<{ success: boolean; accountName?: string; error?: string }>;
      onedriveSignOut: () => Promise<boolean>;
      onedriveBackupNow: () => Promise<{ success: boolean; path?: string; error?: string }>;
      onedriveListBackups: () => Promise<{ success: boolean; files?: { name: string; id: string; lastModified: string }[]; error?: string }>;
      onedriveRestoreBackup: (fileId: string) => Promise<{ success: boolean; error?: string }>;
      onedriveUpdateSettings: (settings: { backupFolder?: string; backupIntervalHours?: number }) => Promise<boolean>;

      // Local Backup
      localBackupGetStatus: () => Promise<{ enabled: boolean; folder: string | null; lastBackup: string | null; intervalHours: number; keepCount: number }>;
      localBackupChooseFolder: () => Promise<string | null>;
      localBackupEnable: (folder: string, intervalHours: number, keepCount: number) => Promise<boolean>;
      localBackupDisable: () => Promise<boolean>;
      localBackupNow: () => Promise<{ success: boolean; path?: string; error?: string }>;
      localBackupList: () => Promise<{ name: string; path: string; size: number; modified: string }[]>;
      localBackupRestore: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
      localBackupUpdateSettings: (settings: { intervalHours?: number; keepCount?: number }) => Promise<boolean>;

      // App Updates
      checkForUpdates: () => Promise<{ currentVersion: string; latestVersion: string; isOutdated: boolean; releaseUrl: string; releaseName: string; publishedAt: string } | null>;
      downloadUpdate: () => Promise<boolean>;
      installUpdate: (releaseNotes?: string, version?: string) => Promise<void>;
      getPostUpdateInfo: () => Promise<{ version: string; releaseNotes: string } | null>;
      openReleasePage: (url?: string) => Promise<void>;
      getAppVersion: () => Promise<string>;
      onUpdateDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      onUpdateError: (callback: (message: string) => void) => () => void;
    };
  }
}

export const api = window.electronAPI;
