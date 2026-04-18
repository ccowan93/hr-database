import React, { useState, useEffect } from 'react';
import { api } from '../api';
import ComboSelect from './ComboSelect';
import { CheckCircle2, XCircle } from 'lucide-react';

interface FmlaCaseFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

interface EligibilityResult {
  eligible: boolean;
  employeeName: string;
  monthsEmployed: number;
  hoursWorked: number;
  reasons: string[];
}

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

export default function FmlaCaseForm({ onSubmit, onCancel }: FmlaCaseFormProps) {
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

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name })));
    });
  }, []);

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
      onSubmit();
    } catch (err) {
      console.error('Failed to create FMLA case:', err);
      alert('Failed to create FMLA case');
    }
    setSubmitting(false);
  };

  return (
    <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="kin-modal" style={{ maxWidth: 720 }}>
        <div className="kin-modal-head">
          <h2 className="kin-modal-title">New FMLA Case</h2>
        </div>

        <form onSubmit={handleSubmit} className="kin-modal-body">
          <label className="field">
            <span className="field-label">Employee *</span>
            <ComboSelect
              value={employeeId ? String(employeeId) : ''}
              options={employees.map(emp => ({ value: String(emp.id), label: emp.employee_name }))}
              onChange={v => setEmployeeId(parseInt(v) || 0)}
              placeholder="— Select Employee —"
              includeNone={true}
              noneLabel="— Select Employee —"
            />
          </label>

          {employeeId > 0 && (
            checkingEligibility ? (
              <div className="kin-alert info">
                <span className="small">Checking eligibility...</span>
              </div>
            ) : eligibility ? (
              <div className={eligibility.eligible ? 'kin-alert' : 'kin-alert danger'} style={eligibility.eligible ? { borderLeftColor: 'var(--success)', background: 'color-mix(in srgb, var(--success) 10%, transparent)' } : undefined}>
                <div className="hstack kin-alert-title" style={{ gap: 8, color: eligibility.eligible ? 'var(--success)' : 'var(--danger)' }}>
                  {eligibility.eligible ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <XCircle style={{ width: 16, height: 16 }} />}
                  {eligibility.eligible ? 'Eligible for FMLA' : 'Not Eligible for FMLA'}
                </div>
                <div className="vstack small" style={{ marginTop: 4, gap: 2, color: 'var(--ink-2)' }}>
                  <p style={{ margin: 0 }}>Months employed: {eligibility.monthsEmployed} (required: 12)</p>
                  <p style={{ margin: 0 }}>Hours worked (12 mo): {eligibility.hoursWorked.toLocaleString()} (required: 1,250)</p>
                  {!eligibility.eligible && eligibility.reasons.map((r, i) => (
                    <p key={i} style={{ margin: 0, color: 'var(--danger)' }}>{r}</p>
                  ))}
                </div>
              </div>
            ) : null
          )}

          <div className="grid-2">
            <label className="field">
              <span className="field-label">Reason *</span>
              <ComboSelect
                value={reason}
                options={FMLA_REASONS}
                onChange={v => setReason(v || 'serious_health_condition')}
                includeNone={false}
                searchable={false}
              />
            </label>
            <label className="field">
              <span className="field-label">Leave Type *</span>
              <ComboSelect
                value={leaveType}
                options={LEAVE_TYPES}
                onChange={v => setLeaveType(v || 'continuous')}
                includeNone={false}
                searchable={false}
              />
            </label>
          </div>

          {needsFamilyMember && (
            <label className="field">
              <span className="field-label">Family Member Name</span>
              <input
                type="text"
                value={familyMember}
                onChange={e => setFamilyMember(e.target.value)}
                placeholder="Name and relationship"
                className="input"
              />
            </label>
          )}

          <div className="grid-3">
            <label className="field">
              <span className="field-label">Start Date *</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="input"
              />
            </label>
            <label className="field">
              <span className="field-label">Expected End Date</span>
              <input
                type="date"
                value={expectedEndDate}
                onChange={e => setExpectedEndDate(e.target.value)}
                className="input"
              />
            </label>
            <label className="field">
              <span className="field-label">Entitlement (hours)</span>
              <input
                type="number"
                value={entitlementHours}
                onChange={e => setEntitlementHours(parseInt(e.target.value) || 480)}
                className="input"
              />
              <p className="small muted" style={{ marginTop: 4 }}>Standard: 480 hours (12 weeks)</p>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Certification Due Date</span>
            <input
              type="date"
              value={certDueDate}
              onChange={e => setCertDueDate(e.target.value)}
              className="input"
            />
            <p className="small muted" style={{ marginTop: 4 }}>Typically 15 calendar days from designation</p>
          </label>

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="input"
              style={{ resize: 'none' }}
            />
          </label>

          <div className="kin-modal-foot">
            <button type="button" onClick={onCancel} className="btn ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !employeeId || !startDate}
              className="btn primary"
            >
              {submitting ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
