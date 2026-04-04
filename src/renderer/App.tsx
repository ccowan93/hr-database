import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import EmployeeList from './views/EmployeeList';
import EmployeeDetail from './views/EmployeeDetail';
import AddEmployee from './views/AddEmployee';
import AuditLog from './views/AuditLog';
import Settings from './views/Settings';
import OrgChart from './views/OrgChart';
import ReportBuilder from './views/ReportBuilder';

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="titlebar-drag h-10 flex-shrink-0 bg-gray-50 dark:bg-gray-900" />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-6 pb-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
