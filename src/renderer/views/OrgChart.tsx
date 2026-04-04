import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Employee } from '../types/employee';

interface DeptNode {
  department: string;
  supervisors: Employee[];
  members: Employee[];
}

export default function OrgChart() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DeptNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'tree' | 'grid'>('tree');

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then(employees => {
      const deptMap = new Map<string, { supervisors: Employee[]; members: Employee[] }>();
      for (const emp of employees) {
        const dept = emp.current_department || 'Unassigned';
        if (!deptMap.has(dept)) deptMap.set(dept, { supervisors: [], members: [] });
        const group = deptMap.get(dept)!;
        if (emp.supervisory_role === 'Y') group.supervisors.push(emp);
        else group.members.push(emp);
      }
      const sorted = Array.from(deptMap.entries())
        .map(([department, { supervisors, members }]) => ({ department, supervisors, members }))
        .sort((a, b) => a.department.localeCompare(b.department));
      setDepartments(sorted);
      // Expand all departments by default
      setExpandedDepts(new Set(sorted.map(d => d.department)));
      setLoading(false);
    });
  }, []);

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const expandAll = () => setExpandedDepts(new Set(departments.map(d => d.department)));
  const collapseAll = () => setExpandedDepts(new Set());

  const totalEmployees = departments.reduce((sum, d) => sum + d.supervisors.length + d.members.length, 0);
  const totalSupervisors = departments.reduce((sum, d) => sum + d.supervisors.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Org Chart</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalEmployees} employees across {departments.length} departments &middot; {totalSupervisors} supervisors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Collapse All
          </button>
          <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('tree')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'tree'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {view === 'tree' ? (
        <div className="space-y-3">
          {departments.map(dept => {
            const isExpanded = expandedDepts.has(dept.department);
            const count = dept.supervisors.length + dept.members.length;
            return (
              <div key={dept.department} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleDept(dept.department)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{dept.department}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {count} employee{count !== 1 ? 's' : ''} &middot; {dept.supervisors.length} supervisor{dept.supervisors.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700">
                    {/* Supervisors */}
                    {dept.supervisors.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Supervisors</p>
                        <div className="space-y-1">
                          {dept.supervisors.map(emp => (
                            <PersonRow key={emp.id} employee={emp} isSupervisor onClick={() => navigate(`/employees/${emp.id}`)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tree lines connecting supervisors to members */}
                    {dept.supervisors.length > 0 && dept.members.length > 0 && (
                      <div className="flex items-center gap-2 my-3 ml-5">
                        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>
                    )}

                    {/* Regular Members */}
                    {dept.members.length > 0 && (
                      <div className={dept.supervisors.length > 0 ? '' : 'mt-4'}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Team Members</p>
                        <div className="space-y-1">
                          {dept.members.map(emp => (
                            <PersonRow key={emp.id} employee={emp} isSupervisor={false} onClick={() => navigate(`/employees/${emp.id}`)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map(dept => {
            const count = dept.supervisors.length + dept.members.length;
            return (
              <div key={dept.department} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{dept.department}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{count} employee{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {dept.supervisors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">Supervisors</p>
                    {dept.supervisors.map(emp => (
                      <PersonChip key={emp.id} employee={emp} isSupervisor onClick={() => navigate(`/employees/${emp.id}`)} />
                    ))}
                  </div>
                )}

                {dept.members.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Members</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.members.map(emp => (
                        <PersonChip key={emp.id} employee={emp} isSupervisor={false} onClick={() => navigate(`/employees/${emp.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PersonRow({ employee, isSupervisor, onClick }: { employee: Employee; isSupervisor: boolean; onClick: () => void }) {
  const initials = employee.employee_name
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        isSupervisor
          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-300 dark:ring-amber-600'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
      }`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{employee.employee_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{employee.current_position || 'No position'}</p>
      </div>
      {isSupervisor && (
        <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
          Supervisor
        </span>
      )}
    </button>
  );
}

function PersonChip({ employee, isSupervisor, onClick }: { employee: Employee; isSupervisor: boolean; onClick: () => void }) {
  const initials = employee.employee_name
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1.5 ${
        isSupervisor
          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-700'
          : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
      }`}
    >
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
        isSupervisor
          ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
      }`}>
        {initials}
      </span>
      {employee.employee_name}
    </button>
  );
}
