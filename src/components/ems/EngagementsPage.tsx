import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  List,
  LayoutGrid,
  ImageIcon,
} from 'lucide-react';
import {
  SearchInput,
  FilterChips,
  Modal,
  FormField,
  StatusBadge,
} from './Primitives';
import { Select2, toOptions } from './Select2';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createEngagement,
  updateEngagement,
  fetchEngagementsPaged,
  engagementsPagedQueryKey,
  fetchEngagementFilterOptions,
  type ApiEngagementListRow,
  type EngagementPagedQueryOpts,
} from '@/api/engagementApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import { fetchCompanies } from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { formatFirstShowLine } from '@/lib/engagementDisplay';
import {
  getPageParams,
  getTotalPages,
  getPageRange,
  PAGE_SIZE,
  type PageSizeOption,
  isAllPageSize,
} from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  statusFilter?: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type EngagementsViewMode = 'list' | 'tiles';
const ENGAGEMENTS_VIEW_MODE_STORAGE_KEY = 'iae-engagements-view-mode-v1';

const ENGAGEMENT_MOVABLE_COLUMN_ORDER_KEY = 'iae-engagements-movable-column-order-v1';
const LEGACY_ENGAGEMENT_TABLE_COLUMN_ORDER_KEY = 'iae-engagements-table-column-order-v2';

type EngagementMovableColumnId =
  | 'attraction'
  | 'tour'
  | 'venue'
  | 'market'
  | 'date';

type EngagementTableColumnId = EngagementMovableColumnId | 'status';

const DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS: EngagementMovableColumnId[] = [
  'attraction',
  'tour',
  'venue',
  'market',
  'date',
];

const ENGAGEMENT_COLUMN_LABELS: Record<EngagementTableColumnId, string> = {
  attraction: 'Attraction',
  tour: 'Tour',
  venue: 'Venue',
  market: 'Market',
  date: 'Date',
  status: 'Status',
};

const SORT_API_BY_MOVABLE: Record<EngagementMovableColumnId, string> = {
  attraction: 'attraction',
  tour: 'tour',
  venue: 'venue',
  market: 'market',
  date: 'date',
};

