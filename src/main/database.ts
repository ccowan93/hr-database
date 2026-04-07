import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

const ACTIVE_FILTER = `(status = 'active' OR status IS NULL)`;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'hr-database.sqlite');
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id                    INTEGER PRIMARY KEY,
      employee_name         TEXT NOT NULL,
      dob                   TEXT,
      age                   INTEGER,
      sex                   TEXT,
      race                  TEXT,
      ethnicity             TEXT,
      country_of_origin     TEXT,
      languages_spoken      TEXT,
      highest_education     TEXT,
      current_department    TEXT,
      current_position      TEXT,
      supervisory_role      TEXT CHECK(supervisory_role IN ('Y','N')),
      doh                   TEXT,
      years_of_service      INTEGER,
      starting_pay_base     REAL,
      date_previous_raise   TEXT,
      previous_pay_rate     REAL,
      date_last_raise       TEXT,
      current_pay_rate      REAL,
      department_transfers  TEXT,
      date_of_transfer      TEXT,
      status                TEXT DEFAULT 'active' CHECK(status IN ('active','archived')),
      archived_at           TEXT,
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_department ON employees(current_department);
  `);

  try { db.exec(`ALTER TABLE employees ADD COLUMN status TEXT DEFAULT 'active'`); } catch (_) {}
  try { db.exec(`ALTER TABLE employees ADD COLUMN archived_at TEXT`); } catch (_) {}

  db.exec(`CREATE INDEX IF NOT EXISTS idx_status ON employees(status);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pay_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      pay_rate        REAL,
      raise_date      TEXT,
      department      TEXT,
      position        TEXT,
      change_type     TEXT DEFAULT 'raise',
      notes           TEXT,
      recorded_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pay_history_employee ON pay_history(employee_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER,
      employee_name   TEXT,
      field_name      TEXT NOT NULL,
      old_value       TEXT,
      new_value       TEXT,
      changed_at      TEXT DEFAULT (datetime('now')),
      change_source   TEXT DEFAULT 'manual'
    );
    CREATE INDEX IF NOT EXISTS idx_audit_employee ON audit_log(employee_id);
    CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);
  `);

  // Migration: add employee_name to audit_log if missing
  try { db.exec(`ALTER TABLE audit_log ADD COLUMN employee_name TEXT`); } catch (_) {}

  // Migration: add photo_path column
  try { db.exec(`ALTER TABLE employees ADD COLUMN photo_path TEXT`); } catch (_) {}

  // Migration: add shift column
  try { db.exec(`ALTER TABLE employees ADD COLUMN shift TEXT DEFAULT 'day' CHECK(shift IN ('day','night'))`); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_notes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      content         TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS idx_notes_employee ON employee_notes(employee_id);
  `);

  // ── Attendance Records (CompuTime101 imports) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id       INTEGER,
      employee_name_raw TEXT NOT NULL,
      date              TEXT NOT NULL,
      punch_in          TEXT,
      punch_out         TEXT,
      reg_hours         REAL DEFAULT 0,
      ot_hours          REAL DEFAULT 0,
      work_code         TEXT,
      code_name         TEXT,
      site              TEXT,
      missing_punch     INTEGER DEFAULT 0,
      import_batch_id   TEXT,
      imported_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_batch ON attendance_records(import_batch_id);
  `);

  // ── Time-Off Requests ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_off_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      request_type    TEXT NOT NULL,
      start_date      TEXT NOT NULL,
      end_date        TEXT NOT NULL,
      status          TEXT DEFAULT 'pending',
      notes           TEXT,
      reviewed_by     TEXT,
      reviewed_at     TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS idx_timeoff_employee ON time_off_requests(employee_id);
    CREATE INDEX IF NOT EXISTS idx_timeoff_dates ON time_off_requests(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_timeoff_status ON time_off_requests(status);
  `);

  // ── Time-Off Balances ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_off_balances (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      year            INTEGER NOT NULL,
      request_type    TEXT NOT NULL,
      allocated_hours REAL DEFAULT 0,
      used_hours      REAL DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, year, request_type)
    );
  `);

  // Auto-refresh computed fields on startup
  refreshComputedFields();

  return db;
}

export function refreshComputedFields(): void {
  // Recalculate age from dob
  db.prepare(`
    UPDATE employees SET age = CAST((julianday('now') - julianday(dob)) / 365.25 AS INTEGER)
    WHERE dob IS NOT NULL
  `).run();

  // Recalculate years_of_service from doh
  db.prepare(`
    UPDATE employees SET years_of_service = CAST((julianday('now') - julianday(doh)) / 365.25 AS INTEGER)
    WHERE doh IS NOT NULL
  `).run();
}

export function getDb(): Database.Database {
  return db;
}

export function resetDatabase(): void {
  db.exec(`DELETE FROM time_off_balances`);
  db.exec(`DELETE FROM time_off_requests`);
  db.exec(`DELETE FROM attendance_records`);
  db.exec(`DELETE FROM employee_notes`);
  db.exec(`DELETE FROM audit_log`);
  db.exec(`DELETE FROM pay_history`);
  db.exec(`DELETE FROM employees`);
  db.exec(`VACUUM`);
}

// ── Audit Log ──

export function logAuditEntry(entry: {
  employee_id: number;
  employee_name: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_source?: string;
}) {
  db.prepare(`
    INSERT INTO audit_log (employee_id, employee_name, field_name, old_value, new_value, change_source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.employee_id,
    entry.employee_name,
    entry.field_name,
    entry.old_value,
    entry.new_value,
    entry.change_source || 'manual'
  );
}

