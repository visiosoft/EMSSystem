/**
 * ProjectsPage – Fully dynamic, API-driven.
 * Pattern matches CompaniesPage exactly:
 *   - useQuery / useMutation from @tanstack/react-query
 *   - DataTable with search, stage filter, pagination
 *   - Auto-reload after every CRUD (invalidateQueries)
 *   - Disabled buttons / spinners while loading
 *   - Success/error toasts
 *   - AlertDialog for delete confirmation
 *   - Drawer for project detail + venues + date options
 *   - Modals for create / edit
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
  ActionMenu,
  Drawer,
  FormField,
  Modal,
  SearchInput,
  StatusBadge,
  TabBar,
} from './Primitives';
import { Select2 } from './Select2';
import { friendlyApiError } from '@/lib/friendlyApiError';
import {
  createPerformanceOption,
  createProject,
  createProjectVenue,
  deletePerformanceOption,
  deleteProject,
  deleteProjectVenue,
  fetchProject,
  fetchProjects,
  updatePerformanceOption,
  updateProject,
  updateProjectVenue,
  OPTION_STATUS_VALUES,
  PROJECT_STAGE_VALUES,
  VENUE_STATUS_VALUES,
} from '@/api/projectApi';
import type {
  ApiPerformanceOption,
  ApiProjectListRow,
  ApiProjectVenue,
  OptionStatus,
  ProjectStage,
  VenueStatus,
} from '@/api/projectApi';
import { fetchAttractions, fetchTours } from '@/api/attractionToursApi';
import { fetchCompanies } from '@/api/companyApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STAGE_FILTER_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'OffersSent', label: 'Offers Sent' },
  { value: 'PartiallyBooked', label: 'Partially Booked' },
  { value: 'FullyBooked', label: 'Fully Booked' },
  { value: 'Dead', label: 'Inactive' },
];

const PROJECT_STAGE_LABEL: Record<string, string> = {
  Active: 'Active', OffersSent: 'Offers Sent',
  PartiallyBooked: 'Partially Booked', FullyBooked: 'Fully Booked', Dead: 'Dead',
};

const PROJECT_STAGE_OPTIONS = PROJECT_STAGE_VALUES.map((v) => ({
  value: v, label: PROJECT_STAGE_LABEL[v] ?? v,
}));
const VENUE_STATUS_OPTIONS = VENUE_STATUS_VALUES.map((v) => ({ value: v, label: v }));
const OPTION_STATUS_OPTIONS = OPTION_STATUS_VALUES.map((v) => ({ value: v, label: v }));

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  // These props keep legacy Index.tsx calls working without errors
  projects?: unknown; engagements?: unknown; tours?: unknown; attractions?: unknown;
  companies?: unknown; contacts?: unknown; dmas?: unknown; users?: unknown;
  onNavigate?: (view: string, data?: unknown) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreateEngagement?: unknown; onUpdateProjects?: unknown; onDeleteProject?: unknown;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectsTableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden min-h-[28rem]" role="status" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-border bg-surface/40">
        <Loader2 className="h-11 w-11 text-ems-accent animate-spin shrink-0" aria-hidden />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-sm font-semibold text-text-primary">Loading projects</p>
          <p className="text-xs text-text-muted leading-relaxed">Fetching records from the database…</p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              {['ID', 'Attraction', 'Tour', 'Stage', 'Created By', 'Created', ''].map((h, i) => (
                <th key={i} className="text-left py-2.5 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-24 bg-muted/80" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Performance option row ───────────────────────────────────────────────────

function PerformanceOptionRow({
  opt, projectId, onRefresh, addToast,
}: {
  opt: ApiPerformanceOption; projectId: number;
  onRefresh: () => void; addToast: Props['addToast'];
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(opt.proposedDate);
  const [time, setTime] = useState(opt.proposedTime ?? '');
  const [status, setStatus] = useState<OptionStatus>(opt.optionStatus);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inputCls = 'w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-ems-accent';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePerformanceOption(projectId, opt.performanceOptionId, {
        proposedDate: date, proposedTime: time || null, optionStatus: status,
      });
      addToast('Date option updated.', 'success');
      setEditing(false);
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update option.'), 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePerformanceOption(projectId, opt.performanceOptionId);
      addToast('Date option removed.', 'warning');
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not remove option.'), 'error');
    } finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <div className="bg-elevated border border-border rounded p-2 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <FormField label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
          <FormField label="Time"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></FormField>
          <FormField label="Status"><Select2 options={OPTION_STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as OptionStatus)} /></FormField>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-text-secondary text-xs px-2 py-1 hover:text-text-primary disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1 bg-ems-accent text-background text-xs px-3 py-1 rounded disabled:opacity-60">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-elevated/50 rounded px-2 py-1.5 text-xs group">
      <span className="text-text-primary font-medium">{opt.proposedDate}</span>
      {opt.proposedTime && <span className="text-text-muted">· {opt.proposedTime}</span>}
      <span className="ml-auto"><StatusBadge status={opt.optionStatus} /></span>
      <button type="button" onClick={() => setEditing(true)} className="text-text-muted hover:text-ems-accent opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">Edit</button>
      <button type="button" onClick={() => void handleDelete()} disabled={deleting}
        className="text-text-muted hover:text-ems-coral opacity-0 group-hover:opacity-100 transition-opacity text-[10px] disabled:opacity-50">
        {deleting ? '…' : '✕'}
      </button>
    </div>
  );
}

// ─── Add Performance Option form ──────────────────────────────────────────────

function AddPerformanceOptionForm({
  projectId, onAdded, onCancel, addToast,
}: {
  projectId: number; onAdded: () => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<OptionStatus>('Proposed');
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const handleSave = async () => {
    if (!date) { addToast('Date is required.', 'warning'); return; }
    setSaving(true);
    try {
      await createPerformanceOption(projectId, { proposedDate: date, proposedTime: time || null, optionStatus: status });
      addToast('Date option added.', 'success');
      onAdded();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not add option.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-elevated border border-border rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Date" required><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        <FormField label="Time (optional)"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></FormField>
        <FormField label="Option Status" required><Select2 options={OPTION_STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as OptionStatus)} /></FormField>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center gap-2 bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add Date Option
        </button>
      </div>
    </div>
  );
}

// ─── Venue Proposal Row ───────────────────────────────────────────────────────

function VenueProposalRow({
  venue, projectId, onRefresh, addToast,
}: {
  venue: ApiProjectVenue; projectId: number;
  onRefresh: () => void; addToast: Props['addToast'];
}) {
  const [showAddOpt, setShowAddOpt] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [venueStatus, setVenueStatus] = useState<VenueStatus>(venue.venueStatus);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleStatusSave = async () => {
    setStatusSaving(true);
    try {
      await updateProjectVenue(projectId, venue.engagementProjectVenueId, { venueStatus });
      addToast('Venue status updated.', 'success');
      setEditingStatus(false);
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update venue.'), 'error');
    } finally { setStatusSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProjectVenue(projectId, venue.engagementProjectVenueId);
      addToast('Venue proposal removed.', 'warning');
      onRefresh();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not remove venue.'), 'error');
    } finally { setDeleting(false); }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-text-primary font-medium text-sm">
              {venue.venueCompanyName ?? venue.venueName ?? `Venue #${venue.venueCompanyId}`}
            </span>
            {venue.venueName && venue.venueName !== venue.venueCompanyName && (
              <div className="text-xs text-text-secondary">{venue.venueName}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <div className="w-36">
                  <Select2 options={VENUE_STATUS_OPTIONS} value={venueStatus} onChange={(v) => setVenueStatus(v as VenueStatus)} />
                </div>
                <button type="button" onClick={() => void handleStatusSave()} disabled={statusSaving}
                  className="inline-flex items-center gap-1 bg-ems-accent text-background text-xs px-2 py-1 rounded disabled:opacity-60">
                  {statusSaving && <Loader2 className="h-3 w-3 animate-spin" />}Save
                </button>
                <button type="button" onClick={() => setEditingStatus(false)} className="text-text-muted text-xs px-1 hover:text-text-primary">✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditingStatus(true)} title="Click to change status">
                <StatusBadge status={venue.venueStatus} />
              </button>
            )}
            <button type="button" onClick={() => void handleDelete()} disabled={deleting}
              className="text-text-muted hover:text-ems-coral text-xs disabled:opacity-50 px-1">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : '✕'}
            </button>
          </div>
        </div>

        <div className="border-t border-border/60 pt-2 space-y-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-text-muted font-medium">Proposed Dates</p>
            <button type="button" onClick={() => setShowAddOpt(!showAddOpt)} className="text-ems-accent text-[11px] hover:underline">+ Add date</button>
          </div>
          {venue.performanceOptions.length === 0 && !showAddOpt && (
            <p className="text-xs text-text-muted">No date options yet.</p>
          )}
          {venue.performanceOptions.map((opt) => (
            <PerformanceOptionRow key={opt.performanceOptionId} opt={opt} projectId={projectId} onRefresh={onRefresh} addToast={addToast} />
          ))}
          {showAddOpt && (
            <AddPerformanceOptionForm
              projectId={projectId}
              onAdded={() => { setShowAddOpt(false); onRefresh(); }}
              onCancel={() => setShowAddOpt(false)}
              addToast={addToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Venue form ───────────────────────────────────────────────────────────

function AddVenueForm({
  projectId, existingIds, onSaved, onCancel, addToast,
}: {
  projectId: number; existingIds: Set<number>;
  onSaved: () => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const companiesQuery = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies, staleTime: 60_000 });
  const [venueId, setVenueId] = useState('');
  const [venueStatus, setVenueStatus] = useState<VenueStatus>('Proposed');
  const [saving, setSaving] = useState(false);

  const venueOptions = useMemo(() => {
    return (companiesQuery.data ?? [])
      .filter((c) => c.companyTypeName === 'Venue' && !existingIds.has(c.companyId))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
      .map((c) => ({ value: String(c.companyId), label: c.companyName }));
  }, [companiesQuery.data, existingIds]);

  const handleSave = async () => {
    if (!venueId) { addToast('Select a venue.', 'warning'); return; }
    setSaving(true);
    try {
      await createProjectVenue(projectId, { venueCompanyId: Number(venueId), venueStatus });
      addToast('Venue proposal added.', 'success');
      onSaved();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not add venue.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-elevated border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Venue" required>
          <Select2
            options={[{ value: '', label: 'Select venue…' }, ...venueOptions]}
            value={venueId}
            onChange={setVenueId}
            placeholder="Select venue…"
          />
        </FormField>
        <FormField label="Venue Status" required>
          <Select2 options={VENUE_STATUS_OPTIONS} value={venueStatus} onChange={(v) => setVenueStatus(v as VenueStatus)} />
        </FormField>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button type="button" onClick={onCancel} disabled={saving} className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center gap-2 bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add Venue
        </button>
      </div>
    </div>
  );
}

// ─── Project Detail Drawer ────────────────────────────────────────────────────

function ProjectDetailDrawer({
  projectId, onClose, addToast,
}: {
  projectId: number; onClose: () => void; addToast: Props['addToast'];
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAddVenue, setShowAddVenue] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => fetchProject(projectId),
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['projects', projectId] });
  }, [qc, projectId]);

  const project = detailQuery.data;
  const venues = project?.venues ?? [];
  const existingVenueIds = useMemo(() => new Set(venues.map((v) => v.venueCompanyId)), [venues]);

  return (
    <Drawer onClose={onClose} width={860}>
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="flex-1">
          {detailQuery.isLoading ? (
            <Skeleton className="h-5 w-48 bg-muted/80" />
          ) : (
            <>
              <h2 className="text-base font-semibold text-text-primary">
                Project #{project?.engagementProjectId}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-secondary">
                  {project?.attractionName ?? '—'}
                  {project?.tourName ? ` — ${project.tourName}` : ''}
                </span>
                {project?.projectStage && <StatusBadge status={project.projectStage} />}
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
      </div>

      <TabBar tabs={['Overview', 'Venues']} active={activeTab} onChange={setActiveTab} />

      <div className="p-4">
        {detailQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-muted py-4" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />Loading project…
          </div>
        )}
        {detailQuery.isError && (
          <p className="text-sm text-ems-coral">{friendlyApiError(detailQuery.error)}</p>
        )}

        {!detailQuery.isLoading && project && activeTab === 'Overview' && (
          <div className="text-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              <div>
                <span className="text-xs text-text-muted">Attraction</span>
                <div className="text-text-primary mt-0.5">{project.attractionName ?? '—'}</div>
              </div>
              <div>
                <span className="text-xs text-text-muted">Tour</span>
                <div className="text-text-primary mt-0.5">{project.tourName ?? '—'}</div>
              </div>
              <div>
                <span className="text-xs text-text-muted">Stage</span>
                <div className="mt-0.5"><StatusBadge status={project.projectStage} /></div>
              </div>
              <div>
                <span className="text-xs text-text-muted">Created By</span>
                <div className="text-text-primary mt-0.5">{project.createdBy ?? '—'}</div>
              </div>
              <div>
                <span className="text-xs text-text-muted">Created Date</span>
                <div className="text-text-primary mt-0.5">
                  {project.createdDate ? new Date(project.createdDate).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <span className="text-xs text-text-muted">Venue Proposals</span>
                <div className="text-text-primary mt-0.5">{venues.length}</div>
              </div>
            </div>
          </div>
        )}

        {!detailQuery.isLoading && project && activeTab === 'Venues' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">Venue Proposals</h3>
              <button type="button" onClick={() => setShowAddVenue(!showAddVenue)} className="text-ems-accent text-sm hover:underline">
                + Add Venue
              </button>
            </div>
            {showAddVenue && (
              <AddVenueForm
                projectId={projectId}
                existingIds={existingVenueIds}
                onSaved={() => { setShowAddVenue(false); void refresh(); }}
                onCancel={() => setShowAddVenue(false)}
                addToast={addToast}
              />
            )}
            {venues.length === 0 && !showAddVenue && (
              <p className="text-sm text-text-muted">No venue proposals yet.</p>
            )}
            {venues.map((v) => (
              <VenueProposalRow
                key={v.engagementProjectVenueId}
                venue={v}
                projectId={projectId}
                onRefresh={() => void refresh()}
                addToast={addToast}
              />
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ─── Create Project Form ──────────────────────────────────────────────────────

function CreateProjectForm({
  onSaved, onCancel, addToast,
}: {
  onSaved: (id: number) => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const attractionsQuery = useQuery({ queryKey: ['attractions'], queryFn: fetchAttractions, staleTime: 60_000 });
  const toursQuery = useQuery({ queryKey: ['tours'], queryFn: fetchTours, staleTime: 60_000 });

  const [attractionId, setAttractionId] = useState('');
  const [tourId, setTourId] = useState('');
  const [projectStage, setProjectStage] = useState<ProjectStage>('Active');
  const [createdBy, setCreatedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const attractionOptions = useMemo(
    () => (attractionsQuery.data ?? [])
      .sort((a, b) => a.attractionName.localeCompare(b.attractionName, undefined, { sensitivity: 'base' }))
      .map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [attractionsQuery.data],
  );

  const tourOptions = useMemo(() => {
    if (!attractionId) return [];
    return (toursQuery.data ?? [])
      .filter((t) => t.attractionId === Number(attractionId))
      .map((t) => ({ value: String(t.tourId), label: t.tourName }));
  }, [toursQuery.data, attractionId]);

  useEffect(() => { setTourId(''); }, [attractionId]);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const lookupsLoading = attractionsQuery.isPending || toursQuery.isPending;

  const handleSubmit = async () => {
    const errs: string[] = [];
    if (!tourId) errs.push('Tour is required');
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    setErrors([]);
    try {
      const res = await createProject({ tourId: Number(tourId), projectStage, createdBy: createdBy.trim() || null });
      onSaved(res.engagementProjectId);
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not create project.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {errors.length > 0 && (
        <div className="text-ems-coral text-sm bg-ems-coral-dim border border-ems-coral/20 rounded px-3 py-2">{errors.join(', ')}</div>
      )}
      {lookupsLoading ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-4"><Loader2 className="h-4 w-4 animate-spin text-ems-accent" />Loading lookups…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Attraction" required>
              <Select2
                options={attractionOptions}
                value={attractionId} onChange={setAttractionId} placeholder="Select attraction…"
              />
            </FormField>
            <FormField label="Tour" required>
              <Select2
                options={tourOptions}
                value={tourId} onChange={setTourId} disabled={!attractionId}
                placeholder={!attractionId ? 'Select attraction first…' : tourOptions.length === 0 ? 'No tours for this attraction' : 'Select tour…'}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project Stage" required>
              <Select2 options={PROJECT_STAGE_OPTIONS} value={projectStage} onChange={(v) => setProjectStage(v as ProjectStage)} />
            </FormField>
            <FormField label="Created By (optional)">
              <input className={inputCls} maxLength={200} value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Your name or user ID" />
            </FormField>
          </div>
        </>
      )}
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button type="button" onClick={onCancel} disabled={saving} className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSubmit()} disabled={saving || lookupsLoading}
          className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</> : 'Create Project'}
        </button>
      </div>
    </div>
  );
}

// ─── Edit Project Form ────────────────────────────────────────────────────────

function EditProjectForm({
  project, onSaved, onCancel, addToast,
}: {
  project: ApiProjectListRow; onSaved: () => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const [projectStage, setProjectStage] = useState<ProjectStage>(project.projectStage);
  const [createdBy, setCreatedBy] = useState(project.createdBy ?? '');
  const [saving, setSaving] = useState(false);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProject(project.engagementProjectId, { projectStage, createdBy: createdBy.trim() || null });
      onSaved();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update project.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Project Stage" required>
          <Select2 options={PROJECT_STAGE_OPTIONS} value={projectStage} onChange={(v) => setProjectStage(v as ProjectStage)} />
        </FormField>
        <FormField label="Created By (optional)">
          <input className={inputCls} maxLength={200} value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </FormField>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button type="button" onClick={onCancel} disabled={saving} className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center justify-center gap-2 min-w-[6.5rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Main ProjectsPage ────────────────────────────────────────────────────────

export function ProjectsPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editProject, setEditProject] = useState<ApiProjectListRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiProjectListRow | null>(null);

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });

  const refetch = useCallback(async () => {
    await qc.refetchQueries({ queryKey: ['projects'], exact: true });
  }, [qc]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: async () => {
      await refetch();
      if (selectedProjectId === pendingDelete?.engagementProjectId) setSelectedProjectId(null);
      addToast('Project deleted.', 'warning');
      setPendingDelete(null);
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete project.'), 'error'),
  });

  const rows = projectsQuery.data ?? [];

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (stageFilter !== 'All' && p.projectStage !== stageFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [String(p.engagementProjectId), p.tourName ?? '', p.attractionName ?? '', p.projectStage, p.createdBy ?? '']
        .join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, stageFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (pageClamped - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(pageClamped * PAGE_SIZE, filtered.length);

  useEffect(() => { setPage(1); }, [search, stageFilter]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const isLoading = projectsQuery.isPending;
  const isRefreshing = projectsQuery.isFetching && !projectsQuery.isPending;

  return (
    <div className="space-y-4">
      {isRefreshing && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open && !deleteMut.isPending) setPendingDelete(null); }}>
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">Delete this project?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              You're about to permanently delete{' '}
              <span className="font-medium text-text-primary">
                Project #{pendingDelete?.engagementProjectId}
              </span>
              {(pendingDelete?.attractionName || pendingDelete?.tourName) && (
                <> ({pendingDelete.attractionName}{pendingDelete.tourName ? ` — ${pendingDelete.tourName}` : ''})</>
              )}.
              All venue proposals and date options will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMut.isPending && (
            <div className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary" role="status">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden /><span>Deleting project…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={deleteMut.isPending} className="border-border bg-elevated text-text-primary hover:bg-hover mt-0">Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleteMut.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.engagementProjectId)}>
              {deleteMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Deleting…</> : 'Yes, delete project'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {projectsQuery.isError && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
          Could not load projects: {(projectsQuery.error as Error).message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
          {isLoading ? <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden /> : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">{filtered.length}</span>
          )}
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} disabled={isLoading}
          className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          + Create Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" disabled={isLoading} />
        </div>
        <div className="w-full sm:w-72">
          <Select2 options={STAGE_FILTER_OPTIONS} value={stageFilter} onChange={setStageFilter} disabled={isLoading} placeholder="Filter by stage" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? <ProjectsTableSkeleton /> : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">ID</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Tour</th>
                  <th className="text-left py-2.5 px-3">Stage</th>
                  <th className="text-left py-2.5 px-3">Created By</th>
                  <th className="text-left py-2.5 px-3">Created</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !projectsQuery.isError && (
                  <tr>
                    <td colSpan={7} className="py-12 px-3 text-center text-sm text-text-muted">
                      {rows.length === 0 ? 'No projects in the database yet.' : 'No projects match your search or filters.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((p) => (
                  <tr key={p.engagementProjectId}
                    onClick={() => setSelectedProjectId(p.engagementProjectId)}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 font-mono text-xs text-text-muted tabular-nums">#{p.engagementProjectId}</td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">{p.attractionName ?? '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{p.tourName ?? <span className="text-text-muted italic">No tour name</span>}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={p.projectStage} /></td>
                    <td className="py-2.5 px-3 text-text-secondary">{p.createdBy ?? '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-text-muted tabular-nums">
                      {p.createdDate ? new Date(p.createdDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={[
                        { label: 'View Details', onClick: () => setSelectedProjectId(p.engagementProjectId) },
                        { label: 'Edit', onClick: () => setEditProject(p) },
                        { label: 'Delete', onClick: () => setPendingDelete(p), danger: true },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing <span className="text-text-primary font-medium">{rangeStart}–{rangeEnd}</span>{' '}
                of <span className="text-text-primary font-medium">{filtered.length}</span>
                {filtered.length > PAGE_SIZE && <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium">Previous</button>
                <span className="text-text-muted tabular-nums px-1">Page {pageClamped} / {pageCount}</span>
                <button type="button" disabled={pageClamped >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {selectedProjectId !== null && (
        <ProjectDetailDrawer projectId={selectedProjectId} onClose={() => setSelectedProjectId(null)} addToast={addToast} />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <Modal title="Create Project" onClose={() => setShowCreateModal(false)} width={700}>
          <CreateProjectForm
            key="create-project"
            onSaved={async (id) => {
              await refetch();
              setShowCreateModal(false);
              addToast('Project created successfully.', 'success');
              setSelectedProjectId(id);
            }}
            onCancel={() => setShowCreateModal(false)}
            addToast={addToast}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editProject && (
        <Modal title="Edit Project" onClose={() => setEditProject(null)} width={600}>
          <EditProjectForm
            key={editProject.engagementProjectId}
            project={editProject}
            onSaved={async () => {
              await refetch();
              setEditProject(null);
              addToast('Project updated.', 'success');
            }}
            onCancel={() => setEditProject(null)}
            addToast={addToast}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Legacy shim – keeps Index.tsx from breaking ──────────────────────────────
export function ProjectDetailPage({ onNavigate }: {
  project?: unknown; projects?: unknown; engagements?: unknown;
  onNavigate: (v: string, data?: unknown) => void;
  addToast?: unknown; onCreateEngagement?: unknown; onUpdateProjects?: unknown;
}) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onNavigate('projects')} className="text-text-muted hover:text-text-primary text-sm">
        ← Back to Projects
      </button>
      <div className="text-text-muted text-sm bg-card border border-border rounded-lg p-4">
        Project details are now shown in the side drawer. Click any project row in the Projects list.
      </div>
    </div>
  );
}