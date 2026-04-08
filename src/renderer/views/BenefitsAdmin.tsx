import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Heart, Plus, Pencil, Trash2, X, ClipboardList, LayoutList } from 'lucide-react';

/* ────────────────────── Types ────────────────────── */

interface BenefitPlan {
  id: number;
  plan_name: string;
  plan_type: string;
  provider: string;
  plan_number: string;
  description: string;
  active: number;
  created_at: string;
}

interface Enrollment {
  id: number;
  employee_id: number;
  employee_name: string;
  current_department: string;
  plan_id: number;
  plan_name: string;
  plan_type: string;
  provider: string;
  enrollment_date: string;
  termination_date: string | null;
  coverage_level: string;
  employee_contribution: number;
  employer_contribution: number;
  status: string;
  created_at: string;
}

interface BenefitsStats {
  byType: { plan_type: string; enrolled: number; total_employee_cost: number; total_employer_cost: number }[];
  totalEnrolled: number;
}

interface Employee {
  id: number;
  employee_name: string;
}

/* ────────────────────── Constants ────────────────────── */

const PLAN_TYPES = ['health', 'dental', 'vision', '401k', 'fsa', 'hsa', 'life', 'disability', 'other'] as const;

const PLAN_TYPE_LABELS: Record<string, string> = {
  health: 'Health',
  dental: 'Dental',
  vision: 'Vision',
  '401k': '401(k)',
  fsa: 'FSA',
  hsa: 'HSA',
  life: 'Life',
  disability: 'Disability',
  other: 'Other',
};

const COVERAGE_LEVELS = ['employee', 'employee_spouse', 'employee_children', 'family'] as const;

const COVERAGE_LABELS: Record<string, string> = {
  employee: 'Employee Only',
  employee_spouse: 'Employee + Spouse',
  employee_children: 'Employee + Children',
  family: 'Family',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  terminated: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

function formatPlanType(t: string): string {
  return PLAN_TYPE_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1);
}

function formatCoverage(c: string): string {
  return COVERAGE_LABELS[c] || c;
}

