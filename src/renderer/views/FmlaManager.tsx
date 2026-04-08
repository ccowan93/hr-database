import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { ShieldCheck, AlertTriangle, Plus, ArrowLeft, Trash2, Clock, FileText, CheckCircle2, XCircle, Search } from 'lucide-react';

/* ────────────────────── Types ────────────────────── */

interface FmlaCase {
  id: number;
  employee_id: number;
  employee_name?: string;
  reason: string;
  family_member: string | null;
  leave_type: string;
  status: string;
  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  entitlement_hours: number;
  used_hours: number;
  leave_year_start: string;
  cert_status: string;
  cert_due_date: string | null;
  cert_received_date: string | null;
  recert_due_date: string | null;
  fitness_for_duty: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FmlaEpisode {
  id: number;
  fmla_case_id: number;
  date: string;
  hours_used: number;
  time_off_request_id: number | null;
  notes: string | null;
  created_at: string;
}

interface FmlaAlert {
  type: string;
  severity: string;
  message: string;
  case_id: number;
  employee_name: string;
}

interface FmlaConfig {
  leave_year_method: string;
  fixed_year_start: string;
  eligibility_months: number;
  eligibility_hours: number;
}

interface EligibilityResult {
  eligible: boolean;
  employeeName: string;
  monthsEmployed: number;
  hoursWorked: number;
  reasons: string[];
}

/* ────────────────────── Constants ────────────────────── */

const FMLA_REASONS: { value: string; label: string }[] = [
  { value: 'serious_health_condition', label: 'Serious Health Condition (Employee)' },
  { value: 'family_care', label: 'Care for Family Member' },
  { value: 'birth_child', label: 'Birth/Care of Newborn' },
  { value: 'adoption_foster', label: 'Adoption/Foster Care Placement' },
  { value: 'qualifying_exigency', label: 'Military Qualifying Exigency' },
  { value: 'military_caregiver', label: 'Military Caregiver Leave' },
];

const LEAVE_TYPES: { value: string; label: string }[] = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'reduced_schedule', label: 'Reduced Schedule' },
];

