import React from 'react';

interface TimeOffEntry {
  employee_name: string;
  employee_id: number;
  request_type: string;
  department: string | null;
}

interface DayData {
  present: boolean;
  punch_in?: string | null;
  punch_out?: string | null;
  reg_hours: number;
  ot_hours: number;
  missing_punch: boolean;
  has_time_off: boolean;
  time_off_type?: string | null;
  time_off_entries: TimeOffEntry[];
  records: any[];
  flags?: string[];
}

interface CalendarGridProps {
  year: number;
  month: number;
  dayDataMap: Map<string, DayData>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  showFlags?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FLAG_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  tardy: { label: 'Tardy', color: 'var(--warn)', icon: 'T' },
  absent: { label: 'Absent', color: 'var(--danger)', icon: 'A' },
  left_early: { label: 'Left Early', color: 'oklch(0.65 0.15 55)', icon: 'E' },
  long_lunch: { label: 'Long Lunch', color: 'oklch(0.6 0.15 310)', icon: 'L' },
  partial_absence: { label: 'Partial', color: 'oklch(0.65 0.15 0)', icon: 'P' },
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarGrid({ year, month, dayDataMap, selectedDate, onSelectDate, showFlags }: CalendarGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const cellBgFor = (
    data: DayData | undefined,
    flags: string[],
  ): string | undefined => {
    if (!data && !flags.includes('absent')) return undefined;
    if (data?.has_time_off) return 'color-mix(in oklch, var(--info) 10%, transparent)';
    if (flags.includes('absent')) return 'color-mix(in oklch, var(--danger) 10%, transparent)';
    if (data?.missing_punch) return 'color-mix(in oklch, var(--warn) 12%, transparent)';
    if (data?.present) return 'color-mix(in oklch, var(--accent) 10%, transparent)';
    return undefined;
  };

  const dotColorFor = (data: DayData | undefined, flags: string[]): string | undefined => {
    if (!data && !flags.includes('absent')) return undefined;
    if (data?.has_time_off) return 'var(--info)';
    if (flags.includes('absent')) return 'var(--danger)';
    if (data?.missing_punch) return 'var(--warn)';
    if (data?.present) return 'var(--accent)';
    return undefined;
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklch, var(--accent) 28%, var(--line))',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxShadow: '0 0 0 3px color-mix(in oklch, var(--accent) 8%, transparent)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {WEEKDAYS.map(day => (
          <div
            key={day}
            style={{
              padding: '10px 8px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--accent-ink)',
              background: 'var(--accent-soft)',
              borderBottom: '1px solid color-mix(in oklch, var(--accent) 22%, var(--line))',
            }}
          >
            {day}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                style={{
                  height: 96,
                  borderBottom: '1px solid var(--line)',
                  borderRight: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  opacity: 0.5,
                }}
              />
            );
          }

          const dateKey = formatDateKey(year, month, day);
          const data = dayDataMap.get(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;
          const flags = data?.flags || [];

          const cellBg = cellBgFor(data, flags);
          const dot = dotColorFor(data, flags);

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              style={{
                height: 96,
                padding: 6,
                borderBottom: '1px solid var(--line)',
                borderRight: '1px solid var(--line)',
                cursor: 'pointer',
                transition: 'background 120ms',
                background: cellBg,
                boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : undefined,
              }}
              onMouseEnter={(e) => {
                if (!cellBg) e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = cellBg || '';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isToday ? '#fff' : isWeekend ? 'var(--ink-4)' : 'var(--ink-2)',
                    background: isToday ? 'var(--accent)' : undefined,
                    width: isToday ? 22 : undefined,
                    height: isToday ? 22 : undefined,
                    borderRadius: isToday ? '50%' : undefined,
                    display: isToday ? 'flex' : undefined,
                    alignItems: isToday ? 'center' : undefined,
                    justifyContent: isToday ? 'center' : undefined,
                  }}
                >
                  {day}
                </span>
                {dot && (
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: dot }} />
                )}
              </div>

              {showFlags && flags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                  {flags.filter(f => f !== 'absent').map(flag => {
                    const cfg = FLAG_CONFIG[flag];
                    if (!cfg) return null;
                    return (
                      <span
                        key={flag}
                        title={cfg.label}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '0 4px',
                          borderRadius: 3,
                          color: cfg.color,
                          background: 'color-mix(in oklch, var(--surface) 70%, transparent)',
                        }}
                      >
                        {cfg.icon}
                      </span>
                    );
                  })}
                </div>
              )}

              {data && (
                <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {data.punch_in && (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      In: {data.punch_in}
                    </div>
                  )}
                  {data.punch_out && (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Out: {data.punch_out}
                    </div>
                  )}
                  {(data.reg_hours > 0 || data.ot_hours > 0) && (
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-2)' }}>
                      {data.reg_hours > 0 && `${data.reg_hours.toFixed(1)}h`}
                      {data.ot_hours > 0 && <span style={{ color: 'var(--warn)', marginLeft: 4 }}>+{data.ot_hours.toFixed(1)} OT</span>}
                    </div>
                  )}
                  {data.has_time_off && data.time_off_entries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {data.time_off_entries.slice(0, 2).map((entry, i) => (
                        <div key={i} style={{ fontSize: 10, fontWeight: 500, color: 'var(--info)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.employee_name.split(' ')[0]}: {entry.request_type.charAt(0).toUpperCase() + entry.request_type.slice(1).replace('_', ' ')}
                        </div>
                      ))}
                      {data.time_off_entries.length > 2 && (
                        <div style={{ fontSize: 10, color: 'var(--info)', opacity: 0.8 }}>
                          +{data.time_off_entries.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
