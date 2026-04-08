import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import AttendanceDayDetail from '../components/AttendanceDayDetail';
import AttendanceImportDialog from '../components/AttendanceImportDialog';
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track employee attendance from CompuTime101 imports</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImports(!showImports)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Manage Imports
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Import Attendance
            </button>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">Expects WorkCodeDetail.xls from CompuTime101</span>
        </div>
      </div>

      {/* Manage Imports Panel */}
      {showImports && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import Batches</h3>
            <button onClick={() => setShowImports(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {imports.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No import batches found.</p>
          ) : (
            <div className="space-y-2">
              {imports.map((imp: any) => (
                <div key={imp.import_batch_id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {imp.record_count} records
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {imp.start_date} to {imp.end_date} &middot; Imported {new Date(imp.imported_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    {confirmDeleteBatch === imp.import_batch_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 dark:text-red-400">Delete {imp.record_count} records?</span>
                        <button
                          onClick={() => handleDeleteBatch(imp.import_batch_id)}
                          disabled={deletingBatch}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                        >
                          {deletingBatch ? 'Deleting...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteBatch(null)}
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteBatch(imp.import_batch_id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete this import batch"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee Search Bar */}
      <div className="relative" ref={searchRef}>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search Employee</label>
        <div className="relative">
          <input
            type="text"
            value={employeeSearch}
            onChange={e => {
              setEmployeeSearch(e.target.value);
              setShowSearchResults(e.target.value.length > 0);
            }}
            onFocus={() => { if (employeeSearch.length > 0) setShowSearchResults(true); }}
            placeholder="Type to search employees..."
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 pr-8"
          />
          {employeeSearch && (
            <button
              onClick={() => {
                setEmployeeSearch('');
                setEmployeeId(null);
                setShowSearchResults(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {showSearchResults && employeeSearch.length > 0 && (() => {
          const query = employeeSearch.toLowerCase();
          const filtered = employees.filter(e => e.employee_name.toLowerCase().includes(query)).slice(0, 10);
          return filtered.length > 0 ? (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filtered.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setEmployeeId(emp.id);
                    setEmployeeSearch(emp.employee_name);
                    setDepartment('');
                    setShowSearchResults(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {emp.employee_name}
                </button>
              ))}
            </div>
          ) : null;
        })()}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Employee</label>
          <select
            value={employeeId || ''}
            onChange={e => { setEmployeeId(e.target.value ? Number(e.target.value) : null); setDepartment(''); }}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.employee_name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
          <select
            value={department}
            onChange={e => { setDepartment(e.target.value); setEmployeeId(null); setEmployeeSearch(''); }}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Salary Employee Notice */}
      {isSalaryEmployee && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm text-amber-800 dark:text-amber-200">
            This is a salaried employee. Click a day to manually mark attendance flags (tardy, absent, left early, partial absence).
          </span>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.days_present || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Days Present</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(summary.total_reg_hours || 0).toFixed(1)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Regular Hours</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(summary.total_ot_hours || 0).toFixed(1)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Overtime Hours</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.missing_punches || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Missing Punches</div>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Missing Punch</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Time Off</div>
        {employeeId && (
          <>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-bold px-1 rounded text-amber-600 bg-amber-50">T</span> Tardy</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-bold px-1 rounded text-orange-600 bg-orange-50">E</span> Left Early</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-bold px-1 rounded text-purple-600 bg-purple-50">L</span> Long Lunch</div>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading attendance data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
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
              <div className="space-y-4">
                <AttendanceDayDetail
                  date={selectedDate}
                  records={selectedRecords}
                  timeOffEntries={dayDataMap.get(selectedDate)?.time_off_entries || []}
                  onClose={() => setSelectedDate(null)}
                  onDeleteRecord={handleDeleteRecord}
                  onDeleteRecords={handleDeleteRecords}
                />

                {/* Salary Manual Flags Panel */}
                {isSalaryEmployee && employeeId && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Attendance Flags</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Toggle flags for this day:</p>
                    <div className="space-y-2">
                      {SALARY_FLAG_TYPES.map(ft => {
                        const isActive = selectedFlags.includes(ft.key);
                        return (
                          <button
                            key={ft.key}
                            onClick={() => handleToggleSalaryFlag(ft.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                              isActive
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}>
                              {isActive && '✓'}
                            </span>
                            {ft.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Auto-computed flags display for hourly employees */}
                {!isSalaryEmployee && employeeId && selectedFlags.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Attendance Flags</h3>
                    <div className="space-y-1">
                      {selectedFlags.map((flag: string) => {
                        const labels: Record<string, { label: string; color: string }> = {
                          tardy: { label: 'Tardy', color: 'text-amber-600 dark:text-amber-400' },
                          absent: { label: 'Absent', color: 'text-red-600 dark:text-red-400' },
                          left_early: { label: 'Left Early', color: 'text-orange-600 dark:text-orange-400' },
                          long_lunch: { label: 'Long Lunch', color: 'text-purple-600 dark:text-purple-400' },
                        };
                        const cfg = labels[flag] || { label: flag, color: 'text-gray-600' };
                        return (
                          <div key={flag} className={`text-sm font-medium ${cfg.color} flex items-center gap-2`}>
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {cfg.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Click a day to view punch details
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
