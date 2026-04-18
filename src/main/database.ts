import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database;
let activeKeyHex: string | null = null;

const ACTIVE_FILTER = `(status = 'active' OR status IS NULL)`;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'hr-database.sqlite');
}

function quoteSqlcipherKey(keyHex: string): string {
  // SQLCipher raw-key syntax: PRAGMA key = "x'<hex>'"
  return `x'${keyHex}'`;
}

/** Detect whether an existing database file is plaintext SQLite. */
function isPlaintextSqliteFile(dbPath: string): boolean {
  if (!fs.existsSync(dbPath)) return false;
  try {
    const stat = fs.statSync(dbPath);
    if (stat.size < 16) return false;
    const fd = fs.openSync(dbPath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === 'SQLite format 3\u0000';
  } catch {
    return false;
  }
}

/** Migrate a plaintext SQLite database at dbPath to an encrypted database using keyHex.
 *
 * Copies the plaintext file, rekeys the copy (sqlite3mc encrypts an unencrypted
 * database on rekey), verifies, then atomically replaces the original. Avoids
 * sqlcipher_export(), which is only registered when cipher='sqlcipher'.
 */
function migratePlaintextToEncrypted(dbPath: string, keyHex: string): void {
  const tmpEnc = dbPath + '.enc-migrating';
  try { fs.unlinkSync(tmpEnc); } catch (_) {}
  try { fs.unlinkSync(tmpEnc + '-wal'); } catch (_) {}
  try { fs.unlinkSync(tmpEnc + '-shm'); } catch (_) {}

  // Checkpoint WAL so the file copy captures all committed data.
  {
    const plain = new Database(dbPath);
    try { plain.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
    plain.close();
  }

  fs.copyFileSync(dbPath, tmpEnc);

  // Rekey the copy: on an unencrypted DB, sqlite3mc interprets this as
  // "add encryption using the given key".
  const copy = new Database(tmpEnc);
  try {
    copy.pragma(`rekey = "${quoteSqlcipherKey(keyHex)}"`);
  } finally {
    copy.close();
  }

  // Verify the rekey by opening with the key and touching the schema.
  const verify = new Database(tmpEnc);
  try {
    verify.pragma(`key = "${quoteSqlcipherKey(keyHex)}"`);
    verify.prepare('SELECT count(*) FROM sqlite_master').get();
  } finally {
    verify.close();
  }

  // Replace original with encrypted version.
  try { fs.unlinkSync(dbPath); } catch (_) {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}
  fs.renameSync(tmpEnc, dbPath);
}

/** Open the database, applying the SQLCipher key if provided. Migrates plaintext DBs on first use. */
export function initDatabase(keyHex?: string): Database.Database {
  const dbPath = getDbPath();

  if (keyHex && isPlaintextSqliteFile(dbPath)) {
    migratePlaintextToEncrypted(dbPath, keyHex);
  }

  db = new Database(dbPath);
  if (keyHex) {
    activeKeyHex = keyHex;
    db.pragma(`key = "${quoteSqlcipherKey(keyHex)}"`);
    // Touch the DB to verify the key works
    db.prepare('SELECT count(*) FROM sqlite_master').get();
  } else {
    activeKeyHex = null;
  }
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

  // Migration: add shift column (legacy, kept for backward compat)
  try { db.exec(`ALTER TABLE employees ADD COLUMN shift TEXT DEFAULT 'day' CHECK(shift IN ('day','night'))`); } catch (_) {}

  // Migration: add date_of_separation column
  try { db.exec(`ALTER TABLE employees ADD COLUMN date_of_separation TEXT`); } catch (_) {}

  // ── Shifts Table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_name            TEXT NOT NULL UNIQUE,
      scheduled_in          TEXT NOT NULL,
      scheduled_out         TEXT NOT NULL,
      scheduled_lunch_start TEXT,
      scheduled_lunch_end   TEXT,
      created_at            TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add lunch columns to shifts if missing
  try { db.exec(`ALTER TABLE shifts ADD COLUMN scheduled_lunch_start TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE shifts ADD COLUMN scheduled_lunch_end TEXT`); } catch (_) {}
  // Migration: add is_salary flag to shifts
  try { db.exec(`ALTER TABLE shifts ADD COLUMN is_salary INTEGER DEFAULT 0`); } catch (_) {}

  // Seed default shifts if table is empty
  const shiftCount = (db.prepare('SELECT COUNT(*) as c FROM shifts').get() as any).c;
  if (shiftCount === 0) {
    const { getConfig } = require('./app-config');
    const cfg = getConfig();
    const dayIn = cfg.shifts?.dayShiftStart || '07:00';
    const nightIn = cfg.shifts?.nightShiftStart || '19:00';
    db.prepare('INSERT INTO shifts (shift_name, scheduled_in, scheduled_out, scheduled_lunch_start, scheduled_lunch_end) VALUES (?, ?, ?, ?, ?)').run('Day', dayIn, '15:30', '11:30', '12:00');
    db.prepare('INSERT INTO shifts (shift_name, scheduled_in, scheduled_out, scheduled_lunch_start, scheduled_lunch_end) VALUES (?, ?, ?, ?, ?)').run('Night', nightIn, '03:30', null, null);
  }

  // Seed "Salary" shift if missing
  const salaryExists = db.prepare("SELECT COUNT(*) as c FROM shifts WHERE is_salary = 1").get() as any;
  if (salaryExists.c === 0) {
    db.prepare('INSERT OR IGNORE INTO shifts (shift_name, scheduled_in, scheduled_out, is_salary) VALUES (?, ?, ?, 1)').run('Salary', '09:00', '17:00');
  }

  // Migration: add shift_id column to employees
  try { db.exec(`ALTER TABLE employees ADD COLUMN shift_id INTEGER REFERENCES shifts(id)`); } catch (_) {}

  // Backfill shift_id from legacy shift column
  db.prepare(`UPDATE employees SET shift_id = (SELECT id FROM shifts WHERE shift_name = 'Day') WHERE COALESCE(shift, 'day') = 'day' AND shift_id IS NULL`).run();
  db.prepare(`UPDATE employees SET shift_id = (SELECT id FROM shifts WHERE shift_name = 'Night') WHERE shift = 'night' AND shift_id IS NULL`).run();

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

  // ── Salary Attendance Flags (manual entries for salaried employees) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_attendance_flags (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      date            TEXT NOT NULL,
      flag_type       TEXT NOT NULL CHECK(flag_type IN ('tardy','absent','left_early','partial_absence')),
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date, flag_type)
    );
    CREATE INDEX IF NOT EXISTS idx_salary_flags_employee ON salary_attendance_flags(employee_id);
    CREATE INDEX IF NOT EXISTS idx_salary_flags_date ON salary_attendance_flags(date);
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

  // ── FMLA Cases ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS fmla_cases (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id         INTEGER NOT NULL,
      reason              TEXT NOT NULL,
      family_member       TEXT,
      leave_type          TEXT NOT NULL CHECK(leave_type IN ('continuous','intermittent','reduced_schedule')),
      status              TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','closed','exhausted')),
      start_date          TEXT,
      expected_end_date   TEXT,
      actual_end_date     TEXT,
      entitlement_hours   REAL DEFAULT 480,
      used_hours          REAL DEFAULT 0,
      leave_year_start    TEXT NOT NULL,
      cert_status         TEXT DEFAULT 'not_requested' CHECK(cert_status IN ('not_requested','requested','received','insufficient','expired')),
      cert_due_date       TEXT,
      cert_received_date  TEXT,
      recert_due_date     TEXT,
      fitness_for_duty    INTEGER DEFAULT 0,
      notes               TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fmla_employee ON fmla_cases(employee_id);
    CREATE INDEX IF NOT EXISTS idx_fmla_status ON fmla_cases(status);
  `);

  // Migration: expand fmla_cases status and cert_status CHECK constraints
  try {
    const hasOldCheck = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fmla_cases'`).get() as any;
    if (hasOldCheck?.sql && hasOldCheck.sql.includes("'pending','approved','denied','closed','exhausted'")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS fmla_cases_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, reason TEXT NOT NULL,
          family_member TEXT, leave_type TEXT NOT NULL CHECK(leave_type IN ('continuous','intermittent','reduced_schedule')),
          status TEXT DEFAULT 'pending_designation' CHECK(status IN ('pending_designation','active','exhausted','closed','pending','approved','denied')),
          start_date TEXT, expected_end_date TEXT, actual_end_date TEXT, entitlement_hours REAL DEFAULT 480, used_hours REAL DEFAULT 0,
          leave_year_start TEXT NOT NULL,
          cert_status TEXT DEFAULT 'not_requested' CHECK(cert_status IN ('not_requested','requested','received','incomplete','approved','denied','insufficient','expired')),
          cert_due_date TEXT, cert_received_date TEXT, recert_due_date TEXT, fitness_for_duty INTEGER DEFAULT 0,
          notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (employee_id) REFERENCES employees(id)
        );
        INSERT INTO fmla_cases_new SELECT * FROM fmla_cases;
        DROP TABLE fmla_cases;
        ALTER TABLE fmla_cases_new RENAME TO fmla_cases;
        CREATE INDEX IF NOT EXISTS idx_fmla_employee ON fmla_cases(employee_id);
        CREATE INDEX IF NOT EXISTS idx_fmla_status ON fmla_cases(status);
      `);
    }
  } catch (_) {}

  // ── FMLA Episodes (individual absence events) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS fmla_episodes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      fmla_case_id        INTEGER NOT NULL,
      date                TEXT NOT NULL,
      hours_used          REAL NOT NULL,
      time_off_request_id INTEGER,
      notes               TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fmla_case_id) REFERENCES fmla_cases(id),
      FOREIGN KEY (time_off_request_id) REFERENCES time_off_requests(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fmla_ep_case ON fmla_episodes(fmla_case_id);
    CREATE INDEX IF NOT EXISTS idx_fmla_ep_date ON fmla_episodes(date);
  `);

  // ── FMLA Configuration ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS fmla_config (
      id                  INTEGER PRIMARY KEY CHECK(id = 1),
      leave_year_method   TEXT DEFAULT 'rolling_backward' CHECK(leave_year_method IN ('rolling_backward','rolling_forward','calendar_year','fixed_year')),
      fixed_year_start    TEXT DEFAULT '01-01',
      eligibility_months  INTEGER DEFAULT 12,
      eligibility_hours   REAL DEFAULT 1250,
      updated_at          TEXT DEFAULT (datetime('now'))
    );
  `);
  db.prepare('INSERT OR IGNORE INTO fmla_config (id) VALUES (1)').run();

  // ── Employee Files (attachments with OCR) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      ocr_text TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_employee_files_employee ON employee_files(employee_id);
  `);

  // ── Saved Reports ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      config TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Disciplinary Actions Table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS disciplinary_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('verbal_warning','written_warning','suspension','termination','pip','other')),
      date TEXT NOT NULL,
      description TEXT,
      outcome TEXT,
      issued_by TEXT,
      follow_up_date TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','escalated')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_disciplinary_employee ON disciplinary_actions(employee_id);
    CREATE INDEX IF NOT EXISTS idx_disciplinary_status ON disciplinary_actions(status);
  `);

  // ── Benefit Plans Table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS benefit_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_name TEXT NOT NULL,
      plan_type TEXT NOT NULL CHECK(plan_type IN ('health','dental','vision','401k','fsa','hsa','life','disability','other')),
      provider TEXT,
      plan_number TEXT,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Benefit Enrollments Table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS benefit_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES benefit_plans(id),
      enrollment_date TEXT NOT NULL,
      termination_date TEXT,
      coverage_level TEXT CHECK(coverage_level IN ('employee','employee_spouse','employee_children','family')),
      employee_contribution REAL DEFAULT 0,
      employer_contribution REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','terminated','pending')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_enrollments_employee ON benefit_enrollments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_plan ON benefit_enrollments(plan_id);
  `);

  // ── Dependents Table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS dependents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relationship TEXT CHECK(relationship IN ('spouse','child','domestic_partner','other')),
      date_of_birth TEXT,
      covered_plan_ids TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dependents_employee ON dependents(employee_id);
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

  // Trim whitespace on categorical/lookup string fields so "Asian" and "Asian "
  // don't show up as distinct groups in charts, filters, or reports.
  const TRIM_FIELDS = [
    'race', 'ethnicity', 'sex', 'country_of_origin', 'highest_education',
    'current_department', 'current_position',
  ];
  for (const f of TRIM_FIELDS) {
    db.prepare(`UPDATE employees SET ${f} = TRIM(${f}) WHERE ${f} IS NOT NULL AND ${f} != TRIM(${f})`).run();
    db.prepare(`UPDATE employees SET ${f} = NULL WHERE ${f} = ''`).run();
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Unlock the app first.');
  return db;
}

