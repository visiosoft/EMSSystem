/**
 * EngagementDetailPage – Updated to support:
 *   1. dbo.EngagementVenue list (primary + secondary venues with IsPrimary flag)
 *   2. dbo.EngagementScaling display and edit
 *   3. DB-aligned field labels
 *   4. Frontend-only fields kept as optional
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Engagement } from '@/data/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Building2, Star } from 'lucide-react';
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
  fetchEngagementVenues,
  addEngagementVenue,
  removeEngagementVenue,
  updateEngagement,
  type ApiEngagementListRow,
  type ApiEngagementVenueRow,
} from '@/api/engagementApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import { fetchCompanies, fetchCompanyContacts } from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { DEAL_TYPE_OPTIONS, USERS } from '@/data/constants';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Legacy detail page (for prototype string IDs)
// ---------------------------------------------------------------------------

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
          This engagement uses a local demo id. Use an engagement from the main list for full
          detail.
        </p>
        <h1 className="text-lg font-semibold text-text-primary">{engagement.name}</h1>
        <p className="text-xs text-text-muted">ID {engagement.id}</p>
        <div className="text-sm text-text-secondary pt-2 border-t border-border">
          Status: {engagement.status}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venues tab – dbo.EngagementVenue
// ---------------------------------------------------------------------------

function VenuesTab({
  engagementId,
  addToast,
}: {
  engagementId: number;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const venuesQuery = useQuery({
    queryKey: ['engagements', engagementId, 'venues'],
    queryFn: () => fetchEngagementVenues(engagementId),
  });

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { fetchCompanies: fc } = await import('@/api/companyApi');
      return fc();
    },
  });

  const addMutation = useMutation({
    mutationFn: (venueCompanyId: number) =>
      addEngagementVenue(engagementId, { venueCompanyId, isPrimary: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'venues'] });
      addToast('Secondary venue added.', 'success');
      setShowAdd(false);
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not add venue.'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (venueCompanyId: number) =>
      removeEngagementVenue(engagementId, venueCompanyId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'venues'] });
      addToast('Venue removed from engagement.', 'warning');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not remove venue.'), 'error'),
  });

  const venues = venuesQuery.data ?? [];
  const venueOptions = useMemo(() => {
    const existingIds = new Set(venues.map((v) => v.venueCompanyId));
    return (companiesQuery.data ?? [])
      .filter((c) => c.companyTypeName === 'Venue' && !existingIds.has(c.companyId))
      .map((c) => ({ value: String(c.companyId), label: c.companyName }));
  }, [companiesQuery.data, venues]);

  const [selectedVenueId, setSelectedVenueId] = useState('');

  if (venuesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading venues…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Venues (dbo.EngagementVenue)</h3>
          <p className="text-xs text-text-muted mt-0.5">
            The DB supports multiple venues per engagement. The primary venue (IsPrimary = 1) is
            set at creation. Secondary venues can be added below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="text-ems-accent text-sm hover:underline"
        >
          + Add Secondary Venue
        </button>
      </div>

      {/* Add venue form */}
      {showAdd && (
        <div className="bg-elevated border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs text-text-muted">
            Select a venue to add as a secondary venue. Only Venue-type companies are shown.
          </p>
          <FormField label="Venue">
            <Select2
              options={venueOptions}
              value={selectedVenueId}
              onChange={setSelectedVenueId}
              placeholder="Select venue…"
              disabled={addMutation.isPending}
            />
          </FormField>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setSelectedVenueId(''); }}
              className="text-text-secondary text-sm px-3 py-1.5"
              disabled={addMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedVenueId || addMutation.isPending}
              onClick={() => addMutation.mutate(Number(selectedVenueId))}
              className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding…' : 'Add Venue'}
            </button>
          </div>
        </div>
      )}

      {/* Venue list */}
      {venues.length === 0 ? (
        <p className="text-sm text-text-muted py-4">
          No venue links found. Check that EngagementVenue rows exist for this engagement.
        </p>
      ) : (
        <div className="space-y-2">
          {venues.map((v) => (
            <div
              key={v.venueCompanyId}
              className={`flex items-start justify-between border rounded-lg px-4 py-3 ${
                v.isPrimary
                  ? 'border-ems-accent/40 bg-ems-accent-dim/20'
                  : 'border-border bg-surface/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <Building2
                  className={`h-4 w-4 mt-0.5 shrink-0 ${v.isPrimary ? 'text-ems-accent' : 'text-text-muted'}`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {v.venueCompanyName ?? `Company #${v.venueCompanyId}`}
                    </span>
                    {v.isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-ems-accent/15 text-ems-accent px-1.5 py-0.5 rounded font-medium">
                        <Star className="h-2.5 w-2.5" />
                        Primary
                      </span>
                    )}
                  </div>
                  {v.venueName && v.venueName !== v.venueCompanyName && (
                    <div className="text-xs text-text-secondary">{v.venueName}</div>
                  )}
                  {(v.city || v.stateProvince) && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {[v.city, v.stateProvince].filter(Boolean).join(', ')}
                      {v.dmaMarketName ? ` · ${v.dmaMarketName}` : ''}
                    </div>
                  )}
                  <div className="text-[10px] text-text-muted mt-1 font-mono">
                    VenueCompanyID: {v.venueCompanyId} · IsPrimary: {v.isPrimary ? '1' : '0'}
                  </div>
                </div>
              </div>
              {!v.isPrimary && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(v.venueCompanyId)}
                  disabled={removeMutation.isPending}
                  className="text-ems-coral text-xs hover:underline shrink-0 mt-0.5"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail page
// ---------------------------------------------------------------------------

interface Props {
  engagementId: number;
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function EngagementDetailPage({ engagementId, onNavigate, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [showEdit, setShowEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
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
      { onSuccess: () => addToast('Status updated.', 'success') },
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

      {/* Header card */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary break-words">
              {row.displayTitle}
            </h1>
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

        {/* DB fields grid */}
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
            <span className="text-text-muted text-xs block mb-0.5">
              Scaling{' '}
              <span className="text-text-muted/60 font-normal">(dbo.Engagement.EngagementScaling)</span>
            </span>
            <span className="text-text-secondary">{row.engagementScaling ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={['Overview', 'Venues', 'Contacts', 'Dates', 'Audit Log']}
        active={tab}
        onChange={setTab}
      />

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Notes (optional – frontend only, not stored in dbo.Engagement)
            </label>
            <textarea
              className="w-full min-h-[100px] bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ems-accent resize-y"
              placeholder="Add notes for your team…"
              value={overviewNotes}
              onChange={(e) => setOverviewNotes(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            <div>
              <span className="text-text-muted text-xs block mb-0.5">
                Deal type{' '}
                <span className="text-text-muted/60">(maps to dbo.ArtistFinance.ArtistDealType)</span>
              </span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">
                Guarantee{' '}
                <span className="text-text-muted/60">(maps to dbo.ArtistFinance.ArtistGuarantee)</span>
              </span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">
                Breakeven{' '}
                <span className="text-text-muted/60">(maps to dbo.EngagementFinances.EstimatedBreakeven)</span>
              </span>
              <span className="text-text-secondary">—</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-0.5">
                Gross potential{' '}
                <span className="text-text-muted/60">(dbo.EngagementFinances.GrossPotential)</span>
              </span>
              <span className="text-text-secondary">—</span>
            </div>
          </div>
        </div>
      )}

      {/* Venues */}
      {tab === 'Venues' && (
        <div className="bg-card border border-border rounded-lg p-4">
          <VenuesTab engagementId={engagementId} addToast={addToast} />
        </div>
      )}

      {/* Contacts */}
      {tab === 'Contacts' && (
        <div className="space-y-6">
          {/* Venue contacts */}
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

          {/* Tour contacts */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Tour contacts</h3>
            <p className="text-xs text-text-muted mb-2">
              Contacts for the Tour Management Company assigned to this tour.
            </p>
            {row.tourId == null ? (
              <p className="text-sm text-text-muted">No tour is linked to this engagement.</p>
            ) : lookupsQuery.isPending ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tour details…
              </div>
            ) : tourMgmtCompanyId === null ? (
              <p className="text-sm text-text-muted">
                No Tour Management Company is assigned to this tour.
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

      {/* Dates */}
      {tab === 'Dates' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Show dates &amp; performances
              </h3>
              <p className="text-xs text-text-muted mt-1 max-w-xl">
                Each row = one dbo.Performance record (PerformanceDate + PerformanceTime, both
                required by DB). One engagement can have multiple performances.
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
              No performances yet. Add a show date to create the first performance.
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
                      Show {formatPerformanceTimeDisplay(p.performanceTime)} ·{' '}
                      {p.performanceStatus}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5 font-mono">
                      PerformanceID: {p.performanceId}
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

      {/* Audit Log */}
      {tab === 'Audit Log' && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-text-muted">
          No activity history is available in this app yet.
        </div>
      )}

      {/* Add performance modal */}
      {showAddPerformance && (
        <Modal
          title="Add show date"
          onClose={() => !createPerformanceMut.isPending && setShowAddPerformance(false)}
          width={560}
          allowContentOverflow
        >
          <div className="space-y-4">
            <div className="text-xs text-text-muted bg-elevated border border-border/50 rounded-md px-3 py-2">
              <strong className="text-text-secondary">DB fields saved:</strong> PerformanceDate,
              PerformanceTime, PerformanceStatus (default "Public"). Door time and runtime are
              frontend-only planning fields.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Show date (required)" required>
                <input
                  type="date"
                  className={inputClsModal}
                  value={pfDate}
                  onChange={(e) => setPfDate(e.target.value)}
                />
              </FormField>
              <FormField label="Door time (frontend only)">
                <input
                  type="time"
                  className={inputClsModal}
                  value={pfDoor}
                  onChange={(e) => setPfDoor(e.target.value)}
                />
              </FormField>
              <FormField label="Show / curtain time (required)" required>
                <input
                  type="time"
                  className={inputClsModal}
                  value={pfShow}
                  onChange={(e) => setPfShow(e.target.value)}
                />
              </FormField>
              <FormField label="Runtime minutes (frontend only)">
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

      {/* Edit modal */}
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

      {/* Delete dialog */}
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

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

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
        .sort((a, b) =>
          a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }),
        )
        .map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [attractions],
  );

  const venueOptions = useMemo(
    () =>
      [...venueCompanies]
        .sort((a, b) =>
          a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }),
        )
        .map((v) => ({ value: String(v.companyId), label: v.companyName })),
    [venueCompanies],
  );

  const statusOptions = useMemo(() => toOptions([...ENGAGEMENT_STATUS_ENUM]), []);
  const bookerOptions = useMemo(
    () => USERS.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })),
    [],
  );
  const dealTypeOptions = useMemo(
    () => DEAL_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const [attractionId, setAttractionId] = useState(
    row.attractionId != null ? String(row.attractionId) : '',
  );
  const [tourId, setTourId] = useState<string>(row.tourId != null ? String(row.tourId) : '');
  const [primaryVenueId, setPrimaryVenueId] = useState<string>(
    String(row.primaryVenueCompanyId ?? venueCompanies[0]?.companyId ?? ''),
  );
  const [recordStatus, setRecordStatus] = useState(row.engagementStatus);
  const [engagementScaling, setEngagementScaling] = useState(row.engagementScaling ?? '');
  // FRONTEND-ONLY fields
  const [bookerId, setBookerId] = useState<string>('');
  const [dealType, setDealType] = useState(DEAL_TYPE_OPTIONS[0]?.value ?? 'Guarantee');
  const [guarantee, setGuarantee] = useState('');
  const [showDate, setShowDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const attractionIdNum = Number(attractionId);
  const toursForAttraction = useMemo(
    () =>
      attractionId && Number.isFinite(attractionIdNum)
        ? tours.filter((t) => t.attractionId === attractionIdNum)
        : [],
    [tours, attractionId, attractionIdNum],
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
        engagementScaling: engagementScaling.trim() || null,
        tourId: tid ?? undefined,
        primaryVenueCompanyId: Number(primaryVenueId),
        // FRONTEND-ONLY fields
        dealType: dealType || null,
        guarantee: guarantee ? Number(guarantee) : null,
        showDate: showDate || null,
        bookerId: bookerId || null,
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
        {/* DB-backed fields */}
        <div className="rounded-lg border border-border/50 bg-elevated/30 px-4 py-3">
          <p className="text-[11px] text-text-muted mb-3 font-medium uppercase tracking-wide">
            DB-backed fields (dbo.Engagement + dbo.EngagementVenue)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Status" required>
              <Select2
                options={statusOptions}
                value={recordStatus}
                onChange={setRecordStatus}
                placeholder="Select status…"
              />
            </FormField>
            <FormField label="Scaling (EngagementScaling)">
              <input
                className={inputCls}
                value={engagementScaling}
                onChange={(e) => setEngagementScaling(e.target.value)}
                placeholder="e.g. GA, Reserved, Mixed"
                maxLength={50}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <FormField label="Filter by Attraction (optional)">
              <Select2
                options={attractionOptions}
                value={attractionId}
                onChange={setAttractionId}
                placeholder="Select attraction…"
              />
            </FormField>
            <FormField label="Tour" required>
              <Select2
                options={tourOptions.length
                  ? tourOptions
                  : [{ value: '', label: attractionId ? 'No tours for this attraction' : 'Select attraction first…' }]}
                value={tourId}
                onChange={setTourId}
                placeholder="No tour"
                allowClear
                disabled={!attractionId}
              />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Primary venue (EngagementVenue, IsPrimary=1)" required>
              <Select2
                options={venueOptions}
                value={primaryVenueId}
                onChange={setPrimaryVenueId}
                placeholder="Select venue…"
              />
            </FormField>
          </div>
        </div>

        {/* Frontend-only fields */}
        <div className="rounded-lg border border-dashed border-border px-4 py-3">
          <p className="text-[11px] text-text-muted mb-3 font-medium uppercase tracking-wide">
            Frontend-only fields (not in dbo.Engagement — backend may persist separately)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Booker (optional)">
              <Select2
                options={bookerOptions}
                value={bookerId}
                onChange={setBookerId}
                placeholder="Select booker…"
                allowClear
              />
            </FormField>
            <FormField label="Show date (optional)">
              <input
                type="date"
                className={inputCls}
                value={showDate}
                onChange={(e) => setShowDate(e.target.value)}
              />
            </FormField>
            <FormField label="Deal type (optional)">
              <Select2
                options={dealTypeOptions}
                value={dealType}
                onChange={setDealType}
                placeholder="Select…"
              />
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