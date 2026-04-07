import * as XLSX from 'xlsx';
import { matchEmployeeByName, importAttendanceBatch, updateEmployee } from './database';

// Column indices for CompuTime101 qryWorkCodeDetail sheet
const COL = {
  EMPLOYEE_NAME: 0,
  EMPLOYEE_ID: 1,
  PIN_NUMBER: 2,
  DATE: 3,
  WORK_CODE: 4,
  CODE_NAME: 5,
  PUNCH: 6,      // time as day-fraction
  EXPR1: 7,      // "In" or ""
  EXPR2: 8,      // "" or "Out"
  REG: 9,        // minutes (only on Out rows)
  OT: 10,        // minutes
  OT2: 11,       // minutes
  MEMO: 12,
  MP: 13,
  SITE: 18,
};

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

export interface ParseResult {
  records: ParsedAttendanceRecord[];
  unmatched: UnmatchedEmployee[];
  matched: MatchedEmployee[];
  errors: string[];
}

export interface AttendanceImportResult {
  imported: number;
  skipped: number;
  unmatched: string[];
  errors: string[];
}

function excelSerialToDate(serial: number): string | null {
  if (serial == null || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function dayFractionToTime(fraction: any): string | null {
  if (fraction == null || typeof fraction !== 'number') return null;
  const totalMinutes = Math.round(fraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseAttendanceFile(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);

  // Look for the specific sheet name, fall back to first sheet
  const sheetName = workbook.SheetNames.includes('qryWorkCodeDetail')
    ? 'qryWorkCodeDetail'
    : workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  const errors: string[] = [];
  const matchedMap = new Map<string, MatchedEmployee>();
  const unmatchedMap = new Map<string, UnmatchedEmployee>();
  const nameCache = new Map<string, { employee_id: number; employee_name: string } | null>();

  // Parse rows into typed punch entries, skipping header (row 0)
  interface PunchEntry {
    employeeName: string;
    employeeIdRaw: number;
    pinNumber: number;
    date: string;
    time: string | null;
    isIn: boolean;
    isOut: boolean;
    regMinutes: number;
    otMinutes: number;
    workCode: string | null;
    codeName: string | null;
    site: string | null;
    mp: number;
  }

  const punches: PunchEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const employeeName = row[COL.EMPLOYEE_NAME];
    if (!employeeName || typeof employeeName !== 'string' || !employeeName.trim()) {
      continue;
    }

    const dateVal = row[COL.DATE];
    const date = typeof dateVal === 'number' ? excelSerialToDate(dateVal) : null;
    if (!date) {
      errors.push(`Row ${i + 1} "${employeeName}": invalid date "${dateVal}"`);
      continue;
    }

    const expr1 = String(row[COL.EXPR1] ?? '').trim();
    const expr2 = String(row[COL.EXPR2] ?? '').trim();
    const isIn = expr1.toLowerCase() === 'in';
    const isOut = expr2.toLowerCase() === 'out';

    const time = dayFractionToTime(row[COL.PUNCH]);
    const regMinutes = isOut && row[COL.REG] != null ? Number(row[COL.REG]) || 0 : 0;
    const otMinutes = isOut && row[COL.OT] != null ? (Number(row[COL.OT]) || 0) + (Number(row[COL.OT2]) || 0) : 0;

    punches.push({
      employeeName: employeeName.trim(),
      employeeIdRaw: Number(row[COL.EMPLOYEE_ID]) || 0,
      pinNumber: Number(row[COL.PIN_NUMBER]) || 0,
      date,
      time,
      isIn,
      isOut,
      regMinutes,
      otMinutes,
      workCode: row[COL.WORK_CODE] != null ? String(row[COL.WORK_CODE]) : null,
      codeName: row[COL.CODE_NAME] != null ? String(row[COL.CODE_NAME]) : null,
      site: row[COL.SITE] != null ? String(row[COL.SITE]) : null,
      mp: row[COL.MP] ? 1 : 0,
    });

    // Cache employee lookup
    const name = employeeName.trim();
    if (!nameCache.has(name)) {
      const match = matchEmployeeByName(name);
      nameCache.set(name, match);
      if (match) {
        matchedMap.set(name, { rawName: name, employeeId: match.employee_id, employeeName: match.employee_name });
      }
    }
    if (!nameCache.get(name) && !unmatchedMap.has(name)) {
      unmatchedMap.set(name, {
        rawName: name,
        employeeIdRaw: Number(row[COL.EMPLOYEE_ID]) || 0,
        pinNumber: Number(row[COL.PIN_NUMBER]) || 0,
      });
    }
  }

  // Group consecutive In->Out pairs by employee+date
  const records: ParsedAttendanceRecord[] = [];

  // Group punches by employee+date, preserving order
  const groups = new Map<string, PunchEntry[]>();
  for (const punch of punches) {
    const key = `${punch.employeeName}||${punch.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(punch);
  }

  for (const [, punchList] of groups) {
    const first = punchList[0];
    const match = nameCache.get(first.employeeName);

    // Pair consecutive In -> Out
    let i = 0;
    while (i < punchList.length) {
      const current = punchList[i];

      if (current.isIn) {
        // Look for the next Out for this employee+date
        const next = i + 1 < punchList.length ? punchList[i + 1] : null;
        if (next && next.isOut) {
          // Paired In/Out
          records.push({
            employee_name_raw: first.employeeName,
            employee_id: match?.employee_id ?? null,
            employee_id_raw: first.employeeIdRaw,
            pin_number: first.pinNumber,
            date: first.date,
            punch_in: current.time,
            punch_out: next.time,
            reg_hours: Math.round((next.regMinutes / 60) * 100) / 100,
            ot_hours: Math.round((next.otMinutes / 60) * 100) / 100,
            work_code: current.workCode,
            code_name: current.codeName,
            site: current.site,
            missing_punch: current.mp || next.mp,
          });
          i += 2;
        } else {
          // In without Out - missing punch
          records.push({
            employee_name_raw: first.employeeName,
            employee_id: match?.employee_id ?? null,
            employee_id_raw: first.employeeIdRaw,
            pin_number: first.pinNumber,
            date: first.date,
            punch_in: current.time,
            punch_out: null,
            reg_hours: 0,
            ot_hours: 0,
            work_code: current.workCode,
            code_name: current.codeName,
            site: current.site,
            missing_punch: 1,
          });
          i += 1;
        }
      } else if (current.isOut) {
        // Out without In - missing punch
        records.push({
          employee_name_raw: first.employeeName,
          employee_id: match?.employee_id ?? null,
          employee_id_raw: first.employeeIdRaw,
          pin_number: first.pinNumber,
          date: first.date,
          punch_in: null,
          punch_out: current.time,
          reg_hours: Math.round((current.regMinutes / 60) * 100) / 100,
          ot_hours: Math.round((current.otMinutes / 60) * 100) / 100,
          work_code: current.workCode,
          code_name: current.codeName,
          site: current.site,
          missing_punch: 1,
        });
        i += 1;
      } else {
        // No In/Out designation - standalone record
        records.push({
          employee_name_raw: first.employeeName,
          employee_id: match?.employee_id ?? null,
          employee_id_raw: first.employeeIdRaw,
          pin_number: first.pinNumber,
          date: first.date,
          punch_in: current.time,
          punch_out: null,
          reg_hours: Math.round((current.regMinutes / 60) * 100) / 100,
          ot_hours: Math.round((current.otMinutes / 60) * 100) / 100,
          work_code: current.workCode,
          code_name: current.codeName,
          site: current.site,
          missing_punch: current.mp,
        });
        i += 1;
      }
    }
  }

  return {
    records,
    unmatched: Array.from(unmatchedMap.values()),
    matched: Array.from(matchedMap.values()),
    errors,
  };
}

export function confirmAttendanceImport(data: {
  records: ParsedAttendanceRecord[];
  manualMappings: { rawName: string; employeeId: number }[];
  updateNames: boolean;
}): AttendanceImportResult {
  const { records, manualMappings, updateNames } = data;
  const errors: string[] = [];
  const unmatchedNames: string[] = [];

  // Build mapping lookup
  const mappingLookup = new Map<string, number>();
  for (const m of manualMappings) {
    mappingLookup.set(m.rawName, m.employeeId);
  }

  // Apply manual mappings to records
  const finalRecords = records.map(r => {
    const mapped = mappingLookup.get(r.employee_name_raw);
    if (mapped != null) {
      return { ...r, employee_id: mapped };
    }
    if (r.employee_id == null) {
      unmatchedNames.push(r.employee_name_raw);
    }
    return r;
  });

  // Update employee names in the DB for manual mappings
  if (updateNames || manualMappings.length > 0) {
    for (const m of manualMappings) {
      try {
        updateEmployee(m.employeeId, { employee_name: m.rawName }, 'attendance-import');
      } catch (err: any) {
        errors.push(`Failed to update name for employee ${m.employeeId}: ${err.message}`);
      }
    }
  }

  // Generate batch ID
  const batchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Import all records
  const importRecords = finalRecords.map(r => ({
    employee_id: r.employee_id,
    employee_name_raw: r.employee_name_raw,
    date: r.date,
    punch_in: r.punch_in,
    punch_out: r.punch_out,
    reg_hours: r.reg_hours,
    ot_hours: r.ot_hours,
    work_code: r.work_code,
    code_name: r.code_name,
    site: r.site,
    missing_punch: r.missing_punch,
  }));

  let imported = 0;
  let skipped = 0;
  try {
    const result = importAttendanceBatch(importRecords, batchId);
    imported = result.imported;
    skipped = result.skipped;
  } catch (err: any) {
    errors.push(`Batch import failed: ${err.message}`);
  }

  const uniqueUnmatched = [...new Set(unmatchedNames)];

  return {
    imported,
    skipped,
    unmatched: uniqueUnmatched,
    errors,
  };
}