export function getAuditLog(employeeId: number) {
  return db.prepare(
    'SELECT * FROM audit_log WHERE employee_id = ? ORDER BY changed_at DESC, id DESC'
  ).all(employeeId);
}

export function getGlobalAuditLog(limit: number = 100, offset: number = 0) {
  return db.prepare(
    'SELECT * FROM audit_log ORDER BY changed_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getGlobalAuditLogCount(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as any;
  return row.count;
}

// ── Employee Filters ──

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

export function getAllEmployees(filters: EmployeeFilters = {}) {
  let query = 'SELECT * FROM employees WHERE 1=1';
  const params: any[] = [];

  const status = filters.status || 'active';
  if (status !== 'all') {
    query += ' AND (status = ? OR status IS NULL)';
    params.push(status);
  }

  if (filters.search) {
    query += ' AND (employee_name LIKE ? OR current_position LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  // Multi-department filter takes priority over single department
  if (filters.departments && filters.departments.length > 0) {
    const placeholders = filters.departments.map(() => '?').join(', ');
    query += ` AND current_department IN (${placeholders})`;
    params.push(...filters.departments);
  } else if (filters.department) {
    query += ' AND current_department = ?';
    params.push(filters.department);
  }

  if (filters.supervisoryRole) {
    query += ' AND supervisory_role = ?';
    params.push(filters.supervisoryRole);
  }

  if (filters.dohFrom) {
    query += ' AND doh >= ?';
    params.push(filters.dohFrom);
  }
  if (filters.dohTo) {
    query += ' AND doh <= ?';
    params.push(filters.dohTo);
  }
  if (filters.payMin != null) {
    query += ' AND current_pay_rate >= ?';
    params.push(filters.payMin);
  }
  if (filters.payMax != null) {
    query += ' AND current_pay_rate <= ?';
    params.push(filters.payMax);
  }
  if (filters.ageMin != null) {
    query += ' AND age >= ?';
    params.push(filters.ageMin);
  }
  if (filters.ageMax != null) {
    query += ' AND age <= ?';
    params.push(filters.ageMax);
  }
  if (filters.countryOfOrigin) {
    query += ' AND country_of_origin = ?';
    params.push(filters.countryOfOrigin);
  }

  const sortCol = filters.sortBy || 'employee_name';
  const sortDir = filters.sortDir || 'ASC';
  const allowedCols = [
    'employee_name', 'id', 'age', 'current_department', 'current_position',
    'years_of_service', 'current_pay_rate', 'doh', 'supervisory_role'
  ];
  if (allowedCols.includes(sortCol)) {
    query += ` ORDER BY ${sortCol} ${sortDir}`;
  } else {
    query += ' ORDER BY employee_name ASC';
  }

  return db.prepare(query).all(...params);
}

// ── CRUD ──

export function getEmployee(id: number) {
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
}

export function createEmployee(data: Record<string, any>) {
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT INTO employees (${cols.join(', ')}) VALUES (${placeholders})`
  );
  const result = stmt.run(...cols.map(c => data[c]));
  return result.lastInsertRowid;
}

export function updateEmployee(id: number, data: Record<string, any>, changeSource: string = 'manual') {
  // Fetch old record to diff
  const old = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Record<string, any> | undefined;

  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  db.prepare(
    `UPDATE employees SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).run(...values, id);

  // Log audit entries for changed fields
  if (old) {
    const skipFields = ['created_at', 'updated_at', 'id'];
    for (const [key, newVal] of Object.entries(data)) {
      if (skipFields.includes(key)) continue;
      const oldVal = old[key];
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = newVal != null ? String(newVal) : null;
      if (oldStr !== newStr) {
        logAuditEntry({
          employee_id: id,
          employee_name: data.employee_name || old.employee_name || '',
          field_name: key,
          old_value: oldStr,
          new_value: newStr,
          change_source: changeSource,
        });
      }
    }
  }
}

export function archiveEmployee(id: number) {
  const emp = db.prepare('SELECT employee_name FROM employees WHERE id = ?').get(id) as any;
  db.prepare(
    `UPDATE employees SET status = 'archived', archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);
  if (emp) {
    logAuditEntry({ employee_id: id, employee_name: emp.employee_name, field_name: 'status', old_value: 'active', new_value: 'archived', change_source: 'manual' });
  }
}

export function restoreEmployee(id: number) {
  const emp = db.prepare('SELECT employee_name FROM employees WHERE id = ?').get(id) as any;
  db.prepare(
    `UPDATE employees SET status = 'active', archived_at = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(id);
  if (emp) {
    logAuditEntry({ employee_id: id, employee_name: emp.employee_name, field_name: 'status', old_value: 'archived', new_value: 'active', change_source: 'manual' });
  }
}

export function deleteEmployee(id: number) {
  db.prepare('DELETE FROM pay_history WHERE employee_id = ?').run(id);
  db.prepare('DELETE FROM audit_log WHERE employee_id = ?').run(id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
}

// ── Pay History ──

export function addPayHistory(entry: {
  employee_id: number;
  pay_rate: number | null;
  raise_date: string | null;
  department: string | null;
  position: string | null;
  change_type: string;
  notes?: string | null;
}) {
  db.prepare(`
    INSERT INTO pay_history (employee_id, pay_rate, raise_date, department, position, change_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entry.employee_id, entry.pay_rate, entry.raise_date, entry.department, entry.position, entry.change_type, entry.notes || null);
}

export function getPayHistory(employeeId: number) {
  return db.prepare(
    'SELECT * FROM pay_history WHERE employee_id = ? ORDER BY raise_date DESC, recorded_at DESC'
  ).all(employeeId);
}

// ── Birthday & Anniversary Alerts ──

export function getUpcomingBirthdays(days: number = 30) {
  return db.prepare(`
    SELECT * FROM (
      SELECT id, employee_name, dob, current_department,
        CASE
          WHEN strftime('%m-%d', dob) >= strftime('%m-%d', 'now')
            THEN CAST(strftime('%j', strftime('%Y', 'now') || '-' || strftime('%m-%d', dob)) AS INTEGER)
                 - CAST(strftime('%j', 'now') AS INTEGER)
          ELSE CAST(strftime('%j', strftime('%Y', 'now', '+1 year') || '-' || strftime('%m-%d', dob)) AS INTEGER)
               - CAST(strftime('%j', 'now') AS INTEGER) + 365
        END as days_until
      FROM employees
      WHERE ${ACTIVE_FILTER} AND dob IS NOT NULL
    ) WHERE days_until >= 0 AND days_until <= ?
    ORDER BY days_until ASC
  `).all(days);
}

export function getUpcomingAnniversaries(days: number = 30) {
  return db.prepare(`
    SELECT * FROM (
      SELECT id, employee_name, doh, current_department, years_of_service,
        CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', doh) AS INTEGER) +
          CASE WHEN strftime('%m-%d', doh) > strftime('%m-%d', 'now') THEN 0 ELSE 1 END as next_years,
        CASE
          WHEN strftime('%m-%d', doh) >= strftime('%m-%d', 'now')
            THEN CAST(strftime('%j', strftime('%Y', 'now') || '-' || strftime('%m-%d', doh)) AS INTEGER)
                 - CAST(strftime('%j', 'now') AS INTEGER)
          ELSE CAST(strftime('%j', strftime('%Y', 'now', '+1 year') || '-' || strftime('%m-%d', doh)) AS INTEGER)
               - CAST(strftime('%j', 'now') AS INTEGER) + 365
        END as days_until
      FROM employees
      WHERE ${ACTIVE_FILTER} AND doh IS NOT NULL
    ) WHERE days_until >= 0 AND days_until <= ?
      AND next_years IN (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)
    ORDER BY days_until ASC
  `).all(days);
}

// ── Dashboard Stats ──

export function getDashboardStats() {
  const totalHeadcount = db.prepare(`SELECT COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER}`).get() as any;
  const avgTenure = db.prepare(`SELECT AVG(years_of_service) as avg FROM employees WHERE ${ACTIVE_FILTER}`).get() as any;
  const avgPay = db.prepare(`SELECT AVG(current_pay_rate) as avg FROM employees WHERE ${ACTIVE_FILTER} AND current_pay_rate IS NOT NULL`).get() as any;
  const departments = db.prepare(`SELECT DISTINCT current_department FROM employees WHERE ${ACTIVE_FILTER} AND current_department IS NOT NULL`).all() as any[];

  const headcountByDept = db.prepare(
    `SELECT current_department as department, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} GROUP BY current_department ORDER BY count DESC`
  ).all();

  const sexBreakdown = db.prepare(
    `SELECT sex, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} AND sex IS NOT NULL GROUP BY sex`
  ).all();

  const raceBreakdown = db.prepare(
    `SELECT race, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} AND race IS NOT NULL GROUP BY race`
  ).all();

  const payByDept = db.prepare(
    `SELECT current_department as department, AVG(current_pay_rate) as avg_pay, MIN(current_pay_rate) as min_pay, MAX(current_pay_rate) as max_pay
     FROM employees WHERE ${ACTIVE_FILTER} AND current_pay_rate IS NOT NULL
     GROUP BY current_department ORDER BY avg_pay DESC`
  ).all();

  const tenureDistribution = db.prepare(
    `SELECT
      CASE
        WHEN years_of_service <= 5 THEN '0-5'
        WHEN years_of_service <= 10 THEN '6-10'
        WHEN years_of_service <= 20 THEN '11-20'
        WHEN years_of_service <= 30 THEN '21-30'
        ELSE '31+'
      END as bracket,
      COUNT(*) as count
     FROM employees WHERE ${ACTIVE_FILTER} AND years_of_service IS NOT NULL
     GROUP BY bracket ORDER BY MIN(years_of_service)`
  ).all();

  const supervisoryBreakdown = db.prepare(
    `SELECT supervisory_role, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} AND supervisory_role IS NOT NULL GROUP BY supervisory_role`
  ).all();

  const archivedCount = db.prepare(`SELECT COUNT(*) as count FROM employees WHERE status = 'archived'`).get() as any;

  const countryBreakdown = db.prepare(
    `SELECT country_of_origin as country, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} AND country_of_origin IS NOT NULL AND country_of_origin != '' GROUP BY country_of_origin ORDER BY count DESC`
  ).all();

  const educationBreakdown = db.prepare(
    `SELECT highest_education as education, COUNT(*) as count FROM employees WHERE ${ACTIVE_FILTER} AND highest_education IS NOT NULL AND highest_education != '' GROUP BY highest_education ORDER BY count DESC`
  ).all();

  // Payroll summary by department: total payroll cost = sum of pay rates, plus headcount
  const payrollByDept = db.prepare(
    `SELECT current_department as department, COUNT(*) as headcount, SUM(current_pay_rate) as total_payroll, AVG(current_pay_rate) as avg_pay
     FROM employees WHERE ${ACTIVE_FILTER} AND current_pay_rate IS NOT NULL
     GROUP BY current_department ORDER BY total_payroll DESC`
  ).all();

  const totalPayroll = db.prepare(
    `SELECT SUM(current_pay_rate) as total FROM employees WHERE ${ACTIVE_FILTER} AND current_pay_rate IS NOT NULL`
  ).get() as any;

  return {
    totalHeadcount: totalHeadcount.count,
    avgTenure: Math.round((avgTenure.avg || 0) * 10) / 10,
    avgPay: Math.round((avgPay.avg || 0) * 100) / 100,
    departmentCount: departments.length,
    archivedCount: archivedCount.count,
    headcountByDept, sexBreakdown, raceBreakdown, payByDept,
    tenureDistribution, supervisoryBreakdown, countryBreakdown,
    educationBreakdown, payrollByDept,
    totalPayroll: Math.round((totalPayroll.total || 0) * 100) / 100,
  };
}

export function getDepartments(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT current_department FROM employees WHERE ${ACTIVE_FILTER} AND current_department IS NOT NULL ORDER BY current_department`
  ).all() as any[];
  return rows.map(r => r.current_department);
}

