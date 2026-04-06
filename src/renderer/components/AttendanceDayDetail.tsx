import React from 'react';
import type { AttendanceRecord } from '../types/attendance';

interface AttendanceDayDetailProps {
  date: string;
  records: AttendanceRecord[];
  onClose: () => void;
}

export default function AttendanceDayDetail({ date, records, onClose }: AttendanceDayDetailProps) {
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalReg = records.reduce((sum, r) => sum + (r.reg_hours || 0), 0);
  const totalOT = records.reduce((sum, r) => sum + (r.ot_hours || 0), 0);

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

      {records.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No attendance records for this date.</p>
      ) : (
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

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Employee</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">In</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Out</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Reg</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">OT</th>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Work Code</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} className="border-b border-gray-100 dark:border-gray-700/50">
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
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
