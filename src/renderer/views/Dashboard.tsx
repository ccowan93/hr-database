import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { api } from '../api';
import type { DashboardStats, BirthdayAlert, AnniversaryAlert } from '../types/employee';
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
  { id: 'metrics', label: 'Key Metrics', category: 'Overview' },
  { id: 'alerts', label: 'Birthday & Anniversary Alerts', category: 'Alerts' },
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
  const [backupEnabled, setBackupEnabled] = useState<boolean | null>(null);
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
    api.localBackupGetStatus().then(s => setBackupEnabled(s.enabled)).catch(() => {});
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
          <div className={birthdays.length > 0 && anniversaries.length > 0 ? 'grid-2' : ''} style={birthdays.length > 0 && anniversaries.length > 0 ? { gridTemplateColumns: '1fr 1fr' } : undefined}>
            {birthdays.length > 0 && (
              <div className="section-card">
                <div className="section-head">
                  <div className="section-title">Upcoming Birthdays</div>
                  <span className="badge">{birthdays.length}</span>
                </div>
                <div className="section-body" style={{ maxHeight: 220, overflowY: 'auto', padding: '10px 20px 14px' }}>
                  <div className="kv-list">
                    {birthdays.map(b => (
                      <div key={b.id} className="flex-between" style={{ fontSize: 13 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{b.employee_name}</span>
                          <span className="small muted" style={{ marginLeft: 8 }}>{b.current_department}</span>
                        </div>
                        <span className={`badge ${b.days_until === 0 ? 'success' : b.days_until <= 7 ? 'warn' : ''}`}>
                          {b.days_until === 0 ? 'Today' : b.days_until === 1 ? 'Tomorrow' : `${b.days_until} days`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {anniversaries.length > 0 && (
              <div className="section-card">
                <div className="section-head">
                  <div className="section-title">Upcoming Work Anniversaries</div>
                  <span className="badge">{anniversaries.length}</span>
                </div>
                <div className="section-body" style={{ maxHeight: 220, overflowY: 'auto', padding: '10px 20px 14px' }}>
                  <div className="kv-list">
                    {anniversaries.map(a => (
                      <div key={a.id} className="flex-between" style={{ fontSize: 13 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{a.employee_name}</span>
                          <span className="small muted" style={{ marginLeft: 8 }}>{a.next_years} years</span>
                        </div>
                        <span className={`badge ${a.days_until === 0 ? 'success' : a.days_until <= 7 ? 'warn' : ''}`}>
                          {a.days_until === 0 ? 'Today' : a.days_until === 1 ? 'Tomorrow' : `${a.days_until} days`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'metrics':
        return (
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Total Headcount</div>
              <div className="stat-value">{stats.totalHeadcount}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Avg Tenure</div>
              <div className="stat-value">{stats.avgTenure} <span className="small muted" style={{ fontSize: 13, fontWeight: 500 }}>yrs</span></div>
            </div>
            <div className="stat">
              <div className="stat-label">Avg Pay Rate</div>
              <div className="stat-value">${stats.avgPay.toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Departments</div>
              <div className="stat-value">{stats.departmentCount}</div>
            </div>
          </div>
        );

      case 'payroll':
        return (
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Payroll Summary by Department</div>
              <div className="hstack" style={{ gap: 18 }}>
                <div>
                  <span className="small muted">Total Payroll: </span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-ink)' }}>
                    ${stats.totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="small muted">/hr</span>
                </div>
                <div>
                  <span className="small muted">Est. Weekly: </span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
                    ${(stats.totalPayroll * 40).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <div className="section-body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th style={{ textAlign: 'right' }}>Headcount</th>
                    <th style={{ textAlign: 'right' }}>Avg Pay</th>
                    <th style={{ textAlign: 'right' }}>Total Payroll</th>
                    <th style={{ textAlign: 'right' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.payrollByDept.map((d: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{d.department}</td>
                      <td style={{ textAlign: 'right' }}>{d.headcount}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>${Number(d.avg_pay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>${Number(d.total_payroll).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="muted" style={{ textAlign: 'right' }}>{stats.totalPayroll > 0 ? ((Number(d.total_payroll) / stats.totalPayroll) * 100).toFixed(1) : 0}%</td>
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
                <Pie data={stats.sexBreakdown} dataKey="count" nameKey="sex" cx="50%" cy="50%" outerRadius={100} label={({ sex, count }) => `${sex}: ${count}`} style={{ outline: 'none' }}>
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
                <Pie data={stats.raceBreakdown} dataKey="count" nameKey="race" cx="50%" cy="50%" outerRadius={100} label={({ race, count }) => `${race}: ${count}`} style={{ outline: 'none' }}>
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
                <Pie data={stats.educationBreakdown} dataKey="count" nameKey="education" cx="50%" cy="50%" outerRadius={100} label={({ education, count }) => `${education}: ${count}`} style={{ outline: 'none' }}>
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
            <div style={{ overflowX: 'auto' }}>
              <table className="kin-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th style={{ textAlign: 'right' }}>Supervisors</th>
                    <th style={{ textAlign: 'right' }}>Employees</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Ratio (Emp:Sup)</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorRatio.map((d: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{d.department}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--warn)' }}>{d.supervisors}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{d.employees}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{d.total}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${d.ratio && d.ratio > 10 ? 'danger' : d.ratio && d.ratio > 6 ? 'warn' : 'success'}`}>
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
              <p className="small muted" style={{ textAlign: 'center', padding: '32px 0' }}>No department transfers recorded</p>
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
            <div className="hstack small muted" style={{ justifyContent: 'center', gap: 16, marginTop: 8 }}>
              {retention.map((r: any) => (
                <span key={r.milestone}>{r.milestone}: {r.retained}/{r.total} retained</span>
              ))}
            </div>
          </ChartCard>
        );

      case 'overdue-raise': {
        const overdue = raiseData.filter((e: any) => e.days_since_raise > 365);
        return (
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Employees Overdue for Raise (12+ Months)</div>
              {overdue.length > 0 && <span className="badge warn">{overdue.length}</span>}
            </div>
            {overdue.length === 0 ? (
              <div className="section-body">
                <p className="small muted">No employees overdue for a raise.</p>
              </div>
            ) : (
              <div className="section-body" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="kin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th style={{ textAlign: 'right' }}>Current Pay</th>
                      <th style={{ textAlign: 'right' }}>Last Raise</th>
                      <th style={{ textAlign: 'right' }}>Days Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.slice(0, 20).map((e: any) => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.employee_name}</td>
                        <td>{e.current_department}</td>
                        <td>{e.current_position}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>${Number(e.current_pay_rate).toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{e.date_last_raise}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${e.days_since_raise > 730 ? 'danger' : 'warn'}`}>
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
      }

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
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Organization overview and key metrics</p>
        </div>
        <div className="hstack">
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className={`btn ${showCustomize ? 'primary' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            Customize
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf} className="btn">
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {backupEnabled === false && (
        <div className="banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18, flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>Backups not configured</div>
            <div className="small muted">Set up local auto-backup in Settings to protect your data.</div>
          </div>
          <Link to="/settings" className="small" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>Go to Settings →</Link>
        </div>
      )}

      {showCustomize && (
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Customize dashboard</div>
            <div className="hstack">
              <button onClick={resetLayout} className="btn">Reset to default</button>
              <button onClick={() => setShowCustomize(false)} className="btn primary">Done</button>
            </div>
          </div>
          <div className="section-body">
            <p className="small muted" style={{ marginBottom: 10 }}>Toggle widgets on/off and drag to reorder. Changes save automatically.</p>
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    className="hstack"
                    style={{
                      gap: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      cursor: 'grab',
                      border: '1px solid',
                      borderColor: dragOverIdx === idx ? 'var(--accent)' : 'transparent',
                      background: dragOverIdx === idx ? 'var(--accent-soft)' : 'transparent',
                      transition: 'background 120ms, border-color 120ms',
                    }}
                  >
                    <svg style={{ width: 14, height: 14, color: 'var(--ink-3)', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>

                    <button
                      onClick={() => toggleWidget(id)}
                      style={{
                        position: 'relative',
                        width: 34,
                        height: 18,
                        borderRadius: 99,
                        border: 'none',
                        padding: 0,
                        flexShrink: 0,
                        cursor: 'pointer',
                        background: visible ? 'var(--accent)' : 'var(--line-strong)',
                        transition: 'background 120ms',
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        left: visible ? 18 : 2,
                        width: 14,
                        height: 14,
                        borderRadius: 99,
                        background: '#fff',
                        transition: 'left 140ms',
                      }} />
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: visible ? 'var(--ink)' : 'var(--ink-3)' }}>
                        {widget.label}
                      </span>
                      <span className="small muted" style={{ marginLeft: 8 }}>{widget.category}</span>
                    </div>

                    <div className="hstack" style={{ gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => moveWidget(id, -1)}
                        disabled={idx === 0}
                        className="icon-btn"
                        style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      >
                        <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveWidget(id, 1)}
                        disabled={idx === layout.order.length - 1}
                        className="icon-btn"
                        style={{ opacity: idx === layout.order.length - 1 ? 0.3 : 1 }}
                      >
                        <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