export function getCountries(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT country_of_origin FROM employees WHERE ${ACTIVE_FILTER} AND country_of_origin IS NOT NULL ORDER BY country_of_origin`
  ).all() as any[];
  return rows.map(r => r.country_of_origin);
}

export function getRaces(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT race FROM employees WHERE race IS NOT NULL AND race != '' ORDER BY race`
  ).all() as any[];
  return rows.map(r => r.race);
}

export function getEthnicities(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT ethnicity FROM employees WHERE ethnicity IS NOT NULL AND ethnicity != '' ORDER BY ethnicity`
  ).all() as any[];
  return rows.map(r => r.ethnicity);
}

export function getLanguages(): string[] {
  const rows = db.prepare(
    `SELECT languages_spoken FROM employees WHERE languages_spoken IS NOT NULL AND languages_spoken != ''`
  ).all() as any[];
  const langSet = new Set<string>();
  for (const row of rows) {
    const parts = row.languages_spoken.split(/[,;\/]+/).map((s: string) => s.trim()).filter(Boolean);
    for (const lang of parts) langSet.add(lang);
  }
  return Array.from(langSet).sort();
}

export function getEducationLevels(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT highest_education FROM employees WHERE highest_education IS NOT NULL AND highest_education != '' ORDER BY highest_education`
  ).all() as any[];
  return rows.map(r => r.highest_education);
}

