import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { api } from '../api';
import type { DashboardStats, BirthdayAlert, AnniversaryAlert } from '../types/employee';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';
import WorldMap from '../components/WorldMap';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

const STORAGE_KEY = 'hr-dashboard-layout';

interface WidgetDef {
  id: string;
  label: string;
  category: string;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: 'alerts', label: 'Birthday & Anniversary Alerts', category: 'Alerts' },
  { id: 'metrics', label: 'Key Metrics', category: 'Overview' },
  { id: 'payroll', label: 'Payroll Summary', category: 'Compensation' },
  { id: 'headcount-dept', label: 'Headcount by Department', category: 'Workforce' },
  { id: 'gender', label: 'Gender Distribution', category: 'Demographics' },
  { id: 'race', label: 'Race / Ethnicity Breakdown', category: 'Demographics' },
  { id: 'tenure', label: 'Tenure Distribution', category: 'Workforce' },
  { id: 'pay-dept', label: 'Avg Pay by Department', category: 'Compensation' },
  { id: 'education', label: 'Education Level Breakdown', category: 'Demographics' },
  { id: 'languages', label: 'Language Distribution', category: 'Demographics' },
  { id: 'turnover', label: 'Employee Turnover', category: 'Operational' },
  { id: 'world-map', label: 'Employees by Country', category: 'Demographics' },
  { id: 'age-dist', label: 'Age Distribution', category: 'Demographics' },
  { id: 'avg-age-dept', label: 'Avg Age by Department', category: 'Demographics' },
  { id: 'pay-growth', label: 'Pay Growth (Starting vs Current)', category: 'Compensation' },
  { id: 'pay-equity', label: 'Pay Equity Comparison', category: 'Compensation' },
  { id: 'supervisor-ratio', label: 'Supervisor-to-Employee Ratio', category: 'Workforce' },
  { id: 'headcount-growth', label: 'Headcount Growth', category: 'Operational' },
  { id: 'transfers', label: 'Department Transfer Activity', category: 'Operational' },
  { id: 'retention', label: 'Retention Rate', category: 'Operational' },
  { id: 'overdue-raise', label: 'Employees Overdue for Raise', category: 'Compensation' },
];

const DEFAULT_ORDER = ALL_WIDGETS.map(w => w.id);

interface LayoutConfig {
  order: string[];
  hidden: string[];
}

function loadLayout(): LayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge in any new widgets that were added after the user saved their layout
      const known = new Set([...parsed.order, ...parsed.hidden]);
      const missing = DEFAULT_ORDER.filter(id => !known.has(id));
      return { order: [...parsed.order, ...missing], hidden: parsed.hidden || [] };
    }
  } catch {}
  return { order: [...DEFAULT_ORDER], hidden: [] };
}

