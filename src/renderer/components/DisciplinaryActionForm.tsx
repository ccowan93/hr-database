import React, { useState, useEffect } from 'react';
import { api } from '../api';
import ComboSelect from './ComboSelect';

interface DisciplinaryActionFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

interface Employee {
  id: number;
  employee_name: string;
}

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

export default function DisciplinaryActionForm({ onSubmit, onCancel }: DisciplinaryActionFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [type, setType] = useState('verbal_warning');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState('open');
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name })));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !description || !issuedBy) return;
    setSubmitting(true);
    try {
      await api.createDisciplinaryAction({
        employee_id: employeeId,
        type,
        date,
        description,
        issued_by: issuedBy,
        follow_up_date: followUpDate || undefined,
        status,
        outcome: outcome || undefined,
      });
      onSubmit();
    } catch (err) {
      console.error('Failed to create disciplinary action:', err);
    }
    setSubmitting(false);
  };

  return (
    <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="kin-modal" style={{ maxWidth: 720 }}>
        <div className="kin-modal-head">
          <h2 className="kin-modal-title">New Disciplinary Action</h2>
        </div>

        <form onSubmit={handleSubmit} className="kin-modal-body">
          <div className="grid-3">
            <label className="field">
              <span className="field-label">Employee *</span>
              <ComboSelect
                value={employeeId ? String(employeeId) : ''}
                options={employees.map(e => ({ value: String(e.id), label: e.employee_name }))}
                onChange={v => setEmployeeId(parseInt(v) || 0)}
                placeholder="Search employee..."
                includeNone={true}
                noneLabel="Select employee..."
              />
            </label>
            <label className="field">
              <span className="field-label">Type</span>
              <ComboSelect
                value={type}
                options={ACTION_TYPES}
                onChange={v => setType(v || 'verbal_warning')}
                includeNone={false}
                searchable={false}
              />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input"
              />
            </label>
          </div>

          <div className="grid-3">
            <label className="field">
              <span className="field-label">Issued By *</span>
              <input
                type="text"
                value={issuedBy}
                onChange={e => setIssuedBy(e.target.value)}
                placeholder="Manager name"
                className="input"
              />
            </label>
            <label className="field">
              <span className="field-label">Follow-up Date</span>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="input"
              />
            </label>
            <label className="field">
              <span className="field-label">Status</span>
              <ComboSelect
                value={status}
                options={STATUS_OPTIONS}
                onChange={v => setStatus(v || 'open')}
                includeNone={false}
                searchable={false}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Description *</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the incident and action taken..."
              className="input"
              style={{ resize: 'none' }}
            />
          </label>

          <label className="field">
            <span className="field-label">Outcome</span>
            <textarea
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              rows={2}
              placeholder="Expected or actual outcome..."
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
              disabled={submitting || !employeeId || !description || !issuedBy}
              className="btn primary"
            >
              {submitting ? 'Creating...' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
