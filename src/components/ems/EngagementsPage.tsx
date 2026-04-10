import React, { useState } from 'react';
import { formatCurrency, getWorkflowDotColor } from '@/data/constants';
import { StatusBadge, SearchInput, FilterChips, ActionMenu } from './Primitives';
import { Select2, toOptions, toObjOptions } from './Select2';
import type { Engagement } from '@/data/constants';
import { Modal, FormField } from './Primitives';

// Full date with day of week
function formatEngDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  engagements: Engagement[];
  companies: { id: string; tradeName: string; city: string }[];
  users: { id: string; name: string }[];
  tours: { id: string; name: string }[];
  onNavigate: (view: string, data?: any) => void;
  statusFilter?: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreateEngagement: (engagement: Engagement) => void;
  onDeleteEngagement: (engagementId: string) => void;
}

export function EngagementsPage({ engagements, companies, users, tours, onNavigate, statusFilter: initFilter, addToast, onCreateEngagement, onDeleteEngagement }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initFilter || 'All');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = engagements.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && e.status !== statusFilter) return false;
    return true;
  });

  const workflowKeys = ['marketing', 'production', 'eventBusiness', 'creative', 'sales', 'finance'] as const;
  const workflowLabels = ['Marketing', 'Production', 'Event Business', 'Creative', 'Sales', 'Finance'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-text-primary">Engagements</h1>
        <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{filtered.length}</span>
        <button onClick={() => setShowCreate(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-3 py-1 rounded text-xs font-medium">+ Create</button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64"><SearchInput value={search} onChange={setSearch} /></div>
        <FilterChips options={['All', 'Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed', 'Cancelled']} active={statusFilter} onChange={setStatusFilter} />
      </div>
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
            <th className="text-left py-2.5 px-3">ID</th>
            <th className="text-left py-2.5 px-3">Engagement</th>
            <th className="text-left py-2.5 px-3">Show Date</th>
            <th className="text-left py-2.5 px-3">Venue</th>
            <th className="text-left py-2.5 px-3">Market</th>
            <th className="text-left py-2.5 px-3">Booker</th>
            <th className="text-right py-2.5 px-3">Proj. Gross</th>
            <th className="text-center py-2.5 px-3">Depts</th>
            <th className="text-left py-2.5 px-3">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map(eng => {
              const venue = companies.find(c => c.id === eng.venueId);
              const booker = users.find(u => u.id === eng.bookerId);
              return (
                <tr key={eng.id} onClick={() => onNavigate('engagement-detail', { engagementId: eng.id })}
                  className="border-b border-border/50 hover:bg-hover cursor-pointer">
                  <td className="py-2.5 px-3 font-mono text-xs text-text-muted">{eng.id.toUpperCase()}</td>
                  <td className="py-2.5 px-3 text-text-primary font-medium max-w-[250px] truncate">{eng.name}</td>
                  <td className="py-2.5 px-3 text-xs text-text-secondary whitespace-nowrap">{formatEngDate(eng.showDates[0]?.date)}{eng.showDates.length > 1 && <span className="ml-1 text-text-muted">+{eng.showDates.length - 1}</span>}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{venue?.tradeName}</td>
                  <td className="py-2.5 px-3 text-text-secondary text-xs">{venue?.city}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{booker?.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs">{formatCurrency(eng.projectedGross)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-1" title={workflowKeys.map((k, i) => `${workflowLabels[i]}: ${eng.workflows[k].status}`).join('\n')}>
                      {workflowKeys.map(k => (
                        <div key={k} className={`w-2.5 h-2.5 rounded-full ${getWorkflowDotColor(eng.workflows[k].status)}`} />
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={eng.status} /></td>
                  <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                    <ActionMenu items={[{ label: 'Delete', onClick: () => { onDeleteEngagement(eng.id); addToast('Engagement deleted', 'warning'); }, danger: true }]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCreate && (
        <Modal title="Create Engagement" onClose={() => setShowCreate(false)} width={600}>
          <CreateEngagementForm companies={companies} users={users} tours={tours} onSave={(eng) => { onCreateEngagement(eng); setShowCreate(false); addToast('Engagement created', 'success'); }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}

function CreateEngagementForm({ onSave, onCancel, companies, users, tours }: { onSave: (e: Engagement) => void; onCancel: () => void; companies: { id: string; tradeName: string }[]; users: { id: string; name: string }[]; tours: { id: string; name: string }[] }) {
  const [name, setName] = useState('');
  const [tourId, setTourId] = useState(tours[0]?.id || '');
  const [venueId, setVenueId] = useState(companies[0]?.id || '');
  const [bookerId, setBookerId] = useState(users[0]?.id || '');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('Draft');

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  return (
    <div className="space-y-3">
      <FormField label="Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Tour"><Select2 options={toObjOptions(tours, t => t.name)} value={tourId} onChange={setTourId} /></FormField>
        <FormField label="Venue"><Select2 options={toObjOptions(companies, c => c.tradeName)} value={venueId} onChange={setVenueId} /></FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Booker"><Select2 options={toObjOptions(users, u => u.name)} value={bookerId} onChange={setBookerId} /></FormField>
        <FormField label="Status"><Select2 options={toOptions(['Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed', 'Cancelled'])} value={status} onChange={setStatus} /></FormField>
      </div>
      <FormField label="Show Date">
        <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        {date && <div className="text-xs text-text-muted mt-1">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>}
      </FormField>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm">Cancel</button>
        <button onClick={() => onSave({
          id: `eng-${Date.now()}`,
          name: name || 'New Engagement',
          tourId, venueId, configName: 'Default', bookerId,
          projectId: 'manual', offerId: null,
          showDates: [{ date, doorTime: '19:00', showTime: '20:00', runtime: 120 }],
          showCount: 1, status,
          dealType: 'Guarantee', guarantee: 0, splitPct: null, breakeven: null,
          projectedGross: 0, projectedMargin: 0, actualGross: null, actualMargin: null,
          workflows: {
            marketing: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 5 },
            production: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 6 },
            eventBusiness: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 6 },
            creative: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 5 },
            sales: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 4 },
            finance: { status: 'NotStarted', assigneeId: bookerId, notes: '', milestonesComplete: 0, milestonesTotal: 5 },
          },
        })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Create</button>
      </div>
    </div>
  );
}