export function isDatabaseOpen(): boolean {
  return !!db;
}

export function closeDatabase(): void {
  if (db) {
    try { db.close(); } catch (_) {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = undefined as any;
  }
  activeKeyHex = null;
}

export function rekeyDatabase(newKeyHex: string): void {
  if (!db) throw new Error('Database not open');
  db.pragma(`rekey = "${quoteSqlcipherKey(newKeyHex)}"`);
  activeKeyHex = newKeyHex;
}

export function getActiveKeyHex(): string | null {
  return activeKeyHex;
}

export function resetDatabase(): void {
  db.exec(`DELETE FROM time_off_balances`);
  db.exec(`DELETE FROM time_off_requests`);
  db.exec(`DELETE FROM attendance_records`);
  db.exec(`DELETE FROM employee_files`);
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
  let query = 'SELECT e.*, s.shift_name, s.scheduled_in, s.scheduled_out, s.scheduled_lunch_start, s.scheduled_lunch_end, s.is_salary FROM employees e LEFT JOIN shifts s ON e.shift_id = s.id WHERE 1=1';
  const params: any[] = [];

  const status = filters.status || 'active';
  if (status !== 'all') {
    query += ' AND (e.status = ? OR e.status IS NULL)';
    params.push(status);
  }

  if (filters.search) {
    query += ' AND (e.employee_name LIKE ? OR e.current_position LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  // Multi-department filter takes priority over single department
  // Uses LIKE to match comma-separated department values
  if (filters.departments && filters.departments.length > 0) {
    const deptConditions = filters.departments.map(() => `(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'`).join(' OR ');
    query += ` AND (${deptConditions})`;
    params.push(...filters.departments);
  } else if (filters.department) {
    query += ` AND (',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'`;
    params.push(filters.department);
  }

  if (filters.supervisoryRole) {
    query += ' AND e.supervisory_role = ?';
    params.push(filters.supervisoryRole);
  }

  if (filters.dohFrom) {
    query += ' AND e.doh >= ?';
    params.push(filters.dohFrom);
  }
  if (filters.dohTo) {
    query += ' AND e.doh <= ?';
    params.push(filters.dohTo);
  }
  if (filters.payMin != null) {
    query += ' AND e.current_pay_rate >= ?';
    params.push(filters.payMin);
  }
  if (filters.payMax != null) {
    query += ' AND e.current_pay_rate <= ?';
    params.push(filters.payMax);
  }
  if (filters.ageMin != null) {
    query += ' AND e.age >= ?';
    params.push(filters.ageMin);
  }
  if (filters.ageMax != null) {
    query += ' AND e.age <= ?';
    params.push(filters.ageMax);
  }
  if (filters.countryOfOrigin) {
    query += ' AND e.country_of_origin = ?';
    params.push(filters.countryOfOrigin);
  }

  const sortCol = filters.sortBy || 'employee_name';
  const sortDir = filters.sortDir || 'ASC';
  const allowedCols = [
    'employee_name', 'id', 'age', 'current_department', 'current_position',
    'years_of_service', 'current_pay_rate', 'doh', 'supervisory_role'
  ];
  if (allowedCols.includes(sortCol)) {
    query += ` ORDER BY e.${sortCol} ${sortDir}`;
  } else {
    query += ' ORDER BY e.employee_name ASC';
  }

  return db.prepare(query).all(...params);
}

// ── CRUD ──

export function getEmployee(id: number) {
  return db.prepare('SELECT e.*, s.shift_name, s.scheduled_in, s.scheduled_out, s.scheduled_lunch_start, s.scheduled_lunch_end, s.is_salary FROM employees e LEFT JOIN shifts s ON e.shift_id = s.id WHERE e.id = ?').get(id);
}

// Categorical string fields that must be trimmed on write so aggregation/filter
// groupings stay clean (e.g. "Asian" vs "Asian ").
const TRIM_ON_WRITE = new Set([
  'race', 'ethnicity', 'sex', 'country_of_origin', 'highest_education',
  'current_department', 'current_position',
]);

function normalizeEmployeeData(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...data };
  for (const k of Object.keys(out)) {
    if (TRIM_ON_WRITE.has(k) && typeof out[k] === 'string') {
      const trimmed = out[k].trim();
      out[k] = trimmed === '' ? null : trimmed;
    }
  }
  return out;
}

export function createEmployee(data: Record<string, any>) {
  // Filter out virtual/JOIN fields that don't exist on the employees table
  const virtualFields = ['shift_name', 'scheduled_in', 'scheduled_out', 'scheduled_lunch_start', 'scheduled_lunch_end', 'is_salary'];
  data = Object.fromEntries(Object.entries(data).filter(([k]) => !virtualFields.includes(k)));
  data = normalizeEmployeeData(data);

  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT INTO employees (${cols.join(', ')}) VALUES (${placeholders})`
  );
  const result = stmt.run(...cols.map(c => data[c]));
  return result.lastInsertRowid;
}

export function updateEmployee(id: number, data: Record<string, any>, changeSource: string = 'manual') {
  // Filter out virtual/JOIN fields that don't exist on the employees table
  const virtualFields = ['shift_name', 'scheduled_in', 'scheduled_out', 'scheduled_lunch_start', 'scheduled_lunch_end', 'is_salary'];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!virtualFields.includes(k)) filtered[k] = v;
  }
  data = normalizeEmployeeData(filtered);

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

  // Auto-log pay history when current_pay_rate changes
  if (old && data.current_pay_rate !== undefined) {
    const oldRate = old.current_pay_rate;
    const newRate = data.current_pay_rate;
    if (oldRate != newRate && (oldRate != null || newRate != null)) {
      const today = new Date().toISOString().slice(0, 10);
      const empName = data.employee_name || old.employee_name || '';
      const dept = data.current_department || old.current_department || null;
      const pos = data.current_position || old.current_position || null;
      const changeType = oldRate == null ? 'initial' : (newRate != null && oldRate != null && newRate > oldRate) ? 'raise' : (newRate != null && oldRate != null && newRate < oldRate) ? 'decrease' : 'change';
      addPayHistory({
        employee_id: id,
        pay_rate: newRate != null ? Number(newRate) : null,
        raise_date: data.date_last_raise || today,
        department: dept,
        position: pos,
        change_type: changeType,
        notes: oldRate != null ? `Previous rate: $${Number(oldRate).toFixed(2)}` : null,
      });
    }
  }

  // Auto-archive when date_of_separation is set
  if (data.date_of_separation && data.date_of_separation.trim() !== '') {
    const current = db.prepare('SELECT status FROM employees WHERE id = ?').get(id) as any;
    if (current && current.status !== 'archived') {
      archiveEmployee(id);
    }
  }

  // Auto-restore when date_of_separation is cleared on an archived employee
  if (data.date_of_separation !== undefined && (!data.date_of_separation || data.date_of_separation.trim() === '')) {
    const current = db.prepare('SELECT status FROM employees WHERE id = ?').get(id) as any;
    if (current && current.status === 'archived' && old && old.date_of_separation) {
      restoreEmployee(id);
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

// ── Shifts CRUD ──

export function getAllShifts() {
  return db.prepare('SELECT * FROM shifts ORDER BY shift_name').all();
}

export function getShift(id: number) {
  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
}

export function createShift(data: { shift_name: string; scheduled_in: string; scheduled_out: string; scheduled_lunch_start?: string | null; scheduled_lunch_end?: string | null; is_salary?: number }) {
  const result = db.prepare('INSERT INTO shifts (shift_name, scheduled_in, scheduled_out, scheduled_lunch_start, scheduled_lunch_end, is_salary) VALUES (?, ?, ?, ?, ?, ?)').run(
    data.shift_name, data.scheduled_in, data.scheduled_out, data.scheduled_lunch_start ?? null, data.scheduled_lunch_end ?? null, data.is_salary ?? 0
  );
  return result.lastInsertRowid;
}

export function updateShift(id: number, data: Record<string, any>) {
  const allowed = ['shift_name', 'scheduled_in', 'scheduled_out', 'scheduled_lunch_start', 'scheduled_lunch_end', 'is_salary'];
  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); values.push(data[key]); }
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE shifts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteShift(id: number): { success: boolean; error?: string } {
  const count = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE shift_id = ?').get(id) as any).c;
  if (count > 0) {
    return { success: false, error: `Cannot delete shift: ${count} employee(s) are still assigned to it.` };
  }
  db.prepare('DELETE FROM shifts WHERE id = ?').run(id);
  return { success: true };
}

// ── Salary Attendance Flags ──

export function getSalaryAttendanceFlags(employeeId: number, startDate: string, endDate: string) {
  return db.prepare(`
    SELECT * FROM salary_attendance_flags
    WHERE employee_id = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(employeeId, startDate, endDate);
}

export function setSalaryAttendanceFlag(employeeId: number, date: string, flagType: string, notes?: string) {
  db.prepare(`
    INSERT OR REPLACE INTO salary_attendance_flags (employee_id, date, flag_type, notes)
    VALUES (?, ?, ?, ?)
  `).run(employeeId, date, flagType, notes || null);
}

export function removeSalaryAttendanceFlag(employeeId: number, date: string, flagType: string) {
  db.prepare('DELETE FROM salary_attendance_flags WHERE employee_id = ? AND date = ? AND flag_type = ?').run(employeeId, date, flagType);
}

// ── Calendar Attendance Flags (auto-computed for hourly, manual for salary) ──

export function getCalendarAttendanceFlags(employeeId: number, startDate: string, endDate: string) {
  // Check if employee is on a salary shift
  const emp = db.prepare(`
    SELECT e.shift_id, COALESCE(s.is_salary, 0) as is_salary,
      s.scheduled_in, s.scheduled_out, s.scheduled_lunch_start, s.scheduled_lunch_end
    FROM employees e
    LEFT JOIN shifts s ON e.shift_id = s.id
    WHERE e.id = ?
  `).get(employeeId) as any;

  if (!emp) return [];

  if (emp.is_salary) {
    // Return manually-entered flags for salary employees
    return db.prepare(`
      SELECT date, flag_type FROM salary_attendance_flags
      WHERE employee_id = ? AND date >= ? AND date <= ?
      ORDER BY date
    `).all(employeeId, startDate, endDate);
  }

  // For hourly employees, compute flags from attendance_records vs shift schedule
  const flags: { date: string; flag_type: string }[] = [];

  // Tardiness: first punch_in > scheduled_in
  if (emp.scheduled_in) {
    const tardyDays = db.prepare(`
      SELECT date, MIN(punch_in) as first_in
      FROM attendance_records
      WHERE employee_id = ? AND date >= ? AND date <= ? AND punch_in IS NOT NULL
      GROUP BY date
      HAVING first_in > ?
    `).all(employeeId, startDate, endDate, emp.scheduled_in) as any[];
    for (const row of tardyDays) {
      flags.push({ date: row.date, flag_type: 'tardy' });
    }
  }

  // Left early: last punch_out < scheduled_out (non-overnight shifts)
  if (emp.scheduled_out && emp.scheduled_out >= emp.scheduled_in) {
    const earlyDays = db.prepare(`
      SELECT date, MAX(punch_out) as last_out
      FROM attendance_records
      WHERE employee_id = ? AND date >= ? AND date <= ? AND punch_out IS NOT NULL
      GROUP BY date
      HAVING last_out < ?
    `).all(employeeId, startDate, endDate, emp.scheduled_out) as any[];
    for (const row of earlyDays) {
      flags.push({ date: row.date, flag_type: 'left_early' });
    }
  }

  // Absent: workdays (Mon-Fri) with no attendance records
  const presentDays = db.prepare(`
    SELECT DISTINCT date FROM attendance_records
    WHERE employee_id = ? AND date >= ? AND date <= ?
  `).all(employeeId, startDate, endDate) as any[];
  const presentSet = new Set(presentDays.map((r: any) => r.date));

  // Also check for approved time-off
  const timeOffDays = db.prepare(`
    SELECT start_date, end_date FROM time_off_requests
    WHERE employee_id = ? AND status = 'approved'
      AND start_date <= ? AND end_date >= ?
  `).all(employeeId, endDate, startDate) as any[];
  const timeOffSet = new Set<string>();
  for (const req of timeOffDays) {
    const s = new Date(req.start_date + 'T00:00:00');
    const e = new Date(req.end_date + 'T00:00:00');
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      timeOffSet.add(d.toISOString().split('T')[0]);
    }
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // skip weekends
    const dateStr = d.toISOString().split('T')[0];
    if (!presentSet.has(dateStr) && !timeOffSet.has(dateStr)) {
      flags.push({ date: dateStr, flag_type: 'absent' });
    }
  }

  // Long lunch: lunch duration > scheduled lunch duration
  if (emp.scheduled_lunch_start && emp.scheduled_lunch_end) {
    const scheduledLunchMinutes =
      (parseInt(emp.scheduled_lunch_end.split(':')[0]) * 60 + parseInt(emp.scheduled_lunch_end.split(':')[1]))
      - (parseInt(emp.scheduled_lunch_start.split(':')[0]) * 60 + parseInt(emp.scheduled_lunch_start.split(':')[1]));

    if (scheduledLunchMinutes > 0) {
      const lunches = db.prepare(`
        SELECT
          out_rec.date,
          ROUND((
            (CAST(substr(in_rec.punch_in, 1, 2) AS REAL) * 60 + CAST(substr(in_rec.punch_in, 4, 2) AS REAL))
            - (CAST(substr(out_rec.punch_out, 1, 2) AS REAL) * 60 + CAST(substr(out_rec.punch_out, 4, 2) AS REAL))
          ), 0) as lunch_minutes
        FROM attendance_records out_rec
        JOIN attendance_records in_rec
          ON out_rec.employee_id = in_rec.employee_id
          AND out_rec.date = in_rec.date
          AND in_rec.punch_in > out_rec.punch_out
          AND in_rec.punch_in IS NOT NULL
        WHERE out_rec.employee_id = ? AND out_rec.date >= ? AND out_rec.date <= ?
          AND out_rec.punch_out IS NOT NULL
          AND out_rec.punch_in IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM attendance_records mid
            WHERE mid.employee_id = out_rec.employee_id
              AND mid.date = out_rec.date
              AND mid.punch_out IS NOT NULL
              AND mid.punch_out > out_rec.punch_out
              AND mid.punch_out < in_rec.punch_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM attendance_records mid2
            WHERE mid2.employee_id = out_rec.employee_id
              AND mid2.date = out_rec.date
              AND mid2.punch_in IS NOT NULL
              AND mid2.punch_in > out_rec.punch_out
              AND mid2.punch_in < in_rec.punch_in
          )
      `).all(employeeId, startDate, endDate) as any[];

      for (const row of lunches) {
        if (row.lunch_minutes > scheduledLunchMinutes) {
          flags.push({ date: row.date, flag_type: 'long_lunch' });
        }
      }
    }
  }

  return flags;
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
    `SELECT TRIM(race) as race, COUNT(*) as count
     FROM employees
     WHERE ${ACTIVE_FILTER} AND race IS NOT NULL AND TRIM(race) != ''
     GROUP BY TRIM(race)
     ORDER BY count DESC`
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
  // Split comma-separated department values and deduplicate
  const deptSet = new Set<string>();
  for (const r of rows) {
    const parts = r.current_department.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
    for (const p of parts) deptSet.add(p);
  }
  return Array.from(deptSet).sort((a, b) => a.localeCompare(b));
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

// ── Employee Files ──

export function addEmployeeFile(data: { employee_id: number; file_name: string; file_path: string; file_type?: string; file_size?: number; ocr_text?: string; notes?: string }) {
  const result = db.prepare(
    'INSERT INTO employee_files (employee_id, file_name, file_path, file_type, file_size, ocr_text, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(data.employee_id, data.file_name, data.file_path, data.file_type || null, data.file_size || null, data.ocr_text || null, data.notes || null);
  return db.prepare('SELECT * FROM employee_files WHERE id = ?').get(result.lastInsertRowid);
}

export function getEmployeeFiles(employeeId: number) {
  return db.prepare('SELECT * FROM employee_files WHERE employee_id = ? ORDER BY uploaded_at DESC').all(employeeId);
}

export function getEmployeeFile(id: number) {
  return db.prepare('SELECT * FROM employee_files WHERE id = ?').get(id) as any;
}

export function deleteEmployeeFile(id: number) {
  const file = db.prepare('SELECT * FROM employee_files WHERE id = ?').get(id) as any;
  if (file) {
    // Delete the actual file from disk
    try { fs.unlinkSync(file.file_path); } catch (_) {}
    // Delete the OCR text file if it exists
    const txtPath = file.file_path + '.txt';
    try { fs.unlinkSync(txtPath); } catch (_) {}
  }
  db.prepare('DELETE FROM employee_files WHERE id = ?').run(id);
}

// ── Saved Reports ──

export function getSavedReports(): { id: number; name: string; config: string }[] {
  return db.prepare('SELECT id, name, config FROM saved_reports ORDER BY name ASC').all() as any[];
}

export function upsertSavedReport(name: string, config: string): void {
  db.prepare(`
    INSERT INTO saved_reports (name, config, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET config = excluded.config, updated_at = datetime('now')
  `).run(name, config);
}

export function deleteSavedReport(name: string): void {
  db.prepare('DELETE FROM saved_reports WHERE name = ?').run(name);
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
): { imported: number; skipped: number } {
  const insertStmt = db.prepare(`
    INSERT INTO attendance_records (employee_id, employee_name_raw, date, punch_in, punch_out, reg_hours, ot_hours, work_code, code_name, site, missing_punch, import_batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const checkStmt = db.prepare(`
    SELECT id FROM attendance_records
    WHERE employee_name_raw = ? AND date = ? AND COALESCE(punch_in, '') = ? AND COALESCE(punch_out, '') = ?
    LIMIT 1
  `);

  let imported = 0;
  let skipped = 0;

  const insertAll = db.transaction(() => {
    for (const r of records) {
      // Check for duplicate
      const existing = checkStmt.get(r.employee_name_raw, r.date, r.punch_in || '', r.punch_out || '');
      if (existing) {
        skipped++;
        continue;
      }
      insertStmt.run(r.employee_id, r.employee_name_raw, r.date, r.punch_in, r.punch_out, r.reg_hours, r.ot_hours, r.work_code, r.code_name, r.site, r.missing_punch, batchId);
      imported++;
    }
  });
  insertAll();
  return { imported, skipped };
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
    WHERE (',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'
      AND ar.date >= ? AND ar.date <= ?
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
    query += ` JOIN employees e ON ar.employee_id = e.id WHERE (',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'`;
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

export function getOvertimeReport(startDate: string, endDate: string, groupBy: 'employee' | 'department' = 'employee', filters?: { employeeIds?: number[]; department?: string }) {
  const conditions = ['ar.date >= ?', 'ar.date <= ?'];
  const params: any[] = [startDate, endDate];
  if (filters?.employeeIds?.length) {
    conditions.push(`ar.employee_id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    params.push(...filters.employeeIds);
  }
  if (filters?.department) {
    conditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    params.push(filters.department);
  }
  const where = conditions.join(' AND ');

  if (groupBy === 'department') {
    return db.prepare(`
      SELECT e.current_department as name, SUM(ar.ot_hours) as total_ot, SUM(ar.reg_hours) as total_reg, COUNT(DISTINCT ar.employee_id) as employee_count
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ${where}
      GROUP BY e.current_department
      ORDER BY total_ot DESC
    `).all(...params);
  }
  return db.prepare(`
    SELECT ar.employee_id, e.employee_name as name, e.current_department, SUM(ar.ot_hours) as total_ot, SUM(ar.reg_hours) as total_reg, COUNT(DISTINCT ar.date) as days_worked
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ${where}
    GROUP BY ar.employee_id
    ORDER BY total_ot DESC
  `).all(...params);
}

export function getAbsenteeismReport(startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) {
  const empConditions = ["(e.status = 'active' OR e.status IS NULL)"];
  const params: any[] = [endDate, startDate, startDate, endDate];
  if (filters?.employeeIds?.length) {
    empConditions.push(`e.id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    params.push(...filters.employeeIds);
  }
  if (filters?.department) {
    empConditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    params.push(filters.department);
  }
  return db.prepare(`
    SELECT e.id, e.employee_name, e.current_department,
      COUNT(DISTINCT ar.date) as days_present,
      (julianday(?) - julianday(?) + 1) as total_days
    FROM employees e
    LEFT JOIN attendance_records ar ON e.id = ar.employee_id AND ar.date >= ? AND ar.date <= ?
    WHERE ${empConditions.join(' AND ')}
    GROUP BY e.id
    ORDER BY days_present ASC
  `).all(...params);
}

export function getTardinessReport(startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) {
  const innerConditions = ['date >= ?', 'date <= ?', 'punch_in IS NOT NULL'];
  const outerConditions = ["ar.first_punch_in > COALESCE(s.scheduled_in, '07:00')", 'COALESCE(s.is_salary, 0) = 0'];
  const innerParams: any[] = [startDate, endDate];
  const outerParams: any[] = [];
  if (filters?.employeeIds?.length) {
    innerConditions.push(`employee_id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    innerParams.push(...filters.employeeIds);
  }
  if (filters?.department) {
    outerConditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    outerParams.push(filters.department);
  }
  return db.prepare(`
    SELECT ar.employee_id, e.employee_name, e.current_department,
      s.shift_name, s.scheduled_in,
      COUNT(*) as late_count,
      COUNT(DISTINCT ar.date) as days_late
    FROM (
      SELECT employee_id, date, MIN(punch_in) as first_punch_in
      FROM attendance_records
      WHERE ${innerConditions.join(' AND ')}
      GROUP BY employee_id, date
    ) ar
    JOIN employees e ON ar.employee_id = e.id
    LEFT JOIN shifts s ON e.shift_id = s.id
    WHERE ${outerConditions.join(' AND ')}
    GROUP BY ar.employee_id
    ORDER BY late_count DESC
  `).all(...innerParams, ...outerParams);
}

export function getLeftEarlyReport(startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) {
  const innerConditions = ['date >= ?', 'date <= ?', 'punch_out IS NOT NULL'];
  const outerConditions = ['s.scheduled_out IS NOT NULL', 's.scheduled_out >= s.scheduled_in', 'ar.last_punch_out < s.scheduled_out', 'COALESCE(s.is_salary, 0) = 0'];
  const innerParams: any[] = [startDate, endDate];
  const outerParams: any[] = [];
  if (filters?.employeeIds?.length) {
    innerConditions.push(`employee_id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    innerParams.push(...filters.employeeIds);
  }
  if (filters?.department) {
    outerConditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    outerParams.push(filters.department);
  }
  return db.prepare(`
    SELECT ar.employee_id, e.employee_name, e.current_department,
      s.shift_name, s.scheduled_out,
      COUNT(*) as early_count,
      COUNT(DISTINCT ar.date) as days_early
    FROM (
      SELECT employee_id, date, MAX(punch_out) as last_punch_out
      FROM attendance_records
      WHERE ${innerConditions.join(' AND ')}
      GROUP BY employee_id, date
    ) ar
    JOIN employees e ON ar.employee_id = e.id
    LEFT JOIN shifts s ON e.shift_id = s.id
    WHERE ${outerConditions.join(' AND ')}
    GROUP BY ar.employee_id
    ORDER BY early_count DESC
  `).all(...innerParams, ...outerParams);
}

export function getLunchDurationReport(startDate: string, endDate: string, filters?: { employeeIds?: number[]; department?: string }) {
  const conditions = ['out_rec.date >= ?', 'out_rec.date <= ?', 'out_rec.punch_out IS NOT NULL', 'out_rec.punch_in IS NOT NULL', 'COALESCE(s.is_salary, 0) = 0'];
  const params: any[] = [startDate, endDate];
  if (filters?.employeeIds?.length) {
    conditions.push(`out_rec.employee_id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    params.push(...filters.employeeIds);
  }
  if (filters?.department) {
    conditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    params.push(filters.department);
  }
  return db.prepare(`
    SELECT
      out_rec.employee_id,
      e.employee_name,
      e.current_department,
      out_rec.date,
      out_rec.punch_out as lunch_start,
      in_rec.punch_in as lunch_end,
      ROUND((
        (CAST(substr(in_rec.punch_in, 1, 2) AS REAL) * 60 + CAST(substr(in_rec.punch_in, 4, 2) AS REAL))
        - (CAST(substr(out_rec.punch_out, 1, 2) AS REAL) * 60 + CAST(substr(out_rec.punch_out, 4, 2) AS REAL))
      ), 0) as lunch_minutes
    FROM attendance_records out_rec
    JOIN attendance_records in_rec
      ON out_rec.employee_id = in_rec.employee_id
      AND out_rec.date = in_rec.date
      AND in_rec.punch_in > out_rec.punch_out
      AND in_rec.punch_in IS NOT NULL
    JOIN employees e ON out_rec.employee_id = e.id
    LEFT JOIN shifts s ON e.shift_id = s.id
    WHERE ${conditions.join(' AND ')}
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records mid
        WHERE mid.employee_id = out_rec.employee_id
          AND mid.date = out_rec.date
          AND mid.punch_out IS NOT NULL
          AND mid.punch_out > out_rec.punch_out
          AND mid.punch_out < in_rec.punch_in
      )
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records mid2
        WHERE mid2.employee_id = out_rec.employee_id
          AND mid2.date = out_rec.date
          AND mid2.punch_in IS NOT NULL
          AND mid2.punch_in > out_rec.punch_out
          AND mid2.punch_in < in_rec.punch_in
      )
    ORDER BY out_rec.date, e.employee_name
  `).all(...params);
}

export function getTimeOffUsageReport(year: number, filters?: { employeeIds?: number[]; department?: string }) {
  const conditions = ['tob.year = ?'];
  const params: any[] = [year];
  if (filters?.employeeIds?.length) {
    conditions.push(`tob.employee_id IN (${filters.employeeIds.map(() => '?').join(',')})`);
    params.push(...filters.employeeIds);
  }
  if (filters?.department) {
    conditions.push("(',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'");
    params.push(filters.department);
  }
  return db.prepare(`
    SELECT e.employee_name, e.current_department, tob.request_type,
      tob.allocated_hours, tob.used_hours,
      (tob.allocated_hours - tob.used_hours) as remaining_hours
    FROM time_off_balances tob
    JOIN employees e ON tob.employee_id = e.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.employee_name, tob.request_type
  `).all(...params);
}

// ── FMLA ──

export function getFmlaConfig() {
  return db.prepare('SELECT * FROM fmla_config WHERE id = 1').get();
}

export function updateFmlaConfig(data: Record<string, any>) {
  const allowed = ['leave_year_method', 'fixed_year_start', 'eligibility_months', 'eligibility_hours'];
  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); values.push(data[key]); }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE fmla_config SET ${sets.join(', ')} WHERE id = 1`).run(...values);
}

export function checkFmlaEligibility(employeeId: number) {
  const config = db.prepare('SELECT * FROM fmla_config WHERE id = 1').get() as any;
  const emp = db.prepare('SELECT doh, employee_name FROM employees WHERE id = ?').get(employeeId) as any;
  if (!emp || !emp.doh) {
    return { eligible: false, employeeName: emp?.employee_name || '', monthsEmployed: 0, hoursWorked: 0, reasons: ['No date of hire on file'] };
  }

  // Calculate months employed
  const doh = new Date(emp.doh + 'T00:00:00');
  const now = new Date();
  const monthsEmployed = (now.getFullYear() - doh.getFullYear()) * 12 + (now.getMonth() - doh.getMonth());

  // Calculate hours worked in trailing 12 months
  const hoursRow = db.prepare(`
    SELECT COALESCE(SUM(reg_hours + ot_hours), 0) as total_hours
    FROM attendance_records
    WHERE employee_id = ? AND date >= date('now', '-12 months') AND date <= date('now')
  `).get(employeeId) as any;
  const hoursWorked = Math.round((hoursRow?.total_hours || 0) * 10) / 10;

  const reasons: string[] = [];
  const reqMonths = config?.eligibility_months || 12;
  const reqHours = config?.eligibility_hours || 1250;

  if (monthsEmployed < reqMonths) {
    reasons.push(`Employed ${monthsEmployed} months (need ${reqMonths})`);
  }
  if (hoursWorked < reqHours) {
    reasons.push(`${hoursWorked} hours worked in past 12 months (need ${reqHours})`);
  }

  return {
    eligible: reasons.length === 0,
    employeeName: emp.employee_name,
    monthsEmployed,
    hoursWorked,
    reasons,
  };
}

export function createFmlaCase(data: {
  employee_id: number;
  reason: string;
  family_member?: string;
  leave_type: string;
  start_date?: string;
  expected_end_date?: string;
  entitlement_hours?: number;
  notes?: string;
}) {
  const config = db.prepare('SELECT * FROM fmla_config WHERE id = 1').get() as any;

  // Calculate leave year start based on method
  let leaveYearStart: string;
  const method = config?.leave_year_method || 'rolling_backward';
  const today = new Date().toISOString().split('T')[0];

  if (method === 'calendar_year') {
    leaveYearStart = `${new Date().getFullYear()}-01-01`;
  } else if (method === 'fixed_year') {
    const [mm, dd] = (config?.fixed_year_start || '01-01').split('-');
    const yr = new Date().getFullYear();
    const fixed = `${yr}-${mm}-${dd}`;
    leaveYearStart = fixed <= today ? fixed : `${yr - 1}-${mm}-${dd}`;
  } else if (method === 'rolling_forward') {
    leaveYearStart = data.start_date || today;
  } else {
    // rolling_backward: 12 months back from today
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    leaveYearStart = d.toISOString().split('T')[0];
  }

  const result = db.prepare(`
    INSERT INTO fmla_cases (employee_id, reason, family_member, leave_type, start_date, expected_end_date,
      entitlement_hours, leave_year_start, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.employee_id, data.reason, data.family_member || null, data.leave_type,
    data.start_date || null, data.expected_end_date || null,
    data.entitlement_hours || (data.reason === 'military_caregiver' ? 1040 : 480),
    leaveYearStart, data.notes || null
  );
  return result.lastInsertRowid;
}

export function updateFmlaCase(id: number, data: Record<string, any>) {
  const allowed = ['reason', 'family_member', 'leave_type', 'status', 'start_date', 'expected_end_date',
    'actual_end_date', 'entitlement_hours', 'cert_status', 'cert_due_date', 'cert_received_date',
    'recert_due_date', 'fitness_for_duty', 'notes'];
  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); values.push(data[key]); }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE fmla_cases SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getFmlaCase(id: number) {
  return db.prepare(`
    SELECT fc.*, e.employee_name, e.current_department
    FROM fmla_cases fc
    JOIN employees e ON fc.employee_id = e.id
    WHERE fc.id = ?
  `).get(id);
}

export function getFmlaCases(filters: { employeeId?: number; status?: string; active?: boolean } = {}) {
  const conditions = ['1=1'];
  const params: any[] = [];
  if (filters.employeeId) {
    conditions.push('fc.employee_id = ?');
    params.push(filters.employeeId);
  }
  if (filters.status) {
    conditions.push('fc.status = ?');
    params.push(filters.status);
  }
  if (filters.active) {
    conditions.push("fc.status IN ('pending', 'approved')");
  }
  return db.prepare(`
    SELECT fc.*, e.employee_name, e.current_department
    FROM fmla_cases fc
    JOIN employees e ON fc.employee_id = e.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY fc.created_at DESC
  `).all(...params);
}

export function addFmlaEpisode(data: { fmla_case_id: number; date: string; hours_used: number; time_off_request_id?: number; notes?: string }) {
  db.prepare(`
    INSERT INTO fmla_episodes (fmla_case_id, date, hours_used, time_off_request_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.fmla_case_id, data.date, data.hours_used, data.time_off_request_id || null, data.notes || null);

  // Recalculate used_hours on the case
  const total = db.prepare('SELECT COALESCE(SUM(hours_used), 0) as total FROM fmla_episodes WHERE fmla_case_id = ?').get(data.fmla_case_id) as any;
  db.prepare("UPDATE fmla_cases SET used_hours = ?, updated_at = datetime('now') WHERE id = ?").run(total.total, data.fmla_case_id);

  // Auto-exhaust if at entitlement
  const fmlaCase = db.prepare('SELECT entitlement_hours, status FROM fmla_cases WHERE id = ?').get(data.fmla_case_id) as any;
  if (fmlaCase && total.total >= fmlaCase.entitlement_hours && (fmlaCase.status === 'approved' || fmlaCase.status === 'active')) {
    db.prepare("UPDATE fmla_cases SET status = 'exhausted', updated_at = datetime('now') WHERE id = ?").run(data.fmla_case_id);
  }
}

export function addFmlaEpisodeBulk(data: { fmla_case_id: number; start_date: string; end_date: string; hours_per_day: number; skip_weekends: boolean; notes?: string }) {
  const start = new Date(data.start_date + 'T00:00:00');
  const end = new Date(data.end_date + 'T00:00:00');
  const insert = db.prepare(`INSERT INTO fmla_episodes (fmla_case_id, date, hours_used, notes) VALUES (?, ?, ?, ?)`);
  let count = 0;
  const txn = db.transaction(() => {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (data.skip_weekends && (dow === 0 || dow === 6)) continue;
      const dateStr = d.toISOString().slice(0, 10);
      insert.run(data.fmla_case_id, dateStr, data.hours_per_day, data.notes || null);
      count++;
    }
    // Recalculate used_hours
    const total = db.prepare('SELECT COALESCE(SUM(hours_used), 0) as total FROM fmla_episodes WHERE fmla_case_id = ?').get(data.fmla_case_id) as any;
    db.prepare("UPDATE fmla_cases SET used_hours = ?, updated_at = datetime('now') WHERE id = ?").run(total.total, data.fmla_case_id);
    // Auto-exhaust
    const fmlaCase = db.prepare('SELECT entitlement_hours, status FROM fmla_cases WHERE id = ?').get(data.fmla_case_id) as any;
    if (fmlaCase && total.total >= fmlaCase.entitlement_hours && (fmlaCase.status === 'approved' || fmlaCase.status === 'active')) {
      db.prepare("UPDATE fmla_cases SET status = 'exhausted', updated_at = datetime('now') WHERE id = ?").run(data.fmla_case_id);
    }
  });
  txn();
  return count;
}

export function deleteFmlaEpisode(id: number) {
  const ep = db.prepare('SELECT fmla_case_id FROM fmla_episodes WHERE id = ?').get(id) as any;
  db.prepare('DELETE FROM fmla_episodes WHERE id = ?').run(id);
  if (ep) {
    const total = db.prepare('SELECT COALESCE(SUM(hours_used), 0) as total FROM fmla_episodes WHERE fmla_case_id = ?').get(ep.fmla_case_id) as any;
    db.prepare("UPDATE fmla_cases SET used_hours = ?, updated_at = datetime('now') WHERE id = ?").run(total.total, ep.fmla_case_id);
  }
}

export function getFmlaEpisodes(caseId: number) {
  return db.prepare(`
    SELECT fe.*, tor.request_type as linked_request_type, tor.start_date as linked_start, tor.end_date as linked_end
    FROM fmla_episodes fe
    LEFT JOIN time_off_requests tor ON fe.time_off_request_id = tor.id
    WHERE fe.fmla_case_id = ?
    ORDER BY fe.date DESC
  `).all(caseId);
}

export function getFmlaAlerts() {
  const alerts: { type: string; severity: 'warning' | 'danger' | 'info'; message: string; case_id: number; employee_name: string }[] = [];

  // Approaching exhaustion (>80% used)
  const approaching = db.prepare(`
    SELECT fc.id, fc.used_hours, fc.entitlement_hours, e.employee_name
    FROM fmla_cases fc JOIN employees e ON fc.employee_id = e.id
    WHERE fc.status = 'approved' AND fc.used_hours >= fc.entitlement_hours * 0.8
  `).all() as any[];
  for (const c of approaching) {
    const pct = Math.round((c.used_hours / c.entitlement_hours) * 100);
    alerts.push({
      type: 'exhaustion',
      severity: pct >= 100 ? 'danger' : 'warning',
      message: `${c.employee_name}: ${pct}% of FMLA entitlement used (${c.used_hours}/${c.entitlement_hours} hrs)`,
      case_id: c.id,
      employee_name: c.employee_name,
    });
  }

  // Certification due within 15 days
  const certDue = db.prepare(`
    SELECT fc.id, fc.cert_due_date, e.employee_name
    FROM fmla_cases fc JOIN employees e ON fc.employee_id = e.id
    WHERE fc.status IN ('pending', 'approved') AND fc.cert_status = 'requested'
      AND fc.cert_due_date IS NOT NULL AND fc.cert_due_date <= date('now', '+15 days')
  `).all() as any[];
  for (const c of certDue) {
    const isOverdue = c.cert_due_date < new Date().toISOString().split('T')[0];
    alerts.push({
      type: 'certification',
      severity: isOverdue ? 'danger' : 'warning',
      message: `${c.employee_name}: Certification ${isOverdue ? 'overdue' : 'due'} ${c.cert_due_date}`,
      case_id: c.id,
      employee_name: c.employee_name,
    });
  }

  // Recertification due within 15 days
  const recertDue = db.prepare(`
    SELECT fc.id, fc.recert_due_date, e.employee_name
    FROM fmla_cases fc JOIN employees e ON fc.employee_id = e.id
    WHERE fc.status = 'approved' AND fc.cert_status = 'received'
      AND fc.recert_due_date IS NOT NULL AND fc.recert_due_date <= date('now', '+15 days')
  `).all() as any[];
  for (const c of recertDue) {
    alerts.push({
      type: 'recertification',
      severity: 'warning',
      message: `${c.employee_name}: Recertification due ${c.recert_due_date}`,
      case_id: c.id,
      employee_name: c.employee_name,
    });
  }

  // Pending designation (cases still pending for >5 days)
  const pendingLong = db.prepare(`
    SELECT fc.id, fc.created_at, e.employee_name
    FROM fmla_cases fc JOIN employees e ON fc.employee_id = e.id
    WHERE fc.status = 'pending' AND fc.created_at <= datetime('now', '-5 days')
  `).all() as any[];
  for (const c of pendingLong) {
    alerts.push({
      type: 'designation',
      severity: 'warning',
      message: `${c.employee_name}: FMLA designation pending since ${c.created_at.split(' ')[0]}`,
      case_id: c.id,
      employee_name: c.employee_name,
    });
  }

  return alerts;
}

// ── Disciplinary Actions ──

export function getDisciplinaryActions(employeeId: number) {
  return db.prepare(
    'SELECT * FROM disciplinary_actions WHERE employee_id = ? ORDER BY date DESC, created_at DESC'
  ).all(employeeId);
}

export function getAllDisciplinaryActions(filters?: { type?: string; status?: string; department?: string; startDate?: string; endDate?: string }) {
  let query = `SELECT d.*, e.employee_name, e.current_department, e.current_position
    FROM disciplinary_actions d
    JOIN employees e ON d.employee_id = e.id
    WHERE 1=1`;
  const params: any[] = [];
  if (filters?.type) { query += ' AND d.type = ?'; params.push(filters.type); }
  if (filters?.status) { query += ' AND d.status = ?'; params.push(filters.status); }
  if (filters?.department) {
    query += ` AND (',' || REPLACE(e.current_department, ' ', '') || ',') LIKE '%,' || REPLACE(?, ' ', '') || ',%'`;
    params.push(filters.department);
  }
  if (filters?.startDate) { query += ' AND d.date >= ?'; params.push(filters.startDate); }
  if (filters?.endDate) { query += ' AND d.date <= ?'; params.push(filters.endDate); }
  query += ' ORDER BY d.date DESC, d.created_at DESC';
  return db.prepare(query).all(...params);
}

export function getDisciplinaryAction(id: number) {
  return db.prepare(
    `SELECT d.*, e.employee_name, e.current_department
     FROM disciplinary_actions d JOIN employees e ON d.employee_id = e.id
     WHERE d.id = ?`
  ).get(id);
}

export function createDisciplinaryAction(data: {
  employee_id: number;
  type: string;
  date: string;
  description?: string | null;
  outcome?: string | null;
  issued_by?: string | null;
  follow_up_date?: string | null;
  status?: string;
}) {
  const result = db.prepare(`
    INSERT INTO disciplinary_actions (employee_id, type, date, description, outcome, issued_by, follow_up_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.employee_id, data.type, data.date,
    data.description || null, data.outcome || null, data.issued_by || null,
    data.follow_up_date || null, data.status || 'open'
  );
  return result.lastInsertRowid;
}

export function updateDisciplinaryAction(id: number, data: Record<string, any>) {
  const allowed = ['type', 'date', 'description', 'outcome', 'issued_by', 'follow_up_date', 'status'];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return;
  const sets = Object.keys(filtered).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE disciplinary_actions SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(filtered), id);
}

export function deleteDisciplinaryAction(id: number) {
  db.prepare('DELETE FROM disciplinary_actions WHERE id = ?').run(id);
}

export function getDisciplinaryStats() {
  const open = db.prepare(`SELECT COUNT(*) as count FROM disciplinary_actions WHERE status = 'open'`).get() as any;
  const escalated = db.prepare(`SELECT COUNT(*) as count FROM disciplinary_actions WHERE status = 'escalated'`).get() as any;
  return { open: open.count, escalated: escalated.count };
}

// ── Benefit Plans ──

export function getBenefitPlans(activeOnly?: boolean) {
  if (activeOnly) {
    return db.prepare('SELECT * FROM benefit_plans WHERE active = 1 ORDER BY plan_type, plan_name').all();
  }
  return db.prepare('SELECT * FROM benefit_plans ORDER BY plan_type, plan_name').all();
}

export function createBenefitPlan(data: {
  plan_name: string;
  plan_type: string;
  provider?: string | null;
  plan_number?: string | null;
  description?: string | null;
}) {
  const result = db.prepare(`
    INSERT INTO benefit_plans (plan_name, plan_type, provider, plan_number, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.plan_name, data.plan_type, data.provider || null, data.plan_number || null, data.description || null);
  return result.lastInsertRowid;
}

export function updateBenefitPlan(id: number, data: Record<string, any>) {
  const allowed = ['plan_name', 'plan_type', 'provider', 'plan_number', 'description', 'active'];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return;
  const sets = Object.keys(filtered).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE benefit_plans SET ${sets} WHERE id = ?`).run(...Object.values(filtered), id);
}

export function deleteBenefitPlan(id: number) {
  db.prepare('DELETE FROM benefit_enrollments WHERE plan_id = ?').run(id);
  db.prepare('DELETE FROM benefit_plans WHERE id = ?').run(id);
}

// ── Benefit Enrollments ──

export function getEnrollments(employeeId: number) {
  return db.prepare(`
    SELECT be.*, bp.plan_name, bp.plan_type, bp.provider
    FROM benefit_enrollments be
    JOIN benefit_plans bp ON be.plan_id = bp.id
    WHERE be.employee_id = ?
    ORDER BY be.status ASC, be.enrollment_date DESC
  `).all(employeeId);
}

export function getAllEnrollments(filters?: { planType?: string; status?: string }) {
  let query = `SELECT be.*, bp.plan_name, bp.plan_type, bp.provider, e.employee_name, e.current_department
    FROM benefit_enrollments be
    JOIN benefit_plans bp ON be.plan_id = bp.id
    JOIN employees e ON be.employee_id = e.id
    WHERE 1=1`;
  const params: any[] = [];
  if (filters?.planType) { query += ' AND bp.plan_type = ?'; params.push(filters.planType); }
  if (filters?.status) { query += ' AND be.status = ?'; params.push(filters.status); }
  query += ' ORDER BY e.employee_name, bp.plan_type';
  return db.prepare(query).all(...params);
}

export function createEnrollment(data: {
  employee_id: number;
  plan_id: number;
  enrollment_date: string;
  termination_date?: string | null;
  coverage_level?: string | null;
  employee_contribution?: number;
  employer_contribution?: number;
  status?: string;
}) {
  const result = db.prepare(`
    INSERT INTO benefit_enrollments (employee_id, plan_id, enrollment_date, termination_date, coverage_level, employee_contribution, employer_contribution, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.employee_id, data.plan_id, data.enrollment_date,
    data.termination_date || null, data.coverage_level || null,
    data.employee_contribution ?? 0, data.employer_contribution ?? 0,
    data.status || 'active'
  );
  return result.lastInsertRowid;
}

export function updateEnrollment(id: number, data: Record<string, any>) {
  const allowed = ['plan_id', 'enrollment_date', 'termination_date', 'coverage_level', 'employee_contribution', 'employer_contribution', 'status'];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return;
  const sets = Object.keys(filtered).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE benefit_enrollments SET ${sets} WHERE id = ?`).run(...Object.values(filtered), id);
}

export function deleteEnrollment(id: number) {
  db.prepare('DELETE FROM benefit_enrollments WHERE id = ?').run(id);
}

// ── Dependents ──

export function getDependents(employeeId: number) {
  return db.prepare('SELECT * FROM dependents WHERE employee_id = ? ORDER BY name').all(employeeId);
}

export function createDependent(data: {
  employee_id: number;
  name: string;
  relationship?: string | null;
  date_of_birth?: string | null;
  covered_plan_ids?: string | null;
}) {
  const result = db.prepare(`
    INSERT INTO dependents (employee_id, name, relationship, date_of_birth, covered_plan_ids)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.employee_id, data.name, data.relationship || null, data.date_of_birth || null, data.covered_plan_ids || null);
  return result.lastInsertRowid;
}

export function updateDependent(id: number, data: Record<string, any>) {
  const allowed = ['name', 'relationship', 'date_of_birth', 'covered_plan_ids'];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return;
  const sets = Object.keys(filtered).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE dependents SET ${sets} WHERE id = ?`).run(...Object.values(filtered), id);
}

export function deleteDependent(id: number) {
  db.prepare('DELETE FROM dependents WHERE id = ?').run(id);
}

// ── Benefits Stats ──

export function getBenefitsStats() {
  const byType = db.prepare(`
    SELECT bp.plan_type, COUNT(be.id) as enrolled, SUM(be.employee_contribution) as total_employee_cost, SUM(be.employer_contribution) as total_employer_cost
    FROM benefit_plans bp
    LEFT JOIN benefit_enrollments be ON bp.id = be.plan_id AND be.status = 'active'
    WHERE bp.active = 1
    GROUP BY bp.plan_type
    ORDER BY bp.plan_type
  `).all();
  const totalEnrolled = db.prepare(`SELECT COUNT(*) as count FROM benefit_enrollments WHERE status = 'active'`).get() as any;
  return { byType, totalEnrolled: totalEnrolled.count };
}