// ── Language Distribution ──

export function getLanguageDistribution() {
  const rows = db.prepare(
    `SELECT languages_spoken FROM employees WHERE ${ACTIVE_FILTER} AND languages_spoken IS NOT NULL AND languages_spoken != ''`
  ).all() as any[];

  const langMap = new Map<string, number>();
  for (const row of rows) {
    // languages_spoken may be comma-separated, semicolon-separated, or single
    const langs = (row.languages_spoken as string).split(/[,;\/]+/).map((l: string) => l.trim()).filter(Boolean);
    for (const lang of langs) {
      langMap.set(lang, (langMap.get(lang) || 0) + 1);
    }
  }
  return Array.from(langMap.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Employee Turnover ──

export function getMonthlyTurnover(months: number = 12) {
  // Get archived employees grouped by month of archived_at
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', archived_at) as month, COUNT(*) as archived_count
    FROM employees
    WHERE status = 'archived' AND archived_at IS NOT NULL
      AND archived_at >= date('now', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `).all(months);

  // Get new hires grouped by month of created_at
  const hires = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as hired_count
    FROM employees
    WHERE created_at IS NOT NULL
      AND created_at >= date('now', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `).all(months);

  // Merge into a single array covering all months
  const now = new Date();
  const result: { month: string; archived: number; hired: number }[] = [];
  const archiveMap = new Map((rows as any[]).map(r => [r.month, r.archived_count]));
  const hireMap = new Map((hires as any[]).map(r => [r.month, r.hired_count]));

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      month: key,
      archived: archiveMap.get(key) || 0,
      hired: hireMap.get(key) || 0,
    });
  }
  return result;
}

