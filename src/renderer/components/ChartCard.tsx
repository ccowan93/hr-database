import React from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

export default function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="section-card">
      <div className="section-head">
        <h3 className="section-title">{title}</h3>
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}
