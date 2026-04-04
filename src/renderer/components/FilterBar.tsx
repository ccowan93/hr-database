import React, { useState } from 'react';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  department: string;
  onDepartmentChange: (value: string) => void;
  departments: string[];
  supervisoryRole: string;
  onSupervisoryRoleChange: (value: string) => void;
  dohFrom: string;
  onDohFromChange: (value: string) => void;
  dohTo: string;
  onDohToChange: (value: string) => void;
  payMin: string;
  onPayMinChange: (value: string) => void;
  payMax: string;
  onPayMaxChange: (value: string) => void;
  ageMin: string;
  onAgeMinChange: (value: string) => void;
  ageMax: string;
  onAgeMaxChange: (value: string) => void;
  countryOfOrigin: string;
  onCountryOfOriginChange: (value: string) => void;
  countries: string[];
  onClearFilters: () => void;
}

export default function FilterBar({
  search, onSearchChange,
  department, onDepartmentChange, departments,
  supervisoryRole, onSupervisoryRoleChange,
  dohFrom, onDohFromChange, dohTo, onDohToChange,
  payMin, onPayMinChange, payMax, onPayMaxChange,
  ageMin, onAgeMinChange, ageMax, onAgeMaxChange,
  countryOfOrigin, onCountryOfOriginChange, countries,
  onClearFilters,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedFilters = dohFrom || dohTo || payMin || payMax || ageMin || ageMax || countryOfOrigin;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search by name or position..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="flex-1 min-w-[250px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-200"
        />
        <select
          value={department}
          onChange={e => onDepartmentChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={supervisoryRole}
          onChange={e => onSupervisoryRoleChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">All Roles</option>
          <option value="Y">Supervisory</option>
          <option value="N">Non-Supervisory</option>
        </select>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
            showAdvanced || hasAdvancedFilters
              ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-500'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {showAdvanced ? 'Hide Filters' : 'Advanced Filters'}
          {hasAdvancedFilters && !showAdvanced ? ' *' : ''}
        </button>
        {(search || department || supervisoryRole || hasAdvancedFilters) && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Country of Origin</label>
              <select
                value={countryOfOrigin}
                onChange={e => onCountryOfOriginChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Hire Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dohFrom}
                  onChange={e => onDohFromChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                />
                <span className="text-gray-400 dark:text-gray-500 text-xs">to</span>
                <input
                  type="date"
                  value={dohTo}
                  onChange={e => onDohToChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Pay Rate Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={payMin}
                  onChange={e => onPayMinChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  step="0.01"
                />
                <span className="text-gray-400 dark:text-gray-500 text-xs">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={payMax}
                  onChange={e => onPayMaxChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Age Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={ageMin}
                  onChange={e => onAgeMinChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                />
                <span className="text-gray-400 dark:text-gray-500 text-xs">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={ageMax}
                  onChange={e => onAgeMaxChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
