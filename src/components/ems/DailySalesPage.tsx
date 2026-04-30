import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, ChevronLeft, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from './Primitives';
import { Select2 } from './Select2';
import {
  fetchDailySalesByPerformance,
  fetchDailySales,
  updateDailySales,
  type ApiPerformanceSalesRow,
  type ApiDailySalesRow,
} from '@/api/dailySalesApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { PAGE_SIZE, type PageSizeOption, isAllPageSize } from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  dailySales?: unknown; engagements?: unknown; tours?: unknown;
  attractions?: unknown; companies?: unknown; onUpdateDailySales?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDateHeader(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateFull(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmt12(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function validateField(val: string, field: 'tickets' | 'revenue'): string | null {
  if (!val.trim()) return null;
  const n = Number(val);
  if (isNaN(n) || n < 0) return `${field === 'tickets' ? 'Tickets' : 'Revenue'} must be non-negative.`;
  if (field === 'tickets' && !Number.isInteger(n)) return 'Tickets must be a whole number.';
  return null;
}

/** Local calendar YYYY-MM-DD (for default “as of” date). */
function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdAddDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Sits on the top-right of the daily sales datatable card. */
function ReportingAsOfBar({
  asOfDate,
  onAsOfDateChange,
  disabled,
}: {
  asOfDate: string;
  onAsOfDateChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 border-b border-border bg-surface/50 px-3 py-2.5 sm:px-4">
      <label htmlFor="daily-sales-asof" className="text-xs font-medium text-text-secondary whitespace-nowrap">
        Reporting as of
      </label>
      <input
        id="daily-sales-asof"
        type="date"
        className="h-9 w-[10.5rem] shrink-0 rounded-md border border-border bg-background px-2.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-ems-accent/30 focus:border-ems-accent disabled:opacity-50"
        value={asOfDate}
        onChange={(e) => onAsOfDateChange(e.target.value || todayLocalYmd())}
        disabled={disabled}
        aria-label="Select reporting date"
      />
    </div>
  );
}

// ─── Summary cards (two date columns: soft blue = prior day, soft teal = current) ─

function DailySummaryCard({
  dateStr,
  statLabel,
  value,
  sub,
  tone,
}: {
  dateStr: string;
  statLabel: string;
  value: string;
  sub?: string;
  tone: 'prior' | 'current';
}) {
  const shell =
    tone === 'prior'
      ? 'border-ems-blue/20 bg-ems-blue-dim/50 shadow-sm shadow-ems-blue/[0.06]'
      : 'border-ems-accent/25 bg-ems-accent-dim/60 shadow-sm shadow-ems-accent/[0.08]';
  const dateChip =
    tone === 'prior'
      ? 'bg-ems-blue/12 text-ems-blue ring-1 ring-ems-blue/15'
      : 'bg-ems-accent/12 text-ems-accent ring-1 ring-ems-accent/20';
  return (
    <div className={['rounded-xl border p-3.5 sm:p-4 transition-colors', shell].join(' ')}>
      <div className={['inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums', dateChip].join(' ')}>
        <span
          className={tone === 'prior' ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-ems-blue' : 'h-1.5 w-1.5 shrink-0 rounded-full bg-ems-accent'}
          aria-hidden
        />
        <span className="truncate">{dateStr}</span>
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted mt-2.5">{statLabel}</div>
      <div className="text-xl font-semibold text-text-primary mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

// ─── Reorderable lead columns (Attraction / Date / Venue) — same pattern as Engagements ─

const DAILY_SALES_LEAD_COLUMN_ORDER_KEY = 'iae-daily-sales-lead-column-order-v1';

type DailySalesLeadColumnId = 'attraction' | 'date' | 'venue';

const DEFAULT_DAILY_SALES_LEAD_COLUMNS: DailySalesLeadColumnId[] = [
  'attraction',
  'date',
  'venue',
];

const DAILY_SALES_LEAD_COLUMN_LABELS: Record<DailySalesLeadColumnId, string> = {
  attraction: 'Attraction',
  date: 'Date',
  venue: 'Venue',
};

function loadDailySalesLeadColumnOrder(): DailySalesLeadColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_DAILY_SALES_LEAD_COLUMNS;
  try {
    const raw = localStorage.getItem(DAILY_SALES_LEAD_COLUMN_ORDER_KEY);
    if (!raw) return DEFAULT_DAILY_SALES_LEAD_COLUMNS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_DAILY_SALES_LEAD_COLUMNS;
    const need = new Set<DailySalesLeadColumnId>(DEFAULT_DAILY_SALES_LEAD_COLUMNS);
    const out: DailySalesLeadColumnId[] = [];
    for (const x of parsed) {
      if (typeof x === 'string' && need.has(x as DailySalesLeadColumnId)) {
        out.push(x as DailySalesLeadColumnId);
        need.delete(x as DailySalesLeadColumnId);
      }
    }
    for (const id of DEFAULT_DAILY_SALES_LEAD_COLUMNS) {
      if (need.has(id)) {
        out.push(id);
        need.delete(id);
      }
    }
    return out;
  } catch {
    return DEFAULT_DAILY_SALES_LEAD_COLUMNS;
  }
}

function saveDailySalesLeadColumnOrder(order: DailySalesLeadColumnId[]) {
  try {
    localStorage.setItem(DAILY_SALES_LEAD_COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function renderDailySalesLeadCell(
  col: DailySalesLeadColumnId,
  row: ApiPerformanceSalesRow,
  onEngagementClick: (engagementId: number) => void,
) {
  switch (col) {
    case 'attraction':
      return (
        <td
          key={col}
          className="py-2 px-3 cursor-pointer"
          onClick={() => onEngagementClick(row.engagementId)}
        >
          <div className="text-text-primary font-medium text-sm leading-tight hover:text-ems-accent transition-colors">
            {row.attractionName ?? <span className="text-text-muted italic text-xs">Unknown</span>}
          </div>
          {row.tourName && (
            <div className="text-xs text-text-muted leading-tight mt-0.5 truncate max-w-[14rem]">{row.tourName}</div>
          )}
        </td>
      );
    case 'date':
      return (
        <td key={col} className="py-2 px-3 text-xs text-text-secondary whitespace-nowrap">
          <div>{fmtDateFull(row.performanceDate)}</div>
          <div className="text-text-muted">{fmt12(row.performanceTime)}</div>
        </td>
      );
    case 'venue':
      return (
        <td key={col} className="py-2 px-3 text-sm text-text-secondary">
          <div className="truncate max-w-[11rem]">{row.venueName ?? row.venueCompanyName ?? '—'}</div>
          {(row.city || row.stateProvince) && (
            <div className="text-xs text-text-muted">{[row.city, row.stateProvince].filter(Boolean).join(', ')}</div>
          )}
        </td>
      );
    default:
      return null;
  }
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────

function TableSkeleton({
  asOfDate,
  onAsOfDateChange,
}: {
  asOfDate: string;
  onAsOfDateChange: (next: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <ReportingAsOfBar asOfDate={asOfDate} onAsOfDateChange={onAsOfDateChange} />
      <div className="flex items-center gap-3 border-b border-border bg-surface/30 px-4 py-4 sm:px-6">
        <Loader2 className="h-6 w-6 text-ems-accent animate-spin" />
        <span className="text-sm font-medium text-text-primary">Loading…</span>
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
  leadColumnOrder,
  onEngagementClick,
  onSaved,
  addToast,
}: {
  row: ApiPerformanceSalesRow;
  leadColumnOrder: DailySalesLeadColumnId[];
  onEngagementClick: (engagementId: number) => void;
  onSaved: () => void;
  addToast: Props['addToast'];
}) {
  const [todayTickets, setTodayTickets] = useState(row.todayTicketsSold != null ? String(row.todayTicketsSold) : '');
  const [todayRevenue, setTodayRevenue] = useState(row.todayRevenue != null ? String(row.todayRevenue) : '');
  const [yestTickets, setYestTickets] = useState(row.yesterdayTicketsSold != null ? String(row.yesterdayTicketsSold) : '');
  const [yestRevenue, setYestRevenue] = useState(row.yesterdayRevenue != null ? String(row.yesterdayRevenue) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTodayTickets(row.todayTicketsSold != null ? String(row.todayTicketsSold) : '');
    setTodayRevenue(row.todayRevenue != null ? String(row.todayRevenue) : '');
    setYestTickets(row.yesterdayTicketsSold != null ? String(row.yesterdayTicketsSold) : '');
    setYestRevenue(row.yesterdayRevenue != null ? String(row.yesterdayRevenue) : '');
  }, [
    row.performanceId,
    row.todayDate,
    row.yesterdayDate,
    row.todayTicketsSold,
    row.todayRevenue,
    row.yesterdayTicketsSold,
    row.yesterdayRevenue,
  ]);

  const isDirty =
    todayTickets !== (row.todayTicketsSold != null ? String(row.todayTicketsSold) : '') ||
    todayRevenue !== (row.todayRevenue != null ? String(row.todayRevenue) : '') ||
    yestTickets !== (row.yesterdayTicketsSold != null ? String(row.yesterdayTicketsSold) : '') ||
    yestRevenue !== (row.yesterdayRevenue != null ? String(row.yesterdayRevenue) : '');

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const errs = [validateField(todayTickets, 'tickets'), validateField(todayRevenue, 'revenue'),
      validateField(yestTickets, 'tickets'), validateField(yestRevenue, 'revenue')].filter(Boolean);
    if (errs.length) { addToast(errs[0]!, 'warning'); return; }
    setSaving(true);
    try {
      await Promise.all([
        updateDailySales(row.performanceId, row.todayDate, {
          ticketsSold: todayTickets.trim() === '' ? null : Number(todayTickets),
          revenue: todayRevenue.trim() === '' ? null : Number(todayRevenue),
        }),
        updateDailySales(row.performanceId, row.yesterdayDate, {
          ticketsSold: yestTickets.trim() === '' ? null : Number(yestTickets),
          revenue: yestRevenue.trim() === '' ? null : Number(yestRevenue),
        }),
      ]);
      addToast('Saved.', 'success');
      onSaved();
    } catch (err) {
      addToast(friendlyApiError(err, 'Could not save.'), 'error');
    } finally { setSaving(false); }
  };

  const inputCls =
    'w-full bg-transparent border-0 border-b border-border text-sm tabular-nums text-right ' +
    'px-1 py-0.5 focus:outline-none focus:border-ems-accent focus:bg-elevated rounded-sm ' +
    'placeholder:text-text-muted text-text-primary transition-colors';

  return (
    <tr className="border-b border-border/50 hover:bg-hover/30 group">
      {leadColumnOrder.map((colId) =>
        renderDailySalesLeadCell(colId, row, onEngagementClick),
      )}

      {/* Prior day (soft blue) */}
      <td
        className="py-1.5 px-2 bg-ems-blue-dim/25 border-l border-ems-blue/10 align-middle"
        onClick={e => e.stopPropagation()}
      >
        <input type="number" min={0} step={1} className={inputCls}
          value={yestTickets} onChange={e => setYestTickets(e.target.value)} placeholder="—" />
      </td>
      <td
        className="py-1.5 px-2 bg-ems-blue-dim/25 border-r border-ems-blue/10 align-middle"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-ems-blue/60 text-xs pointer-events-none">$</span>
          <input type="number" min={0} step={0.01} className={inputCls + ' pl-4'}
            value={yestRevenue} onChange={e => setYestRevenue(e.target.value)} placeholder="—" />
        </div>
      </td>

      {/* Reporting day (soft teal) */}
      <td
        className="py-1.5 px-2 bg-ems-accent-dim/30 border-l border-ems-accent/15 align-middle"
        onClick={e => e.stopPropagation()}
      >
        <input type="number" min={0} step={1} className={inputCls}
          value={todayTickets} onChange={e => setTodayTickets(e.target.value)} placeholder="—" />
      </td>
      <td className="py-1.5 px-2 bg-ems-accent-dim/30 align-middle" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-ems-accent/60 text-xs pointer-events-none">$</span>
          <input type="number" min={0} step={0.01} className={inputCls + ' pl-4'}
            value={todayRevenue} onChange={e => setTodayRevenue(e.target.value)} placeholder="—" />
        </div>
      </td>

      {/* Save */}
      <td className="py-1.5 px-3" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={e => void handleSave(e)} disabled={saving}
          className={[
            'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-all disabled:opacity-60',
            isDirty ? 'bg-ems-accent text-background hover:bg-ems-accent/80 shadow-sm'
              : 'bg-elevated text-text-secondary hover:bg-hover border border-border',
          ].join(' ')}>
          {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</> : <><Save className="h-3 w-3" />Save</>}
        </button>
      </td>
    </tr>
  );
}

// ─── Engagement Sales History (Item 7) ────────────────────────────────────────

function EngagementSalesHistory({
  engagementId,
  attractionName,
  tourName,
  onBack,
}: {
  engagementId: number;
  attractionName: string | null;
  tourName: string | null;
  onBack: () => void;
}) {
  const historyQuery = useQuery({
    queryKey: ['daily-sales-history', engagementId],
    queryFn: () => fetchDailySales(engagementId),
    staleTime: 60_000,
  });

  const rows = historyQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button type="button" onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back to Daily Sales
      </button>

      {/* Title */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold text-text-primary">
          {attractionName ? (
            <>
              {attractionName}
              {tourName && <span className="text-text-muted font-normal"> — {tourName}</span>}
            </>
          ) : tourName ? (
            tourName
          ) : (
            'Sales history'
          )}
        </h2>
      </div>

      {/* History table */}
      {historyQuery.isPending ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-6">
          <Loader2 className="h-4 w-4 animate-spin text-ems-accent" /> Loading history…
        </div>
      ) : historyQuery.isError ? (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
          {friendlyApiError(historyQuery.error)}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-text-muted">
          No sales records found for this engagement.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border bg-surface">
                <th className="text-left py-2.5 px-3">Sales Date</th>
                <th className="text-left py-2.5 px-3">Performance Date</th>
                <th className="text-left py-2.5 px-3">Venue</th>
                <th className="text-right py-2.5 px-3">Tickets</th>
                <th className="text-right py-2.5 px-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => b.salesDate.localeCompare(a.salesDate))
                .map((r, i) => (
                  <tr key={`${r.performanceId}-${r.salesDate}-${i}`} className="border-b border-border/50 hover:bg-hover/30">
                    <td className="py-2.5 px-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                      {fmtDateHeader(r.salesDate)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary whitespace-nowrap">
                      {fmtDateFull(r.performanceDate)}
                      {r.performanceTime && <span className="text-text-muted ml-1">· {fmt12(r.performanceTime)}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs">
                      <div>{r.venueName ?? r.venueCompanyName ?? '—'}</div>
                      {(r.city || r.stateProvince) && (
                        <div className="text-text-muted">{[r.city, r.stateProvince].filter(Boolean).join(', ')}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-primary">
                      {r.ticketsSold != null ? r.ticketsSold.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ems-green font-medium">
                      {fmtCurrency(r.revenue)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DailySalesPage ───────────────────────────────────────────────────────────

export function DailySalesPage({ onNavigate: _onNavigate, addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [attractionFilter, setAttractionFilter] = useState('');
  /** YYYY-MM-DD — empty = all performance dates (within reporting as-of). */
  const [performanceDateFilter, setPerformanceDateFilter] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayLocalYmd);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE);
  const [leadColumnOrder, setLeadColumnOrder] = useState<DailySalesLeadColumnId[]>(loadDailySalesLeadColumnOrder);
  const [leadSort, setLeadSort] = useState<{
    col: DailySalesLeadColumnId;
    dir: 'asc' | 'desc';
  }>({ col: 'date', dir: 'asc' });

  const reorderLeadColumns = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setLeadColumnOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      saveDailySalesLeadColumnOrder(next);
      return next;
    });
  }, []);

  const toggleLeadSort = useCallback((col: DailySalesLeadColumnId) => {
    setLeadSort((s) => {
      if (s.col === col) return { col, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      return { col, dir: 'asc' };
    });
    setPage(1);
  }, []);

  // Item 7 — engagement click-through state
  const [selectedEngagement, setSelectedEngagement] = useState<{
    engagementId: number;
    attractionName: string | null;
    tourName: string | null;
  } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const dailySalesSortBy =
    leadSort.col === 'date'
      ? undefined
      : leadSort.col === 'attraction'
        ? 'attraction'
        : 'venue';

  const salesQuery = useQuery({
    queryKey: [
      'daily-sales-by-perf',
      asOfDate,
      page,
      pageSize,
      searchDebounced,
      attractionFilter,
      performanceDateFilter,
      leadSort.col,
      leadSort.dir,
    ],
    queryFn: () =>
      fetchDailySalesByPerformance(asOfDate, {
        page,
        pageSize,
        search: searchDebounced || undefined,
        attraction: attractionFilter || undefined,
        performanceDate: performanceDateFilter.trim() || undefined,
        sortBy: dailySalesSortBy,
        sortDir: leadSort.dir,
      }),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['daily-sales-by-perf'] });
  }, [qc]);

  const pageData = salesQuery.data;
  const rows = pageData?.items ?? [];
  const serverTotal = pageData?.total ?? 0;
  const todayDateStr = pageData?.todayDate ?? asOfDate;
  const yesterdayDateStr = pageData?.yesterdayDate ?? ymdAddDays(asOfDate, -1);
  const todayLabel = fmtDateHeader(todayDateStr);
  const yesterdayLabel = fmtDateHeader(yesterdayDateStr);
  const asOfIsLocalToday = asOfDate === todayLocalYmd();
  const labelCurShort = asOfIsLocalToday ? 'today' : 'selected day';
  const labelPriorShort = asOfIsLocalToday ? 'yesterday' : 'prior day';
  const attractionOptions = useMemo(() => {
    const names = pageData?.attractionNames ?? [];
    return [
      { value: '', label: 'All attractions' },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  }, [pageData?.attractionNames]);

  const totalTicketsToday = pageData?.summary.todayTickets ?? 0;
  const totalRevenueToday = pageData?.summary.todayRevenue ?? 0;
  const totalTicketsYest = pageData?.summary.yesterdayTickets ?? 0;
  const totalRevenueYest = pageData?.summary.yesterdayRevenue ?? 0;

  const pageCount = isAllPageSize(pageSize)
    ? 1
    : Math.max(1, Math.ceil(serverTotal / pageSize));
  const pageClamped = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, attractionFilter, asOfDate, performanceDateFilter, leadSort.col, leadSort.dir]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (serverTotal > 0 && page > pageCount) setPage(pageCount);
  }, [serverTotal, page, pageCount]);

  const showFullSkeleton = salesQuery.isPending && !salesQuery.data;
  const showTableOverlay = salesQuery.isFetching && !!salesQuery.data;
  const isRefreshing = salesQuery.isFetching && !showFullSkeleton;
  const $fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // ── Item 7: show engagement history if one is selected ──────────────────────
  if (selectedEngagement) {
    return (
      <EngagementSalesHistory
        engagementId={selectedEngagement.engagementId}
        attractionName={selectedEngagement.attractionName}
        tourName={selectedEngagement.tourName}
        onBack={() => setSelectedEngagement(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {isRefreshing && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-text-primary">Daily Sales</h1>
        {!showFullSkeleton && (
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
            {serverTotal.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Error */}
      {salesQuery.isError && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
          {friendlyApiError(salesQuery.error)}
        </div>
      )}

      {/* Summary */}
      {!showFullSkeleton && serverTotal > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DailySummaryCard
            dateStr={yesterdayLabel}
            statLabel="Tickets"
            value={totalTicketsYest.toLocaleString()}
            sub={labelPriorShort}
            tone="prior"
          />
          <DailySummaryCard
            dateStr={yesterdayLabel}
            statLabel="Revenue"
            value={$fmt(totalRevenueYest)}
            sub={labelPriorShort}
            tone="prior"
          />
          <DailySummaryCard
            dateStr={todayLabel}
            statLabel="Tickets"
            value={totalTicketsToday.toLocaleString()}
            sub={labelCurShort}
            tone="current"
          />
          <DailySummaryCard
            dateStr={todayLabel}
            statLabel="Revenue"
            value={$fmt(totalRevenueToday)}
            sub={labelCurShort}
            tone="current"
          />
        </div>
      )}

      {/* Search + Attraction + Performance date */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:flex-1 sm:max-w-md">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Search</label>
          <SearchInput value={search} onChange={setSearch} placeholder="Search…" disabled={showFullSkeleton} />
        </div>
        <div className="w-full min-w-0 sm:w-56 sm:min-w-[14rem]">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Attraction</label>
          <Select2
            options={attractionOptions}
            value={attractionFilter}
            onChange={setAttractionFilter}
            disabled={showFullSkeleton}
            placeholder="All attractions"
          />
        </div>
        <div className="w-full min-w-0 sm:w-[11.5rem]">
          <label
            htmlFor="daily-sales-perf-date"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Performance date
          </label>
          <input
            id="daily-sales-perf-date"
            type="date"
            className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-ems-accent/30 focus:border-ems-accent disabled:opacity-50"
            value={performanceDateFilter}
            onChange={(e) => setPerformanceDateFilter(e.target.value)}
            disabled={showFullSkeleton}
          />
        </div>
      </div>

      {/* Table (Reporting as of: top right of this card) */}
      {showFullSkeleton ? (
        <TableSkeleton asOfDate={asOfDate} onAsOfDateChange={setAsOfDate} />
      ) : (
        <>
          <div className="relative overflow-hidden rounded-lg border border-border bg-card">
            {showTableOverlay && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy
              >
                <Loader2 className="h-8 w-8 text-ems-accent animate-spin" />
              </div>
            )}
            <ReportingAsOfBar asOfDate={asOfDate} onAsOfDateChange={setAsOfDate} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="text-xs border-b border-border">
                  {leadColumnOrder.map((colId, colIndex) => (
                    <th
                      key={colId}
                      scope="col"
                      rowSpan={2}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(colIndex));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        if (Number.isNaN(from)) return;
                        reorderLeadColumns(from, colIndex);
                      }}
                      className="text-left py-2.5 px-3 text-text-muted align-bottom bg-surface/90 select-none cursor-grab active:cursor-grabbing min-w-0"
                      title="Drag to move column"
                    >
                      <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                        <GripVertical
                          className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-70"
                          aria-hidden
                        />
                        <button
                          type="button"
                          className="truncate inline-flex items-center gap-1 text-left font-medium text-text-muted hover:text-text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLeadSort(colId);
                          }}
                        >
                          {DAILY_SALES_LEAD_COLUMN_LABELS[colId]}
                          {leadSort.col === colId &&
                            (leadSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 shrink-0 text-ems-accent" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 shrink-0 text-ems-accent" aria-hidden />
                            ))}
                        </button>
                      </span>
                    </th>
                  ))}
                  <th
                    colSpan={2}
                    className="text-center py-2.5 px-3 font-semibold bg-ems-blue-dim/80 border-l border-ems-blue/20"
                  >
                    <span className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-0.5 text-ems-blue">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-ems-blue shadow-sm shadow-ems-blue/30" />
                      <span className="tabular-nums">{yesterdayLabel}</span>
                    </span>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-ems-blue/80 mt-1.5">Prior day</div>
                  </th>
                  <th
                    colSpan={2}
                    className="text-center py-2.5 px-3 font-semibold bg-ems-accent-dim/80 border-l border-ems-accent/25"
                  >
                    <span className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-0.5 text-ems-accent">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-ems-accent shadow-sm shadow-ems-accent/30" />
                      <span className="tabular-nums">{todayLabel}</span>
                    </span>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-ems-accent/80 mt-1.5">Reporting day</div>
                  </th>
                  <th className="py-2 px-3 align-bottom bg-surface/90" rowSpan={2} />
                </tr>
                <tr className="text-xs border-b border-border">
                  <th className="text-right py-2 px-2 font-medium text-text-secondary bg-ems-blue-dim/40 border-l border-ems-blue/15">
                    Tickets
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-text-secondary bg-ems-blue-dim/40 border-r border-ems-blue/10">
                    Revenue
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-text-secondary bg-ems-accent-dim/50 border-l border-ems-accent/20">
                    Tickets
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-text-secondary bg-ems-accent-dim/50">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {serverTotal === 0 && !salesQuery.isError && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-text-muted">
                      No performances for this reporting date, or none match your search, attraction, or performance date filter.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <PerformanceRow
                    key={`${r.performanceId}-${r.todayDate}`}
                    row={r}
                    leadColumnOrder={leadColumnOrder}
                    onEngagementClick={(id) => setSelectedEngagement({
                      engagementId: id,
                      attractionName: r.attractionName,
                      tourName: r.tourName,
                    })}
                    onSaved={refetch}
                    addToast={addToast}
                  />
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {serverTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                <span>
                  Showing{' '}
                  <span className="text-text-primary font-medium">
                    {isAllPageSize(pageSize)
                      ? `1–${serverTotal}`
                      : `${(pageClamped - 1) * pageSize + 1}–${Math.min(pageClamped * pageSize, serverTotal)}`}
                  </span>{' '}
                  of <span className="text-text-primary font-medium">{serverTotal.toLocaleString()}</span> performances
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-1.5 text-text-secondary">
                  <span aria-hidden>·</span>
                  <PageSizeSelect
                    value={pageSize}
                    onChange={setPageSize}
                    disabled={salesQuery.isFetching}
                  />
                  <span>per page</span>
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button disabled={pageClamped <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium">Previous</button>
                <span className="tabular-nums text-text-muted">Page {pageClamped} / {pageCount}</span>
                <button disabled={pageClamped >= pageCount} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium">Next</button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