// ── Pay Growth Analysis ──

export function getPayGrowthByDepartment() {
  return db.prepare(`
    SELECT current_department as department,
      AVG(starting_pay_base) as avg_starting,
      AVG(current_pay_rate) as avg_current,
      AVG(CASE WHEN starting_pay_base > 0 THEN ((current_pay_rate - starting_pay_base) / starting_pay_base) * 100 ELSE 0 END) as avg_growth_pct
    FROM employees
    WHERE ${ACTIVE_FILTER} AND starting_pay_base IS NOT NULL AND current_pay_rate IS NOT NULL AND starting_pay_base > 0
    GROUP BY current_department
    ORDER BY avg_growth_pct DESC
  `).all();
}

// ── Time Since Last Raise ──

export function getTimeSinceLastRaise() {
  return db.prepare(`
    SELECT id, employee_name, current_department, current_position, date_last_raise, current_pay_rate,
      CAST(julianday('now') - julianday(date_last_raise) AS INTEGER) as days_since_raise
    FROM employees
    WHERE ${ACTIVE_FILTER} AND date_last_raise IS NOT NULL
    ORDER BY days_since_raise DESC
  `).all();
}

// ── Pay Equity ──

export function getPayEquity() {
  const byGender = db.prepare(`
    SELECT sex as category, AVG(current_pay_rate) as avg_pay, COUNT(*) as count
    FROM employees WHERE ${ACTIVE_FILTER} AND sex IS NOT NULL AND current_pay_rate IS NOT NULL
    GROUP BY sex ORDER BY avg_pay DESC
  `).all();

  const byRace = db.prepare(`
    SELECT race as category, AVG(current_pay_rate) as avg_pay, COUNT(*) as count
    FROM employees WHERE ${ACTIVE_FILTER} AND race IS NOT NULL AND current_pay_rate IS NOT NULL
    GROUP BY race ORDER BY avg_pay DESC
  `).all();

  const byEducation = db.prepare(`
    SELECT highest_education as category, AVG(current_pay_rate) as avg_pay, COUNT(*) as count
    FROM employees WHERE ${ACTIVE_FILTER} AND highest_education IS NOT NULL AND current_pay_rate IS NOT NULL
    GROUP BY highest_education ORDER BY avg_pay DESC
  `).all();

  return { byGender, byRace, byEducation };
}

// ── Age Distribution ──

export function getAgeDistribution() {
  return db.prepare(`
    SELECT
      CASE
        WHEN age < 25 THEN 'Under 25'
        WHEN age < 30 THEN '25-29'
        WHEN age < 35 THEN '30-34'
        WHEN age < 40 THEN '35-39'
        WHEN age < 45 THEN '40-44'
        WHEN age < 50 THEN '45-49'
        WHEN age < 55 THEN '50-54'
        WHEN age < 60 THEN '55-59'
        ELSE '60+'
      END as bracket,
      COUNT(*) as count
    FROM employees WHERE ${ACTIVE_FILTER} AND age IS NOT NULL
    GROUP BY bracket ORDER BY MIN(age)
  `).all();
}

// ── Supervisor-to-Employee Ratio ──

export function getSupervisorRatio() {
  return db.prepare(`
    SELECT current_department as department,
      SUM(CASE WHEN supervisory_role = 'Y' THEN 1 ELSE 0 END) as supervisors,
      SUM(CASE WHEN supervisory_role = 'N' OR supervisory_role IS NULL THEN 1 ELSE 0 END) as employees,
      COUNT(*) as total,
      ROUND(CAST(SUM(CASE WHEN supervisory_role = 'N' OR supervisory_role IS NULL THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(SUM(CASE WHEN supervisory_role = 'Y' THEN 1 ELSE 0 END), 0), 1) as ratio
    FROM employees WHERE ${ACTIVE_FILTER} AND current_department IS NOT NULL
    GROUP BY current_department ORDER BY ratio DESC
  `).all();
}

// ── Average Age by Department ──

export function getAvgAgeByDepartment() {
  return db.prepare(`
    SELECT current_department as department, ROUND(AVG(age), 1) as avg_age, MIN(age) as min_age, MAX(age) as max_age
    FROM employees WHERE ${ACTIVE_FILTER} AND age IS NOT NULL AND current_department IS NOT NULL
    GROUP BY current_department ORDER BY avg_age DESC
  `).all();
}

// ── Headcount Growth Over Time ──

