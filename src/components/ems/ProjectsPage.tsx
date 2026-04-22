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
  fetchProjectStageMeta,
  fetchProjects,
  projectStageDisplayLabel,
  updatePerformanceOption,
  updateProject,
  updateProjectVenue,
  OPTION_STATUS_VALUES,
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
import {
  createTour,
  fetchAttractions,
  fetchClasses,
  fetchTours,
  updateTour,
} from '@/api/attractionToursApi';
import {
  companiesPickerQueryKey,
  fetchCompaniesPickerRows,
  fetchDmaMarkets,
} from '@/api/companyApi';
import { AddTourForm } from './AddTourForm';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

/** Extra display names for common DB literals (any other value still renders via `projectStageDisplayLabel`). */
const CANONICAL_PROJECT_STAGE_LABEL: Record<string, string> = {
  OffersSent: 'Offers Sent',
  PartiallyBooked: 'Partially Booked',
  FullyBooked: 'Fully Booked',
  Dead: 'Inactive',
};

function projectStageSelectOptions(stages: string[]) {
  return stages.map((value) => ({
    value,
    label: projectStageDisplayLabel(value, CANONICAL_PROJECT_STAGE_LABEL),
  }));
}

/** TODO: remove when API/DB project-stage list is reliable — always show this value in dropdowns for now. */
const TEMP_FRONTEND_PROJECT_STAGE = 'OffersSent';

