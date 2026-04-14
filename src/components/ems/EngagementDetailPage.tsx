import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Engagement } from '@/data/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal, FormField, TabBar } from './Primitives';
import { Select2, toOptions } from './Select2';
import { Button } from '@/components/ui/button';
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
  createEngagementPerformance,
  deleteEngagement,
  fetchEngagement,
  fetchEngagementPerformances,
  updateEngagement,
  type ApiEngagementListRow,
} from '@/api/engagementApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import { fetchCompanies, fetchCompanyContacts } from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { DEAL_TYPE_OPTIONS, USERS } from '@/data/constants';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

function formatPerformanceDateDisplay(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function formatPerformanceTimeDisplay(sqlTime: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(sqlTime.trim());
  if (!m) return sqlTime;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), m[3] != null ? Number(m[3]) : 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface Props {
  engagementId: number;
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/** Local demo engagement (string id) — open a numeric engagement from the list for saved details. */
export function LegacyEngagementDetailPage({
  engagement,
  onNavigate,
}: {
  engagement: Engagement;
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onNavigate('engagements')}
        className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1"
      >
        ← Back to Engagements
      </button>
      <div className="bg-card border border-amber-500/25 rounded-lg p-4 space-y-2">
        <p className="text-xs text-amber-800 dark:text-amber-400/90">
          This engagement uses a local demo id. Use an engagement from the main list for full detail.
        </p>
        <h1 className="text-lg font-semibold text-text-primary">{engagement.name}</h1>
        <p className="text-xs text-text-muted">ID {engagement.id}</p>
        <div className="text-sm text-text-secondary pt-2 border-t border-border">Status: {engagement.status}</div>
      </div>
    </div>
  );
}

export function EngagementDetailPage({ engagementId, onNavigate, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [showEdit, setShowEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  /** Optional — not saved with this screen. */
  const [overviewNotes, setOverviewNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: ['engagements', engagementId],
    queryFn: () => fetchEngagement(engagementId),
  });

  useEffect(() => {
    setOverviewNotes('');
    setTab('Overview');
  }, [engagementId]);

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

  const venueId = detailQuery.data?.primaryVenueCompanyId;

  const tourMgmtCompanyId = useMemo(() => {
    const r = detailQuery.data;
    if (r?.tourId == null) return null as number | null;
    const tours = lookupsQuery.data?.tours;
    if (tours === undefined) return undefined as number | null | undefined;
    const t = tours.find((x) => x.tourId === r.tourId);
    return t?.tourManagementCompanyId ?? null;
  }, [detailQuery.data?.tourId, lookupsQuery.data?.tours]);

  const venueContactsQuery = useQuery({
    queryKey: ['company-contacts', 'venue', venueId],
    queryFn: () => fetchCompanyContacts(venueId!),
    enabled: tab === 'Contacts' && venueId != null && venueId > 0,
  });

  const tourContactsQuery = useQuery({
    queryKey: ['company-contacts', 'tour-mgmt', tourMgmtCompanyId],
    queryFn: () => fetchCompanyContacts(tourMgmtCompanyId as number),
    enabled:
      tab === 'Contacts' &&
      typeof tourMgmtCompanyId === 'number' &&
      tourMgmtCompanyId > 0,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateEngagement>[1]) =>
      updateEngagement(engagementId, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId] });
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEngagement(engagementId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      addToast('Engagement removed.', 'warning');
      onNavigate('engagements');
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  const row = detailQuery.data;

  const handleStatusChange = (next: string) => {
    if (!next.trim() || next.length > 50) {
      addToast('Status must be 1–50 characters.', 'warning');
      return;
    }
    patchMutation.mutate(
      { engagementStatus: next },
      {
        onSuccess: () => addToast('Status updated.', 'success'),
      },
    );
  };

  const statusSelectOptions = useMemo(() => {
    const merged = new Set<string>([...ENGAGEMENT_STATUS_ENUM, row?.engagementStatus ?? ''].filter(Boolean));
    return toOptions(Array.from(merged));
  }, [row?.engagementStatus]);

  const performancesQuery = useQuery({
    queryKey: ['engagements', engagementId, 'performances'],
    queryFn: () => fetchEngagementPerformances(engagementId),
    enabled: tab === 'Dates',
  });

  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [pfDate, setPfDate] = useState('');
  const [pfDoor, setPfDoor] = useState('19:00');
  const [pfShow, setPfShow] = useState('20:00');
  const [pfRuntime, setPfRuntime] = useState('120');

  const createPerformanceMut = useMutation({
    mutationFn: (body: { performanceDate: string; performanceTime: string }) =>
      createEngagementPerformance(engagementId, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'performances'] });
      addToast('Show date saved.', 'success');
      setShowAddPerformance(false);
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  const inputClsModal =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
        <Loader2 className="h-10 w-10 animate-spin text-ems-accent" aria-hidden />
        <p className="text-sm">Loading engagement…</p>
      </div>
    );
  }

  if (detailQuery.error || !row) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onNavigate('engagements')}
          className="text-text-muted hover:text-text-primary text-sm"
        >
          ← Back to Engagements
        </button>
        <div className="text-ems-coral text-sm border border-ems-coral/30 rounded-lg px-3 py-2">
          {detailQuery.error ? friendlyApiError(detailQuery.error) : 'Engagement not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onNavigate('engagements')}
        className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1"
      >
        ← Back to Engagements
      </button>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary break-words">{row.displayTitle}</h1>
            <p className="text-xs text-text-muted mt-1">Engagement #{row.engagementId}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-44">
              <Select2
                options={statusSelectOptions}
                value={row.engagementStatus}
                onChange={handleStatusChange}
                placeholder="Status…"
                disabled={patchMutation.isPending}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} disabled={!lookupsQuery.data}>
              Edit details
            </Button>
            {row.appCreated && (
              <button
                type="button"
                onClick={() => setPendingDelete(true)}
                className="text-ems-coral text-xs hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-sm">
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Attraction</span>
            <span className="text-text-primary font-medium">{row.attractionName}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Tour</span>
            <span className="text-text-primary font-medium">{row.tourName ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Primary venue</span>
            <span className="text-text-primary font-medium">
              {row.venueCompanyName ?? row.venueName ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Location</span>
            <span className="text-text-secondary">
              {[row.city, row.stateProvince].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Market (DMA)</span>
            <span className="text-text-secondary">{row.dmaMarketName ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5">Scaling</span>
            <span className="text-text-secondary">{row.engagementScaling ?? '—'}</span>
          </div>
        </div>
      </div>

      <TabBar
        tabs={['Overview', 'Contacts', 'Dates', 'Audit Log']}
        active={tab}
        onChange={setTab}
      />

      {tab === 'Overview' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Notes (optional)</label>
            <textarea
              className="w-full min-h-[100px] bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ems-accent resize-y"
              placeholder="Add notes for your team…"
              value={overviewNotes}
              onChange={(e) => setOverviewNotes(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            <div>
              <span className="text-text-muted text-xs block mb-0.5">Deal type (optional)</span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">Guarantee (optional)</span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">Show date (optional)</span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">Booker (optional)</span>
              <span className="text-text-secondary">—</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Contacts' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Venue contacts</h3>
          {!venueId ? (
            <p className="text-sm text-text-muted">No primary venue is linked.</p>
          ) : venueContactsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contacts…
            </div>
          ) : venueContactsQuery.error ? (
            <p className="text-sm text-ems-coral">{friendlyApiError(venueContactsQuery.error)}</p>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border bg-surface">
                      <th className="text-left py-2 px-3">Name</th>
                      <th className="text-left py-2 px-3">Role</th>
                      <th className="text-left py-2 px-3">Email</th>
                      <th className="text-left py-2 px-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(venueContactsQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-text-muted text-sm">
                          No contacts for this venue.
                        </td>
                      </tr>
                    ) : (
                      (venueContactsQuery.data ?? []).map((c) => (
                        <tr key={c.contactAssignmentId} className="border-b border-border/50">
                          <td className="py-2 px-3 text-text-primary">
                            {c.firstName} {c.lastName}
                          </td>
                          <td className="py-2 px-3 text-text-secondary text-xs">
                            {c.roleName} · {c.departmentName}
                          </td>
                          <td className="py-2 px-3 text-ems-blue text-xs">{c.email}</td>
                          <td className="py-2 px-3 text-text-secondary text-xs">
                            {c.cellPhone || c.workPhone || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Tour contacts</h3>
            <p className="text-xs text-text-muted mb-2">
              Contacts for the talent agent company assigned to this tour.
            </p>
            {row.tourId == null ? (
              <p className="text-sm text-text-muted">No tour is linked to this engagement.</p>
            ) : lookupsQuery.isPending || lookupsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tour details…
              </div>
            ) : tourMgmtCompanyId === null ? (
              <p className="text-sm text-text-muted">
                No talent agent company is assigned to this tour.
              </p>
            ) : tourContactsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contacts…
              </div>
            ) : tourContactsQuery.error ? (
              <p className="text-sm text-ems-coral">{friendlyApiError(tourContactsQuery.error)}</p>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-text-muted text-xs border-b border-border bg-surface">
                        <th className="text-left py-2 px-3">Name</th>
                        <th className="text-left py-2 px-3">Role</th>
                        <th className="text-left py-2 px-3">Email</th>
                        <th className="text-left py-2 px-3">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tourContactsQuery.data ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-text-muted text-sm">
                            No contacts for this company.
                          </td>
                        </tr>
                      ) : (
                        (tourContactsQuery.data ?? []).map((c) => (
                          <tr key={c.contactAssignmentId} className="border-b border-border/50">
                            <td className="py-2 px-3 text-text-primary">
                              {c.firstName} {c.lastName}
                            </td>
                            <td className="py-2 px-3 text-text-secondary text-xs">
                              {c.roleName} · {c.departmentName}
                            </td>
                            <td className="py-2 px-3 text-ems-blue text-xs">{c.email}</td>
                            <td className="py-2 px-3 text-text-secondary text-xs">
                              {c.cellPhone || c.workPhone || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Dates' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Show dates & performances</h3>
              <p className="text-xs text-text-muted mt-1 max-w-xl">
                Add one row per show. An engagement can include multiple performances (multiple
                dates or times).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddPerformance(true)}
              className="inline-flex items-center justify-center shrink-0 bg-ems-accent text-background text-sm px-4 py-2 rounded-md font-medium hover:opacity-95"
            >
              + Add date
            </button>
          </div>
          {performancesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-text-muted text-sm py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading performances…
            </div>
          ) : performancesQuery.error ? (
            <p className="text-sm text-ems-coral">{friendlyApiError(performancesQuery.error)}</p>
          ) : (performancesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-text-muted py-4">
              No performances yet. Add a show date to create the first performance for this
              engagement.
            </p>
          ) : (
            <ul className="space-y-2">
              {(performancesQuery.data ?? []).map((p, idx) => (
                <li
                  key={p.performanceId}
                  className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg px-4 py-3 bg-surface/40"
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {formatPerformanceDateDisplay(p.performanceDate)}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      Show {formatPerformanceTimeDisplay(p.performanceTime)} · {p.performanceStatus}
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="text-xs font-medium bg-ems-accent/15 text-ems-accent px-2 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'Audit Log' && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-text-muted">
          No activity history is available in this app yet.
        </div>
      )}

      {showAddPerformance && (
        <Modal
          title="Add show date"
          onClose={() => !createPerformanceMut.isPending && setShowAddPerformance(false)}
          width={560}
          allowContentOverflow
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Door time and runtime help your team plan; only show date and curtain time are saved
              to the database today.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Show date" required>
                <input
                  type="date"
                  className={inputClsModal}
                  value={pfDate}
                  onChange={(e) => setPfDate(e.target.value)}
                />
              </FormField>
              <FormField label="Door time">
                <input
                  type="time"
                  className={inputClsModal}
                  value={pfDoor}
                  onChange={(e) => setPfDoor(e.target.value)}
                />
              </FormField>
              <FormField label="Show time" required>
                <input
                  type="time"
                  className={inputClsModal}
                  value={pfShow}
                  onChange={(e) => setPfShow(e.target.value)}
                />
              </FormField>
              <FormField label="Runtime (minutes)">
                <input
                  type="number"
                  min={0}
                  className={inputClsModal}
                  value={pfRuntime}
                  onChange={(e) => setPfRuntime(e.target.value)}
                />
              </FormField>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddPerformance(false)}
                disabled={createPerformanceMut.isPending}
                className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createPerformanceMut.isPending}
                onClick={() => {
                  if (!pfDate.trim()) {
                    addToast('Choose a show date.', 'warning');
                    return;
                  }
                  if (!pfShow.trim()) {
                    addToast('Choose a show time.', 'warning');
                    return;
                  }
                  createPerformanceMut.mutate({
                    performanceDate: pfDate,
                    performanceTime: pfShow,
                  });
                }}
                className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60"
              >
                {createPerformanceMut.isPending ? 'Saving…' : 'Add date'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && lookupsQuery.data && (
        <EditEngagementModal
          row={row}
          attractions={lookupsQuery.data.attractions}
          tours={lookupsQuery.data.tours}
          companies={lookupsQuery.data.companies}
          onClose={() => setShowEdit(false)}
          onSave={async (payload) => {
            await updateEngagement(engagementId, payload);
            await qc.invalidateQueries({ queryKey: ['engagements'] });
            await qc.invalidateQueries({ queryKey: ['engagements', engagementId] });
            addToast('Engagement updated.', 'success');
            setShowEdit(false);
          }}
          addToast={addToast}
        />
      )}

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this engagement?</AlertDialogTitle>
            <AlertDialogDescription>
              Only engagements created in this app can be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditEngagementModal({
  row,
  attractions,
  tours,
  companies,
  onClose,
  onSave,
  addToast,
}: {
  row: ApiEngagementListRow;
  attractions: { attractionId: number; attractionName: string }[];
  tours: { tourId: number; tourName: string; attractionId: number }[];
  companies: { companyId: number; companyName: string; companyTypeName: string }[];
  onClose: () => void;
  onSave: (p: import('@/api/engagementApi').UpdateEngagementPayload) => Promise<void>;
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

  const dealTypeOptions = useMemo(
    () => DEAL_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const statusOptions = useMemo(() => toOptions([...ENGAGEMENT_STATUS_ENUM]), []);

  const bookerOptions = useMemo(
    () => USERS.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })),
    [],
  );

  const [attractionId, setAttractionId] = useState(String(row.attractionId));
  const [tourId, setTourId] = useState<string>(row.tourId != null ? String(row.tourId) : '');
  const [primaryVenueId, setPrimaryVenueId] = useState<string>(
    String(row.primaryVenueCompanyId ?? venueCompanies[0]?.companyId ?? ''),
  );
  const [recordStatus, setRecordStatus] = useState(row.engagementStatus);
  const [engagementName, setEngagementName] = useState('');
  const [bookerId, setBookerId] = useState<string>('');
  const [dealType, setDealType] = useState(DEAL_TYPE_OPTIONS[0]?.value ?? 'Guarantee');
  const [guarantee, setGuarantee] = useState('');
  const [showDate, setShowDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const attractionIdNum = Number(attractionId);

  const toursForAttraction = useMemo(
    () => (Number.isFinite(attractionIdNum) ? tours.filter((t) => t.attractionId === attractionIdNum) : []),
    [tours, attractionIdNum],
  );

  const tourOptions = useMemo(
    () => toursForAttraction.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    [toursForAttraction],
  );

  const skipTourResetOnMount = useRef(true);
  useEffect(() => {
    if (skipTourResetOnMount.current) {
      skipTourResetOnMount.current = false;
      return;
    }
    setTourId('');
  }, [attractionId]);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';

  const handleSubmit = async () => {
    if (!recordStatus.trim() || recordStatus.length > 50) {
      addToast('Status is required (max 50 characters).', 'warning');
      return;
    }
    const tid = tourId ? Number(tourId) : null;
    if (tourId && !Number.isFinite(tid)) {
      addToast('Invalid tour.', 'warning');
      return;
    }
    if (!primaryVenueId) {
      addToast('Select a primary venue.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        engagementStatus: recordStatus.trim(),
        engagementScaling: null,
        attractionId: Number(attractionId),
        tourId: tid,
        primaryVenueCompanyId: Number(primaryVenueId),
      });
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Edit engagement" onClose={onClose} width={960} allowContentOverflow>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Status" required>
            <Select2 options={statusOptions} value={recordStatus} onChange={setRecordStatus} placeholder="Select status…" />
          </FormField>
          <FormField label="Engagement name (optional)">
            <input
              className={inputCls}
              value={engagementName}
              onChange={(e) => setEngagementName(e.target.value)}
              placeholder="Display name for your team"
              maxLength={300}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Attraction" required>
            <Select2
              options={attractionOptions}
              value={attractionId}
              onChange={setAttractionId}
              placeholder="Select attraction…"
            />
          </FormField>
          <FormField label="Tour (optional)">
            <Select2
              options={tourOptions}
              value={tourId}
              onChange={setTourId}
              placeholder="No tour"
              allowClear
              disabled={!attractionId}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Primary venue" required>
            <Select2
              options={venueOptions}
              value={primaryVenueId}
              onChange={setPrimaryVenueId}
              placeholder="Select venue…"
            />
          </FormField>
          <FormField label="Booker (optional)">
            <Select2
              options={bookerOptions}
              value={bookerId}
              onChange={setBookerId}
              placeholder="Select booker…"
              allowClear
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Deal type (optional)">
            <Select2 options={dealTypeOptions} value={dealType} onChange={setDealType} placeholder="Select…" />
          </FormField>
          <FormField label="Guarantee (optional)">
            <input
              type="number"
              className={inputCls}
              value={guarantee}
              onChange={(e) => setGuarantee(e.target.value)}
              min={0}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Show date (optional)">
            <input type="date" className={inputCls} value={showDate} onChange={(e) => setShowDate(e.target.value)} />
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
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
