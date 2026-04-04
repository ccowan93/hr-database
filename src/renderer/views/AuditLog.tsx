import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { AuditLogEntry } from '../types/employee';

const PAGE_SIZE = 50;

export default function AuditLog() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getGlobalAuditLog(PAGE_SIZE, page * PAGE_SIZE),
      api.getGlobalAuditLogCount(),
    ]).then(([rows, count]) => {
      setEntries(rows);
      setTotal(count);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Audit Log</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{total} total changes</span>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading...</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Field</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Old Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">New Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(entry.changed_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/employees/${entry.employee_id}`)}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {entry.employee_name ?? `#${entry.employee_id}`}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-mono text-xs">{entry.field_name}</td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400 text-xs max-w-[200px] truncate">{entry.old_value ?? '-'}</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 text-xs max-w-[200px] truncate">{entry.new_value ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.change_source === 'manual'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : entry.change_source === 'excel_update'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {entry.change_source}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                        No audit log entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
