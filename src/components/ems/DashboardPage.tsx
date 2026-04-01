import { COMPANIES, TOURS, ATTRACTIONS, USERS, DMAS, formatCurrency, formatDate, getStatusColor } from '@/data/constants';
import { StatusBadge, Avatar } from './Primitives';
import type { Engagement } from '@/data/constants';

interface DashboardProps {
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
}

export function DashboardPage({ engagements, onNavigate }: DashboardProps) {
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
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
                <span className="text-text-primary">{p.status.replace(/([A-Z])/g, ' $1').trim()} ({p.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-[65%_35%] gap-4">
        {/* Upcoming Shows */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Upcoming Shows (Next 30 Days)</h3>
          <table className="w-full text-sm">
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
        <table className="w-full text-sm">
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
  );
}
