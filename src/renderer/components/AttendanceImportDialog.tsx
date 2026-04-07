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
  const [importResult, setImportResult] = useState<AttendanceImportResult | null>(null);
  const [updateNames] = useState(true);

  const handleMapping = (rawName: string, employeeId: number | null) => {
    const next = new Map(manualMappings);
    if (employeeId == null) {
      next.delete(rawName);
    } else {
      next.set(rawName, employeeId);
    }
    setManualMappings(next);
  };

  const handleSearchChange = (rawName: string, term: string) => {
    const next = new Map(searchTerms);
    next.set(rawName, term);
    setSearchTerms(next);
  };

  const filteredEmployees = (rawName: string) => {
    const term = (searchTerms.get(rawName) ?? '').toLowerCase();
    if (!term) return employees;
    return employees.filter(e => e.employee_name.toLowerCase().includes(term));
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

      // Apply manual mappings to records before sending
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

  // Compute summary for confirmation step
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Review Employee Matches
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {parseResult.records.length} attendance records parsed from file
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Auto-matched */}
            {parseResult.matched.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Auto-Matched ({parseResult.matched.length})
                </h3>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {parseResult.matched.map(m => (
                    <div key={m.rawName} className="text-sm text-green-700 dark:text-green-400">
                      {m.rawName} {m.rawName !== m.employeeName && <span className="text-green-500">= {m.employeeName}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched - needs manual mapping */}
            {parseResult.unmatched.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                  Unmatched Employees ({parseResult.unmatched.length})
                </h3>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                  Select the matching employee from the database for each time clock name. Matched employees will have their name updated in the system to match the time clock for future imports.
                </p>
                <div className="space-y-3">
                  {parseResult.unmatched.map(u => (
                    <div key={u.rawName} className="flex items-center gap-3">
                      <div className="min-w-[160px]">
                        <div className="text-sm font-medium text-yellow-900 dark:text-yellow-200">{u.rawName}</div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-500">ID: {u.employeeIdRaw}, PIN: {u.pinNumber}</div>
                      </div>
                      <span className="text-gray-400 text-sm flex-shrink-0">-&gt;</span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={searchTerms.get(u.rawName) ?? ''}
                          onChange={e => handleSearchChange(u.rawName, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg mb-1 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                        />
                        <select
                          value={manualMappings.get(u.rawName) ?? ''}
                          onChange={e => handleMapping(u.rawName, e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                        >
                          <option value="">-- Skip (import unlinked) --</option>
                          {filteredEmployees(u.rawName).map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.employee_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parse errors */}
            {parseResult.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                  Parse Warnings ({parseResult.errors.length})
                </h3>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-700 dark:text-red-400">{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {totalMapped} matched, {totalUnmappedLeft > 0 ? `${totalUnmappedLeft} unlinked` : 'all linked'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Confirm Import
            </h2>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{parseResult.records.length}</div>
                <div className="text-xs text-blue-600 dark:text-blue-500">Records</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{parseResult.matched.length}</div>
                <div className="text-xs text-green-600 dark:text-green-500">Auto-Matched</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{manualMappings.size}</div>
                <div className="text-xs text-purple-600 dark:text-purple-500">Manually Mapped</div>
              </div>
            </div>

            {mappingSummary.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">
                  Name Updates
                </h3>
                <p className="text-xs text-purple-700 dark:text-purple-400 mb-2">
                  These employees will be renamed to match the time clock name:
                </p>
                <div className="space-y-1">
                  {mappingSummary.map(m => (
                    <div key={m.rawName} className="text-sm text-purple-900 dark:text-purple-200">
                      {m.employeeName} -&gt; {m.rawName}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalUnmappedLeft > 0 && (
              <div className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                {totalUnmappedLeft} employee(s) will be imported without being linked to a profile.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              onClick={() => setStep('review')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Importing attendance records...</p>
        </div>
      </div>
    );
  }

  // Step: Results
  if (step === 'results' && importResult) {
    const hasErrors = importResult.errors.length > 0;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Import Results
            </h2>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.imported}</div>
                <div className="text-sm text-green-600 dark:text-green-500">Records Imported</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{importResult.skipped}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Rows Skipped</div>
              </div>
            </div>

            {importResult.unmatched.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  Unlinked Employees ({importResult.unmatched.length})
                </h3>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.unmatched.map(name => (
                    <div key={name} className="text-sm text-yellow-900 dark:text-yellow-200">{name}</div>
                  ))}
                </div>
              </div>
            )}

            {hasErrors && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                  Errors ({importResult.errors.length})
                </h3>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
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

  return null;
}
