import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  KinHome, KinCalendar, KinUsers, KinTree, KinDoc, KinSettings,
} from './KinIcons';
import {
  BarChart3, ClipboardList, ShieldCheck, ShieldAlert, Heart,
} from 'lucide-react';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import iconUrl from '../../../assets/icon.png';

interface NavItem {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count?: number;
  end?: boolean;
}
interface NavGroup {
  section: string | null;
  items: NavItem[];
}

export default function Sidebar() {
  const location = useLocation();
  const { sidebar } = useTheme();
  const collapsed = sidebar === 'icons';
  const [employeeCount, setEmployeeCount] = useState<number>(0);

  useEffect(() => {
    api.getEmployeeCount().then(setEmployeeCount).catch(() => {});
  }, [location]);

  const groups: NavGroup[] = [
    {
      section: null,
      items: [
        { to: '/', label: 'Dashboard', Icon: KinHome, end: true },
        { to: '/employees', label: 'People', Icon: KinUsers, count: employeeCount || undefined, end: true },
        { to: '/org-chart', label: 'Org chart', Icon: KinTree },
      ],
    },
    {
      section: 'Workflows',
      items: [
        { to: '/time-tracking/calendar', label: 'Calendar', Icon: KinCalendar },
        { to: '/time-tracking/time-off', label: 'Time off', Icon: KinCalendar },
        { to: '/time-tracking/fmla', label: 'FMLA', Icon: ShieldCheck },
        { to: '/time-tracking/reports', label: 'Attendance reports', Icon: BarChart3 },
      ],
    },
    {
      section: 'People ops',
      items: [
        { to: '/disciplinary', label: 'Disciplinary', Icon: ShieldAlert },
        { to: '/benefits', label: 'Benefits', Icon: Heart },
        { to: '/reports', label: 'Reports', Icon: KinDoc },
        { to: '/audit-log', label: 'Audit log', Icon: ClipboardList },
      ],
    },
  ];

  return (
    <aside className="sidebar titlebar-drag">
      <div className="brand titlebar-no-drag">
        <img src={iconUrl} alt="HR DB" className="brand-mark-img" />
        <div className="brand-name">HR DB</div>
      </div>

      <div className="titlebar-no-drag" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {groups.map((group, gi) => (
          <div key={gi} className="nav-section">
            {group.section && !collapsed && (
              <div className="nav-section-label">{group.section}</div>
            )}
            {group.items.map(item => {
              const Icon = item.Icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.count != null && <span className="count">{item.count}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 12, paddingBottom: 12 }}>
          <NavLink to="/settings" title="Settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <KinSettings className="nav-icon" />
            <span className="nav-label">Settings</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
