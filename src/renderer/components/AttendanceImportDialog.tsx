import React from 'react';
import type { AttendanceImportResult } from '../types/attendance';

interface AttendanceImportDialogProps {
  result: AttendanceImportResult;
  onClose: () => void;
}

export default function AttendanceImportDialog({ result, onClose }: AttendanceImportDialogProps) {
  const hasErrors = result.errors.length > 0 && result.errors[0] !== 'Import cancelled';
  const wasCancelled = result.errors.length === 1 && result.errors[0] === 'Import cancelled';

  if (wasCancelled) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Attendance Import Results
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</div>
              <div className="text-sm text-green-600 dark:text-green-500">Records Imported</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{result.skipped}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Rows Skipped</div>
            </div>
          </div>

          {result.unmatched.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                Unmatched Employees ({result.unmatched.length})
              </h3>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                These names from the time clock did not match any employee in the database. Their records were imported but not linked to an employee profile.
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {result.unmatched.map(name => (
                  <div key={name} className="text-sm text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
                    <span className="text-yellow-500">!</span>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasErrors && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                Errors ({result.errors.length})
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-700 dark:text-red-400">{err}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
