import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Employee, PayHistory, AuditLogEntry, EmployeeNote, EmployeeFile } from '../types/employee';
import EmployeeForm from '../components/EmployeeForm';
import ComboSelect from '../components/ComboSelect';
import { Paperclip, FileText, Trash2, Eye, Upload, ShieldAlert, Heart, Plus, ChevronDown, ChevronRight, Edit3 } from 'lucide-react';

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

  // Disciplinary
  const [disciplinaryActions, setDisciplinaryActions] = useState<any[]>([]);
  const [discOpen, setDiscOpen] = useState(false);
  const [showDiscForm, setShowDiscForm] = useState(false);
  const [discForm, setDiscForm] = useState({ type: 'verbal_warning', date: '', description: '', outcome: '', issued_by: '', follow_up_date: '', status: 'open' });
  const [editingDiscId, setEditingDiscId] = useState<number | null>(null);
  const [expandedDiscId, setExpandedDiscId] = useState<number | null>(null);

  // Benefits
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [benefitPlans, setBenefitPlans] = useState<any[]>([]);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ plan_id: 0, enrollment_date: '', coverage_level: 'employee', employee_contribution: 0, employer_contribution: 0 });
  const [showDepForm, setShowDepForm] = useState(false);
  const [depForm, setDepForm] = useState({ name: '', relationship: 'spouse', date_of_birth: '' });
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'job' | 'compensation' | 'documents' | 'history'>('overview');

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
        api.getDisciplinaryActions(eid).then(setDisciplinaryActions).catch(() => {});
        api.getEnrollments(eid).then(setEnrollments).catch(() => {});
        api.getDependents(eid).then(setDependents).catch(() => {});
        api.getBenefitPlans(true).then(setBenefitPlans).catch(() => {});
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
    return <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Loading…</div>;
  }

  if (!employee) {
    return <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>Employee not found.</div>;
  }

  const isArchived = employee.status === 'archived';

  if (editing) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Edit: {employee.employee_name}</h2>
        <div className="card p-6">
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
        { label: 'Shift', value: employee.shift_name
          ? employee.is_salary
            ? `${employee.shift_name} (Salaried)`
            : `${employee.shift_name} (${employee.scheduled_in} – ${employee.scheduled_out})`
          : 'Unassigned' },
        { label: 'Date of Hire', value: employee.doh },
        { label: 'Date of Separation', value: employee.date_of_separation },
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

  const personalSection = sections[0];
  const employmentSection = sections[1];
  const compSection = sections[2];
  const transfersSection = sections[3];

  const renderKv = (fields: { label: string; value: any }[]) => (
    <div className="kv-list">
      {fields.map(f => (
        <div key={f.label} className="kv-row">
          <span className="kv-label">{f.label}</span>
          <span className={`kv-value${f.value == null || f.value === '' ? ' empty' : ''}`}>
            {f.value == null || f.value === '' ? '—' : String(f.value)}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={() => navigate('/employees')} className="btn ghost" style={{ padding: '2px 0', alignSelf: 'flex-start' }}>
        ← Back to People
      </button>

      <div className="profile-card">
        <div style={{ position: 'relative' }} className="group">
          {photoDataUrl ? (
            <img src={photoDataUrl} className="profile-avatar" alt="" />
          ) : (
            <div className="profile-avatar">{getInitials(employee.employee_name)}</div>
          )}
          {!isArchived && (
            <button
              onClick={handleUploadPhoto}
              style={{
                position: 'absolute', inset: 0, borderRadius: 16,
                background: 'rgba(0,0,0,0.45)', color: 'white',
                opacity: 0, transition: 'opacity 0.15s',
                fontSize: 11, fontWeight: 500, border: 0, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              {photoDataUrl ? 'Change' : 'Upload'}
            </button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hstack" style={{ gap: 10 }}>
            <h1 className="profile-name">{employee.employee_name}</h1>
            {isArchived && <span className="badge">Archived</span>}
          </div>
          <p className="profile-subtitle">
            {employee.current_position}
            {employee.current_department ? ` · ${employee.current_department}` : ''}
          </p>
          <div className="profile-contact">
            {employee.id != null && (
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                ID {employee.id}
              </span>
            )}
            {employee.doh && (
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {employee.years_of_service ? `${employee.years_of_service}y ` : ''}since {employee.doh}
              </span>
            )}
            {employee.country_of_origin && (
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z"/></svg>
                {employee.country_of_origin}
              </span>
            )}
          </div>
        </div>
        <div className="hstack">
          <button onClick={handleExportPdf} disabled={exportingPdf} className="btn">
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
          {!isArchived && (
            <>
              <button onClick={() => setEditing(true)} className="btn primary">Edit</button>
              <button onClick={handleArchive} className="btn">Archive</button>
            </>
          )}
          {isArchived && (
            <>
              <button onClick={handleRestore} className="btn accent">Restore</button>
              <button onClick={handleDelete} className="btn" style={{ color: 'var(--danger)' }}>Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="tab-row">
        <button className="tab" aria-selected={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className="tab" aria-selected={activeTab === 'job'} onClick={() => setActiveTab('job')}>Job</button>
        <button className="tab" aria-selected={activeTab === 'compensation'} onClick={() => setActiveTab('compensation')}>Compensation</button>
        <button className="tab" aria-selected={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Documents</button>
        <button className="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')}>History</button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid-2">
          <div className="vstack" style={{ gap: 16 }}>
            <div className="section-card">
              <div className="section-head">
                <h3 className="section-title">About</h3>
              </div>
              <div className="section-body">{renderKv(personalSection.fields)}</div>
            </div>
          </div>
          <div className="vstack" style={{ gap: 16 }}>
            <div className="section-card">
              <div className="section-head">
                <h3 className="section-title">Employment</h3>
              </div>
              <div className="section-body">{renderKv(employmentSection.fields)}</div>
            </div>
            <div className="section-card">
              <div className="section-head">
                <h3 className="section-title">Compensation</h3>
              </div>
              <div className="section-body">{renderKv(compSection.fields)}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'job' && (
        <div className="vstack" style={{ gap: 16 }}>
          <div className="section-card">
            <div className="section-head"><h3 className="section-title">Employment</h3></div>
            <div className="section-body">{renderKv(employmentSection.fields)}</div>
          </div>
          <div className="section-card">
            <div className="section-head"><h3 className="section-title">Transfers</h3></div>
            <div className="section-body">{renderKv(transfersSection.fields)}</div>
          </div>
        </div>
      )}

      <div className="vstack" style={{ gap: 16 }}>

        {activeTab === 'compensation' && (
        <div className="section-card">
          <div className="section-head"><h3 className="section-title">Pay history</h3></div>
          <div className="section-body">
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
        </div>
        )}

        {activeTab === 'history' && (
        <div className="section-card">
          <div className="section-head"><h3 className="section-title">Change history</h3></div>
          <div className="section-body">
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
        </div>
        )}

        {activeTab === 'job' && (
        <div className="card p-6">
          <button onClick={() => setDiscOpen(!discOpen)} className="w-full flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Disciplinary Actions
              {disciplinaryActions.filter(a => a.status === 'open').length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {disciplinaryActions.filter(a => a.status === 'open').length} open
                </span>
              )}
            </h3>
            {discOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>

          {discOpen && (
            <div className="mt-4">
              {!isArchived && (
                <button onClick={() => { setShowDiscForm(!showDiscForm); setEditingDiscId(null); setDiscForm({ type: 'verbal_warning', date: '', description: '', outcome: '', issued_by: '', follow_up_date: '', status: 'open' }); }}
                  className="btn primary" style={{ marginBottom: 12 }}>
                  <Plus className="w-3.5 h-3.5" /> Add Action
                </button>
              )}

              {showDiscForm && (
                <div className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--surface-2)' }}>
                  <div className="vstack" style={{ gap: 12 }}>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="field">
                        <span className="field-label">Type *</span>
                        <ComboSelect
                          value={discForm.type}
                          options={[
                            { value: 'verbal_warning', label: 'Verbal Warning' },
                            { value: 'written_warning', label: 'Written Warning' },
                            { value: 'suspension', label: 'Suspension' },
                            { value: 'termination', label: 'Termination' },
                            { value: 'pip', label: 'PIP' },
                            { value: 'other', label: 'Other' },
                          ]}
                          onChange={v => setDiscForm({ ...discForm, type: v || 'verbal_warning' })}
                          includeNone={false}
                          searchable={false}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Date *</span>
                        <input type="date" value={discForm.date} onChange={e => setDiscForm({ ...discForm, date: e.target.value })} className="input" />
                      </label>
                      <label className="field">
                        <span className="field-label">Status</span>
                        <ComboSelect
                          value={discForm.status}
                          options={[
                            { value: 'open', label: 'Open' },
                            { value: 'resolved', label: 'Resolved' },
                            { value: 'escalated', label: 'Escalated' },
                          ]}
                          onChange={v => setDiscForm({ ...discForm, status: v || 'open' })}
                          includeNone={false}
                          searchable={false}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="field">
                        <span className="field-label">Issued By</span>
                        <input type="text" value={discForm.issued_by} onChange={e => setDiscForm({ ...discForm, issued_by: e.target.value })} className="input" />
                      </label>
                      <label className="field">
                        <span className="field-label">Follow-up Date</span>
                        <input type="date" value={discForm.follow_up_date} onChange={e => setDiscForm({ ...discForm, follow_up_date: e.target.value })} className="input" />
                      </label>
                    </div>
                    <label className="field">
                      <span className="field-label">Description</span>
                      <textarea value={discForm.description} onChange={e => setDiscForm({ ...discForm, description: e.target.value })} rows={2} className="input" />
                    </label>
                    <label className="field">
                      <span className="field-label">Outcome</span>
                      <textarea value={discForm.outcome} onChange={e => setDiscForm({ ...discForm, outcome: e.target.value })} rows={2} className="input" />
                    </label>
                    <div className="hstack" style={{ gap: 8 }}>
                      <button onClick={async () => {
                        if (!employee || !discForm.date) return;
                        if (editingDiscId) {
                          await api.updateDisciplinaryAction(editingDiscId, discForm);
                        } else {
                          await api.createDisciplinaryAction({ ...discForm, employee_id: employee.id });
                        }
                        setShowDiscForm(false);
                        setEditingDiscId(null);
                        const d = await api.getDisciplinaryActions(employee.id);
                        setDisciplinaryActions(d);
                      }} disabled={!discForm.date} className="btn primary">
                        {editingDiscId ? 'Save Changes' : 'Add Action'}
                      </button>
                      <button onClick={() => { setShowDiscForm(false); setEditingDiscId(null); }} className="btn ghost">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {disciplinaryActions.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">No disciplinary actions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {disciplinaryActions.map((action: any) => {
                    const typeLabels: Record<string, string> = { verbal_warning: 'Verbal Warning', written_warning: 'Written Warning', suspension: 'Suspension', termination: 'Termination', pip: 'PIP', other: 'Other' };
                    const statusStyles: Record<string, string> = { open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', escalated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
                    const isExpanded = expandedDiscId === action.id;
                    return (
                      <div key={action.id} className="border border-gray-100 dark:border-gray-700 rounded-lg">
                        <button onClick={() => setExpandedDiscId(isExpanded ? null : action.id)}
                          className="w-full flex items-center justify-between p-3 text-left">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[action.status] || ''}`}>{action.status}</span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{typeLabels[action.type] || action.type}</span>
                            <span className="text-xs text-gray-500">{action.date}</span>
                            {action.issued_by && <span className="text-xs text-gray-400">by {action.issued_by}</span>}
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-2 text-sm">
                            {action.description && <div><span className="text-xs font-medium text-gray-500">Description:</span><p className="text-gray-700 dark:text-gray-300">{action.description}</p></div>}
                            {action.outcome && <div><span className="text-xs font-medium text-gray-500">Outcome:</span><p className="text-gray-700 dark:text-gray-300">{action.outcome}</p></div>}
                            {action.follow_up_date && <p className="text-xs text-gray-500">Follow-up: {action.follow_up_date}</p>}
                            {!isArchived && (
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => {
                                  setEditingDiscId(action.id);
                                  setDiscForm({ type: action.type, date: action.date, description: action.description || '', outcome: action.outcome || '', issued_by: action.issued_by || '', follow_up_date: action.follow_up_date || '', status: action.status });
                                  setShowDiscForm(true);
                                }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                  <Edit3 className="w-3 h-3" /> Edit
                                </button>
                                <button onClick={async () => {
                                  if (!confirm('Delete this disciplinary action?')) return;
                                  await api.deleteDisciplinaryAction(action.id);
                                  const d = await api.getDisciplinaryActions(employee!.id);
                                  setDisciplinaryActions(d);
                                }} className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {activeTab === 'job' && (
        <div className="card p-6">
          <button onClick={() => setBenefitsOpen(!benefitsOpen)} className="w-full flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Benefits &amp; Dependents
              {enrollments.filter(e => e.status === 'active').length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  {enrollments.filter(e => e.status === 'active').length} active
                </span>
              )}
            </h3>
            {benefitsOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>

          {benefitsOpen && (
            <div className="mt-4 space-y-6">
              {/* Active Enrollments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollments</h4>
                  {!isArchived && (
                    <button onClick={() => setShowEnrollForm(!showEnrollForm)} className="btn primary" style={{ padding: '4px 8px', fontSize: 12 }}>
                      <Plus className="w-3 h-3" /> Enroll
                    </button>
                  )}
                </div>

                {showEnrollForm && (
                  <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--surface-2)' }}>
                    <div className="vstack" style={{ gap: 8 }}>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="field">
                          <span className="field-label">Plan *</span>
                          <ComboSelect
                            value={enrollForm.plan_id ? String(enrollForm.plan_id) : ''}
                            options={benefitPlans.map((p: any) => ({ value: String(p.id), label: `${p.plan_name} (${p.plan_type})` }))}
                            onChange={v => setEnrollForm({ ...enrollForm, plan_id: parseInt(v) || 0 })}
                            placeholder="Select plan..."
                            includeNone={true}
                            noneLabel="Select plan..."
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Enrollment Date *</span>
                          <input type="date" value={enrollForm.enrollment_date} onChange={e => setEnrollForm({ ...enrollForm, enrollment_date: e.target.value })} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">Coverage Level</span>
                          <ComboSelect
                            value={enrollForm.coverage_level}
                            options={[
                              { value: 'employee', label: 'Employee Only' },
                              { value: 'employee_spouse', label: 'Employee + Spouse' },
                              { value: 'employee_children', label: 'Employee + Children' },
                              { value: 'family', label: 'Family' },
                            ]}
                            onChange={v => setEnrollForm({ ...enrollForm, coverage_level: v || 'employee' })}
                            includeNone={false}
                            searchable={false}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="field">
                          <span className="field-label">Employee Contribution ($)</span>
                          <input type="number" step="0.01" value={enrollForm.employee_contribution} onChange={e => setEnrollForm({ ...enrollForm, employee_contribution: parseFloat(e.target.value) || 0 })} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">Employer Contribution ($)</span>
                          <input type="number" step="0.01" value={enrollForm.employer_contribution} onChange={e => setEnrollForm({ ...enrollForm, employer_contribution: parseFloat(e.target.value) || 0 })} className="input" />
                        </label>
                      </div>
                      <div className="hstack" style={{ gap: 8 }}>
                        <button onClick={async () => {
                          if (!employee || !enrollForm.plan_id || !enrollForm.enrollment_date) return;
                          await api.createEnrollment({ ...enrollForm, employee_id: employee.id });
                          setShowEnrollForm(false);
                          setEnrollForm({ plan_id: 0, enrollment_date: '', coverage_level: 'employee', employee_contribution: 0, employer_contribution: 0 });
                          const e = await api.getEnrollments(employee.id);
                          setEnrollments(e);
                        }} disabled={!enrollForm.plan_id || !enrollForm.enrollment_date} className="btn primary" style={{ padding: '4px 10px', fontSize: 12 }}>Add</button>
                        <button onClick={() => setShowEnrollForm(false)} className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {enrollments.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No benefit enrollments.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Plan</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Coverage</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">EE $</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">ER $</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Status</th>
                        <th className="px-2 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((en: any) => {
                        const coverageLabels: Record<string, string> = { employee: 'Employee', employee_spouse: 'EE + Spouse', employee_children: 'EE + Children', family: 'Family' };
                        const statusStyles: Record<string, string> = { active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', terminated: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
                        return (
                          <tr key={en.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200">{en.plan_name} <span className="text-xs text-gray-400">({en.plan_type})</span></td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300 text-xs">{coverageLabels[en.coverage_level] || en.coverage_level || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">${Number(en.employee_contribution).toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">${Number(en.employer_contribution).toFixed(2)}</td>
                            <td className="px-2 py-1.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[en.status] || ''}`}>{en.status}</span></td>
                            <td className="px-2 py-1.5 text-right">
                              {!isArchived && (
                                <button onClick={async () => {
                                  if (!confirm('Remove this enrollment?')) return;
                                  await api.deleteEnrollment(en.id);
                                  const e = await api.getEnrollments(employee!.id);
                                  setEnrollments(e);
                                }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Dependents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dependents</h4>
                  {!isArchived && (
                    <button onClick={() => setShowDepForm(!showDepForm)} className="btn primary" style={{ padding: '4px 8px', fontSize: 12 }}>
                      <Plus className="w-3 h-3" /> Add Dependent
                    </button>
                  )}
                </div>

                {showDepForm && (
                  <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--surface-2)' }}>
                    <div className="vstack" style={{ gap: 8 }}>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="field">
                          <span className="field-label">Name *</span>
                          <input type="text" value={depForm.name} onChange={e => setDepForm({ ...depForm, name: e.target.value })} className="input" />
                        </label>
                        <label className="field">
                          <span className="field-label">Relationship</span>
                          <ComboSelect
                            value={depForm.relationship}
                            options={[
                              { value: 'spouse', label: 'Spouse' },
                              { value: 'child', label: 'Child' },
                              { value: 'domestic_partner', label: 'Domestic Partner' },
                              { value: 'other', label: 'Other' },
                            ]}
                            onChange={v => setDepForm({ ...depForm, relationship: v || 'spouse' })}
                            includeNone={false}
                            searchable={false}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Date of Birth</span>
                          <input type="date" value={depForm.date_of_birth} onChange={e => setDepForm({ ...depForm, date_of_birth: e.target.value })} className="input" />
                        </label>
                      </div>
                      <div className="hstack" style={{ gap: 8 }}>
                        <button onClick={async () => {
                          if (!employee || !depForm.name.trim()) return;
                          await api.createDependent({ ...depForm, employee_id: employee.id });
                          setShowDepForm(false);
                          setDepForm({ name: '', relationship: 'spouse', date_of_birth: '' });
                          const d = await api.getDependents(employee.id);
                          setDependents(d);
                        }} disabled={!depForm.name.trim()} className="btn primary" style={{ padding: '4px 10px', fontSize: 12 }}>Add</button>
                        <button onClick={() => setShowDepForm(false)} className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {dependents.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No dependents recorded.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Name</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Relationship</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">DOB</th>
                        <th className="px-2 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependents.map((dep: any) => {
                        const relLabels: Record<string, string> = { spouse: 'Spouse', child: 'Child', domestic_partner: 'Domestic Partner', other: 'Other' };
                        return (
                          <tr key={dep.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200">{dep.name}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300 text-xs">{relLabels[dep.relationship] || dep.relationship || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{dep.date_of_birth || '—'}</td>
                            <td className="px-2 py-1.5 text-right">
                              {!isArchived && (
                                <button onClick={async () => {
                                  if (!confirm(`Remove dependent "${dep.name}"?`)) return;
                                  await api.deleteDependent(dep.id);
                                  const d = await api.getDependents(employee!.id);
                                  setDependents(d);
                                }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
        )}

        {activeTab === 'documents' && (
        <div className="card p-6">
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
                className="btn primary"
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
        )}

        {activeTab === 'history' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Notes</h3>

          {/* Add note */}
          <div className="hstack" style={{ gap: 8, marginBottom: 16 }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="input"
              style={{ flex: 1, resize: 'none' }}
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
              className="btn primary"
              style={{ alignSelf: 'flex-end' }}
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
                    <div className="vstack" style={{ gap: 8 }}>
                      <textarea
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        rows={3}
                        className="input"
                        style={{ resize: 'none' }}
                      />
                      <div className="hstack" style={{ gap: 8 }}>
                        <button
                          onClick={async () => {
                            await api.updateEmployeeNote(note.id, editingNoteContent.trim());
                            setEditingNoteId(null);
                            const n = await api.getEmployeeNotes(employee!.id);
                            setNotes(n);
                          }}
                          disabled={!editingNoteContent.trim()}
                          className="btn primary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="btn ghost"
                          style={{ padding: '4px 10px', fontSize: 12 }}
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
        )}
      </div>
    </div>
  );
}
