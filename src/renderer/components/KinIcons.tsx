import React from 'react';

/**
 * Kin HRIS icon set — original, lucide-style line icons.
 * Taken verbatim from the Kin design handoff bundle (hris/project/src/icons.jsx).
 * All icons are 24×24 viewBox, stroked with currentColor, 1.7 stroke-width by default.
 */

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

const Base: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 16,
  strokeWidth = 1.7,
  children,
  ...rest
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const KinHome: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M3 11.5L12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
  </Base>
);

export const KinUsers: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15 14.5c3 0 5 1.5 5.5 4.5" />
  </Base>
);

export const KinUser: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-4 3.5-6 7-6s6.2 2 7 6" />
  </Base>
);

export const KinTree: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="15" width="6" height="5" rx="1" />
    <rect x="15" y="15" width="6" height="5" rx="1" />
    <path d="M12 8v3M6 15v-1a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Base>
);

export const KinCalendar: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);

export const KinDoc: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 16h6" />
  </Base>
);

export const KinBriefcase: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </Base>
);

export const KinDollar: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M12 3v18M16 7c-1-1.5-2.5-2-4-2-2.5 0-4 1.5-4 3s1.5 2.5 4 3 4 1.5 4 3-1.5 3-4 3c-1.5 0-3-.5-4-2" />
  </Base>
);

export const KinSearch: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4" />
  </Base>
);

export const KinBell: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

export const KinPlus: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const KinChev: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M8 10l4 4 4-4" />
  </Base>
);

export const KinChevR: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M10 8l4 4-4 4" />
  </Base>
);

export const KinArrow: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const KinUp: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M6 14l6-6 6 6" />
  </Base>
);

export const KinDown: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M6 10l6 6 6-6" />
  </Base>
);

export const KinCheck: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);

export const KinX: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const KinFilter: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M4 5h16l-6 8v5l-4 2v-7z" />
  </Base>
);

export const KinGrid: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </Base>
);

export const KinList: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </Base>
);

export const KinSlider: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Base>
);

export const KinSun: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.5 4.5l1.5 1.5M18 18l1.5 1.5M4.5 19.5L6 18M18 6l1.5-1.5" />
  </Base>
);

export const KinMoon: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z" />
  </Base>
);

export const KinPin: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M12 22s-6-6-6-12a6 6 0 1 1 12 0c0 6-6 12-6 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);

export const KinMail: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Base>
);

export const KinPhone: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Base>
);

export const KinClock: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </Base>
);

export const KinSparkle: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2.5 2.5M14.5 14.5L17 17M7 17l2.5-2.5M14.5 9.5L17 7" />
  </Base>
);

export const KinEdit: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Base>
);

export const KinMore: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="6" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18" cy="12" r="1" />
  </Base>
);

export const KinSettings: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Base>
);

export const KinDownload: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </Base>
);

export const KinLink: React.FC<IconProps> = (p) => (
  <Base {...p}>
    <path d="M10 14a4 4 0 0 0 5.5.5l3-3A4 4 0 0 0 13 6l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.5-.5l-3 3A4 4 0 0 0 11 18l1-1" />
  </Base>
);
