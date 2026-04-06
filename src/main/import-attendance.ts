import * as XLSX from 'xlsx';
import { matchEmployeeByName, importAttendanceBatch } from './database';

const ATTENDANCE_COLUMN_MAP: Record<string, string> = {
  'Employee Name': 'employee_name',
  'Employee Id': 'employee_id_raw',
  'Pin Number': 'pin_number',
  'Date': 'date',
  'Work Code': 'work_code',
  'Code Name': 'code_name',
  'Punch': 'punch',
  'Reg': 'reg_hours',
  'OT': 'ot_hours',
  'Memo': 'memo',
  'MP': 'missing_punch',
  'Site': 'site',
};

const MONTHS: Record<string, string> = {
  'January': '01', 'February': '02', 'March': '03', 'April': '04',
  'May': '05', 'June': '06', 'July': '07', 'August': '08',
  'September': '09', 'October': '10', 'November': '11', 'December': '12',
};

function parseDate(value: any): string | null {
  if (value == null) return null;

  // Excel serial number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  if (typeof value !== 'string') return null;

  // Already ISO
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value;

  // MM/DD/YYYY
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  // "Month DD, YYYY" format
  const longDate = value.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (longDate) {
    const month = MONTHS[longDate[1]];
    if (month) return `${longDate[3]}-${month}-${longDate[2].padStart(2, '0')}`;
  }

  return null;
}

function parseTime(value: any): string | null {
  if (value == null) return null;

  // Excel serial number for time (fraction of day)
  if (typeof value === 'number' && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (typeof value === 'number') {
    // Could be a datetime serial - extract time portion
    const frac = value - Math.floor(value);
    if (frac > 0) {
      const totalMinutes = Math.round(frac * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return null;
  }

  if (typeof value !== 'string') return null;

  // HH:MM or H:MM
  const hm = value.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;

  // HH:MM:SS
  const hms = value.match(/^(\d{1,2}):(\d{2}):\d{2}/);
  if (hms) return `${hms[1].padStart(2, '0')}:${hms[2]}`;

  // HH:MM AM/PM
  const ampm = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let hours = parseInt(ampm[1]);
    if (ampm[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (ampm[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${ampm[2]}`;
  }

  return null;
}

function trimRowKeys(row: Record<string, any>): Record<string, any> {
  const trimmed: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    trimmed[key.trim()] = typeof value === 'string' ? value.trim() : value;
  }
  return trimmed;
}

interface AttendanceImportResult {
  imported: number;
  skipped: number;
  unmatched: string[];
  errors: string[];
}

export function importAttendanceFromExcel(filePath: string): AttendanceImportResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null }) as Record<string, any>[];

  const errors: string[] = [];
  const unmatchedSet = new Set<string>();
  let imported = 0;
  let skipped = 0;

  // Generate batch ID
  const batchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Cache employee name lookups
  const nameCache = new Map<string, { employee_id: number; employee_name: string } | null>();

  // Group punch In/Out rows by employee+date to pair them
  const punchGroups = new Map<string, { in_time: string | null; out_time: string | null; row: Record<string, any> }>();

  for (const rawRow of rawRows) {
    const row = trimRowKeys(rawRow);
    const employeeName = row['Employee Name'];
    if (!employeeName || typeof employeeName !== 'string') {
      skipped++;
      continue;
    }

    const mapped: Record<string, any> = {};
    for (const [excelCol, dbCol] of Object.entries(ATTENDANCE_COLUMN_MAP)) {
      mapped[dbCol] = row[excelCol] ?? null;
    }

    const date = parseDate(mapped.date);
    if (!date) {
      errors.push(`Row "${employeeName}": invalid date "${mapped.date}"`);
      skipped++;
      continue;
    }

    const punch = mapped.punch?.toString()?.trim()?.toLowerCase();
    const key = `${employeeName}||${date}||${mapped.work_code || ''}`;

    if (!punchGroups.has(key)) {
      punchGroups.set(key, { in_time: null, out_time: null, row: mapped });
    }

    const group = punchGroups.get(key)!;
    if (punch === 'in') {
      // Try to parse a time from Expr1/Expr2 columns or the row itself
      const time = parseTime(row['Expr1']) || parseTime(row['Expr2']) || parseTime(row['Date']);
      group.in_time = time;
      // Update row data with latest info
      Object.assign(group.row, mapped);
    } else if (punch === 'out') {
      const time = parseTime(row['Expr1']) || parseTime(row['Expr2']) || parseTime(row['Date']);
      group.out_time = time;
      // Prefer reg/OT from the out punch row (usually has the totals)
      if (mapped.reg_hours != null) group.row.reg_hours = mapped.reg_hours;
      if (mapped.ot_hours != null) group.row.ot_hours = mapped.ot_hours;
      if (mapped.missing_punch != null) group.row.missing_punch = mapped.missing_punch;
    } else {
      // Single row with no In/Out distinction - store as-is
      group.row = mapped;
    }
  }

  // Build records from grouped punches
  const records: {
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
  }[] = [];

  for (const [, group] of punchGroups) {
    const row = group.row;
    const employeeName = row.employee_name?.toString() || '';
    const date = parseDate(row.date);
    if (!date) continue;

    // Lookup employee
    if (!nameCache.has(employeeName)) {
      nameCache.set(employeeName, matchEmployeeByName(employeeName));
    }
    const match = nameCache.get(employeeName);
    if (!match) {
      unmatchedSet.add(employeeName);
    }

    const regHours = row.reg_hours != null ? Number(row.reg_hours) || 0 : 0;
    const otHours = row.ot_hours != null ? Number(row.ot_hours) || 0 : 0;
    const mp = row.missing_punch ? 1 : 0;

    records.push({
      employee_id: match?.employee_id || null,
      employee_name_raw: employeeName,
      date,
      punch_in: group.in_time,
      punch_out: group.out_time,
      reg_hours: regHours,
      ot_hours: otHours,
      work_code: row.work_code?.toString() || null,
      code_name: row.code_name?.toString() || null,
      site: row.site?.toString() || null,
      missing_punch: mp,
    });
  }

  // Import all records in a single transaction
  try {
    importAttendanceBatch(records, batchId);
    imported = records.length;
  } catch (err: any) {
    errors.push(`Batch import failed: ${err.message}`);
  }

  return {
    imported,
    skipped,
    unmatched: Array.from(unmatchedSet),
    errors,
  };
}