function loadEngagementMovableColumnOrder(): EngagementMovableColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS;
  try {
    const raw = localStorage.getItem(ENGAGEMENT_MOVABLE_COLUMN_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const need = new Set<EngagementMovableColumnId>(DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS);
        const out: EngagementMovableColumnId[] = [];
        for (const x of parsed) {
          if (typeof x === 'string' && need.has(x as EngagementMovableColumnId)) {
            out.push(x as EngagementMovableColumnId);
            need.delete(x as EngagementMovableColumnId);
          }
        }
        for (const id of DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS) {
          if (need.has(id)) {
            out.push(id);
            need.delete(id);
          }
        }
        return out;
      }
    }
    const leg = localStorage.getItem(LEGACY_ENGAGEMENT_TABLE_COLUMN_ORDER_KEY);
    if (leg) {
      const parsed = JSON.parse(leg) as unknown;
      if (Array.isArray(parsed)) {
        const need = new Set<EngagementMovableColumnId>(DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS);
        const out: EngagementMovableColumnId[] = [];
        for (const x of parsed) {
          if (typeof x === 'string' && x !== 'status' && need.has(x as EngagementMovableColumnId)) {
            out.push(x as EngagementMovableColumnId);
            need.delete(x as EngagementMovableColumnId);
          }
        }
        for (const id of DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS) {
          if (need.has(id)) {
            out.push(id);
            need.delete(id);
          }
        }
        return out;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ENGAGEMENT_MOVABLE_COLUMNS;
}

function saveEngagementMovableColumnOrder(order: EngagementMovableColumnId[]) {
  try {
    localStorage.setItem(ENGAGEMENT_MOVABLE_COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function loadEngagementsViewMode(): EngagementsViewMode {
  if (typeof window === 'undefined') return 'list';
  try {
    const raw = localStorage.getItem(ENGAGEMENTS_VIEW_MODE_STORAGE_KEY);
    return raw === 'list' || raw === 'tiles' ? raw : 'list';
  } catch {
    return 'list';
  }
}

function saveEngagementsViewMode(mode: EngagementsViewMode) {
  try {
    localStorage.setItem(ENGAGEMENTS_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'TR';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function engagementTileImageUrl(r: ApiEngagementListRow): string | null {
  const u = r.tourBannerImageUrl?.trim();
  return u || null;
}

function EngagementTileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-xs text-text-primary truncate mt-0.5" title={value}>
        {value}
      </p>
    </div>
  );
}

function renderEngagementTableCell(
  col: EngagementTableColumnId,
  r: ApiEngagementListRow,
) {
  switch (col) {
    case 'attraction':
      return (
        <td key={col} className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">
          {r.attractionName ?? '—'}
        </td>
      );
    case 'tour':
      return (
        <td key={col} className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">
          {r.tourName ?? '—'}
        </td>
      );
    case 'venue':
      return (
        <td
          key={col}
          className="py-2.5 px-3 text-text-secondary min-w-0 truncate"
          title={r.venueCompanyName ?? r.venueName ?? '—'}
        >
          {r.venueCompanyName ?? r.venueName ?? '—'}
        </td>
      );
    case 'market':
      return (
        <td key={col} className="py-2.5 px-3 text-xs text-text-secondary max-w-[140px] truncate">
          {r.dmaMarketName ?? '—'}
        </td>
      );
    case 'date':
      return (
        <td
          key={col}
          className="py-2.5 px-3 text-text-secondary text-xs min-w-0 truncate"
          title={formatFirstShowLine(r.openingPerformanceDate, r.openingPerformanceTime)}
        >
          {formatFirstShowLine(r.openingPerformanceDate, r.openingPerformanceTime)}
        </td>
      );
    case 'status':
      return (
        <td key={col} className="py-2.5 px-3">
          <StatusBadge status={r.engagementStatus} />
        </td>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function EngagementsTableSkeleton({ rowCount = PAGE_SIZE }: { rowCount?: number }) {
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden min-h-[28rem]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-border bg-surface/40">
        <Loader2 className="h-11 w-11 text-ems-accent animate-spin shrink-0" aria-hidden />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-sm font-semibold text-text-primary">Loading engagements</p>
          <p className="text-xs text-text-muted leading-relaxed">
            This may take a moment on large lists.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="w-full table-fixed text-sm min-w-[880px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="text-left py-2.5 px-3 min-w-0">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="py-2.5 px-3">
                    <Skeleton className="h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EngagementsTilesSkeleton({ tileCount = 6 }: { tileCount?: number }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 min-h-[28rem]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 py-8 border-b border-border bg-surface/40 mb-4">
        <Loader2 className="h-9 w-9 text-ems-accent animate-spin shrink-0" aria-hidden />
        <p className="text-sm font-semibold text-text-primary">Loading engagements</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: tileCount }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function EngagementsPage({ onNavigate, statusFilter: initFilter, addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState(initFilter || 'All');
  const [attractionFilter, setAttractionFilter] = useState('');
  const [dmaFilter, setDmaFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [timingFilter, setTimingFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE);
  const [showCreate, setShowCreate] = useState(false);
  const [movableColumnOrder, setMovableColumnOrder] = useState<EngagementMovableColumnId[]>(
    loadEngagementMovableColumnOrder,
  );
  const [sortState, setSortState] = useState<{
    col: EngagementMovableColumnId | null;
    dir: 'asc' | 'desc';
  }>({ col: null, dir: 'asc' });
  const [viewMode, setViewMode] = useState<EngagementsViewMode>(loadEngagementsViewMode);

  const visualSlots = useMemo(
    () => [...movableColumnOrder, 'status'] as const satisfies readonly EngagementTableColumnId[],
    [movableColumnOrder],
  );

  const reorderMovableColumns = useCallback((fromM: number, toM: number) => {
    if (fromM === toM || fromM < 0 || toM < 0) return;
    setMovableColumnOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromM, 1);
      next.splice(toM, 0, moved);
      saveEngagementMovableColumnOrder(next);
      return next;
    });
  }, []);

  const toggleColumnSort = useCallback((col: EngagementMovableColumnId) => {
    setSortState((s) => {
      if (s.col === col) return { col, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      return { col, dir: 'asc' };
    });
    setPage(1);
  }, []);

  useEffect(() => {
    if (initFilter) setStatusFilter(initFilter);
  }, [initFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { offset, limit } = getPageParams(page, pageSize);

  const pagedOpts: EngagementPagedQueryOpts = {
    q: searchDebounced || undefined,
    status: statusFilter !== 'All' ? statusFilter : undefined,
    attraction: attractionFilter || undefined,
    dma: dmaFilter || undefined,
    venue: venueFilter || undefined,
    timing: timingFilter,
    sortBy: sortState.col ? SORT_API_BY_MOVABLE[sortState.col] : undefined,
    sortDir: sortState.col ? sortState.dir : undefined,
  };

  const engagementsPagedQuery = useQuery({
    queryKey: engagementsPagedQueryKey(offset, limit, pagedOpts),
    queryFn: () => fetchEngagementsPaged(offset, limit, pagedOpts),
    placeholderData: (prev) => prev,
    retry: 2,
  });

  const filterOptsQuery = useQuery({
    queryKey: ['engagements', 'filter-options'],
    queryFn: fetchEngagementFilterOptions,
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const lookupsQuery = useQuery({
    queryKey: ['engagements-lookups'],
    queryFn: async () => {
      const lookupLimit = 10000;
      const [attractions, tours, companies] = await Promise.all([
        fetchAttractions(0, lookupLimit),
        fetchTours(0, lookupLimit),
        fetchCompanies(0, lookupLimit),
      ]);
      return {
        attractions: attractions.data ?? [],
        tours: tours.data ?? [],
        companies: companies.data ?? [],
      };
    },
    retry: 2,
  });

  const rows = engagementsPagedQuery.data?.data ?? [];
  const serverTotal = engagementsPagedQuery.data?.total ?? 0;

  const filterOpts = filterOptsQuery.data;

  const attractionOptions = useMemo(() => {
    const names = filterOpts?.attractionNames ?? [];
    return [
      { value: '', label: 'All Attractions' },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  }, [filterOpts?.attractionNames]);

  const dmaOptions = useMemo(() => {
    const names = filterOpts?.dmaMarketNames ?? [];
    return [
      { value: '', label: 'All Markets' },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  }, [filterOpts?.dmaMarketNames]);

  const venueOptions = useMemo(() => {
    const names = filterOpts?.venueLabels ?? [];
    return [
      { value: '', label: 'All Venues' },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  }, [filterOpts?.venueLabels]);

  const pageCount = getTotalPages(serverTotal, pageSize);
  const pageClamped = Math.min(page, pageCount);
  const { rangeStart, rangeEnd } = getPageRange(pageClamped, serverTotal, pageSize);

  const hasActiveFilters =
    !!searchDebounced ||
    statusFilter !== 'All' ||
    !!attractionFilter ||
    !!dmaFilter ||
    !!venueFilter ||
    timingFilter !== 'all';

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, statusFilter, attractionFilter, dmaFilter, venueFilter, timingFilter]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const engagementsLoading =
    engagementsPagedQuery.isPending || engagementsPagedQuery.isFetching;
  const lookupsLoading = lookupsQuery.isPending;
  /** List + create-modal lookups (same as before); filter-options loads in parallel for dropdowns. */
  const loading = engagementsLoading || lookupsLoading;
  const refreshing =
    (engagementsPagedQuery.isFetching && !engagementsPagedQuery.isPending) ||
    (lookupsQuery.isFetching && !lookupsQuery.isPending) ||
    (filterOptsQuery.isFetching && !filterOptsQuery.isPending);
  const error =
    engagementsPagedQuery.error || lookupsQuery.error || filterOptsQuery.error;

  return (
    <div className="space-y-4">
      {/* Refresh indicator */}
      {refreshing && !loading && (
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 text-sm text-ems-coral border border-ems-coral/30 rounded-md px-4 py-3 bg-ems-coral-dim">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Could not load engagements</p>
            <p className="text-xs text-ems-coral/80 mt-0.5">{friendlyApiError(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void engagementsPagedQuery.refetch();
              void filterOptsQuery.refetch();
              void lookupsQuery.refetch();
            }}
            className="flex items-center gap-1 text-xs text-ems-coral hover:underline shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">Engagements</h1>
          {loading ? (
            <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden />
          ) : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {serverTotal.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                saveEngagementsViewMode('list');
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
              title="List view"
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              List
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('tiles');
                saveEngagementsViewMode('tiles');
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'tiles'
                  ? 'bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
              title="Tile view"
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Tiles
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={loading || !lookupsQuery.data}
            className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Add Engagement
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search engagements…"
              disabled={loading}
            />
          </div>
          <div className="w-full sm:w-52">
            <Select2
              options={attractionOptions}
              value={attractionFilter}
              onChange={setAttractionFilter}
              disabled={loading}
              placeholder="All Attractions"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select2
              options={dmaOptions}
              value={dmaFilter}
              onChange={setDmaFilter}
              disabled={loading}
              placeholder="All Markets"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select2
              options={venueOptions}
              value={venueFilter}
              onChange={setVenueFilter}
              disabled={loading}
              placeholder="All Venues"
            />
          </div>
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs font-medium h-[34px]">
            {(['all', 'upcoming', 'past'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={loading}
                onClick={() => setTimingFilter(opt)}
                className={[
                  'px-3 h-full transition-colors capitalize disabled:opacity-50',
                  timingFilter === opt
                    ? 'bg-ems-accent text-background'
                    : 'bg-card text-text-secondary hover:bg-hover',
                ].join(' ')}
              >
                {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChips
            options={['All', ...ENGAGEMENT_STATUS_ENUM]}
            active={statusFilter}
            onChange={setStatusFilter}
            disabled={loading}
          />
        </div>
      </div>

      {/* Table or tiles */}
      {loading ? (
        viewMode === 'tiles' ? (
          <EngagementsTilesSkeleton tileCount={isAllPageSize(pageSize) ? 6 : Math.min(pageSize, 9)} />
        ) : (
          <EngagementsTableSkeleton rowCount={isAllPageSize(pageSize) ? PAGE_SIZE : pageSize} />
        )
      ) : (
        <>
          {viewMode === 'list' ? (
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full table-fixed text-sm min-w-[880px]">
              <colgroup>
                {visualSlots.map((cid) => (
                  <col key={cid} style={{ width: `${100 / 6}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  {visualSlots.map((colId, visualIndex) => {
                    if (colId === 'status') {
                      return (
                        <th
                          key="status"
                          scope="col"
                          className="text-left py-2.5 px-3 text-text-muted bg-surface min-w-0"
                          onDragOver={(e) => e.preventDefault()}
                        >
                          {ENGAGEMENT_COLUMN_LABELS.status}
                        </th>
                      );
                    }
                    const slot = colId;
                    const sortActive = sortState.col === slot;
                    return (
                      <th
                        key={slot}
                        scope="col"
                        draggable
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(visualIndex));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromVis = parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (Number.isNaN(fromVis)) return;
                          if (fromVis >= movableColumnOrder.length || visualIndex >= movableColumnOrder.length) {
                            return;
                          }
                          reorderMovableColumns(fromVis, visualIndex);
                        }}
                        className="text-left py-2.5 px-3 text-text-muted bg-surface select-none min-w-0 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder columns"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical
                            className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-70 pointer-events-none"
                            aria-hidden
                          />
                          <button
                            type="button"
                            className="inline-flex min-w-0 flex-1 items-center gap-1 text-left font-medium text-text-muted hover:text-text-primary cursor-pointer"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleColumnSort(slot);
                            }}
                          >
                            <span className="truncate">{ENGAGEMENT_COLUMN_LABELS[slot]}</span>
                            {sortActive &&
                              (sortState.dir === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 shrink-0 text-ems-accent" aria-hidden />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 shrink-0 text-ems-accent" aria-hidden />
                              ))}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !engagementsPagedQuery.isError && (
                  <tr>
                    <td colSpan={6} className="py-12 px-3 text-center text-sm text-text-muted">
                      {serverTotal === 0 && !hasActiveFilters
                        ? 'No engagements loaded yet.'
                        : 'No engagements match your search or filters.'}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.engagementId}
                    onClick={() => onNavigate('engagement-detail', { engagementId: r.engagementId })}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                  >
                    {visualSlots.map((colId) => renderEngagementTableCell(colId, r))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="space-y-3">
              {rows.length === 0 && !engagementsPagedQuery.isError ? (
                <div className="rounded-lg border border-border bg-card py-12 px-3 text-center text-sm text-text-muted">
                  {serverTotal === 0 && !hasActiveFilters
                    ? 'No engagements loaded yet.'
                    : 'No engagements match your search or filters.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {rows.map((r) => {
                    const thumb = engagementTileImageUrl(r);
                    const venueLine = r.venueCompanyName ?? r.venueName ?? '—';
                    return (
                      <button
                        type="button"
                        key={r.engagementId}
                        onClick={() => onNavigate('engagement-detail', { engagementId: r.engagementId })}
                        className="rounded-xl border border-border bg-card overflow-hidden text-left transition-colors hover:bg-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ems-accent/50"
                      >
                        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border/70 bg-elevated">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ems-accent-dim/50 to-ems-purple-dim/50 text-text-secondary">
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 text-sm font-semibold text-text-primary">
                                {initialsFromName(r.tourName || r.displayTitle || 'Tour')}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide">
                                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                                No tour image
                              </span>
                            </div>
                          )}
                          <span className="absolute right-2 top-2">
                            <StatusBadge status={r.engagementStatus} />
                          </span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          <EngagementTileRow label="Attraction" value={r.attractionName ?? '—'} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Tour</p>
                            <p className="text-sm font-semibold text-text-primary truncate mt-0.5" title={r.tourName}>
                              {r.tourName ?? '—'}
                            </p>
                          </div>
                          <EngagementTileRow
                            label="Entertainment complex"
                            value={r.entertainmentComplexNames ?? '—'}
                          />
                          <EngagementTileRow label="Venue" value={venueLine} />
                          <EngagementTileRow label="Market" value={r.dmaMarketName ?? '—'} />
                          <EngagementTileRow
                            label="Opening date"
                            value={formatFirstShowLine(r.openingPerformanceDate, r.openingPerformanceTime)}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {serverTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of{' '}
                <span className="text-text-primary font-medium">{serverTotal.toLocaleString()}</span>
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted">
                  <span aria-hidden>·</span>
                  <PageSizeSelect
                    value={pageSize}
                    onChange={setPageSize}
                    disabled={engagementsPagedQuery.isFetching}
                  />
                  <span>per page</span>
                </span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={pageClamped <= 1 || engagementsPagedQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-text-muted tabular-nums px-1">
                  Page {pageClamped} / {pageCount}
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={pageClamped >= pageCount || engagementsPagedQuery.isFetching}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && lookupsQuery.data && (
        <CreateEngagementModal
          attractions={lookupsQuery.data.attractions}
          tours={lookupsQuery.data.tours}
          companies={lookupsQuery.data.companies}
          onClose={() => setShowCreate(false)}
          addToast={addToast}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ['engagements'] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------
const inputCls =
  'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20 placeholder:text-text-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

// ---------------------------------------------------------------------------
// CreateEngagementModal
// ---------------------------------------------------------------------------
function CreateEngagementModal({
  attractions,
  tours,
  companies,
  onClose,
  addToast,
  onCreated,
}: {
  attractions: { attractionId: number; attractionName: string }[];
  tours: { tourId: number; tourName: string; attractionId: number }[];
  companies: { companyId: number; companyName: string; companyTypeName: string; dmaMarketName?: string }[];
  onClose: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreated: () => Promise<void>;
}) {
  const venueCompanies = useMemo(
    () =>
      companies
        .filter((c) => c.companyTypeName === 'Venue')
        .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' })),
    [companies],
  );

  const sortedAttractions = useMemo(
    () =>
      [...attractions].sort((a, b) =>
        a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }),
      ),
    [attractions],
  );

  const attractionOptions = useMemo(
    () => sortedAttractions.map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [sortedAttractions],
  );

  const venueOptions = useMemo(
    () => venueCompanies.map((v) => ({ value: String(v.companyId), label: v.companyName })),
    [venueCompanies],
  );

  const statusOptions = useMemo(
    () => ENGAGEMENT_STATUS_ENUM.map((s) => ({ value: s, label: s })),
    [],
  );

  function parseOpeningDateTimeLocal(v: string): { openingShowDate: string; openingShowTime: string } | null {
    const t = v.trim();
    const m = t.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!m) return null;
    return { openingShowDate: m[1], openingShowTime: m[2] };
  }

  // Form state
  const [recordStatus, setRecordStatus] = useState<string>('Unknown');
  const [openingShowDateTime, setOpeningShowDateTime] = useState('');
  const [attractionId, setAttractionId] = useState<string>('');
  const [tourId, setTourId] = useState<string>('');
  const [primaryVenueId, setPrimaryVenueId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Field-level errors
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const attractionIdNum = attractionId ? Number(attractionId) : NaN;

  const toursForAttraction = useMemo(() => {
    if (!attractionId || !Number.isFinite(attractionIdNum)) return [];
    return tours
      .filter((t) => t.attractionId === attractionIdNum)
      .sort((a, b) => a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' }));
  }, [tours, attractionId, attractionIdNum]);

  const tourOptions = useMemo(
    () => toursForAttraction.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    [toursForAttraction],
  );

  // Auto-select tour when only one option
  useEffect(() => {
    if (toursForAttraction.length === 1) {
      setTourId(String(toursForAttraction[0].tourId));
    } else {
      setTourId('');
    }
  }, [attractionId, toursForAttraction]);

  // Live DMA display for selected venue
  const selectedVenueDma = useMemo(() => {
    if (!primaryVenueId) return null;
    const venue = venueCompanies.find((v) => String(v.companyId) === primaryVenueId);
    return venue?.dmaMarketName || null;
  }, [primaryVenueId, venueCompanies]);

  // Clear field errors on change
  const clearError = (field: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!recordStatus) next.status = 'Status is required.';
    if (!parseOpeningDateTimeLocal(openingShowDateTime)) {
      next.opening = 'Opening show date and time is required.';
    }
    if (!tourId) next.tour = 'Tour is required.';
    if (!primaryVenueId) next.venue = 'Venue is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const opening = parseOpeningDateTimeLocal(openingShowDateTime);
      if (!opening) {
        addToast('Opening show date and time is required.', 'warning');
        setSubmitting(false);
        return;
      }
      await createEngagement({
        engagementStatus: recordStatus,
        openingShowDate: opening.openingShowDate,
        openingShowTime: opening.openingShowTime,
        tourId: Number(tourId),
        primaryVenueCompanyId: Number(primaryVenueId),
      });
      addToast('Engagement created successfully.', 'success');
      await onCreated();
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create Engagement" onClose={onClose} width={720} allowContentOverflow>
      <div className="space-y-0">
        {/* ── Row 1: Status + Opening show */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Status" required>
            <Select2
              options={statusOptions}
              value={recordStatus}
              onChange={(v) => { setRecordStatus(v); clearError('status'); }}
              placeholder="Select status…"
            />
            {errors.status && (
              <p className="mt-1 text-xs text-ems-coral">{errors.status}</p>
            )}
          </FormField>

          <FormField label="Opening show date and time" required>
            <input
              type="datetime-local"
              className={inputCls}
              value={openingShowDateTime}
              onChange={(e) => {
                setOpeningShowDateTime(e.target.value);
                clearError('opening');
              }}
            />
            {errors.opening && (
              <p className="mt-1 text-xs text-ems-coral">{errors.opening}</p>
            )}
          </FormField>
        </div>

        {/* Divider */}
        <div className="border-t border-border/60 pb-5" />

        {/* ── Row 2: Attraction filter + Tour */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Filter by Attraction">
            <Select2
              options={[{ value: '', label: 'All attractions' }, ...attractionOptions]}
              value={attractionId}
              onChange={(v) => { setAttractionId(v); clearError('tour'); }}
              placeholder="All attractions"
              allowClear
            />
          </FormField>

          <FormField label="Tour" required>
            <Select2
              options={
                tourOptions.length
                  ? tourOptions
                  : [
                      {
                        value: '',
                        label: attractionId
                          ? 'No tours for this attraction'
                          : 'Select an attraction first…',
                      },
                    ]
              }
              value={tourId}
              onChange={(v) => { setTourId(v); clearError('tour'); }}
              placeholder="Select tour…"
              disabled={!attractionId && tourOptions.length === 0}
            />
            {errors.tour && (
              <p className="mt-1 text-xs text-ems-coral">{errors.tour}</p>
            )}
          </FormField>
        </div>

        {/* Divider */}
        <div className="border-t border-border/60 pb-5" />

        {/* ── Row 3: Venue + DMA (auto-filled) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Venue" required>
            <Select2
              options={venueOptions}
              value={primaryVenueId}
              onChange={(v) => { setPrimaryVenueId(v); clearError('venue'); }}
              placeholder="Select venue…"
            />
            {errors.venue && (
              <p className="mt-1 text-xs text-ems-coral">{errors.venue}</p>
            )}
          </FormField>

          <FormField label="Market (DMA)">
            <input
              className={`${inputCls} bg-surface/50 text-text-muted`}
              value={selectedVenueDma ?? ''}
              placeholder="Auto-filled from venue"
              readOnly
              disabled
            />
          </FormField>
        </div>

        {/* ── Footer */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary text-sm px-4 py-2 rounded-md hover:text-text-primary hover:bg-hover disabled:opacity-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent text-background text-sm px-5 py-2 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-ems-accent/90 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              'Create Engagement'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EditEngagementModal  (used from EngagementsPage action menu if needed later)
// ---------------------------------------------------------------------------
export function EditEngagementModal({
  row,
  attractions,
  tours,
  companies,
  onClose,
  onSaved,
  addToast,
}: {
  row: ApiEngagementListRow;
  attractions: { attractionId: number; attractionName: string }[];
  tours: { tourId: number; tourName: string; attractionId: number }[];
  companies: { companyId: number; companyName: string; companyTypeName: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const venueCompanies = useMemo(
    () =>
      companies
        .filter((c) => c.companyTypeName === 'Venue')
        .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' })),
    [companies],
  );

  const sortedAttractions = useMemo(
    () =>
      [...attractions].sort((a, b) =>
        a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }),
      ),
    [attractions],
  );

  const attractionOptions = useMemo(
    () => sortedAttractions.map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [sortedAttractions],
  );

  const venueOptions = useMemo(
    () => venueCompanies.map((v) => ({ value: String(v.companyId), label: v.companyName })),
    [venueCompanies],
  );

  const statusOptions = useMemo(
    () => ENGAGEMENT_STATUS_ENUM.map((s) => ({ value: s, label: s })),
    [],
  );

  const [attractionId, setAttractionId] = useState(
    row.attractionId != null ? String(row.attractionId) : '',
  );
  const [tourId, setTourId] = useState(row.tourId != null ? String(row.tourId) : '');
  const [primaryVenueId, setPrimaryVenueId] = useState(
    row.primaryVenueCompanyId != null ? String(row.primaryVenueCompanyId) : '',
  );
  const [recordStatus, setRecordStatus] = useState(row.engagementStatus);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const attractionIdNum = Number(attractionId);

  const toursForAttraction = useMemo(
    () =>
      attractionId && Number.isFinite(attractionIdNum)
        ? tours
            .filter((t) => t.attractionId === attractionIdNum)
            .sort((a, b) => a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' }))
        : [],
    [tours, attractionId, attractionIdNum],
  );

  const tourOptions = useMemo(
    () => toursForAttraction.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    [toursForAttraction],
  );

  const skipTourResetOnMount = React.useRef(true);
  React.useEffect(() => {
    if (skipTourResetOnMount.current) {
      skipTourResetOnMount.current = false;
      return;
    }
    setTourId('');
  }, [attractionId]);

  const clearError = (field: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!recordStatus) next.status = 'Status is required.';
    if (!tourId) next.tour = 'Tour is required.';
    if (!primaryVenueId) next.venue = 'Venue is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await updateEngagement(row.engagementId, {
        engagementStatus: recordStatus,
        tourId: Number(tourId),
        primaryVenueCompanyId: Number(primaryVenueId),
      });
      addToast('Engagement updated.', 'success');
      await onSaved();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update engagement.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Edit engagement"
      onClose={onClose}
      width={720}
      allowContentOverflow
    >
      <div className="space-y-0">
        {/* ── Row 1: Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Status" required>
            <Select2
              options={statusOptions}
              value={recordStatus}
              onChange={(v) => { setRecordStatus(v); clearError('status'); }}
              placeholder="Select status…"
            />
            {errors.status && <p className="mt-1 text-xs text-ems-coral">{errors.status}</p>}
          </FormField>
        </div>

        <div className="border-t border-border/60 pb-5" />

        {/* ── Row 2: Attraction + Tour */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Filter by Attraction">
            <Select2
              options={[{ value: '', label: 'All attractions' }, ...attractionOptions]}
              value={attractionId}
              onChange={(v) => { setAttractionId(v); clearError('tour'); }}
              placeholder="All attractions"
              allowClear
            />
          </FormField>

          <FormField label="Tour" required>
            <Select2
              options={
                tourOptions.length
                  ? tourOptions
                  : [
                      {
                        value: '',
                        label: attractionId
                          ? 'No tours for this attraction'
                          : 'Select attraction first…',
                      },
                    ]
              }
              value={tourId}
              onChange={(v) => { setTourId(v); clearError('tour'); }}
              placeholder="Select tour…"
            />
            {errors.tour && <p className="mt-1 text-xs text-ems-coral">{errors.tour}</p>}
          </FormField>
        </div>

        <div className="border-t border-border/60 pb-5" />

        {/* ── Row 3: Venue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
          <FormField label="Venue" required>
            <Select2
              options={venueOptions}
              value={primaryVenueId}
              onChange={(v) => { setPrimaryVenueId(v); clearError('venue'); }}
              placeholder="Select venue…"
            />
            {errors.venue && <p className="mt-1 text-xs text-ems-coral">{errors.venue}</p>}
          </FormField>
        </div>

        {/* ── Footer */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary text-sm px-4 py-2 rounded-md hover:text-text-primary hover:bg-hover disabled:opacity-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent text-background text-sm px-5 py-2 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-ems-accent/90 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}