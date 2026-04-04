import * as XLSX from 'xlsx';
import { getDb, addPayHistory } from './database';

const MONTHS: Record<string, string> = {
  'January': '01', 'February': '02', 'March': '03', 'April': '04',
  'May': '05', 'June': '06', 'July': '07', 'August': '08',
  'September': '09', 'October': '10', 'November': '11', 'December': '12',
};

function parseDate(value: any): string | null {
  if (!value) return null;

  // Excel serial number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  if (typeof value !== 'string') return null;

  // "Tuesday, July 10, 1945 at 12:00:00 AM" format
  const verbose = value.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})\s+at/);
  if (verbose) {
    const month = MONTHS[verbose[1]];
    if (month) return `${verbose[3]}-${month}-${verbose[2].padStart(2, '0')}`;
  }

  // Already ISO
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value;

  // MM/DD/YYYY or M/D/YYYY
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  return null;
}

function toNumber(value: any): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

interface UpdateResult {
  updated: number;
  notFound: string[];
  skipped: number;
  errors: string[];
}

export function importUpdateFromExcel(filePath: string): UpdateResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null }) as Record<string, any>[];

  const db = getDb();
  const result: UpdateResult = { updated: 0, notFound: [], skipped: 0, errors: [] };

  const findEmployee = db.prepare(
    'SELECT id, current_pay_rate, date_last_raise, current_department, current_position FROM employees WHERE LOWER(TRIM(employee_name)) = LOWER(TRIM(?))'
  );

  const updateEmployee = db.prepare(`
    UPDATE employees SET
      current_department = COALESCE(?, current_department),
      doh = COALESCE(?, doh),
      date_previous_raise = COALESCE(date_last_raise, date_previous_raise),
      previous_pay_rate = COALESCE(current_pay_rate, previous_pay_rate),
      date_last_raise = ?,
      current_pay_rate = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const updateTransaction = db.transaction((dataRows: Record<string, any>[]) => {
    for (const row of dataRows) {
      const name = row['Employee Name'] ?? row['employee_name'] ?? row['Name'];
      if (!name || typeof name !== 'string' || name.trim() === '') {
        result.skipped++;
        continue;
      }

      try {
        const existing = findEmployee.get(name.trim()) as any;
        if (!existing) {
          result.notFound.push(name.trim());
          continue;
        }

        const department = row['Department'] ?? null;
        const hireDate = parseDate(row['Hire Date']);
        const raiseDate = parseDate(row['Raise Date']);
        const newRate = toNumber(row['New Rate']);

        if (newRate == null && raiseDate == null) {
          result.skipped++;
          continue;
        }

        // Log old rate to pay history before updating
        if (existing.current_pay_rate != null) {
          addPayHistory({
            employee_id: existing.id,
            pay_rate: existing.current_pay_rate,
            raise_date: existing.date_last_raise,
            department: existing.current_department ?? department,
            position: existing.current_position ?? null,
            change_type: 'raise',
            notes: `Updated via Excel import`,
          });
        }

        updateEmployee.run(
          department,
          hireDate,
          raiseDate,
          newRate,
          existing.id
        );
        result.updated++;
      } catch (err: any) {
        result.errors.push(`"${name}": ${err.message}`);
      }
    }
  });

  updateTransaction(rows);
  return result;
}
