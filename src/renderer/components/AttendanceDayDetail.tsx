import React, { useState } from 'react';
import type { AttendanceRecord } from '../types/attendance';

interface TimeOffEntry {
  employee_name: string;
  employee_id: number;
  request_type: string;
  department: string | null;
}

interface AttendanceDayDetailProps {
  date: string;
  records: AttendanceRecord[];
  timeOffEntries?: TimeOffEntry[];
  onClose: () => void;
  onDeleteRecord?: (id: number) => Promise<void>;
  onDeleteRecords?: (ids: number[]) => Promise<void>;
}

export default function AttendanceDayDetail({ date, records, timeOffEntries = [], onClose, onDeleteRecord, onDeleteRecords }: AttendanceDayDetailProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalReg = records.reduce((sum, r) => sum + (r.reg_hours || 0), 0);
  const totalOT = records.reduce((sum, r) => sum + (r.ot_hours || 0), 0);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const handleDeleteSingle = async (id: number) => {
    if (!onDeleteRecord) return;
    setDeleting(true);
    try {
      await onDeleteRecord(id);
      setConfirmDeleteId(null);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!onDeleteRecords || selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await onDeleteRecords(Array.from(selectedIds));
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formattedDate}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Time Off Section */}
      {timeOffEntries.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Time Off</h4>
          <div className="space-y-2">
            {timeOffEntries.map((entry, i) => (
              <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.employee_name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {entry.request_type.charAt(0).toUpperCase() + entry.request_type.slice(1).replace('_', ' ')}
                </div>
                {entry.department && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{entry.department}</div>
                )}
              </div>
            ))}
          </div>
          {/* Department overlap warning */}
          {(() => {
            const deptGroups = new Map<string, TimeOffEntry[]>();
            for (const entry of timeOffEntries) {
              if (entry.department) {
                if (!deptGroups.has(entry.department)) deptGroups.set(entry.department, []);
                deptGroups.get(entry.department)!.push(entry);
              }
            }
            const overlaps = Array.from(deptGroups.entries()).filter(([, entries]) => entries.length > 1);
            if (overlaps.length === 0) return null;
            return (
              <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Department Overlap
                </div>
                {overlaps.map(([dept, entries]) => (
                  <div key={dept} className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    <span className="font-medium">{dept}:</span> {entries.map(e => e.employee_name.split(' ')[0]).join(', ')} are all off
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {records.length === 0 && timeOffEntries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No attendance records for this date.</p>
      ) : records.length === 0 ? null : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalReg.toFixed(1)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Reg Hours</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{totalOT.toFixed(1)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">OT Hours</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{(totalReg + totalOT).toFixed(1)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Hours</div>
            </div>
          </div>

          {/* Bulk delete bar */}
          {onDeleteRecords && selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3">
              <span className="text-sm text-red-700 dark:text-red-300">{selectedIds.size} selected</span>
              {confirmBulkDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400">Are you sure?</span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {(onDeleteRecord || onDeleteRecords) && (
                  <th className="text-left py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                )}
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Employee</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">In</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Out</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Reg</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">OT</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Work Code</th>
                {onDeleteRecord && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} className="border-b border-gray-100 dark:border-gray-700/50 group">
                  {(onDeleteRecord || onDeleteRecords) && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                  )}
                  <td className="py-2 text-gray-900 dark:text-gray-100">
                    {record.employee_name_raw}
                    {record.missing_punch === 1 && (
                      <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400" title="Missing punch">!</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-600 dark:text-gray-300">{record.punch_in || '-'}</td>
                  <td className="py-2 text-gray-600 dark:text-gray-300">{record.punch_out || '-'}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-300">{record.reg_hours > 0 ? record.reg_hours.toFixed(1) : '-'}</td>
                  <td className="py-2 text-right text-orange-600 dark:text-orange-400">{record.ot_hours > 0 ? record.ot_hours.toFixed(1) : '-'}</td>
                  <td className="py-2 text-gray-500 dark:text-gray-400">{record.code_name || record.work_code || '-'}</td>
                  {onDeleteRecord && (
                    <td className="py-2">
                      {confirmDeleteId === record.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteSingle(record.id)}
                            disabled={deleting}
                            className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(record.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Delete record"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
