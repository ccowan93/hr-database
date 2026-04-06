import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import type { OvertimeReportEntry, AbsenteeismReportEntry, TardinessReportEntry, TimeOffUsageEntry } from '../types/attendance';

type ReportTab = 'overtime' | 'absenteeism' | 'tardiness' | 'timeoff';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'overtime', label: 'Overtime Summary' },
  { key: 'absenteeism', label: 'Absenteeism' },
  { key: 'tardiness', label: 'Tardiness' },
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
  const [threshold, setThreshold] = useState('09:00');

  // Report data
  const [overtimeData, setOvertimeData] = useState<OvertimeReportEntry[]>([]);
  const [absenteeismData, setAbsenteeismData] = useState<AbsenteeismReportEntry[]>([]);
  const [tardinessData, setTardinessData] = useState<TardinessReportEntry[]>([]);
  const [timeOffData, setTimeOffData] = useState<TimeOffUsageEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [activeTab, startDate, endDate, groupBy, year, threshold]);

  const loadReport = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overtime':
          setOvertimeData(await api.getOvertimeReport(startDate, endDate, groupBy));
          break;
        case 'absenteeism':
          setAbsenteeismData(await api.getAbsenteeismReport(startDate, endDate));
          break;
        case 'tardiness':
          setTardinessData(await api.getTardinessReport(startDate, endDate, threshold));
          break;
        case 'timeoff':
          setTimeOffData(await api.getTimeOffUsageReport(year));
          break;
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analyze attendance metrics and trends</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {activeTab !== 'timeoff' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            {activeTab === 'overtime' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group By</label>
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value as any)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="employee">Employee</option>
                  <option value="department">Department</option>
                </select>
              </div>
            )}
            {activeTab === 'tardiness' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Late After</label>
                <input
                  type="time"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading report...</div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'overtime' && <OvertimeReport data={overtimeData} groupBy={groupBy} />}
          {activeTab === 'absenteeism' && <AbsenteeismReport data={absenteeismData} />}
          {activeTab === 'tardiness' && <TardinessReport data={tardinessData} />}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Overtime Hours by {groupBy === 'department' ? 'Department' : 'Employee'}</h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Attendance vs Absence</h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Late Arrivals by Employee</h3>
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
          { key: 'late_count', label: 'Late Arrivals', align: 'right' },
          { key: 'days_late', label: 'Days Late', align: 'right' },
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
      <p className="text-gray-500 dark:text-gray-400">No data available for the selected criteria.</p>
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
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
