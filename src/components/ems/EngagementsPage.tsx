import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
import { getPageParams, getTotalPages, getPageRange, PAGE_SIZE } from '@/lib/serverPagination';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  statusFilter?: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function EngagementsTableSkeleton() {
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
        <table className="w-full table-fixed text-sm min-w-[960px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="text-left py-2.5 px-3 min-w-0">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {Array.from({ length: 7 }).map((__, j) => (
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
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (initFilter) setStatusFilter(initFilter);
  }, [initFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { offset, limit } = getPageParams(page);

  const pagedOpts: EngagementPagedQueryOpts = {
    q: searchDebounced || undefined,
    status: statusFilter !== 'All' ? statusFilter : undefined,
    attraction: attractionFilter || undefined,
    dma: dmaFilter || undefined,
    venue: venueFilter || undefined,
    timing: timingFilter,
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

  const pageCount = getTotalPages(serverTotal);
  const pageClamped = Math.min(page, pageCount);
  const { rangeStart, rangeEnd } = getPageRange(pageClamped, serverTotal);

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
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={loading || !lookupsQuery.data}
          className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add Engagement
        </button>
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

      {/* Table */}
      {loading ? (
        <EngagementsTableSkeleton />
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full table-fixed text-sm min-w-[960px]">
              <colgroup>
                <col className="w-[22%] min-w-0" />
                <col className="w-[12%] min-w-0" />
                <col className="w-[12%] min-w-0" />
                <col className="w-[15%] min-w-0" />
                <col className="w-[16%] min-w-0" />
                <col className="w-[15%] min-w-0" />
                <col className="w-[8%] min-w-0" />
              </colgroup>
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Engagement</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Tour</th>
                  <th className="text-left py-2.5 px-3">First Show</th>
                  <th className="text-left py-2.5 px-3">Venue</th>
                  <th className="text-left py-2.5 px-3">Market</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !engagementsPagedQuery.isError && (
                  <tr>
                    <td colSpan={7} className="py-12 px-3 text-center text-sm text-text-muted">
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
                    <td
                      className="py-2.5 px-3 text-text-primary font-medium max-w-[280px] truncate"
                      title={r.displayTitle}
                    >
                      {r.displayTitle}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">
                      {r.attractionName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">
                      {r.tourName ?? '—'}
                    </td>
                    <td
                      className="py-2.5 px-3 text-text-secondary text-xs min-w-0 truncate"
                      title={formatFirstShowLine(r.openingPerformanceDate, r.openingPerformanceTime)}
                    >
                      {formatFirstShowLine(r.openingPerformanceDate, r.openingPerformanceTime)}
                    </td>
                    <td
                      className="py-2.5 px-3 text-text-secondary min-w-0 truncate"
                      title={r.venueCompanyName ?? r.venueName ?? '—'}
                    >
                      {r.venueCompanyName ?? r.venueName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary max-w-[140px] truncate">
                      {r.dmaMarketName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={r.engagementStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
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
      title={`Edit Engagement #${row.engagementId}`}
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