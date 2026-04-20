/**
 * DailySalesPage
 *
 * Layout (matches screenshot):
 *   One row per Performance.
 *   Two grouped date columns: Yesterday | Today
 *   Each group: Tickets Sold + Revenue (always editable inputs)
 *   Save button per row — upserts both dates in one click.
 *   Performance Date filter + Search filter.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from './Primitives';
import { Select2 } from './Select2';
import {
  fetchDailySalesByPerformance,
  updateDailySales,
  type ApiPerformanceSalesRow,
} from '@/api/dailySalesApi';
import { friendlyApiError } from '@/lib/friendlyApiError';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  dailySales?: unknown; engagements?: unknown; tours?: unknown;
  attractions?: unknown; companies?: unknown; onUpdateDailySales?: unknown;
}

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null): string {
  if (n == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateHeader(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function validateField(val: string, field: 'tickets' | 'revenue'): string | null {
  if (val.trim() === '') return null; // empty = null = allowed
  const n = Number(val);
  if (isNaN(n) || n < 0) return `${field === 'tickets' ? 'Tickets' : 'Revenue'} must be a non-negative number.`;
  if (field === 'tickets' && !Number.isInteger(n)) return 'Tickets must be a whole number.';
  return null;
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-xl font-semibold text-text-primary mt-1">{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-center gap-3 px-6 py-8 border-b border-border bg-surface/40">
        <Loader2 className="h-8 w-8 text-ems-accent animate-spin" aria-hidden />
        <span className="text-sm font-medium text-text-primary">Loading performances…</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-border/40">
              {Array.from({ length: 7 }).map((__, j) => (
                <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-24 bg-muted/80" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Editable Performance Row ─────────────────────────────────────────────────

function PerformanceRow({
  row,
  onNavigate,
  onSaved,
  addToast,
}: {
  row: ApiPerformanceSalesRow;
  onNavigate: Props['onNavigate'];
  onSaved: () => void;
  addToast: Props['addToast'];
}) {
  // Today's values
  const [todayTickets, setTodayTickets] = useState(
    row.todayTicketsSold != null ? String(row.todayTicketsSold) : '',
  );
  const [todayRevenue, setTodayRevenue] = useState(
    row.todayRevenue != null ? String(row.todayRevenue) : '',
  );
  // Yesterday's values
  const [yestTickets, setYestTickets] = useState(
    row.yesterdayTicketsSold != null ? String(row.yesterdayTicketsSold) : '',
  );
  const [yestRevenue, setYestRevenue] = useState(
    row.yesterdayRevenue != null ? String(row.yesterdayRevenue) : '',
  );

  const [saving, setSaving] = useState(false);

  // Dirty check — show Save button highlighted if values changed from server
  const isDirty =
    todayTickets !== (row.todayTicketsSold != null ? String(row.todayTicketsSold) : '') ||
    todayRevenue !== (row.todayRevenue != null ? String(row.todayRevenue) : '') ||
    yestTickets !== (row.yesterdayTicketsSold != null ? String(row.yesterdayTicketsSold) : '') ||
    yestRevenue !== (row.yesterdayRevenue != null ? String(row.yesterdayRevenue) : '');

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Validate all four fields
    const errs = [
      validateField(todayTickets, 'tickets'),
      validateField(todayRevenue, 'revenue'),
      validateField(yestTickets, 'tickets'),
      validateField(yestRevenue, 'revenue'),
    ].filter(Boolean);

    if (errs.length > 0) {
      addToast(errs[0]!, 'warning');
      return;
    }

    setSaving(true);
    try {
      const tasks: Promise<void>[] = [];

      // Save today's entry
      tasks.push(
        updateDailySales(row.performanceId, row.todayDate, {
          ticketsSold: todayTickets.trim() === '' ? null : Number(todayTickets),
          revenue: todayRevenue.trim() === '' ? null : Number(todayRevenue),
        }),
      );

      // Save yesterday's entry
      tasks.push(
        updateDailySales(row.performanceId, row.yesterdayDate, {
          ticketsSold: yestTickets.trim() === '' ? null : Number(yestTickets),
          revenue: yestRevenue.trim() === '' ? null : Number(yestRevenue),
        }),
      );

      await Promise.all(tasks);
      addToast('Sales data saved successfully.', 'success');
      onSaved();
    } catch (err) {
      addToast(friendlyApiError(err, 'Could not save sales data.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-transparent border-0 border-b border-border text-sm tabular-nums text-right ' +
    'px-1 py-0.5 focus:outline-none focus:border-ems-accent focus:bg-elevated rounded-sm ' +
    'placeholder:text-text-muted text-text-primary transition-colors';

  const venueLine = row.venueName ?? row.venueCompanyName ?? '—';
  const cityLine = [row.city, row.stateProvince].filter(Boolean).join(', ');

  return (
    <tr
      className="border-b border-border/50 hover:bg-hover/40 group"
      style={{ cursor: 'default' }}
    >
      {/* Attraction */}
      <td
        className="py-2 px-3 cursor-pointer"
        onClick={() => onNavigate('engagement-detail', { engagementId: row.engagementId })}
      >
        <div className="text-text-primary font-medium text-sm leading-tight">
          {row.attractionName ?? <span className="text-text-muted italic text-xs">Unknown</span>}
        </div>
        {row.tourName && (
          <div className="text-xs text-text-muted leading-tight mt-0.5 truncate max-w-[14rem]">
            {row.tourName}
          </div>
        )}
      </td>

      {/* Performance Date + Time */}
      <td className="py-2 px-3 text-xs text-text-secondary whitespace-nowrap">
        <div>{fmtDateShort(row.performanceDate)}</div>
        <div className="text-text-muted">{formatTime12(row.performanceTime)}</div>
      </td>

      {/* Venue */}
      <td className="py-2 px-3 text-sm text-text-secondary">
        <div className="truncate max-w-[11rem]">{venueLine}</div>
        {cityLine && <div className="text-xs text-text-muted">{cityLine}</div>}
      </td>

      {/* ── Yesterday ─────────────────────────────────────────────────────── */}
      <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
        <input
          type="number"
          min={0}
          step={1}
          className={inputCls}
          value={yestTickets}
          onChange={e => setYestTickets(e.target.value)}
          placeholder="—"
          aria-label="Yesterday tickets sold"
        />
      </td>
      <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputCls + ' pl-4'}
            value={yestRevenue}
            onChange={e => setYestRevenue(e.target.value)}
            placeholder="—"
            aria-label="Yesterday revenue"
          />
        </div>
      </td>

      {/* ── Today ─────────────────────────────────────────────────────────── */}
      <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
        <input
          type="number"
          min={0}
          step={1}
          className={inputCls}
          value={todayTickets}
          onChange={e => setTodayTickets(e.target.value)}
          placeholder="—"
          aria-label="Today tickets sold"
        />
      </td>
      <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputCls + ' pl-4'}
            value={todayRevenue}
            onChange={e => setTodayRevenue(e.target.value)}
            placeholder="—"
            aria-label="Today revenue"
          />
        </div>
      </td>

      {/* Save button */}
      <td className="py-1.5 px-3" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={e => void handleSave(e)}
          disabled={saving}
          title="Save sales data for both dates"
          className={[
            'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium',
            'transition-all disabled:opacity-60 disabled:cursor-not-allowed',
            isDirty
              ? 'bg-ems-accent text-background hover:bg-ems-accent/80 shadow-sm'
              : 'bg-elevated text-text-secondary hover:bg-hover border border-border',
          ].join(' ')}
        >
          {saving
            ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Saving…</>
            : <><Save className="h-3 w-3" aria-hidden />Save</>}
        </button>
      </td>
    </tr>
  );
}