const CERT_STATUSES: { value: string; label: string }[] = [
  { value: 'not_requested', label: 'Not Requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'received', label: 'Received' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending_designation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  exhausted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
};

function getReasonLabel(value: string): string {
  return FMLA_REASONS.find(r => r.value === value)?.label || value;
}

function getLeaveTypeLabel(value: string): string {
  return LEAVE_TYPES.find(t => t.value === value)?.label || value;
}

function getCertStatusLabel(value: string): string {
  return CERT_STATUSES.find(s => s.value === value)?.label || value;
}

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ────────────────────── Main Component ────────────────────── */

type Tab = 'cases' | 'alerts' | 'settings';

export default function FmlaManager() {
  const [tab, setTab] = useState<Tab>('cases');
  const [cases, setCases] = useState<FmlaCase[]>([]);
  const [alerts, setAlerts] = useState<FmlaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  // Case detail / form state
  const [selectedCase, setSelectedCase] = useState<FmlaCase | null>(null);
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await api.getFmlaCases(filters);
      setCases(data);
    } catch (err) {
      console.error('Failed to load FMLA cases:', err);
    }
    setLoading(false);
  }, [statusFilter]);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.getFmlaAlerts();
      setAlerts(data);
      setAlertCount(data.length);
    } catch (err) {
      console.error('Failed to load FMLA alerts:', err);
    }
  }, []);

  useEffect(() => { loadCases(); loadAlerts(); }, [loadCases, loadAlerts]);

  const filteredCases = searchQuery
    ? cases.filter(c =>
        (c.employee_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        getReasonLabel(c.reason).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cases;

  const handleCaseCreated = () => {
    setShowNewCaseForm(false);
    loadCases();
    loadAlerts();
  };

  const handleCaseUpdated = async () => {
    loadCases();
    loadAlerts();
    if (selectedCase) {
      try {
        const updated = await api.getFmlaCase(selectedCase.id);
        setSelectedCase(updated);
      } catch {}
    }
  };

  /* ─── Render detail view ─── */
  if (selectedCase) {
    return (
      <CaseDetail
        fmlaCase={selectedCase}
        onBack={() => setSelectedCase(null)}
        onUpdated={handleCaseUpdated}
      />
    );
  }

  /* ─── Render new case form ─── */
  if (showNewCaseForm) {
    return (
      <NewCaseForm
        onCancel={() => setShowNewCaseForm(false)}
        onCreated={handleCaseCreated}
      />
    );
  }

  /* ─── Main list view ─── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            FMLA Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track Family and Medical Leave Act cases, episodes, and compliance
          </p>
        </div>
        <button
          onClick={() => setShowNewCaseForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {([
          { key: 'cases' as Tab, label: 'Cases', icon: FileText },
          { key: 'alerts' as Tab, label: 'Alerts', icon: AlertTriangle, badge: alertCount },
          { key: 'settings' as Tab, label: 'Settings', icon: Clock },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge ? (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'cases' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee or reason..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Statuses</option>
              <option value="pending_designation">Pending Designation</option>
              <option value="active">Active</option>
              <option value="exhausted">Exhausted</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Cases table */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No FMLA cases found</p>
              <button
                onClick={() => setShowNewCaseForm(true)}
                className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Create a new case
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Leave Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Hours Used</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Certification</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Start Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(c => {
                    const pct = c.entitlement_hours > 0 ? (c.used_hours / c.entitlement_hours) * 100 : 0;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.employee_name || `Employee #${c.employee_id}`}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{getReasonLabel(c.reason)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{getLeaveTypeLabel(c.leave_type)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status] || STATUS_STYLES.closed}`}>
                            {formatStatus(c.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {c.used_hours}/{c.entitlement_hours}h
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{getCertStatusLabel(c.cert_status)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(c.start_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'alerts' && <AlertsPanel alerts={alerts} onOpenCase={(id) => {
        const c = cases.find(cs => cs.id === id);
        if (c) setSelectedCase(c);
        else api.getFmlaCase(id).then(setSelectedCase).catch(() => {});
      }} />}

      {tab === 'settings' && <SettingsPanel />}
    </div>
  );
}

/* ────────────────────── Alerts Panel ────────────────────── */

function AlertsPanel({ alerts, onOpenCase }: { alerts: FmlaAlert[]; onOpenCase: (id: number) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">No active alerts</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All FMLA cases are in good standing</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`border-l-4 rounded-lg p-4 ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                alert.severity === 'critical' ? 'text-red-500' :
                alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
              }`} />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{alert.employee_name}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{alert.message}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenCase(alert.case_id)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
            >
              View Case
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── Settings Panel ────────────────────── */

function SettingsPanel() {
  const [config, setConfig] = useState<FmlaConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getFmlaConfig().then(setConfig).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.updateFmlaConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save FMLA config:', err);
    }
    setSaving(false);
  };

  if (!config) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">FMLA Configuration</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Year Calculation Method</label>
          <select
            value={config.leave_year_method}
            onChange={e => setConfig({ ...config, leave_year_method: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="rolling_backward">Rolling Backward (12 months from current date)</option>
            <option value="rolling_forward">Rolling Forward (12 months from first FMLA use)</option>
            <option value="calendar_year">Calendar Year (Jan 1 - Dec 31)</option>
            <option value="fixed_year">Fixed Year (custom start date)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Determines how the 12-month FMLA leave year is calculated</p>
        </div>

        {config.leave_year_method === 'fixed_year' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fixed Year Start (MM-DD)</label>
            <input
              type="text"
              value={config.fixed_year_start}
              onChange={e => setConfig({ ...config, fixed_year_start: e.target.value })}
              placeholder="01-01"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Eligibility — Months Employed</label>
            <input
              type="number"
              value={config.eligibility_months}
              onChange={e => setConfig({ ...config, eligibility_months: parseInt(e.target.value) || 12 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 12 months</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Eligibility — Hours Worked</label>
            <input
              type="number"
              value={config.eligibility_hours}
              onChange={e => setConfig({ ...config, eligibility_hours: parseInt(e.target.value) || 1250 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 1,250 hours</p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── New Case Form ────────────────────── */

function NewCaseForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [employees, setEmployees] = useState<{ id: number; employee_name: string }[]>([]);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [reason, setReason] = useState('serious_health_condition');
  const [familyMember, setFamilyMember] = useState('');
  const [leaveType, setLeaveType] = useState('continuous');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [entitlementHours, setEntitlementHours] = useState(480);
  const [certDueDate, setCertDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name })));
    });
  }, []);

  // Check eligibility when employee changes
  useEffect(() => {
    if (!employeeId) { setEligibility(null); return; }
    setCheckingEligibility(true);
    api.checkFmlaEligibility(employeeId)
      .then(setEligibility)
      .catch(() => setEligibility(null))
      .finally(() => setCheckingEligibility(false));
  }, [employeeId]);

  const needsFamilyMember = ['family_care', 'military_caregiver'].includes(reason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !startDate) return;
    setSubmitting(true);
    try {
      await api.createFmlaCase({
        employee_id: employeeId,
        reason,
        family_member: needsFamilyMember ? familyMember : null,
        leave_type: leaveType,
        start_date: startDate,
        expected_end_date: expectedEndDate || null,
        entitlement_hours: entitlementHours,
        cert_due_date: certDueDate || null,
        notes: notes || null,
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create FMLA case:', err);
      alert('Failed to create FMLA case');
    }
    setSubmitting(false);
  };

  const filteredEmployees = empSearch
    ? employees.filter(e => e.employee_name.toLowerCase().includes(empSearch.toLowerCase()))
    : employees;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New FMLA Case</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-3xl space-y-5">
        {/* Employee Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={empSearch}
              onChange={e => { setEmpSearch(e.target.value); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-1"
            />
          </div>
          <select
            value={employeeId}
            onChange={e => setEmployeeId(parseInt(e.target.value))}
            size={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={0}>— Select Employee —</option>
            {filteredEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.employee_name}</option>
            ))}
          </select>
        </div>

        {/* Eligibility check */}
        {employeeId > 0 && (
          <div className={`p-3 rounded-lg text-sm ${
            checkingEligibility ? 'bg-gray-100 dark:bg-gray-700 text-gray-500' :
            eligibility?.eligible ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' :
            'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {checkingEligibility ? (
              'Checking eligibility...'
            ) : eligibility ? (
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {eligibility.eligible ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {eligibility.eligible ? 'Eligible for FMLA' : 'Not Eligible for FMLA'}
                </div>
                <div className="mt-1 text-xs space-y-0.5">
                  <p>Months employed: {eligibility.monthsEmployed} (required: 12)</p>
                  <p>Hours worked (12 mo): {eligibility.hoursWorked.toLocaleString()} (required: 1,250)</p>
                  {!eligibility.eligible && eligibility.reasons.map((r, i) => (
                    <p key={i} className="text-red-600 dark:text-red-400">{r}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {FMLA_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type *</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {needsFamilyMember && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Family Member Name</label>
            <input
              type="text"
              value={familyMember}
              onChange={e => setFamilyMember(e.target.value)}
              placeholder="Name and relationship"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected End Date</label>
            <input
              type="date"
              value={expectedEndDate}
              onChange={e => setExpectedEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entitlement (hours)</label>
            <input
              type="number"
              value={entitlementHours}
              onChange={e => setEntitlementHours(parseInt(e.target.value) || 480)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1">Standard: 480 hours (12 weeks)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certification Due Date</label>
          <input
            type="date"
            value={certDueDate}
            onChange={e => setCertDueDate(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-400 mt-1">Typically 15 calendar days from designation</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !employeeId || !startDate}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Case'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ────────────────────── Case Detail ────────────────────── */

function CaseDetail({ fmlaCase, onBack, onUpdated }: { fmlaCase: FmlaCase; onBack: () => void; onUpdated: () => void }) {
  const [episodes, setEpisodes] = useState<FmlaEpisode[]>([]);
  const [caseData, setCaseData] = useState(fmlaCase);
  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [status, setStatus] = useState(fmlaCase.status);
  const [certStatus, setCertStatus] = useState(fmlaCase.cert_status);
  const [certReceivedDate, setCertReceivedDate] = useState(fmlaCase.cert_received_date || '');
  const [recertDueDate, setRecertDueDate] = useState(fmlaCase.recert_due_date || '');
  const [actualEndDate, setActualEndDate] = useState(fmlaCase.actual_end_date || '');
  const [fitnessForDuty, setFitnessForDuty] = useState(!!fmlaCase.fitness_for_duty);
  const [caseNotes, setCaseNotes] = useState(fmlaCase.notes || '');
  const [saving, setSaving] = useState(false);

  // Episode form
  const [epDate, setEpDate] = useState('');
  const [epHours, setEpHours] = useState(8);
  const [epNotes, setEpNotes] = useState('');
  const [addingEpisode, setAddingEpisode] = useState(false);

  const loadEpisodes = useCallback(async () => {
    try {
      const data = await api.getFmlaEpisodes(fmlaCase.id);
      setEpisodes(data);
    } catch (err) {
      console.error('Failed to load episodes:', err);
    }
  }, [fmlaCase.id]);

  const refreshCase = useCallback(async () => {
    try {
      const updated = await api.getFmlaCase(fmlaCase.id);
      setCaseData(updated);
    } catch {}
  }, [fmlaCase.id]);

  useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

  const pct = caseData.entitlement_hours > 0 ? (caseData.used_hours / caseData.entitlement_hours) * 100 : 0;
  const remainingHours = Math.max(0, caseData.entitlement_hours - caseData.used_hours);

  const handleSaveCase = async () => {
    setSaving(true);
    try {
      await api.updateFmlaCase(fmlaCase.id, {
        status,
        cert_status: certStatus,
        cert_received_date: certReceivedDate || null,
        recert_due_date: recertDueDate || null,
        actual_end_date: actualEndDate || null,
        fitness_for_duty: fitnessForDuty ? 1 : 0,
        notes: caseNotes || null,
      });
      await refreshCase();
      setEditing(false);
      onUpdated();
    } catch (err) {
      console.error('Failed to update case:', err);
    }
    setSaving(false);
  };

  const handleAddEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epDate || epHours <= 0) return;
    setAddingEpisode(true);
    try {
      await api.addFmlaEpisode({
        fmla_case_id: fmlaCase.id,
        date: epDate,
        hours_used: epHours,
        notes: epNotes || undefined,
      });
      setShowAddEpisode(false);
      setEpDate('');
      setEpHours(8);
      setEpNotes('');
      await loadEpisodes();
      await refreshCase();
      onUpdated();
    } catch (err) {
      console.error('Failed to add episode:', err);
    }
    setAddingEpisode(false);
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!confirm('Delete this episode?')) return;
    try {
      await api.deleteFmlaEpisode(id);
      await loadEpisodes();
      await refreshCase();
      onUpdated();
    } catch (err) {
      console.error('Failed to delete episode:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {caseData.employee_name || `Employee #${caseData.employee_id}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            FMLA Case #{caseData.id} &middot; {getReasonLabel(caseData.reason)}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[caseData.status] || STATUS_STYLES.closed}`}>
          {formatStatus(caseData.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Case details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Case Details</h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCase}
                    disabled={saving}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <option value="pending_designation">Pending Designation</option>
                      <option value="active">Active</option>
                      <option value="exhausted">Exhausted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Certification Status</label>
                    <select value={certStatus} onChange={e => setCertStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      {CERT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cert Received Date</label>
                    <input type="date" value={certReceivedDate} onChange={e => setCertReceivedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recertification Due Date</label>
                    <input type="date" value={recertDueDate} onChange={e => setRecertDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Actual End Date</label>
                    <input type="date" value={actualEndDate} onChange={e => setActualEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={fitnessForDuty} onChange={e => setFitnessForDuty(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      Fitness for Duty Received
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                  <textarea value={caseNotes} onChange={e => setCaseNotes(e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Reason</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{getReasonLabel(caseData.reason)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Leave Type</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{getLeaveTypeLabel(caseData.leave_type)}</p>
                </div>
                {caseData.family_member && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Family Member</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{caseData.family_member}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Start Date</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.start_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Expected End</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.expected_end_date)}</p>
                </div>
                {caseData.actual_end_date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Actual End</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.actual_end_date)}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Certification</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{getCertStatusLabel(caseData.cert_status)}</p>
                </div>
                {caseData.cert_due_date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cert Due Date</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.cert_due_date)}</p>
                  </div>
                )}
                {caseData.cert_received_date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cert Received</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.cert_received_date)}</p>
                  </div>
                )}
                {caseData.recert_due_date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Recert Due</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.recert_due_date)}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Leave Year Start</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(caseData.leave_year_start)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Fitness for Duty</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{caseData.fitness_for_duty ? 'Yes' : 'No'}</p>
                </div>
                {caseData.notes && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Notes</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{caseData.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Episodes list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Leave Episodes</h2>
              <button
                onClick={() => setShowAddEpisode(!showAddEpisode)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Hours
              </button>
            </div>

            {showAddEpisode && (
              <form onSubmit={handleAddEpisode} className="mb-4 p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
                    <input type="date" value={epDate} onChange={e => setEpDate(e.target.value)} required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hours *</label>
                    <input type="number" step="0.5" min="0.5" max="24" value={epHours} onChange={e => setEpHours(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                    <input type="text" value={epNotes} onChange={e => setEpNotes(e.target.value)} placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={addingEpisode}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50">
                    {addingEpisode ? 'Adding...' : 'Add Episode'}
                  </button>
                  <button type="button" onClick={() => setShowAddEpisode(false)}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {episodes.length === 0 ? (
              <p className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">No episodes logged yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Hours</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                    <th className="text-right py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map(ep => (
                    <tr key={ep.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 text-gray-900 dark:text-gray-100">{formatDate(ep.date)}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-300">{ep.hours_used}h</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{ep.notes || '—'}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => handleDeleteEpisode(ep.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: Usage gauge */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Leave Entitlement</h3>
            {/* Circular-ish gauge */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10"
                    className="text-gray-200 dark:text-gray-700" />
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(pct, 100) / 100)}`}
                    strokeLinecap="round"
                    className={`${pct >= 80 ? 'text-red-500' : pct >= 50 ? 'text-yellow-500' : 'text-blue-500'} transition-all duration-500`}
                    stroke="currentColor"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(pct)}%</span>
                  <span className="text-xs text-gray-500">used</span>
                </div>
              </div>
              <div className="mt-4 text-center space-y-1">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{caseData.used_hours}</span> of <span className="font-semibold">{caseData.entitlement_hours}</span> hours used
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-semibold">{remainingHours}</span> hours remaining
                </p>
                <p className="text-xs text-gray-400">
                  ≈ {(remainingHours / 8).toFixed(1)} days remaining
                </p>
              </div>
            </div>
          </div>

          {/* Key dates */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Key Dates</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Leave Year Start</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(caseData.leave_year_start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Case Start</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(caseData.start_date)}</span>
              </div>
              {caseData.expected_end_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Expected End</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(caseData.expected_end_date)}</span>
                </div>
              )}
              {caseData.cert_due_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cert Due</span>
                  <span className={`font-medium ${
                    caseData.cert_status !== 'received' && caseData.cert_status !== 'approved' && new Date(caseData.cert_due_date) < new Date()
                      ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {formatDate(caseData.cert_due_date)}
                  </span>
                </div>
              )}
              {caseData.recert_due_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Recert Due</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(caseData.recert_due_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Episode Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Episodes</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{episodes.length}</span>
              </div>
              {episodes.length > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">First Episode</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(episodes[episodes.length - 1]?.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Episode</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(episodes[0]?.date)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
