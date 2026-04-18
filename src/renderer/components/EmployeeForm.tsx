import React, { useState, useEffect, useRef } from 'react';
import type { Employee, Shift } from '../types/employee';
import { api } from '../api';
import ComboSelect from './ComboSelect';

interface EmployeeFormProps {
  employee?: Employee;
  onSave: (data: Partial<Employee>) => void;
  onCancel: () => void;
}

const FIELD_GROUPS = [
  {
    title: 'Personal Information',
    fields: [
      { key: 'employee_name', label: 'Full Name', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female'] },
      { key: 'race', label: 'Race', type: 'lookup', lookupKey: 'races' },
      { key: 'ethnicity', label: 'Ethnicity', type: 'lookup', lookupKey: 'ethnicities' },
      { key: 'country_of_origin', label: 'Country of Origin', type: 'lookup', lookupKey: 'countries' },
      { key: 'languages_spoken', label: 'Languages Spoken', type: 'multi-lookup', lookupKey: 'languages' },
      { key: 'highest_education', label: 'Highest Education', type: 'lookup', lookupKey: 'educationLevels' },
    ],
  },
  {
    title: 'Employment',
    fields: [
      { key: 'current_department', label: 'Department(s)', type: 'multi-lookup', lookupKey: 'departments' },
      { key: 'current_position', label: 'Position', type: 'text' },
      { key: 'supervisory_role', label: 'Supervisory Role', type: 'select', options: ['Y', 'N'] },
      { key: 'shift_id', label: 'Shift', type: 'shift-select' },
      { key: 'doh', label: 'Date of Hire', type: 'date' },
      { key: 'date_of_separation', label: 'Date of Separation', type: 'date' },
    ],
  },
  {
    title: 'Compensation',
    fields: [
      { key: 'starting_pay_base', label: 'Starting Pay (Base)', type: 'number' },
      { key: 'date_previous_raise', label: 'Date of Previous Raise', type: 'date' },
      { key: 'previous_pay_rate', label: 'Previous Pay Rate', type: 'number' },
      { key: 'date_last_raise', label: 'Date of Last Raise', type: 'date' },
      { key: 'current_pay_rate', label: 'Current Pay Rate', type: 'number' },
    ],
  },
  {
    title: 'Transfers',
    fields: [
      { key: 'department_transfers', label: 'Department Transfers', type: 'text' },
      { key: 'date_of_transfer', label: 'Date of Transfer', type: 'date' },
    ],
  },
];

const inputClass = 'kin-field-trigger';

interface MultiSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function MultiSelect({ value, options, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value ? value.split(/[,;\/]+/).map(s => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (lang: string) => {
    let next: string[];
    if (selected.includes(lang)) {
      next = selected.filter(s => s !== lang);
    } else {
      next = [...selected, lang];
    }
    onChange(next.join(', '));
  };

  const addCustom = () => {
    const trimmed = search.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed].join(', '));
    }
    setSearch('');
  };

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o)
  );

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setIsOpen(true)}
        className={`${inputClass} min-h-[38px] cursor-pointer flex flex-wrap gap-1 items-center`}
      >
        {selected.length === 0 && (
          <span className="text-gray-400 dark:text-gray-500 text-sm">{placeholder || 'Select...'}</span>
        )}
        {selected.map(s => (
          <span key={s} className="kin-chip">
            {s}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(s); }}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {isOpen && (
        <div className="kin-dropdown-popup">
          <div className="kin-dropdown-search">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
              }}
              placeholder="Search or type new..."
              className="kin-dropdown-search-input"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {opt}
              </button>
            ))}
            {search.trim() && !options.includes(search.trim()) && !selected.includes(search.trim()) && (
              <button
                type="button"
                onClick={addCustom}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Add "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !search.trim() && (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No options available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function DatePicker({ value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseISO = (iso: string): Date | null => {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  };

  const toISO = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDisplay = (iso: string): string => {
    const d = parseISO(iso);
    if (!d) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day}/${d.getFullYear()}`;
  };

  const selected = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initialView = selected || today;
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  useEffect(() => {
    if (!isOpen) {
      const v = selected || today;
      setViewYear(v.getFullYear());
      setViewMonth(v.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: Date; muted: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
    cells.push({ date: d, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth, d), muted: false });
  }
  while (cells.length < 42) {
    const next = new Date(viewYear, viewMonth + 1, cells.length - daysInMonth - startWeekday + 1);
    cells.push({ date: next, muted: true });
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setIsOpen(o => !o)}
        className={`${inputClass} cursor-pointer`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {formatDisplay(value) || 'mm/dd/yyyy'}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path strokeLinecap="round" d="M3 9h18M8 3v4M16 3v4" />
        </svg>
      </div>

      {isOpen && (
        <div className="kin-dropdown-popup kin-calendar" style={{ maxHeight: 'none', overflow: 'visible' }}>
          <div className="kin-cal-head">
            <button type="button" className="kin-cal-nav" onClick={prevMonth} aria-label="Previous month">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="kin-cal-title">{MONTHS[viewMonth]} {viewYear}</div>
            <button type="button" className="kin-cal-nav" onClick={nextMonth} aria-label="Next month">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <div className="kin-cal-grid">
            {WEEKDAYS.map(w => (
              <div key={w} className="kin-cal-weekday">{w}</div>
            ))}
            {cells.map((cell, i) => {
              const isToday = isSameDay(cell.date, today);
              const isSelected = selected ? isSameDay(cell.date, selected) : false;
              const cls = [
                'kin-cal-day',
                cell.muted ? 'muted' : '',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => { onChange(toISO(cell.date)); setIsOpen(false); }}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="kin-cal-foot">
            <button
              type="button"
              className="kin-cal-action"
              onClick={() => { onChange(''); setIsOpen(false); }}
            >
              Clear
            </button>
            <button
              type="button"
              className="kin-cal-action"
              onClick={() => { onChange(toISO(today)); setIsOpen(false); }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ShiftSelectProps {
  value: number | null;
  shifts: Shift[];
  onChange: (shiftId: number | null) => void;
  onShiftsChanged: () => void;
}

function ShiftSelect({ value, shifts, onChange, onShiftsChanged }: ShiftSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIn, setNewIn] = useState('07:00');
  const [newOut, setNewOut] = useState('15:30');
  const [newLunchStart, setNewLunchStart] = useState('11:30');
  const [newLunchEnd, setNewLunchEnd] = useState('12:00');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = shifts.find(s => s.id === value);
  const filtered = shifts.filter(s =>
    s.shift_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const id = await api.createShift({
        shift_name: newName.trim(),
        scheduled_in: newIn,
        scheduled_out: newOut,
        scheduled_lunch_start: newLunchStart || null,
        scheduled_lunch_end: newLunchEnd || null,
      });
      onChange(Number(id));
      onShiftsChanged();
      setAdding(false);
      setNewName('');
      setNewIn('07:00');
      setNewOut('15:30');
      setNewLunchStart('11:30');
      setNewLunchEnd('12:00');
      setIsOpen(false);
    } catch (err: any) {
      alert('Failed to create shift: ' + (err.message || err));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setIsOpen(true)}
        className={`${inputClass} cursor-pointer flex items-center justify-between`}
      >
        <span className={selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {selected
            ? selected.is_salary
              ? `${selected.shift_name} (Salaried)`
              : `${selected.shift_name} (${selected.scheduled_in} – ${selected.scheduled_out})`
            : 'Select shift...'}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {isOpen && (
        <div className="kin-dropdown-popup" style={{ overflow: 'visible' }}>
          <div className="kin-dropdown-search">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shifts..."
              className="kin-dropdown-search-input"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            <button
              type="button"
              onClick={() => { onChange(null); setIsOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              -- None --
            </button>
            {filtered.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id); setIsOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  s.id === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="font-medium">{s.shift_name}</span>
                {s.is_salary
                  ? <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Salaried</span>
                  : <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{s.scheduled_in} – {s.scheduled_out}</span>
                }
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                + Add New Shift
              </button>
            ) : (
              <div className="space-y-2 p-1">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Shift name (e.g. Morning)"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Clock In</label>
                    <input type="time" value={newIn} onChange={e => setNewIn(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Clock Out</label>
                    <input type="time" value={newOut} onChange={e => setNewOut(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Lunch Start</label>
                    <input type="time" value={newLunchStart} onChange={e => setNewLunchStart(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Lunch End</label>
                    <input type="time" value={newLunchEnd} onChange={e => setNewLunchEnd(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="hstack" style={{ gap: 8 }}>
                  <button type="button" onClick={handleCreate} className="btn primary" style={{ flex: 1 }}>
                    Create
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className="btn ghost" style={{ flex: 1 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type LookupData = {
  departments: string[];
  countries: string[];
  races: string[];
  ethnicities: string[];
  languages: string[];
  educationLevels: string[];
};

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [lookups, setLookups] = useState<LookupData>({
    departments: [], countries: [], races: [], ethnicities: [], languages: [], educationLevels: [],
  });
  const [shifts, setShifts] = useState<Shift[]>([]);

  const loadShifts = () => api.getAllShifts().then(setShifts).catch(() => {});

  useEffect(() => {
    if (employee) {
      setForm({ ...employee });
    }
    Promise.all([
      api.getDepartments(),
      api.getCountries(),
      api.getRaces(),
      api.getEthnicities(),
      api.getLanguages(),
      api.getEducationLevels(),
    ]).then(([departments, countries, races, ethnicities, languages, educationLevels]) => {
      setLookups({ departments, countries, races, ethnicities, languages, educationLevels });
    }).catch(() => {});
    loadShifts();
  }, [employee]);

  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value || null }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { created_at, updated_at, ...data } = form;
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {FIELD_GROUPS.map(group => (
        <div key={group.title}>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{group.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'shift-select' ? (
                  <ShiftSelect
                    value={form[field.key] ?? null}
                    shifts={shifts}
                    onChange={v => handleChange(field.key, v)}
                    onShiftsChanged={loadShifts}
                  />
                ) : field.type === 'select' ? (
                  <ComboSelect
                    value={form[field.key] || ''}
                    options={field.options || []}
                    onChange={v => handleChange(field.key, v)}
                    placeholder="--"
                  />
                ) : field.type === 'lookup' ? (
                  <ComboSelect
                    value={form[field.key] || ''}
                    options={(lookups as any)[field.lookupKey] || []}
                    onChange={v => handleChange(field.key, v)}
                    placeholder={`Select ${field.label}...`}
                    allowCustom
                  />
                ) : field.type === 'multi-lookup' ? (
                  <MultiSelect
                    value={form[field.key] || ''}
                    options={(lookups as any)[field.lookupKey] || []}
                    onChange={v => handleChange(field.key, v)}
                    placeholder={`Select ${field.label}...`}
                  />
                ) : field.type === 'date' ? (
                  <DatePicker
                    value={form[field.key] || ''}
                    onChange={v => handleChange(field.key, v)}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={form[field.key] ?? ''}
                    onChange={e => handleChange(field.key, field.type === 'number' ? Number(e.target.value) || null : e.target.value)}
                    required={field.required}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="hstack" style={{ gap: 12, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <button type="submit" className="btn primary">
          {employee ? 'Save Changes' : 'Create Employee'}
        </button>
        <button type="button" onClick={onCancel} className="btn ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
