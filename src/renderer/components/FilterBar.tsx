import React, { useState } from 'react';
import ComboSelect from './ComboSelect';

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
  const hasAnyFilter = search || department || supervisoryRole || hasAdvancedFilters;

  return (
    <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="grid-3">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              type="text"
              className="input"
              placeholder="Name or position…"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Department</span>
            <ComboSelect
              value={department}
              options={departments}
              onChange={onDepartmentChange}
              includeNone={true}
              noneLabel="All departments"
            />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <ComboSelect
              value={supervisoryRole}
              options={[
                { value: 'Y', label: 'Supervisory' },
                { value: 'N', label: 'Non-supervisory' },
              ]}
              onChange={onSupervisoryRoleChange}
              includeNone={true}
              noneLabel="All roles"
              searchable={false}
            />
          </label>
        </div>
        <div className="hstack" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`btn${showAdvanced || hasAdvancedFilters ? ' accent' : ''}`}
          >
            {showAdvanced ? 'Hide filters' : 'Advanced filters'}
            {hasAdvancedFilters && !showAdvanced ? ' *' : ''}
          </button>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={onClearFilters}
              className="btn ghost"
              style={{ color: 'var(--danger)' }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="card" style={{ padding: 14 }}>
          <div className="grid-2" style={{ gap: 14 }}>
            <label className="field">
              <span className="field-label">Country of origin</span>
              <ComboSelect
                value={countryOfOrigin}
                options={countries}
                onChange={onCountryOfOriginChange}
                includeNone={true}
                noneLabel="All countries"
              />
            </label>

            <div className="field">
              <span className="field-label">Hire date range</span>
              <div className="hstack" style={{ gap: 8 }}>
                <input
                  type="date"
                  className="input"
                  value={dohFrom}
                  onChange={e => onDohFromChange(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span className="small muted">to</span>
                <input
                  type="date"
                  className="input"
                  value={dohTo}
                  onChange={e => onDohToChange(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="field">
              <span className="field-label">Pay rate range</span>
              <div className="hstack" style={{ gap: 8 }}>
                <input
                  type="number"
                  placeholder="Min"
                  className="input"
                  value={payMin}
                  onChange={e => onPayMinChange(e.target.value)}
                  min="0"
                  step="0.01"
                  style={{ flex: 1 }}
                />
                <span className="small muted">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="input"
                  value={payMax}
                  onChange={e => onPayMaxChange(e.target.value)}
                  min="0"
                  step="0.01"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="field">
              <span className="field-label">Age range</span>
              <div className="hstack" style={{ gap: 8 }}>
                <input
                  type="number"
                  placeholder="Min"
                  className="input"
                  value={ageMin}
                  onChange={e => onAgeMinChange(e.target.value)}
                  min="0"
                  style={{ flex: 1 }}
                />
                <span className="small muted">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="input"
                  value={ageMax}
                  onChange={e => onAgeMaxChange(e.target.value)}
                  min="0"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
