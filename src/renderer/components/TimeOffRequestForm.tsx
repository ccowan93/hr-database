import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { TIME_OFF_REQUEST_TYPES } from '../types/attendance';
import ComboSelect from './ComboSelect';

interface TimeOffRequestFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

interface OverlapInfo {
  employee_name: string;
  request_type: string;
  start_date: string;
  end_date: string;
}

export default function TimeOffRequestForm({ onSubmit, onCancel }: TimeOffRequestFormProps) {
  const [employees, setEmployees] = useState<{ id: number; employee_name: string; current_department: string | null }[]>([]);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [requestType, setRequestType] = useState('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overlaps, setOverlaps] = useState<OverlapInfo[]>([]);
  const [checkingOverlap, setCheckingOverlap] = useState(false);

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name, current_department: e.current_department })));
    });
  }, []);

  // Check for department overlaps when employee/dates change
  useEffect(() => {
    if (!employeeId || !startDate || !endDate) {
      setOverlaps([]);
      return;
    }
    const selectedEmp = employees.find(e => e.id === employeeId);
    if (!selectedEmp?.current_department) {
      setOverlaps([]);
      return;
    }

    setCheckingOverlap(true);
    api.getTimeOffRequests({
      status: 'approved',
      startDate,
      endDate,
    }).then(requests => {
      const deptOverlaps = requests.filter(r =>
        r.employee_id !== employeeId &&
        r.current_department === selectedEmp.current_department &&
        r.start_date <= endDate &&
        r.end_date >= startDate
      ).map(r => ({
        employee_name: r.employee_name,
        request_type: r.request_type,
        start_date: r.start_date,
        end_date: r.end_date,
      }));
      setOverlaps(deptOverlaps);
    }).catch(() => setOverlaps([]))
      .finally(() => setCheckingOverlap(false));
  }, [employeeId, startDate, endDate, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !startDate || !endDate) return;

    setSubmitting(true);
    try {
      await api.createTimeOffRequest({
        employee_id: employeeId,
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        notes: notes || undefined,
      });
      onSubmit();
    } catch (err) {
      console.error('Failed to create time-off request:', err);
    }
    setSubmitting(false);
  };

  return (
    <div className="kin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="kin-modal" style={{ maxWidth: 480 }}>
        <div className="kin-modal-head">
          <h2 className="kin-modal-title">New Time-Off Request</h2>
        </div>

        <form onSubmit={handleSubmit} className="kin-modal-body">
          <label className="field">
            <span className="field-label">Employee</span>
            <ComboSelect
              value={employeeId ? String(employeeId) : ''}
              options={employees.map(emp => ({ value: String(emp.id), label: emp.employee_name }))}
              onChange={v => setEmployeeId(Number(v) || 0)}
              placeholder="Select employee..."
              includeNone={true}
              noneLabel="Select employee..."
            />
          </label>

          <label className="field">
            <span className="field-label">Request Type</span>
            <ComboSelect
              value={requestType}
              options={TIME_OFF_REQUEST_TYPES.map(t => ({ value: t.value, label: t.label }))}
              onChange={v => setRequestType(v || 'vacation')}
              includeNone={false}
              searchable={false}
            />
          </label>

          <div className="grid-2">
            <label className="field">
              <span className="field-label">Start Date</span>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">End Date</span>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                min={startDate}
              />
            </label>
          </div>

          {overlaps.length > 0 && (
            <div className="kin-alert warn">
              <div className="kin-alert-title">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Department Overlap Detected
              </div>
              <p className="small" style={{ margin: '4px 0 6px' }}>
                The following people in the same department already have approved time off during these dates:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {overlaps.map((o, i) => (
                  <div key={i} className="small">
                    <span style={{ fontWeight: 500 }}>{o.employee_name}</span>
                    {' — '}
                    {o.request_type.charAt(0).toUpperCase() + o.request_type.slice(1).replace('_', ' ')}
                    {' ('}
                    {new Date(o.start_date + 'T12:00:00').toLocaleDateString()}
                    {o.start_date !== o.end_date && ` – ${new Date(o.end_date + 'T12:00:00').toLocaleDateString()}`}
                    {')'}
                  </div>
                ))}
              </div>
            </div>
          )}
          {checkingOverlap && (
            <div className="small muted">Checking for department overlaps...</div>
          )}

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason for request (optional)"
              style={{ resize: 'none' }}
            />
          </label>

          <div className="kin-modal-foot">
            <button type="button" onClick={onCancel} className="btn ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !employeeId || !startDate || !endDate}
              className="btn primary"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
