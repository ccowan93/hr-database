import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import ComboSelect from '../components/ComboSelect';
import FmlaCaseForm from '../components/FmlaCaseForm';
import { ShieldCheck, AlertTriangle, Plus, ArrowLeft, Trash2, CheckCircle2 } from 'lucide-react';

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

const STATUS_BADGE: Record<string, string> = {
  active: 'badge success',
  pending_designation: 'badge warn',
  exhausted: 'badge danger',
  closed: 'badge',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'kin-alert danger',
  warning: 'kin-alert warn',
  info: 'kin-alert info',
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

  const filteredCases = cases
    .filter(c => !searchQuery ||
      (c.employee_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      getReasonLabel(c.reason).toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(c => !statusFilter || c.status === statusFilter);

  const statCounts = {
    total: cases.length,
    active: cases.filter(c => c.status === 'active').length,
    pending: cases.filter(c => c.status === 'pending_designation').length,
    closed: cases.filter(c => c.status === 'closed' || c.status === 'exhausted').length,
  };

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

  /* ─── Main list view ─── */
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">FMLA management</h1>
          <p className="page-subtitle">Track Family and Medical Leave Act cases, episodes, and compliance</p>
        </div>
        <button onClick={() => setShowNewCaseForm(true)} className="btn primary">
          <Plus />
          New case
        </button>
      </div>

      {tab === 'cases' && (
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Total</div>
            <div className="stat-value">{statCounts.total}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Active</div>
            <div className="stat-value">{statCounts.active}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{statCounts.pending}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Closed</div>
            <div className="stat-value">{statCounts.closed}</div>
          </div>
        </div>
      )}

      <div className="tab-row">
        {([
          { key: 'cases' as Tab, label: 'Cases' },
          { key: 'alerts' as Tab, label: 'Alerts', badge: alertCount },
          { key: 'settings' as Tab, label: 'Settings' },
        ]).map(t => (
          <button key={t.key} className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.badge ? <span className="badge danger" style={{ marginLeft: 6 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'cases' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div className="grid-2">
              <label className="field">
                <span className="field-label">Search</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Employee or reason..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Status</span>
                <ComboSelect
                  value={statusFilter}
                  options={[
                    { value: 'pending_designation', label: 'Pending Designation' },
                    { value: 'active', label: 'Active' },
                    { value: 'exhausted', label: 'Exhausted' },
                    { value: 'closed', label: 'Closed' },
                  ]}
                  onChange={setStatusFilter}
                  includeNone={true}
                  noneLabel="All statuses"
                  searchable={false}
                />
              </label>
            </div>
            {(searchQuery || statusFilter) && (
              <div className="hstack" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
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
          ) : filteredCases.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <ShieldCheck style={{ width: 40, height: 40, margin: '0 auto 10px', color: 'var(--ink-4)' }} />
              <p className="muted" style={{ margin: 0 }}>No FMLA cases found</p>
              <button
                onClick={() => setShowNewCaseForm(true)}
                className="btn ghost"
                style={{ marginTop: 10, color: 'var(--accent-ink)' }}
              >
                Create a new case
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Reason</th>
                    <th>Leave Type</th>
                    <th>Status</th>
                    <th>Hours Used</th>
                    <th>Certification</th>
                    <th>Start Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(c => {
                    const pct = c.entitlement_hours > 0 ? (c.used_hours / c.entitlement_hours) * 100 : 0;
                    const barColor = pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--warn)' : 'var(--accent)';
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className="clickable"
                      >
                        <td style={{ fontWeight: 500 }}>{c.employee_name || `Employee #${c.employee_id}`}</td>
                        <td>{getReasonLabel(c.reason)}</td>
                        <td>{getLeaveTypeLabel(c.leave_type)}</td>
                        <td>
                          <span className={STATUS_BADGE[c.status] || 'badge'}>
                            {formatStatus(c.status)}
                          </span>
                        </td>
                        <td>
                          <div className="hstack" style={{ gap: 8 }}>
                            <div style={{ width: 80, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--line)' }}>
                              <div style={{ height: '100%', borderRadius: 99, background: barColor, width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="mono small muted" style={{ whiteSpace: 'nowrap' }}>
                              {c.used_hours}/{c.entitlement_hours}h
                            </span>
                          </div>
                        </td>
                        <td className="small">{getCertStatusLabel(c.cert_status)}</td>
                        <td className="muted">{formatDate(c.start_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'alerts' && <AlertsPanel alerts={alerts} onOpenCase={(id) => {
        const c = cases.find(cs => cs.id === id);
        if (c) setSelectedCase(c);
        else api.getFmlaCase(id).then(setSelectedCase).catch(() => {});
      }} />}

      {tab === 'settings' && <SettingsPanel />}

      {showNewCaseForm && (
        <FmlaCaseForm
          onSubmit={handleCaseCreated}
          onCancel={() => setShowNewCaseForm(false)}
        />
      )}
    </div>
  );
}

/* ────────────────────── Alerts Panel ────────────────────── */

function AlertsPanel({ alerts, onOpenCase }: { alerts: FmlaAlert[]; onOpenCase: (id: number) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <CheckCircle2 style={{ width: 40, height: 40, margin: '0 auto 10px', color: 'var(--success)' }} />
        <p className="muted" style={{ margin: 0, fontWeight: 500 }}>No active alerts</p>
        <p className="small muted" style={{ marginTop: 4 }}>All FMLA cases are in good standing</p>
      </div>
    );
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      {alerts.map((alert, i) => {
        const iconColor =
          alert.severity === 'critical' ? 'var(--danger)' :
          alert.severity === 'warning' ? 'var(--warn)' : 'var(--accent)';
        return (
          <div
            key={i}
            className={SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info}
          >
            <div className="hstack" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div className="hstack" style={{ alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, color: iconColor }} />
                <div>
                  <p className="kin-alert-title" style={{ margin: 0, color: 'var(--ink)' }}>{alert.employee_name}</p>
                  <p className="small" style={{ marginTop: 2, color: 'var(--ink-2)' }}>{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenCase(alert.case_id)}
                className="btn ghost"
                style={{ padding: '4px 10px', color: 'var(--accent-ink)', whiteSpace: 'nowrap' }}
              >
                View Case
              </button>
            </div>
          </div>
        );
      })}
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

  if (!config) return <div className="card" style={{ padding: 40, textAlign: 'center' }}><span className="muted">Loading…</span></div>;

  return (
    <div className="card" style={{ padding: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 14px' }}>FMLA Configuration</h2>
      <div className="vstack" style={{ gap: 14 }}>
        <label className="field">
          <span className="field-label">Leave Year Calculation Method</span>
          <ComboSelect
            value={config.leave_year_method}
            options={[
              { value: 'rolling_backward', label: 'Rolling Backward (12 months from current date)' },
              { value: 'rolling_forward', label: 'Rolling Forward (12 months from first FMLA use)' },
              { value: 'calendar_year', label: 'Calendar Year (Jan 1 - Dec 31)' },
              { value: 'fixed_year', label: 'Fixed Year (custom start date)' },
            ]}
            onChange={v => setConfig({ ...config, leave_year_method: v || 'rolling_backward' })}
            includeNone={false}
            searchable={false}
          />
          <p className="small muted" style={{ marginTop: 4 }}>Determines how the 12-month FMLA leave year is calculated</p>
        </label>

        {config.leave_year_method === 'fixed_year' && (
          <label className="field">
            <span className="field-label">Fixed Year Start (MM-DD)</span>
            <input
              type="text"
              value={config.fixed_year_start}
              onChange={e => setConfig({ ...config, fixed_year_start: e.target.value })}
              placeholder="01-01"
              className="input"
            />
          </label>
        )}

        <div className="grid-2">
          <label className="field">
            <span className="field-label">Eligibility — Months Employed</span>
            <input
              type="number"
              value={config.eligibility_months}
              onChange={e => setConfig({ ...config, eligibility_months: parseInt(e.target.value) || 12 })}
              className="input"
            />
            <p className="small muted" style={{ marginTop: 4 }}>Default: 12 months</p>
          </label>
          <label className="field">
            <span className="field-label">Eligibility — Hours Worked</span>
            <input
              type="number"
              value={config.eligibility_hours}
              onChange={e => setConfig({ ...config, eligibility_hours: parseInt(e.target.value) || 1250 })}
              className="input"
            />
            <p className="small muted" style={{ marginTop: 4 }}>Default: 1,250 hours</p>
          </label>
        </div>

        <div className="hstack" style={{ gap: 10, paddingTop: 4, alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn primary"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="badge success">Saved!</span>}
        </div>
      </div>
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
  const [epMode, setEpMode] = useState<'single' | 'range'>('single');
  const [epDate, setEpDate] = useState('');
  const [epStartDate, setEpStartDate] = useState('');
  const [epEndDate, setEpEndDate] = useState('');
  const [epHours, setEpHours] = useState(8);
  const [epSkipWeekends, setEpSkipWeekends] = useState(true);
  const [epNotes, setEpNotes] = useState('');
  const [addingEpisode, setAddingEpisode] = useState(false);
  const [bulkResult, setBulkResult] = useState<number | null>(null);

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
    if (epMode === 'single' && (!epDate || epHours <= 0)) return;
    if (epMode === 'range' && (!epStartDate || !epEndDate || epHours <= 0)) return;
    setAddingEpisode(true);
    setBulkResult(null);
    try {
      if (epMode === 'range') {
        const count = await api.addFmlaEpisodeBulk({
          fmla_case_id: fmlaCase.id,
          start_date: epStartDate,
          end_date: epEndDate,
          hours_per_day: epHours,
          skip_weekends: epSkipWeekends,
          notes: epNotes || undefined,
        });
        setBulkResult(count);
      } else {
        await api.addFmlaEpisode({
          fmla_case_id: fmlaCase.id,
          date: epDate,
          hours_used: epHours,
          notes: epNotes || undefined,
        });
      }
      setEpDate('');
      setEpStartDate('');
      setEpEndDate('');
      setEpHours(8);
      setEpNotes('');
      await loadEpisodes();
      await refreshCase();
      onUpdated();
      if (epMode === 'single') setShowAddEpisode(false);
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

  const fieldLabelCss: React.CSSProperties = { color: 'var(--ink-3)' };
  const fieldValueCss: React.CSSProperties = { fontWeight: 500, color: 'var(--ink)', margin: '2px 0 0' };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div className="hstack" style={{ gap: 10, alignItems: 'center', flex: 1 }}>
          <button onClick={onBack} className="icon-btn" aria-label="Back">
            <ArrowLeft />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">
              {caseData.employee_name || `Employee #${caseData.employee_id}`}
            </h1>
            <p className="page-subtitle">
              FMLA Case #{caseData.id} &middot; {getReasonLabel(caseData.reason)}
            </p>
          </div>
          <span className={STATUS_BADGE[caseData.status] || 'badge'}>
            {formatStatus(caseData.status)}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Left column: Case details */}
        <div className="vstack" style={{ gap: 16, gridColumn: 'span 2', minWidth: 0 }}>
          {/* Summary card */}
          <div className="card" style={{ padding: 18 }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Case Details</h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="btn ghost"
                  style={{ padding: '4px 10px', color: 'var(--accent-ink)' }}
                >
                  Edit
                </button>
              ) : (
                <div className="hstack" style={{ gap: 8 }}>
                  <button
                    onClick={handleSaveCase}
                    disabled={saving}
                    className="btn primary"
                    style={{ padding: '4px 12px' }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="btn ghost"
                    style={{ padding: '4px 12px' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="vstack" style={{ gap: 14 }}>
                <div className="grid-2">
                  <label className="field">
                    <span className="field-label">Status</span>
                    <ComboSelect
                      value={status}
                      options={[
                        { value: 'pending_designation', label: 'Pending Designation' },
                        { value: 'active', label: 'Active' },
                        { value: 'exhausted', label: 'Exhausted' },
                        { value: 'closed', label: 'Closed' },
                      ]}
                      onChange={v => setStatus(v || 'pending_designation')}
                      includeNone={false}
                      searchable={false}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Certification Status</span>
                    <ComboSelect
                      value={certStatus}
                      options={CERT_STATUSES}
                      onChange={v => setCertStatus(v || 'not_requested')}
                      includeNone={false}
                      searchable={false}
                    />
                  </label>
                </div>
                <div className="grid-2">
                  <label className="field">
                    <span className="field-label">Cert Received Date</span>
                    <input type="date" value={certReceivedDate} onChange={e => setCertReceivedDate(e.target.value)} className="input" />
                  </label>
                  <label className="field">
                    <span className="field-label">Recertification Due Date</span>
                    <input type="date" value={recertDueDate} onChange={e => setRecertDueDate(e.target.value)} className="input" />
                  </label>
                </div>
                <div className="grid-2">
                  <label className="field">
                    <span className="field-label">Actual End Date</span>
                    <input type="date" value={actualEndDate} onChange={e => setActualEndDate(e.target.value)} className="input" />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fitnessForDuty} onChange={e => setFitnessForDuty(e.target.checked)} />
                      Fitness for Duty Received
                    </label>
                  </div>
                </div>
                <label className="field">
                  <span className="field-label">Notes</span>
                  <textarea value={caseNotes} onChange={e => setCaseNotes(e.target.value)} rows={3} className="input" />
                </label>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24, fontSize: 13 }}>
                <div>
                  <span style={fieldLabelCss}>Reason</span>
                  <p style={fieldValueCss}>{getReasonLabel(caseData.reason)}</p>
                </div>
                <div>
                  <span style={fieldLabelCss}>Leave Type</span>
                  <p style={fieldValueCss}>{getLeaveTypeLabel(caseData.leave_type)}</p>
                </div>
                {caseData.family_member && (
                  <div>
                    <span style={fieldLabelCss}>Family Member</span>
                    <p style={fieldValueCss}>{caseData.family_member}</p>
                  </div>
                )}
                <div>
                  <span style={fieldLabelCss}>Start Date</span>
                  <p style={fieldValueCss}>{formatDate(caseData.start_date)}</p>
                </div>
                <div>
                  <span style={fieldLabelCss}>Expected End</span>
                  <p style={fieldValueCss}>{formatDate(caseData.expected_end_date)}</p>
                </div>
                {caseData.actual_end_date && (
                  <div>
                    <span style={fieldLabelCss}>Actual End</span>
                    <p style={fieldValueCss}>{formatDate(caseData.actual_end_date)}</p>
                  </div>
                )}
                <div>
                  <span style={fieldLabelCss}>Certification</span>
                  <p style={fieldValueCss}>{getCertStatusLabel(caseData.cert_status)}</p>
                </div>
                {caseData.cert_due_date && (
                  <div>
                    <span style={fieldLabelCss}>Cert Due Date</span>
                    <p style={fieldValueCss}>{formatDate(caseData.cert_due_date)}</p>
                  </div>
                )}
                {caseData.cert_received_date && (
                  <div>
                    <span style={fieldLabelCss}>Cert Received</span>
                    <p style={fieldValueCss}>{formatDate(caseData.cert_received_date)}</p>
                  </div>
                )}
                {caseData.recert_due_date && (
                  <div>
                    <span style={fieldLabelCss}>Recert Due</span>
                    <p style={fieldValueCss}>{formatDate(caseData.recert_due_date)}</p>
                  </div>
                )}
                <div>
                  <span style={fieldLabelCss}>Leave Year Start</span>
                  <p style={fieldValueCss}>{formatDate(caseData.leave_year_start)}</p>
                </div>
                <div>
                  <span style={fieldLabelCss}>Fitness for Duty</span>
                  <p style={fieldValueCss}>{caseData.fitness_for_duty ? 'Yes' : 'No'}</p>
                </div>
                {caseData.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={fieldLabelCss}>Notes</span>
                    <p style={{ ...fieldValueCss, whiteSpace: 'pre-wrap' }}>{caseData.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Episodes list */}
          <div className="card" style={{ padding: 18 }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Leave Episodes</h2>
              <button
                onClick={() => setShowAddEpisode(!showAddEpisode)}
                className="btn primary"
                style={{ padding: '6px 12px' }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Log Hours
              </button>
            </div>

            {showAddEpisode && (
              <form onSubmit={handleAddEpisode} style={{ marginBottom: 16, padding: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                <div className="vstack" style={{ gap: 12 }}>
                  {/* Mode toggle */}
                  <div className="seg" style={{ width: 'fit-content' }}>
                    <button type="button" aria-selected={epMode === 'single'} onClick={() => setEpMode('single')}>Single Day</button>
                    <button type="button" aria-selected={epMode === 'range'} onClick={() => setEpMode('range')}>Date Range</button>
                  </div>

                  {epMode === 'single' ? (
                    <div className="grid-3">
                      <label className="field">
                        <span className="field-label">Date *</span>
                        <input type="date" value={epDate} onChange={e => setEpDate(e.target.value)} className="input" />
                      </label>
                      <label className="field">
                        <span className="field-label">Hours *</span>
                        <input type="number" step="0.5" min="0.5" max="24" value={epHours} onChange={e => setEpHours(parseFloat(e.target.value) || 0)} className="input" />
                      </label>
                      <label className="field">
                        <span className="field-label">Notes</span>
                        <input type="text" value={epNotes} onChange={e => setEpNotes(e.target.value)} placeholder="Optional" className="input" />
                      </label>
                    </div>
                  ) : (
                    <div className="vstack" style={{ gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        <label className="field">
                          <span className="field-label">Start Date *</span>
                          <input type="date" value={epStartDate} onChange={e => setEpStartDate(e.target.value)} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">End Date *</span>
                          <input type="date" value={epEndDate} onChange={e => setEpEndDate(e.target.value)} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">Hours/Day *</span>
                          <input type="number" step="0.5" min="0.5" max="24" value={epHours} onChange={e => setEpHours(parseFloat(e.target.value) || 0)} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">Notes</span>
                          <input type="text" value={epNotes} onChange={e => setEpNotes(e.target.value)} placeholder="Optional" className="input" />
                        </label>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={epSkipWeekends} onChange={e => setEpSkipWeekends(e.target.checked)} />
                        Skip weekends (Sat/Sun)
                      </label>
                      {epStartDate && epEndDate && (
                        <p className="small muted" style={{ margin: 0 }}>
                          This will create an episode for each {epSkipWeekends ? 'weekday' : 'day'} from {epStartDate} to {epEndDate} at {epHours}h/day.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="hstack" style={{ alignItems: 'center', gap: 10 }}>
                    <button type="submit" disabled={addingEpisode} className="btn primary" style={{ padding: '6px 12px' }}>
                      {addingEpisode ? 'Adding...' : epMode === 'range' ? 'Add Date Range' : 'Add Episode'}
                    </button>
                    <button type="button" onClick={() => { setShowAddEpisode(false); setBulkResult(null); }} className="btn ghost" style={{ padding: '6px 12px' }}>
                      Cancel
                    </button>
                    {bulkResult !== null && (
                      <span className="badge success">
                        Added {bulkResult} episode{bulkResult !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </form>
            )}

            {episodes.length === 0 ? (
              <p className="small muted" style={{ textAlign: 'center', padding: '24px 0', margin: 0 }}>No episodes logged yet</p>
            ) : (
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Notes</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map(ep => (
                    <tr key={ep.id}>
                      <td style={{ color: 'var(--ink)' }}>{formatDate(ep.date)}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{ep.hours_used}h</td>
                      <td className="muted">{ep.notes || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => handleDeleteEpisode(ep.id)} className="icon-btn" style={{ color: 'var(--danger)' }} aria-label="Delete episode">
                          <Trash2 style={{ width: 14, height: 14 }} />
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
        <div className="vstack" style={{ gap: 16, minWidth: 0 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', margin: '0 0 12px' }}>Leave Entitlement</h3>
            {/* Circular gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 128, height: 128 }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(pct, 100) / 100)}`}
                    strokeLinecap="round"
                    stroke={pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--warn)' : 'var(--accent)'}
                    style={{ transition: 'stroke-dashoffset 0.5s' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{Math.round(pct)}%</span>
                  <span className="small" style={{ color: 'var(--ink-3)' }}>used</span>
                </div>
              </div>
              <div style={{ marginTop: 14, textAlign: 'center' }} className="vstack">
                <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
                  <span style={{ fontWeight: 600 }}>{caseData.used_hours}</span> of <span style={{ fontWeight: 600 }}>{caseData.entitlement_hours}</span> hours used
                </p>
                <p className="small" style={{ margin: 0, color: 'var(--ink-3)' }}>
                  <span style={{ fontWeight: 600 }}>{remainingHours}</span> hours remaining
                </p>
                <p className="small" style={{ margin: 0, color: 'var(--ink-4)' }}>
                  ≈ {(remainingHours / 8).toFixed(1)} days remaining
                </p>
              </div>
            </div>
          </div>

          {/* Key dates */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', margin: '0 0 12px' }}>Key Dates</h3>
            <div className="vstack" style={{ gap: 8, fontSize: 13 }}>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Leave Year Start</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(caseData.leave_year_start)}</span>
              </div>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Case Start</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(caseData.start_date)}</span>
              </div>
              {caseData.expected_end_date && (
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Expected End</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(caseData.expected_end_date)}</span>
                </div>
              )}
              {caseData.cert_due_date && (
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Cert Due</span>
                  <span style={{
                    fontWeight: 500,
                    color: caseData.cert_status !== 'received' && caseData.cert_status !== 'approved' && new Date(caseData.cert_due_date) < new Date()
                      ? 'var(--danger)' : 'var(--ink)'
                  }}>
                    {formatDate(caseData.cert_due_date)}
                  </span>
                </div>
              )}
              {caseData.recert_due_date && (
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Recert Due</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(caseData.recert_due_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline summary */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', margin: '0 0 12px' }}>Episode Summary</h3>
            <div className="vstack" style={{ gap: 4, fontSize: 13 }}>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Total Episodes</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{episodes.length}</span>
              </div>
              {episodes.length > 0 && (
                <>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-3)' }}>First Episode</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(episodes[episodes.length - 1]?.date)}</span>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-3)' }}>Last Episode</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{formatDate(episodes[0]?.date)}</span>
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
