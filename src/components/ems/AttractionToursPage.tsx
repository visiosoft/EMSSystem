import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  SearchInput,
  TabBar,
  Drawer,
  Modal,
  FormField,
  ActionMenu,
} from './Primitives';
import { Select2 } from './Select2';
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
  createAttraction,
  createTour,
  deleteAttraction,
  deleteTour,
  fetchAttractions,
  fetchClasses,
  fetchTours,
  updateAttraction,
  updateTour,
  type ApiAttractionListRow,
  type ApiClass,
  type ApiTourListRow,
} from '@/api/attractionToursApi';
import { fetchCompanies } from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { TOUR_STATUS_OPTIONS } from './tourFormLegacy';

const PAGE_SIZE = 15;

/** Matches Companies page loading + table shell styling. */
function AttractionToursTableSkeleton({ variant }: { variant: 'attractions' | 'tours' }) {
  const isAttr = variant === 'attractions';
  const colCount = isAttr ? 4 : 6;
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
          <p className="text-sm font-semibold text-text-primary">
            {isAttr ? 'Loading attractions' : 'Loading tours'}
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            This may take a moment on large lists.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className={`w-full text-sm ${isAttr ? 'min-w-[520px]' : 'min-w-[800px]'}`}>
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              {isAttr ? (
                <>
                  <th className="text-left py-2.5 px-3">Attraction Name</th>
                  <th className="text-left py-2.5 px-3">Genre</th>
                  <th className="text-left py-2.5 px-3">Active Tours</th>
                  <th className="w-10" />
                </>
              ) : (
                <>
                  <th className="text-left py-2.5 px-3">Tour Name</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Class</th>
                  <th className="text-left py-2.5 px-3">Talent Agent</th>
                  <th className="text-left py-2.5 px-3">Licensing</th>
                  <th className="w-10" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {Array.from({ length: colCount }).map((__, j) => (
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

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

function licenseSummary(t: ApiTourListRow): string {
  const parts: string[] = [];
  if (t.ascap) parts.push('ASCAP');
  if (t.bmi) parts.push('BMI');
  if (t.sesac) parts.push('SESAC');
  if (t.gmr) parts.push('GMR');
  return parts.length ? parts.join(' · ') : '—';
}

function TourCardInDrawer({ t }: { t: ApiTourListRow }) {
  return (
    <div className="bg-elevated border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-text-primary font-medium leading-snug">{t.tourName}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="text-[11px] bg-surface border border-border/80 px-1.5 py-0.5 rounded text-text-secondary">
              {t.className}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-text-muted shrink-0 text-right max-w-[40%]" title={licenseSummary(t)}>
          {licenseSummary(t)}
        </span>
      </div>
      <div className="text-[11px] text-text-secondary">
        <span className="text-text-muted">Talent agent </span>
        {t.tourManagementCompanyName ?? '—'}
      </div>
    </div>
  );
}

export function AttractionToursPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState('Attractions');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [tourDrawerTab, setTourDrawerTab] = useState('Details');

  const [showAddAttraction, setShowAddAttraction] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);
  const [editAttraction, setEditAttraction] = useState<ApiAttractionListRow | null>(null);
  const [editTour, setEditTour] = useState<ApiTourListRow | null>(null);

  const [pendingDeleteAttraction, setPendingDeleteAttraction] = useState<ApiAttractionListRow | null>(null);
  const [pendingDeleteTour, setPendingDeleteTour] = useState<ApiTourListRow | null>(null);

  const attractionsQuery = useQuery({
    queryKey: ['attractions'],
    queryFn: fetchAttractions,
  });
  const toursQuery = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
  });
  const lookupsQuery = useQuery({
    queryKey: ['attraction-tours-lookups'],
    queryFn: async () => {
      const [classes, companies] = await Promise.all([fetchClasses(), fetchCompanies()]);
      return { classes, companies };
    },
  });

  const attractions = attractionsQuery.data ?? [];
  const tours = toursQuery.data ?? [];

  const refetchAll = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['attractions'], exact: true }),
      qc.refetchQueries({ queryKey: ['tours'], exact: true }),
    ]);
  };

  const createAttrMut = useMutation({
    mutationFn: createAttraction,
    onSuccess: async () => {
      await refetchAll();
      setShowAddAttraction(false);
      addToast('Attraction created.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not create attraction.'), 'error'),
  });

  const updateAttrMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof updateAttraction>[1] }) =>
      updateAttraction(id, body),
    onSuccess: async () => {
      await refetchAll();
      setEditAttraction(null);
      addToast('Attraction updated.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not update attraction.'), 'error'),
  });

  const deleteAttrMut = useMutation({
    mutationFn: deleteAttraction,
    onSuccess: async () => {
      await refetchAll();
      setPendingDeleteAttraction(null);
      addToast('Attraction removed.', 'warning');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete attraction.'), 'error'),
  });

  const createTourMut = useMutation({
    mutationFn: createTour,
    onSuccess: async () => {
      await refetchAll();
      setShowAddTour(false);
      addToast('Tour created.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not create tour.'), 'error'),
  });

  const updateTourMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof updateTour>[1] }) => updateTour(id, body),
    onSuccess: async () => {
      await refetchAll();
      setEditTour(null);
      addToast('Tour updated.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not update tour.'), 'error'),
  });

  const deleteTourMut = useMutation({
    mutationFn: deleteTour,
    onSuccess: async (_, tourId) => {
      await refetchAll();
      setPendingDeleteTour(null);
      setSelectedTourId((cur) => (cur === tourId ? null : cur));
      addToast('Tour removed.', 'warning');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete tour.'), 'error'),
  });

  const loading =
    attractionsQuery.isPending || toursQuery.isPending || lookupsQuery.isPending;
  const refreshing = attractionsQuery.isFetching || toursQuery.isFetching;

  const filteredAttractions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attractions.filter(
      (a) => !q || a.attractionName.toLowerCase().includes(q) || a.className.toLowerCase().includes(q),
    );
  }, [attractions, search]);

  const filteredTours = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tours.filter(
      (t) =>
        !q ||
        t.tourName.toLowerCase().includes(q) ||
        t.attractionName.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        (t.tourManagementCompanyName && t.tourManagementCompanyName.toLowerCase().includes(q)),
    );
  }, [tours, search]);

  const listForTab = pageTab === 'Attractions' ? filteredAttractions : filteredTours;
  const pageCount = Math.max(1, Math.ceil(listForTab.length / PAGE_SIZE));
  const paginated = listForTab.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = listForTab.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, listForTab.length);

  useEffect(() => {
    setPage(1);
  }, [search, pageTab]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const selectedAttraction = selectedAttractionId
    ? attractions.find((a) => a.attractionId === selectedAttractionId) ?? null
    : null;
  const selectedTour = selectedTourId ? tours.find((t) => t.tourId === selectedTourId) ?? null : null;

  const attractionTours = selectedAttraction
    ? tours.filter((t) => t.attractionId === selectedAttraction.attractionId)
    : [];

  const lookups = lookupsQuery.data;
  const classes = lookups?.classes ?? [];
  const companies = lookups?.companies ?? [];

  const managementCompanyOptions = useMemo(() => {
    const mgmt = companies.filter((c) => c.companyTypeName === 'Attraction Management');
    const pool = mgmt.length ? mgmt : companies;
    return pool
      .map((c) => ({ value: String(c.companyId), label: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [companies]);

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

      <AlertDialog
        open={pendingDeleteAttraction !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAttrMut.isPending) setPendingDeleteAttraction(null);
        }}
      >
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">
              Remove this attraction?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              This will permanently delete{' '}
              <span className="font-medium text-text-primary">
                {pendingDeleteAttraction?.attractionName ?? 'this attraction'}
              </span>
              . You can only remove attractions you added here, with no tours and no engagements linked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteAttrMut.isPending && (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary"
              role="status"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden />
              <span>Removing attraction…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={deleteAttrMut.isPending}
              className="border-border bg-elevated text-text-primary hover:bg-hover mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteAttrMut.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => {
                if (!pendingDeleteAttraction) return;
                void deleteAttrMut.mutateAsync(pendingDeleteAttraction.attractionId);
              }}
            >
              {deleteAttrMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Yes, remove attraction'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteTour !== null}
        onOpenChange={(open) => {
          if (!open && !deleteTourMut.isPending) setPendingDeleteTour(null);
        }}
      >
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">Remove this tour?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              This will permanently delete{' '}
              <span className="font-medium text-text-primary">{pendingDeleteTour?.tourName ?? 'this tour'}</span>. Only
              tours you added here can be removed, and only when no engagements reference them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTourMut.isPending && (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary"
              role="status"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden />
              <span>Removing tour…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={deleteTourMut.isPending}
              className="border-border bg-elevated text-text-primary hover:bg-hover mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTourMut.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => {
                const id = pendingDeleteTour?.tourId;
                if (id == null) return;
                void deleteTourMut.mutateAsync(id);
              }}
            >
              {deleteTourMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Yes, remove tour'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(attractionsQuery.isError || toursQuery.isError || lookupsQuery.isError) && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
          Could not load Attraction-Tours data.{' '}
          {(attractionsQuery.error as Error)?.message ||
            (toursQuery.error as Error)?.message ||
            (lookupsQuery.error as Error)?.message}
          . Is the API running at <code className="text-xs">/api</code>?
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">Attraction-Tours</h1>
          {loading ? (
            <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden />
          ) : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {listForTab.length}
            </span>
          )}
          <TabBar tabs={['Attractions', 'Tours']} active={pageTab} onChange={setPageTab} />
        </div>
        {pageTab === 'Attractions' ? (
          <button
            type="button"
            onClick={() => setShowAddAttraction(true)}
            disabled={loading || !classes.length}
            className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Attraction
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddTour(true)}
            disabled={loading || !attractions.length || !classes.length}
            className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Tour
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={pageTab === 'Attractions' ? 'Search attractions...' : 'Search tours...'}
            disabled={loading}
          />
        </div>
      </div>

      {loading ? (
        <AttractionToursTableSkeleton variant={pageTab === 'Attractions' ? 'attractions' : 'tours'} />
      ) : (
        <>
          {pageTab === 'Attractions' && (
            <>
              <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border bg-surface">
                      <th className="text-left py-2.5 px-3">Attraction Name</th>
                      <th className="text-left py-2.5 px-3">Genre</th>
                      <th className="text-left py-2.5 px-3">Active Tours</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttractions.length === 0 && !attractionsQuery.isError && (
                      <tr>
                        <td colSpan={4} className="py-12 px-3 text-center text-sm text-text-muted">
                          {attractions.length === 0
                            ? 'No attractions found.'
                            : 'No attractions match your search.'}
                        </td>
                      </tr>
                    )}
                    {(paginated as ApiAttractionListRow[]).map((a) => (
                      <tr
                        key={a.attractionId}
                        onClick={() => setSelectedAttractionId(a.attractionId)}
                        className="border-b border-border/50 hover:bg-hover cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-text-primary font-medium">{a.attractionName}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                            {a.className}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary tabular-nums text-sm">{a.activeTourCount}</td>
                        <td className="py-2.5 px-3">
                          <ActionMenu
                            items={[
                              { label: 'Edit', onClick: () => setEditAttraction(a) },
                              ...(a.appCreated
                                ? [
                                    {
                                      label: 'Delete',
                                      onClick: () => setPendingDeleteAttraction(a),
                                      danger: true as const,
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
              {filteredAttractions.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
                  <p className="tabular-nums">
                    Showing{' '}
                    <span className="text-text-primary font-medium">
                      {rangeStart}–{rangeEnd}
                    </span>{' '}
                    of <span className="text-text-primary font-medium">{filteredAttractions.length}</span>
                    {filteredAttractions.length > PAGE_SIZE && (
                      <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="text-text-muted tabular-nums px-1">
                      Page {page} / {pageCount}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {pageTab === 'Tours' && (
            <>
              <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border bg-surface">
                      <th className="text-left py-2.5 px-3">Tour Name</th>
                      <th className="text-left py-2.5 px-3">Attraction</th>
                      <th className="text-left py-2.5 px-3">Class</th>
                      <th className="text-left py-2.5 px-3">Talent Agent</th>
                      <th className="text-left py-2.5 px-3">Licensing</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTours.length === 0 && !toursQuery.isError && (
                      <tr>
                        <td colSpan={6} className="py-12 px-3 text-center text-sm text-text-muted">
                          {tours.length === 0 ? 'No tours found.' : 'No tours match your search.'}
                        </td>
                      </tr>
                    )}
                    {(paginated as ApiTourListRow[]).map((t) => (
                      <tr
                        key={t.tourId}
                        onClick={() => {
                          setSelectedTourId(t.tourId);
                          setTourDrawerTab('Details');
                        }}
                        className="border-b border-border/50 hover:bg-hover cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-text-primary font-medium">{t.tourName}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{t.attractionName}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                            {t.className}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-sm">
                          {t.tourManagementCompanyName ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-text-secondary">{licenseSummary(t)}</td>
                        <td className="py-2.5 px-3">
                          <ActionMenu
                            items={[
                              { label: 'Edit', onClick: () => setEditTour(t) },
                              ...(t.appCreated
                                ? [
                                    {
                                      label: 'Delete',
                                      onClick: () => setPendingDeleteTour(t),
                                      danger: true as const,
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
              {filteredTours.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
                  <p className="tabular-nums">
                    Showing{' '}
                    <span className="text-text-primary font-medium">
                      {rangeStart}–{rangeEnd}
                    </span>{' '}
                    of <span className="text-text-primary font-medium">{filteredTours.length}</span>
                    {filteredTours.length > PAGE_SIZE && (
                      <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="text-text-muted tabular-nums px-1">
                      Page {page} / {pageCount}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedAttraction && (
        <Drawer onClose={() => setSelectedAttractionId(null)} width={1000}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selectedAttraction.attractionName}</h2>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                    {selectedAttraction.className}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttractionId(null)}
                className="text-text-muted hover:text-text-secondary text-lg"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">Tours</h3>
            <div className="space-y-3">
              {attractionTours.length === 0 && (
                <div className="text-text-muted text-sm">No tours attached yet.</div>
              )}
              {attractionTours.map((t) => (
                <TourCardInDrawer key={t.tourId} t={t} />
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {selectedTour && (
        <Drawer onClose={() => setSelectedTourId(null)} width={1000}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selectedTour.tourName}</h2>
                <div className="text-sm text-text-secondary">{selectedTour.attractionName}</div>
                <p className="text-xs text-text-muted mt-2">{selectedTour.className}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTourId(null)}
                className="text-text-muted hover:text-text-secondary text-lg"
              >
                ✕
              </button>
            </div>
          </div>
          <TabBar tabs={['Details', 'Contacts']} active={tourDrawerTab} onChange={setTourDrawerTab} />
          <div className="p-4 text-sm">
            {tourDrawerTab === 'Details' && (
              <div className="space-y-2">
                <div>
                  <span className="text-text-muted text-xs">Talent agent</span>
                  <div className="text-text-primary">{selectedTour.tourManagementCompanyName ?? '—'}</div>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Licensing (ASCAP / BMI / SESAC / GMR)</span>
                  <div className="text-text-primary">{licenseSummary(selectedTour)}</div>
                </div>
              </div>
            )}
            {tourDrawerTab === 'Contacts' && (
              <p className="text-text-secondary text-sm">No contacts listed for this tour.</p>
            )}
          </div>
        </Drawer>
      )}

      {showAddAttraction && classes.length > 0 && (
        <Modal title="Add Attraction" onClose={() => setShowAddAttraction(false)} width={960} allowContentOverflow>
          <AttractionForm
            classes={classes}
            submitting={createAttrMut.isPending}
            onCancel={() => setShowAddAttraction(false)}
            onSave={(body) => void createAttrMut.mutateAsync(body)}
          />
        </Modal>
      )}
      {editAttraction && (
        <Modal title="Edit Attraction" onClose={() => setEditAttraction(null)} width={960} allowContentOverflow>
          <AttractionForm
            classes={classes}
            initial={editAttraction}
            submitting={updateAttrMut.isPending}
            onCancel={() => setEditAttraction(null)}
            onSave={(body) =>
              void updateAttrMut.mutateAsync({ id: editAttraction.attractionId, body })
            }
          />
        </Modal>
      )}
      {showAddTour && classes.length > 0 && attractions.length > 0 && (
        <Modal title="Add Tour" onClose={() => setShowAddTour(false)} width={960} allowContentOverflow>
          <TourFormDb
            attractions={attractions}
            classes={classes}
            managementCompanyOptions={managementCompanyOptions}
            submitting={createTourMut.isPending}
            onCancel={() => setShowAddTour(false)}
            onSave={(body) => void createTourMut.mutateAsync(body)}
          />
        </Modal>
      )}
      {editTour && (
        <Modal title="Edit Tour" onClose={() => setEditTour(null)} width={960} allowContentOverflow>
          <TourFormDb
            attractions={attractions}
            classes={classes}
            managementCompanyOptions={managementCompanyOptions}
            initial={editTour}
            submitting={updateTourMut.isPending}
            onCancel={() => setEditTour(null)}
            onSave={(body) => void updateTourMut.mutateAsync({ id: editTour.tourId, body })}
          />
        </Modal>
      )}
    </div>
  );
}

function AttractionForm({
  classes,
  initial,
  submitting,
  onSave,
  onCancel,
}: {
  classes: ApiClass[];
  initial?: ApiAttractionListRow;
  submitting: boolean;
  onSave: (body: { attractionName: string; classId: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.attractionName ?? '');
  const [classId, setClassId] = useState(String(initial?.classId ?? classes[0]?.classId ?? ''));

  const classOptions = classes.map((c) => ({
    value: String(c.classId),
    label: c.className,
  }));

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const valid = name.trim().length > 0 && classId.length > 0;

  return (
    <div className="space-y-3">
      <FormField label="Name" required>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </FormField>
      <FormField label="Genre" required>
        <Select2 options={classOptions} value={classId} onChange={setClassId} placeholder="Select genre..." />
      </FormField>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-text-secondary px-4 py-1.5" disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={() => onSave({ attractionName: name.trim(), classId: Number(classId) })}
          className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function TourFormDb({
  attractions,
  classes,
  managementCompanyOptions,
  initial,
  submitting,
  onSave,
  onCancel,
}: {
  attractions: ApiAttractionListRow[];
  classes: ApiClass[];
  managementCompanyOptions: { value: string; label: string }[];
  initial?: ApiTourListRow;
  submitting: boolean;
  onSave: (body: import('@/api/attractionToursApi').CreateTourPayload | import('@/api/attractionToursApi').UpdateTourPayload) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.tourName ?? '');
  const [attractionId, setAttractionId] = useState(
    String(initial?.attractionId ?? attractions[0]?.attractionId ?? ''),
  );
  const [classId, setClassId] = useState(String(initial?.classId ?? classes[0]?.classId ?? ''));
  const [talentAgentCompanyId, setTalentAgentCompanyId] = useState(
    initial?.tourManagementCompanyId != null ? String(initial.tourManagementCompanyId) : '',
  );
  /** Not persisted — skipped on save. */
  const [uiStatus, setUiStatus] = useState('');
  const [routingStart, setRoutingStart] = useState('');
  const [routingEnd, setRoutingEnd] = useState('');
  const [ascap, setAscap] = useState(initial?.ascap ?? false);
  const [bmi, setBmi] = useState(initial?.bmi ?? false);
  const [sesac, setSesac] = useState(initial?.sesac ?? false);
  const [gmr, setGmr] = useState(initial?.gmr ?? false);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const attractionOptions = attractions.map((a) => ({
    value: String(a.attractionId),
    label: a.attractionName,
  }));
  const classOptions = classes.map((c) => ({ value: String(c.classId), label: c.className }));
  const mgmtOptions = [{ value: '', label: '—' }, ...managementCompanyOptions];
  const statusOptions = [{ value: '', label: '—' }, ...TOUR_STATUS_OPTIONS];

  const valid = name.trim().length > 0 && attractionId && classId;

  const buildPayload = (): import('@/api/attractionToursApi').CreateTourPayload => ({
    tourName: name.trim(),
    attractionId: Number(attractionId),
    classId: Number(classId),
    ascap,
    bmi,
    sesac,
    gmr,
    tourManagementCompanyId: talentAgentCompanyId ? Number(talentAgentCompanyId) : null,
  });

  return (
    <div className="space-y-4">
      <FormField label="Tour Name" required>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="e.g. World Tour 2025"
        />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Attraction" required>
          <Select2 options={attractionOptions} value={attractionId} onChange={setAttractionId} />
        </FormField>
        <FormField label="Class (genre)" required>
          <Select2 options={classOptions} value={classId} onChange={setClassId} />
        </FormField>
      </div>
      <FormField label="Talent Agent">
        <Select2
          options={mgmtOptions}
          value={talentAgentCompanyId}
          onChange={setTalentAgentCompanyId}
          placeholder="Select company…"
          allowClear
        />
      </FormField>
      <FormField label="Status (optional)">
        <Select2 options={statusOptions} value={uiStatus} onChange={setUiStatus} placeholder="—" allowClear />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Routing start (optional)">
          <input type="date" className={inputCls} value={routingStart} onChange={(e) => setRoutingStart(e.target.value)} />
        </FormField>
        <FormField label="Routing end (optional)">
          <input type="date" className={inputCls} value={routingEnd} onChange={(e) => setRoutingEnd(e.target.value)} />
        </FormField>
      </div>
      <div>
        <span className="text-xs font-medium text-text-secondary">Performing rights</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={ascap} onChange={(e) => setAscap(e.target.checked)} />
            ASCAP
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bmi} onChange={(e) => setBmi(e.target.checked)} />
            BMI
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sesac} onChange={(e) => setSesac(e.target.checked)} />
            SESAC
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={gmr} onChange={(e) => setGmr(e.target.checked)} />
            GMR
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button type="button" onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm" disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={() => onSave(buildPayload())}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-ems-accent text-background hover:bg-ems-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save Tour'}
        </button>
      </div>
    </div>
  );
}
