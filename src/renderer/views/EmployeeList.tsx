import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Employee, EmployeeFilters } from '../types/employee';
import FilterBar from '../components/FilterBar';
import ComboSelect from '../components/ComboSelect';

const BULK_FIELDS = [
  { key: 'current_department', label: 'Department', type: 'department' },
  { key: 'current_position', label: 'Position', type: 'text' },
  { key: 'supervisory_role', label: 'Supervisory Role', type: 'select', options: ['Y', 'N'] },
  { key: 'highest_education', label: 'Highest Education', type: 'text' },
  { key: 'current_pay_rate', label: 'Current Pay Rate', type: 'number' },
  { key: 'date_last_raise', label: 'Date of Last Raise', type: 'date' },
];

export default function EmployeeList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<EmployeeFilters>(() => ({
    search: '',
    department: '',
    supervisoryRole: '',
    countryOfOrigin: searchParams.get('country') || '',
    status: 'active',
    sortBy: 'employee_name',
    sortDir: 'ASC',
  }));
  const [dohFrom, setDohFrom] = useState('');
  const [dohTo, setDohTo] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');

  // Bulk edit state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Photo cache
  const [photoCache, setPhotoCache] = useState<Record<number, string | null>>({});

  // Sync country from URL query params
  useEffect(() => {
    const country = searchParams.get('country') || '';
    if (country !== (filters.countryOfOrigin || '')) {
      setFilters(prev => ({ ...prev, countryOfOrigin: country }));
    }
  }, [searchParams]);

  const buildFilters = useCallback((): EmployeeFilters => {
    const f: EmployeeFilters = { ...filters };
    if (dohFrom) f.dohFrom = dohFrom;
    if (dohTo) f.dohTo = dohTo;
    if (payMin) f.payMin = parseFloat(payMin);
    if (payMax) f.payMax = parseFloat(payMax);
    if (ageMin) f.ageMin = parseInt(ageMin);
    if (ageMax) f.ageMax = parseInt(ageMax);
    return f;
  }, [filters, dohFrom, dohTo, payMin, payMax, ageMin, ageMax]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAllEmployees(buildFilters());
      setEmployees(data);
      // Load photos
      for (const emp of data) {
        if (!(emp.id in photoCache)) {
          api.getEmployeePhoto(emp.id).then(photo => {
            if (photo) setPhotoCache(prev => ({ ...prev, [emp.id]: photo }));
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
    api.getCountries().then(setCountries).catch(() => {});
  }, []);

  const handleSort = (col: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: col,
      sortDir: prev.sortBy === col && prev.sortDir === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const sortIndicator = (col: string) => {
    if (filters.sortBy !== col) return '';
    return filters.sortDir === 'ASC' ? ' \u25B2' : ' \u25BC';
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.exportEmployeesXlsx(buildFilters());
      if (result.success) {
        alert(`Exported to ${result.path}`);
      } else if (result.error && result.error !== 'Export cancelled') {
        alert('Export failed: ' + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    setFilters(prev => ({
      ...prev,
      search: '',
      department: '',
      supervisoryRole: '',
      countryOfOrigin: '',
    }));
    setDohFrom('');
    setDohTo('');
    setPayMin('');
    setPayMax('');
    setAgeMin('');
    setAgeMax('');
    setSearchParams({});
  };

  // Bulk edit handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkEdit = async () => {
    if (!bulkField || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const fieldDef = BULK_FIELDS.find(f => f.key === bulkField);
      let val: any = bulkValue;
      if (fieldDef?.type === 'number') val = parseFloat(bulkValue) || null;
      if (!bulkValue) val = null;
      await api.bulkUpdateEmployees(Array.from(selectedIds), { [bulkField]: val });
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      setBulkField('');
      setBulkValue('');
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert('Bulk update failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const columns = [
    { key: 'employee_name', label: 'Name' },
    { key: 'id', label: 'ID' },
    { key: 'current_department', label: 'Department' },
    { key: 'current_position', label: 'Position' },
    { key: 'supervisory_role', label: 'Supervisor' },
    { key: 'years_of_service', label: 'Tenure' },
    { key: 'current_pay_rate', label: 'Pay Rate' },
    { key: 'age', label: 'Age' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {filters.status === 'archived' ? 'Archived people' : 'People'}
          </h1>
          <p className="page-subtitle">{employees.length} records</p>
        </div>
        <div className="hstack" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowBulkEdit(true)} className="btn accent">
              Bulk edit ({selectedIds.size})
            </button>
          )}
          <button onClick={handleExport} disabled={exporting} className="btn">
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button onClick={() => navigate('/employees/new')} className="btn primary">
            Add employee
          </button>
          <div className="seg seg-inline" role="tablist" aria-label="Status filter">
            <button aria-pressed={filters.status === 'active'} onClick={() => setFilters(prev => ({ ...prev, status: 'active' }))}>Active</button>
            <button aria-pressed={filters.status === 'archived'} onClick={() => setFilters(prev => ({ ...prev, status: 'archived' }))}>Archived</button>
          </div>
        </div>
      </div>

      <FilterBar
        search={filters.search || ''}
        onSearchChange={v => setFilters(prev => ({ ...prev, search: v }))}
        department={filters.department || ''}
        onDepartmentChange={v => setFilters(prev => ({ ...prev, department: v }))}
        departments={departments}
        supervisoryRole={filters.supervisoryRole || ''}
        onSupervisoryRoleChange={v => setFilters(prev => ({ ...prev, supervisoryRole: v }))}
        dohFrom={dohFrom}
        onDohFromChange={setDohFrom}
        dohTo={dohTo}
        onDohToChange={setDohTo}
        payMin={payMin}
        onPayMinChange={setPayMin}
        payMax={payMax}
        onPayMaxChange={setPayMax}
        ageMin={ageMin}
        onAgeMinChange={setAgeMin}
        ageMax={ageMax}
        onAgeMaxChange={setAgeMax}
        countryOfOrigin={filters.countryOfOrigin || ''}
        onCountryOfOriginChange={v => {
          setFilters(prev => ({ ...prev, countryOfOrigin: v }));
          if (v) setSearchParams({ country: v }); else setSearchParams({});
        }}
        countries={countries}
        onClearFilters={handleClearFilters}
      />

      {showBulkEdit && (
        <div className="modal-backdrop" onClick={() => setShowBulkEdit(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              Bulk edit {selectedIds.size} {selectedIds.size > 1 ? 'people' : 'person'}
            </h3>
            <div className="vstack" style={{ gap: 12 }}>
              <label className="field">
                <span className="field-label">Field to update</span>
                <ComboSelect
                  value={bulkField}
                  options={BULK_FIELDS.map(f => ({ value: f.key, label: f.label }))}
                  onChange={v => { setBulkField(v); setBulkValue(''); }}
                  placeholder="Select a field…"
                  includeNone={true}
                  noneLabel="Select a field…"
                />
              </label>
              {bulkField && (() => {
                const fieldDef = BULK_FIELDS.find(f => f.key === bulkField);
                if (!fieldDef) return null;
                if (fieldDef.type === 'select') {
                  return (
                    <label className="field">
                      <span className="field-label">New value</span>
                      <ComboSelect
                        value={bulkValue}
                        options={(fieldDef.options || []).map(opt => ({ value: opt, label: opt }))}
                        onChange={setBulkValue}
                        includeNone={true}
                        noneLabel="—"
                        searchable={false}
                      />
                    </label>
                  );
                }
                if (fieldDef.type === 'department') {
                  return (
                    <label className="field">
                      <span className="field-label">New value</span>
                      <ComboSelect
                        value={bulkValue}
                        options={departments}
                        onChange={setBulkValue}
                        includeNone={true}
                        noneLabel="—"
                      />
                    </label>
                  );
                }
                return (
                  <label className="field">
                    <span className="field-label">New value</span>
                    <input
                      className="input"
                      type={fieldDef.type}
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                      step={fieldDef.type === 'number' ? '0.01' : undefined}
                    />
                  </label>
                );
              })()}
            </div>
            <div className="hstack" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowBulkEdit(false)}>Cancel</button>
              <button className="btn primary" onClick={handleBulkEdit} disabled={!bulkField || bulkSaving}>
                {bulkSaving ? 'Updating…' : `Update ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Loading…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="kin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.size === employees.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col.label}{sortIndicator(col.key)}
                    </th>
                  ))}
                  {filters.status === 'archived' && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    className={selectedIds.has(emp.id) ? 'row-selected' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                      />
                    </td>
                    <td onClick={() => navigate(`/employees/${emp.id}`)}>
                      <div className="hstack">
                        {photoCache[emp.id] ? (
                          <img src={photoCache[emp.id]!} className="avatar-sm" alt="" />
                        ) : (
                          <div className="avatar-sm av-sage">{getInitials(emp.employee_name)}</div>
                        )}
                        <span style={{ fontWeight: 500 }}>{emp.employee_name}</span>
                      </div>
                    </td>
                    <td className="mono" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.id}</td>
                    <td onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_department}</td>
                    <td onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_position}</td>
                    <td onClick={() => navigate(`/employees/${emp.id}`)}>
                      {emp.supervisory_role === 'Y'
                        ? <span className="chip">Yes</span>
                        : <span className="muted">No</span>}
                    </td>
                    <td className="mono" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.years_of_service != null ? `${emp.years_of_service} yrs` : '—'}</td>
                    <td className="mono" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_pay_rate != null ? `$${emp.current_pay_rate.toFixed(2)}` : '—'}</td>
                    <td className="mono" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.age ?? '—'}</td>
                    {filters.status === 'archived' && (
                      <td onClick={() => navigate(`/employees/${emp.id}`)}>
                        <span className="chip muted">Archived</span>
                      </td>
                    )}
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={filters.status === 'archived' ? 10 : 9} className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>
                      {filters.status === 'archived' ? 'No archived employees.' : 'No employees found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
