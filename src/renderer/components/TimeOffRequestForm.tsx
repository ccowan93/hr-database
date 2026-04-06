import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { TIME_OFF_REQUEST_TYPES } from '../types/attendance';

interface TimeOffRequestFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

export default function TimeOffRequestForm({ onSubmit, onCancel }: TimeOffRequestFormProps) {
  const [employees, setEmployees] = useState<{ id: number; employee_name: string }[]>([]);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [requestType, setRequestType] = useState('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then((emps: any[]) => {
      setEmployees(emps.map(e => ({ id: e.id, employee_name: e.employee_name })));
    });
  }, []);

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Time-Off Request</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
            >
              <option value={0}>Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.employee_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Request Type</label>
            <select
              value={requestType}
              onChange={e => setRequestType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
            >
              {TIME_OFF_REQUEST_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                min={startDate}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason for request (optional)"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !employeeId || !startDate || !endDate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
