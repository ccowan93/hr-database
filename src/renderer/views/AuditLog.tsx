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
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">{total} total changes</p>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="card-body muted" style={{ textAlign: 'center', padding: 48 }}>Loading…</div></div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Field</th>
                    <th>Old value</th>
                    <th>New value</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td className="muted mono" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(entry.changed_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/employees/${entry.employee_id}`)}
                          className="btn ghost"
                          style={{ padding: '2px 6px', color: 'var(--accent-ink)' }}
                        >
                          {entry.employee_name ?? `#${entry.employee_id}`}
                        </button>
                      </td>
                      <td className="mono">{entry.field_name}</td>
                      <td className="small" style={{ color: 'var(--danger)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.old_value ?? '—'}</td>
                      <td className="small" style={{ color: 'var(--success)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.new_value ?? '—'}</td>
                      <td>
                        <span className={`badge ${entry.change_source === 'manual' ? 'info' : entry.change_source === 'excel_update' ? 'warn' : ''}`}>
                          {entry.change_source}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 48 }}>
                        No audit log entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex-between" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </button>
              <span className="small muted">Page {page + 1} of {totalPages}</span>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
