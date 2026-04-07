export interface AttendanceRecord {
  id: number;
  employee_id: number | null;
  employee_name_raw: string;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  reg_hours: number;
  ot_hours: number;
  work_code: string | null;
  code_name: string | null;
  site: string | null;
  missing_punch: number;
  import_batch_id: string;
  imported_at: string;
}

export interface AttendanceImportResult {
  imported: number;
  skipped: number;
  unmatched: string[];
  errors: string[];
}

export interface AttendanceImportBatch {
  import_batch_id: string;
  start_date: string;
  end_date: string;
  record_count: number;
  imported_at: string;
}

export interface AttendanceSummary {
  days_present: number;
  total_reg_hours: number;
  total_ot_hours: number;
  missing_punches: number;
  total_records: number;
}

export interface ParsedAttendanceRecord {
  employee_name_raw: string;
  employee_id: number | null;
  employee_id_raw: number;
  pin_number: number;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  reg_hours: number;
  ot_hours: number;
  work_code: string | null;
  code_name: string | null;
  site: string | null;
  missing_punch: number;
}

export interface UnmatchedEmployee {
  rawName: string;
  employeeIdRaw: number;
  pinNumber: number;
}

export interface MatchedEmployee {
  rawName: string;
  employeeId: number;
  employeeName: string;
}

export interface ParsedAttendanceResult {
  records: ParsedAttendanceRecord[];
  unmatched: UnmatchedEmployee[];
  matched: MatchedEmployee[];
  errors: string[];
}

export interface ConfirmImportData {
  records: ParsedAttendanceRecord[];
  manualMappings: { rawName: string; employeeId: number }[];
  updateNames: boolean;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  current_department: string | null;
  request_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'denied';
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeOffBalance {
  id: number;
  employee_id: number;
  year: number;
  request_type: string;
  allocated_hours: number;
  used_hours: number;
}

export type TimeOffRequestType = 'vacation' | 'sick' | 'personal' | 'bereavement' | 'jury_duty' | 'fmla' | 'other';

export const TIME_OFF_REQUEST_TYPES: { value: TimeOffRequestType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'jury_duty', label: 'Jury Duty' },
  { value: 'fmla', label: 'FMLA' },
  { value: 'other', label: 'Other' },
];

export interface OvertimeReportEntry {
  name: string;
  current_department?: string;
  total_ot: number;
  total_reg: number;
  days_worked?: number;
  employee_count?: number;
}

export interface AbsenteeismReportEntry {
  id: number;
  employee_name: string;
  current_department: string | null;
  days_present: number;
  total_days: number;
}

export interface TardinessReportEntry {
  employee_id: number;
  employee_name: string;
  current_department: string | null;
  shift?: string;
  late_count: number;
  days_late: number;
}

export interface TimeOffUsageEntry {
  employee_name: string;
  current_department: string | null;
  request_type: string;
  allocated_hours: number;
  used_hours: number;
  remaining_hours: number;
}
