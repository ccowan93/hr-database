import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <p className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>{title}</p>
      <p style={{ fontFamily: 'var(--display)', fontSize: 32, fontWeight: 400, marginTop: 6, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{value}</p>
      {subtitle && <p className="small muted" style={{ marginTop: 2 }}>{subtitle}</p>}
    </div>
  );
}
