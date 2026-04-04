import React, { useState, useEffect, useRef } from 'react';
import type { Employee } from '../types/employee';
import { api } from '../api';

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
      { key: 'current_department', label: 'Department', type: 'lookup', lookupKey: 'departments' },
      { key: 'current_position', label: 'Position', type: 'text' },
      { key: 'supervisory_role', label: 'Supervisory Role', type: 'select', options: ['Y', 'N'] },
      { key: 'doh', label: 'Date of Hire', type: 'date' },
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

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200';

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
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            {s}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(s); }}
              className="hover:text-blue-900 dark:hover:text-blue-100"
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
              }}
              placeholder="Search or type new..."
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

interface ComboSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function ComboSelect({ value, options, onChange, placeholder }: ComboSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setIsOpen(true)}
        className={`${inputClass} cursor-pointer flex items-center justify-between`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value || placeholder || 'Select...'}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or type new..."
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            <button
              type="button"
              onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              -- None --
            </button>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  opt === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {opt}
              </button>
            ))}
            {search.trim() && !options.includes(search.trim()) && (
              <button
                type="button"
                onClick={() => { onChange(search.trim()); setIsOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Add "{search.trim()}"
              </button>
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
                {field.type === 'select' ? (
                  <select
                    value={form[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">--</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'lookup' ? (
                  <ComboSelect
                    value={form[field.key] || ''}
                    options={(lookups as any)[field.lookupKey] || []}
                    onChange={v => handleChange(field.key, v)}
                    placeholder={`Select ${field.label}...`}
                  />
                ) : field.type === 'multi-lookup' ? (
                  <MultiSelect
                    value={form[field.key] || ''}
                    options={(lookups as any)[field.lookupKey] || []}
                    onChange={v => handleChange(field.key, v)}
                    placeholder={`Select ${field.label}...`}
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

      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {employee ? 'Save Changes' : 'Create Employee'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
