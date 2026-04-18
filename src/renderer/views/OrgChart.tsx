import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Employee } from '../types/employee';

interface DeptNode {
  department: string;
  supervisors: Employee[];
  members: Employee[];
}

function initialsOf(name: string) {
  return name.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avClass(id: number) { return `av-${id % 8}`; }

export default function OrgChart() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DeptNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getAllEmployees({ status: 'active' }).then(employees => {
      const deptMap = new Map<string, { supervisors: Employee[]; members: Employee[] }>();
      for (const emp of employees) {
        const depts = emp.current_department
          ? emp.current_department.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
          : ['Unassigned'];
        for (const dept of depts) {
          if (!deptMap.has(dept)) deptMap.set(dept, { supervisors: [], members: [] });
          const group = deptMap.get(dept)!;
          if (emp.supervisory_role === 'Y') group.supervisors.push(emp);
          else group.members.push(emp);
        }
      }
      const sorted = Array.from(deptMap.entries())
        .map(([department, { supervisors, members }]) => ({ department, supervisors, members }))
        .sort((a, b) => a.department.localeCompare(b.department));
      setDepartments(sorted);
      setExpanded(new Set(sorted.map(d => d.department)));
      setLoading(false);
    });
  }, []);

  const toggleDept = (dept: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(departments.map(d => d.department)));
  const collapseAll = () => setExpanded(new Set());

  const totalEmployees = departments.reduce((sum, d) => sum + d.supervisors.length + d.members.length, 0);
  const totalSupervisors = departments.reduce((sum, d) => sum + d.supervisors.length, 0);

  if (loading) {
    return (
      <div className="page">
        <div className="muted small">Loading org chart…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Org chart</h1>
          <p className="page-subtitle">
            {totalEmployees} employees across {departments.length} departments · {totalSupervisors} supervisors
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button onClick={expandAll} className="btn">Expand all</button>
          <button onClick={collapseAll} className="btn">Collapse all</button>
        </div>
      </div>

      <div className="card" style={{ padding: 24, overflow: 'auto' }}>
        <div className="vstack" style={{ gap: 16 }}>
          {departments.map(dept => {
            const isOpen = expanded.has(dept.department);
            const count = dept.supervisors.length + dept.members.length;
            return (
              <div key={dept.department}>
                <div className="hstack" style={{ gap: 10, padding: '4px 0' }}>
                  <div className="org-node" style={{ cursor: 'pointer' }} onClick={() => toggleDept(dept.department)}>
                    <div className="avatar-sm av-sage" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {dept.department.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="meta">
                      <div className="name">{dept.department}</div>
                      <div className="title">
                        {count} employee{count !== 1 ? 's' : ''} · {dept.supervisors.length} supervisor{dept.supervisors.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {count > 0 && (
                      <button
                        className="org-expand"
                        onClick={(e) => { e.stopPropagation(); toggleDept(dept.department); }}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                        title={`${count} ${count === 1 ? 'person' : 'people'}`}
                      >
                        {isOpen ? '−' : count}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginLeft: 32, borderLeft: '1px solid var(--line)', paddingLeft: 20, marginTop: 6 }}>
                    <div className="vstack" style={{ gap: 6 }}>
                      {dept.supervisors.map(emp => (
                        <PersonNode key={emp.id} employee={emp} isSupervisor onClick={() => navigate(`/employees/${emp.id}`)} />
                      ))}
                      {dept.members.map(emp => (
                        <PersonNode key={emp.id} employee={emp} isSupervisor={false} onClick={() => navigate(`/employees/${emp.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PersonNode({ employee, isSupervisor, onClick }: { employee: Employee; isSupervisor: boolean; onClick: () => void }) {
  return (
    <div className="hstack" style={{ padding: '2px 0' }}>
      <div className="org-node" onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className={`avatar-sm ${avClass(employee.id)}`} style={{ width: 34, height: 34, fontSize: 11 }}>
          {initialsOf(employee.employee_name)}
        </div>
        <div className="meta">
          <div className="name">{employee.employee_name}</div>
          <div className="title">{employee.current_position || 'No position'}</div>
        </div>
        {isSupervisor && <span className="badge accent">Supervisor</span>}
      </div>
    </div>
  );
}
