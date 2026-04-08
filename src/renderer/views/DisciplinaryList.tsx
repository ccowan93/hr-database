import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import {
  ShieldAlert, Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, Check,
} from 'lucide-react';

/* ────────────────────── Types ────────────────────── */

interface DisciplinaryAction {
  id: number;
  employee_id: number;
  employee_name: string;
  current_department: string;
  current_position: string;
  type: string;
  date: string;
  description: string;
  outcome: string | null;
  issued_by: string;
  follow_up_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: number;
  employee_name: string;
}

/* ────────────────────── Constants ────────────────────── */

const ACTION_TYPES: { value: string; label: string }[] = [
  { value: 'verbal_warning', label: 'Verbal Warning' },
  { value: 'written_warning', label: 'Written Warning' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'termination', label: 'Termination' },
  { value: 'pip', label: 'PIP' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  escalated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function getTypeLabel(value: string): string {
  return ACTION_TYPES.find(t => t.value === value)?.label || value;
}

function getStatusLabel(value: string): string {
  return STATUS_OPTIONS.find(s => s.value === value)?.label || value;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(s: string | null, max: number): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/* ────────────────────── Empty form data ────────────────────── */

interface FormData {
  employee_id: number | '';
  type: string;
  date: string;
  description: string;
  issued_by: string;
  follow_up_date: string;
  status: string;
  outcome: string;
}

const emptyForm: FormData = {
  employee_id: '',
  type: 'verbal_warning',
  date: new Date().toISOString().split('T')[0],
  description: '',
  issued_by: '',
  follow_up_date: '',
  status: 'open',
  outcome: '',
};

/* ────────────────────── Main Component ────────────────────── */

export default function DisciplinaryList() {
  const [actions, setActions] = useState<DisciplinaryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormData>(emptyForm);

  // New action form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<FormData>(emptyForm);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  /* ─── Data loading ─── */

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterType) filters.type = filterType;
      if (filterStatus) filters.status = filterStatus;
      if (filterDepartment) filters.department = filterDepartment;
      if (filterDateFrom) filters.date_from = filterDateFrom;
      if (filterDateTo) filters.date_to = filterDateTo;
      const data = await api.getAllDisciplinaryActions(filters);
      setActions(data);
    } catch (err) {
      console.error('Failed to load disciplinary actions:', err);
    }
    setLoading(false);
  }, [filterType, filterStatus, filterDepartment, filterDateFrom, filterDateTo]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.getAllEmployees({ status: 'active' });
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const data = await api.getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }, []);

  useEffect(() => { loadActions(); }, [loadActions]);
  useEffect(() => { loadEmployees(); loadDepartments(); }, [loadEmployees, loadDepartments]);

  /* ─── Handlers ─── */

  const handleCreate = async () => {
    if (!newForm.employee_id || !newForm.description || !newForm.issued_by) return;
    try {
      await api.createDisciplinaryAction({
        employee_id: newForm.employee_id as number,
        type: newForm.type,
        date: newForm.date,
        description: newForm.description,
        issued_by: newForm.issued_by,
        follow_up_date: newForm.follow_up_date || undefined,
        status: newForm.status,
        outcome: newForm.outcome || undefined,
      });
      setShowNewForm(false);
      setNewForm(emptyForm);
      setEmployeeSearch('');
      loadActions();
    } catch (err) {
      console.error('Failed to create disciplinary action:', err);
    }
  };

  const handleEdit = (action: DisciplinaryAction) => {
    setEditingId(action.id);
    setEditForm({
      employee_id: action.employee_id,
      type: action.type,
      date: action.date,
      description: action.description,
      issued_by: action.issued_by,
      follow_up_date: action.follow_up_date || '',
      status: action.status,
      outcome: action.outcome || '',
    });
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    try {
      await api.updateDisciplinaryAction(editingId, {
        type: editForm.type,
        date: editForm.date,
        description: editForm.description,
        issued_by: editForm.issued_by,
        follow_up_date: editForm.follow_up_date || null,
        status: editForm.status,
        outcome: editForm.outcome || null,
      });
      setEditingId(null);
      loadActions();
    } catch (err) {
      console.error('Failed to update disciplinary action:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this disciplinary action?')) return;
    try {
      await api.deleteDisciplinaryAction(id);
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) setEditingId(null);
      loadActions();
    } catch (err) {
      console.error('Failed to delete disciplinary action:', err);
    }
  };

  const toggleExpand = (id: number) => {
    if (editingId === id) return;
    setExpandedId(prev => (prev === id ? null : id));
  };

  /* ─── Filtered employee list for searchable picker ─── */

  const filteredEmployees = employeeSearch.trim()
    ? employees.filter(e =>
        e.employee_name.toLowerCase().includes(employeeSearch.toLowerCase())
      ).slice(0, 20)
    : employees.slice(0, 20);

  /* ─── Render ─── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-red-600" />
            Disciplinary Actions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage and track employee disciplinary actions, warnings, and follow-ups
          </p>
        </div>
        <button
          onClick={() => { setShowNewForm(true); setNewForm(emptyForm); setEmployeeSearch(''); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Action
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {ACTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {(filterType || filterStatus || filterDepartment || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterType(''); setFilterStatus(''); setFilterDepartment(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* New action inline form */}
      {showNewForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-300 dark:border-blue-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Disciplinary Action</h2>
            <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Employee select (searchable) */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Employee *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={employeeSearch}
                  onChange={e => { setEmployeeSearch(e.target.value); setShowEmployeeDropdown(true); }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {showEmployeeDropdown && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                  {filteredEmployees.map(e => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setNewForm(prev => ({ ...prev, employee_id: e.id }));
                        setEmployeeSearch(e.employee_name);
                        setShowEmployeeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 ${
                        newForm.employee_id === e.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {e.employee_name}
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No employees found</div>
                  )}
                </div>
              )}
            </div>
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={newForm.type}
                onChange={e => setNewForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={newForm.date}
                onChange={e => setNewForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Issued By */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Issued By *</label>
              <input
                type="text"
                value={newForm.issued_by}
                onChange={e => setNewForm(prev => ({ ...prev, issued_by: e.target.value }))}
                placeholder="Manager name"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Follow-up Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={newForm.follow_up_date}
                onChange={e => setNewForm(prev => ({ ...prev, follow_up_date: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={newForm.status}
                onChange={e => setNewForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description *</label>
            <textarea
              value={newForm.description}
              onChange={e => setNewForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Describe the incident and action taken..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
          {/* Outcome */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Outcome</label>
            <textarea
              value={newForm.outcome}
              onChange={e => setNewForm(prev => ({ ...prev, outcome: e.target.value }))}
              rows={2}
              placeholder="Expected or actual outcome..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newForm.employee_id || !newForm.description || !newForm.issued_by}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Create Action
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : actions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No disciplinary actions found. Adjust your filters or create a new action.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Issued By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Follow-up</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Description</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {actions.map(action => (
                <React.Fragment key={action.id}>
                  {/* Main row */}
                  <tr
                    onClick={() => toggleExpand(action.id)}
                    className={`border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      expandedId === action.id ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      <div>{action.employee_name}</div>
                      {action.current_department && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{action.current_department}</div>
                      )}
                    </td>
                    {editingId === action.id ? (
                      <>
                        <td className="px-4 py-3">
                          <select
                            value={editForm.type}
                            onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {ACTION_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editForm.issued_by}
                            onChange={e => setEditForm(prev => ({ ...prev, issued_by: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={editForm.follow_up_date}
                            onChange={e => setEditForm(prev => ({ ...prev, follow_up_date: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300" colSpan={1}>
                          {truncate(action.description, 40)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{getTypeLabel(action.type)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(action.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[action.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {getStatusLabel(action.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{action.issued_by}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(action.follow_up_date)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{truncate(action.description, 40)}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {expandedId === action.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </>
                    )}
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === action.id && editingId !== action.id && (
                    <tr className="bg-gray-50 dark:bg-gray-700/20">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Full Description</h4>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{action.description || '—'}</p>
                          </div>
                          {action.outcome && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Outcome</h4>
                              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{action.outcome}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={e => { e.stopPropagation(); handleEdit(action); }}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(action.id); }}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Expanded edit row for description/outcome */}
                  {editingId === action.id && (
                    <tr className="bg-gray-50 dark:bg-gray-700/20">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                            <textarea
                              value={editForm.description}
                              onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Outcome</label>
                            <textarea
                              value={editForm.outcome}
                              onChange={e => setEditForm(prev => ({ ...prev, outcome: e.target.value }))}
                              rows={2}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
