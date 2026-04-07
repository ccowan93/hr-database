import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Employee } from '../types/employee';

const ALL_COLUMNS = [
  { key: 'id', label: 'ID', type: 'number' },
  { key: 'employee_name', label: 'Name', type: 'text' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'sex', label: 'Sex', type: 'text' },
  { key: 'race', label: 'Race', type: 'text' },
  { key: 'ethnicity', label: 'Ethnicity', type: 'text' },
  { key: 'country_of_origin', label: 'Country of Origin', type: 'text' },
  { key: 'languages_spoken', label: 'Languages Spoken', type: 'text' },
  { key: 'highest_education', label: 'Highest Education', type: 'text' },
  { key: 'current_department', label: 'Department', type: 'text' },
  { key: 'current_position', label: 'Position', type: 'text' },
  { key: 'supervisory_role', label: 'Supervisory Role', type: 'text' },
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'doh', label: 'Date of Hire', type: 'date' },
  { key: 'years_of_service', label: 'Years of Service', type: 'number' },
  { key: 'starting_pay_base', label: 'Starting Pay', type: 'number' },
  { key: 'current_pay_rate', label: 'Current Pay Rate', type: 'number' },
  { key: 'previous_pay_rate', label: 'Previous Pay Rate', type: 'number' },
  { key: 'date_last_raise', label: 'Date of Last Raise', type: 'date' },
  { key: 'date_previous_raise', label: 'Date of Previous Raise', type: 'date' },
  { key: 'department_transfers', label: 'Department Transfers', type: 'text' },
  { key: 'date_of_transfer', label: 'Date of Transfer', type: 'date' },
  { key: 'status', label: 'Status', type: 'text' },
];

const GROUP_BY_FIELDS = [
  { key: '', label: 'No Grouping' },
  { key: 'current_department', label: 'Department' },
  { key: 'sex', label: 'Sex' },
  { key: 'race', label: 'Race' },
  { key: 'ethnicity', label: 'Ethnicity' },
  { key: 'highest_education', label: 'Education' },
  { key: 'country_of_origin', label: 'Country' },
  { key: 'supervisory_role', label: 'Supervisory Role' },
  { key: 'status', label: 'Status' },
];

