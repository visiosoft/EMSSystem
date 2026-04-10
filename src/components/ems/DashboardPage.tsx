import { useTheme } from 'next-themes';
import { COMPANIES, TOURS, ATTRACTIONS, USERS, DMAS, formatCurrency, formatDate, getStatusColor } from '@/data/constants';
import { StatusBadge, Avatar } from './Primitives';
import type { Engagement } from '@/data/constants';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

interface DashboardProps {
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
}

// Custom tooltip for Revenue Trend
const RevenueTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-elevated border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
        <div className="text-text-secondary mb-1 font-medium">{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-text-muted">{p.name}:</span>
            <span className="text-text-primary font-mono font-semibold">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom tooltip for Status Bar Chart
const StatusBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-elevated border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
        <div className="text-text-secondary mb-1 font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0]?.fill }} />
          <span className="text-text-muted">Engagements:</span>
          <span className="text-text-primary font-mono font-semibold">{payload[0]?.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function DashboardPage({ engagements, onNavigate }: DashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // Theme-aware chart colors
  const chartColors = {
    grid: isDark ? 'hsl(215,12%,22%)' : 'hsl(215,20%,87%)',
    axisText: isDark ? 'hsl(215,10%,42%)' : 'hsl(215,14%,48%)',
  };

  const activeEngs = engagements.filter(e => !['Closed', 'Cancelled'].includes(e.status));
  const grossQ3 = engagements.filter(e => {
    const d = new Date(e.showDates[0]?.date);
    return d.getMonth() >= 6 && d.getMonth() <= 8;
  }).reduce((s, e) => s + (e.actualGross || e.projectedGross), 0);

  const showsThisMonth = engagements.filter(e => {
    const d = new Date(e.showDates[0]?.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const statusCounts: Record<string, number> = {};
  engagements.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });

  const pipeline = ['Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed'];
  const pipelineData = pipeline.map(s => ({ status: s, count: statusCounts[s] || 0 }));
  const totalPipeline = pipelineData.reduce((s, p) => s + p.count, 0);

  const upcoming = [...engagements]
    .filter(e => !['Cancelled', 'Closed', 'Settled'].includes(e.status))
    .sort((a, b) => a.showDates[0]?.date.localeCompare(b.showDates[0]?.date))
    .slice(0, 6);

  const activities = [
    { initials: 'SK', name: 'Sarah Kim', action: 'accepted offer for Stella Vance @ United Center', time: '2h ago' },
    { initials: 'MT', name: 'Marcus T.', action: 'completed Production checklist for ENG-2025-001', time: '5h ago' },
    { initials: 'JO', name: 'Jennifer O.', action: 'uploaded Contract - Signed.pdf', time: '1d ago' },
    { initials: 'DP', name: 'David Park', action: 'created Project: Iron Meridian East Coast', time: '1d ago' },
    { initials: 'AR', name: 'Alex R.', action: 'approved Event Poster for ENG-2025-003', time: '2d ago' },
    { initials: 'SK', name: 'Sarah Kim', action: 'submitted offer to Bridgestone Arena', time: '2d ago' },
    { initials: 'PS', name: 'Priya S.', action: 'updated Finance workflow for ENG-2025-006', time: '3d ago' },
  ];

  const workflowTypes = ['Marketing', 'Production', 'Event Business', 'Creative', 'Sales', 'Finance'];
  const workflowKeys = ['marketing', 'production', 'eventBusiness', 'creative', 'sales', 'finance'] as const;
  const wfStatuses = ['NotStarted', 'InProgress', 'NeedsAttention', 'Complete'];

  const workflowGrid = workflowTypes.map((wt, i) => {
    const key = workflowKeys[i];
    const counts: Record<string, number> = {};
    wfStatuses.forEach(s => { counts[s] = 0; });
    engagements.forEach(e => {
      const st = e.workflows[key].status;
      if (st in counts) counts[st]++;
    });
    return { name: wt, counts };
  });

  // Revenue trend data
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueTrendData = monthLabels.map((month, idx) => {
    const monthEngs = engagements.filter(e => {
      const d = new Date(e.showDates[0]?.date);
      return d.getMonth() === idx;
    });
    const projected = monthEngs.reduce((s, e) => s + e.projectedGross, 0);
    const actual = monthEngs.reduce((s, e) => s + (e.actualGross || 0), 0);
    return { month, projected: projected || 0, actual: actual || 0 };
  }).filter(d => d.projected > 0 || d.actual > 0);

  const fullRevenueTrend = monthLabels.map((month, idx) => {
    const found = revenueTrendData.find(d => d.month === month);
    const fallbackProjected = [0, 0, 510000, 205000, 198000, 420000, 112000, 510000, 880000, 620000, 580000, 710000][idx];
    const fallbackActual = [0, 0, 0, 0, 198000, 0, 0, 0, 892000, 598500, 0, 0][idx];
    return {
      month,
      projected: found ? found.projected : fallbackProjected,
      actual: found ? found.actual : fallbackActual,
    };
  });

  // Status bar chart data — Draft/Closed use theme-aware grays
  const statusBarColors: Record<string, string> = {
    Draft: isDark ? 'hsl(215,12%,36%)' : 'hsl(215,12%,62%)',
    Confirmed: 'hsl(130,52%,53%)',
    OnSale: 'hsl(217,98%,61%)',
    Settled: 'hsl(168,100%,42%)',
    Closed: isDark ? 'hsl(215,10%,45%)' : 'hsl(215,10%,55%)',
    Cancelled: 'hsl(0,93%,63%)',
  };
  const statusBarData = ['Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed', 'Cancelled'].map(s => ({
    status: s,
    count: statusCounts[s] || 0,
    color: statusBarColors[s],
    label: s === 'OnSale' ? 'On Sale' : s,
  })).filter(d => d.count > 0);

  // Custom bar label
  const renderBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={chartColors.axisText} fontSize={11} fontFamily="JetBrains Mono">
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Active Engagements', value: activeEngs.length.toString(), sub: '● live', onClick: () => onNavigate('engagements') },
          { label: 'Open Projects', value: '8', sub: '◐ in progress', onClick: () => onNavigate('projects') },
          { label: 'Gross Q3 2025', value: formatCurrency(grossQ3), sub: '↑ 12% vs Q2', onClick: () => onNavigate('analytics') },
          { label: 'Shows This Month', value: showsThisMonth.length.toString(), sub: 'Next: 14 days', onClick: () => onNavigate('calendar') },
        ].map((kpi, i) => (
          <button key={i} onClick={kpi.onClick}
            className="bg-card border border-border rounded-lg p-4 text-left hover:border-ems-accent/30 transition-colors">
            <div className="text-xs text-text-secondary mb-1">{kpi.label}</div>
            <div className="text-2xl font-semibold text-text-primary font-mono">{kpi.value}</div>
            <div className="text-xs text-text-muted mt-1">{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Engagement Status Pipeline</h3>
        <div className="flex h-8 rounded overflow-hidden">
          {pipelineData.map((p, i) => {
            const { bg } = getStatusColor(p.status);
            const pct = totalPipeline > 0 ? (p.count / totalPipeline) * 100 : 0;
            if (p.count === 0) return null;
            return (
              <button key={i} onClick={() => onNavigate('engagements', { statusFilter: p.status })}
                className={`${bg} flex items-center justify-center text-xs font-medium transition-opacity hover:opacity-80`}
                style={{ width: `${pct}%`, minWidth: p.count > 0 ? '60px' : 0 }}
                title={`${p.status}: ${p.count}`}>
                <span className="text-text-primary hidden sm:inline">{p.status.replace(/([A-Z])/g, ' $1').trim()} ({p.count})</span>
                <span className="text-text-primary sm:hidden">{p.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[62%_38%] gap-4">
        {/* Revenue Trend — Area Chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Revenue Trend</h3>
              <p className="text-xs text-text-muted mt-0.5">Projected vs. Actual Gross · Full Year 2025</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-8 h-0.5 rounded-full inline-block" style={{ backgroundColor: 'hsl(168,100%,42%)', opacity: 0.5 }} />
                Projected
              </span>
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-8 h-0.5 rounded-full inline-block" style={{ backgroundColor: 'hsl(168,100%,42%)' }} />
                Actual
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fullRevenueTrend} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(168,100%,42%)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="hsl(168,100%,42%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(168,100%,42%)" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="hsl(168,100%,42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={chartColors.grid}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: chartColors.axisText, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                tick={{ fill: chartColors.axisText, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<RevenueTrendTooltip />} cursor={{ stroke: chartColors.grid, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="projected"
                name="Projected"
                stroke="hsl(168,100%,42%)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeOpacity={0.55}
                fill="url(#gradProjected)"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(168,100%,42%)', strokeWidth: 0, opacity: 0.6 }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="hsl(168,100%,42%)"
                strokeWidth={2.5}
                fill="url(#gradActual)"
                dot={{ r: 3.5, fill: 'hsl(168,100%,42%)', strokeWidth: 2, stroke: isDark ? 'hsl(215,23%,11%)' : '#ffffff' }}
                activeDot={{ r: 5.5, fill: 'hsl(168,100%,42%)', strokeWidth: 2, stroke: isDark ? 'hsl(215,23%,11%)' : '#ffffff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement by Status — Bar Chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="mb-1">
            <h3 className="text-sm font-semibold text-text-primary">Engagements by Status</h3>
            <p className="text-xs text-text-muted mt-0.5">Current distribution · All time</p>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={statusBarData}
              margin={{ top: 20, right: 4, left: -16, bottom: 0 }}
              barSize={36}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={chartColors.grid}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: chartColors.axisText, fontSize: 10.5, fontFamily: 'DM Sans' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: chartColors.axisText, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<StatusBarTooltip />}
                cursor={{ fill: isDark ? 'hsl(215,14%,18%)' : 'hsl(215,15%,93%)', radius: 4 }}
              />
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
                label={renderBarLabel}
              >
                {statusBarData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend pills */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {statusBarData.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: d.color, opacity: 0.85 }} />
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Row — Upcoming Shows + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
        {/* Upcoming Shows */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Upcoming Shows (Next 30 Days)</h3>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Attraction — Tour</th>
                <th className="text-left py-2">Venue</th>
                <th className="text-left py-2">Market</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Days Away</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(eng => {
                const venue = COMPANIES.find(c => c.id === eng.venueId);
                const tour = TOURS.find(t => t.id === eng.tourId);
                const attraction = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
                const daysAway = Math.ceil((new Date(eng.showDates[0]?.date).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={eng.id} onClick={() => onNavigate('engagement-detail', { engagementId: eng.id })}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2 font-mono text-xs">{formatDate(eng.showDates[0]?.date)}</td>
                    <td className="py-2 text-text-primary">{attraction?.name} — {tour?.name}</td>
                    <td className="py-2">{venue?.tradeName}</td>
                    <td className="py-2">{venue?.city}</td>
                    <td className="py-2"><StatusBadge status={eng.status} /></td>
                    <td className="py-2 text-right font-mono text-xs">{daysAway}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Recent Activity</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <Avatar name={a.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary"><span className="font-medium">{a.name}</span> {a.action}</div>
                  <div className="text-[10px] text-text-muted">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Health Grid */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Workflow Health Grid</h3>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-text-muted text-xs">
              <th className="text-left py-2 w-40">Workflow</th>
              {wfStatuses.map(s => <th key={s} className="text-center py-2">{s.replace(/([A-Z])/g, ' $1').trim()}</th>)}
            </tr>
          </thead>
          <tbody>
            {workflowGrid.map((wf, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="py-2 text-text-primary font-medium">{wf.name}</td>
                {wfStatuses.map(s => {
                  const { bg, text } = getStatusColor(s);
                  return (
                    <td key={s} className="text-center py-2">
                      <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-mono ${bg} ${text}`}>
                        {wf.counts[s]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}