function formatDate(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/* ────────────────────── Main Component ────────────────────── */

type Tab = 'plans' | 'enrollments';

export default function BenefitsAdmin() {
  const [tab, setTab] = useState<Tab>('plans');
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<BenefitsStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan form state
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BenefitPlan | null>(null);
  const [planForm, setPlanForm] = useState({ plan_name: '', plan_type: 'health', provider: '', plan_number: '', description: '', active: 1 });

  // Enrollment form state
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState({
    employee_id: '',
    plan_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
    coverage_level: 'employee',
    employee_contribution: '',
    employer_contribution: '',
  });

  // Enrollment filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.getBenefitPlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load benefit plans:', err);
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    try {
      const filters: any = {};
      if (typeFilter) filters.plan_type = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      const data = await api.getAllEnrollments(Object.keys(filters).length ? filters : undefined);
      setEnrollments(data);
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    }
  }, [typeFilter, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getBenefitsStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load benefits stats:', err);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.getAllEmployees({ status: 'active' });
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPlans(), loadEnrollments(), loadStats(), loadEmployees()]).finally(() => setLoading(false));
  }, [loadPlans, loadEnrollments, loadStats, loadEmployees]);

  useEffect(() => {
    loadEnrollments();
  }, [typeFilter, statusFilter, loadEnrollments]);

  /* ─── Plan CRUD ─── */

  const openNewPlanForm = () => {
    setEditingPlan(null);
    setPlanForm({ plan_name: '', plan_type: 'health', provider: '', plan_number: '', description: '', active: 1 });
    setShowPlanForm(true);
  };

  const openEditPlanForm = (plan: BenefitPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      plan_name: plan.plan_name,
      plan_type: plan.plan_type,
      provider: plan.provider || '',
      plan_number: plan.plan_number || '',
      description: plan.description || '',
      active: plan.active,
    });
    setShowPlanForm(true);
  };

  const savePlan = async () => {
    try {
      if (editingPlan) {
        await api.updateBenefitPlan(editingPlan.id, planForm);
      } else {
        await api.createBenefitPlan(planForm);
      }
      setShowPlanForm(false);
      setEditingPlan(null);
      await Promise.all([loadPlans(), loadStats()]);
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
  };

  const deletePlan = async (id: number) => {
    if (!confirm('Delete this plan? This will also remove all enrollments for this plan.')) return;
    try {
      await api.deleteBenefitPlan(id);
      await Promise.all([loadPlans(), loadEnrollments(), loadStats()]);
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const togglePlanActive = async (plan: BenefitPlan) => {
    try {
      await api.updateBenefitPlan(plan.id, { active: plan.active ? 0 : 1 });
      await Promise.all([loadPlans(), loadStats()]);
    } catch (err) {
      console.error('Failed to toggle plan:', err);
    }
  };

  /* ─── Enrollment CRUD ─── */

  const openNewEnrollmentForm = () => {
    setEditingEnrollment(null);
    setEnrollmentForm({
      employee_id: '',
      plan_id: '',
      enrollment_date: new Date().toISOString().split('T')[0],
      coverage_level: 'employee',
      employee_contribution: '',
      employer_contribution: '',
    });
    setShowEnrollmentForm(true);
  };

  const openEditEnrollmentForm = (e: Enrollment) => {
    setEditingEnrollment(e);
    setEnrollmentForm({
      employee_id: String(e.employee_id),
      plan_id: String(e.plan_id),
      enrollment_date: e.enrollment_date,
      coverage_level: e.coverage_level,
      employee_contribution: String(e.employee_contribution),
      employer_contribution: String(e.employer_contribution),
    });
    setShowEnrollmentForm(true);
  };

  const saveEnrollment = async () => {
    try {
      const payload = {
        employee_id: Number(enrollmentForm.employee_id),
        plan_id: Number(enrollmentForm.plan_id),
        enrollment_date: enrollmentForm.enrollment_date,
        coverage_level: enrollmentForm.coverage_level,
        employee_contribution: Number(enrollmentForm.employee_contribution) || 0,
        employer_contribution: Number(enrollmentForm.employer_contribution) || 0,
      };
      if (editingEnrollment) {
        await api.updateEnrollment(editingEnrollment.id, payload);
      } else {
        await api.createEnrollment(payload);
      }
      setShowEnrollmentForm(false);
      setEditingEnrollment(null);
      await Promise.all([loadEnrollments(), loadStats()]);
    } catch (err) {
      console.error('Failed to save enrollment:', err);
    }
  };

  const deleteEnrollment = async (id: number) => {
    if (!confirm('Delete this enrollment?')) return;
    try {
      await api.deleteEnrollment(id);
      await Promise.all([loadEnrollments(), loadStats()]);
    } catch (err) {
      console.error('Failed to delete enrollment:', err);
    }
  };

  /* ─── Computed stats ─── */

  const totalEmployeeCost = stats?.byType.reduce((s, t) => s + t.total_employee_cost, 0) ?? 0;
  const totalEmployerCost = stats?.byType.reduce((s, t) => s + t.total_employer_cost, 0) ?? 0;

  /* ─── Render ─── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-600" />
            Benefits Administration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage benefit plans and employee enrollments
          </p>
        </div>
        <button
          onClick={tab === 'plans' ? openNewPlanForm : openNewEnrollmentForm}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {tab === 'plans' ? 'Add Plan' : 'Add Enrollment'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {([
          { key: 'plans' as Tab, label: 'Plans', icon: ClipboardList },
          { key: 'enrollments' as Tab, label: 'Enrollments', icon: LayoutList },
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
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'plans' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Enrolled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats?.totalEnrolled ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Employee Cost (Monthly)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(totalEmployeeCost)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Employer Cost (Monthly)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(totalEmployerCost)}</p>
            </div>
          </div>

          {/* Cost breakdown by type */}
          {stats && stats.byType.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Enrollment by Plan Type</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {stats.byType.map(bt => (
                  <div key={bt.plan_type} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatPlanType(bt.plan_type)}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{bt.enrolled}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      EE: {formatCurrency(bt.total_employee_cost)} / ER: {formatCurrency(bt.total_employer_cost)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan form */}
          {showPlanForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {editingPlan ? 'Edit Plan' : 'New Benefit Plan'}
                </h3>
                <button onClick={() => { setShowPlanForm(false); setEditingPlan(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={planForm.plan_name}
                    onChange={e => setPlanForm(p => ({ ...p, plan_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan Type</label>
                  <select
                    value={planForm.plan_type}
                    onChange={e => setPlanForm(p => ({ ...p, plan_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {PLAN_TYPES.map(t => (
                      <option key={t} value={t}>{formatPlanType(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Provider</label>
                  <input
                    type="text"
                    value={planForm.provider}
                    onChange={e => setPlanForm(p => ({ ...p, provider: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan Number</label>
                  <input
                    type="text"
                    value={planForm.plan_number}
                    onChange={e => setPlanForm(p => ({ ...p, plan_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={planForm.description}
                    onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={savePlan}
                  disabled={!planForm.plan_name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
                <button
                  onClick={() => { setShowPlanForm(false); setEditingPlan(null); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Plans table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading plans...</div>
            ) : plans.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No benefit plans found. Add your first plan above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Number</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{plan.plan_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatPlanType(plan.plan_type)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{plan.provider || '\u2014'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{plan.plan_number || '\u2014'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePlanActive(plan)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            plan.active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              plan.active ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditPlanForm(plan)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                            title="Edit plan"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                            title="Delete plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'enrollments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Types</option>
              {PLAN_TYPES.map(t => (
                <option key={t} value={t}>{formatPlanType(t)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="terminated">Terminated</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Enrollment form */}
          {showEnrollmentForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {editingEnrollment ? 'Edit Enrollment' : 'New Enrollment'}
                </h3>
                <button onClick={() => { setShowEnrollmentForm(false); setEditingEnrollment(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employee</label>
                  <select
                    value={enrollmentForm.employee_id}
                    onChange={e => setEnrollmentForm(f => ({ ...f, employee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan</label>
                  <select
                    value={enrollmentForm.plan_id}
                    onChange={e => setEnrollmentForm(f => ({ ...f, plan_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select plan...</option>
                    {plans.filter(p => p.active).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.plan_name} ({formatPlanType(p.plan_type)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Enrollment Date</label>
                  <input
                    type="date"
                    value={enrollmentForm.enrollment_date}
                    onChange={e => setEnrollmentForm(f => ({ ...f, enrollment_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Coverage Level</label>
                  <select
                    value={enrollmentForm.coverage_level}
                    onChange={e => setEnrollmentForm(f => ({ ...f, coverage_level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {COVERAGE_LEVELS.map(c => (
                      <option key={c} value={c}>{formatCoverage(c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employee Contribution</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={enrollmentForm.employee_contribution}
                    onChange={e => setEnrollmentForm(f => ({ ...f, employee_contribution: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employer Contribution</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={enrollmentForm.employer_contribution}
                    onChange={e => setEnrollmentForm(f => ({ ...f, employer_contribution: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={saveEnrollment}
                  disabled={!enrollmentForm.employee_id || !enrollmentForm.plan_id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editingEnrollment ? 'Save Changes' : 'Create Enrollment'}
                </button>
                <button
                  onClick={() => { setShowEnrollmentForm(false); setEditingEnrollment(null); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Enrollments table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading enrollments...</div>
            ) : enrollments.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No enrollments found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Coverage Level</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee $</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employer $</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Enrolled Date</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {enrollments.map(enr => (
                    <tr key={enr.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{enr.employee_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        <div>{enr.plan_name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{formatPlanType(enr.plan_type)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatCoverage(enr.coverage_level)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(enr.employee_contribution)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(enr.employer_contribution)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[enr.status] || STATUS_STYLES.pending}`}>
                          {enr.status.charAt(0).toUpperCase() + enr.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(enr.enrollment_date)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditEnrollmentForm(enr)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                            title="Edit enrollment"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteEnrollment(enr.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                            title="Delete enrollment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
