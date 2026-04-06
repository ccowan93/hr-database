import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api';
import GlobalSearch from './GlobalSearch';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
];

const timeTrackingSubItems = [
  { path: '/time-tracking/calendar', label: 'Calendar', icon: '📅' },
  { path: '/time-tracking/time-off', label: 'Time Off', icon: '✋' },
  { path: '/time-tracking/reports', label: 'Reports', icon: '📈' },
];

const navItemsAfter = [
  { path: '/employees', label: 'Employees', icon: '👥' },
  { path: '/employees/new', label: 'Add Employee', icon: '➕' },
  { path: '/audit-log', label: 'Audit Log', icon: '📋' },
  { path: '/org-chart', label: 'Org Chart', icon: '🏢' },
  { path: '/reports', label: 'Reports', icon: '📄' },
];

export default function Sidebar() {
  const location = useLocation();
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const isTimeTrackingActive = location.pathname.startsWith('/time-tracking');
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(isTimeTrackingActive);

  useEffect(() => {
    if (isTimeTrackingActive) setTimeTrackingOpen(true);
  }, [isTimeTrackingActive]);

  useEffect(() => {
    api.getEmployeeCount().then(setEmployeeCount).catch(() => {});
  }, [location]);

  const handleImport = async () => {
    const result = await api.importXlsx();
    if (result.imported > 0) {
      alert(`Imported ${result.imported} employees. ${result.skipped} rows skipped.${result.errors.length > 0 ? '\nErrors: ' + result.errors.join(', ') : ''}`);
      setEmployeeCount(await api.getEmployeeCount());
    } else if (result.errors.length > 0 && result.errors[0] !== 'Import cancelled') {
      alert('Import failed: ' + result.errors.join(', '));
    }
  };

  const handleUpdateImport = async () => {
    const result = await api.importUpdateXlsx();
    if (result.updated > 0 || result.notFound.length > 0) {
      let msg = `Updated ${result.updated} employee(s).`;
      if (result.skipped > 0) msg += `\n${result.skipped} rows skipped.`;
      if (result.notFound.length > 0) msg += `\nNot found: ${result.notFound.join(', ')}`;
      if (result.errors.length > 0) msg += `\nErrors: ${result.errors.join(', ')}`;
      alert(msg);
    } else if (result.errors.length > 0 && result.errors[0] !== 'Import cancelled') {
      alert('Update import failed: ' + result.errors.join(', '));
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">
      <div className="titlebar-drag pt-10 px-6 pb-4 border-b border-slate-700">
        <h1 className="text-xl font-bold titlebar-no-drag">HR Database</h1>
        <p className="text-slate-400 text-sm mt-1">{employeeCount} employees</p>
      </div>

      <div className="px-4 pt-4 pb-2">
        <GlobalSearch />
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* Time Tracking expandable group */}
        <div>
          <button
            onClick={() => setTimeTrackingOpen(!timeTrackingOpen)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              isTimeTrackingActive
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span>🕐</span>
              Time Tracking
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${timeTrackingOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {timeTrackingOpen && (
            <div className="ml-4 mt-1 space-y-1">
              {timeTrackingSubItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {navItemsAfter.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-2">
        <button
          onClick={handleImport}
          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
        >
          Import from Excel
        </button>
        <button
          onClick={handleUpdateImport}
          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
        >
          Update from Excel
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-slate-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
            }`
          }
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
