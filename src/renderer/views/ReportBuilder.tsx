import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import ComboSelect from '../components/ComboSelect';
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
  { key: 'date_of_separation', label: 'Date of Separation', type: 'date' },
  { key: 'years_of_service', label: 'Years of Service', type: 'number' },
  { key: 'starting_pay_base', label: 'Starting Pay', type: 'number' },
  { key: 'current_pay_rate', label: 'Current Pay Rate', type: 'number' },
  { key: 'previous_pay_rate', label: 'Previous Pay Rate', type: 'number' },
  { key: 'date_last_raise', label: 'Date of Last Raise', type: 'date' },
  { key: 'date_previous_raise', label: 'Date of Previous Raise', type: 'date' },
  { key: 'department_transfers', label: 'Department Transfers', type: 'text' },
  { key: 'date_of_transfer', label: 'Date of Transfer', type: 'date' },
  { key: 'shift_name', label: 'Shift', type: 'text' },
  { key: 'scheduled_in', label: 'Scheduled Clock In', type: 'text' },
  { key: 'scheduled_out', label: 'Scheduled Clock Out', type: 'text' },
  { key: 'scheduled_lunch_start', label: 'Scheduled Lunch Start', type: 'text' },
  { key: 'scheduled_lunch_end', label: 'Scheduled Lunch End', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
];

const GROUP_BY_FIELDS = [
  { key: '', label: 'No Grouping' },
  { key: 'current_department', label: 'Department' },
  { key: 'shift_name', label: 'Shift' },
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
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Report builder</h1>
          <p className="page-subtitle">Build and export custom employee reports</p>
        </div>
        {reportGenerated && (
          <button onClick={handleExport} className="btn accent">Export to Excel</button>
        )}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'flex-start' }}>
        {/* Config Panel */}
        <div className="vstack" style={{ gap: 14 }}>
          {savedReports.length > 0 && (
            <div className="section-card">
              <div className="section-head"><h3 className="section-title">Saved reports</h3></div>
              <div className="section-body">
                <div className="vstack" style={{ gap: 6 }}>
                  {savedReports.map(r => (
                    <div key={r.name} className="flex-between">
                      <button
                        onClick={() => loadReport(r)}
                        className="btn ghost"
                        style={{ padding: '2px 4px', color: 'var(--accent-ink)' }}
                      >
                        {r.name}
                      </button>
                      <button onClick={() => deleteReport(r.name)} className="btn ghost small" style={{ color: 'var(--danger)', padding: '2px 4px' }}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="section-card">
            <div className="section-head">
              <h3 className="section-title">Columns</h3>
              <div className="hstack" style={{ gap: 8 }}>
                <button onClick={selectAllCols} className="btn ghost small" style={{ padding: '2px 6px' }}>All</button>
                <button onClick={clearAllCols} className="btn ghost small" style={{ padding: '2px 6px', color: 'var(--danger)' }}>None</button>
              </div>
            </div>
            <div className="section-body">
              <div className="vstack" style={{ gap: 2, maxHeight: 260, overflow: 'auto' }}>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="hstack" style={{ gap: 8, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={selectedCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-head"><h3 className="section-title">Filters</h3></div>
            <div className="section-body vstack" style={{ gap: 10 }}>
              <label className="field">
                <span className="field-label">Department</span>
                <ComboSelect
                  value={filterDept}
                  options={departments}
                  onChange={setFilterDept}
                  includeNone={true}
                  noneLabel="All departments"
                />
              </label>
              <label className="field">
                <span className="field-label">Status</span>
                <ComboSelect
                  value={filterStatus}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'archived', label: 'Archived' },
                    { value: 'all', label: 'All' },
                  ]}
                  onChange={v => setFilterStatus(v || 'active')}
                  includeNone={false}
                  searchable={false}
                />
              </label>
            </div>
          </div>

          <div className="section-card">
            <div className="section-head"><h3 className="section-title">Grouping &amp; aggregation</h3></div>
            <div className="section-body vstack" style={{ gap: 10 }}>
              <label className="field">
                <span className="field-label">Group by</span>
                <ComboSelect
                  value={groupBy}
                  options={GROUP_BY_FIELDS.filter(g => g.key !== '').map(g => ({ value: g.key, label: g.label }))}
                  onChange={setGroupBy}
                  includeNone={true}
                  noneLabel="No Grouping"
                />
              </label>
              {groupBy && (
                <>
                  <label className="field">
                    <span className="field-label">Aggregation</span>
                    <ComboSelect
                      value={aggregation}
                      options={AGGREGATIONS.map(a => ({ value: a.key, label: a.label }))}
                      onChange={v => setAggregation(v || 'count')}
                      includeNone={false}
                      searchable={false}
                    />
                  </label>
                  {aggregation !== 'count' && (
                    <label className="field">
                      <span className="field-label">Aggregate field</span>
                      <ComboSelect
                        value={aggregationField}
                        options={ALL_COLUMNS.filter(c => c.type === 'number').map(c => ({ value: c.key, label: c.label }))}
                        onChange={v => setAggregationField(v || 'current_pay_rate')}
                        includeNone={false}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="section-head"><h3 className="section-title">Sort</h3></div>
            <div className="section-body">
              <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <ComboSelect
                    value={sortBy}
                    options={ALL_COLUMNS.map(c => ({ value: c.key, label: c.label }))}
                    onChange={v => setSortBy(v || 'employee_name')}
                    includeNone={false}
                  />
                </div>
                <div style={{ minWidth: 0, flex: '0 0 140px' }}>
                  <ComboSelect
                    value={sortDir}
                    options={[{ value: 'ASC', label: 'Ascending' }, { value: 'DESC', label: 'Descending' }]}
                    onChange={v => setSortDir((v || 'ASC') as 'ASC' | 'DESC')}
                    includeNone={false}
                    searchable={false}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading || selectedCols.length === 0}
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '9px 13px' }}
          >
            {loading ? 'Generating…' : 'Generate report'}
          </button>

          <div className="hstack" style={{ gap: 8 }}>
            <input
              type="text"
              className="input"
              style={{ flex: 1 }}
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="Report name…"
            />
            <button onClick={handleSaveReport} disabled={!reportName.trim()} className="btn">Save</button>
          </div>
        </div>

        {/* Results */}
        <div>
          {!reportGenerated ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>Select columns and filters, then click Generate report</p>
            </div>
          ) : groupedData ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <span className="small muted">
                  Grouped by {GROUP_BY_FIELDS.find(g => g.key === groupBy)?.label} — {employees.length} total records — {groupedData.length} groups
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="kin-table">
                  <thead>
                    <tr>
                      <th>{GROUP_BY_FIELDS.find(g => g.key === groupBy)?.label}</th>
                      <th>Count</th>
                      {aggregation !== 'count' && <th>{aggLabel} of {aggFieldLabel}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{row._group}</td>
                        <td className="muted">{row._count}</td>
                        {aggregation !== 'count' && (
                          <td className="muted">
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
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <span className="small muted">{employees.length} records</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="kin-table">
                  <thead>
                    <tr>
                      {selectedCols.map(key => {
                        const col = ALL_COLUMNS.find(c => c.key === key);
                        return <th key={key} style={{ whiteSpace: 'nowrap' }}>{col?.label || key}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        {selectedCols.map(key => (
                          <td key={key} style={{ whiteSpace: 'nowrap' }}>{formatValue(key, (emp as any)[key])}</td>
                        ))}
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={selectedCols.length} className="muted" style={{ textAlign: 'center', padding: 48 }}>
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
