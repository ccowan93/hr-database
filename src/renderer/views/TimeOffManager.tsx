import React, { useState, useEffect } from 'react';
import { api } from '../api';
import TimeOffRequestForm from '../components/TimeOffRequestForm';
import type { TimeOffRequest } from '../types/attendance';
import { TIME_OFF_REQUEST_TYPES } from '../types/attendance';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Time Off</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage time-off requests
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All Types</option>
            {TIME_OFF_REQUEST_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No time-off requests found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dates</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{req.employee_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{req.current_department}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {getTypeLabel(req.request_type)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {new Date(req.start_date + 'T12:00:00').toLocaleDateString()}
                    </div>
                    {req.start_date !== req.end_date && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        to {new Date(req.end_date + 'T12:00:00').toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[req.status]}`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {req.notes || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStatusUpdate(req.id, 'approved')}
                          className="px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(req.id, 'denied')}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded text-xs font-medium transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {req.status !== 'pending' && req.reviewed_at && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(req.reviewed_at).toLocaleDateString()}
                      </div>
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
