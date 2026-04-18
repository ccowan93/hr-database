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
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklch, var(--accent) 28%, var(--line))',
        borderRadius: 'var(--radius)',
        padding: 0,
        boxShadow: '0 0 0 3px color-mix(in oklch, var(--accent) 8%, transparent)',
      }}
    >
      <div
        className="flex-between"
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid color-mix(in oklch, var(--accent) 22%, var(--line))',
          background: 'var(--accent-soft)',
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--accent-ink)', letterSpacing: '-0.01em' }}>{formattedDate}</h3>
          <p className="small" style={{ margin: '2px 0 0', color: 'var(--accent-ink)', opacity: 0.75 }}>
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="icon-btn"
          style={{ color: 'var(--accent-ink)' }}
        >
          <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 16 }}>

      {timeOffEntries.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Time Off</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {timeOffEntries.map((entry, i) => (
              <div
                key={i}
                style={{
                  background: 'color-mix(in oklch, var(--info) 10%, var(--surface))',
                  border: '1px solid color-mix(in oklch, var(--info) 25%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{entry.employee_name}</div>
                <div style={{ fontSize: 12, color: 'var(--info)' }}>
                  {entry.request_type.charAt(0).toUpperCase() + entry.request_type.slice(1).replace('_', ' ')}
                </div>
                {entry.department && (
                  <div className="small muted">{entry.department}</div>
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
              <div
                style={{
                  marginTop: 8,
                  background: 'color-mix(in oklch, var(--warn) 14%, var(--surface))',
                  border: '1px solid color-mix(in oklch, var(--warn) 28%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                }}
              >
                <div className="hstack" style={{ gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--warn)' }}>
                  <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Department Overlap
                </div>
                {overlaps.map(([dept, entries]) => (
                  <div key={dept} style={{ fontSize: 12, color: 'var(--warn)', marginTop: 4, opacity: 0.85 }}>
                    <span style={{ fontWeight: 500 }}>{dept}:</span> {entries.map(e => e.employee_name.split(' ')[0]).join(', ')} are all off
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {records.length === 0 && timeOffEntries.length === 0 ? (
        <p className="small muted">No attendance records for this date.</p>
      ) : records.length === 0 ? null : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-ink)', fontFamily: 'var(--mono)' }}>{totalReg.toFixed(1)}</div>
              <div className="small muted">Reg Hours</div>
            </div>
            <div style={{ background: 'color-mix(in oklch, var(--warn) 12%, var(--surface))', border: '1px solid color-mix(in oklch, var(--warn) 25%, transparent)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{totalOT.toFixed(1)}</div>
              <div className="small muted">OT Hours</div>
            </div>
            <div style={{ background: 'color-mix(in oklch, var(--info) 10%, var(--surface))', border: '1px solid color-mix(in oklch, var(--info) 25%, transparent)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--info)', fontFamily: 'var(--mono)' }}>{(totalReg + totalOT).toFixed(1)}</div>
              <div className="small muted">Total Hours</div>
            </div>
          </div>

          {onDeleteRecords && selectedIds.size > 0 && (
            <div
              className="flex-between"
              style={{
                background: 'color-mix(in oklch, var(--danger) 10%, var(--surface))',
                border: '1px solid color-mix(in oklch, var(--danger) 28%, transparent)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--danger)' }}>{selectedIds.size} selected</span>
              {confirmBulkDelete ? (
                <div className="hstack" style={{ gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--danger)' }}>Are you sure?</span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="btn"
                    style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', fontSize: 12, padding: '4px 10px' }}
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    className="btn"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="btn"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', fontSize: 12, padding: '4px 10px', gap: 6 }}
                >
                  <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          <table className="kin-table">
            <thead>
              <tr>
                {(onDeleteRecord || onDeleteRecords) && (
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th>Employee</th>
                <th>In</th>
                <th>Out</th>
                <th style={{ textAlign: 'right' }}>Reg</th>
                <th style={{ textAlign: 'right' }}>OT</th>
                <th>Work Code</th>
                {onDeleteRecord && <th style={{ width: 32 }}></th>}
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} className="group">
                  {(onDeleteRecord || onDeleteRecords) && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                      />
                    </td>
                  )}
                  <td style={{ fontWeight: 500 }}>
                    {record.employee_name_raw}
                    {record.missing_punch === 1 && (
                      <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--warn)' }} title="Missing punch">!</span>
                    )}
                  </td>
                  <td className="mono">{record.punch_in || '-'}</td>
                  <td className="mono">{record.punch_out || '-'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{record.reg_hours > 0 ? record.reg_hours.toFixed(1) : '-'}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--warn)' }}>{record.ot_hours > 0 ? record.ot_hours.toFixed(1) : '-'}</td>
                  <td className="muted">{record.code_name || record.work_code || '-'}</td>
                  {onDeleteRecord && (
                    <td>
                      {confirmDeleteId === record.id ? (
                        <div className="hstack" style={{ gap: 4 }}>
                          <button
                            onClick={() => handleDeleteSingle(record.id)}
                            disabled={deleting}
                            style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{ fontSize: 12, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(record.id)}
                          className="opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--ink-4)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 120ms' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; }}
                          title="Delete record"
                        >
                          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
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
    </div>
  );
}
