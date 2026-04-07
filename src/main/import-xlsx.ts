import ExcelJS from 'exceljs';
import { getDb, refreshComputedFields } from './database';

const COLUMN_MAP: Record<string, string> = {
  'Employee Name': 'employee_name',
  'ID': 'id',
  'DOB': 'dob',
  'Age': 'age',
  'Sex': 'sex',
  'Race': 'race',
  'Ethnicity': 'ethnicity',
  'Country of Origin': 'country_of_origin',
  'Languages Spoken': 'languages_spoken',
  'Highest Level of Education': 'highest_education',
  'Current Department': 'current_department',
  'Current Position': 'current_position',
  'Supervisory Role? Y/N': 'supervisory_role',
  'DOH': 'doh',
  'Years of Service': 'years_of_service',
  'Starting Pay (Base)': 'starting_pay_base',
  'Date of Previous Raise': 'date_previous_raise',
  'Previous Pay Rate': 'previous_pay_rate',
  'Date of Last Raise': 'date_last_raise',
  'Current Pay Rate': 'current_pay_rate',
  'Department Transfers': 'department_transfers',
  'Date of Transfer': 'date_of_transfer',
};

const MONTHS: Record<string, string> = {
  'January': '01', 'February': '02', 'March': '03', 'April': '04',
  'May': '05', 'June': '06', 'July': '07', 'August': '08',
  'September': '09', 'October': '10', 'November': '11', 'December': '12',
};

function parseDate(value: any): string | null {
  if (value == null) return null;

  // Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // Excel serial number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  if (typeof value !== 'string') return null;

  // "Tuesday, July 10, 1945 at 12:00:00 AM" format
  const match = value.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})\s+at/);
  if (match) {
    const month = MONTHS[match[1]];
    if (month) {
      const day = match[2].padStart(2, '0');
      return `${match[3]}-${month}-${day}`;
    }
  }

  // Already ISO
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value;

  // MM/DD/YYYY
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  return null;
}

function isDataRow(row: Record<string, any>): boolean {
  const name = row['Employee Name'];
  if (!name || typeof name !== 'string') return false;
  if (name.toLowerCase().includes('average')) return false;
  if (!row['ID'] && row['ID'] !== 0) return false;
  return true;
}

export async function importFromExcel(filePath: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  if (filePath.endsWith('.csv')) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { imported: 0, skipped: 0, errors: ['No worksheet found'] };

  // Read header row
  const headerRow = worksheet.getRow(1);
  const headers: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  // Read data rows into objects
  const rawRows: Record<string, any>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        obj[header] = cell.value instanceof Date ? cell.value : (cell.value ?? null);
      }
    });
    rawRows.push(obj);
  });

  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const dateFields = ['dob', 'doh', 'date_previous_raise', 'date_last_raise', 'date_of_transfer'];
  const numericFields = ['age', 'years_of_service'];
  const realFields = ['starting_pay_base', 'previous_pay_rate', 'current_pay_rate'];

  const insertTransaction = db.transaction((dataRows: Record<string, any>[]) => {
    const columns = Object.values(COLUMN_MAP);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT OR REPLACE INTO employees (${columns.join(', ')}) VALUES (${placeholders})`);

    for (const row of dataRows) {
      if (!isDataRow(row)) {
        skipped++;
        continue;
      }

      try {
        const mapped: Record<string, any> = {};
        for (const [excelCol, dbCol] of Object.entries(COLUMN_MAP)) {
          mapped[dbCol] = row[excelCol] ?? null;
        }

        // Cast ID
        if (mapped.id != null) mapped.id = Math.round(Number(mapped.id));

        // Parse dates
        for (const f of dateFields) {
          mapped[f] = parseDate(mapped[f]);
        }

        // Cast numerics
        for (const f of numericFields) {
          if (mapped[f] != null) mapped[f] = Math.round(Number(mapped[f]));
        }
        for (const f of realFields) {
          if (mapped[f] != null) mapped[f] = Number(mapped[f]);
        }

        // Normalize supervisory role
        if (mapped.supervisory_role) {
          mapped.supervisory_role = mapped.supervisory_role.toString().toUpperCase().trim();
          if (mapped.supervisory_role !== 'Y' && mapped.supervisory_role !== 'N') {
            mapped.supervisory_role = null;
          }
        }

        const values = columns.map(c => mapped[c] ?? null);
        stmt.run(...values);
        imported++;
      } catch (err: any) {
        errors.push(`Row "${row['Employee Name']}": ${err.message}`);
      }
    }
  });

  insertTransaction(rawRows);
  refreshComputedFields();

  return { imported, skipped, errors };
}