// ─── DailySalesPage ───────────────────────────────────────────────────────────

export function DailySalesPage({ onNavigate, addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [attractionFilter, setAttractionFilter] = useState('');
  const [perfDateFilter, setPerfDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const salesQuery = useQuery({
    queryKey: ['daily-sales-by-perf', perfDateFilter],
    queryFn: () => fetchDailySalesByPerformance(perfDateFilter || undefined),
    staleTime: 2 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['daily-sales-by-perf'] });
  }, [qc]);

  const rows = salesQuery.data ?? [];

  // Derive today/yesterday label from first row (same for all rows from server)
  const todayLabel   = rows[0]?.todayDate     ? fmtDateHeader(rows[0].todayDate)     : 'Today';
  const yesterdayLabel = rows[0]?.yesterdayDate ? fmtDateHeader(rows[0].yesterdayDate) : 'Yesterday';

  // Unique performance dates for filter
  const perfDateOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) if (r.performanceDate) seen.add(r.performanceDate);
    return [
      { value: '', label: 'All dates' },
      ...[...seen].sort().map(d => ({ value: d, label: fmtDateHeader(d) })),
    ];
  }, [rows]);

  // Unique attractions for filter
  const attractionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.attractionName) seen.set(r.attractionName, r.attractionName);
    return [
      { value: '', label: 'All attractions' },
      ...[...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => ({ value: v, label: l })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (attractionFilter && r.attractionName !== attractionFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [
        r.attractionName ?? '', r.tourName ?? '',
        r.venueCompanyName ?? '', r.venueName ?? '',
        r.city ?? '', r.performanceDate,
        String(r.engagementId),
      ].join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, attractionFilter]);

  // Summary stats from today's and yesterday's columns
  const totalTicketsToday = useMemo(() => filtered.reduce((s, r) => s + (r.todayTicketsSold ?? 0), 0), [filtered]);
  const totalRevenueToday = useMemo(() => filtered.reduce((s, r) => s + (r.todayRevenue ?? 0), 0), [filtered]);
  const totalTicketsYest  = useMemo(() => filtered.reduce((s, r) => s + (r.yesterdayTicketsSold ?? 0), 0), [filtered]);
  const totalRevenueYest  = useMemo(() => filtered.reduce((s, r) => s + (r.yesterdayRevenue ?? 0), 0), [filtered]);

  const pageCount   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount);
  const pageRows    = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  React.useEffect(() => { setPage(1); }, [search, attractionFilter, perfDateFilter]);

  const isLoading    = salesQuery.isPending;
  const isRefreshing = salesQuery.isFetching && !salesQuery.isPending;

  // Currency formatter
  const $ = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Refreshing bar */}
      {isRefreshing && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-text-primary">Daily Sales</h1>
        {!isLoading && (
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
            {filtered.length.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Error */}
      {salesQuery.isError && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
          Could not load performances: {friendlyApiError(salesQuery.error)}
        </div>
      )}

      {/* Summary cards — today vs yesterday */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label={`${todayLabel} — Tickets`}
            value={totalTicketsToday.toLocaleString()}
            sub="total tickets sold today"
          />
          <SummaryCard
            label={`${todayLabel} — Revenue`}
            value={$(totalRevenueToday)}
            sub="total revenue today"
          />
          <SummaryCard
            label={`${yesterdayLabel} — Tickets`}
            value={totalTicketsYest.toLocaleString()}
            sub="total tickets sold yesterday"
          />
          <SummaryCard
            label={`${yesterdayLabel} — Revenue`}
            value={$(totalRevenueYest)}
            sub="total revenue yesterday"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-56">
          <SearchInput value={search} onChange={setSearch} placeholder="Search…" disabled={isLoading} />
        </div>
        <div className="w-full sm:w-56">
          <Select2
            options={perfDateOptions}
            value={perfDateFilter}
            onChange={setPerfDateFilter}
            disabled={isLoading}
            placeholder="Performance date"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select2
            options={attractionOptions}
            value={attractionFilter}
            onChange={setAttractionFilter}
            disabled={isLoading}
            placeholder="All attractions"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? <TableSkeleton /> : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                {/* Row 1 — date group headers */}
                <tr className="text-xs border-b border-border bg-surface">
                  {/* Static columns */}
                  <th className="text-left py-2 px-3 text-text-muted" rowSpan={2}>Attraction</th>
                  <th className="text-left py-2 px-3 text-text-muted" rowSpan={2}>Date</th>
                  <th className="text-left py-2 px-3 text-text-muted" rowSpan={2}>Venue</th>

                  {/* Yesterday group */}
                  <th
                    colSpan={2}
                    className="text-center py-2 px-3 font-semibold text-text-secondary bg-elevated border-l border-border"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-text-muted/50 inline-block" />
                      {yesterdayLabel}
                    </span>
                  </th>

                  {/* Today group */}
                  <th
                    colSpan={2}
                    className="text-center py-2 px-3 font-semibold text-ems-accent bg-ems-accent/5 border-l border-border"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-ems-accent inline-block" />
                      {todayLabel}
                    </span>
                  </th>

                  {/* Save */}
                  <th className="py-2 px-3" rowSpan={2} />
                </tr>

                {/* Row 2 — sub-column headers */}
                <tr className="text-xs border-b border-border bg-surface">
                  <th className="text-right py-2 px-2 text-text-muted font-medium bg-elevated border-l border-border">
                    Tickets Sold
                  </th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium bg-elevated border-r border-border">
                    Revenue
                  </th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium bg-ems-accent/5 border-l border-border">
                    Tickets Sold
                  </th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium bg-ems-accent/5">
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 && !salesQuery.isError && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-text-muted">
                      {rows.length === 0
                        ? 'No performances in the database.'
                        : 'No performances match your filters.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <PerformanceRow
                    key={r.performanceId}
                    row={r}
                    onNavigate={onNavigate}
                    onSaved={refetch}
                    addToast={addToast}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)}
                </span>{' '}
                of <span className="text-text-primary font-medium">{filtered.length.toLocaleString()}</span> performances
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={pageClamped <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium"
                >
                  Previous
                </button>
                <span className="tabular-nums text-text-muted">Page {pageClamped} / {pageCount}</span>
                <button
                  disabled={pageClamped >= pageCount}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
