import React, { useState, useEffect } from 'react';
import { api } from '../api';
import TimeOffRequestForm from '../components/TimeOffRequestForm';
import ComboSelect from '../components/ComboSelect';
import type { TimeOffRequest } from '../types/attendance';
import { TIME_OFF_REQUEST_TYPES } from '../types/attendance';

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge warn',
  approved: 'badge accent',
  denied: 'badge danger',
};

function getTypeLabel(value: string): string {
  return TIME_OFF_REQUEST_TYPES.find(t => t.value === value)?.label || value;
}

export default function TimeOffManager() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await api.getTimeOffRequests(filters);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load time-off requests:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [statusFilter]);

  const handleStatusUpdate = async (id: number, status: 'approved' | 'denied') => {
    try {
      await api.updateTimeOffRequest(id, { status, reviewed_by: 'HR Admin' });
      loadRequests();
    } catch (err) {
      console.error('Failed to update request:', err);
    }
  };

  const filteredRequests = typeFilter
    ? requests.filter(r => r.request_type === typeFilter)
    : requests;

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const deniedCount = requests.filter(r => r.status === 'denied').length;
  const totalCount = requests.length;

  const statusTabs: { value: string; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Time off</h1>
          <p className="page-subtitle">Manage time-off requests across the company</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New request
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{approvedCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Denied</div>
          <div className="stat-value">{deniedCount}</div>
        </div>
      </div>

      <div className="tab-row">
        {statusTabs.map(t => (
          <button
            key={t.value}
            className="tab"
            aria-selected={statusFilter === t.value}
            onClick={() => setStatusFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
        <label className="field" style={{ minWidth: 220 }}>
          <span className="field-label">Type</span>
          <ComboSelect
            value={typeFilter}
            options={TIME_OFF_REQUEST_TYPES.map(t => ({ value: t.value, label: t.label }))}
            onChange={setTypeFilter}
            includeNone={true}
            noneLabel="All types"
            searchable={false}
          />
        </label>
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Loading…</div>
      ) : filteredRequests.length === 0 ? (
        <div className="card muted" style={{ padding: '48px', textAlign: 'center' }}>
          No time-off requests found.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="kin-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{req.employee_name}</div>
                    <div className="small muted">{req.current_department}</div>
                  </td>
                  <td>{getTypeLabel(req.request_type)}</td>
                  <td>
                    <div>{new Date(req.start_date + 'T12:00:00').toLocaleDateString()}</div>
                    {req.start_date !== req.end_date && (
                      <div className="small muted">
                        to {new Date(req.end_date + 'T12:00:00').toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={STATUS_CLASS[req.status]}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </td>
                  <td className="muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {req.status === 'pending' ? (
                      <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn accent" onClick={() => handleStatusUpdate(req.id, 'approved')}>Approve</button>
                        <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => handleStatusUpdate(req.id, 'denied')}>Deny</button>
                      </div>
                    ) : req.reviewed_at && (
                      <span className="small muted">{new Date(req.reviewed_at).toLocaleDateString()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <TimeOffRequestForm
          onSubmit={() => { setShowForm(false); loadRequests(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
