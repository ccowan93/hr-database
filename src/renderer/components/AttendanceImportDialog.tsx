import React, { useState, useMemo } from 'react';
import { api } from '../api';
import type { ParsedAttendanceResult, AttendanceImportResult, ConfirmImportData } from '../types/attendance';

type Step = 'review' | 'confirm' | 'importing' | 'results';

interface AttendanceImportDialogProps {
  parseResult: ParsedAttendanceResult;
  employees: { id: number; employee_name: string }[];
  onClose: () => void;
  onImported: () => void;
}

export default function AttendanceImportDialog({ parseResult, employees, onClose, onImported }: AttendanceImportDialogProps) {
  const [step, setStep] = useState<Step>('review');
  const [manualMappings, setManualMappings] = useState<Map<string, number>>(new Map());
  const [searchTerms, setSearchTerms] = useState<Map<string, string>>(new Map());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<AttendanceImportResult | null>(null);
  const [updateNames] = useState(true);

  const handleMapping = (rawName: string, employeeId: number | null, employeeName?: string) => {
    const next = new Map(manualMappings);
    const nextSearch = new Map(searchTerms);
    if (employeeId == null) {
      next.delete(rawName);
      nextSearch.set(rawName, '');
    } else {
      next.set(rawName, employeeId);
      nextSearch.set(rawName, employeeName || '');
    }
    setManualMappings(next);
    setSearchTerms(nextSearch);
    setOpenDropdown(null);
  };

  const handleSearchChange = (rawName: string, term: string) => {
    const next = new Map(searchTerms);
    next.set(rawName, term);
    setSearchTerms(next);
    if (manualMappings.has(rawName)) {
      const nextMappings = new Map(manualMappings);
      nextMappings.delete(rawName);
      setManualMappings(nextMappings);
    }
    setOpenDropdown(rawName);
  };

  const filteredEmployees = (rawName: string) => {
    const term = (searchTerms.get(rawName) ?? '').toLowerCase();
    if (!term) return employees.slice(0, 50);
    return employees.filter(e => e.employee_name.toLowerCase().includes(term)).slice(0, 20);
  };

  const totalMapped = parseResult.matched.length + manualMappings.size;
  const totalUnmappedLeft = parseResult.unmatched.length - manualMappings.size;

  const handleConfirm = async () => {
    setStep('importing');
    try {
      const mappingsArray = Array.from(manualMappings.entries()).map(([rawName, employeeId]) => ({
        rawName,
        employeeId,
      }));

      const records = parseResult.records.map(r => {
        const mapped = manualMappings.get(r.employee_name_raw);
        if (mapped != null) {
          return { ...r, employee_id: mapped };
        }
        return r;
      });

      const data: ConfirmImportData = {
        records,
        manualMappings: mappingsArray,
        updateNames,
      };

      const result = await api.confirmAttendanceImport(data);
      setImportResult(result);
      setStep('results');
      onImported();
    } catch (err: any) {
      setImportResult({
        imported: 0,
        skipped: 0,
        unmatched: [],
        errors: [err.message || 'Import failed'],
      });
      setStep('results');
    }
  };

  const mappingSummary = useMemo(() => {
    return Array.from(manualMappings.entries()).map(([rawName, empId]) => {
      const emp = employees.find(e => e.id === empId);
      return {
        rawName,
        employeeId: empId,
        employeeName: emp?.employee_name ?? `ID ${empId}`,
      };
    });
  }, [manualMappings, employees]);

  // Step: Review matches
  if (step === 'review') {
    return (
      <div
        className="kin-modal-backdrop"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="kin-modal" style={{ maxWidth: 640, maxHeight: '85vh' }}>
          <div className="kin-modal-head">
            <div style={{ flex: 1 }}>
              <h2 className="kin-modal-title">Review Employee Matches</h2>
              <div className="small muted">
                {parseResult.records.length} attendance records parsed from file
              </div>
            </div>
          </div>

          <div className="kin-modal-body">
            {/* Auto-matched */}
            {parseResult.matched.length > 0 && (
              <div className="kin-alert" style={{ borderColor: 'var(--success)' }}>
                <div className="kin-alert-title" style={{ color: 'var(--success)' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Auto-Matched ({parseResult.matched.length})
                </div>
                <div className="vstack" style={{ gap: 2, marginTop: 6, maxHeight: 128, overflowY: 'auto' }}>
                  {parseResult.matched.map(m => (
                    <div key={m.rawName} className="small" style={{ color: 'var(--ink-2)' }}>
                      {m.rawName} {m.rawName !== m.employeeName && <span className="muted">= {m.employeeName}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched - needs manual mapping */}
            {parseResult.unmatched.length > 0 && (
              <div className="kin-alert warn">
                <div className="kin-alert-title">
                  Unmatched Employees ({parseResult.unmatched.length})
                </div>
                <p className="small" style={{ margin: '4px 0 10px 0' }}>
                  Select the matching employee from the database for each time clock name. Matched employees will have their name updated in the system to match the time clock for future imports.
                </p>
                <div className="vstack" style={{ gap: 10 }}>
                  {parseResult.unmatched.map(u => (
                    <div key={u.rawName} className="hstack" style={{ gap: 10, alignItems: 'center' }}>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{u.rawName}</div>
                        <div className="small muted">ID: {u.employeeIdRaw}, PIN: {u.pinNumber}</div>
                      </div>
                      <span className="muted small" style={{ flexShrink: 0 }}>-&gt;</span>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            placeholder="Type to search employees..."
                            value={searchTerms.get(u.rawName) ?? ''}
                            onChange={e => handleSearchChange(u.rawName, e.target.value)}
                            onFocus={() => setOpenDropdown(u.rawName)}
                            className="input"
                            style={manualMappings.has(u.rawName) ? { background: 'var(--accent-soft)', borderColor: 'var(--success)' } : undefined}
                          />
                          {manualMappings.has(u.rawName) && (
                            <button
                              onClick={() => handleMapping(u.rawName, null)}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-4)', display: 'flex', alignItems: 'center' }}
                              title="Clear selection"
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {openDropdown === u.rawName && !manualMappings.has(u.rawName) && (
                          <div
                            style={{
                              position: 'absolute',
                              zIndex: 10,
                              width: '100%',
                              marginTop: 4,
                              background: 'var(--surface)',
                              border: '1px solid var(--line)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              maxHeight: 160,
                              overflowY: 'auto',
                            }}
                          >
                            {filteredEmployees(u.rawName).length === 0 ? (
                              <div className="small muted" style={{ padding: '8px 12px' }}>No matches found</div>
                            ) : (
                              filteredEmployees(u.rawName).map(emp => (
                                <button
                                  key={emp.id}
                                  onClick={() => handleMapping(u.rawName, emp.id, emp.employee_name)}
                                  style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, color: 'var(--ink)', background: 'transparent', border: 0, cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                >
                                  {emp.employee_name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parse errors */}
            {parseResult.errors.length > 0 && (
              <div className="kin-alert danger">
                <div className="kin-alert-title">
                  Parse Warnings ({parseResult.errors.length})
                </div>
                <div className="vstack" style={{ gap: 2, marginTop: 6, maxHeight: 96, overflowY: 'auto' }}>
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="small">{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="kin-modal-foot" style={{ justifyContent: 'space-between' }}>
            <div className="small muted">
              {totalMapped} matched, {totalUnmappedLeft > 0 ? `${totalUnmappedLeft} unlinked` : 'all linked'}
            </div>
            <div className="hstack" style={{ gap: 8 }}>
              <button
                onClick={onClose}
                className="btn ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="btn primary"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Confirmation review
  if (step === 'confirm') {
    return (
      <div
        className="kin-modal-backdrop"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="kin-modal" style={{ maxWidth: 520 }}>
          <div className="kin-modal-head">
            <h2 className="kin-modal-title">Confirm Import</h2>
          </div>

          <div className="kin-modal-body">
            <div className="grid-3">
              <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-ink)' }}>{parseResult.records.length}</div>
                <div className="small muted">Records</div>
              </div>
              <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{parseResult.matched.length}</div>
                <div className="small muted">Auto-Matched</div>
              </div>
              <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{manualMappings.size}</div>
                <div className="small muted">Manually Mapped</div>
              </div>
            </div>

            {mappingSummary.length > 0 && (
              <div className="kin-alert info">
                <div className="kin-alert-title">Name Updates</div>
                <p className="small" style={{ margin: '4px 0 6px 0' }}>
                  These employees will be renamed to match the time clock name:
                </p>
                <div className="vstack" style={{ gap: 2 }}>
                  {mappingSummary.map(m => (
                    <div key={m.rawName} className="small" style={{ color: 'var(--ink)' }}>
                      {m.employeeName} -&gt; {m.rawName}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalUnmappedLeft > 0 && (
              <div className="kin-alert warn">
                <div className="small">
                  {totalUnmappedLeft} employee(s) will be imported without being linked to a profile.
                </div>
              </div>
            )}
          </div>

          <div className="kin-modal-foot" style={{ justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep('review')}
              className="btn ghost"
            >
              Back
            </button>
            <div className="hstack" style={{ gap: 8 }}>
              <button
                onClick={onClose}
                className="btn ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="btn primary"
                style={{ background: 'var(--success)' }}
              >
                Import {parseResult.records.length} Records
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Importing (spinner)
  if (step === 'importing') {
    return (
      <div className="kin-modal-backdrop">
        <div className="kin-modal" style={{ maxWidth: 360, padding: 32, textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '4px solid var(--accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>Importing attendance records...</p>
        </div>
      </div>
    );
  }

  // Step: Results
  if (step === 'results' && importResult) {
    const hasErrors = importResult.errors.length > 0;
    return (
      <div
        className="kin-modal-backdrop"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="kin-modal" style={{ maxWidth: 520 }}>
          <div className="kin-modal-head">
            <h2 className="kin-modal-title">Import Results</h2>
          </div>

          <div className="kin-modal-body">
            <div className="grid-2">
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{importResult.imported}</div>
                <div className="small muted">Records Imported</div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-2)' }}>{importResult.skipped}</div>
                <div className="small muted">Rows Skipped</div>
              </div>
            </div>

            {importResult.unmatched.length > 0 && (
              <div className="kin-alert warn">
                <div className="kin-alert-title">Unlinked Employees ({importResult.unmatched.length})</div>
                <div className="vstack" style={{ gap: 2, marginTop: 6, maxHeight: 128, overflowY: 'auto' }}>
                  {importResult.unmatched.map(name => (
                    <div key={name} className="small">{name}</div>
                  ))}
                </div>
              </div>
            )}

            {hasErrors && (
              <div className="kin-alert danger">
                <div className="kin-alert-title">Errors ({importResult.errors.length})</div>
                <div className="vstack" style={{ gap: 2, marginTop: 6, maxHeight: 128, overflowY: 'auto' }}>
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="small">{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="kin-modal-foot">
            <button
              onClick={onClose}
              className="btn primary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
