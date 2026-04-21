import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  SearchInput,
  FilterChips,
  Modal,
  FormField,
  ActionMenu,
  StatusBadge,
} from './Primitives';
import { Select2, toOptions } from './Select2';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createEngagement,
  deleteEngagement,
  updateEngagement,
  fetchEngagements,
  type ApiEngagementListRow,
} from '@/api/engagementApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import { fetchCompanies } from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { DEAL_TYPE_OPTIONS, USERS } from '@/data/constants';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

const PAGE_SIZE = 15;

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  statusFilter?: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

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
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="text-left py-2.5 px-3">
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

export function EngagementsPage({ onNavigate, statusFilter: initFilter, addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initFilter || 'All');
  const [attractionFilter, setAttractionFilter] = useState('');
  const [dmaFilter, setDmaFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [timingFilter, setTimingFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiEngagementListRow | null>(null);

  useEffect(() => {
    if (initFilter) setStatusFilter(initFilter);
  }, [initFilter]);

  const engagementsQuery = useQuery({
    queryKey: ['engagements'],
    queryFn: fetchEngagements,
  });

  const lookupsQuery = useQuery({
    queryKey: ['engagements-lookups'],
    queryFn: async () => {
      const [attractions, tours, companies] = await Promise.all([
        fetchAttractions(),
        fetchTours(),
        fetchCompanies(),
      ]);
      return { attractions, tours, companies };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEngagement(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      addToast('Engagement removed.', 'success');
      setPendingDelete(null);
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  const rows = engagementsQuery.data ?? [];

  // Unique filter options derived from data
  const attractionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.attractionName) seen.set(r.attractionName, r.attractionName);
    return [{ value: '', label: 'All Attractions' }, ...[...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => ({ value: v, label: l }))];
  }, [rows]);

  const dmaOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.dmaMarketName) seen.set(r.dmaMarketName, r.dmaMarketName);
    return [{ value: '', label: 'All Markets' }, ...[...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => ({ value: v, label: l }))];
  }, [rows]);

  const venueOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const name = r.venueCompanyName ?? r.venueName;
      if (name) seen.set(name, name);
    }
    return [{ value: '', label: 'All Venues' }, ...[...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => ({ value: v, label: l }))];
  }, [rows]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'All' && r.engagementStatus !== statusFilter) return false;
      if (attractionFilter && r.attractionName !== attractionFilter) return false;
      if (dmaFilter && r.dmaMarketName !== dmaFilter) return false;
      if (venueFilter) {
        const vname = r.venueCompanyName ?? r.venueName ?? '';
        if (vname !== venueFilter) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const hay = [
        r.displayTitle,
        r.attractionName,
        r.tourName ?? '',
        r.venueCompanyName ?? '',
        r.venueName ?? '',
        r.dmaMarketName ?? '',
        r.engagementStatus,
        String(r.engagementId),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, attractionFilter, dmaFilter, venueFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (pageClamped - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(pageClamped * PAGE_SIZE, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, attractionFilter, dmaFilter, venueFilter, timingFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const loading = engagementsQuery.isPending || lookupsQuery.isPending;
  const refreshing =
    (engagementsQuery.isFetching && !engagementsQuery.isPending) ||
    (lookupsQuery.isFetching && !lookupsQuery.isPending);
  const error = engagementsQuery.error || lookupsQuery.error;

  return (
    <div className="space-y-4">
      {refreshing && !loading && (
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {error && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
          Could not load engagements. {friendlyApiError(error)}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">Engagements</h1>
          {loading ? (
            <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden />
          ) : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {filtered.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={loading || !lookupsQuery.data}
          className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Engagement
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search engagements..."
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
          {/* Upcoming / Past toggle */}
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

      {loading ? (
        <EngagementsTableSkeleton />
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Engagement</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Tour</th>
                  <th className="text-left py-2.5 px-3">Venue</th>
                  <th className="text-left py-2.5 px-3">Market</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !engagementsQuery.isError && (
                  <tr>
                    <td colSpan={7} className="py-12 px-3 text-center text-sm text-text-muted">
                      {rows.length === 0
                        ? 'No engagements loaded yet.'
                        : 'No engagements match your search or filters.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr
                    key={r.engagementId}
                    onClick={() =>
                      onNavigate('engagement-detail', { engagementId: r.engagementId })
                    }
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-text-primary font-medium max-w-[280px] truncate" title={r.displayTitle}>
                      {r.displayTitle}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">{r.attractionName}</td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-[160px] truncate">{r.tourName ?? '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-[180px] truncate">
                      {r.venueCompanyName ?? r.venueName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary max-w-[140px] truncate">
                      {r.dmaMarketName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={r.engagementStatus} />
                    </td>
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: 'View details',
                            onClick: () =>
                              onNavigate('engagement-detail', { engagementId: r.engagementId }),
                          },
                          ...(r.appCreated
                            ? [
                                {
                                  label: 'Delete',
                                  danger: true as const,
                                  onClick: () => setPendingDelete(r),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of <span className="text-text-primary font-medium">{filtered.length}</span>
                {filtered.length > PAGE_SIZE && (
                  <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
                )}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={pageClamped <= 1}
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
                  disabled={pageClamped >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

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

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete engagement?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes engagement #{pendingDelete?.engagementId}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.engagementId)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
    () => companies.filter((c) => c.companyTypeName === 'Venue'),
    [companies],
  );

  const attractionOptions = useMemo(() => {
    return [...attractions]
      .sort((a, b) => a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }))
      .map((a) => ({ value: String(a.attractionId), label: a.attractionName }));
  }, [attractions]);

  const venueOptions = useMemo(() => {
    return [...venueCompanies]
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
      .map((v) => ({ value: String(v.companyId), label: v.companyName }));
  }, [venueCompanies]);

  const statusOptions = useMemo(() => toOptions([...ENGAGEMENT_STATUS_ENUM]), []);

  const [attractionId, setAttractionId] = useState<string>(
    attractions[0] ? String(attractions[0].attractionId) : '',
  );
  const [tourId, setTourId] = useState<string>('');
  const [primaryVenueId, setPrimaryVenueId] = useState<string>('');
  const [recordStatus, setRecordStatus] = useState<string>('Unknown');
  const [showDateTime, setShowDateTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const attractionIdNum = attractionId ? Number(attractionId) : NaN;

  const toursForAttraction = useMemo(() => {
    if (!attractionId || !Number.isFinite(attractionIdNum)) return [];
    return tours.filter((t) => t.attractionId === attractionIdNum);
  }, [tours, attractionId, attractionIdNum]);

  const tourOptions = useMemo(
    () => toursForAttraction.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    [toursForAttraction],
  );

  // Get selected venue's DMA
  const selectedVenueDma = useMemo(() => {
    if (!primaryVenueId) return null;
    const venue = venueCompanies.find((v) => String(v.companyId) === primaryVenueId);
    return venue?.dmaMarketName || null;
  }, [primaryVenueId, venueCompanies]);

  useEffect(() => {
    setTourId('');
  }, [attractionId]);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';

  const handleSubmit = async () => {
    if (!recordStatus.trim()) {
      addToast('Status is required.', 'warning');
      return;
    }
    if (!attractionId) {
      addToast('Attraction is required.', 'warning');
      return;
    }
    if (!tourId) {
      addToast('Tour is required.', 'warning');
      return;
    }
    if (!primaryVenueId) {
      addToast('Venue is required.', 'warning');
      return;
    }
    if (recordStatus.trim().length > 50) {
      addToast('Status must be at most 50 characters.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await createEngagement({
        engagementStatus: recordStatus.trim(),
        engagementScaling: null,
        tourId: Number(tourId),
        primaryVenueCompanyId: Number(primaryVenueId),
      });
      addToast('Engagement created.', 'success');
      await onCreated();
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create Engagement" onClose={onClose} width={960} allowContentOverflow>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Status" required>
            <Select2 options={statusOptions} value={recordStatus} onChange={setRecordStatus} placeholder="Select status…" />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Filter by Attraction (optional)">
            <Select2
              options={[{ value: '', label: 'All attractions' }, ...attractionOptions]}
              value={attractionId}
              onChange={setAttractionId}
              placeholder="Filter tours…"
              allowClear
            />
          </FormField>
          <FormField label="Tour" required>
            <Select2
              options={tourOptions.length
                ? tourOptions
                : [{ value: '', label: attractionId ? 'No tours for this attraction' : 'Select a tour…' }]}
              value={tourId}
              onChange={setTourId}
              placeholder="Select tour…"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Venue" required>
            <Select2
              options={venueOptions}
              value={primaryVenueId}
              onChange={setPrimaryVenueId}
              placeholder="Select venue…"
            />
          </FormField>
          {selectedVenueDma && (
            <FormField label="DMA">
              <input
                className={inputCls}
                value={selectedVenueDma}
                disabled
                readOnly
              />
            </FormField>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Opening Show Date and Time">
            <input 
              type="datetime-local" 
              className={inputCls} 
              value={showDateTime} 
              onChange={(e) => setShowDateTime(e.target.value)} 
            />
          </FormField>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EditEngagementModal
// ---------------------------------------------------------------------------

function EditEngagementModal({
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
    () => companies.filter((c) => c.companyTypeName === 'Venue'),
    [companies],
  );

  const attractionOptions = useMemo(
    () =>
      [...attractions]
        .sort((a, b) => a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }))
        .map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [attractions],
  );

  const venueOptions = useMemo(
    () =>
      [...venueCompanies]
        .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
        .map((v) => ({ value: String(v.companyId), label: v.companyName })),
    [venueCompanies],
  );

  const statusOptions = useMemo(() => toOptions([...ENGAGEMENT_STATUS_ENUM]), []);

  const [attractionId, setAttractionId] = useState(String(row.attractionId));
  const [tourId, setTourId] = useState(row.tourId != null ? String(row.tourId) : '');
  const [primaryVenueId, setPrimaryVenueId] = useState(
    row.primaryVenueCompanyId != null ? String(row.primaryVenueCompanyId) : '',
  );
  const [recordStatus, setRecordStatus] = useState(row.engagementStatus);
  const [engagementScaling, setEngagementScaling] = useState(row.engagementScaling ?? '');
  const [submitting, setSubmitting] = useState(false);

  const attractionIdNum = Number(attractionId);
  const tourOptions = useMemo(
    () =>
      attractions.length && attractionId
        ? tours
            .filter((t) => t.attractionId === attractionIdNum)
            .map((t) => ({ value: String(t.tourId), label: t.tourName }))
        : [],
    [tours, attractionId, attractionIdNum, attractions.length],
  );

  const skipTourResetOnMount = React.useRef(true);
  React.useEffect(() => {
    if (skipTourResetOnMount.current) { skipTourResetOnMount.current = false; return; }
    setTourId('');
  }, [attractionId]);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';

  const handleSave = async () => {
    if (!tourId) { addToast('Tour is required.', 'warning'); return; }
    if (!primaryVenueId) { addToast('Primary venue is required.', 'warning'); return; }
    if (!recordStatus.trim() || recordStatus.trim().length > 50) {
      addToast('Status is required (max 50 chars).', 'warning'); return;
    }
    const tid = tourId ? Number(tourId) : null;
    setSubmitting(true);
    try {
      await updateEngagement(row.engagementId, {
        engagementStatus: recordStatus.trim(),
        engagementScaling: engagementScaling.trim() || null,
        tourId: tid ?? undefined,
        primaryVenueCompanyId: Number(primaryVenueId),
      });
      await onSaved();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update engagement.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit Engagement #${row.engagementId}`} onClose={onClose} width={900} allowContentOverflow>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Status" required>
            <Select2 options={statusOptions} value={recordStatus} onChange={setRecordStatus} placeholder="Select status…" />
          </FormField>
          <FormField label="Scaling (optional)">
            <input className={inputCls} value={engagementScaling}
              onChange={(e) => setEngagementScaling(e.target.value)}
              placeholder="e.g. GA, Reserved, Mixed" maxLength={50} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Attraction" required>
            <Select2 options={attractionOptions} value={attractionId} onChange={setAttractionId} placeholder="Select attraction…" />
          </FormField>
          <FormField label="Tour (optional)">
            <Select2
              options={tourOptions.length
                ? tourOptions
                : [{ value: '', label: attractionId ? 'No tours for this attraction' : 'Select attraction first…' }]}
              value={tourId} onChange={setTourId} placeholder="No tour" allowClear disabled={!attractionId}
            />
          </FormField>
        </div>

        <FormField label="Venue" required>
          <Select2 options={venueOptions} value={primaryVenueId} onChange={setPrimaryVenueId} placeholder="Select venue…" />
        </FormField>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button type="button" onClick={onClose} disabled={submitting}
            className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={submitting}
            className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Saving…</>
            ) : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}