function saveLayout(config: LayoutConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [birthdays, setBirthdays] = useState<BirthdayAlert[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryAlert[]>([]);
  const [languages, setLanguages] = useState<{ language: string; count: number }[]>([]);
  const [turnover, setTurnover] = useState<{ month: string; archived: number; hired: number }[]>([]);
  const [payGrowth, setPayGrowth] = useState<any[]>([]);
  const [raiseData, setRaiseData] = useState<any[]>([]);
  const [payEquity, setPayEquity] = useState<{ byGender: any[]; byRace: any[]; byEducation: any[] }>({ byGender: [], byRace: [], byEducation: [] });
  const [ageDist, setAgeDist] = useState<any[]>([]);
  const [supervisorRatio, setSupervisorRatio] = useState<any[]>([]);
  const [avgAgeDept, setAvgAgeDept] = useState<any[]>([]);
  const [headcountGrowth, setHeadcountGrowth] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [retention, setRetention] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [layout, setLayout] = useState<LayoutConfig>(loadLayout);
  const [showCustomize, setShowCustomize] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getUpcomingBirthdays(30),
      api.getUpcomingAnniversaries(30),
      api.getLanguageDistribution(),
      api.getMonthlyTurnover(12),
      api.getPayGrowth(),
      api.getTimeSinceRaise(),
      api.getPayEquity(),
      api.getAgeDistribution(),
      api.getSupervisorRatio(),
      api.getAvgAgeByDept(),
      api.getHeadcountGrowth(12),
      api.getDepartmentTransfers(),
      api.getRetentionRate(),
    ]).then(([s, b, a, l, t, pg, rd, pe, ad, sr, aad, hg, tr, ret]) => {
      setStats(s); setBirthdays(b); setAnniversaries(a);
      setLanguages(l); setTurnover(t); setPayGrowth(pg);
      setRaiseData(rd); setPayEquity(pe); setAgeDist(ad);
      setSupervisorRatio(sr); setAvgAgeDept(aad); setHeadcountGrowth(hg);
      setTransfers(tr); setRetention(ret);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateLayout = useCallback((newLayout: LayoutConfig) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setLayout(prev => {
      const hidden = prev.hidden.includes(id)
        ? prev.hidden.filter(h => h !== id)
        : [...prev.hidden, id];
      const next = { ...prev, hidden };
      saveLayout(next);
      return next;
    });
  }, []);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setLayout(prev => {
        const order = [...prev.order];
        const [moved] = order.splice(dragIdx, 1);
        order.splice(dragOverIdx, 0, moved);
        const next = { ...prev, order };
        saveLayout(next);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const moveWidget = useCallback((id: string, dir: -1 | 1) => {
    setLayout(prev => {
      const order = [...prev.order];
      const idx = order.indexOf(id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= order.length) return prev;
      [order[idx], order[target]] = [order[target], order[idx]];
      const next = { ...prev, order };
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    const fresh = { order: [...DEFAULT_ORDER], hidden: [] };
    updateLayout(fresh);
  }, [updateLayout]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const result = await api.exportDashboardPDF();
      if (result.success) alert(`Exported to ${result.path}`);
      else if (result.error && result.error !== 'Export cancelled') alert('Export failed: ' + result.error);
    } catch (err) { console.error(err); }
    finally { setExportingPdf(false); }
  };

  const isVisible = (id: string) => !layout.hidden.includes(id);

  // ── Month formatter helpers ──
  const shortMonth = (v: string) => {
    const [y, m] = v.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
  };
  const longMonth = (v: string) => {
    const [y, m] = (v as string).split('-');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  // ── Widget renderers ──
  const renderWidget = (id: string): React.ReactNode => {
    if (!stats) return null;
    switch (id) {
      case 'alerts':
        if (birthdays.length === 0 && anniversaries.length === 0) return null;
        return (
          <div className={birthdays.length > 0 && anniversaries.length > 0 ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>
            {birthdays.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="text-lg">🎂</span> Upcoming Birthdays
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {birthdays.map(b => (
                    <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{b.employee_name}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{b.current_department}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        b.days_until === 0 ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                        : b.days_until <= 7 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {b.days_until === 0 ? 'Today!' : b.days_until === 1 ? 'Tomorrow' : `${b.days_until} days`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {anniversaries.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="text-lg">🎉</span> Upcoming Work Anniversaries
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {anniversaries.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{a.employee_name}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{a.next_years} years</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        a.days_until === 0 ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                        : a.days_until <= 7 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {a.days_until === 0 ? 'Today!' : a.days_until === 1 ? 'Tomorrow' : `${a.days_until} days`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'metrics':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Total Headcount" value={stats.totalHeadcount} color="blue" />
            <MetricCard title="Avg Tenure" value={`${stats.avgTenure} yrs`} color="green" />
            <MetricCard title="Avg Pay Rate" value={`$${stats.avgPay.toFixed(2)}`} color="purple" />
            <MetricCard title="Departments" value={stats.departmentCount} color="amber" />
          </div>
        );

      case 'payroll':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Payroll Summary by Department</h3>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Payroll: <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${stats.totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Department</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Headcount</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Avg Pay</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Total Payroll</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.payrollByDept.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">{d.department}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{d.headcount}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">${Number(d.avg_pay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right text-gray-800 dark:text-gray-200 font-semibold">${Number(d.total_payroll).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{stats.totalPayroll > 0 ? ((Number(d.total_payroll) / stats.totalPayroll) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'headcount-dept':
        return (
          <ChartCard title="Headcount by Department">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.headcountByDept} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'gender':
        return (
          <ChartCard title="Gender Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.sexBreakdown} dataKey="count" nameKey="sex" cx="50%" cy="50%" outerRadius={100} label={({ sex, count }) => `${sex}: ${count}`}>
                  {stats.sexBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'race':
        return (
          <ChartCard title="Race / Ethnicity Breakdown">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.raceBreakdown} dataKey="count" nameKey="race" cx="50%" cy="50%" outerRadius={100} label={({ race, count }) => `${race}: ${count}`}>
                  {stats.raceBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'tenure':
        return (
          <ChartCard title="Tenure Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.tenureDistribution} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bracket" tick={{ fontSize: 12 }} label={{ value: 'Years', position: 'insideBottom', offset: -10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'pay-dept':
        return (
          <ChartCard title="Average Pay Rate by Department">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stats.payByDept} margin={{ top: 5, right: 20, bottom: 100, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} height={80} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Avg Pay']} />
                <Bar dataKey="avg_pay" name="Avg Pay" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'education':
        return (
          <ChartCard title="Education Level Breakdown">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.educationBreakdown} dataKey="count" nameKey="education" cx="50%" cy="50%" outerRadius={100} label={({ education, count }) => `${education}: ${count}`}>
                  {stats.educationBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'languages':
        return (
          <ChartCard title="Language Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={languages.slice(0, 15)} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="language" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'turnover':
        return (
          <ChartCard title="Employee Turnover (Last 12 Months)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={turnover} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={shortMonth} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip labelFormatter={longMonth} />
                <Legend />
                <Line type="monotone" dataKey="hired" name="Hired" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="archived" name="Departed" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'world-map':
        return (
          <ChartCard title="Employees by Country of Origin">
            <WorldMap data={stats.countryBreakdown} />
          </ChartCard>
        );

      case 'age-dist':
        return (
          <ChartCard title="Age Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageDist} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'avg-age-dept':
        return (
          <ChartCard title="Average Age by Department">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={avgAgeDept} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip formatter={(value: number) => [Number(value).toFixed(1), '']} />
                <Bar dataKey="avg_age" name="Avg Age" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'pay-growth':
        return (
          <ChartCard title="Pay Growth by Department (Starting vs Current)">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={payGrowth} margin={{ top: 5, right: 20, bottom: 100, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} height={80} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, '']} />
                <Legend />
                <Bar dataKey="avg_starting" name="Avg Starting Pay" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avg_current" name="Avg Current Pay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'pay-equity':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard title="Avg Pay by Gender">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={payEquity.byGender} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Avg Pay']} />
                  <Bar dataKey="avg_pay" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Avg Pay by Race">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={payEquity.byRace} margin={{ top: 5, right: 10, bottom: 40, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Avg Pay']} />
                  <Bar dataKey="avg_pay" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Avg Pay by Education">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={payEquity.byEducation} margin={{ top: 5, right: 10, bottom: 60, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Avg Pay']} />
                  <Bar dataKey="avg_pay" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        );

      case 'supervisor-ratio':
        return (
          <ChartCard title="Supervisor-to-Employee Ratio by Department">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Department</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Supervisors</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Employees</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Total</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Ratio (Emp:Sup)</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorRatio.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">{d.department}</td>
                      <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{d.supervisors}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{d.employees}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{d.total}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.ratio && d.ratio > 10 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : d.ratio && d.ratio > 6 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {d.ratio ? `${d.ratio}:1` : 'No supervisor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        );

      case 'headcount-growth':
        return (
          <ChartCard title="Headcount Growth (Last 12 Months)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={headcountGrowth} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={shortMonth} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={longMonth} />
                <Legend />
                <Line type="monotone" dataKey="cumulative" name="Total Headcount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="newHires" name="New Hires" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        );

      case 'transfers':
        return (
          <ChartCard title="Department Transfer Activity">
            {transfers.filter((d: any) => d.transferred > 0).length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">No department transfers recorded</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={transfers.filter((d: any) => d.transferred > 0)} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="transferred" name="Transferred In" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        );

      case 'retention':
        return (
          <ChartCard title="Employee Retention Rate">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={retention} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="milestone" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}%`, 'Retention']} />
                <Bar dataKey="rate" name="Retention Rate" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {retention.map((_: any, i: number) => (
                    <Cell key={i} fill={retention[i].rate >= 90 ? '#10b981' : retention[i].rate >= 75 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {retention.map((r: any) => (
                <span key={r.milestone}>{r.milestone}: {r.retained}/{r.total} retained</span>
              ))}
            </div>
          </ChartCard>
        );

      case 'overdue-raise':
        const overdue = raiseData.filter((e: any) => e.days_since_raise > 365);
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-4">
              Employees Overdue for Raise (12+ Months)
            </h3>
            {overdue.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No employees overdue for a raise.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Employee</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Department</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Position</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Current Pay</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Last Raise</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Days Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.slice(0, 20).map((e: any) => (
                      <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">{e.employee_name}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{e.current_department}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{e.current_position}</td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">${Number(e.current_pay_rate).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{e.date_last_raise}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            e.days_since_raise > 730 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          }`}>
                            {Math.round(e.days_since_raise / 30)} months
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">Loading dashboard...</div>;
  }

  if (!stats || stats.totalHeadcount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-4">
        <p className="text-lg">No employee data found.</p>
        <p className="text-sm">Use the "Import from Excel" button in the sidebar to load your data.</p>
      </div>
    );
  }

  const visibleWidgets = layout.order.filter(id => isVisible(id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              showCustomize
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            Customize
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Customize Panel */}
      {showCustomize && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Customize Dashboard</h3>
            <div className="flex items-center gap-2">
              <button onClick={resetLayout} className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Reset to Default
              </button>
              <button onClick={() => setShowCustomize(false)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Done
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Toggle widgets on/off and drag to reorder. Changes save automatically.</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {layout.order.map((id, idx) => {
              const widget = ALL_WIDGETS.find(w => w.id === id);
              if (!widget) return null;
              const visible = isVisible(id);
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                    dragOverIdx === idx ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                  }`}
                >
                  {/* Drag handle */}
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  </svg>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleWidget(id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full flex-shrink-0 transition-colors ${
                      visible ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      visible ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`} />
                  </button>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${visible ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                      {widget.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{widget.category}</span>
                  </div>

                  {/* Move buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveWidget(id, -1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveWidget(id, 1)}
                      disabled={idx === layout.order.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Render visible widgets in order */}
      {visibleWidgets.map(id => {
        const rendered = renderWidget(id);
        if (!rendered) return null;
        return <div key={id}>{rendered}</div>;
      })}
    </div>
  );
}
