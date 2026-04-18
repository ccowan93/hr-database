import React from 'react';
import { useLocation } from 'react-router-dom';
import { KinBell, KinSparkle, KinSearch } from './KinIcons';

const CRUMBS: { match: RegExp; label: string }[] = [
  { match: /^\/$/, label: 'Dashboard' },
  { match: /^\/employees\/new/, label: 'Add employee' },
  { match: /^\/employees\/[^/]+/, label: 'Employee profile' },
  { match: /^\/employees/, label: 'People' },
  { match: /^\/org-chart/, label: 'Org chart' },
  { match: /^\/time-tracking\/calendar/, label: 'Calendar' },
  { match: /^\/time-tracking\/time-off/, label: 'Time off' },
  { match: /^\/time-tracking\/fmla/, label: 'FMLA' },
  { match: /^\/time-tracking\/reports/, label: 'Attendance reports' },
  { match: /^\/disciplinary/, label: 'Disciplinary' },
  { match: /^\/benefits/, label: 'Benefits' },
  { match: /^\/reports/, label: 'Reports' },
  { match: /^\/audit-log/, label: 'Audit log' },
  { match: /^\/settings/, label: 'Settings' },
];

function crumbFor(pathname: string): string {
  const hit = CRUMBS.find(c => c.match.test(pathname));
  return hit?.label ?? 'Dashboard';
}

export default function Topbar({ onOpenTweaks }: { onOpenTweaks: () => void }) {
  const location = useLocation();
  const label = crumbFor(location.pathname);

  return (
    <div className="topbar titlebar-drag">
      <div className="crumb titlebar-no-drag">
        <span>HR DB</span>
        <span>/</span>
        <b>{label}</b>
      </div>

      <div className="topbar-actions titlebar-no-drag">
        <div className="input" style={{ width: 280 }}>
          <KinSearch />
          <input placeholder="Search people, documents…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="icon-btn" title="Notifications">
          <KinBell />
          <span className="dot" />
        </button>
        <button className="icon-btn" onClick={onOpenTweaks} title="Tweaks">
          <KinSparkle />
        </button>
      </div>
    </div>
  );
}
