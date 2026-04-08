import ExcelJS from 'exceljs';
import { dialog } from 'electron';

const COLUMN_HEADERS: Record<string, string> = {
  employee_name: 'Employee Name',
  id: 'ID',
  dob: 'Date of Birth',
  age: 'Age',
  sex: 'Sex',
  race: 'Race',
  ethnicity: 'Ethnicity',
  country_of_origin: 'Country of Origin',
  languages_spoken: 'Languages Spoken',
  highest_education: 'Highest Education',
  current_department: 'Department',
  current_position: 'Position',
  supervisory_role: 'Supervisory Role',
  doh: 'Date of Hire',
  date_of_separation: 'Date of Separation',
  years_of_service: 'Years of Service',
  starting_pay_base: 'Starting Pay',
  date_previous_raise: 'Previous Raise Date',
  previous_pay_rate: 'Previous Pay Rate',
  date_last_raise: 'Last Raise Date',
  current_pay_rate: 'Current Pay Rate',
  department_transfers: 'Dept Transfers',
  date_of_transfer: 'Transfer Date',
  status: 'Status',
};

const EXPORT_COLUMNS = [
  'employee_name', 'id', 'current_department', 'current_position',
  'supervisory_role', 'doh', 'years_of_service', 'current_pay_rate',
  'age', 'sex', 'race', 'ethnicity', 'country_of_origin',
  'languages_spoken', 'highest_education', 'starting_pay_base',
  'date_last_raise', 'previous_pay_rate', 'status',
];

export async function exportEmployeesToXlsx(employees: any[]): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await dialog.showSaveDialog({
    title: 'Export Employees to Excel',
    defaultPath: 'employees.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Export cancelled' };
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Employees');

  // Add header row
  const headerValues = EXPORT_COLUMNS.map(c => COLUMN_HEADERS[c] || c);
  worksheet.addRow(headerValues);

  // Style header row
  const headerRowObj = worksheet.getRow(1);
  headerRowObj.font = { bold: true };

  // Set column widths
  EXPORT_COLUMNS.forEach((col, i) => {
    const header = COLUMN_HEADERS[col] || col;
    worksheet.getColumn(i + 1).width = Math.max(header.length, 12);
  });

  // Add data rows
  for (const emp of employees) {
    const rowValues = EXPORT_COLUMNS.map(col => emp[col] ?? '');
    worksheet.addRow(rowValues);
  }

  await workbook.xlsx.writeFile(result.filePath);

  return { success: true, path: result.filePath };
}
