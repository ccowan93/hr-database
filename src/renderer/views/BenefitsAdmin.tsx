import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import ComboSelect from '../components/ComboSelect';
import { Plus, Pencil, Trash2 } from 'lucide-react';

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

const STATUS_BADGE: Record<string, string> = {
  active: 'badge success',
  terminated: 'badge',
  pending: 'badge warn',
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
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Benefits administration</h1>
          <p className="page-subtitle">Manage benefit plans and employee enrollments</p>
        </div>
        <button onClick={tab === 'plans' ? openNewPlanForm : openNewEnrollmentForm} className="btn primary">
          <Plus />
          {tab === 'plans' ? 'Add plan' : 'Add enrollment'}
        </button>
      </div>

      {tab === 'plans' && (
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Total Enrolled</div>
            <div className="stat-value">{stats?.totalEnrolled ?? 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Employee Cost (Monthly)</div>
            <div className="stat-value">{formatCurrency(totalEmployeeCost)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Employer Cost (Monthly)</div>
            <div className="stat-value">{formatCurrency(totalEmployerCost)}</div>
          </div>
        </div>
      )}

      <div className="tab-row">
        {([
          { key: 'plans' as Tab, label: 'Plans' },
          { key: 'enrollments' as Tab, label: 'Enrollments' },
        ]).map(t => (
          <button key={t.key} className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <>
          {stats && stats.byType.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div className="field-label" style={{ marginBottom: 10 }}>Enrollment by Plan Type</div>
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {stats.byType.map(bt => (
                  <div key={bt.plan_type} className="stat">
                    <div className="stat-label">{formatPlanType(bt.plan_type)}</div>
                    <div className="stat-value">{bt.enrolled}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      EE: {formatCurrency(bt.total_employee_cost)} / ER: {formatCurrency(bt.total_employer_cost)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <span className="muted">Loading…</span>
            </div>
          ) : plans.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0 }}>No benefit plans found. Add your first plan above.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Type</th>
                    <th>Provider</th>
                    <th>Plan Number</th>
                    <th style={{ textAlign: 'center' }}>Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(plan => (
                    <tr key={plan.id}>
                      <td style={{ fontWeight: 500 }}>{plan.plan_name}</td>
                      <td>{formatPlanType(plan.plan_type)}</td>
                      <td className="muted">{plan.provider || '\u2014'}</td>
                      <td className="muted">{plan.plan_number || '\u2014'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => togglePlanActive(plan)}
                          className={`kin-switch${plan.active ? ' on' : ''}`}
                          aria-pressed={!!plan.active}
                          aria-label="Toggle plan active"
                        >
                          <span className="kin-switch-thumb" />
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditPlanForm(plan)}
                            className="icon-btn"
                            title="Edit plan"
                            type="button"
                          >
                            <Pencil />
                          </button>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="icon-btn"
                            title="Delete plan"
                            type="button"
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'enrollments' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div className="grid-2">
              <label className="field">
                <span className="field-label">Plan Type</span>
                <ComboSelect
                  value={typeFilter}
                  options={PLAN_TYPES.map(t => ({ value: t, label: formatPlanType(t) }))}
                  onChange={setTypeFilter}
                  includeNone={true}
                  noneLabel="All types"
                  searchable={false}
                />
              </label>
              <label className="field">
                <span className="field-label">Status</span>
                <ComboSelect
                  value={statusFilter}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'terminated', label: 'Terminated' },
                    { value: 'pending', label: 'Pending' },
                  ]}
                  onChange={setStatusFilter}
                  includeNone={true}
                  noneLabel="All statuses"
                  searchable={false}
                />
              </label>
            </div>
            {(typeFilter || statusFilter) && (
              <div className="hstack" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setTypeFilter(''); setStatusFilter(''); }}
                  className="btn ghost"
                  style={{ color: 'var(--danger)' }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <span className="muted">Loading…</span>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0 }}>No enrollments found.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Plan</th>
                    <th>Coverage Level</th>
                    <th style={{ textAlign: 'right' }}>Employee $</th>
                    <th style={{ textAlign: 'right' }}>Employer $</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Enrolled Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enr => (
                    <tr key={enr.id}>
                      <td style={{ fontWeight: 500 }}>{enr.employee_name}</td>
                      <td>
                        <div>{enr.plan_name}</div>
                        <div className="small muted">{formatPlanType(enr.plan_type)}</div>
                      </td>
                      <td>{formatCoverage(enr.coverage_level)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(enr.employee_contribution)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(enr.employer_contribution)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={STATUS_BADGE[enr.status] || 'badge warn'}>
                          {enr.status.charAt(0).toUpperCase() + enr.status.slice(1)}
                        </span>
                      </td>
                      <td className="muted">{formatDate(enr.enrollment_date)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditEnrollmentForm(enr)}
                            className="icon-btn"
                            title="Edit enrollment"
                            type="button"
                          >
                            <Pencil />
                          </button>
                          <button
                            onClick={() => deleteEnrollment(enr.id)}
                            className="icon-btn"
                            title="Delete enrollment"
                            type="button"
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showPlanForm && (
        <div
          className="kin-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) { setShowPlanForm(false); setEditingPlan(null); } }}
        >
          <div className="kin-modal" style={{ maxWidth: 720 }}>
            <div className="kin-modal-head">
              <h2 className="kin-modal-title">{editingPlan ? 'Edit Plan' : 'New Benefit Plan'}</h2>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); savePlan(); }}
              className="kin-modal-body"
            >
              <div className="grid-3">
                <label className="field">
                  <span className="field-label">Plan Name *</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.plan_name}
                    onChange={e => setPlanForm(p => ({ ...p, plan_name: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Plan Type</span>
                  <ComboSelect
                    value={planForm.plan_type}
                    options={PLAN_TYPES.map(t => ({ value: t, label: formatPlanType(t) }))}
                    onChange={v => setPlanForm(p => ({ ...p, plan_type: v || 'health' }))}
                    includeNone={false}
                    searchable={false}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Provider</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.provider}
                    onChange={e => setPlanForm(p => ({ ...p, provider: e.target.value }))}
                  />
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span className="field-label">Plan Number</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.plan_number}
                    onChange={e => setPlanForm(p => ({ ...p, plan_number: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Description</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.description}
                    onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                  />
                </label>
              </div>

              <div className="kin-modal-foot">
                <button
                  type="button"
                  onClick={() => { setShowPlanForm(false); setEditingPlan(null); }}
                  className="btn ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!planForm.plan_name.trim()}
                  className="btn primary"
                >
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEnrollmentForm && (
        <div
          className="kin-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) { setShowEnrollmentForm(false); setEditingEnrollment(null); } }}
        >
          <div className="kin-modal" style={{ maxWidth: 720 }}>
            <div className="kin-modal-head">
              <h2 className="kin-modal-title">{editingEnrollment ? 'Edit Enrollment' : 'New Enrollment'}</h2>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); saveEnrollment(); }}
              className="kin-modal-body"
            >
              <div className="grid-3">
                <label className="field">
                  <span className="field-label">Employee *</span>
                  <ComboSelect
                    value={enrollmentForm.employee_id}
                    options={employees.map(emp => ({ value: String(emp.id), label: emp.employee_name }))}
                    onChange={v => setEnrollmentForm(f => ({ ...f, employee_id: v }))}
                    placeholder="Select employee..."
                    includeNone={true}
                    noneLabel="Select employee..."
                  />
                </label>
                <label className="field">
                  <span className="field-label">Plan *</span>
                  <ComboSelect
                    value={enrollmentForm.plan_id}
                    options={plans.filter(p => p.active).map(p => ({ value: String(p.id), label: `${p.plan_name} (${formatPlanType(p.plan_type)})` }))}
                    onChange={v => setEnrollmentForm(f => ({ ...f, plan_id: v }))}
                    placeholder="Select plan..."
                    includeNone={true}
                    noneLabel="Select plan..."
                  />
                </label>
                <label className="field">
                  <span className="field-label">Enrollment Date</span>
                  <input
                    type="date"
                    className="input"
                    value={enrollmentForm.enrollment_date}
                    onChange={e => setEnrollmentForm(f => ({ ...f, enrollment_date: e.target.value }))}
                  />
                </label>
              </div>
              <div className="grid-3">
                <label className="field">
                  <span className="field-label">Coverage Level</span>
                  <ComboSelect
                    value={enrollmentForm.coverage_level}
                    options={COVERAGE_LEVELS.map(c => ({ value: c, label: formatCoverage(c) }))}
                    onChange={v => setEnrollmentForm(f => ({ ...f, coverage_level: v || 'employee' }))}
                    includeNone={false}
                    searchable={false}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Employee Contribution</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={enrollmentForm.employee_contribution}
                    onChange={e => setEnrollmentForm(f => ({ ...f, employee_contribution: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Employer Contribution</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={enrollmentForm.employer_contribution}
                    onChange={e => setEnrollmentForm(f => ({ ...f, employer_contribution: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
              </div>

              <div className="kin-modal-foot">
                <button
                  type="button"
                  onClick={() => { setShowEnrollmentForm(false); setEditingEnrollment(null); }}
                  className="btn ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!enrollmentForm.employee_id || !enrollmentForm.plan_id}
                  className="btn primary"
                >
                  {editingEnrollment ? 'Save Changes' : 'Create Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
