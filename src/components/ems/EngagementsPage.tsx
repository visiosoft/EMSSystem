import React, { useState } from 'react';
import { COMPANIES, TOURS, ATTRACTIONS, USERS, CONTACTS, DMAS, formatCurrency, formatDate, getWorkflowDotColor } from '@/data/constants';
import { StatusBadge, SearchInput, FilterChips, ActionMenu } from './Primitives';
import type { Engagement } from '@/data/constants';

interface Props {
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
  statusFilter?: string;
}

export function EngagementsPage({ engagements, onNavigate, statusFilter: initFilter }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initFilter || 'All');

  const filtered = engagements.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && e.status !== statusFilter) return false;
    return true;
  });

  const workflowKeys = ['marketing', 'production', 'eventBusiness', 'creative', 'sales', 'finance'] as const;
  const workflowLabels = ['Marketing', 'Production', 'Event Business', 'Creative', 'Sales', 'Finance'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Engagements</h1>
        <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{filtered.length}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-64"><SearchInput value={search} onChange={setSearch} /></div>
        <FilterChips options={['All', 'Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed', 'Cancelled']} active={statusFilter} onChange={setStatusFilter} />
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
            <th className="text-left py-2.5 px-3">ID</th>
            <th className="text-left py-2.5 px-3">Engagement</th>
            <th className="text-left py-2.5 px-3">Show Date</th>
            <th className="text-left py-2.5 px-3">Venue</th>
            <th className="text-left py-2.5 px-3">Market</th>
            <th className="text-left py-2.5 px-3">Booker</th>
            <th className="text-right py-2.5 px-3">Proj. Gross</th>
            <th className="text-center py-2.5 px-3">Workflows</th>
            <th className="text-left py-2.5 px-3">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map(eng => {
              const venue = COMPANIES.find(c => c.id === eng.venueId);
              const booker = USERS.find(u => u.id === eng.bookerId);
              return (
                <tr key={eng.id} onClick={() => onNavigate('engagement-detail', { engagementId: eng.id })}
                  className="border-b border-border/50 hover:bg-hover cursor-pointer">
                  <td className="py-2.5 px-3 font-mono text-xs text-text-muted">{eng.id.toUpperCase()}</td>
                  <td className="py-2.5 px-3 text-text-primary font-medium max-w-[250px] truncate">{eng.name}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{formatDate(eng.showDates[0]?.date)}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{venue?.tradeName}</td>
                  <td className="py-2.5 px-3 text-text-secondary text-xs">{venue?.city}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{booker?.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs">{formatCurrency(eng.projectedGross)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-1" title={workflowKeys.map((k, i) => `${workflowLabels[i]}: ${eng.workflows[k].status}`).join('\n')}>
                      {workflowKeys.map(k => (
                        <div key={k} className={`w-2.5 h-2.5 rounded-full ${getWorkflowDotColor(eng.workflows[k].status)}`} title={`${k}: ${eng.workflows[k].status}`} />
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={eng.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
