export interface Employee {
  id: number;
  employee_name: string;
  dob: string | null;
  age: number | null;
  sex: string | null;
  race: string | null;
  ethnicity: string | null;
  country_of_origin: string | null;
  languages_spoken: string | null;
  highest_education: string | null;
  current_department: string | null;
  current_position: string | null;
  supervisory_role: 'Y' | 'N' | null;
  doh: string | null;
  years_of_service: number | null;
  starting_pay_base: number | null;
  date_previous_raise: string | null;
  previous_pay_rate: number | null;
  date_last_raise: string | null;
  current_pay_rate: number | null;
  department_transfers: string | null;
  date_of_transfer: string | null;
  status?: 'active' | 'archived';
  archived_at?: string | null;
  photo_path?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PayHistory {
  id: number;
  employee_id: number;
  pay_rate: number | null;
  raise_date: string | null;
  department: string | null;
  position: string | null;
  change_type: string;
  notes: string | null;
  recorded_at: string;
}

export interface AuditLogEntry {
  id: number;
  employee_id: number;
  employee_name: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  change_source: string;
}

export interface BirthdayAlert {
  id: number;
  employee_name: string;
  dob: string;
  current_department: string | null;
  days_until: number;
}

export interface AnniversaryAlert {
  id: number;
  employee_name: string;
  doh: string;
  current_department: string | null;
  years_of_service: number | null;
  next_years: number;
  days_until: number;
}

export interface DashboardStats {
  totalHeadcount: number;
  avgTenure: number;
  avgPay: number;
  departmentCount: number;
  headcountByDept: { department: string; count: number }[];
  sexBreakdown: { sex: string; count: number }[];
  raceBreakdown: { race: string; count: number }[];
  payByDept: { department: string; avg_pay: number; min_pay: number; max_pay: number }[];
  tenureDistribution: { bracket: string; count: number }[];
  supervisoryBreakdown: { supervisory_role: string; count: number }[];
  countryBreakdown: { country: string; count: number }[];
  educationBreakdown: { education: string; count: number }[];
  payrollByDept: { department: string; headcount: number; total_payroll: number; avg_pay: number }[];
  totalPayroll: number;
}

export interface EmployeeFilters {
  search?: string;
  department?: string;
  departments?: string[];
  supervisoryRole?: string;
  status?: 'active' | 'archived' | 'all';
  dohFrom?: string;
  dohTo?: string;
  payMin?: number;
  payMax?: number;
  ageMin?: number;
  ageMax?: number;
  countryOfOrigin?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface EmployeeNote {
  id: number;
  employee_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}
