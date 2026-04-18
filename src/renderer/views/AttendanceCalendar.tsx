import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import AttendanceDayDetail from '../components/AttendanceDayDetail';
import AttendanceImportDialog from '../components/AttendanceImportDialog';
import ComboSelect from '../components/ComboSelect';
import type { AttendanceRecord, AttendanceSummary, ParsedAttendanceResult, AttendanceImportBatch, TimeOffRequest } from '../types/attendance';
import type { Shift } from '../types/employee';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SALARY_FLAG_TYPES = [
  { key: 'tardy', label: 'Tardy' },
  { key: 'absent', label: 'Absent' },
  { key: 'left_early', label: 'Left Early' },
  { key: 'partial_absence', label: 'Partial Absence' },
];

export default function AttendanceCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [department, setDepartment] = useState<string>('');
  const [employees, setEmployees] = useState<{ id: number; employee_name: string; shift_id?: number | null }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedAttendanceResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imports, setImports] = useState<AttendanceImportBatch[]>([]);
  const [showImports, setShowImports] = useState(false);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Attendance flags state
  const [attendanceFlags, setAttendanceFlags] = useState<{ date: string; flag_type: string }[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isSalaryEmployee, setIsSalaryEmployee] = useState(false);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load employees, departments, and shifts
  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name, shift_id: e.shift_id })));
    });
    api.getDepartments().then(setDepartments);
    api.getAllShifts().then(setShifts);
  }, []);

  // Load imports list
  useEffect(() => {
    api.getAttendanceImports().then(setImports);
  }, [reloadKey]);

  // Compute date range for current month
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  // Determine if selected employee is on a salary shift
  useEffect(() => {
    if (employeeId) {
      const emp = employees.find(e => e.id === employeeId);
      const shift = emp?.shift_id ? shifts.find(s => s.id === emp.shift_id) : null;
      setIsSalaryEmployee(!!shift?.is_salary);
    } else {
      setIsSalaryEmployee(false);
    }
  }, [employeeId, employees, shifts]);

  // Load attendance data
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        let data: AttendanceRecord[];
        if (employeeId) {
          data = await api.getAttendance(employeeId, startDate, endDate);
        } else if (department) {
          data = await api.getAttendanceByDept(department, startDate, endDate);
        } else {
          data = await api.getAllAttendance(startDate, endDate);
        }
        setRecords(data);

        const summaryData = await api.getAttendanceSummary({
          employeeId: employeeId || undefined,
          department: department || undefined,
          startDate,
          endDate,
        });
        setSummary(summaryData);

        // Fetch approved time-off requests for this date range
        const timeOff = await api.getTimeOffRequests({
          status: 'approved',
          startDate,
          endDate,
          ...(employeeId ? { employeeId } : {}),
        });
        setTimeOffRequests(timeOff);

        // Fetch attendance flags if a single employee is selected
        if (employeeId) {
          const flags = await api.getCalendarAttendanceFlags(employeeId, startDate, endDate);
          setAttendanceFlags(flags);
        } else {
          setAttendanceFlags([]);
        }
      } catch (err) {
        console.error('Failed to load attendance:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [year, month, employeeId, department, employees.length, reloadKey]);

  // Build day data map for calendar
  const dayDataMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const record of records) {
      const existing = map.get(record.date);
      if (existing) {
        existing.reg_hours += record.reg_hours || 0;
        existing.ot_hours += record.ot_hours || 0;
        if (record.missing_punch) existing.missing_punch = true;
        if (!existing.punch_in && record.punch_in) existing.punch_in = record.punch_in;
        if (record.punch_out) existing.punch_out = record.punch_out;
        existing.records.push(record);
      } else {
        map.set(record.date, {
          present: true,
          punch_in: record.punch_in,
          punch_out: record.punch_out,
          reg_hours: record.reg_hours || 0,
          ot_hours: record.ot_hours || 0,
          missing_punch: record.missing_punch === 1,
          has_time_off: false,
          time_off_type: null,
          time_off_entries: [],
          records: [record],
          flags: [],
        });
      }
    }

    // Overlay approved time-off requests
    for (const req of timeOffRequests) {
      const entry = {
        employee_name: req.employee_name,
        employee_id: req.employee_id,
        request_type: req.request_type,
        department: req.current_department,
      };
      const start = new Date(req.start_date + 'T00:00:00');
      const end = new Date(req.end_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const existing = map.get(dateStr);
        if (existing) {
          existing.has_time_off = true;
          existing.time_off_type = req.request_type;
          existing.time_off_entries = existing.time_off_entries || [];
          existing.time_off_entries.push(entry);
        } else {
          map.set(dateStr, {
            present: false,
            punch_in: null,
            punch_out: null,
            reg_hours: 0,
            ot_hours: 0,
            missing_punch: false,
            has_time_off: true,
            time_off_type: req.request_type,
            time_off_entries: [entry],
            records: [],
            flags: [],
          });
        }
      }
    }

    // Merge attendance flags into day data
    if (employeeId && attendanceFlags.length > 0) {
      const flagsByDate = new Map<string, string[]>();
      for (const f of attendanceFlags) {
        const arr = flagsByDate.get(f.date) || [];
        arr.push(f.flag_type);
        flagsByDate.set(f.date, arr);
      }
      for (const [date, flags] of flagsByDate) {
        const existing = map.get(date);
        if (existing) {
          existing.flags = flags;
        } else {
          map.set(date, {
            present: false,
            punch_in: null,
            punch_out: null,
            reg_hours: 0,
            ot_hours: 0,
            missing_punch: false,
            has_time_off: false,
            time_off_type: null,
            time_off_entries: [],
            records: [],
            flags,
          });
        }
      }
    }

    return map;
  }, [records, timeOffRequests, attendanceFlags, employeeId]);

  // Get records for selected date
  const selectedRecords = selectedDate
    ? records.filter(r => r.date === selectedDate)
    : [];

  // Get flags for selected date
  const selectedFlags = selectedDate
    ? (dayDataMap.get(selectedDate)?.flags || [])
    : [];

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const handleImport = async () => {
    const result = await api.parseAttendance();
    if (!result) return;
    setParseResult(result);
    setShowImportDialog(true);
  };

  const handleImportClose = () => {
    setShowImportDialog(false);
    setParseResult(null);
  };

  const handleImported = () => {
    setReloadKey(k => k + 1);
  };

  const handleDeleteRecord = async (id: number) => {
    await api.deleteAttendanceRecord(id);
    setReloadKey(k => k + 1);
  };

  const handleDeleteRecords = async (ids: number[]) => {
    await api.deleteAttendanceRecords(ids);
    setReloadKey(k => k + 1);
  };

  const handleDeleteBatch = async (batchId: string) => {
    setDeletingBatch(true);
    try {
      await api.deleteAttendanceBatch(batchId);
      setConfirmDeleteBatch(null);
      setReloadKey(k => k + 1);
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleToggleSalaryFlag = async (flagType: string) => {
    if (!employeeId || !selectedDate) return;
    const hasFlag = selectedFlags.includes(flagType);
    if (hasFlag) {
      await api.removeSalaryAttendanceFlag(employeeId, selectedDate, flagType);
    } else {
      await api.setSalaryAttendanceFlag(employeeId, selectedDate, flagType);
    }
    setReloadKey(k => k + 1);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Attendance calendar</h1>
          <p className="page-subtitle">Track employee attendance from CompuTime101 imports</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div className="hstack">
            <button onClick={() => setShowImports(!showImports)} className="btn">Manage imports</button>
            <button onClick={handleImport} className="btn primary">Import attendance</button>
          </div>
          <span className="small muted">Expects WorkCodeDetail.xls from CompuTime101</span>
        </div>
      </div>

      {/* Manage Imports Panel */}
      {showImports && (
        <div className="section-card" style={{ marginBottom: 18 }}>
          <div className="section-head">
            <h3 className="section-title">Import batches</h3>
            <button onClick={() => setShowImports(false)} className="icon-btn" aria-label="Close">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="section-body">
            {imports.length === 0 ? (
              <p className="muted small">No import batches found.</p>
            ) : (
              <div className="vstack" style={{ gap: 8 }}>
                {imports.map((imp: any) => (
                  <div key={imp.import_batch_id} className="flex-between" style={{
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{imp.record_count} records</div>
                      <div className="small muted">
                        {imp.start_date} to {imp.end_date} · Imported {new Date(imp.imported_at).toLocaleDateString()}
                      </div>
                    </div>
                    {confirmDeleteBatch === imp.import_batch_id ? (
                      <div className="hstack" style={{ gap: 8 }}>
                        <span className="small" style={{ color: 'var(--danger)' }}>Delete {imp.record_count} records?</span>
                        <button
                          onClick={() => handleDeleteBatch(imp.import_batch_id)}
                          disabled={deletingBatch}
                          className="btn"
                          style={{ background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }}
                        >
                          {deletingBatch ? 'Deleting…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmDeleteBatch(null)} className="btn">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteBatch(imp.import_batch_id)}
                        className="icon-btn"
                        title="Delete this import batch"
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="grid-3">
          <div style={{ position: 'relative' }} ref={searchRef}>
            <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Search employee</label>
            <div className="input" style={{ position: 'relative' }}>
              <input
                type="text"
                value={employeeSearch}
                onChange={e => {
                  setEmployeeSearch(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => { if (employeeSearch.length > 0) setShowSearchResults(true); }}
                placeholder="Type to search employees…"
              />
              {employeeSearch && (
                <button
                  onClick={() => {
                    setEmployeeSearch('');
                    setEmployeeId(null);
                    setShowSearchResults(false);
                  }}
                  className="muted"
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  aria-label="Clear"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {showSearchResults && employeeSearch.length > 0 && (() => {
              const query = employeeSearch.toLowerCase();
              const filtered = employees.filter(e => e.employee_name.toLowerCase().includes(query)).slice(0, 10);
              return filtered.length > 0 ? (
                <div className="card" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 240, overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                  {filtered.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setEmployeeId(emp.id);
                        setEmployeeSearch(emp.employee_name);
                        setDepartment('');
                        setShowSearchResults(false);
                      }}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {emp.employee_name}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <label className="field">
            <span className="field-label">Employee</span>
            <ComboSelect
              value={employeeId ? String(employeeId) : ''}
              options={employees.map(emp => ({ value: String(emp.id), label: emp.employee_name }))}
              onChange={v => { setEmployeeId(v ? Number(v) : null); setDepartment(''); }}
              includeNone={true}
              noneLabel="All employees"
            />
          </label>

          <label className="field">
            <span className="field-label">Department</span>
            <ComboSelect
              value={department}
              options={departments}
              onChange={v => { setDepartment(v); setEmployeeId(null); setEmployeeSearch(''); }}
              includeNone={true}
              noneLabel="All departments"
            />
          </label>
        </div>
      </div>

      {/* Salary Employee Notice */}
      {isSalaryEmployee && (
        <div className="banner" style={{ marginBottom: 18 }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>
            This is a salaried employee. Click a day to manually mark attendance flags (tardy, absent, left early, partial absence).
          </span>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="stat-grid" style={{ marginBottom: 18 }}>
          <div className="stat">
            <div className="stat-label">Days present</div>
            <div className="stat-value">{summary.days_present || 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Regular hours</div>
            <div className="stat-value">{(summary.total_reg_hours || 0).toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Overtime hours</div>
            <div className="stat-value">{(summary.total_ot_hours || 0).toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Missing punches</div>
            <div className="stat-value">{summary.missing_punches || 0}</div>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <button onClick={handlePrevMonth} className="icon-btn" aria-label="Previous month">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={handleNextMonth} className="icon-btn" aria-label="Next month">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="hstack small muted" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="hstack" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--success)' }} /> Present</span>
        <span className="hstack" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--warn)' }} /> Missing punch</span>
        <span className="hstack" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--info)' }} /> Time off</span>
        {employeeId && (
          <>
            <span className="hstack" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--danger)' }} /> Absent</span>
            <span className="hstack" style={{ gap: 6 }}><span className="badge warn" style={{ padding: '0 5px', fontSize: 10 }}>T</span> Tardy</span>
            <span className="hstack" style={{ gap: 6 }}><span className="badge warn" style={{ padding: '0 5px', fontSize: 10 }}>E</span> Left early</span>
            <span className="hstack" style={{ gap: 6 }}><span className="badge accent" style={{ padding: '0 5px', fontSize: 10 }}>L</span> Long lunch</span>
          </>
        )}
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Loading attendance data…</div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div>
            <CalendarGrid
              year={year}
              month={month}
              dayDataMap={dayDataMap}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              showFlags={!!employeeId}
            />
          </div>
          <div>
            {selectedDate ? (
              <div className="vstack" style={{ gap: 14 }}>
                <AttendanceDayDetail
                  date={selectedDate}
                  records={selectedRecords}
                  timeOffEntries={dayDataMap.get(selectedDate)?.time_off_entries || []}
                  onClose={() => setSelectedDate(null)}
                  onDeleteRecord={handleDeleteRecord}
                  onDeleteRecords={handleDeleteRecords}
                />

                {isSalaryEmployee && employeeId && (
                  <div className="section-card">
                    <div className="section-head"><h3 className="section-title">Attendance flags</h3></div>
                    <div className="section-body">
                      <p className="small muted" style={{ marginTop: 0, marginBottom: 10 }}>Toggle flags for this day:</p>
                      <div className="vstack" style={{ gap: 6 }}>
                        {SALARY_FLAG_TYPES.map(ft => {
                          const isActive = selectedFlags.includes(ft.key);
                          return (
                            <button
                              key={ft.key}
                              onClick={() => handleToggleSalaryFlag(ft.key)}
                              className="chip"
                              aria-pressed={isActive}
                              style={{
                                justifyContent: 'flex-start',
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <span style={{
                                width: 16, height: 16, borderRadius: 4,
                                border: '1.5px solid ' + (isActive ? 'var(--danger)' : 'var(--line-strong)'),
                                background: isActive ? 'var(--danger)' : 'transparent',
                                color: 'white',
                                display: 'grid', placeItems: 'center',
                                fontSize: 10,
                              }}>
                                {isActive && '✓'}
                              </span>
                              {ft.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {!isSalaryEmployee && employeeId && selectedFlags.length > 0 && (
                  <div className="section-card">
                    <div className="section-head"><h3 className="section-title">Attendance flags</h3></div>
                    <div className="section-body">
                      <div className="vstack" style={{ gap: 6 }}>
                        {selectedFlags.map((flag: string) => {
                          const labels: Record<string, string> = {
                            tardy: 'Tardy',
                            absent: 'Absent',
                            left_early: 'Left Early',
                            long_lunch: 'Long Lunch',
                          };
                          return <span key={flag} className="badge warn">{labels[flag] || flag}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <p className="muted small" style={{ margin: 0 }}>Click a day to view punch details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && parseResult && (
        <AttendanceImportDialog
          parseResult={parseResult}
          employees={employees}
          onClose={handleImportClose}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
