import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import AttendanceDayDetail from '../components/AttendanceDayDetail';
import AttendanceImportDialog from '../components/AttendanceImportDialog';
import type { AttendanceRecord, AttendanceSummary, ParsedAttendanceResult, AttendanceImportBatch } from '../types/attendance';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendanceCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [department, setDepartment] = useState<string>('');
  const [employees, setEmployees] = useState<{ id: number; employee_name: string }[]>([]);
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

  // Load employees and departments
  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name })));
    });
    api.getDepartments().then(setDepartments);
  }, []);

  // Load imports list
  useEffect(() => {
    api.getAttendanceImports().then(setImports);
  }, [reloadKey]);

  // Compute date range for current month
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

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
          // Use the new getAllAttendance endpoint
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
          records: [record],
        });
      }
    }
    return map;
  }, [records]);

  // Get records for selected date
  const selectedRecords = selectedDate
    ? records.filter(r => r.date === selectedDate)
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
    if (!result) return; // user cancelled file dialog
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
            onChange={e => { setDepartment(e.target.value); setEmployeeId(null); }}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

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
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Missing Punch</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Time Off</div>
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
            />
          </div>
          <div>
            {selectedDate ? (
              <AttendanceDayDetail
                date={selectedDate}
                records={selectedRecords}
                onClose={() => setSelectedDate(null)}
                onDeleteRecord={handleDeleteRecord}
                onDeleteRecords={handleDeleteRecords}
              />
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
