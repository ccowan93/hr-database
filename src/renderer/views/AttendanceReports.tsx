import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import ComboSelect from '../components/ComboSelect';
import type { OvertimeReportEntry, AbsenteeismReportEntry, TardinessReportEntry, LeftEarlyReportEntry, LunchDurationEntry, TimeOffUsageEntry } from '../types/attendance';

type ReportTab = 'overtime' | 'absenteeism' | 'tardiness' | 'leftearly' | 'lunch' | 'timeoff';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'overtime', label: 'Overtime Summary' },
  { key: 'absenteeism', label: 'Absenteeism' },
  { key: 'tardiness', label: 'Tardiness' },
  { key: 'leftearly', label: 'Left Early' },
  { key: 'lunch', label: 'Lunch Duration' },
  { key: 'timeoff', label: 'Time-Off Usage' },
];

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}

export default function AttendanceReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overtime');
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [groupBy, setGroupBy] = useState<'employee' | 'department'>('employee');
  const [year, setYear] = useState(new Date().getFullYear());

  // Employee/Department filtering
  const [employees, setEmployees] = useState<{ id: number; employee_name: string; current_department: string | null }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Report data
  const [overtimeData, setOvertimeData] = useState<OvertimeReportEntry[]>([]);
  const [absenteeismData, setAbsenteeismData] = useState<AbsenteeismReportEntry[]>([]);
  const [tardinessData, setTardinessData] = useState<TardinessReportEntry[]>([]);
  const [leftEarlyData, setLeftEarlyData] = useState<LeftEarlyReportEntry[]>([]);
  const [lunchData, setLunchData] = useState<LunchDurationEntry[]>([]);
  const [timeOffData, setTimeOffData] = useState<TimeOffUsageEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load employees and departments
  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name, current_department: e.current_department })));
    });
    api.getDepartments().then(setDepartments);
  }, []);

  // Close employee dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filters = {
    ...(selectedEmployeeIds.length > 0 ? { employeeIds: selectedEmployeeIds } : {}),
    ...(selectedDepartment ? { department: selectedDepartment } : {}),
  };
  const hasFilters = selectedEmployeeIds.length > 0 || !!selectedDepartment;

  useEffect(() => {
    loadReport();
  }, [activeTab, startDate, endDate, groupBy, year, selectedEmployeeIds, selectedDepartment]);

  const loadReport = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overtime':
          setOvertimeData(await api.getOvertimeReport(startDate, endDate, groupBy, hasFilters ? filters : undefined));
          break;
        case 'absenteeism':
          setAbsenteeismData(await api.getAbsenteeismReport(startDate, endDate, hasFilters ? filters : undefined));
          break;
        case 'tardiness':
          setTardinessData(await api.getTardinessReport(startDate, endDate, hasFilters ? filters : undefined));
          break;
        case 'leftearly':
          setLeftEarlyData(await api.getLeftEarlyReport(startDate, endDate, hasFilters ? filters : undefined));
          break;
        case 'lunch':
          setLunchData(await api.getLunchDurationReport(startDate, endDate, hasFilters ? filters : undefined));
          break;
        case 'timeoff':
          setTimeOffData(await api.getTimeOffUsageReport(year, hasFilters ? filters : undefined));
          break;
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    }
    setLoading(false);
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setSelectedEmployeeIds([]);
    setSelectedDepartment('');
    setEmployeeSearch('');
  };

  const filteredDropdownEmployees = employees.filter(e =>
    e.employee_name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Attendance reports</h1>
          <p className="page-subtitle">Analyze attendance metrics and trends</p>
        </div>
      </div>

      <div className="tab-row">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="hstack" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {activeTab !== 'timeoff' ? (
            <>
              <label className="field">
                <span className="field-label">Start date</span>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">End date</span>
                <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </label>
              {activeTab === 'overtime' && (
                <label className="field">
                  <span className="field-label">Group by</span>
                  <ComboSelect
                    value={groupBy}
                    options={[{ value: 'employee', label: 'Employee' }, { value: 'department', label: 'Department' }]}
                    onChange={v => setGroupBy((v || 'employee') as 'employee' | 'department')}
                    includeNone={false}
                    searchable={false}
                  />
                </label>
              )}
            </>
          ) : (
            <label className="field">
              <span className="field-label">Year</span>
              <ComboSelect
                value={String(year)}
                options={Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => ({ value: String(y), label: String(y) }))}
                onChange={v => setYear(Number(v) || new Date().getFullYear())}
                includeNone={false}
                searchable={false}
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Department</span>
            <ComboSelect
              value={selectedDepartment}
              options={departments}
              onChange={v => { setSelectedDepartment(v); setSelectedEmployeeIds([]); }}
              includeNone={true}
              noneLabel="All departments"
            />
          </label>

          <div style={{ position: 'relative' }} ref={employeeDropdownRef}>
            <div className="field-label" style={{ marginBottom: 6 }}>Employees</div>
            <button
              onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
              className="input"
              style={{ minWidth: 180, cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedEmployeeIds.length === 0
                  ? 'All employees'
                  : selectedEmployeeIds.length === 1
                    ? employees.find(e => e.id === selectedEmployeeIds[0])?.employee_name || '1 selected'
                    : `${selectedEmployeeIds.length} selected`}
              </span>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ transform: showEmployeeDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showEmployeeDropdown && (
              <div className="card" style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, marginTop: 4, width: 288, boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
                  <input
                    className="input"
                    type="text"
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    placeholder="Search employees…"
                    autoFocus
                  />
                </div>
                <div style={{ maxHeight: 240, overflow: 'auto', padding: 4 }}>
                  {filteredDropdownEmployees.map(emp => {
                    const checked = selectedEmployeeIds.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => toggleEmployee(emp.id)}
                        className="hstack"
                        style={{
                          width: '100%', gap: 8, padding: '6px 8px',
                          fontSize: 13, color: 'var(--ink)', cursor: 'pointer',
                          border: 0, background: 'transparent', borderRadius: 4,
                          textAlign: 'left', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          width: 14, height: 14, borderRadius: 3,
                          border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--line-strong)'),
                          background: checked ? 'var(--accent)' : 'transparent',
                          color: 'white',
                          display: 'grid', placeItems: 'center', fontSize: 9,
                          flexShrink: 0,
                        }}>
                          {checked && '✓'}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.employee_name}</span>
                        {emp.current_department && <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.current_department}</span>}
                      </button>
                    );
                  })}
                  {filteredDropdownEmployees.length === 0 && (
                    <p className="small muted" style={{ padding: 8, margin: 0 }}>No employees found.</p>
                  )}
                </div>
                {selectedEmployeeIds.length > 0 && (
                  <div style={{ padding: 8, borderTop: '1px solid var(--line)' }}>
                    <button onClick={() => setSelectedEmployeeIds([])} className="btn ghost small" style={{ width: '100%', justifyContent: 'center' }}>
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="btn ghost">Clear filters</button>
          )}
        </div>

        {/* Selected employees pills */}
        {selectedEmployeeIds.length > 0 && (
          <div className="hstack" style={{ gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
            {selectedEmployeeIds.map(id => {
              const emp = employees.find(e => e.id === id);
              return emp ? (
                <span key={id} className="badge accent" style={{ gap: 4 }}>
                  {emp.employee_name}
                  <button onClick={() => toggleEmployee(id)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Loading report…</div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'overtime' && <OvertimeReport data={overtimeData} groupBy={groupBy} />}
          {activeTab === 'absenteeism' && <AbsenteeismReport data={absenteeismData} />}
          {activeTab === 'tardiness' && <TardinessReport data={tardinessData} />}
          {activeTab === 'leftearly' && <LeftEarlyReport data={leftEarlyData} />}
          {activeTab === 'lunch' && <LunchReport data={lunchData} />}
          {activeTab === 'timeoff' && <TimeOffUsageReport data={timeOffData} />}
        </div>
      )}
    </div>
  );
}

function OvertimeReport({ data, groupBy }: { data: OvertimeReportEntry[]; groupBy: string }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Overtime Hours by {groupBy === 'department' ? 'Department' : 'Employee'}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_reg" name="Regular Hours" fill="#3B82F6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="total_ot" name="Overtime Hours" fill="#F97316" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: groupBy === 'department' ? 'Department' : 'Employee' },
          { key: 'total_reg', label: 'Regular Hours', align: 'right', format: (v: number) => v.toFixed(1) },
          { key: 'total_ot', label: 'Overtime Hours', align: 'right', format: (v: number) => v.toFixed(1) },
          ...(groupBy === 'employee'
            ? [{ key: 'days_worked' as const, label: 'Days Worked', align: 'right' as const }]
            : [{ key: 'employee_count' as const, label: 'Employees', align: 'right' as const }]),
        ]}
        data={data}
      />
    </>
  );
}

function AbsenteeismReport({ data }: { data: AbsenteeismReportEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  const chartData = data.slice(0, 20).map(d => ({
    name: d.employee_name,
    present: d.days_present,
    absent: Math.max(0, Math.round(d.total_days) - d.days_present),
    rate: d.total_days > 0 ? Math.round(((d.total_days - d.days_present) / d.total_days) * 100) : 0,
  }));

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Attendance vs Absence</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="present" name="Days Present" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="absent" name="Days Absent" fill="#EF4444" stackId="a" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'current_department', label: 'Department' },
          { key: 'days_present', label: 'Days Present', align: 'right' },
          { key: 'total_days', label: 'Work Days', align: 'right', format: (v: number) => Math.round(v).toString() },
          { key: '_rate', label: 'Absence Rate', align: 'right', compute: (row: any) => {
            const rate = row.total_days > 0 ? ((row.total_days - row.days_present) / row.total_days * 100) : 0;
            return `${Math.round(rate)}%`;
          }},
        ]}
        data={data}
      />
    </>
  );
}

