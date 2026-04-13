import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { formatCurrency } from '@/data/constants';
import { StatusBadge, FilterChips } from './Primitives';

export function AnalyticsPage() {
  const [quarter, setQuarter] = useState('All');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const svgColors = {
    label: isDark ? '#8B949E' : '#64748b',
    muted: isDark ? '#484F58' : '#94a3b8',
    primary: isDark ? '#E6EDF3' : '#1e293b',
    gridLine: isDark ? '#2D333B' : '#e2e8f0',
    barBg: isDark ? '#21262D' : '#f1f5f9',
  };

  const monthlyGross = [820000, 1100000, 980000, 750000, 1200000, 890000, 1050000, 1380000, 1620000, 1480000, 980000, 590000];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxGross = Math.max(...monthlyGross);

  const dmaData = [
    { name: 'Chicago', count: 9 }, { name: 'New York', count: 8 }, { name: 'Los Angeles', count: 7 },
    { name: 'Dallas', count: 5 }, { name: 'Nashville', count: 4 }, { name: 'Miami', count: 4 },
    { name: 'Seattle', count: 3 }, { name: 'Denver', count: 3 },
  ];
  const maxDma = Math.max(...dmaData.map(d => d.count));

  const statusBreakdown = [
    { status: 'Confirmed', count: 6, color: '#3FB950' },
    { status: 'OnSale', count: 4, color: '#388BFD' },
    { status: 'Settled', count: 8, color: '#00D4AA' },
    { status: 'Closed', count: 12, color: isDark ? '#484F58' : '#94a3b8' },
    { status: 'Cancelled', count: 3, color: '#F85149' },
    { status: 'Draft', count: 2, color: isDark ? '#2D333B' : '#cbd5e1' },
  ];
  const totalStatus = statusBreakdown.reduce((s, d) => s + d.count, 0);

  const topAttractions = [
    { name: 'Stella Vance', revenue: 4200000 },
    { name: 'Iron Meridian', revenue: 3100000 },
    { name: 'The Blackwood Coll.', revenue: 2400000 },
    { name: 'Cleo & The Current', revenue: 1800000 },
    { name: 'Marcus Fontaine', revenue: 920000 },
  ];

  const workflowRates = [
    { name: 'Marketing', pct: 78 }, { name: 'Production', pct: 85 }, { name: 'Event Business', pct: 60 },
    { name: 'Creative', pct: 92 }, { name: 'Sales', pct: 54 }, { name: 'Finance', pct: 52 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Gross YTD', value: '$12,420,000' },
          { label: 'Total Shows YTD', value: '48' },
          { label: 'Avg Gross / Show', value: '$258,750' },
          { label: 'Avg IAE Margin', value: '18.4%' },
          { label: 'Shows This Quarter', value: '14' },
        ].map((k, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3">
            <div className="text-xs text-text-muted">{k.label}</div>
            <div className="text-xl font-semibold text-text-primary font-mono">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Monthly Gross Revenue</h3>
        <svg width="100%" height="200" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid meet">
          {monthlyGross.map((v, i) => {
            const h = (v / maxGross) * 150;
            const x = i * 56 + 20;
            const isFuture = i > 8;
            return (
              <g key={i}>
                <rect x={x} y={170 - h} width={40} height={h}
                  fill={isFuture ? 'hsl(168, 100%, 42%, 0.3)' : 'hsl(168, 100%, 42%)'}
                  rx="3" />
                <text x={x + 20} y={165 - h} textAnchor="middle" fill={svgColors.label} fontSize="9" fontFamily="JetBrains Mono">
                  ${(v / 1000000).toFixed(1)}M
                </text>
                <text x={x + 20} y={190} textAnchor="middle" fill={svgColors.muted} fontSize="10">
                  {months[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Shows by DMA</h3>
          <div className="space-y-2">
            {dmaData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-text-secondary w-24 text-right">{d.name}</span>
                <div className="flex-1 bg-elevated rounded-full h-4 overflow-hidden">
                  <div className="h-full bg-ems-accent rounded-full" style={{ width: `${(d.count / maxDma) * 100}%` }} />
                </div>
                <span className="text-xs font-mono text-text-primary w-6">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Engagement Status Breakdown</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160">
              {(() => {
                let offset = 0;
                return statusBreakdown.map((s, i) => {
                  const pct = s.count / totalStatus;
                  const dash = pct * 377;
                  const el = <circle key={i} cx="80" cy="80" r="60" fill="none" stroke={s.color} strokeWidth="20"
                    strokeDasharray={`${dash} ${377 - dash}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />;
                  offset += dash;
                  return el;
                });
              })()}
              <text x="80" y="75" textAnchor="middle" fill={svgColors.primary} fontSize="22" fontWeight="600" fontFamily="JetBrains Mono">
                {totalStatus}
              </text>
              <text x="80" y="92" textAnchor="middle" fill={svgColors.label} fontSize="10">Total</text>
            </svg>
            <div className="space-y-1.5">
              {statusBreakdown.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-text-secondary">{s.status}</span>
                  <span className="text-text-primary font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Top Attractions by Revenue</h3>
        <div className="space-y-2">
          {topAttractions.map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-text-muted w-4">{i + 1}.</span>
              <span className="text-sm text-text-primary w-44">{a.name}</span>
              <span className="text-xs font-mono text-text-primary w-24">{formatCurrency(a.revenue)}</span>
              <div className="flex-1 bg-elevated rounded-full h-3 overflow-hidden">
                <div className="h-full bg-ems-accent rounded-full" style={{ width: `${(a.revenue / topAttractions[0].revenue) * 100}%` }} />
              </div>
              <span className="text-xs text-text-muted w-10 text-right">
                {Math.round((a.revenue / topAttractions[0].revenue) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Workflow Completion Rate</h3>
        <div className="space-y-2">
          {workflowRates.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-text-secondary w-24 sm:w-32">{w.name}</span>
              <div className="flex-1 bg-elevated rounded-full h-3 overflow-hidden">
                <div className="h-full bg-ems-accent rounded-full" style={{ width: `${w.pct}%` }} />
              </div>
              <span className="text-xs font-mono text-text-primary w-10 text-right">{w.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}