import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Employee, EmployeeFilters } from '../types/employee';
import FilterBar from '../components/FilterBar';

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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {filters.status === 'archived' ? 'Archived Employees' : 'Employees'}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkEdit(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Bulk Edit ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'active' }))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filters.status === 'active' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'archived' }))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filters.status === 'archived' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Archived
            </button>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{employees.length} records</span>
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

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkEdit(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Bulk Edit {selectedIds.size} Employee{selectedIds.size > 1 ? 's' : ''}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Field to Update</label>
                <select
                  value={bulkField}
                  onChange={e => { setBulkField(e.target.value); setBulkValue(''); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
                >
                  <option value="">Select a field...</option>
                  {BULK_FIELDS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              {bulkField && (() => {
                const fieldDef = BULK_FIELDS.find(f => f.key === bulkField);
                if (!fieldDef) return null;
                if (fieldDef.type === 'select') {
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">New Value</label>
                      <select
                        value={bulkValue}
                        onChange={e => setBulkValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
                      >
                        <option value="">--</option>
                        {fieldDef.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (fieldDef.type === 'department') {
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">New Value</label>
                      <select
                        value={bulkValue}
                        onChange={e => setBulkValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
                      >
                        <option value="">--</option>
                        {departments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">New Value</label>
                    <input
                      type={fieldDef.type}
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
                      step={fieldDef.type === 'number' ? '0.01' : undefined}
                    />
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBulkEdit}
                disabled={!bulkField || bulkSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {bulkSaving ? 'Updating...' : `Update ${selectedIds.size} Employee${selectedIds.size > 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setShowBulkEdit(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.size === employees.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none whitespace-nowrap"
                    >
                      {col.label}{sortIndicator(col.key)}
                    </th>
                  ))}
                  {filters.status === 'archived' && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Status</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors ${
                      selectedIds.has(emp.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                    }`}
                  >
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3" onClick={() => navigate(`/employees/${emp.id}`)}>
                      <div className="flex items-center gap-3">
                        {photoCache[emp.id] ? (
                          <img src={photoCache[emp.id]!} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                            {getInitials(emp.employee_name)}
                          </div>
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{emp.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.id}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_department}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_position}</td>
                    <td className="px-4 py-3" onClick={() => navigate(`/employees/${emp.id}`)}>
                      {emp.supervisory_role === 'Y' ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.years_of_service != null ? `${emp.years_of_service} yrs` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.current_pay_rate != null ? `$${emp.current_pay_rate.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" onClick={() => navigate(`/employees/${emp.id}`)}>{emp.age ?? '-'}</td>
                    {filters.status === 'archived' && (
                      <td className="px-4 py-3" onClick={() => navigate(`/employees/${emp.id}`)}>
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-medium">Archived</span>
                      </td>
                    )}
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={filters.status === 'archived' ? 10 : 9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
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