function TardinessReport({ data }: { data: TardinessReportEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Late Arrivals by Employee</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="employee_name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="late_count" name="Late Arrivals" fill="#F59E0B" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'current_department', label: 'Department' },
          { key: 'shift_name', label: 'Shift' },
          { key: 'scheduled_in', label: 'Scheduled In' },
          { key: 'late_count', label: 'Late Arrivals', align: 'right' },
          { key: 'days_late', label: 'Days Late', align: 'right' },
        ]}
        data={data}
      />
    </>
  );
}

function LeftEarlyReport({ data }: { data: LeftEarlyReportEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Early Departures by Employee</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="employee_name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="early_count" name="Left Early" fill="#EF4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'current_department', label: 'Department' },
          { key: 'shift_name', label: 'Shift' },
          { key: 'scheduled_out', label: 'Scheduled Out' },
          { key: 'early_count', label: 'Left Early', align: 'right' },
          { key: 'days_early', label: 'Days Early', align: 'right' },
        ]}
        data={data}
      />
    </>
  );
}

function LunchReport({ data }: { data: LunchDurationEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  const byEmployee = new Map<string, { name: string; totalMinutes: number; count: number }>();
  for (const row of data) {
    const existing = byEmployee.get(row.employee_name) || { name: row.employee_name, totalMinutes: 0, count: 0 };
    existing.totalMinutes += row.lunch_minutes;
    existing.count++;
    byEmployee.set(row.employee_name, existing);
  }
  const chartData = Array.from(byEmployee.values())
    .map(e => ({ name: e.name, avg_lunch: Math.round(e.totalMinutes / e.count) }))
    .sort((a, b) => b.avg_lunch - a.avg_lunch)
    .slice(0, 20);

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Average Lunch Duration by Employee (minutes)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="avg_lunch" name="Avg Lunch (min)" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'current_department', label: 'Department' },
          { key: 'date', label: 'Date' },
          { key: 'lunch_start', label: 'Lunch Start' },
          { key: 'lunch_end', label: 'Lunch End' },
          { key: 'lunch_minutes', label: 'Duration (min)', align: 'right', format: (v: number) => `${Math.round(v)}` },
        ]}
        data={data}
      />
    </>
  );
}

function TimeOffUsageReport({ data }: { data: TimeOffUsageEntry[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <DataTable
      columns={[
        { key: 'employee_name', label: 'Employee' },
        { key: 'current_department', label: 'Department' },
        { key: 'request_type', label: 'Type', format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ') },
        { key: 'allocated_hours', label: 'Allocated', align: 'right', format: (v: number) => `${v}h` },
        { key: 'used_hours', label: 'Used', align: 'right', format: (v: number) => `${v}h` },
        { key: 'remaining_hours', label: 'Remaining', align: 'right', format: (v: number) => `${v}h` },
      ]}
      data={data}
    />
  );
}

function EmptyState() {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <p className="muted" style={{ margin: 0 }}>No data available for the selected criteria.</p>
    </div>
  );
}

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (value: any) => string;
  compute?: (row: any) => string;
}

function DataTable({ columns, data }: { columns: Column[]; data: any[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="kin-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ textAlign: col.align === 'right' ? 'right' : 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align === 'right' ? 'right' : 'left' }}>
                  {col.compute
                    ? col.compute(row)
                    : col.format
                      ? col.format(row[col.key])
                      : row[col.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
