/**
 * ProjectsPage – Fully dynamic, API-driven.
 * Pattern matches CompaniesPage:
 *   - useQuery / useMutation from @tanstack/react-query
 *   - Server-paginated list (search + stage on API), selectable rows per page
 *   - Auto-reload after every CRUD (invalidateQueries)
 *   - Disabled buttons / spinners while loading
 *   - Success/error toasts
 *   - AlertDialog for delete confirmation
 *   - Drawer for project detail + venues + date options
 *   - Modals for create / edit
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
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
  getPageParams,
  getPageRange,
  getTotalPages,
  PAGE_SIZE,
  type PageSizeOption,
  isAllPageSize,
} from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';
import {
  createPerformanceOption,
  createProject,
  createProjectVenue,
  deletePerformanceOption,
  deleteProject,
  deleteProjectVenue,
  fetchProject,
  projectsApiQueryKey,
  fetchProjects,
  fetchVenueStatusMeta,
  PROJECT_STAGE_VALUES,
  projectStageDisplayLabel,
  updatePerformanceOption,
  updateProject,
  updateProjectVenue,
  OPTION_STATUS_VALUES,
  VENUE_STATUS_VALUES,
} from '@/api/projectApi';
import type {
  ApiPerformanceOption,
  ApiProjectDetail,
  ApiProjectListRow,
  ApiProjectVenue,
  OptionStatus,
  ProjectStage,
  VenueStatus,
} from '@/api/projectApi';
import type { ApiPaginatedResponse } from '@/api/companyApi';
import {
  createTour,
  fetchAttractions,
  fetchClasses,
  fetchTours,
} from '@/api/attractionToursApi';
import type { ApiAttractionListRow, ApiTourListRow } from '@/api/attractionToursApi';
import {
  companiesPickerQueryKey,
  fetchCompaniesPickerRows,
  fetchDmaMarketsPaged,
  type ApiDmaMarket,
} from '@/api/companyApi';
import { AddTourForm } from './AddTourForm';

// ─── Constants ────────────────────────────────────────────────────────────────

function projectDetailToListRow(p: ApiProjectDetail): ApiProjectListRow {
  return {
    engagementProjectId: p.engagementProjectId,
    tourId: p.tourId,
    attractionId: p.attractionId ?? null,
    tourName: p.tourName,
    attractionName: p.attractionName,
    tourManagementCompanyId: p.tourManagementCompanyId ?? null,
    tourManagementCompanyName: p.tourManagementCompanyName ?? null,
    projectStage: p.projectStage,
    createdDate: p.createdDate,
    createdBy: p.createdBy,
  };
}

const PROJECT_LOOKUP_LIMIT = 8000;

/** dbo.DMA picker: server page size (scroll / search loads more). */
const DMA_PICKER_PAGE_SIZE = 100;

function formatDmaPickerLabel(r: { postalCode?: string | null; marketName?: string | null }): string {
  const pc = (r.postalCode ?? '').trim();
  const name = (r.marketName ?? '').trim() || '—';
  return pc ? `${pc} - ${name}` : name;
}

// ─── Inline edit primitives (same pattern as CompaniesPage) ────────────────────

function InlineEditField({
  label,
  value,
  onChange,
  placeholder = '—',
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };
  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">{label}</label>
        <div className="flex items-start gap-1.5">
          <input
            ref={ref}
            value={draft}
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
          />
          <div className="flex gap-0.5 mt-0.5 shrink-0">
            <button type="button" onClick={commit} title="Save field" className="p-1 text-ems-accent hover:bg-elevated rounded transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={cancel} title="Cancel" className="p-1 text-text-muted hover:bg-elevated rounded transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">{label}</label>
      <div
        role="button"
        tabIndex={0}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') start();
        }}
        className="group flex items-start gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
        title="Click to edit"
      >
        <span className={`text-sm flex-1 ${value ? 'text-text-primary' : 'text-text-muted italic'}`}>{value || placeholder}</span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

function InlineSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const display = (options.find((o) => o.value === value)?.label ?? value) || '—';

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">{label}</label>
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <Select2 options={options} value={value} onChange={(v) => { onChange(v); setEditing(false); }} />
          </div>
          <button type="button" onClick={() => setEditing(false)} className="p-1 text-text-muted hover:bg-elevated rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">{label}</label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setEditing(true);
        }}
        className="group flex items-center gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
        title="Click to edit"
      >
        <span className="text-sm text-text-primary flex-1">{display}</span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