const AGGREGATIONS = [
  { key: 'count', label: 'Count' },
  { key: 'avg', label: 'Average' },
  { key: 'sum', label: 'Sum' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
];

const NUMERIC_FIELDS = ALL_COLUMNS.filter(c => c.type === 'number').map(c => c.key);

interface SavedReport {
  name: string;
  columns: string[];
  groupBy: string;
  aggregation: string;
  aggregationField: string;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  filterDept: string;
  filterStatus: string;
}

async function loadSavedReports(): Promise<SavedReport[]> {
  try {
    const rows = await api.getSavedReports();
    return rows.map(r => ({ ...JSON.parse(r.config), name: r.name }));
  } catch { return []; }
}

export default function ReportBuilder() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Report config
  const [selectedCols, setSelectedCols] = useState<string[]>(['employee_name', 'current_department', 'current_position', 'current_pay_rate']);
  const [groupBy, setGroupBy] = useState('');
  const [aggregation, setAggregation] = useState('count');
  const [aggregationField, setAggregationField] = useState('current_pay_rate');
  const [sortBy, setSortBy] = useState('employee_name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [reportGenerated, setReportGenerated] = useState(false);

  // Saved reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [reportName, setReportName] = useState('');

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
    loadSavedReports().then(setSavedReports);
  }, []);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAllEmployees({
        department: filterDept || undefined,
        status: (filterStatus as any) || 'active',
        sortBy,
        sortDir,
      });
      setEmployees(data);
      setReportGenerated(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterStatus, sortBy, sortDir]);

  const toggleCol = (key: string) => {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const selectAllCols = () => setSelectedCols(ALL_COLUMNS.map(c => c.key));
  const clearAllCols = () => setSelectedCols([]);

  const handleSaveReport = async () => {
    if (!reportName.trim()) return;
    const report: SavedReport = {
      name: reportName.trim(),
      columns: selectedCols,
      groupBy, aggregation, aggregationField,
      sortBy, sortDir, filterDept, filterStatus,
    };
    const { name, ...config } = report;
    await api.upsertSavedReport(name, JSON.stringify(config));
    const updated = [...savedReports.filter(r => r.name !== report.name), report];
    setSavedReports(updated);
    setReportName('');
  };

  const loadReport = (report: SavedReport) => {
    setSelectedCols(report.columns);
    setGroupBy(report.groupBy);
    setAggregation(report.aggregation);
    setAggregationField(report.aggregationField);
    setSortBy(report.sortBy);
    setSortDir(report.sortDir);
    setFilterDept(report.filterDept);
    setFilterStatus(report.filterStatus);
    setReportGenerated(false);
  };

  const deleteReport = async (name: string) => {
    await api.deleteSavedReport(name);
    setSavedReports(prev => prev.filter(r => r.name !== name));
  };

  const handleExport = async () => {
    const result = await api.exportEmployeesXlsx({
      department: filterDept || undefined,
      status: (filterStatus as any) || 'active',
      sortBy,
      sortDir,
    });
    if (result.success) {
      alert(`Exported to ${result.path}`);
    } else if (result.error && result.error !== 'Export cancelled') {
      alert('Export failed: ' + result.error);
    }
  };

  // Compute grouped data
  const computeGroupedData = () => {
    if (!groupBy) return null;
    const groups: Record<string, Employee[]> = {};
    for (const emp of employees) {
      const key = String((emp as any)[groupBy] ?? 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(emp);
    }

    return Object.entries(groups).map(([key, members]) => {
      const row: Record<string, any> = { _group: key, _count: members.length };
      if (aggregation !== 'count' && NUMERIC_FIELDS.includes(aggregationField)) {
        const vals = members.map(m => (m as any)[aggregationField]).filter((v: any) => v != null) as number[];
        if (vals.length > 0) {
          if (aggregation === 'avg') row._agg = vals.reduce((a, b) => a + b, 0) / vals.length;
          else if (aggregation === 'sum') row._agg = vals.reduce((a, b) => a + b, 0);
          else if (aggregation === 'min') row._agg = Math.min(...vals);
          else if (aggregation === 'max') row._agg = Math.max(...vals);
        }
      }
      return row;
    }).sort((a, b) => {
      if (sortDir === 'ASC') return a._group < b._group ? -1 : 1;
      return a._group > b._group ? -1 : 1;
    });
  };

  const formatValue = (key: string, val: any) => {
    if (val == null) return '-';
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.type === 'number' && typeof val === 'number') {
      if (key.includes('pay') || key.includes('Pay')) return `$${val.toFixed(2)}`;
      return val.toString();
    }
    return String(val);
  };

  const groupedData = reportGenerated && groupBy ? computeGroupedData() : null;
  const aggFieldLabel = ALL_COLUMNS.find(c => c.key === aggregationField)?.label || aggregationField;
  const aggLabel = AGGREGATIONS.find(a => a.key === aggregation)?.label || aggregation;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Report Builder</h2>
        {reportGenerated && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Export to Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Config Panel */}
        <div className="xl:col-span-1 space-y-4">
          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Saved Reports</h3>
              <div className="space-y-1">
                {savedReports.map(r => (
                  <div key={r.name} className="flex items-center justify-between">
                    <button
                      onClick={() => loadReport(r)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {r.name}
                    </button>
                    <button
                      onClick={() => deleteReport(r.name)}
                      className="text-xs text-red-500 hover:underline ml-2"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Columns</h3>
              <div className="flex gap-2">
                <button onClick={selectAllCols} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">All</button>
                <button onClick={clearAllCols} className="text-xs text-red-500 hover:underline">None</button>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Filters</h3>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Department</label>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {/* Group By */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Grouping & Aggregation</h3>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {GROUP_BY_FIELDS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            {groupBy && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Aggregation</label>
                  <select value={aggregation} onChange={e => setAggregation(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {AGGREGATIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                {aggregation !== 'count' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Aggregate Field</label>
                    <select value={aggregationField} onChange={e => setAggregationField(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {ALL_COLUMNS.filter(c => c.type === 'number').map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sort */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sort</h3>
            <div className="flex flex-wrap gap-2">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ALL_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={sortDir} onChange={e => setSortDir(e.target.value as any)} className="min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={generateReport}
            disabled={loading || selectedCols.length === 0}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>

          {/* Save Report */}
          <div className="flex gap-2">
            <input
              type="text"
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="Report name..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveReport}
              disabled={!reportName.trim()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="xl:col-span-3">
          {!reportGenerated ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-lg">Select columns and filters, then click Generate Report</p>
            </div>
          ) : groupedData ? (
            /* Grouped results */
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Grouped by {GROUP_BY_FIELDS.find(g => g.key === groupBy)?.label} — {employees.length} total records — {groupedData.length} groups
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                        {GROUP_BY_FIELDS.find(g => g.key === groupBy)?.label}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Count</th>
                      {aggregation !== 'count' && (
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                          {aggLabel} of {aggFieldLabel}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row._group}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row._count}</td>
                        {aggregation !== 'count' && (
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {row._agg != null ? (
                              aggregationField.includes('pay') || aggregationField.includes('Pay')
                                ? `$${row._agg.toFixed(2)}`
                                : row._agg.toFixed(1)
                            ) : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Flat results */
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{employees.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {selectedCols.map(key => {
                        const col = ALL_COLUMNS.find(c => c.key === key);
                        return (
                          <th key={key} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {col?.label || key}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        {selectedCols.map(key => (
                          <td key={key} className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {formatValue(key, (emp as any)[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={selectedCols.length} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                          No records match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
