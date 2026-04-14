import React, { useMemo, useState } from 'react';
import type { Attraction, Company, DailySaleEntry, Engagement, Tour } from '@/data/constants';
import { CURRENT_USER, formatCurrency, formatDate } from '@/data/constants';
import { SearchInput, Modal, FormField, ActionMenu } from './Primitives';
import { Select2 } from './Select2';

interface Props {
  dailySales: DailySaleEntry[];
  onUpdateDailySales: (rows: DailySaleEntry[]) => void;
  engagements: Engagement[];
  tours: Tour[];
  attractions: Attraction[];
  companies: Company[];
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

function getEngagementContext(
  eng: Engagement | undefined,
  tours: Tour[],
  attractions: Attraction[],
  companies: Company[],
) {
  if (!eng) {
    return {
      attractionName: '—',
      venueName: '—',
      city: '—',
      state: '',
      showSummary: '—',
    };
  }
  const tour = tours.find(t => t.id === eng.tourId);
  const attraction = tour ? attractions.find(a => a.id === tour.attractionId) : undefined;
  const venue = companies.find(c => c.id === eng.venueId);
  const sd = eng.showDates[0];
  const showSummary = sd
    ? `${formatDate(sd.date)}${sd.showTime ? ` · ${sd.showTime}` : ''}`
    : '—';
  return {
    attractionName: attraction?.name ?? '—',
    venueName: venue?.name ?? '—',
    city: venue?.city ?? '—',
    state: venue?.state ?? '',
    showSummary,
  };
}

function formatSaleDateLong(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function DailySalesPage({
  dailySales,
  onUpdateDailySales,
  engagements,
  tours,
  attractions,
  companies,
  onNavigate,
  addToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [venueFilter, setVenueFilter] = useState('');
  const [attractionFilter, setAttractionFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const venueOptions = useMemo(() => {
    const venues = companies.filter(c => c.type === 'Venue');
    return [{ value: '', label: 'All venues' }, ...venues.map(v => ({ value: v.id, label: v.name }))];
  }, [companies]);

  const attractionOptions = useMemo(() => {
    return [{ value: '', label: 'All attractions' }, ...attractions.map(a => ({ value: a.id, label: a.name }))];
  }, [attractions]);

  const filtered = useMemo(() => {
    return dailySales.filter(row => {
      const eng = engagements.find(e => e.id === row.engagementId);
      if (!eng) return false;
      if (scope === 'mine' && eng.bookerId !== CURRENT_USER.id) return false;
      if (venueFilter && eng.venueId !== venueFilter) return false;
      if (attractionFilter) {
        const tour = tours.find(t => t.id === eng.tourId);
        if (!tour || tour.attractionId !== attractionFilter) return false;
      }
      const ctx = getEngagementContext(eng, tours, attractions, companies);
      const hay = `${eng.name} ${ctx.attractionName} ${ctx.venueName} ${ctx.city} ${row.saleDate} ${row.notes ?? ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [dailySales, engagements, tours, attractions, companies, scope, venueFilter, attractionFilter, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.saleDate < b.saleDate ? 1 : a.saleDate > b.saleDate ? -1 : 0)),
    [filtered],
  );

  const deleteRow = (id: string) => {
    onUpdateDailySales(dailySales.filter(r => r.id !== id));
    addToast('Sale entry removed', 'warning');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Daily Sales</h1>
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{sorted.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium w-full sm:w-auto shrink-0"
        >
          + Add Sales
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-x-4 lg:gap-y-0">
          <div className="space-y-1.5 lg:col-span-3">
            <label className="text-xs font-medium text-text-secondary block">Scope</label>
            <div className="inline-flex w-full sm:w-auto rounded-md border border-border p-0.5 bg-surface">
              <button
                type="button"
                onClick={() => setScope('mine')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  scope === 'mine' ? 'bg-ems-accent text-background shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                My events
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  scope === 'all' ? 'bg-ems-accent text-background shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All events
              </button>
            </div>
          </div>
          <div className="space-y-1.5 lg:col-span-4 min-w-0">
            <label className="text-xs font-medium text-text-secondary block">Search</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Engagement, attraction, venue, city, date…" />
          </div>
          <div className="space-y-1.5 lg:col-span-2 min-w-0">
            <label className="text-xs font-medium text-text-secondary block">Attraction</label>
            <Select2 options={attractionOptions} value={attractionFilter} onChange={setAttractionFilter} placeholder="All attractions" allowClear />
          </div>
          <div className="space-y-1.5 lg:col-span-3 min-w-0">
            <label className="text-xs font-medium text-text-secondary block">Venue</label>
            <Select2 options={venueOptions} value={venueFilter} onChange={setVenueFilter} placeholder="All venues" allowClear />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3 min-w-[220px]">Engagement</th>
              <th className="text-left py-2.5 px-3">Attraction</th>
              <th className="text-left py-2.5 px-3">Sale date</th>
              <th className="text-left py-2.5 px-3">Venue</th>
              <th className="text-left py-2.5 px-3">City</th>
              <th className="text-right py-2.5 px-3">Tickets sold</th>
              <th className="text-right py-2.5 px-3">Total revenue</th>
              <th className="text-left py-2.5 px-3 hidden lg:table-cell">Notes</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const eng = engagements.find(e => e.id === row.engagementId);
              const ctx = getEngagementContext(eng, tours, attractions, companies);
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-hover cursor-pointer"
                  onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                >
                  <td className="py-2.5 px-3 text-text-primary max-w-[280px] align-top">
                    <span className="line-clamp-2 font-medium leading-snug" title={eng?.name}>{eng?.name ?? '—'}</span>
                    {eng && (
                      <span className="block text-xs font-mono text-text-muted mt-1">{eng.id.toUpperCase()}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary max-w-[180px] align-top">
                    <span className="line-clamp-2 leading-snug">{ctx.attractionName}</span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap align-top">{formatSaleDateLong(row.saleDate)}</td>
                  <td className="py-2.5 px-3 text-text-secondary align-top">{ctx.venueName}</td>
                  <td className="py-2.5 px-3 text-text-secondary align-top">
                    {ctx.city}
                    {ctx.state ? `, ${ctx.state}` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-text-primary align-top">{row.ticketsSold.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-ems-green align-top">{formatCurrency(row.totalRevenue)}</td>
                  <td className="py-2.5 px-3 text-text-secondary max-w-[200px] truncate hidden lg:table-cell align-top">{row.notes || '—'}</td>
                  <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        {
                          label: 'Open engagement',
                          onClick: () => eng && onNavigate('engagement-detail', { engagementId: eng.id }),
                        },
                        { label: 'Delete', onClick: () => deleteRow(row.id), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-text-muted">No sales entries match your filters. Add one with &quot;+ Add Sales&quot;.</div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add sales" onClose={() => setShowAdd(false)} width={640}>
          <AddSalesForm
            engagements={engagements}
            tours={tours}
            attractions={attractions}
            companies={companies}
            onCancel={() => setShowAdd(false)}
            onSave={entry => {
              onUpdateDailySales([entry, ...dailySales]);
              setShowAdd(false);
              addToast('Sales entry added', 'success');
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function AddSalesForm({
  engagements,
  tours,
  attractions,
  companies,
  onSave,
  onCancel,
}: {
  engagements: Engagement[];
  tours: Tour[];
  attractions: Attraction[];
  companies: Company[];
  onSave: (row: DailySaleEntry) => void;
  onCancel: () => void;
}) {
  const [engagementId, setEngagementId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [ticketsSold, setTicketsSold] = useState('');
  const [totalRevenue, setTotalRevenue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const engagementOptions = useMemo(() => {
    return engagements.map(e => {
      const ctx = getEngagementContext(e, tours, attractions, companies);
      return {
        value: e.id,
        label: `${e.name} · ${ctx.attractionName} @ ${ctx.venueName}`,
      };
    });
  }, [engagements, tours, attractions, companies]);

  const selectedEng = engagements.find(e => e.id === engagementId);
  const ctx = getEngagementContext(selectedEng, tours, attractions, companies);

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const handleSubmit = () => {
    setError('');
    if (!engagementId) {
      setError('Select an engagement.');
      return;
    }
    const tickets = Number.parseInt(ticketsSold.replace(/,/g, ''), 10);
    const revenue = Number.parseFloat(totalRevenue.replace(/[$,\s]/g, ''));
    if (!saleDate) {
      setError('Choose a sale date.');
      return;
    }
    if (!Number.isFinite(tickets) || tickets < 0) {
      setError('Enter a valid tickets sold count.');
      return;
    }
    if (!Number.isFinite(revenue) || revenue < 0) {
      setError('Enter a valid total revenue.');
      return;
    }
    onSave({
      id: `ds-${Date.now()}`,
      engagementId,
      saleDate,
      ticketsSold: tickets,
      totalRevenue: revenue,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-ems-coral bg-ems-coral-dim/30 border border-ems-coral/20 rounded-md px-3 py-2">{error}</div>}

      <FormField label="Engagement" required>
        <Select2
          options={[{ value: '', label: 'Select engagement…' }, ...engagementOptions]}
          value={engagementId}
          onChange={setEngagementId}
          placeholder="Search engagement…"
        />
      </FormField>

      {selectedEng && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-elevated/50 p-3 text-sm">
          <div className="sm:col-span-2 pb-2 border-b border-border/60">
            <span className="text-text-muted text-xs block">Engagement</span>
            <span className="text-text-primary font-medium leading-snug">{selectedEng.name}</span>
            <span className="block text-xs font-mono text-text-muted mt-0.5">{selectedEng.id.toUpperCase()}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block">Attraction</span>
            <span className="text-text-primary font-medium">{ctx.attractionName}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block">Venue</span>
            <span className="text-text-primary font-medium">{ctx.venueName}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block">City</span>
            <span className="text-text-primary">{ctx.city}{ctx.state ? `, ${ctx.state}` : ''}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block">Show</span>
            <span className="text-text-secondary text-xs">{ctx.showSummary}</span>
          </div>
        </div>
      )}

      <FormField label="Sale date" required>
        <input className={inputCls} type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Tickets sold" required>
          <input
            className={inputCls}
            inputMode="numeric"
            value={ticketsSold}
            onChange={e => setTicketsSold(e.target.value)}
            placeholder="0"
          />
        </FormField>
        <FormField label="Total revenue" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
            <input
              className={`${inputCls} pl-7 font-mono`}
              inputMode="decimal"
              value={totalRevenue}
              onChange={e => setTotalRevenue(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </FormField>
      </div>

      <FormField label="Notes">
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional context for this entry…"
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" onClick={onCancel} className="text-text-secondary px-4 py-2 text-sm hover:text-text-primary">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} className="bg-ems-accent hover:bg-ems-accent/90 text-background px-5 py-2 rounded-md text-sm font-medium">
          Save sales
        </button>
      </div>
    </div>
  );
}