export function getHeadcountGrowth(months: number = 12) {
  // Get total active employees as of each month end
  const now = new Date();
  const result: { month: string; cumulative: number; newHires: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of month
    const monthEnd = d.toISOString().split('T')[0];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

    const cumRow = db.prepare(`
      SELECT COUNT(*) as count FROM employees
      WHERE created_at <= ? AND (status = 'active' OR status IS NULL OR (status = 'archived' AND archived_at > ?))
    `).get(monthEnd, monthEnd) as any;

    const newRow = db.prepare(`
      SELECT COUNT(*) as count FROM employees
      WHERE created_at >= ? AND created_at <= ?
    `).get(monthStart, monthEnd) as any;

    result.push({ month: monthKey, cumulative: cumRow.count, newHires: newRow.count });
  }
  return result;
}

// ── Department Transfer Activity ──

export function getDepartmentTransfers() {
  // Get employees who have transfer records
  const rows = db.prepare(`
    SELECT current_department as department,
      SUM(CASE WHEN department_transfers IS NOT NULL AND department_transfers != '' THEN 1 ELSE 0 END) as transferred,
      COUNT(*) as total
    FROM employees WHERE ${ACTIVE_FILTER} AND current_department IS NOT NULL
    GROUP BY current_department ORDER BY transferred DESC
  `).all();
  return rows;
}

// ── Retention Rate ──

