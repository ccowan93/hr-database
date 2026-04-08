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
  flags?: string[]; // attendance flags: 'tardy', 'absent', 'left_early', 'long_lunch', 'partial_absence'
}

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  dayDataMap: Map<string, DayData>; // key: "YYYY-MM-DD"
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  showFlags?: boolean; // Whether to show attendance flag indicators
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FLAG_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  tardy: { label: 'Tardy', color: 'text-amber-600 dark:text-amber-400', icon: 'T' },
  absent: { label: 'Absent', color: 'text-red-600 dark:text-red-400', icon: 'A' },
  left_early: { label: 'Left Early', color: 'text-orange-600 dark:text-orange-400', icon: 'E' },
  long_lunch: { label: 'Long Lunch', color: 'text-purple-600 dark:text-purple-400', icon: 'L' },
  partial_absence: { label: 'Partial', color: 'text-pink-600 dark:text-pink-400', icon: 'P' },
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map(day => (
          <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {day}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-24 border-b border-r border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20" />;
          }

          const dateKey = formatDateKey(year, month, day);
          const data = dayDataMap.get(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;
          const flags = data?.flags || [];

          let statusColor = '';
          let statusDot = '';
          if (data) {
            if (data.has_time_off) {
              statusColor = 'bg-blue-50 dark:bg-blue-900/20';
              statusDot = 'bg-blue-500';
            } else if (flags.includes('absent')) {
              statusColor = 'bg-red-50 dark:bg-red-900/20';
              statusDot = 'bg-red-500';
            } else if (data.missing_punch) {
              statusColor = 'bg-yellow-50 dark:bg-yellow-900/20';
              statusDot = 'bg-yellow-500';
            } else if (data.present) {
              statusColor = 'bg-green-50 dark:bg-green-900/20';
              statusDot = 'bg-emerald-500';
            }
          } else if (showFlags && flags.length === 0 && !isWeekend) {
            // No data and no flags for a weekday
            statusColor = '';
            statusDot = '';
          }

          // For absent-only flag days with no attendance data
          if (!data && flags.includes('absent')) {
            statusColor = 'bg-red-50 dark:bg-red-900/20';
            statusDot = 'bg-red-500';
          }

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className={`h-24 p-1.5 border-b border-r border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors
                ${statusColor}
                ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                ${!statusColor && !isWeekend ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'hover:opacity-80'}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium
                  ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}
                  ${isWeekend && !isToday ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}
                `}>
                  {day}
                </span>
                <div className="flex items-center gap-0.5">
                  {statusDot && <span className={`w-2 h-2 rounded-full ${statusDot}`} />}
                </div>
              </div>
              {/* Attendance flags */}
              {showFlags && flags.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {flags.filter(f => f !== 'absent').map(flag => {
                    const cfg = FLAG_CONFIG[flag];
                    if (!cfg) return null;
                    return (
                      <span
                        key={flag}
                        title={cfg.label}
                        className={`text-[9px] font-bold px-1 rounded ${cfg.color} bg-white/60 dark:bg-gray-900/40`}
                      >
                        {cfg.icon}
                      </span>
                    );
                  })}
                </div>
              )}
              {data && (
                <div className="mt-0.5 space-y-0.5">
                  {data.punch_in && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      In: {data.punch_in}
                    </div>
                  )}
                  {data.punch_out && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      Out: {data.punch_out}
                    </div>
                  )}
                  {(data.reg_hours > 0 || data.ot_hours > 0) && (
                    <div className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                      {data.reg_hours > 0 && `${data.reg_hours.toFixed(1)}h`}
                      {data.ot_hours > 0 && <span className="text-orange-500 ml-1">+{data.ot_hours.toFixed(1)} OT</span>}
                    </div>
                  )}
                  {data.has_time_off && data.time_off_entries.length > 0 && (
                    <div className="space-y-0.5">
                      {data.time_off_entries.slice(0, 2).map((entry, i) => (
                        <div key={i} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 truncate">
                          {entry.employee_name.split(' ')[0]}: {entry.request_type.charAt(0).toUpperCase() + entry.request_type.slice(1).replace('_', ' ')}
                        </div>
                      ))}
                      {data.time_off_entries.length > 2 && (
                        <div className="text-[10px] text-blue-500 dark:text-blue-300">
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
