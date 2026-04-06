import React from 'react';

interface DayData {
  present: boolean;
  punch_in?: string | null;
  punch_out?: string | null;
  reg_hours: number;
  ot_hours: number;
  missing_punch: boolean;
  has_time_off: boolean;
  records: any[];
}

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  dayDataMap: Map<string, DayData>; // key: "YYYY-MM-DD"
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarGrid({ year, month, dayDataMap, selectedDate, onSelectDate }: CalendarGridProps) {
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

          let statusColor = '';
          let statusDot = '';
          if (data) {
            if (data.has_time_off) {
              statusColor = 'bg-blue-50 dark:bg-blue-900/20';
              statusDot = 'bg-blue-500';
            } else if (data.missing_punch) {
              statusColor = 'bg-yellow-50 dark:bg-yellow-900/20';
              statusDot = 'bg-yellow-500';
            } else if (data.present) {
              statusColor = 'bg-green-50 dark:bg-green-900/20';
              statusDot = 'bg-emerald-500';
            }
          } else if (!isWeekend) {
            // No data for a weekday could mean absent
            statusColor = '';
            statusDot = '';
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
                {statusDot && <span className={`w-2 h-2 rounded-full ${statusDot}`} />}
              </div>
              {data && (
                <div className="mt-1 space-y-0.5">
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
                  {data.has_time_off && (
                    <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Time Off</div>
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