function mergeStagesWithTempOffersSent(stages: string[]): string[] {
  const s = new Set(stages);
  s.add(TEMP_FRONTEND_PROJECT_STAGE);
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
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
              {['Attraction', 'Tour', 'Stage', 'Created By', 'Created', ''].map((h, i) => (
                <th key={i} className="text-left py-2.5 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                {Array.from({ length: 6 }).map((__, j) => (
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
  const companiesQuery = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 60_000,
  });
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
                <div className="mt-0.5">
                  <StatusBadge status={project.projectStage} />
                </div>
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

// ─── Create Project Wizard ────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { num: 1, label: 'Attraction' },
  { num: 2, label: 'Tour' },
  { num: 3, label: 'Tour Mgmt' },
  { num: 4, label: 'Markets' },
  { num: 5, label: 'Details' },
] as const;

const WIZARD_LAST = WIZARD_STEPS.length;

function WizardStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 mb-6">
      {WIZARD_STEPS.map((step, idx) => {
        const isActive = currentStep === step.num;
        const isCompleted = currentStep > step.num;
        const textColor = isActive ? 'text-ems-accent' : isCompleted ? 'text-text-primary' : 'text-text-muted';
        const circleClasses = isActive
          ? 'bg-ems-accent text-background border-ems-accent'
          : isCompleted
            ? 'bg-ems-accent/20 border-ems-accent text-ems-accent'
            : 'bg-surface border-border text-text-muted';
        const lineClasses = isCompleted ? 'bg-ems-accent' : 'bg-border';
        return (
          <React.Fragment key={step.num}>
            <div className={`flex flex-col items-center ${textColor}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${circleClasses}`}>
                {isCompleted ? '✓' : step.num}
              </div>
              <span className="text-[10px] mt-1 hidden sm:block">{step.label}</span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`hidden sm:block w-6 md:w-10 h-0.5 mx-0.5 transition-colors ${lineClasses}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CreateProjectForm({
  onSaved, onCancel, addToast,
}: {
  onSaved: (id: number) => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const qc = useQueryClient();
  const projectWizardLookupLimit = 8000;
  const attractionsQuery = useQuery({
    queryKey: ['attractions', 'picker', 0, projectWizardLookupLimit],
    queryFn: async () => (await fetchAttractions(0, projectWizardLookupLimit)).data,
    staleTime: 60_000,
  });
  const toursQuery = useQuery({
    queryKey: ['tours', 'picker', 0, projectWizardLookupLimit],
    queryFn: async () => (await fetchTours(0, projectWizardLookupLimit)).data,
    staleTime: 60_000,
  });
  const companiesQuery = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 60_000,
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: 60_000 });
  const [step, setStep] = useState(1);
  /** Only fetch when the Details step is shown — `step` must be declared before this `useQuery`. */
  const projectStageMetaQuery = useQuery({
    queryKey: ['project', 'meta', 'project-stages'],
    queryFn: fetchProjectStageMeta,
    staleTime: 60_000,
    enabled: step >= 5,
  });
  const projectStages = projectStageMetaQuery.data?.projectStages ?? [];
  const projectStageOptions = useMemo(
    () => projectStageSelectOptions(mergeStagesWithTempOffersSent(projectStages)),
    [projectStages],
  );

  /** Load DMA list only on Markets / Details steps — fetching 50k+ rows on modal open freezes or crashes the tab. */
  const dmaMarketsQuery = useQuery({
    queryKey: ['dma-markets'],
    queryFn: fetchDmaMarkets,
    staleTime: 120_000,
    enabled: step >= 4,
  });

  const [attractionSearch, setAttractionSearch] = useState('');
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [tourSearch, setTourSearch] = useState('');

  const [tourManagementCompanyId, setTourManagementCompanyId] = useState<number | null>(null);
  const [companySearch, setCompanySearch] = useState('');

  const [selectedDmaIds, setSelectedDmaIds] = useState<number[]>([]);
  const [dmaListFilter, setDmaListFilter] = useState('');
  const [dmaPickerValue, setDmaPickerValue] = useState('');

  const [projectStage, setProjectStage] = useState<ProjectStage>('');
  const [createdBy, setCreatedBy] = useState('');

  const [showAddTourModal, setShowAddTourModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectStage === '' && projectStages.length > 0) {
      setProjectStage(projectStages[0]);
    }
  }, [projectStage, projectStages]);

  const attractions = attractionsQuery.data ?? [];
  const tours = toursQuery.data ?? [];
  const companies = companiesQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const dmaRows = dmaMarketsQuery.data ?? [];

  const toursByAttraction = useMemo(() => {
    const map = new Map<number, typeof tours>();
    tours.forEach((t) => {
      if (!map.has(t.attractionId)) map.set(t.attractionId, []);
      map.get(t.attractionId)!.push(t);
    });
    return map;
  }, [tours]);

  const filteredAttractions = useMemo(() => {
    const q = attractionSearch.trim().toLowerCase();
    return attractions
      .filter((a) => !q || (a.attractionName ?? '').toLowerCase().includes(q))
      .sort((a, b) =>
        (a.attractionName ?? '').localeCompare(b.attractionName ?? '', undefined, { sensitivity: 'base' }),
      );
  }, [attractions, attractionSearch]);

  const toursForSelectedAttraction = useMemo(() => {
    if (selectedAttractionId == null) return [];
    return (toursByAttraction.get(selectedAttractionId) ?? []).slice().sort((a, b) =>
      (a.tourName ?? '').localeCompare(b.tourName ?? '', undefined, { sensitivity: 'base' }),
    );
  }, [selectedAttractionId, toursByAttraction]);

  const filteredToursForAttraction = useMemo(() => {
    const q = tourSearch.trim().toLowerCase();
    if (!q) return toursForSelectedAttraction;
    return toursForSelectedAttraction.filter(
      (t) =>
        (t.tourName ?? '').toLowerCase().includes(q) ||
        String(t.tourId).includes(q),
    );
  }, [toursForSelectedAttraction, tourSearch]);

  useEffect(() => {
    setTourSearch('');
  }, [selectedAttractionId]);

  const managementCompanyOptions = useMemo(() => {
    const talentAgencies = companies.filter(
      (c) => (c.companyTypeName ?? '').trim().toLowerCase() === 'talent agency',
    );
    return talentAgencies
      .filter((c) => (c.companyName ?? '').toLowerCase().includes(companySearch.toLowerCase()))
      .sort((a, b) =>
        (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
      );
  }, [companies, companySearch]);

  const dmaLabelById = useMemo(() => {
    const m = new Map<number, string>();
    dmaRows.forEach((r) => {
      m.set(r.dmaid, `${r.marketName} (#${r.dmaid})`);
    });
    return m;
  }, [dmaRows]);

  const dmaPickerOptions = useMemo(() => {
    const q = dmaListFilter.trim().toLowerCase();
    const pool = !q
      ? dmaRows
      : dmaRows.filter(
          (r) =>
            (r.marketName ?? '').toLowerCase().includes(q) ||
            String(r.dmaid).includes(q),
        );
    const cap = 500;
    return pool.slice(0, cap).map((r) => ({
      value: String(r.dmaid),
      label: `${r.marketName} (#${r.dmaid})`,
    }));
  }, [dmaRows, dmaListFilter]);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const lookupsLoading =
    attractionsQuery.isPending ||
    toursQuery.isPending ||
    companiesQuery.isPending ||
    classesQuery.isPending;

  const selectedTour = selectedTourId ? tours.find((t) => t.tourId === selectedTourId) : null;
  const selectedAttraction =
    selectedAttractionId != null
      ? attractions.find((a) => a.attractionId === selectedAttractionId)
      : null;

  const canProceedStep1 = selectedAttractionId != null;
  const canProceedStep2 = selectedTourId != null;
  const canProceedStep4 = true;
  /** Only used on the final “Create Project” action (step 5). */
  const canCreateProject =
    selectedTourId != null &&
    !projectStageMetaQuery.isPending &&
    !projectStageMetaQuery.isError &&
    projectStageOptions.length > 0 &&
    Boolean(projectStage || projectStages[0]);

  const handleBack = () => setStep((s) => Math.max(1, s - 1));
  const handleNext = () => setStep((s) => Math.min(WIZARD_LAST, s + 1));

  const createTourMut = useMutation({
    mutationFn: createTour,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['tours'] });
      setSelectedTourId(res.tourId);
      setShowAddTourModal(false);
      addToast('Tour created.', 'success');
    },
    onError: (e: unknown) => addToast(friendlyApiError(e, 'Could not create tour.'), 'error'),
  });

  const handleSubmit = async () => {
    if (!selectedTourId) return;
    const stage = projectStage || projectStages[0] || '';
    if (!stage) {
      addToast(
        projectStageMetaQuery.isError
          ? friendlyApiError(projectStageMetaQuery.error, 'Could not load project stages from the server.')
          : (projectStageMetaQuery.data?.source === 'empty'
            ? 'No project stages are available. The database CHECK could not be read; set PROJECT_STAGE_ALLOWLIST on the API or fix permissions.'
            : 'Select a project stage before creating the project.'),
        'error',
      );
      return;
    }
    setSaving(true);
    try {
      const desiredMgmt = tourManagementCompanyId ?? null;
      const currentMgmt = selectedTour?.tourManagementCompanyId ?? null;
      if (selectedTour && desiredMgmt !== currentMgmt) {
        await updateTour(selectedTourId, {
          tourManagementCompanyId: tourManagementCompanyId ?? null,
        });
      }
      const res = await createProject({
        tourId: selectedTourId,
        projectStage: stage,
        createdBy: createdBy.trim() ? createdBy.trim() : undefined,
        dmaIds: selectedDmaIds.length > 0 ? selectedDmaIds : undefined,
      });
      onSaved(res.engagementProjectId);
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not create project.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addMarketFromPicker = () => {
    if (!dmaPickerValue) return;
    const id = Number(dmaPickerValue);
    if (Number.isNaN(id) || selectedDmaIds.includes(id)) return;
    setSelectedDmaIds((prev) => [...prev, id]);
    setDmaPickerValue('');
  };

  const removeMarket = (dmaid: number) => {
    setSelectedDmaIds((prev) => prev.filter((id) => id !== dmaid));
  };

  if (lookupsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted text-sm py-12">
        <Loader2 className="h-5 w-5 animate-spin text-ems-accent" />Loading data…
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <WizardStepIndicator currentStep={step} />

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Select Attraction</h3>
          <p className="text-xs text-text-muted">
            Search and pick one attraction. You&apos;ll choose a tour on the next step.
          </p>
          <input
            type="search"
            className={inputCls}
            placeholder="Search attractions by name…"
            value={attractionSearch}
            onChange={(e) => setAttractionSearch(e.target.value)}
            autoComplete="off"
          />
          <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 border border-border rounded-lg p-2 bg-elevated/40">
            {filteredAttractions.length === 0 && (
              <p className="text-sm text-text-muted px-2 py-4 text-center">No attractions match your search.</p>
            )}
            {filteredAttractions.map((a) => (
              <button
                key={a.attractionId}
                type="button"
                onClick={() => {
                  setSelectedAttractionId(a.attractionId);
                  setSelectedTourId(null);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2 ${
                  selectedAttractionId === a.attractionId
                    ? 'bg-ems-accent/10 border border-ems-accent/30 text-text-primary'
                    : 'hover:bg-hover text-text-secondary border border-transparent'
                }`}
              >
                <span className="font-medium">{a.attractionName}</span>
                {selectedAttractionId === a.attractionId && (
                  <span className="text-ems-accent text-xs font-medium shrink-0">Selected</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-text-primary">Select Tour</h3>
            <button
              type="button"
              disabled={selectedAttractionId == null || classes.length === 0}
              onClick={() => setShowAddTourModal(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Create Tour
            </button>
          </div>
          {selectedAttraction && (
            <p className="text-xs text-text-secondary">
              Attraction: <span className="text-text-primary font-medium">{selectedAttraction.attractionName}</span>
            </p>
          )}
          <p className="text-xs text-text-muted">
            Search and pick a tour for this attraction.
          </p>
          <input
            type="search"
            className={inputCls}
            placeholder="Search tours by name…"
            value={tourSearch}
            onChange={(e) => setTourSearch(e.target.value)}
            autoComplete="off"
          />
          <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1 border border-border rounded-lg p-2 bg-elevated/40">
            {toursForSelectedAttraction.length === 0 && (
              <p className="text-sm text-text-muted px-2 py-6 text-center">
                No tours for this attraction yet. Use <span className="font-medium text-text-secondary">Create Tour</span> to add one.
              </p>
            )}
            {toursForSelectedAttraction.length > 0 && filteredToursForAttraction.length === 0 && (
              <p className="text-sm text-text-muted px-2 py-6 text-center">No tours match your search.</p>
            )}
            {filteredToursForAttraction.map((tour) => (
              <button
                key={tour.tourId}
                type="button"
                onClick={() => setSelectedTourId(tour.tourId)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2 ${
                  selectedTourId === tour.tourId
                    ? 'bg-ems-accent/10 border border-ems-accent/30 text-text-primary'
                    : 'hover:bg-hover text-text-secondary border border-transparent'
                }`}
              >
                <span>{tour.tourName}</span>
                {selectedTourId === tour.tourId && (
                  <span className="text-ems-accent text-xs font-medium shrink-0">Selected</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Tour Management Company */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Select Talent Agent / Tour Management</h3>
            <span className="text-xs text-text-muted">Optional</span>
          </div>
          <div className="bg-elevated border border-border rounded-lg p-3 space-y-3">
            <input
              type="text"
              className={inputCls}
              placeholder="Search tour management companies…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              <button
                type="button"
                onClick={() => setTourManagementCompanyId(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  tourManagementCompanyId === null
                    ? 'bg-ems-accent/10 border border-ems-accent/30 text-text-primary'
                    : 'hover:bg-hover text-text-secondary'
                }`}
              >
                <span className="text-text-muted">— None —</span>
              </button>
              {managementCompanyOptions.map(company => (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() => setTourManagementCompanyId(company.companyId)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    tourManagementCompanyId === company.companyId
                      ? 'bg-ems-accent/10 border border-ems-accent/30 text-text-primary'
                      : 'hover:bg-hover text-text-secondary'
                  }`}
                >
                  {company.companyName}
                </button>
              ))}
              {companySearch && managementCompanyOptions.length === 0 && (
                <p className="text-xs text-text-muted px-3 py-2">No companies found.</p>
              )}
            </div>
          </div>
          {tourManagementCompanyId && (
            <p className="text-xs text-text-secondary">
              Selected: {companies.find(c => c.companyId === tourManagementCompanyId)?.companyName}
            </p>
          )}
        </div>
      )}

      {/* Step 4: Select Markets — dbo.DMA */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Select Markets (DMAs)</h3>
            <span className="text-xs text-text-muted">Optional</span>
          </div>
          {dmaMarketsQuery.isPending && (
            <div className="flex items-center gap-2 text-sm text-text-muted py-6 justify-center border border-dashed border-border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-ems-accent shrink-0" />
              Loading DMA list from the database…
            </div>
          )}
          {dmaMarketsQuery.isError && (
            <div className="rounded-lg border border-ems-coral/40 bg-ems-coral/10 px-3 py-2 text-sm text-text-primary space-y-2">
              <p>Could not load DMA options: {friendlyApiError(dmaMarketsQuery.error)}</p>
              <button
                type="button"
                className="text-sm font-medium text-ems-accent hover:underline"
                onClick={() => void dmaMarketsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {!dmaMarketsQuery.isPending && !dmaMarketsQuery.isError && (
            <>
          <p className="text-xs text-text-muted">
            Open the DMA field, <span className="font-medium text-text-secondary">search by market name or DMA ID</span> in the box inside the menu, choose a row from{' '}
            <span className="font-medium text-text-secondary">dbo.DMA</span>, then click Add. Repeat for multiple markets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <FormField label="DMA (from database)">
              <Select2
                options={[{ value: '', label: 'Choose a DMA row…' }, ...dmaPickerOptions]}
                value={dmaPickerValue}
                onChange={setDmaPickerValue}
                placeholder="Choose a DMA row…"
                filterQuery={dmaListFilter}
                onFilterChange={setDmaListFilter}
                searchPlaceholder="Search DMAs by name or ID…"
              />
            </FormField>
            <button
              type="button"
              onClick={addMarketFromPicker}
              disabled={!dmaPickerValue}
              className="h-[38px] px-4 rounded-md text-sm font-medium bg-elevated border border-border hover:bg-hover text-text-primary disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {dmaPickerOptions.length >= 500 && (
            <p className="text-[11px] text-text-muted">Showing the first 500 matches — keep typing to narrow down.</p>
          )}
            </>
          )}
          {selectedDmaIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary">Selected markets</p>
              <div className="flex flex-wrap gap-2">
                {selectedDmaIds.map((dmaid) => (
                  <span
                    key={dmaid}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-ems-accent/10 text-text-primary text-xs rounded-md border border-ems-accent/30 max-w-full"
                  >
                    <span className="truncate">{dmaLabelById.get(dmaid) ?? `DMA #${dmaid}`}</span>
                    <button type="button" onClick={() => removeMarket(dmaid)} className="text-text-muted hover:text-ems-coral shrink-0">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Project Details */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Project Details</h3>
          <div className="bg-elevated border border-border rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Attraction">
                <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                  {selectedAttraction?.attractionName ?? '—'}
                </div>
              </FormField>
              <FormField label="Tour">
                <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                  {selectedTour?.tourName ?? '—'}
                </div>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tour Management">
                <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                  {tourManagementCompanyId
                    ? companies.find(c => c.companyId === tourManagementCompanyId)?.companyName ?? '—'
                    : '— None —'}
                </div>
              </FormField>
              <FormField label="Markets Selected">
                <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                  {selectedDmaIds.length > 0 ? `${selectedDmaIds.length} market(s)` : '— None —'}
                </div>
              </FormField>
            </div>
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text-secondary">Project stage is required.</span> The list below is
                the set of values your system allows. Choose the one that fits this project, then click Create Project.
              </p>
              {projectStageMetaQuery.isPending && (
                <p className="text-xs text-text-secondary flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-ems-accent shrink-0" />
                  Loading allowed project stages from the server…
                </p>
              )}
              {projectStageMetaQuery.isError && (
                <div className="rounded-md border border-ems-coral/40 bg-ems-coral/10 px-3 py-2 text-sm text-text-primary space-y-2">
                  <p>Could not load project stages: {friendlyApiError(projectStageMetaQuery.error)}</p>
                  <button
                    type="button"
                    className="text-sm font-medium text-ems-accent hover:underline"
                    onClick={() => void projectStageMetaQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {projectStageMetaQuery.isSuccess && projectStageMetaQuery.data?.source === 'existing_rows' && (
                <p className="text-xs text-ems-amber">
                  The full rule from the database could not be read, so the list below is built from{' '}
                  <span className="font-medium">stages that already exist on other projects</span>. For a complete,
                  exact list, set <code className="text-[11px]">PROJECT_STAGE_ALLOWLIST</code> on the API to match your
                  database.
                </p>
              )}
              {projectStageMetaQuery.isSuccess &&
                projectStageMetaQuery.data?.source === 'empty' &&
                projectStageOptions.length === 0 && (
                <p className="text-xs text-ems-amber">
                  No stages are available to pick right now. An administrator needs to connect the app to the list of
                  allowed stages (via the database or the API setting{' '}
                  <code className="text-[11px]">PROJECT_STAGE_ALLOWLIST</code>
                  ). Until then, you can’t complete this step.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Project Stage" required>
                  <Select2
                    options={projectStageOptions}
                    value={projectStage}
                    onChange={(v) => setProjectStage(v as ProjectStage)}
                    disabled={projectStageMetaQuery.isPending || projectStageOptions.length === 0}
                    placeholder={
                      projectStageMetaQuery.isPending
                        ? 'Loading stages…'
                        : projectStageOptions.length === 0
                          ? 'No stages from API — see message above'
                          : 'Select project stage'
                    }
                  />
                </FormField>
                <FormField label="Created By (optional)">
                  <input
                    className={inputCls}
                    maxLength={200}
                    value={createdBy}
                    onChange={(e) => setCreatedBy(e.target.value)}
                    placeholder="Your name or user ID"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={step === 1 ? onCancel : handleBack}
          disabled={saving}
          className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm disabled:opacity-50"
        >
          {step === 1 ? 'Cancel' : '← Back'}
        </button>
        <div className="flex gap-2">
          {step < WIZARD_LAST ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 4 && !canProceedStep4) ||
                saving
              }
              className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !canCreateProject}
              className="inline-flex items-center justify-center gap-2 min-w-[8rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</> : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>

    {showAddTourModal && selectedAttractionId != null && classes.length > 0 && (
      <Modal
        title="Add Tour"
        onClose={() => !createTourMut.isPending && setShowAddTourModal(false)}
        width={600}
        allowContentOverflow
      >
        <AddTourForm
          attractions={attractions}
          classes={classes}
          lockAttractionId={selectedAttractionId}
          submitting={createTourMut.isPending}
          onCancel={() => setShowAddTourModal(false)}
          onSave={(body) => void createTourMut.mutateAsync(body)}
        />
      </Modal>
    )}
    </>
  );
}

// ─── Edit Project Form ────────────────────────────────────────────────────────

function EditProjectForm({
  project, onSaved, onCancel, addToast,
}: {
  project: ApiProjectListRow; onSaved: () => void; onCancel: () => void; addToast: Props['addToast'];
}) {
  const projectEditLookupLimit = 8000;
  const attractionsQuery = useQuery({
    queryKey: ['attractions', 'picker', 0, projectEditLookupLimit],
    queryFn: async () => (await fetchAttractions(0, projectEditLookupLimit)).data,
    staleTime: 60_000,
  });
  const toursQuery = useQuery({
    queryKey: ['tours', 'picker', 0, projectEditLookupLimit],
    queryFn: async () => (await fetchTours(0, projectEditLookupLimit)).data,
    staleTime: 60_000,
  });

  const [projectStage, setProjectStage] = useState<ProjectStage>(project.projectStage);
  const [createdBy, setCreatedBy] = useState(project.createdBy ?? '');
  const [tourId, setTourId] = useState<number>(project.tourId);
  const [saving, setSaving] = useState(false);

  const projectStageMetaQuery = useQuery({
    queryKey: ['project', 'meta', 'project-stages'],
    queryFn: fetchProjectStageMeta,
    staleTime: 60_000,
  });
  const projectStages = projectStageMetaQuery.data?.projectStages ?? [];
  const projectStageOptions = useMemo(() => {
    const merged = new Set<string>([
      ...mergeStagesWithTempOffersSent(projectStages),
      project.projectStage,
      projectStage,
    ].filter(Boolean) as string[]);
    return projectStageSelectOptions([...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  }, [projectStages, project.projectStage, projectStage]);

  const attractions = attractionsQuery.data ?? [];
  const tours = toursQuery.data ?? [];

  // Find current tour and attraction
  const currentTour = tours.find(t => t.tourId === tourId);
  const currentAttraction = currentTour ? attractions.find(a => a.attractionId === currentTour.attractionId) : null;

  // Get tours for the same attraction
  const toursForSameAttraction = useMemo(() => {
    if (!currentTour) return [];
    return tours.filter(t => t.attractionId === currentTour.attractionId && t.tourId !== currentTour.tourId);
  }, [tours, currentTour]);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const lookupsLoading = attractionsQuery.isPending || toursQuery.isPending || projectStageMetaQuery.isPending;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: import('@/api/projectApi').UpdateProjectPayload = {
        projectStage,
        createdBy: createdBy.trim() || null,
      };
      // Only include tourId if it changed
      if (tourId !== project.tourId) {
        payload.tourId = tourId;
      }
      await updateProject(project.engagementProjectId, payload);
      onSaved();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update project.'), 'error');
    } finally { setSaving(false); }
  };

  if (lookupsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted text-sm py-8">
        <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />Loading data…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Project Summary */}
      <div className="bg-elevated border border-border rounded-lg p-3 space-y-3">
        <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Current Project</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[11px] text-text-muted">Attraction</span>
            <div className="text-sm text-text-primary">{project.attractionName ?? '—'}</div>
          </div>
          <div>
            <span className="text-[11px] text-text-muted">Current Tour</span>
            <div className="text-sm text-text-primary">{project.tourName ?? '—'}</div>
          </div>
          <div>
            <span className="text-[11px] text-text-muted">Project ID</span>
            <div className="text-sm text-text-primary font-mono">#{project.engagementProjectId}</div>
          </div>
          <div>
            <span className="text-[11px] text-text-muted">Created</span>
            <div className="text-sm text-text-primary">
              {project.createdDate ? new Date(project.createdDate).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Edit Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Project Stage" required>
            <Select2
              options={projectStageOptions}
              value={projectStage}
              onChange={(v) => setProjectStage(v as ProjectStage)}
              disabled={projectStageOptions.length === 0}
            />
          </FormField>
          <FormField label="Created By (optional)">
            <input className={inputCls} maxLength={200} value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Your name or user ID" />
          </FormField>
        </div>

        {toursForSameAttraction.length > 0 && (
          <div className="pt-2">
            <FormField label="Change Tour (optional)">
              <Select2
                options={[
                  { value: String(currentTour?.tourId ?? ''), label: `Keep current: ${currentTour?.tourName ?? 'Unknown'}` },
                  ...toursForSameAttraction.map(t => ({ value: String(t.tourId), label: t.tourName }))
                ]}
                value={String(tourId)}
                onChange={(v) => setTourId(Number(v))}
              />
            </FormField>
            <p className="text-xs text-text-muted mt-1">
              Other tours for {currentAttraction?.attractionName} are available to switch to.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <button type="button" onClick={onCancel} disabled={saving} className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center justify-center gap-2 min-w-[6.5rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : 'Save Changes'}
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
  const projectStageMetaQuery = useQuery({
    queryKey: ['project', 'meta', 'project-stages'],
    queryFn: fetchProjectStageMeta,
    staleTime: 60_000,
  });
  const stageFilterOptions = useMemo(() => {
    const stages = mergeStagesWithTempOffersSent(projectStageMetaQuery.data?.projectStages ?? []);
    return [{ value: 'All', label: 'All' }, ...projectStageSelectOptions(stages)];
  }, [projectStageMetaQuery.data?.projectStages]);

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
      if (stageFilter !== 'All' && p.projectStage !== stageFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [
        String(p.engagementProjectId),
        p.tourName ?? '',
        p.attractionName ?? '',
        p.projectStage,
        p.createdBy ?? '',
      ]
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
          <Select2
            options={stageFilterOptions}
            value={stageFilter}
            onChange={setStageFilter}
            disabled={isLoading}
            placeholder="Filter by stage"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? <ProjectsTableSkeleton /> : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
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
                    <td colSpan={6} className="py-12 px-3 text-center text-sm text-text-muted">
                      {rows.length === 0 ? 'No projects in the database yet.' : 'No projects match your search or filters.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((p) => (
                  <tr key={p.engagementProjectId}
                    onClick={() => setSelectedProjectId(p.engagementProjectId)}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 text-text-primary font-medium">{p.attractionName ?? '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{p.tourName ?? <span className="text-text-muted italic">No tour name</span>}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={p.projectStage} />
                    </td>
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
        <Modal title="Create Project" onClose={() => setShowCreateModal(false)} width={700} allowContentOverflow>
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
        <Modal title="Edit Project" onClose={() => setEditProject(null)} width={600} allowContentOverflow>
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