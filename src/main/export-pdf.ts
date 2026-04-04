import { BrowserWindow, dialog } from 'electron';
import fs from 'fs';

function generateEmployeeHTML(employee: any, payHistory: any[]): string {
  const field = (label: string, value: any) =>
    `<div class="field"><span class="label">${label}</span><span class="value">${value ?? '-'}</span></div>`;

  const payRows = payHistory.map(p => `
    <tr>
      <td>${p.raise_date ?? '-'}</td>
      <td>${p.pay_rate != null ? '$' + Number(p.pay_rate).toFixed(2) : '-'}</td>
      <td>${p.department ?? '-'}</td>
      <td>${p.position ?? '-'}</td>
      <td>${p.change_type ?? '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, sans-serif; padding: 40px; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #64748b; margin-top: 0; font-weight: normal; }
  h3 { font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; }
  .fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .field .label { display: block; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
  .field .value { display: block; font-size: 13px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-weight: 600; color: #64748b; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
</style></head><body>
  <h1>${employee.employee_name}</h1>
  <h2>${employee.current_position ?? ''} — ${employee.current_department ?? ''}</h2>

  <h3>Personal Information</h3>
  <div class="fields">
    ${field('ID', employee.id)}
    ${field('Date of Birth', employee.dob)}
    ${field('Age', employee.age)}
    ${field('Sex', employee.sex)}
    ${field('Race', employee.race)}
    ${field('Ethnicity', employee.ethnicity)}
    ${field('Country of Origin', employee.country_of_origin)}
    ${field('Languages', employee.languages_spoken)}
    ${field('Education', employee.highest_education)}
  </div>

  <h3>Employment</h3>
  <div class="fields">
    ${field('Department', employee.current_department)}
    ${field('Position', employee.current_position)}
    ${field('Supervisory', employee.supervisory_role === 'Y' ? 'Yes' : 'No')}
    ${field('Date of Hire', employee.doh)}
    ${field('Years of Service', employee.years_of_service)}
    ${field('Status', employee.status ?? 'active')}
  </div>

  <h3>Compensation</h3>
  <div class="fields">
    ${field('Starting Pay', employee.starting_pay_base != null ? '$' + Number(employee.starting_pay_base).toFixed(2) : null)}
    ${field('Current Pay Rate', employee.current_pay_rate != null ? '$' + Number(employee.current_pay_rate).toFixed(2) : null)}
    ${field('Last Raise Date', employee.date_last_raise)}
    ${field('Previous Pay Rate', employee.previous_pay_rate != null ? '$' + Number(employee.previous_pay_rate).toFixed(2) : null)}
  </div>

  ${payHistory.length > 0 ? `
  <h3>Pay History</h3>
  <table>
    <thead><tr><th>Date</th><th>Rate</th><th>Department</th><th>Position</th><th>Type</th></tr></thead>
    <tbody>${payRows}</tbody>
  </table>` : ''}

  <div class="footer">Generated on ${new Date().toLocaleDateString()} — HR Database</div>
</body></html>`;
}

function generateDashboardHTML(stats: any): string {
  const deptRows = (stats.headcountByDept || []).map((d: any) =>
    `<tr><td>${d.department}</td><td>${d.count}</td></tr>`
  ).join('');

  const payRows = (stats.payByDept || []).map((d: any) =>
    `<tr><td>${d.department}</td><td>$${Number(d.avg_pay).toFixed(2)}</td><td>$${Number(d.min_pay).toFixed(2)}</td><td>$${Number(d.max_pay).toFixed(2)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, sans-serif; padding: 40px; color: #1e293b; }
  h1 { font-size: 24px; }
  h3 { font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 28px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .metric .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
  .metric .value { font-size: 28px; font-weight: bold; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-weight: 600; color: #64748b; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
</style></head><body>
  <h1>HR Dashboard Report</h1>

  <div class="metrics">
    <div class="metric"><div class="label">Total Headcount</div><div class="value">${stats.totalHeadcount}</div></div>
    <div class="metric"><div class="label">Avg Tenure</div><div class="value">${stats.avgTenure} yrs</div></div>
    <div class="metric"><div class="label">Avg Pay Rate</div><div class="value">$${Number(stats.avgPay).toFixed(2)}</div></div>
    <div class="metric"><div class="label">Departments</div><div class="value">${stats.departmentCount}</div></div>
  </div>

  <h3>Headcount by Department</h3>
  <table><thead><tr><th>Department</th><th>Count</th></tr></thead><tbody>${deptRows}</tbody></table>

  <h3>Pay by Department</h3>
  <table><thead><tr><th>Department</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead><tbody>${payRows}</tbody></table>

  <h3>Demographics</h3>
  <table><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>
    ${(stats.sexBreakdown || []).map((s: any) => `<tr><td>${s.sex}</td><td>${s.count}</td></tr>`).join('')}
  </tbody></table>

  <div class="footer">Generated on ${new Date().toLocaleDateString()} — HR Database</div>
</body></html>`;
}

async function renderHTMLToPDF(html: string, filePath: string): Promise<void> {
  const win = new BrowserWindow({ show: false, width: 800, height: 1100 });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for content to render
  await new Promise(r => setTimeout(r, 500));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  fs.writeFileSync(filePath, pdfBuffer);
  win.close();
}

export async function exportEmployeePDF(employee: any, payHistory: any[]): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await dialog.showSaveDialog({
    title: 'Export Employee to PDF',
    defaultPath: `${employee.employee_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return { success: false, error: 'Export cancelled' };

  const html = generateEmployeeHTML(employee, payHistory);
  await renderHTMLToPDF(html, result.filePath);
  return { success: true, path: result.filePath };
}

export async function exportDashboardPDF(stats: any): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await dialog.showSaveDialog({
    title: 'Export Dashboard Report to PDF',
    defaultPath: `HR_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return { success: false, error: 'Export cancelled' };

  const html = generateDashboardHTML(stats);
  await renderHTMLToPDF(html, result.filePath);
  return { success: true, path: result.filePath };
}
