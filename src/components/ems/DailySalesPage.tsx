import React, { useMemo, useState, useCallback } from 'react';
import type { Attraction, Company, DailySaleEntry, Engagement, Tour } from '@/data/constants';
import { CURRENT_USER, formatCurrency, formatDate } from '@/data/constants';
import { SearchInput, ActionMenu } from './Primitives';
import { Select2 } from './Select2';
import { Loader2, Check, Pencil } from 'lucide-react';

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

interface RowEditState {
  ticketsSold: string;
  totalRevenue: string;
  isDirty: boolean;
  isSaving: boolean;
  savedRowId: string | null;
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

/** Parse and validate a tickets-sold string. Returns the number or null if invalid. */
function parseTickets(raw: string): number | null {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Parse and validate a revenue string. Returns the number or null if invalid. */
function parseRevenue(raw: string): number | null {
  const n = parseFloat(raw.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
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

  // Per-row edit state keyed by DailySaleEntry id
  const [rowEdits, setRowEdits] = useState<Record<string, RowEditState>>({});
  // Briefly highlight a row after successful save
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

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
      const hay = `${eng.name} ${ctx.attractionName} ${ctx.venueName} ${ctx.city} ${row.saleDate}`.toLowerCase();
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

  // Initialise edit state for a row (from committed values) if not already present
  const getOrInitRowEdit = useCallback(
    (row: DailySaleEntry): RowEditState => {
      if (rowEdits[row.id]) return rowEdits[row.id];
      return {
        ticketsSold: String(row.ticketsSold),
        totalRevenue: String(row.totalRevenue),
        isDirty: false,
        isSaving: false,
        savedRowId: null,
      };
    },
    [rowEdits],
  );

  const setField = useCallback(
    (rowId: string, field: 'ticketsSold' | 'totalRevenue', value: string, row: DailySaleEntry) => {
      setRowEdits(prev => {
        const base = prev[rowId] ?? {
          ticketsSold: String(row.ticketsSold),
          totalRevenue: String(row.totalRevenue),
          isDirty: false,
          isSaving: false,
          savedRowId: null,
        };
        const next = { ...base, [field]: value, isDirty: true };
        return { ...prev, [rowId]: next };
      });
    },
    [],
  );

  const handleSaveRow = useCallback(
    (row: DailySaleEntry) => {
      const edit = rowEdits[row.id];
      if (!edit) return;

      const tickets = parseTickets(edit.ticketsSold);
      if (tickets === null) {
        addToast('Tickets sold must be a valid non-negative whole number.', 'error');
        return;
      }
      const revenue = parseRevenue(edit.totalRevenue);
      if (revenue === null) {
        addToast('Total revenue must be a valid non-negative number.', 'error');
        return;
      }

      // Mark as saving
      setRowEdits(prev => ({
        ...prev,
        [row.id]: { ...prev[row.id], isSaving: true },
      }));

      // Simulate async save (replace with real API call if needed)
      setTimeout(() => {
        onUpdateDailySales(
          dailySales.map(r =>
            r.id === row.id ? { ...r, ticketsSold: tickets, totalRevenue: revenue } : r,
          ),
        );
        setRowEdits(prev => ({
          ...prev,
          [row.id]: { ...prev[row.id], isDirty: false, isSaving: false },
        }));
        setSavedRowId(row.id);
        setTimeout(() => setSavedRowId(prev => (prev === row.id ? null : prev)), 2000);
        addToast('Row saved successfully.', 'success');
      }, 350);
    },
    [rowEdits, dailySales, onUpdateDailySales, addToast],
  );

  const inputCls =
    'w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary font-mono focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/30 transition-colors';

  const editableInputCls =
    'w-full bg-surface/50 border border-border/60 rounded px-2 py-1 text-sm font-mono text-text-primary ' +
    'hover:border-ems-accent/60 hover:bg-surface focus:outline-none focus:border-ems-accent focus:bg-surface focus:ring-2 focus:ring-ems-accent/20 ' +
    'transition-all duration-150 cursor-text shadow-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Daily Sales</h1>
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{sorted.length}</span>
        </div>
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

      {/* Editing legend */}
      <div className="flex items-center gap-2 text-xs text-text-muted bg-elevated/50 px-3 py-2 rounded-md border border-border/50">
        <Pencil className="h-3.5 w-3.5 shrink-0 text-ems-accent" />
        <span><span className="font-medium text-text-secondary">Click any value</span> in Tickets Sold or Total Revenue to edit, then press Save.</span>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3 min-w-[220px]">Engagement</th>
              <th className="text-left py-2.5 px-3">Attraction</th>
              <th className="text-left py-2.5 px-3">Sale date</th>
              <th className="text-left py-2.5 px-3">Venue</th>
              <th className="text-left py-2.5 px-3">City</th>
              <th className="text-right py-2.5 px-3 min-w-[140px]">
                <span className="flex items-center justify-end gap-1.5">
                  <Pencil className="h-3 w-3 text-ems-accent" />
                  Tickets sold
                </span>
              </th>
              <th className="text-right py-2.5 px-3 min-w-[160px]">
                <span className="flex items-center justify-end gap-1.5">
                  <Pencil className="h-3 w-3 text-ems-accent" />
                  Total revenue
                </span>
              </th>
              <th className="py-2.5 px-3 w-24 text-center">Save</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const eng = engagements.find(e => e.id === row.engagementId);
              const ctx = getEngagementContext(eng, tours, attractions, companies);
              const edit = getOrInitRowEdit(row);
              const isSaving = edit.isSaving;
              const isDirty = edit.isDirty;
              const isJustSaved = savedRowId === row.id;

              const ticketsError = edit.isDirty && parseTickets(edit.ticketsSold) === null;
              const revenueError = edit.isDirty && parseRevenue(edit.totalRevenue) === null;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-border/50 transition-colors ${
                    isJustSaved
                      ? 'bg-ems-green-dim/40'
                      : isDirty
                      ? 'bg-ems-accent-dim/20'
                      : 'hover:bg-hover'
                  }`}
                >
                  {/* Engagement */}
                  <td
                    className="py-2.5 px-3 text-text-primary max-w-[280px] align-middle cursor-pointer"
                    onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                  >
                    <span className="line-clamp-2 font-medium leading-snug" title={eng?.name}>{eng?.name ?? '—'}</span>
                    {eng && (
                      <span className="block text-xs font-mono text-text-muted mt-1">{eng.id.toUpperCase()}</span>
                    )}
                  </td>

                  {/* Attraction */}
                  <td
                    className="py-2.5 px-3 text-text-secondary max-w-[180px] align-middle cursor-pointer"
                    onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                  >
                    <span className="line-clamp-2 leading-snug">{ctx.attractionName}</span>
                  </td>

                  {/* Sale date */}
                  <td
                    className="py-2.5 px-3 text-text-secondary whitespace-nowrap align-middle cursor-pointer"
                    onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                  >
                    {formatSaleDateLong(row.saleDate)}
                  </td>

                  {/* Venue */}
                  <td
                    className="py-2.5 px-3 text-text-secondary align-middle cursor-pointer"
                    onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                  >
                    {ctx.venueName}
                  </td>

                  {/* City */}
                  <td
                    className="py-2.5 px-3 text-text-secondary align-middle cursor-pointer"
                    onClick={() => eng && onNavigate('engagement-detail', { engagementId: eng.id })}
                  >
                    {ctx.city}{ctx.state ? `, ${ctx.state}` : ''}
                  </td>

                  {/* Tickets Sold – editable */}
                  <td className="py-1.5 px-3 align-middle">
                    <div className="flex flex-col items-end gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={edit.ticketsSold}
                        disabled={isSaving}
                        title="Click to edit tickets sold"
                        onChange={e => setField(row.id, 'ticketsSold', e.target.value, row)}
                        className={`${editableInputCls} text-right max-w-[100px] ${
                          ticketsError
                            ? 'border-ems-coral/60 bg-ems-coral-dim/30 focus:border-ems-coral focus:ring-ems-coral/20'
                            : isDirty
                            ? 'border-ems-accent/40 bg-ems-accent-dim/20'
                            : ''
                        }`}
                      />
                      {ticketsError && (
                        <span className="text-[10px] text-ems-coral leading-none">Invalid number</span>
                      )}
                    </div>
                  </td>

                  {/* Total Revenue – editable */}
                  <td className="py-1.5 px-3 align-middle">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="relative max-w-[120px]">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={edit.totalRevenue}
                          disabled={isSaving}
                          title="Click to edit total revenue"
                          onChange={e => setField(row.id, 'totalRevenue', e.target.value, row)}
                          className={`${editableInputCls} text-right pl-5 w-full ${
                            revenueError
                              ? 'border-ems-coral/60 bg-ems-coral-dim/30 focus:border-ems-coral focus:ring-ems-coral/20'
                              : isDirty
                              ? 'border-ems-accent/40 bg-ems-accent-dim/20'
                              : ''
                          }`}
                        />
                      </div>
                      {revenueError && (
                        <span className="text-[10px] text-ems-coral leading-none">Invalid amount</span>
                      )}
                    </div>
                  </td>

                  {/* Save button */}
                  <td className="py-1.5 px-3 text-center align-middle">
                    {isJustSaved && !isDirty ? (
                      <span className="inline-flex items-center gap-1 text-ems-green text-xs font-medium">
                        <Check className="h-3.5 w-3.5" />
                        Saved
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!isDirty || isSaving || ticketsError || revenueError}
                        onClick={() => handleSaveRow(row)}
                        title={!isDirty ? 'No changes to save' : 'Save this row'}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          isDirty && !ticketsError && !revenueError
                            ? 'bg-ems-accent hover:bg-ems-accent/80 text-background shadow-sm'
                            : 'bg-elevated text-text-muted cursor-not-allowed opacity-50'
                        }`}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    )}
                  </td>

                  {/* Action menu */}
                  <td className="py-2.5 px-3 text-right align-middle" onClick={e => e.stopPropagation()}>
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
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            No sales entries match your filters.
          </div>
        )}
      </div>

    </div>
  );
}