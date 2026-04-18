import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface SearchResult {
  id: number;
  employee_name: string;
  current_department: string | null;
  current_position: string | null;
  photo_path: string | null;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [photoCache, setPhotoCache] = useState<Record<number, string | null>>({});

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const data = await api.searchEmployees(q, 8);
    setResults(data);
    setIsOpen(data.length > 0);
    setSelectedIndex(-1);

    // Load photos for results
    for (const r of data) {
      if (!(r.id in photoCache)) {
        api.getEmployeePhoto(r.id).then(photo => {
          setPhotoCache(prev => ({ ...prev, [r.id]: photo }));
        }).catch(() => {});
      }
    }
  }, [photoCache]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const selectResult = (result: SearchResult) => {
    navigate(`/employees/${result.id}`);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search... (⌘K)"
          className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 overflow-hidden z-50 max-h-96 overflow-y-auto"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {results.map((result, i) => (
            <button
              key={result.id}
              onClick={() => selectResult(result)}
              onMouseEnter={() => setSelectedIndex(i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{
                background: i === selectedIndex ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              {photoCache[result.id] ? (
                <img src={photoCache[result.id]!} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {getInitials(result.employee_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{result.employee_name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
                  {result.current_position}{result.current_department ? ` — ${result.current_department}` : ''}
                </p>
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-4)' }}>#{result.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
