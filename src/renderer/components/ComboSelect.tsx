import React, { useState, useEffect, useRef } from 'react';

export interface ComboOption {
  value: string;
  label: string;
}

interface ComboSelectProps {
  value: string;
  options: (string | ComboOption)[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Allow user to type a value not in the options list. Default: false */
  allowCustom?: boolean;
  /** Show the search input at the top. Default: true */
  searchable?: boolean;
  /** Show the "-- None --" row at the top. Default: true */
  includeNone?: boolean;
  /** Label for the none row. Default: "-- None --" */
  noneLabel?: string;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Override the trigger className (default: "kin-field-trigger cursor-pointer"). */
  className?: string;
}

function normalize(opts: (string | ComboOption)[]): ComboOption[] {
  return opts.map(o => typeof o === 'string' ? { value: o, label: o } : o);
}

export default function ComboSelect({
  value,
  options,
  onChange,
  placeholder,
  allowCustom = false,
  searchable = true,
  includeNone = true,
  noneLabel = '-- None --',
  disabled = false,
  className,
}: ComboSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = normalize(options);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = normalized.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = normalized.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ width: '100%' }}
      // Prevent a wrapping <label className="field"> from firing a synthetic
      // click on the first labelable descendant (a <button> inside the popup),
      // which would immediately toggle the dropdown back closed.
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          if (!disabled) setIsOpen(o => !o);
        }}
        className={className || 'kin-field-trigger cursor-pointer'}
        style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        <span style={value ? undefined : { color: 'var(--ink-4)' }}>
          {displayLabel || placeholder || 'Select...'}
        </span>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="kin-dropdown-popup" style={{ maxHeight: 240, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {searchable && (
            <div className="kin-dropdown-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={allowCustom ? 'Search or type new...' : 'Search...'}
                className="kin-dropdown-search-input"
                autoFocus
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {includeNone && (
              <button
                type="button"
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {noneLabel}
              </button>
            )}
            {filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  opt.value === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {allowCustom && search.trim() && !normalized.some(o => o.label === search.trim() || o.value === search.trim()) && (
              <button
                type="button"
                onClick={() => { onChange(search.trim()); setIsOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Add "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !allowCustom && (
              <div className="px-3 py-2 text-sm text-gray-400">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