function ProjectInlineOverview({
  project,
  tours,
  attractions,
  onUpdated,
  onGoToVenues,
  addToast,
}: {
  project: ApiProjectDetail;
  tours: ApiTourListRow[];
  attractions: ApiAttractionListRow[];
  onUpdated: () => void | Promise<void>;
  onGoToVenues: () => void;
  addToast: Props['addToast'];
}) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attractionId, setAttractionId] = useState(0);
  const [tourId, setTourId] = useState(project.tourId);
  const [projectStage, setProjectStage] = useState(project.projectStage);
  const [createdBy, setCreatedBy] = useState(project.createdBy ?? '');

  const mark = useCallback(<T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  }, []);

  useEffect(() => {
    const tr = tours.find((t) => t.tourId === project.tourId);
    setAttractionId(tr?.attractionId ?? project.attractionId ?? 0);
    setTourId(project.tourId);
    setProjectStage(project.projectStage);
    setCreatedBy(project.createdBy ?? '');
    setDirty(false);
  }, [project.engagementProjectId, project.tourId, project.projectStage, project.createdBy, project.attractionId, project.tourName, tours]);

  const attractionOptions = useMemo(
    () =>
      attractions
        .slice()
        .sort((a, b) => (a.attractionName ?? '').localeCompare(b.attractionName ?? '', undefined, { sensitivity: 'base' }))
        .map((a) => ({ value: String(a.attractionId), label: a.attractionName })),
    [attractions],
  );

  const toursForAttraction = useMemo(() => {
    const list = tours
      .filter((t) => t.attractionId === attractionId)
      .sort((a, b) => a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' }));
    return [
      { value: '', label: 'Select a tour…' },
      ...list.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    ];
  }, [tours, attractionId]);

  const tourBelongsToAttraction = useMemo(() => {
    if (!tourId || !attractionId) return false;
    const t = tours.find((x) => x.tourId === tourId);
    return Boolean(t && t.attractionId === attractionId);
  }, [tourId, attractionId, tours]);

  const tourSelectValue = tourBelongsToAttraction ? String(tourId) : '';

  const onAttractionChange = (v: string) => {
    setAttractionId(Number(v));
    setTourId(0);
    setDirty(true);
  };

  const onTourChange = (v: string) => {
    setTourId(v ? Number(v) : 0);
    setDirty(true);
  };

  const selectedTour = tourBelongsToAttraction
    ? tours.find((t) => t.tourId === tourId)
    : undefined;
  const tourMgmtLabel =
    !tourId || !tourBelongsToAttraction
      ? '—'
      : (selectedTour?.tourManagementCompanyName?.trim()
        || project.tourManagementCompanyName?.trim()
        || '—');

  const stageOptions = useMemo(() => editProjectStageSelectOptions(project.projectStage), [project.projectStage]);

  const discard = () => {
    const tr = tours.find((t) => t.tourId === project.tourId);
    setAttractionId(tr?.attractionId ?? project.attractionId ?? 0);
    setTourId(project.tourId);
    setProjectStage(project.projectStage);
    setCreatedBy(project.createdBy ?? '');
    setDirty(false);
  };

  const handleSave = async () => {
    if (!tourId || !tourBelongsToAttraction) {
      addToast('Select a tour that belongs to the selected attraction before saving.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateProject(project.engagementProjectId, {
        tourId,
        projectStage: projectStage as ProjectStage,
        createdBy: createdBy.trim() || null,
      });
      setDirty(false);
      addToast('Project updated.', 'success');
      await onUpdated();
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update project.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <p className="flex items-center gap-1.5 text-[11px] text-text-muted mb-4 select-none">
        <Pencil className="h-3 w-3 shrink-0" />
        Click any field to edit it inline
      </p>

      <div className="text-sm space-y-6 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
          <InlineSelectField
            label="Attraction"
            value={String(attractionId || '')}
            onChange={onAttractionChange}
            options={attractionOptions}
          />
          <InlineSelectField
            label="Tour"
            value={tourSelectValue}
            onChange={onTourChange}
            options={toursForAttraction}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
          <div>
            <span className="text-xs text-text-muted">Tour management company</span>
            <div className="text-sm text-text-primary mt-0.5 font-medium">{tourMgmtLabel}</div>
          </div>
          <div>
            <span className="text-xs text-text-muted">Markets (DMA)</span>
            <div className="text-sm text-text-primary mt-0.5">—</div>
            <p className="text-[11px] text-text-muted mt-1">
              Market selections from project creation are not stored on the project in the database yet, so they cannot be edited here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
          <InlineSelectField
            label="Project stage"
            value={projectStage}
            onChange={mark(setProjectStage)}
            options={stageOptions}
          />
          <InlineEditField
            label="Created by (optional)"
            value={createdBy}
            onChange={mark(setCreatedBy)}
            placeholder="—"
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
          <div>
            <span className="text-xs text-text-muted">Created date</span>
            <div className="text-sm text-text-primary mt-0.5">
              {project.createdDate ? new Date(project.createdDate).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted">Venue proposals</span>
            <div className="text-sm text-text-primary mt-0.5 flex items-center gap-2">
              <span className="font-mono tabular-nums">{project.venues.length}</span>
              <button type="button" onClick={onGoToVenues} className="text-ems-accent text-xs hover:underline">
                Open Venues tab
              </button>
            </div>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 -mx-4 px-4 py-3 mt-4 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-between gap-3 z-10">
          <span className="text-xs text-text-secondary flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ems-accent inline-block animate-pulse" />
            Unsaved changes
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="text-text-secondary text-xs px-3 py-1.5 hover:text-text-primary rounded-md hover:bg-elevated transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-ems-accent hover:bg-ems-accent/80 text-background text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Extra display names for common DB literals (any other value still renders via `projectStageDisplayLabel`). */
const CANONICAL_PROJECT_STAGE_LABEL: Record<string, string> = {
  Confirmed: 'Confirmed',
  Pending: 'Pending',
  Inactive: 'Inactive',
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

const CREATE_PROJECT_STAGE_OPTIONS = projectStageSelectOptions([...PROJECT_STAGE_VALUES]);

/** Includes the current DB value when it is a legacy stage so the field can show until the user picks a new one. */
function editProjectStageSelectOptions(currentFromDb: string | null | undefined) {
  const s = new Set<string>([...PROJECT_STAGE_VALUES]);
  const cur = (currentFromDb ?? '').trim();
  if (cur) s.add(cur);
  return projectStageSelectOptions(
    [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
  );
}
const OPTION_STATUS_OPTIONS = OPTION_STATUS_VALUES.map((v) => ({ value: v, label: v }));

/** Allowed `VenueStatus` for EngagementProjectVenue: API (CHECK / env / rows), else legacy fallback. */
function useResolvedVenueStatusStrings(currentValue?: string) {
  const q = useQuery({
    queryKey: ['projects', 'meta', 'venue-statuses'],
    queryFn: fetchVenueStatusMeta,
    staleTime: 60_000,
  });
  return useMemo(() => {
    const fromApi = q.data?.venueStatuses;
    const base: string[] =
      fromApi && fromApi.length > 0
        ? fromApi
        : (VENUE_STATUS_VALUES as readonly string[]).slice();
    const v = (currentValue ?? '').trim();
    if (v && !base.includes(v)) {
      return [...base, v].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    return base;
  }, [q.data, currentValue]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  // These props keep legacy Index.tsx calls working without errors
  projects?: unknown; engagements?: unknown; tours?: unknown; attractions?: unknown;
  companies?: unknown; contacts?: unknown; dmas?: unknown; users?: unknown;
  onNavigate?: (view: string, data?: unknown) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreateEngagement?: unknown; onUpdateProjects?: unknown; onDeleteProject?: unknown;
}

// ─── Projects list: movable columns (Stage fixed) + server-side sort ─────────

const PROJECTS_LIST_MOVABLE_ORDER_KEY = 'iae-projects-list-movable-column-order-v1';

type ProjectMovableColumnId =
  | 'attraction'
  | 'tour'
  | 'tourMgmt'
  | 'createdBy'
  | 'created';

const PROJECT_STAGE_VISUAL_INDEX = 3;

const DEFAULT_PROJECT_MOVABLE_COLUMNS: ProjectMovableColumnId[] = [
  'attraction',
  'tour',
  'tourMgmt',
  'createdBy',
  'created',
];

const PROJECT_MOVABLE_LABELS: Record<ProjectMovableColumnId, string> = {
  attraction: 'Attraction',
  tour: 'Tour',
  tourMgmt: 'Tour mgmt',
  createdBy: 'Created By',
  created: 'Created',
};

const SORT_API_BY_COLUMN: Record<ProjectMovableColumnId, string> = {
  attraction: 'attraction',
  tour: 'tour',
  tourMgmt: 'tourmgmt',
  createdBy: 'createdby',
  created: 'created',
};

function loadProjectMovableColumnOrder(): ProjectMovableColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_MOVABLE_COLUMNS;
  try {
    const raw = localStorage.getItem(PROJECTS_LIST_MOVABLE_ORDER_KEY);
    if (!raw) return DEFAULT_PROJECT_MOVABLE_COLUMNS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_PROJECT_MOVABLE_COLUMNS;
    const need = new Set<ProjectMovableColumnId>(DEFAULT_PROJECT_MOVABLE_COLUMNS);
    const out: ProjectMovableColumnId[] = [];
    for (const x of parsed) {
      if (typeof x === 'string' && need.has(x as ProjectMovableColumnId)) {
        out.push(x as ProjectMovableColumnId);
        need.delete(x as ProjectMovableColumnId);
      }
    }
    for (const id of DEFAULT_PROJECT_MOVABLE_COLUMNS) {
      if (need.has(id)) {
        out.push(id);
        need.delete(id);
      }
    }
    return out;
  } catch {
    return DEFAULT_PROJECT_MOVABLE_COLUMNS;
  }
}

function saveProjectMovableColumnOrder(order: ProjectMovableColumnId[]) {
  try {
    localStorage.setItem(PROJECTS_LIST_MOVABLE_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function visualIndexToMovable(vis: number): number {
  if (vis === PROJECT_STAGE_VISUAL_INDEX) return -1;
  return vis < PROJECT_STAGE_VISUAL_INDEX ? vis : vis - 1;
}

function buildProjectVisualSlots(
  movableOrder: ProjectMovableColumnId[],
): Array<ProjectMovableColumnId | 'stage'> {
  const out: Array<ProjectMovableColumnId | 'stage'> = [];
  let m = 0;
  for (let i = 0; i < 6; i++) {
    if (i === PROJECT_STAGE_VISUAL_INDEX) out.push('stage');
    else out.push(movableOrder[m++]!);
  }
  return out;
}

function renderProjectListCell(slot: ProjectMovableColumnId | 'stage', p: ApiProjectListRow) {
  if (slot === 'stage') {
    return (
      <td key="stage" className="py-2.5 px-3">
        <StatusBadge status={p.projectStage} />
      </td>
    );
  }
  switch (slot) {
    case 'attraction':
      return (
        <td key="attraction" className="py-2.5 px-3 text-text-primary font-medium">
          {p.attractionName ?? '—'}
        </td>
      );
    case 'tour':
      return (
        <td key="tour" className="py-2.5 px-3 text-text-secondary">
          {p.tourName ?? <span className="text-text-muted italic">No tour name</span>}
        </td>
      );
    case 'tourMgmt':
      return (
        <td key="tourMgmt" className="py-2.5 px-3 text-text-secondary text-xs">
          {p.tourManagementCompanyName ?? '—'}
        </td>
      );
    case 'createdBy':
      return (
        <td key="createdBy" className="py-2.5 px-3 text-text-secondary">
          {p.createdBy ?? '—'}
        </td>
      );
    case 'created':
      return (
        <td key="created" className="py-2.5 px-3 text-xs text-text-muted tabular-nums">
          {p.createdDate ? new Date(p.createdDate).toLocaleDateString() : '—'}
        </td>
      );
    default:
      return null;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectsTableSkeleton({ rowCount = PAGE_SIZE }: { rowCount?: number }) {
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
              {['Attraction', 'Tour', 'Tour mgmt', 'Stage', 'Created By', 'Created'].map((h, i) => (
                <th key={i} className="text-left py-2.5 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
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
  const venueStatusStrings = useResolvedVenueStatusStrings(venue.venueStatus);
  const venueStatusOptions = useMemo(
    () => venueStatusStrings.map((v) => ({ value: v, label: v })),
    [venueStatusStrings],
  );
  const [showAddOpt, setShowAddOpt] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [venueStatus, setVenueStatus] = useState<string>(venue.venueStatus);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setVenueStatus(venue.venueStatus);
  }, [venue.venueStatus]);

  const handleStatusSave = async () => {
    setStatusSaving(true);
    try {
      await updateProjectVenue(projectId, venue.engagementProjectVenueId, { venueStatus: venueStatus as VenueStatus });
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
              {venue.venueCompanyName ?? venue.venueName ?? 'Unknown venue'}
            </span>
            {venue.venueName && venue.venueName !== venue.venueCompanyName && (
              <div className="text-xs text-text-secondary">{venue.venueName}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <div className="w-36">
                  <Select2
                    options={venueStatusOptions}
                    value={venueStatus}
                    onChange={setVenueStatus}
                    disabled={venueStatusOptions.length === 0}
                    placeholder={venueStatusOptions.length ? 'Select…' : 'Loading…'}
                  />
                </div>
                <button type="button" onClick={() => void handleStatusSave()} disabled={statusSaving}
                  className="inline-flex items-center gap-1 bg-ems-accent text-background text-xs px-2 py-1 rounded disabled:opacity-60">
                  {statusSaving && <Loader2 className="h-3 w-3 animate-spin" />}Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVenueStatus(venue.venueStatus);
                    setEditingStatus(false);
                  }}
                  className="text-text-muted text-xs px-1 hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVenueStatus(venue.venueStatus);
                  setEditingStatus(true);
                }}
                title="Click to change status"
              >
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
  const venueStatusStrings = useResolvedVenueStatusStrings();
  const venueStatusOptions = useMemo(
    () => venueStatusStrings.map((v) => ({ value: v, label: v })),
    [venueStatusStrings],
  );
  const [venueId, setVenueId] = useState('');
  const [venueStatus, setVenueStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (venueStatus) return;
    if (venueStatusStrings[0]) setVenueStatus(venueStatusStrings[0]);
  }, [venueStatus, venueStatusStrings]);

  const venueOptions = useMemo(() => {
    return (companiesQuery.data ?? [])
      .filter((c) => c.companyTypeName === 'Venue' && !existingIds.has(c.companyId))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }))
      .map((c) => ({ value: String(c.companyId), label: c.companyName }));
  }, [companiesQuery.data, existingIds]);

  const handleSave = async () => {
    if (!venueId) { addToast('Select a venue.', 'warning'); return; }
    if (!venueStatus) { addToast('Select a venue status.', 'warning'); return; }
    setSaving(true);
    try {
      await createProjectVenue(projectId, { venueCompanyId: Number(venueId), venueStatus: venueStatus as VenueStatus });
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
          <Select2
            options={venueStatusOptions}
            value={venueStatus}
            onChange={setVenueStatus}
            disabled={venueStatusOptions.length === 0}
            placeholder={venueStatusOptions.length ? 'Select status' : 'Loading…'}
          />
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
  projectId,
  onClose,
  onRequestDelete,
  addToast,
}: {
  projectId: number;
  onClose: () => void;
  onRequestDelete: (row: ApiProjectListRow) => void;
  addToast: Props['addToast'];
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAddVenue, setShowAddVenue] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => fetchProject(projectId),
  });

  const attractionsQuery = useQuery({
    queryKey: ['attractions', 'picker', 0, PROJECT_LOOKUP_LIMIT],
    queryFn: async () => (await fetchAttractions(0, PROJECT_LOOKUP_LIMIT)).data,
    staleTime: 60_000,
  });
  const toursQuery = useQuery({
    queryKey: ['tours', 'picker', 0, PROJECT_LOOKUP_LIMIT],
    queryFn: async () => (await fetchTours(0, PROJECT_LOOKUP_LIMIT)).data,
    staleTime: 60_000,
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
                {[project?.attractionName, project?.tourName].filter(Boolean).join(' — ') || 'Project'}
              </h2>
              <div className="flex items-center flex-wrap gap-2 mt-0.5">
                {project?.tourManagementCompanyName && (
                  <span className="text-xs text-text-secondary">{project.tourManagementCompanyName}</span>
                )}
                {project?.projectStage && <StatusBadge status={project.projectStage} />}
              </div>
            </>
          )}
        </div>
        {project && !detailQuery.isLoading && (
          <button
            type="button"
            onClick={() => onRequestDelete(projectDetailToListRow(project))}
            title="Delete this project"
            className="p-1.5 text-text-muted hover:text-ems-coral hover:bg-ems-coral/10 rounded-md transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
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

        {!detailQuery.isLoading && project && activeTab === 'Overview' && (attractionsQuery.isPending || toursQuery.isPending) && (
          <div className="flex items-center gap-2 text-sm text-text-muted py-8" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />
            Loading fields…
          </div>
        )}

        {!detailQuery.isLoading && project && activeTab === 'Overview' && !attractionsQuery.isPending && !toursQuery.isPending && (
          <ProjectInlineOverview
            project={project}
            tours={toursQuery.data ?? []}
            attractions={attractionsQuery.data ?? []}
            onUpdated={async () => {
              await refresh();
              await qc.invalidateQueries({ queryKey: ['projects', 'api'] });
            }}
            onGoToVenues={() => setActiveTab('Venues')}
            addToast={addToast}
          />
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
  { num: 3, label: 'Markets' },
  { num: 4, label: 'Details' },
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
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: 60_000 });
  const companiesPickerQuery = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 60_000,
  });
  const [step, setStep] = useState(1);

  const [dmaSearchInput, setDmaSearchInput] = useState('');
  /** Set only when the user clicks search (non-empty trim); drives API + list. */
  const [dmaAppliedQuery, setDmaAppliedQuery] = useState<string | null>(null);
  /** Bumps on every search click so repeating the same term refetches from page 1. */
  const [dmaSearchRunId, setDmaSearchRunId] = useState(0);

  /** Direct dbo.DMA pages — runs only after an explicit search submit. */
  const dmaMarketsInfinite = useInfiniteQuery({
    queryKey: ['dma-markets', 'project-wizard', dmaAppliedQuery ?? '', dmaSearchRunId],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const q = dmaAppliedQuery?.trim() ?? '';
      if (!q) return { data: [] as ApiDmaMarket[], total: 0 };
      return fetchDmaMarketsPaged(offset, DMA_PICKER_PAGE_SIZE, q);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
    enabled: step === 3 && dmaAppliedQuery != null && dmaAppliedQuery.trim().length > 0,
    staleTime: 0,
    gcTime: 0,
  });

  const [attractionSearch, setAttractionSearch] = useState('');
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [tourSearch, setTourSearch] = useState('');

  const [selectedDmaIds, setSelectedDmaIds] = useState<number[]>([]);
  /** Labels for any DMA row we have shown or toggled (survives search/scroll changes). */
  const [dmaSeenLabels, setDmaSeenLabels] = useState(() => new Map<number, string>());

  const [projectStage, setProjectStage] = useState<ProjectStage>('Pending');
  const [createdBy, setCreatedBy] = useState('');

  const [showAddTourModal, setShowAddTourModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const attractions = attractionsQuery.data ?? [];
  const tours = toursQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const managementCompanyOptions = useMemo(() => {
    const rows = companiesPickerQuery.data ?? [];
    return rows
      .filter((c) => (c.companyTypeName ?? '').trim().toLowerCase() === 'talent agency')
      .map((c) => ({ value: String(c.companyId), label: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [companiesPickerQuery.data]);
  const dmaFlatRows: ApiDmaMarket[] = useMemo(
    () => dmaMarketsInfinite.data?.pages.flatMap((p) => p.data) ?? [],
    [dmaMarketsInfinite.data],
  );
  const dmaTotal = dmaMarketsInfinite.data?.pages[0]?.total ?? 0;

  const recordDmaLabels = useCallback((rows: ApiDmaMarket[]) => {
    if (rows.length === 0) return;
    setDmaSeenLabels((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const r of rows) {
        const label = formatDmaPickerLabel(r);
        if (next.get(r.dmaid) !== label) {
          next.set(r.dmaid, label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    recordDmaLabels(dmaFlatRows);
  }, [dmaFlatRows, recordDmaLabels]);

  useEffect(() => {
    dmaListRef.current?.scrollTo({ top: 0 });
  }, [dmaAppliedQuery]);

  const commitDmaSearch = useCallback(() => {
    const q = dmaSearchInput.trim();
    if (!q) {
      addToast('Enter a search term (postal code, market name, or DMA ID), then click search.', 'warning');
      return;
    }
    setDmaAppliedQuery(q);
    setDmaSearchRunId((n) => n + 1);
  }, [dmaSearchInput, addToast]);

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

  const dmaListRef = useRef<HTMLDivElement>(null);
  const onDmaListScroll = useCallback(() => {
    const el = dmaListRef.current;
    if (!el || dmaMarketsInfinite.isFetchingNextPage || !dmaMarketsInfinite.hasNextPage) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      void dmaMarketsInfinite.fetchNextPage();
    }
  }, [dmaMarketsInfinite]);

  const inputCls =
    'w-full min-w-0 cursor-text bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const lookupsLoading =
    attractionsQuery.isPending || toursQuery.isPending || classesQuery.isPending;

  const selectedTour = selectedTourId ? tours.find((t) => t.tourId === selectedTourId) : null;
  const selectedAttraction =
    selectedAttractionId != null
      ? attractions.find((a) => a.attractionId === selectedAttractionId)
      : null;

  const canProceedStep1 = selectedAttractionId != null;
  const canProceedStep2 = selectedTourId != null;
  /** Only used on the final “Create Project” action (step 4). */
  const canCreateProject = selectedTourId != null;

  const handleBack = () => setStep((s) => Math.max(1, s - 1));
  const handleNext = () => setStep((s) => Math.min(WIZARD_LAST, s + 1));

  const createTourMut = useMutation({
    mutationFn: ({
      body,
      bannerFile,
    }: {
      body: import('@/api/attractionToursApi').CreateTourPayload;
      bannerFile?: File | null;
    }) => createTour(body, bannerFile ? { bannerFile } : undefined),
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
    const stage = projectStage;
    if (!stage) {
      addToast('Select a project stage before creating the project.', 'error');
      return;
    }
    setSaving(true);
    try {
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

  const toggleDmaRow = (r: ApiDmaMarket) => {
    recordDmaLabels([r]);
    setSelectedDmaIds((prev) =>
      prev.includes(r.dmaid) ? prev.filter((id) => id !== r.dmaid) : [...prev, r.dmaid],
    );
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
            type="text"
            className={inputCls}
            placeholder="Search attractions by name…"
            value={attractionSearch}
            onChange={(e) => setAttractionSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
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
            type="text"
            className={inputCls}
            placeholder="Search tours by name…"
            value={tourSearch}
            onChange={(e) => setTourSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
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

      {/* Step 3: Select Markets — dbo.DMA */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Select Markets (DMAs)</h3>
            <span className="text-xs text-text-muted">Optional</span>
          </div>
          <p className="text-xs text-text-muted">
            Type a postal code, market name, or DMA ID, then click the search button. Results load from the database in batches of{' '}
            <span className="font-medium text-text-secondary">{DMA_PICKER_PAGE_SIZE}</span>; scroll the list to load more matches.
          </p>
          <FormField label="DMA (from database)">
            <div className="flex gap-2 items-stretch">
              <input
                type="text"
                className={`${inputCls} flex-1 min-w-0`}
                placeholder="Search by postal code, market name, or DMA ID…"
                value={dmaSearchInput}
                onChange={(e) => setDmaSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitDmaSearch();
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => commitDmaSearch()}
                disabled={!dmaSearchInput.trim()}
                className="shrink-0 inline-flex items-center justify-center w-10 rounded-md border border-border bg-elevated text-text-primary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Search DMAs"
              >
                <Search className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </FormField>

          {dmaAppliedQuery == null ? (
            <p className="text-xs text-text-muted px-0.5 py-2 border border-dashed border-border rounded-lg text-center">
              No results yet — enter a search term and click search.
            </p>
          ) : dmaMarketsInfinite.isPending && dmaFlatRows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center border border-dashed border-border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-ems-accent shrink-0" />
              Loading matches…
            </div>
          ) : dmaMarketsInfinite.isError ? (
            <div className="rounded-lg border border-ems-coral/40 bg-ems-coral/10 px-3 py-2 text-sm text-text-primary space-y-2">
              <p>Could not load DMA options: {friendlyApiError(dmaMarketsInfinite.error)}</p>
              <button
                type="button"
                className="text-sm font-medium text-ems-accent hover:underline"
                onClick={() => void dmaMarketsInfinite.refetch()}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div
                ref={dmaListRef}
                onScroll={onDmaListScroll}
                className="max-h-[min(24rem,50vh)] overflow-y-auto rounded-md border border-border bg-surface divide-y divide-border/60"
              >
                {dmaFlatRows.length === 0 && !dmaMarketsInfinite.isFetching && (
                  <p className="text-sm text-text-muted px-3 py-6 text-center">No rows match this search.</p>
                )}
                {dmaFlatRows.map((r) => {
                  const checked = selectedDmaIds.includes(r.dmaid);
                  return (
                    <label
                      key={r.dmaid}
                      className="flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-hover/80 text-text-primary"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border text-ems-accent focus:ring-ems-accent"
                        checked={checked}
                        onChange={() => toggleDmaRow(r)}
                      />
                      <span className="min-w-0 break-words">{formatDmaPickerLabel(r)}</span>
                    </label>
                  );
                })}
                {(dmaMarketsInfinite.isFetchingNextPage ||
                  (dmaMarketsInfinite.isFetching && dmaFlatRows.length === 0)) && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-ems-accent shrink-0" />
                    Loading…
                  </div>
                )}
              </div>
              {dmaTotal > 0 && (
                <p className="text-[11px] text-text-muted mt-1.5">
                  Loaded {dmaFlatRows.length} of {dmaTotal.toLocaleString()} matching row{dmaTotal === 1 ? '' : 's'}
                  {dmaMarketsInfinite.hasNextPage ? ' — scroll for more.' : '.'}
                </p>
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
                    <span className="truncate">{dmaSeenLabels.get(dmaid) ?? `DMA #${dmaid}`}</span>
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

      {/* Step 4: Project Details */}
      {step === 4 && (
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
            <FormField label="Markets Selected">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {selectedDmaIds.length > 0 ? `${selectedDmaIds.length} market(s)` : '— None —'}
              </div>
            </FormField>
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text-secondary">Project stage is required.</span> Choose{' '}
                <span className="font-medium">Confirmed</span>, <span className="font-medium">Pending</span>, or{' '}
                <span className="font-medium">Inactive</span>, then click Create Project.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Project Stage" required>
                  <Select2
                    options={CREATE_PROJECT_STAGE_OPTIONS}
                    value={projectStage}
                    onChange={(v) => setProjectStage(v as ProjectStage)}
                    placeholder="Select project stage"
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
          variant="project-wizard"
          attractions={attractions}
          classes={classes}
          managementCompanyOptions={managementCompanyOptions}
          lockAttractionId={selectedAttractionId}
          submitting={createTourMut.isPending}
          onCancel={() => setShowAddTourModal(false)}
          onSave={(body, bannerFile) =>
            void createTourMut.mutateAsync({ body, bannerFile: bannerFile ?? undefined })
          }
        />
      </Modal>
    )}
    </>
  );
}

// ─── Main ProjectsPage ────────────────────────────────────────────────────────

export function ProjectsPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [movableColumnOrder, setMovableColumnOrder] = useState<ProjectMovableColumnId[]>(
    loadProjectMovableColumnOrder,
  );
  const [sortState, setSortState] = useState<{
    col: ProjectMovableColumnId | null;
    dir: 'asc' | 'desc';
  }>({ col: null, dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiProjectListRow | null>(null);

  const { offset, limit } = getPageParams(page, pageSize);

  const visualSlots = useMemo(
    () => buildProjectVisualSlots(movableColumnOrder),
    [movableColumnOrder],
  );

  const reorderMovableColumns = useCallback((fromM: number, toM: number) => {
    if (fromM === toM || fromM < 0 || toM < 0) return;
    setMovableColumnOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromM, 1);
      next.splice(toM, 0, moved);
      saveProjectMovableColumnOrder(next);
      return next;
    });
  }, []);

  const toggleColumnSort = useCallback((col: ProjectMovableColumnId) => {
    setSortState((s) => {
      if (s.col === col) return { col, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      return { col, dir: 'asc' };
    });
    setPage(1);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const sortByParam = sortState.col ? SORT_API_BY_COLUMN[sortState.col] : '';
  const sortDirParam = sortState.col ? sortState.dir : '';

  const projectsQuery = useQuery({
    queryKey: projectsApiQueryKey(offset, limit, searchDebounced, stageFilter, sortByParam, sortDirParam),
    queryFn: async () => {
      const res: ApiPaginatedResponse<ApiProjectListRow> = await fetchProjects(offset, limit, {
        q: searchDebounced || undefined,
        projectStage: stageFilter,
        sortBy: sortState.col ? SORT_API_BY_COLUMN[sortState.col] : undefined,
        sortDir: sortState.col ? sortState.dir : undefined,
      });
      return { data: res.data, total: res.total };
    },
    placeholderData: (prev) => prev,
  });

  const stageFilterOptions = useMemo(
    () => [{ value: 'All', label: 'All' }, ...projectStageSelectOptions([...PROJECT_STAGE_VALUES])],
    [],
  );

  const refetchProjectList = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['projects', 'api'] });
  }, [qc]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: async () => {
      await refetchProjectList();
      if (selectedProjectId === pendingDelete?.engagementProjectId) setSelectedProjectId(null);
      addToast('Project deleted.', 'warning');
      setPendingDelete(null);
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete project.'), 'error'),
  });

  const rows = projectsQuery.data?.data ?? [];
  const serverTotal = projectsQuery.data?.total ?? 0;

  useEffect(() => { setPage(1); }, [searchDebounced, stageFilter]);

  useEffect(() => { setPage(1); }, [pageSize]);

  const pageCount = getTotalPages(serverTotal, pageSize);
  const { rangeStart, rangeEnd } = getPageRange(page, serverTotal, pageSize);
  const pageClamped = Math.min(page, pageCount);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const isLoading = projectsQuery.isPending || projectsQuery.isFetching;
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
              You&apos;re about to permanently delete this project
              {pendingDelete?.attractionName || pendingDelete?.tourName ? (
                <>
                  {' '}
                  (
                  <span className="font-medium text-text-primary">
                    {pendingDelete.attractionName}
                    {pendingDelete.tourName ? ` — ${pendingDelete.tourName}` : ''}
                  </span>
                  )
                </>
              ) : null}
              . All venue proposals and date options will be removed.
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
          Could not load projects: {(projectsQuery.error as Error).message}. Is the API running at{' '}
          <code className="text-xs">/api</code> (see Vite proxy)?
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
          {isLoading ? <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden /> : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {serverTotal.toLocaleString()}
            </span>
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
      {isLoading ? <ProjectsTableSkeleton rowCount={isAllPageSize(pageSize) ? PAGE_SIZE : pageSize} /> : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  {visualSlots.map((slot, visualIndex) => {
                    if (slot === 'stage') {
                      return (
                        <th
                          key="stage"
                          scope="col"
                          className="text-left py-2.5 px-3 text-text-muted bg-surface"
                          onDragOver={(e) => e.preventDefault()}
                        >
                          Stage
                        </th>
                      );
                    }
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
                          const fromM = visualIndexToMovable(fromVis);
                          const toM = visualIndexToMovable(visualIndex);
                          if (fromM < 0 || toM < 0) return;
                          reorderMovableColumns(fromM, toM);
                        }}
                        className="text-left py-2.5 px-3 text-text-muted bg-surface select-none min-w-0 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder columns"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-70 pointer-events-none" aria-hidden />
                          <button
                            type="button"
                            className="inline-flex min-w-0 flex-1 items-center gap-1 text-left font-medium text-text-muted hover:text-text-primary cursor-pointer"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleColumnSort(slot);
                            }}
                          >
                            <span className="truncate">{PROJECT_MOVABLE_LABELS[slot]}</span>
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
                {rows.length === 0 && !projectsQuery.isError && (
                  <tr>
                    <td colSpan={6} className="py-12 px-3 text-center text-sm text-text-muted">
                      {!searchDebounced && stageFilter === 'All'
                        ? 'No projects returned from the database.'
                        : 'No projects match your search or filters.'}
                    </td>
                  </tr>
                )}
                {rows.map((p) => (
                  <tr
                    key={p.engagementProjectId}
                    onClick={() => {
                      setSelectedProjectId(p.engagementProjectId);
                    }}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                  >
                    {visualSlots.map((slot) => renderProjectListCell(slot, p))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {serverTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of <span className="text-text-primary font-medium">{serverTotal.toLocaleString()}</span>
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted">
                  <span aria-hidden>·</span>
                  <PageSizeSelect
                    value={pageSize}
                    onChange={setPageSize}
                    disabled={isLoading}
                  />
                  <span>per page</span>
                </span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={pageClamped <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-text-muted tabular-nums px-1">Page {pageClamped} / {pageCount}</span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={pageClamped >= pageCount || isLoading}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {selectedProjectId !== null && (
        <ProjectDetailDrawer
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          onRequestDelete={(row) => {
            setSelectedProjectId(null);
            setPendingDelete(row);
          }}
          addToast={addToast}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <Modal title="Create Project" onClose={() => setShowCreateModal(false)} width={700} allowContentOverflow>
          <CreateProjectForm
            key="create-project"
            onSaved={async (id) => {
              await refetchProjectList();
              setShowCreateModal(false);
              addToast('Project created successfully.', 'success');
              setSelectedProjectId(id);
            }}
            onCancel={() => setShowCreateModal(false)}
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