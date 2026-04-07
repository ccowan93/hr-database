import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Employee, PayHistory, AuditLogEntry, EmployeeNote, EmployeeFile } from '../types/employee';
import EmployeeForm from '../components/EmployeeForm';
import { Paperclip, FileText, Trash2, Eye, Upload } from 'lucide-react';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payHistory, setPayHistory] = useState<PayHistory[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [notes, setNotes] = useState<EmployeeNote[]>([]);
  const [files, setFiles] = useState<EmployeeFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const eid = Number(id);
    Promise.all([
      api.getEmployee(eid),
      api.getPayHistory(eid),
      api.getAuditLog(eid),
      api.getEmployeeNotes(eid),
      api.getEmployeeFiles(eid),
    ]).then(([emp, history, audit, n, f]) => {
      setEmployee(emp || null);
      setPayHistory(history);
      setAuditLog(audit);
      setNotes(n);
      setFiles(f);
      if (emp) {
        api.getEmployeePhoto(eid).then(setPhotoDataUrl).catch(() => {});
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: Partial<Employee>) => {
    if (!employee) return;
    const updated = await api.updateEmployee(employee.id, data);
    setEmployee(updated);
    setEditing(false);
    // Refresh audit log after edit
    api.getAuditLog(employee.id).then(setAuditLog).catch(() => {});
  };

  const handleArchive = async () => {
    if (!employee) return;
    if (!confirm(`Archive ${employee.employee_name}? They will be moved to the archived list but their data will be retained.`)) return;
    const updated = await api.archiveEmployee(employee.id);
    setEmployee(updated);
    api.getAuditLog(employee.id).then(setAuditLog).catch(() => {});
  };

  const handleRestore = async () => {
    if (!employee) return;
    const updated = await api.restoreEmployee(employee.id);
    setEmployee(updated);
    api.getAuditLog(employee.id).then(setAuditLog).catch(() => {});
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (!confirm(`PERMANENTLY delete ${employee.employee_name} and all their pay history? This cannot be undone.`)) return;
    await api.deleteEmployee(employee.id);
    navigate('/employees');
  };

  const handleExportPdf = async () => {
    if (!employee) return;
    setExportingPdf(true);
    try {
      const result = await api.exportEmployeePDF(employee.id);
      if (result.success) {
        alert(`Exported to ${result.path}`);
      } else if (result.error && result.error !== 'Export cancelled') {
        alert('Export failed: ' + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!employee) return;
    const result = await api.saveEmployeePhoto(employee.id);
    if (result.success) {
      const photo = await api.getEmployeePhoto(employee.id);
      setPhotoDataUrl(photo);
    }
  };

  const handleRemovePhoto = async () => {
    if (!employee) return;
    await api.removeEmployeePhoto(employee.id);
    setPhotoDataUrl(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading...</div>;
  }

  if (!employee) {
    return <div className="text-center text-gray-500 dark:text-gray-400 py-12">Employee not found.</div>;
  }

  const isArchived = employee.status === 'archived';

  if (editing) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Edit: {employee.employee_name}</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <EmployeeForm employee={employee} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      </div>
    );
  }

  const sections = [
    {
      title: 'Personal Information',
      fields: [
        { label: 'Full Name', value: employee.employee_name },
        { label: 'ID', value: employee.id },
        { label: 'Date of Birth', value: employee.dob },
        { label: 'Age', value: employee.age },
        { label: 'Sex', value: employee.sex },
        { label: 'Race', value: employee.race },
        { label: 'Ethnicity', value: employee.ethnicity },
        { label: 'Country of Origin', value: employee.country_of_origin },
        { label: 'Languages Spoken', value: employee.languages_spoken },
        { label: 'Highest Education', value: employee.highest_education },
      ],
    },
    {
      title: 'Employment',
      fields: [
        { label: 'Department', value: employee.current_department },
        { label: 'Position', value: employee.current_position },
        { label: 'Supervisory Role', value: employee.supervisory_role === 'Y' ? 'Yes' : 'No' },
        { label: 'Shift', value: employee.shift === 'night' ? 'Night' : 'Day' },
        { label: 'Date of Hire', value: employee.doh },
        { label: 'Years of Service', value: employee.years_of_service },
        ...(isArchived ? [{ label: 'Archived On', value: employee.archived_at }] : []),
      ],
    },
    {
      title: 'Compensation',
      fields: [
        { label: 'Starting Pay (Base)', value: employee.starting_pay_base != null ? `$${employee.starting_pay_base.toFixed(2)}` : null },
        { label: 'Date of Previous Raise', value: employee.date_previous_raise },
        { label: 'Previous Pay Rate', value: employee.previous_pay_rate != null ? `$${employee.previous_pay_rate.toFixed(2)}` : null },
        { label: 'Date of Last Raise', value: employee.date_last_raise },
        { label: 'Current Pay Rate', value: employee.current_pay_rate != null ? `$${employee.current_pay_rate.toFixed(2)}` : null },
      ],
    },
    {
      title: 'Transfers',
      fields: [
        { label: 'Department Transfers', value: employee.department_transfers },
        { label: 'Date of Transfer', value: employee.date_of_transfer },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/employees')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
            &larr; Back to Employees
          </button>
          <div className="flex items-center gap-4">
            <div className="relative group">
              {photoDataUrl ? (
                <img src={photoDataUrl} className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" alt="" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-lg font-bold text-blue-600 dark:text-blue-400 border-2 border-gray-200 dark:border-gray-600">
                  {getInitials(employee.employee_name)}
                </div>
              )}
              {!isArchived && (
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={handleUploadPhoto}
                    className="text-white text-xs font-medium"
                  >
                    {photoDataUrl ? 'Change' : 'Upload'}
                  </button>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{employee.employee_name}</h2>
                {isArchived && (
                  <span className="px-2.5 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">Archived</span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{employee.current_position} &mdash; {employee.current_department}</p>
              {photoDataUrl && !isArchived && (
                <button onClick={handleRemovePhoto} className="text-xs text-red-500 hover:underline mt-0.5">Remove photo</button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
          {!isArchived && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                Archive
              </button>
            </>
          )}
          {isArchived && (
            <>
              <button
                onClick={handleRestore}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Restore
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                Delete Permanently
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{section.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.fields.map(field => (
                <div key={field.label}>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{field.label}</p>
                  <p className="text-sm text-gray-800 dark:text-gray-100 mt-1">{field.value ?? <span className="text-gray-300 dark:text-gray-600">-</span>}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Pay History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Pay History</h3>
          {payHistory.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No pay history recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Pay Rate</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Department</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Position</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payHistory.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{entry.raise_date ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{entry.pay_rate != null ? `$${entry.pay_rate.toFixed(2)}` : '-'}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{entry.department ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{entry.position ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-medium">{entry.change_type}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{entry.notes ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Change History (Audit Log) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Change History</h3>
          {auditLog.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No changes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Field</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Old Value</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">New Value</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {new Date(entry.changed_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200 font-mono text-xs">{entry.field_name}</td>
                      <td className="px-3 py-2 text-red-600 dark:text-red-400 text-xs">{entry.old_value ?? '-'}</td>
                      <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 text-xs">{entry.new_value ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.change_source === 'manual'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : entry.change_source === 'excel_update'
                            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {entry.change_source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Files & Documents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              Files &amp; Documents
            </h3>
            {!isArchived && (
              <button
                onClick={async () => {
                  if (!employee) return;
                  setUploadingFile(true);
                  try {
                    const result = await api.uploadEmployeeFile(employee.id);
                    if (result) {
                      const f = await api.getEmployeeFiles(employee.id);
                      setFiles(f);
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUploadingFile(false);
                  }
                }}
                disabled={uploadingFile}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadingFile ? 'Uploading...' : 'Upload File'}
              </button>
            )}
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No files attached yet.</p>
          ) : (
            <div className="space-y-3">
              {files.map(file => (
                <div key={file.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{file.file_name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {file.file_type && <span className="uppercase">{file.file_type}</span>}
                          {file.file_size != null && <span>{(file.file_size / 1024).toFixed(1)} KB</span>}
                          <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.ocr_text && (
                        <button
                          onClick={() => setExpandedOcrId(expandedOcrId === file.id ? null : file.id)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                          title="View OCR Text"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => api.openEmployeeFile(file.id)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                        title="Open File"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {!isArchived && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${file.file_name}"?`)) return;
                            await api.deleteEmployeeFile(file.id);
                            const f = await api.getEmployeeFiles(employee!.id);
                            setFiles(f);
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {file.ocr_text && expandedOcrId === file.id && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">OCR Extracted Text</p>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">{file.ocr_text}</pre>
                    </div>
                  )}
                  {file.notes && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{file.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Notes</h3>

          {/* Add note */}
          <div className="flex gap-2 mb-4">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200 resize-none"
            />
            <button
              onClick={async () => {
                if (!employee || !newNote.trim()) return;
                await api.addEmployeeNote(employee.id, newNote.trim());
                setNewNote('');
                const n = await api.getEmployeeNotes(employee.id);
                setNotes(n);
              }}
              disabled={!newNote.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 self-end"
            >
              Add
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await api.updateEmployeeNote(note.id, editingNoteContent.trim());
                            setEditingNoteId(null);
                            const n = await api.getEmployeeNotes(employee!.id);
                            setNotes(n);
                          }}
                          disabled={!editingNoteContent.trim()}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(note.created_at).toLocaleString()}
                          {note.updated_at !== note.created_at && ' (edited)'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this note?')) return;
                              await api.deleteEmployeeNote(note.id);
                              const n = await api.getEmployeeNotes(employee!.id);
                              setNotes(n);
                            }}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
