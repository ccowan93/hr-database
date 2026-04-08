import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { api } from './api';
import Dashboard from './views/Dashboard';
import EmployeeList from './views/EmployeeList';
import EmployeeDetail from './views/EmployeeDetail';
import AddEmployee from './views/AddEmployee';
import AuditLog from './views/AuditLog';
import Settings from './views/Settings';
import OrgChart from './views/OrgChart';
import ReportBuilder from './views/ReportBuilder';
import AttendanceCalendar from './views/AttendanceCalendar';
import TimeOffManager from './views/TimeOffManager';
import AttendanceReports from './views/AttendanceReports';
import FmlaManager from './views/FmlaManager';
import UpdateBanner from './components/UpdateBanner';

export default function App() {
  useEffect(() => {
    api.getAppVersion().then(v => { (window as any).__appVersion = v; });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UpdateBanner />
        <div className="titlebar-drag h-10 flex-shrink-0 bg-gray-50 dark:bg-gray-900" />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-6 pb-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/time-tracking" element={<Navigate to="/time-tracking/calendar" replace />} />
          <Route path="/time-tracking/calendar" element={<AttendanceCalendar />} />
          <Route path="/time-tracking/time-off" element={<TimeOffManager />} />
          <Route path="/time-tracking/reports" element={<AttendanceReports />} />
          <Route path="/time-tracking/fmla" element={<FmlaManager />} />
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route path="/employees/new" element={<AddEmployee />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/org-chart" element={<OrgChart />} />
          <Route path="/reports" element={<ReportBuilder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      </div>
    </div>
  );
}
