/**
 * EngagementDetailPage – fully dynamic, end-to-end DB-driven.
 * All data comes from the API. No static/hardcoded content.
 *
 * DB chain: Engagement → Tour → Attraction (no direct Engagement.AttractionID)
 *           Engagement → EngagementVenue → Venue → Company → Address + DMA
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Engagement } from '@/data/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Building2,
  Star,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  MapPin,
  Tag,
} from 'lucide-react';
import { Modal, FormField, TabBar } from './Primitives';
import { Select2 } from './Select2';
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
  updateEngagementPerformance,
  deleteEngagementPerformance,
  type ApiEngagementListRow,
  type ApiEngagementVenueRow,
} from '@/api/engagementApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import {
  companiesPickerQueryKey,
  fetchCompanies,
  fetchCompaniesPickerRows,
  fetchCompanyContacts,
} from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { formatOpeningDateSafe, formatSqlTimeDisplay } from '@/lib/engagementDisplay';
import { ENGAGEMENT_STATUS_ENUM } from './engagementFormConstants';

const PERFORMANCE_STATUS_OPTIONS = ENGAGEMENT_STATUS_ENUM.map((s) => ({
  value: s,
  label: s,
}));

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

const inputCls =
  'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20 placeholder:text-text-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

// ---------------------------------------------------------------------------
// Legacy page (prototype string IDs)
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
          This engagement uses a local demo id. Use an engagement from the main list for full detail.
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
// Venues tab
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
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [pendingRemove, setPendingRemove] = useState<ApiEngagementVenueRow | null>(null);

  const venuesQuery = useQuery({
    queryKey: ['engagements', engagementId, 'venues'],
    queryFn: () => fetchEngagementVenues(engagementId),
  });

  const companiesQuery = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (venueCompanyId: number) =>
      addEngagementVenue(engagementId, { venueCompanyId, isPrimary: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'venues'] });
      addToast('Secondary venue added.', 'success');
      setShowAdd(false);
      setSelectedVenueId('');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not add venue.'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (venueCompanyId: number) => removeEngagementVenue(engagementId, venueCompanyId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'venues'] });
      addToast('Venue removed from engagement.', 'warning');
      setPendingRemove(null);
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not remove venue.'), 'error'),
  });

  const venues = venuesQuery.data ?? [];

  const availableVenueOptions = useMemo(() => {
    const existingIds = new Set(venues.map((v) => v.venueCompanyId));
    return (companiesQuery.data ?? [])
      .filter((c) => c.companyTypeName === 'Venue' && !existingIds.has(c.companyId))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
      .map((c) => ({ value: String(c.companyId), label: c.companyName }));
  }, [companiesQuery.data, venues]);

  if (venuesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading venues…
      </div>
    );
  }

  if (venuesQuery.error) {
    return (
      <div className="flex items-center gap-2 text-ems-coral text-sm py-4">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {friendlyApiError(venuesQuery.error)}
        <button
          type="button"
          onClick={() => venuesQuery.refetch()}
          className="text-xs underline ml-1"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Venues</h3>
          <p className="text-xs text-text-muted mt-0.5">
            The venue is set when this engagement is created. You can link additional venues below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(!showAdd); setSelectedVenueId(''); }}
          className="shrink-0 text-ems-accent text-sm hover:underline"
        >
          {showAdd ? 'Cancel' : '+ Add Secondary Venue'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-elevated border border-border rounded-lg p-4 space-y-3">
          {availableVenueOptions.length === 0 ? (
            <p className="text-sm text-text-muted">
              No additional venues available. All venue companies are already linked.
            </p>
          ) : (
            <>
              <p className="text-xs text-text-muted">
                Only Venue-type companies not already linked are shown.
              </p>
              <FormField label="Venue">
                <Select2
                  options={availableVenueOptions}
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
                  className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary"
                  disabled={addMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedVenueId || addMutation.isPending}
                  onClick={() => addMutation.mutate(Number(selectedVenueId))}
                  className="inline-flex items-center gap-1.5 bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-ems-accent/90 transition-colors"
                >
                  {addMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</>
                  ) : (
                    'Add Venue'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Venue list */}
      {venues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Building2 className="h-8 w-8 text-text-muted/50" />
          <p className="text-sm text-text-muted">No venue links found for this engagement.</p>
        </div>
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
              <div className="flex items-start gap-3 min-w-0">
                <Building2
                  className={`h-4 w-4 mt-0.5 shrink-0 ${v.isPrimary ? 'text-ems-accent' : 'text-text-muted'}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">
                      {v.venueCompanyName ?? `Company #${v.venueCompanyId}`}
                    </span>
                    {v.isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-ems-accent/15 text-ems-accent px-1.5 py-0.5 rounded font-medium shrink-0">
                        <Star className="h-2.5 w-2.5" />
                        Main
                      </span>
                    )}
                  </div>
                  {v.venueName && v.venueName !== v.venueCompanyName && (
                    <div className="text-xs text-text-secondary mt-0.5">{v.venueName}</div>
                  )}
                  {(v.city || v.stateProvince || v.dmaMarketName) && (
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[v.city, v.stateProvince].filter(Boolean).join(', ')}
                      {v.dmaMarketName ? ` · ${v.dmaMarketName}` : ''}
                    </div>
                  )}
                </div>
              </div>
              {!v.isPrimary && (
                <button
                  type="button"
                  onClick={() => setPendingRemove(v)}
                  disabled={removeMutation.isPending}
                  className="text-ems-coral text-xs hover:underline shrink-0 mt-0.5 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Remove confirm */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove venue?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{' '}
              <strong>{pendingRemove?.venueCompanyName ?? `Company #${pendingRemove?.venueCompanyId}`}</strong>{' '}
              from this engagement?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => pendingRemove && removeMutation.mutate(pendingRemove.venueCompanyId)}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable Performance Row
// ---------------------------------------------------------------------------
function EditablePerformanceRow({
  perf,
  isPrimary,
  engagementId,
  onRefresh,
  addToast,
}: {
  perf: {
    performanceId: number;
    performanceDate: string;
    performanceTime: string;
    performanceStatus: string;
  };
  isPrimary: boolean;
  engagementId: number;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(perf.performanceDate);
  const [time, setTime] = useState(perf.performanceTime.slice(0, 5));
  const [status, setStatus] = useState(perf.performanceStatus);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rowInputCls =
    'w-full bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';

  const handleSave = async () => {
    if (!date) { addToast('Date is required.', 'warning'); return; }
    if (!time) { addToast('Show time is required.', 'warning'); return; }
    setSaving(true);
    try {
      await updateEngagementPerformance(engagementId, perf.performanceId, {
        performanceDate: date,
        performanceTime: time,
        performanceStatus: status || 'Public',
      });
      addToast('Performance updated.', 'success');
      setEditing(false);
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEngagementPerformance(engagementId, perf.performanceId);
      addToast('Performance removed.', 'warning');
      setConfirmDelete(false);
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setDeleting(false); }
  };

  if (editing) {
    return (
      <li className="border border-ems-accent/40 rounded-lg px-4 py-3 bg-ems-accent/5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1 font-medium">Date *</label>
            <input
              type="date"
              className={rowInputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1 font-medium">Show Time *</label>
            <input
              type="time"
              className={rowInputCls}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1 font-medium">Status</label>
            <Select2
              options={PERFORMANCE_STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              placeholder="Status…"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => { setEditing(false); setDate(perf.performanceDate); setTime(perf.performanceTime.slice(0, 5)); setStatus(perf.performanceStatus); }}
            disabled={saving}
            className="text-text-secondary text-xs px-3 py-1.5 hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-ems-accent text-background text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-60 hover:bg-ems-accent/90 transition-colors"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      <li className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg px-4 py-3 bg-surface/40 group hover:border-border/80 transition-colors">
        <div className="flex items-start gap-3 min-w-0">
          <CalendarDays className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-text-primary">
              {formatPerformanceDateDisplay(perf.performanceDate)}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              Show {formatPerformanceTimeDisplay(perf.performanceTime)}
              {' · '}
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  perf.performanceStatus === 'Public'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-surface text-text-muted'
                }`}
              >
                {perf.performanceStatus}
              </span>
            </div>
            <div className="text-[10px] text-text-muted/60 mt-0.5 font-mono">
              ID: {perf.performanceId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPrimary && (
            <span className="text-xs font-medium bg-ems-accent/15 text-ems-accent px-2 py-0.5 rounded mr-1">
              First
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-text-muted hover:text-ems-accent px-2.5 py-1.5 rounded hover:bg-elevated opacity-0 group-hover:opacity-100 transition-all"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-text-muted hover:text-ems-coral px-2.5 py-1.5 rounded hover:bg-elevated opacity-0 group-hover:opacity-100 transition-all"
          >
            Delete
          </button>
        </div>
      </li>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete performance?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the performance on{' '}
              <strong>{formatPerformanceDateDisplay(perf.performanceDate)}</strong> at{' '}
              <strong>{formatPerformanceTimeDisplay(perf.performanceTime)}</strong>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                'Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Finance tab — UI-only (optional fields). Not sent to the API until DB supports it.
// ---------------------------------------------------------------------------
function EngagementFinancePanel() {
  const [loadIn, setLoadIn] = useState('');
  const [rehearsal, setRehearsal] = useState('');
  const [dealType, setDealType] = useState('');
  const [guarantee, setGuarantee] = useState('');
  const [splitPct, setSplitPct] = useState('');
  const [breakeven, setBreakeven] = useState('');
  const [grossPotential, setGrossPotential] = useState('');
  const [projectedGross, setProjectedGross] = useState('');
  const [projectedMargin, setProjectedMargin] = useState('');
  const [withholdingNotes, setWithholdingNotes] = useState('');

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-8">
      <div className="rounded-lg border border-ems-amber/30 bg-ems-amber/5 px-4 py-3 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">Preview only</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Production schedule</h3>
        <p className="text-xs text-text-muted mb-4">
          Planned: load-in and rehearsal dates on the engagement.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Load-in date" optional>
            <input
              type="date"
              className={inputCls}
              value={loadIn}
              onChange={(e) => setLoadIn(e.target.value)}
            />
          </FormField>
          <FormField label="Rehearsal date" optional>
            <input
              type="date"
              className={inputCls}
              value={rehearsal}
              onChange={(e) => setRehearsal(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Artist finance</h3>
        <p className="text-xs text-text-muted mb-4">Planned: dbo.ArtistFinance (per engagement).</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Deal type" optional>
            <input
              className={inputCls}
              value={dealType}
              onChange={(e) => setDealType(e.target.value)}
              placeholder="e.g. Guarantee vs split"
              maxLength={100}
            />
          </FormField>
          <FormField label="Guarantee" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={guarantee}
              onChange={(e) => setGuarantee(e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label="Split %" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={splitPct}
              onChange={(e) => setSplitPct(e.target.value)}
              placeholder="0–100"
            />
          </FormField>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Engagement finances</h3>
        <p className="text-xs text-text-muted mb-4">Planned: dbo.EngagementFinances.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Breakeven" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={breakeven}
              onChange={(e) => setBreakeven(e.target.value)}
            />
          </FormField>
          <FormField label="Gross potential" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={grossPotential}
              onChange={(e) => setGrossPotential(e.target.value)}
            />
          </FormField>
          <FormField label="Projected gross" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={projectedGross}
              onChange={(e) => setProjectedGross(e.target.value)}
            />
          </FormField>
          <FormField label="Projected margin" optional>
            <input
              className={inputCls}
              inputMode="decimal"
              value={projectedMargin}
              onChange={(e) => setProjectedMargin(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Tax &amp; withholding</h3>
        <p className="text-xs text-text-muted mb-4">
          Planned: link to dbo.NonResidentWithholding or equivalent on the engagement.
        </p>
        <FormField label="Notes (reference only)" optional>
          <input
            className={inputCls}
            value={withholdingNotes}
            onChange={(e) => setWithholdingNotes(e.target.value)}
            placeholder="e.g. rate / form reference — not saved"
          />
        </FormField>
      </div>
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

  // ── Data ────────────────────────────────────────────────────────────────
  const detailQuery = useQuery({
    queryKey: ['engagements', engagementId],
    queryFn: () => fetchEngagement(engagementId),
    retry: 2,
  });

  useEffect(() => {
    setTab('Overview');
  }, [engagementId]);

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
    staleTime: 60_000,
  });

  const venueId = detailQuery.data?.primaryVenueCompanyId;

  const tourMgmtCompanyId = useMemo(() => {
    const r = detailQuery.data;
    if (r?.tourId == null) return null as number | null;
    const tours = lookupsQuery.data?.tours;
    if (tours === undefined) return undefined as unknown as number | null;
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

  // ── Status inline patch ─────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateEngagement>[1]) =>
      updateEngagement(engagementId, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId] });
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  // ── Delete ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteEngagement(engagementId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      addToast('Engagement deleted.', 'warning');
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

  const statusSelectOptions = useMemo(
    () => ENGAGEMENT_STATUS_ENUM.map((s) => ({ value: s, label: s })),
    [],
  );

  // ── Performances ────────────────────────────────────────────────────────
  const performancesQuery = useQuery({
    queryKey: ['engagements', engagementId, 'performances'],
    queryFn: () => fetchEngagementPerformances(engagementId),
    enabled: tab === 'Dates',
  });

  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [pfDate, setPfDate] = useState('');
  const [pfTime, setPfTime] = useState('20:00');
  const [pfStatus, setPfStatus] = useState('Public');
  const [pfErrors, setPfErrors] = useState<{ date?: string; time?: string }>({});

  const createPerformanceMut = useMutation({
    mutationFn: (body: { performanceDate: string; performanceTime: string; performanceStatus: string }) =>
      createEngagementPerformance(engagementId, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'performances'] });
      addToast('Show date saved.', 'success');
      setShowAddPerformance(false);
      setPfDate('');
      setPfTime('20:00');
      setPfStatus('Public');
      setPfErrors({});
    },
    onError: (e: unknown) => addToast(friendlyApiError(e), 'error'),
  });

  const handleAddPerformance = () => {
    const errs: { date?: string; time?: string } = {};
    if (!pfDate.trim()) errs.date = 'Date is required.';
    if (!pfTime.trim()) errs.time = 'Show time is required.';
    if (Object.keys(errs).length) {
      setPfErrors(errs);
      return;
    }
    setPfErrors({});
    createPerformanceMut.mutate({
      performanceDate: pfDate,
      performanceTime: pfTime,
      performanceStatus: pfStatus || 'Public',
    });
  };

  // ── Loading / Error states ──────────────────────────────────────────────
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
        <div className="flex items-start gap-3 text-sm text-ems-coral border border-ems-coral/30 rounded-lg px-4 py-3 bg-ems-coral-dim">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Could not load engagement</p>
            <p className="text-xs text-ems-coral/80 mt-0.5">
              {detailQuery.error ? friendlyApiError(detailQuery.error) : 'Engagement not found.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => detailQuery.refetch()}
            className="flex items-center gap-1 text-xs hover:underline shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => onNavigate('engagements')}
        className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1 transition-colors"
      >
        ← Back to Engagements
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-lg font-bold text-text-primary leading-tight">
              {row.attractionName ?? row.tourName}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {row.attractionName && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Tag className="h-3.5 w-3.5 text-text-muted" />
                  {row.tourName}
                </span>
              )}
              {(row.venueCompanyName ?? row.venueName) && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-text-muted" />
                  {row.venueCompanyName ?? row.venueName}
                </span>
              )}
              {(row.city || row.stateProvince) && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <MapPin className="h-3.5 w-3.5 text-text-muted" />
                  {[row.city, row.stateProvince].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Engagement #{row.engagementId}
              {row.dmaMarketName ? ` · ${row.dmaMarketName}` : ''}
            </p>
          </div>

          {/* Action area */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="w-44">
              <Select2
                options={statusSelectOptions}
                value={row.engagementStatus}
                onChange={handleStatusChange}
                placeholder="Status…"
                disabled={patchMutation.isPending}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
              disabled={!lookupsQuery.data || lookupsQuery.isPending}
            >
              {lookupsQuery.isPending ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </span>
              ) : (
                'Edit details'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(true)}
              disabled={deleteMutation.isPending}
              className="border-ems-coral/40 text-ems-coral hover:bg-ems-coral-dim hover:text-ems-coral"
            >
              Delete Engagement
            </Button>
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border text-sm">
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">Attraction</span>
            <span className="text-text-primary">{row.attractionName ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">Tour</span>
            <span className="text-text-primary">{row.tourName ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">Venue</span>
            <span className="text-text-primary">
              {row.venueCompanyName ?? row.venueName ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">Location</span>
            <span className="text-text-secondary">
              {[row.city, row.stateProvince].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">Market (DMA)</span>
            <span className="text-text-secondary">{row.dmaMarketName ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs block mb-0.5 font-medium">
              Opening show date and time
            </span>
            <span className="text-text-secondary">
              {row.openingPerformanceDate && row.openingPerformanceTime
                ? `${formatOpeningDateSafe(row.openingPerformanceDate)} · ${formatSqlTimeDisplay(row.openingPerformanceTime)}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={['Overview', 'Venues', 'Contacts', 'Dates', 'Finance', 'Audit Log']}
        active={tab}
        onChange={setTab}
      />

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-text-muted text-xs block mb-1 font-medium">Engagement</span>
              <span className="text-text-primary text-sm">{row.displayTitle || '—'}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-1 font-medium">Status</span>
              <span className="text-text-primary">{row.engagementStatus}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-1 font-medium">Tour</span>
              <span className="text-text-primary">{row.tourName || '—'}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block mb-1 font-medium">Venue</span>
              <span className="text-text-primary">
                {row.venueCompanyName ?? row.venueName ?? '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Venues ───────────────────────────────────────────────────────── */}
      {tab === 'Venues' && (
        <div className="bg-card border border-border rounded-lg p-5">
          <VenuesTab engagementId={engagementId} addToast={addToast} />
        </div>
      )}

      {/* ── Contacts ─────────────────────────────────────────────────────── */}
      {tab === 'Contacts' && (
        <div className="space-y-6">
          {/* Venue contacts */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Venue contacts</h3>
            {!venueId ? (
              <p className="text-sm text-text-muted">No venue is linked.</p>
            ) : venueContactsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contacts…
              </div>
            ) : venueContactsQuery.error ? (
              <p className="text-sm text-ems-coral">{friendlyApiError(venueContactsQuery.error)}</p>
            ) : (
              <ContactsTable contacts={venueContactsQuery.data ?? []} />
            )}
          </div>

          {/* Tour management contacts */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Tour management contacts</h3>
            <p className="text-xs text-text-muted mb-3">
              Contacts for the Tour Management Company assigned to this tour.
            </p>
            {row.tourId == null ? (
              <p className="text-sm text-text-muted">No tour linked.</p>
            ) : lookupsQuery.isPending ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tour details…
              </div>
            ) : tourMgmtCompanyId === null ? (
              <p className="text-sm text-text-muted">
                No Tour Management Company assigned to this tour.
              </p>
            ) : tourContactsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contacts…
              </div>
            ) : tourContactsQuery.error ? (
              <p className="text-sm text-ems-coral">{friendlyApiError(tourContactsQuery.error)}</p>
            ) : (
              <ContactsTable contacts={tourContactsQuery.data ?? []} />
            )}
          </div>
        </div>
      )}

      {/* ── Dates ────────────────────────────────────────────────────────── */}
      {tab === 'Dates' && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Show dates & performances</h3>
              <p className="text-xs text-text-muted mt-1">Each row is one show date and time.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAddPerformance(true); setPfErrors({}); }}
              className="inline-flex items-center justify-center shrink-0 bg-ems-accent text-background text-sm px-4 py-2 rounded-md font-medium hover:bg-ems-accent/90 transition-colors"
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
            <div className="flex items-center gap-2 text-ems-coral text-sm py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {friendlyApiError(performancesQuery.error)}
              <button
                type="button"
                onClick={() => performancesQuery.refetch()}
                className="text-xs underline ml-1"
              >
                Retry
              </button>
            </div>
          ) : (performancesQuery.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="h-8 w-8 text-text-muted/50" />
              <p className="text-sm text-text-muted">
                No performances yet. Add a show date to get started.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {(performancesQuery.data ?? []).map((p, idx) => (
                <EditablePerformanceRow
                  key={p.performanceId}
                  perf={p}
                  isPrimary={idx === 0}
                  engagementId={engagementId}
                  onRefresh={() =>
                    qc.invalidateQueries({
                      queryKey: ['engagements', engagementId, 'performances'],
                    })
                  }
                  addToast={addToast}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Finance & logistics ─────────────────────────────────────────── */}
      {tab === 'Finance' && <EngagementFinancePanel />}

      {/* ── Audit Log ────────────────────────────────────────────────────── */}
      {tab === 'Audit Log' && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-text-muted">
          No activity history is available yet.
        </div>
      )}

      {/* ── Add performance modal ─────────────────────────────────────────── */}
      {showAddPerformance && (
        <Modal
          title="Add show date"
          onClose={() => !createPerformanceMut.isPending && setShowAddPerformance(false)}
          width={520}
          allowContentOverflow
        >
          <div className="space-y-0">
            {/* Row 1: Date + Show Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
              <FormField label="Show date" required>
                <input
                  type="date"
                  className={inputCls}
                  value={pfDate}
                  onChange={(e) => { setPfDate(e.target.value); setPfErrors((p) => ({ ...p, date: undefined })); }}
                />
                {pfErrors.date && (
                  <p className="mt-1 text-xs text-ems-coral">{pfErrors.date}</p>
                )}
              </FormField>

              <FormField label="Show / curtain time" required>
                <input
                  type="time"
                  className={inputCls}
                  value={pfTime}
                  onChange={(e) => { setPfTime(e.target.value); setPfErrors((p) => ({ ...p, time: undefined })); }}
                />
                {pfErrors.time && (
                  <p className="mt-1 text-xs text-ems-coral">{pfErrors.time}</p>
                )}
              </FormField>
            </div>

            <div className="border-t border-border/60 pb-5" />

            {/* Row 2: Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-5">
              <FormField label="Status">
                <Select2
                  options={PERFORMANCE_STATUS_OPTIONS}
                  value={pfStatus}
                  onChange={setPfStatus}
                  placeholder="Select status…"
                />
              </FormField>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddPerformance(false)}
                disabled={createPerformanceMut.isPending}
                className="text-text-secondary text-sm px-4 py-2 rounded-md hover:text-text-primary hover:bg-hover disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createPerformanceMut.isPending}
                onClick={handleAddPerformance}
                className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent text-background text-sm px-5 py-2 rounded-md font-medium disabled:opacity-60 hover:bg-ems-accent/90 transition-colors"
              >
                {createPerformanceMut.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Add date'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
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

      {/* ── Delete confirm (same pattern as Companies) ─────────────────── */}
      <AlertDialog
        open={pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setPendingDelete(false);
        }}
      >
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">
              Remove this engagement?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              You’re about to remove{' '}
              <span className="font-medium text-text-primary">
                {row.displayTitle}
              </span>{' '}
              (engagement <span className="font-mono tabular-nums">#{row.engagementId}</span>) from
              your list. If something blocks the removal, you’ll see a short explanation right
              after you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.isPending && (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-ems-accent"
                aria-hidden
              />
              <span>Removing engagement…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="border-border bg-elevated text-text-primary hover:bg-hover mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => void deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Yes, remove engagement'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts table (shared)
// ---------------------------------------------------------------------------
function ContactsTable({
  contacts,
}: {
  contacts: {
    contactAssignmentId: number;
    firstName: string;
    lastName: string;
    email: string;
    cellPhone?: string | null;
    workPhone?: string | null;
    roleName: string;
    departmentName: string;
  }[];
}) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-text-muted py-2">No contacts found.</p>
    );
  }
  return (
    <div className="bg-elevated border border-border rounded-lg overflow-hidden">
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
            {contacts.map((c) => (
              <tr key={c.contactAssignmentId} className="border-b border-border/50 hover:bg-hover">
                <td className="py-2 px-3 text-text-primary font-medium">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit engagement modal
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
    () =>
      companies
        .filter((c) => c.companyTypeName === 'Venue')
        .sort((a, b) =>
          a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }),
        ),
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
    () =>
      sortedAttractions.map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
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
  const [tourId, setTourId] = useState<string>(row.tourId != null ? String(row.tourId) : '');
  const [primaryVenueId, setPrimaryVenueId] = useState<string>(
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
            .sort((a, b) =>
              a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' }),
            )
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

  const handleSubmit = async () => {
    if (!validate()) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        engagementStatus: recordStatus,
        tourId: Number(tourId),
        primaryVenueCompanyId: Number(primaryVenueId),
      });
    } catch (e) {
      addToast(friendlyApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Edit engagement" onClose={onClose} width={720} allowContentOverflow>
      <div className="flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
          <div className="sm:col-span-2">
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
          </div>

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
            {errors.tour && (
              <p className="mt-1 text-xs text-ems-coral">{errors.tour}</p>
            )}
          </FormField>

          <div className="sm:col-span-2">
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
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-6 mt-2 border-t border-border">
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