import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Clock, CalendarDays, CalendarOff, BarChart3, Users, UserPlus, Network, ClipboardList, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { api } from '../api';

const COLLAPSED_KEY = 'hr-sidebar-collapsed';

/** Animated height expand/collapse using max-height + opacity */
function ExpandablePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(open ? 500 : 0);

  useEffect(() => {
    if (open) {
      // Measure actual content height for precise animation
      const el = ref.current;
      if (el) {
        setMaxHeight(el.scrollHeight);
        // After transition, set to auto so dynamic content works
        const timer = setTimeout(() => setMaxHeight(500), 300);
        return () => clearTimeout(timer);
      }
    } else {
      setMaxHeight(0);
    }
  }, [open]);

  return (
    <div
      ref={ref}
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: `${maxHeight}px`, opacity: open ? 1 : 0 }}
    >
      <div className="ml-4 mt-1 space-y-1">
        {children}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const isTimeTrackingActive = location.pathname.startsWith('/time-tracking');
  const isEmployeesActive = location.pathname.startsWith('/employees') || location.pathname === '/org-chart' || location.pathname === '/reports';
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(isTimeTrackingActive);
  const [employeesOpen, setEmployeesOpen] = useState(isEmployeesActive);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isTimeTrackingActive) setTimeTrackingOpen(true);
  }, [isTimeTrackingActive]);

  useEffect(() => {
    if (isEmployeesActive) setEmployeesOpen(true);
  }, [isEmployeesActive]);

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

  // Chevron icon for expandable groups
  const Chevron = ({ open }: { open: boolean }) => (
    <svg
      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );

  // Shared class builder for nav links
  const navClass = (isActive: boolean, sub = false) =>
    `flex items-center gap-3 px-4 ${sub ? 'py-2' : 'py-3'} rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-blue-600 text-white'
        : sub
          ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const groupClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden`}>
      {/* Header */}
      <div className="titlebar-drag pt-10 px-4 pb-4 border-b border-slate-700">
        <div className={`transition-all duration-300 ease-in-out ${collapsed ? 'flex justify-center' : 'px-2'}`}>
          <div className="titlebar-no-drag">
            {collapsed ? (
              <span className="text-lg font-bold">HR</span>
            ) : (
              <>
                <h1 className="text-xl font-bold whitespace-nowrap">HR Database</h1>
                <p className="text-slate-400 text-sm mt-1 whitespace-nowrap">{employeeCount} employees</p>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto`}>
        {/* Dashboard */}
        <NavLink
          to="/"
          end
          title="Dashboard"
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              : navClass(isActive)
          }
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Dashboard'}
        </NavLink>

        {/* Employees expandable group */}
        <div>
          {collapsed ? (
            <NavLink
              to="/employees"
              title="Employees"
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-lg transition-colors ${isActive || isEmployeesActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Users className="w-5 h-5 flex-shrink-0" />
            </NavLink>
          ) : (
            <>
              <button onClick={() => setEmployeesOpen(!employeesOpen)} className={groupClass(isEmployeesActive)}>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  Employees
                </div>
                <Chevron open={employeesOpen} />
              </button>
              <ExpandablePanel open={employeesOpen}>
                <NavLink to="/employees" end className={({ isActive }) => navClass(isActive, true)}>
                  <Users className="w-4 h-4" />
                  Employee List
                </NavLink>
                <NavLink to="/employees/new" className={({ isActive }) => navClass(isActive, true)}>
                  <UserPlus className="w-4 h-4" />
                  Add Employee
                </NavLink>
                <NavLink to="/org-chart" className={({ isActive }) => navClass(isActive, true)}>
                  <Network className="w-4 h-4" />
                  Org Chart
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => navClass(isActive, true)}>
                  <FileText className="w-4 h-4" />
                  Reports
                </NavLink>
              </ExpandablePanel>
            </>
          )}
        </div>

        {/* Time Tracking expandable group */}
        <div>
          {collapsed ? (
            <NavLink
              to="/time-tracking/calendar"
              title="Time Tracking"
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-lg transition-colors ${isActive || isTimeTrackingActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
            </NavLink>
          ) : (
            <>
              <button onClick={() => setTimeTrackingOpen(!timeTrackingOpen)} className={groupClass(isTimeTrackingActive)}>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" />
                  Time Tracking
                </div>
                <Chevron open={timeTrackingOpen} />
              </button>
              <ExpandablePanel open={timeTrackingOpen}>
                <NavLink to="/time-tracking/calendar" className={({ isActive }) => navClass(isActive, true)}>
                  <CalendarDays className="w-4 h-4" />
                  Calendar
                </NavLink>
                <NavLink to="/time-tracking/time-off" className={({ isActive }) => navClass(isActive, true)}>
                  <CalendarOff className="w-4 h-4" />
                  Time Off
                </NavLink>
                <NavLink to="/time-tracking/reports" className={({ isActive }) => navClass(isActive, true)}>
                  <BarChart3 className="w-4 h-4" />
                  Reports
                </NavLink>
              </ExpandablePanel>
            </>
          )}
        </div>

        {/* Audit Log */}
        <NavLink
          to="/audit-log"
          title="Audit Log"
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              : navClass(isActive)
          }
        >
          <ClipboardList className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Audit Log'}
        </NavLink>
      </nav>

      {/* Footer */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-slate-700 space-y-2 transition-all duration-300`}>
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out space-y-2"
          style={{ maxHeight: collapsed ? 0 : 100, opacity: collapsed ? 0 : 1 }}
        >
          <button
            onClick={handleImport}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors whitespace-nowrap"
          >
            Import from Excel
          </button>
          <button
            onClick={handleUpdateImport}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors whitespace-nowrap"
          >
            Update from Excel
          </button>
        </div>
        <NavLink
          to="/settings"
          title="Settings"
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center p-3 rounded-lg transition-colors ${isActive ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`
              : `flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
                }`
          }
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          {!collapsed && 'Settings'}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`${collapsed ? '' : 'w-full'} flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors`}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
