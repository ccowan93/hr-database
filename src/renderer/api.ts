import type { Employee, DashboardStats, EmployeeFilters, PayHistory, AuditLogEntry, BirthdayAlert, AnniversaryAlert, ExportResult, EmployeeNote } from './types/employee';

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
      resetDatabase: () => Promise<boolean>;
      backupDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreDatabase: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export const api = window.electronAPI;