export function getRetentionRate() {
  const milestones = [1, 3, 5, 10];
  const result: { milestone: string; total: number; retained: number; rate: number }[] = [];

  for (const years of milestones) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    // Employees hired at least N years ago
    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM employees WHERE doh IS NOT NULL AND doh <= ?
    `).get(cutoff) as any;

    // Of those, how many are still active
    const retainedRow = db.prepare(`
      SELECT COUNT(*) as count FROM employees WHERE doh IS NOT NULL AND doh <= ? AND ${ACTIVE_FILTER}
    `).get(cutoff) as any;

    const total = totalRow.count;
    const retained = retainedRow.count;
    result.push({
      milestone: `${years}+ yr${years > 1 ? 's' : ''}`,
      total,
      retained,
      rate: total > 0 ? Math.round((retained / total) * 1000) / 10 : 0,
    });
  }
  return result;
}

// ── Employee Notes ──

export function getEmployeeNotes(employeeId: number) {
  return db.prepare('SELECT * FROM employee_notes WHERE employee_id = ? ORDER BY created_at DESC').all(employeeId);
}

export function addEmployeeNote(employeeId: number, content: string) {
  const result = db.prepare('INSERT INTO employee_notes (employee_id, content) VALUES (?, ?)').run(employeeId, content);
  return result.lastInsertRowid;
}

export function updateEmployeeNote(noteId: number, content: string) {
  db.prepare("UPDATE employee_notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, noteId);
}

export function deleteEmployeeNote(noteId: number) {
  db.prepare('DELETE FROM employee_notes WHERE id = ?').run(noteId);
}

// ── Bulk Update ──

export function bulkUpdateEmployees(ids: number[], data: Record<string, any>) {
  const updateTransaction = db.transaction(() => {
    for (const id of ids) {
      updateEmployee(id, data, 'bulk_edit');
    }
  });
  updateTransaction();
}

// ── Search Autocomplete ──

export function searchEmployees(query: string, limit: number = 10) {
  const term = `%${query}%`;
  return db.prepare(`
    SELECT id, employee_name, current_department, current_position, photo_path
    FROM employees
    WHERE ${ACTIVE_FILTER}
      AND (employee_name LIKE ? OR current_position LIKE ? OR current_department LIKE ?)
    ORDER BY employee_name ASC
    LIMIT ?
  `).all(term, term, term, limit);
}

// ── Attendance Records ──

export function matchEmployeeByName(rawName: string): { employee_id: number; employee_name: string } | null {
  // Exact match first
  const exact = db.prepare(
    `SELECT id as employee_id, employee_name FROM employees WHERE ${ACTIVE_FILTER} AND employee_name = ?`
  ).get(rawName) as any;
  if (exact) return exact;

  // Normalized match: trim, lowercase, collapse whitespace
  const normalized = rawName.trim().toLowerCase().replace(/\s+/g, ' ');
  const rows = db.prepare(
    `SELECT id as employee_id, employee_name FROM employees WHERE ${ACTIVE_FILTER}`
  ).all() as any[];

  for (const row of rows) {
    const empNorm = row.employee_name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (empNorm === normalized) return row;
  }

  // Partial match: LIKE with wildcards
  const likeTerm = `%${normalized}%`;
  const partial = db.prepare(
    `SELECT id as employee_id, employee_name FROM employees WHERE ${ACTIVE_FILTER} AND LOWER(employee_name) LIKE ? LIMIT 1`
  ).get(likeTerm) as any;
  if (partial) return partial;

  return null;
}

export function importAttendanceBatch(
  records: {
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
  }[],
  batchId: string
) {
  const stmt = db.prepare(`
    INSERT INTO attendance_records (employee_id, employee_name_raw, date, punch_in, punch_out, reg_hours, ot_hours, work_code, code_name, site, missing_punch, import_batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction(() => {
    for (const r of records) {
      stmt.run(r.employee_id, r.employee_name_raw, r.date, r.punch_in, r.punch_out, r.reg_hours, r.ot_hours, r.work_code, r.code_name, r.site, r.missing_punch, batchId);
    }
  });
  insertAll();
}

export function getAttendanceByEmployee(employeeId: number, startDate: string, endDate: string) {
  return db.prepare(`
    SELECT * FROM attendance_records
    WHERE employee_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, punch_in ASC
  `).all(employeeId, startDate, endDate);
}

export function getAttendanceByDepartment(department: string, startDate: string, endDate: string) {
  return db.prepare(`
    SELECT ar.*, e.current_department, e.current_position
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE e.current_department = ? AND ar.date >= ? AND ar.date <= ?
    ORDER BY ar.date ASC, e.employee_name ASC
  `).all(department, startDate, endDate);
}

export function getAttendanceSummary(filters: { employeeId?: number; department?: string; startDate: string; endDate: string }) {
  let query = `
    SELECT
      COUNT(DISTINCT date) as days_present,
      SUM(reg_hours) as total_reg_hours,
      SUM(ot_hours) as total_ot_hours,
      SUM(CASE WHEN missing_punch = 1 THEN 1 ELSE 0 END) as missing_punches,
      COUNT(*) as total_records
    FROM attendance_records ar
  `;
  const params: any[] = [];

  if (filters.department) {
    query += ' JOIN employees e ON ar.employee_id = e.id WHERE e.current_department = ?';
    params.push(filters.department);
  } else if (filters.employeeId) {
    query += ' WHERE ar.employee_id = ?';
    params.push(filters.employeeId);
  } else {
    query += ' WHERE 1=1';
  }

  query += ' AND ar.date >= ? AND ar.date <= ?';
  params.push(filters.startDate, filters.endDate);

  return db.prepare(query).get(...params);
}

export function getAttendanceImports() {
  return db.prepare(`
    SELECT import_batch_id, MIN(date) as start_date, MAX(date) as end_date,
      COUNT(*) as record_count, MIN(imported_at) as imported_at
    FROM attendance_records
    GROUP BY import_batch_id
    ORDER BY imported_at DESC
  `).all();
}

export function deleteAttendanceBatch(batchId: string) {
  db.prepare('DELETE FROM attendance_records WHERE import_batch_id = ?').run(batchId);
}

export function deleteAttendanceRecord(recordId: number, reason: string = 'manual') {
  const record = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(recordId) as any;
  if (!record) return false;

  logAuditEntry({
    employee_id: record.employee_id,
    employee_name: record.employee_name_raw || 'Unknown',
    field_name: 'attendance_record',
    old_value: JSON.stringify({ id: record.id, date: record.date, punch_in: record.punch_in, punch_out: record.punch_out, reg_hours: record.reg_hours, ot_hours: record.ot_hours }),
    new_value: null,
    change_source: reason,
  });

  db.prepare('DELETE FROM attendance_records WHERE id = ?').run(recordId);
  return true;
}

export function deleteAttendanceRecords(recordIds: number[], reason: string = 'bulk-delete') {
  const stmt = db.prepare('SELECT * FROM attendance_records WHERE id = ?');
  const deleteStmt = db.prepare('DELETE FROM attendance_records WHERE id = ?');

  const deleteAll = db.transaction(() => {
    for (const id of recordIds) {
      const record = stmt.get(id) as any;
      if (!record) continue;
      logAuditEntry({
        employee_id: record.employee_id,
        employee_name: record.employee_name_raw || 'Unknown',
        field_name: 'attendance_record',
        old_value: JSON.stringify({ id: record.id, date: record.date, punch_in: record.punch_in, punch_out: record.punch_out, reg_hours: record.reg_hours, ot_hours: record.ot_hours }),
        new_value: null,
        change_source: reason,
      });
      deleteStmt.run(id);
    }
  });
  deleteAll();
  return recordIds.length;
}

export function deleteAttendanceBatchWithAudit(batchId: string, reason: string = 'batch-delete') {
  const records = db.prepare('SELECT * FROM attendance_records WHERE import_batch_id = ?').all(batchId) as any[];
  if (records.length === 0) return 0;

  const deleteAll = db.transaction(() => {
    for (const record of records) {
      logAuditEntry({
        employee_id: record.employee_id,
        employee_name: record.employee_name_raw || 'Unknown',
        field_name: 'attendance_record',
        old_value: JSON.stringify({ id: record.id, date: record.date, punch_in: record.punch_in, punch_out: record.punch_out }),
        new_value: null,
        change_source: reason,
      });
    }
    db.prepare('DELETE FROM attendance_records WHERE import_batch_id = ?').run(batchId);
  });
  deleteAll();
  return records.length;
}

export function getAllAttendanceRecords(startDate: string, endDate: string) {
  return db.prepare(`
    SELECT ar.*, e.employee_name, e.current_department
    FROM attendance_records ar
    LEFT JOIN employees e ON ar.employee_id = e.id
    WHERE ar.date >= ? AND ar.date <= ?
    ORDER BY ar.date DESC, ar.employee_name_raw ASC
  `).all(startDate, endDate);
}

// ── Time-Off Requests ──

export function createTimeOffRequest(data: {
  employee_id: number;
  request_type: string;
  start_date: string;
  end_date: string;
  notes?: string;
}) {
  const result = db.prepare(`
    INSERT INTO time_off_requests (employee_id, request_type, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.employee_id, data.request_type, data.start_date, data.end_date, data.notes || null);
  return result.lastInsertRowid;
}

export function updateTimeOffRequest(id: number, data: { status?: string; notes?: string; reviewed_by?: string }) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: any[] = [];

  if (data.status) {
    sets.push('status = ?');
    params.push(data.status);
    if (data.status === 'approved' || data.status === 'denied') {
      sets.push("reviewed_at = datetime('now')");
    }
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?');
    params.push(data.notes);
  }
  if (data.reviewed_by) {
    sets.push('reviewed_by = ?');
    params.push(data.reviewed_by);
  }

  params.push(id);
  db.prepare(`UPDATE time_off_requests SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getTimeOffRequests(filters: {
  employeeId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  let query = `
    SELECT tor.*, e.employee_name, e.current_department
    FROM time_off_requests tor
    JOIN employees e ON tor.employee_id = e.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.employeeId) {
    query += ' AND tor.employee_id = ?';
    params.push(filters.employeeId);
  }
  if (filters.status) {
    query += ' AND tor.status = ?';
    params.push(filters.status);
  }
  if (filters.startDate) {
    query += ' AND tor.end_date >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND tor.start_date <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY tor.created_at DESC';
  return db.prepare(query).all(...params);
}

export function getTimeOffBalances(employeeId: number, year: number) {
  return db.prepare(
    'SELECT * FROM time_off_balances WHERE employee_id = ? AND year = ?'
  ).all(employeeId, year);
}

export function upsertTimeOffBalance(employeeId: number, year: number, requestType: string, allocatedHours: number) {
  db.prepare(`
    INSERT INTO time_off_balances (employee_id, year, request_type, allocated_hours)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(employee_id, year, request_type)
    DO UPDATE SET allocated_hours = ?
  `).run(employeeId, year, requestType, allocatedHours, allocatedHours);
}

// ── Attendance Reports ──

export function getOvertimeReport(startDate: string, endDate: string, groupBy: 'employee' | 'department' = 'employee') {
  if (groupBy === 'department') {
    return db.prepare(`
      SELECT e.current_department as name, SUM(ar.ot_hours) as total_ot, SUM(ar.reg_hours) as total_reg, COUNT(DISTINCT ar.employee_id) as employee_count
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ar.date >= ? AND ar.date <= ?
      GROUP BY e.current_department
      ORDER BY total_ot DESC
    `).all(startDate, endDate);
  }
  return db.prepare(`
    SELECT ar.employee_id, e.employee_name as name, e.current_department, SUM(ar.ot_hours) as total_ot, SUM(ar.reg_hours) as total_reg, COUNT(DISTINCT ar.date) as days_worked
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ar.date >= ? AND ar.date <= ?
    GROUP BY ar.employee_id
    ORDER BY total_ot DESC
  `).all(startDate, endDate);
}

export function getAbsenteeismReport(startDate: string, endDate: string) {
  // Get all active employees and their attendance days in the range
  return db.prepare(`
    SELECT e.id, e.employee_name, e.current_department,
      COUNT(DISTINCT ar.date) as days_present,
      (julianday(?) - julianday(?) + 1) as total_days
    FROM employees e
    LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.date >= ? AND ar.date <= ?
    WHERE (e.status = 'active' OR e.status IS NULL)
    GROUP BY e.id
    ORDER BY days_present ASC
  `).all(endDate, startDate, startDate, endDate);
}

export function getTardinessReport(startDate: string, endDate: string, dayThreshold?: string, nightThreshold?: string) {
  const { getConfig } = require('./app-config');
  const config = getConfig();
  const dayStart = dayThreshold || config.shifts?.dayShiftStart || '07:00';
  const nightStart = nightThreshold || config.shifts?.nightShiftStart || '19:00';

  return db.prepare(`
    SELECT ar.employee_id, e.employee_name, e.current_department, e.shift,
      COUNT(*) as late_count,
      COUNT(DISTINCT ar.date) as days_late
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ar.date >= ? AND ar.date <= ?
      AND ar.punch_in IS NOT NULL
      AND (
        (COALESCE(e.shift, 'day') = 'day' AND ar.punch_in > ?)
        OR (COALESCE(e.shift, 'night') = 'night' AND ar.punch_in > ?)
      )
    GROUP BY ar.employee_id
    ORDER BY late_count DESC
  `).all(startDate, endDate, dayStart, nightStart);
}

export function getTimeOffUsageReport(year: number) {
  return db.prepare(`
    SELECT e.employee_name, e.current_department, tob.request_type,
      tob.allocated_hours, tob.used_hours,
      (tob.allocated_hours - tob.used_hours) as remaining_hours
    FROM time_off_balances tob
    JOIN employees e ON tob.employee_id = e.id
    WHERE tob.year = ?
    ORDER BY e.employee_name, tob.request_type
  `).all(year);
}
