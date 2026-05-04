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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, Pencil, Trash2, X } from 'lucide-react';
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
  fetchVenueTypesLookup,
} from '@/api/attractionToursApi';
import type { ApiAttractionListRow, ApiTourListRow, ApiVenueType } from '@/api/attractionToursApi';
import {
  fetchCompanyContacts,
  fetchDmaMarketsPaged,
  fetchTalentAgencyCompanyRows,
  talentAgencyCompaniesQueryKey,
  type ApiCompanyContact,
  type ApiDmaMarket,
} from '@/api/companyApi';
import { fetchAllVenues, type ApiAllVenueRow } from '@/api/venueDirectoryApi';
import { AddTourForm } from './AddTourForm';

// ─── Constants ────────────────────────────────────────────────────────────────

function projectDetailToListRow(p: ApiProjectDetail): ApiProjectListRow {
  return {
    engagementProjectId: p.engagementProjectId,
    tourId: p.tourId,
    attractionId: p.attractionId ?? null,
    tourName: p.tourName,
    attractionName: p.attractionName,
    talentAgencyCompanyId: p.talentAgencyCompanyId ?? null,
    talentAgencyCompanyName: p.talentAgencyCompanyName ?? null,
    projectStage: p.projectStage,
    createdDate: p.createdDate,
    createdBy: p.createdBy,
    dmaIds: p.dmaIds ?? [],
  };
}

const PROJECT_LOOKUP_LIMIT = 8000;

/** API returns one row per market name; label is market name only (no postal in UI). */
function formatDmaPickerLabel(r: { dmaid?: number; marketName?: string | null }): string {
  const name = (r.marketName ?? '').trim();
  if (name) return name;
  return r.dmaid != null ? `DMA #${r.dmaid}` : '—';
}

function formatVenueWizardLabel(r: ApiAllVenueRow): string {
  const base = (r.venueName ?? '').trim() || `Company #${r.companyId}`;
  const ex = (r.entertainmentComplexNames ?? '').trim();
  return ex ? `${base} (${ex})` : base;
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
  dmaMarkets,
  onUpdated,
  onGoToVenues,
  addToast,
}: {
  project: ApiProjectDetail;
  tours: ApiTourListRow[];
  dmaMarkets: ApiDmaMarket[];
  onUpdated: () => void | Promise<void>;
  onGoToVenues: () => void;
  addToast: Props['addToast'];
}) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tourId, setTourId] = useState(project.tourId);
  const [projectStage, setProjectStage] = useState(project.projectStage);
  const [createdBy, setCreatedBy] = useState(project.createdBy ?? '');
  const [talentAgencyCompanyId, setTalentAgencyCompanyId] = useState<number | null>(
    project.talentAgencyCompanyId ?? null,
  );
  const [selectedTalentAgentContactId, setSelectedTalentAgentContactId] = useState<number | null>(null);
  const [scopeTransitioning, setScopeTransitioning] = useState(false);
  const [selectedDmaIds, setSelectedDmaIds] = useState<number[]>(project.dmaIds ?? []);
  const [showDmaModal, setShowDmaModal] = useState(false);
  const [dmaDraftIds, setDmaDraftIds] = useState<number[]>(project.dmaIds ?? []);
  const [dmaModalSearch, setDmaModalSearch] = useState('');

  const mark = useCallback(<T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  }, []);

  useEffect(() => {
    setTourId(project.tourId);
    setProjectStage(project.projectStage);
    setCreatedBy(project.createdBy ?? '');
    setTalentAgencyCompanyId(project.talentAgencyCompanyId ?? null);
    setSelectedTalentAgentContactId(null);
    setSelectedDmaIds(project.dmaIds ?? []);
    setDmaDraftIds(project.dmaIds ?? []);
    setDmaModalSearch('');
    setShowDmaModal(false);
    setDirty(false);
  }, [
    project.engagementProjectId,
    project.tourId,
    project.projectStage,
    project.createdBy,
    project.talentAgencyCompanyId,
    project.dmaIds,
  ]);

  const projectAttractionId = project.attractionId ?? null;

  const toursForAttraction = useMemo(() => {
    const list = tours
      .filter((t) => projectAttractionId != null && t.attractionId === projectAttractionId)
      .sort((a, b) => a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' }));
    return [
      { value: '', label: 'Select a tour…' },
      ...list.map((t) => ({ value: String(t.tourId), label: t.tourName })),
    ];
  }, [tours, projectAttractionId]);

  const tourBelongsToAttraction = useMemo(() => {
    if (!tourId || !projectAttractionId) return false;
    const t = tours.find((x) => x.tourId === tourId);
    return Boolean(t && t.attractionId === projectAttractionId);
  }, [tourId, projectAttractionId, tours]);

  const tourSelectValue = tourBelongsToAttraction ? String(tourId) : '';

  const talentAgencyPickerQuery = useQuery({
    queryKey: talentAgencyCompaniesQueryKey(),
    queryFn: fetchTalentAgencyCompanyRows,
    staleTime: 60_000,
    enabled: tourBelongsToAttraction,
  });
  const talentAgencyOptions = useMemo(() => {
    const rows = talentAgencyPickerQuery.data ?? [];
    return rows
      .map((c) => ({ value: String(c.companyId), label: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [talentAgencyPickerQuery.data]);
  const talentAgentContactsQuery = useQuery({
    queryKey: ['company', talentAgencyCompanyId ?? 0, 'contacts'],
    queryFn: () => fetchCompanyContacts(talentAgencyCompanyId as number),
    enabled: talentAgencyCompanyId != null && talentAgencyCompanyId >= 1,
    staleTime: 60_000,
  });
  const talentAgentOptions = useMemo(
    () =>
      (talentAgentContactsQuery.data ?? []).map((row: ApiCompanyContact) => ({
        value: String(row.contactAssignmentId),
        label: `${row.firstName} ${row.lastName}`.trim(),
      })),
    [talentAgentContactsQuery.data],
  );

  const onTourChange = (v: string) => {
    const nextTourId = v ? Number(v) : 0;
    setTourId(nextTourId);
    const nextTour = tours.find((t) => t.tourId === nextTourId);
    setTalentAgencyCompanyId(
      nextTour?.talentAgencyCompanyId != null && nextTour.talentAgencyCompanyId >= 1
        ? nextTour.talentAgencyCompanyId
        : null,
    );
    setSelectedTalentAgentContactId(null);
    setDirty(true);
  };

  const selectedTour = tourBelongsToAttraction
    ? tours.find((t) => t.tourId === tourId)
    : undefined;
  const effectiveTalentAgencyId = talentAgencyCompanyId;
  const tourTalentAgencyLocked = Boolean(
    selectedTour?.talentAgencyCompanyId != null &&
      (selectedTour.talentAgencyCompanyId ?? 0) >= 1,
  );
  const effectiveTalentAgencyLabel =
    selectedTour?.talentAgencyCompanyName?.trim()
    || talentAgencyOptions.find((o) => o.value === String(effectiveTalentAgencyId))?.label
    || '—';

  useEffect(() => {
    setSelectedTalentAgentContactId(null);
  }, [effectiveTalentAgencyId]);

  const stageOptions = useMemo(() => editProjectStageSelectOptions(project.projectStage), [project.projectStage]);

  const discard = () => {
    setTourId(project.tourId);
    setProjectStage(project.projectStage);
    setCreatedBy(project.createdBy ?? '');
    setTalentAgencyCompanyId(project.talentAgencyCompanyId ?? null);
    setSelectedTalentAgentContactId(null);
    setSelectedDmaIds(project.dmaIds ?? []);
    setDmaDraftIds(project.dmaIds ?? []);
    setDmaModalSearch('');
    setShowDmaModal(false);
    setDirty(false);
  };

  const filteredDmaMarkets = useMemo(() => {
    const q = dmaModalSearch.trim().toLowerCase();
    if (!q) return dmaMarkets;
    return dmaMarkets.filter((row) => formatDmaPickerLabel(row).toLowerCase().includes(q));
  }, [dmaMarkets, dmaModalSearch]);

  const toggleDmaDraft = (dmaid: number) => {
    setDmaDraftIds((prev) =>
      prev.includes(dmaid) ? prev.filter((id) => id !== dmaid) : [...prev, dmaid],
    );
  };

  const openDmaModal = () => {
    setDmaDraftIds(selectedDmaIds);
    setDmaModalSearch('');
    setShowDmaModal(true);
  };

  const applyDmaDraft = () => {
    const normalized = [...dmaDraftIds].sort((a, b) => a - b);
    const current = [...selectedDmaIds].sort((a, b) => a - b);
    const changed = normalized.join(',') !== current.join(',');
    setSelectedDmaIds(normalized);
    setShowDmaModal(false);
    if (changed) setDirty(true);
  };

  const handleSave = async () => {
    if (!tourId || !tourBelongsToAttraction) {
      addToast('Select a tour that belongs to the selected attraction before saving.', 'warning');
      return;
    }
    if (effectiveTalentAgencyId == null || effectiveTalentAgencyId < 1) {
      addToast('Select a Talent Agency before saving.', 'warning');
      return;
    }
    if (selectedTalentAgentContactId == null || selectedTalentAgentContactId < 1) {
      addToast('Talent Agent is required.', 'warning');
      return;
    }
    const previousDmaKey = [...(project.dmaIds ?? [])].sort((a, b) => a - b).join(',');
    const nextDmaKey = [...selectedDmaIds].sort((a, b) => a - b).join(',');
    const dmaChanged = previousDmaKey !== nextDmaKey;
    const tourChanged = project.tourId !== tourId;
    const scopeChanged = dmaChanged || tourChanged;
    if (scopeChanged) setScopeTransitioning(true);
    setSaving(true);
    try {
      await updateProject(project.engagementProjectId, {
        tourId,
        talentAgencyCompanyId: effectiveTalentAgencyId,
        projectStage: projectStage as ProjectStage,
        createdBy: createdBy.trim() || null,
        agentContactId:
          selectedTalentAgentContactId != null && selectedTalentAgentContactId >= 1
            ? String(selectedTalentAgentContactId)
            : null,
        dmaIds: selectedDmaIds,
      });
      setDirty(false);
      addToast('Project updated.', 'success');
      if (scopeChanged) {
        onGoToVenues();
      }
      await onUpdated();
      if (scopeChanged) {
        addToast('Scope changed. Review venues now.', 'warning');
      }
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update project.'), 'error');
    } finally {
      setScopeTransitioning(false);
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
          <div>
            <span className="text-xs text-text-muted">Attraction</span>
            <div className="text-sm text-text-primary mt-0.5 font-medium">
              {project.attractionName ?? '—'}
            </div>
          </div>
          <InlineSelectField
            label="Tour"
            value={tourSelectValue}
            onChange={onTourChange}
            options={toursForAttraction}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
          <FormField label="Talent Agency">
            {tourTalentAgencyLocked ? (
              <div className="w-full min-w-0 bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary">
                {effectiveTalentAgencyLabel}
              </div>
            ) : (
              <Select2
                value={effectiveTalentAgencyId != null ? String(effectiveTalentAgencyId) : ''}
                onChange={(v) => {
                  setTalentAgencyCompanyId(v ? Number(v) : null);
                  setSelectedTalentAgentContactId(null);
                  setDirty(true);
                }}
                options={talentAgencyOptions}
                placeholder={talentAgencyPickerQuery.isPending ? 'Loading agencies…' : 'Select talent agency…'}
                disabled={talentAgencyPickerQuery.isPending}
              />
            )}
          </FormField>
          <FormField label="Talent Agent" required>
            <Select2
              value={selectedTalentAgentContactId != null ? String(selectedTalentAgentContactId) : ''}
              onChange={(v) => {
                setSelectedTalentAgentContactId(v ? Number(v) : null);
                setDirty(true);
              }}
              options={talentAgentOptions}
              placeholder={
                effectiveTalentAgencyId == null
                  ? 'Choose talent agency first'
                  : talentAgentContactsQuery.isPending
                    ? 'Loading contacts…'
                    : talentAgentOptions.length > 0
                      ? 'Select talent agent…'
                      : 'No contacts found for this agency'
              }
              disabled={effectiveTalentAgencyId == null || talentAgentContactsQuery.isPending}
            />
          </FormField>
          <div className="sm:col-span-2 min-w-0">
            <span className="text-xs text-text-muted">Markets (DMA)</span>
            <div className="mt-1.5 rounded-lg border border-border bg-surface px-3 py-3">
              {selectedDmaIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDmaIds.map((id) => {
                    const row = dmaMarkets.find((m) => m.dmaid === id);
                    const label = row ? formatDmaPickerLabel(row) : `DMA #${id}`;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center rounded-full border border-ems-accent/40 bg-ems-accent/10 px-2.5 py-1 text-xs text-text-primary"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No markets selected.</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-text-muted tabular-nums">
                  {selectedDmaIds.length} market{selectedDmaIds.length === 1 ? '' : 's'} selected
                </p>
                <button
                  type="button"
                  onClick={openDmaModal}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-ems-accent/50"
                >
                  <Pencil className="h-3 w-3" />
                  Edit markets
                </button>
              </div>
            </div>
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

      {showDmaModal && (
        <Modal
          title="Edit Markets (DMA)"
          width={680}
          onClose={() => !saving && setShowDmaModal(false)}
        >
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Select one or more markets. When markets change, review venues in the Venues tab.
            </p>
            <SearchInput
              value={dmaModalSearch}
              onChange={setDmaModalSearch}
              placeholder="Search markets by name…"
              disabled={saving}
            />
            <div className="max-h-[min(22rem,50vh)] overflow-y-auto rounded-md border border-border bg-surface p-2">
              {filteredDmaMarkets.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">
                  {dmaMarkets.length === 0
                    ? 'No markets were returned from the server.'
                    : 'No markets match your filter.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredDmaMarkets.map((row) => {
                    const checked = dmaDraftIds.includes(row.dmaid);
                    return (
                      <label
                        key={row.dmaid}
                        className={[
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors',
                          checked
                            ? 'border-ems-accent bg-ems-accent/10 text-ems-accent'
                            : 'border-border text-text-secondary hover:border-ems-accent/50 hover:text-text-primary',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleDmaDraft(row.dmaid)}
                        />
                        <span
                          className={[
                            'inline-flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors',
                            checked ? 'border-ems-accent bg-ems-accent text-background' : 'border-border bg-background',
                          ].join(' ')}
                          aria-hidden
                        >
                          {checked ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <span className="whitespace-nowrap">{formatDmaPickerLabel(row)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-text-muted tabular-nums">
                {dmaDraftIds.length} market{dmaDraftIds.length === 1 ? '' : 's'} selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDmaModal(false)}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDmaDraft}
                  className="inline-flex items-center justify-center rounded-md bg-ems-accent px-3.5 py-1.5 text-xs font-medium text-background hover:bg-ems-accent/85 disabled:opacity-50"
                  disabled={saving}
                >
                  Apply Markets
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {scopeTransitioning && (
        <div className="absolute inset-0 z-20 rounded-md bg-card/80 backdrop-blur-[1px] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary">
            <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />
            Applying scope changes…
          </div>
        </div>
      )}

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
  'Under Construction': 'Under Construction',
  Pending: 'Pending',
  Inactive: 'Inactive',
  /** Legacy project rows predating CHECK update */
  Confirmed: 'Confirmed',
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
  tourMgmt: 'Talent Agency',
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
          {p.talentAgencyCompanyName ?? '—'}
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
              {['Attraction', 'Tour', 'Talent Agency', 'Stage', 'Created By', 'Created'].map((h, i) => (
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
  venue, projectId, onRefresh, addToast, scopeMismatchReason,
}: {
  venue: ApiProjectVenue; projectId: number;
  onRefresh: () => void; addToast: Props['addToast'];
  scopeMismatchReason?: string;
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
            {scopeMismatchReason && (
              <div className="mt-1 text-[11px] text-amber-500">
                Out of current filters: {scopeMismatchReason}
              </div>
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
  projectId, existingIds, availableVenueRows, onSaved, onCancel, addToast,
}: {
  projectId: number; existingIds: Set<number>;
  availableVenueRows: ApiAllVenueRow[];
  onSaved: () => void; onCancel: () => void; addToast: Props['addToast'];
}) {
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
    return availableVenueRows
      .filter((v) => !existingIds.has(v.companyId))
      .sort((a, b) => (a.venueName ?? '').localeCompare(b.venueName ?? '', undefined, { sensitivity: 'base' }))
      .map((v) => {
        const complex = (v.entertainmentComplexNames ?? '').trim();
        const market = (v.dmaMarketName ?? '').trim();
        const details = [
          market ? `DMA: ${market}` : null,
          complex ? `Complex: ${complex}` : null,
          Number.isFinite(v.seatingCapacity) ? `Capacity: ${v.seatingCapacity.toLocaleString()}` : null,
        ].filter(Boolean).join(' · ');
        return {
          value: String(v.companyId),
          label: details ? `${v.venueName} (${details})` : v.venueName,
        };
      });
  }, [availableVenueRows, existingIds]);

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
            placeholder={venueOptions.length ? 'Select venue…' : 'No eligible venues in current filters'}
            disabled={venueOptions.length === 0}
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

  const toursQuery = useQuery({
    queryKey: ['tours', 'picker', 0, PROJECT_LOOKUP_LIMIT],
    queryFn: async () => (await fetchTours(0, PROJECT_LOOKUP_LIMIT)).data,
    staleTime: 60_000,
  });
  const dmaMarketsQuery = useQuery({
    queryKey: ['dma-markets', 'project-overview', 'all'],
    queryFn: () => fetchDmaMarketsPaged(0, PROJECT_LOOKUP_LIMIT),
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['projects', projectId] });
  }, [qc, projectId]);

  const project = detailQuery.data;
  const venues = project?.venues ?? [];
  const existingVenueIds = useMemo(() => new Set(venues.map((v) => v.venueCompanyId)), [venues]);
  const selectedTourForProject = useMemo(
    () => (project ? (toursQuery.data ?? []).find((t) => t.tourId === project.tourId) : undefined),
    [project, toursQuery.data],
  );
  const preferredVenueTypeId = selectedTourForProject?.venueTypePreferenceId ?? null;
  const preferredVenueTypeName = selectedTourForProject?.venueTypePreferenceName ?? null;
  const projectDmaIds = project?.dmaIds ?? [];
  const projectDmaKey = useMemo(
    () => [...projectDmaIds].sort((a, b) => a - b).join(','),
    [projectDmaIds],
  );
  const scopedVenuesQuery = useQuery({
    queryKey: ['project-detail', projectId, 'eligible-venues', projectDmaKey],
    queryFn: async () =>
      (
        await fetchAllVenues(0, PROJECT_LOOKUP_LIMIT, {
          dmaIds: projectDmaIds,
          sortDir: 'asc',
        })
      ).data,
    enabled: Boolean(project) && (activeTab === 'Venues' || showAddVenue) && projectDmaIds.length > 0,
    staleTime: 30_000,
  });
  const eligibleVenueRows = useMemo(() => {
    const all = scopedVenuesQuery.data ?? [];
    if (preferredVenueTypeId == null || preferredVenueTypeId < 1) return all;
    return all.filter((v) => v.venueTypeId != null && v.venueTypeId === preferredVenueTypeId);
  }, [scopedVenuesQuery.data, preferredVenueTypeId]);
  const eligibleVenueIdSet = useMemo(
    () => new Set(eligibleVenueRows.map((v) => v.companyId)),
    [eligibleVenueRows],
  );
  const outOfScopeVenueCount = useMemo(
    () =>
      venues.filter(
        (v) => !scopedVenuesQuery.isPending && !eligibleVenueIdSet.has(v.venueCompanyId),
      ).length,
    [venues, scopedVenuesQuery.isPending, eligibleVenueIdSet],
  );

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
                {project?.talentAgencyCompanyName && (
                  <span className="text-xs text-text-secondary">{project.talentAgencyCompanyName}</span>
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

        {!detailQuery.isLoading && project && activeTab === 'Overview' && (toursQuery.isPending || dmaMarketsQuery.isPending) && (
          <div className="flex items-center gap-2 text-sm text-text-muted py-8" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />
            Loading fields…
          </div>
        )}

        {!detailQuery.isLoading && project && activeTab === 'Overview' && !toursQuery.isPending && !dmaMarketsQuery.isPending && (
          <ProjectInlineOverview
            project={project}
            tours={toursQuery.data ?? []}
            dmaMarkets={dmaMarketsQuery.data?.data ?? []}
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
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-[11px] text-text-muted leading-relaxed">
                Scope for this project: {projectDmaIds.length} market{projectDmaIds.length === 1 ? '' : 's'} selected
                {preferredVenueTypeId != null && preferredVenueTypeId >= 1
                  ? ` · Preferred type: ${preferredVenueTypeName ?? `Type #${preferredVenueTypeId}`}`
                  : ' · Preferred type: not set'}.
              </p>
              {scopedVenuesQuery.isPending ? (
                <p className="text-[11px] text-text-muted mt-1">Loading eligible venues…</p>
              ) : (
                <p className="text-[11px] text-text-muted mt-1">
                  Eligible venues for Add Venue: {eligibleVenueRows.length.toLocaleString()}.
                </p>
              )}
            </div>
            {!scopedVenuesQuery.isPending && outOfScopeVenueCount > 0 && (
              <p className="text-xs text-amber-500">
                {outOfScopeVenueCount} venue{outOfScopeVenueCount === 1 ? '' : 's'} out of scope — update/remove to avoid discard.
              </p>
            )}
            {showAddVenue && (
              <AddVenueForm
                projectId={projectId}
                existingIds={existingVenueIds}
                availableVenueRows={eligibleVenueRows}
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
                scopeMismatchReason={
                  scopedVenuesQuery.isPending
                    ? undefined
                    : eligibleVenueIdSet.has(v.venueCompanyId)
                      ? undefined
                      : 'not in current DMA/preferred-type scope'
                }
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
  { num: 3, label: 'Date Range' },
  { num: 4, label: 'Preferred Type' },
  { num: 5, label: 'Talent' },
  { num: 6, label: 'Markets' },
  { num: 7, label: 'Venues' },
  { num: 8, label: 'Summary' },
] as const;

const WIZARD_LAST = WIZARD_STEPS.length;

function WizardStepIndicator({ currentStep }: { currentStep: number }) {
  const safeStep = Math.min(Math.max(currentStep, 1), WIZARD_LAST);
  const currentMeta = WIZARD_STEPS[safeStep - 1];
  const progressPct = (safeStep / WIZARD_LAST) * 100;

  return (
    <div
      className="mb-6 rounded-xl border border-border/80 bg-surface/60 px-4 py-3.5 sm:px-5"
      role="navigation"
      aria-label={`Create project wizard, step ${safeStep} of ${WIZARD_LAST}: ${currentMeta?.label ?? ''}`}
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/90">
        <div
          className="h-full rounded-full bg-ems-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Step {safeStep} of {WIZARD_LAST}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold text-text-primary sm:text-lg">
            {currentMeta?.label ?? '—'}
          </p>
        </div>
        <ol className="flex shrink-0 list-none flex-nowrap items-center justify-center gap-2 overflow-x-auto pb-0.5 sm:justify-end sm:pb-0">
          {WIZARD_STEPS.map((s) => {
            const done = safeStep > s.num;
            const active = safeStep === s.num;
            return (
              <li key={s.num} className="flex shrink-0 flex-col items-center gap-1" title={s.label}>
                <span
                  className={[
                    'block rounded-full transition-all duration-200',
                    active
                      ? 'h-3 w-3 bg-ems-accent shadow-[0_0_0_3px_hsl(var(--ems-accent)/0.22)]'
                      : done
                        ? 'h-2.5 w-2.5 bg-ems-accent'
                        : 'h-2.5 w-2.5 border border-border bg-elevated',
                  ].join(' ')}
                />
                <span
                  className={[
                    'hidden text-[9px] font-medium uppercase tracking-tight sm:block',
                    active ? 'text-ems-accent' : done ? 'text-text-secondary' : 'text-text-muted',
                  ].join(' ')}
                >
                  {s.num}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
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
    /** Fresh talent-agency fields when opening the wizard (picker cache can predate DB/API changes). */
    refetchOnMount: 'always',
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: 60_000 });
  const talentAgencyPickerQuery = useQuery({
    queryKey: talentAgencyCompaniesQueryKey(),
    queryFn: fetchTalentAgencyCompanyRows,
    staleTime: 60_000,
  });
  const venueTypesQuery = useQuery({
    queryKey: ['lookups', 'venue-types'],
    queryFn: fetchVenueTypesLookup,
    staleTime: 60_000,
  });
  const [step, setStep] = useState(1);
  const dmaMarketsQuery = useQuery({
    queryKey: ['dma-markets', 'project-wizard', 'all'],
    queryFn: () => fetchDmaMarketsPaged(0, projectWizardLookupLimit),
    staleTime: 60_000,
    enabled: step >= 6,
  });

  const [attractionSearch, setAttractionSearch] = useState('');
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [tourSearch, setTourSearch] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [selectedPreferredVenueTypeIds, setSelectedPreferredVenueTypeIds] = useState<number[]>([]);

  const [selectedDmaIds, setSelectedDmaIds] = useState<number[]>([]);
  /** Stable key when market selection changes — clears venue / performance draft state. */
  const selectedDmaIdsKey = useMemo(
    () => [...selectedDmaIds].sort((a, b) => a - b).join(','),
    [selectedDmaIds],
  );
  /** Wizard step 3 — talent agency; persisted on dbo.Tour.TalentAgencyCompanyID when the project is created. */
  const [projectTourMgmtCompanyId, setProjectTourMgmtCompanyId] = useState<number | null>(null);
  const [selectedTalentAgentContactId, setSelectedTalentAgentContactId] = useState<number | null>(null);
  /** Labels for any DMA row we have shown or toggled (survives search/scroll changes). */
  const [dmaSeenLabels, setDmaSeenLabels] = useState(() => new Map<number, string>());

  const [venueSearch, setVenueSearch] = useState('');
  const [selectedVenueCompanyIds, setSelectedVenueCompanyIds] = useState<number[]>([]);
  const [venueSeenLabels, setVenueSeenLabels] = useState(() => new Map<number, string>());
  /** dbo.EngagementProjectVenue.VenueStatus — one value applied to every venue on create (user picks from meta). */
  const [wizardVenueStatus, setWizardVenueStatus] = useState('');

  const venueStatusMetaQuery = useQuery({
    queryKey: ['projects', 'meta', 'venue-statuses'],
    queryFn: fetchVenueStatusMeta,
    staleTime: 60_000,
    enabled: step >= 7,
  });
  const venuesWizardQuery = useQuery({
    queryKey: ['venue-directory', 'project-wizard-venues', selectedDmaIdsKey],
    queryFn: async () =>
      (
        await fetchAllVenues(0, projectWizardLookupLimit, {
          dmaIds: selectedDmaIds,
          sortDir: 'asc',
        })
      ).data,
    enabled: selectedDmaIds.length > 0 && step >= 7 && step <= 8,
    staleTime: 60_000,
  });

  const [projectStage, setProjectStage] = useState<ProjectStage>('Pending');
  const [createdBy, setCreatedBy] = useState('');

  const [showAddTourModal, setShowAddTourModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const talentAgentContactsQuery = useQuery({
    queryKey: ['company', projectTourMgmtCompanyId ?? 0, 'contacts'],
    queryFn: () => fetchCompanyContacts(projectTourMgmtCompanyId as number),
    enabled: projectTourMgmtCompanyId != null && projectTourMgmtCompanyId >= 1 && step >= 5,
    staleTime: 60_000,
  });

  const attractions = attractionsQuery.data ?? [];
  const tours = toursQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const managementCompanyOptions = useMemo(() => {
    const rows = talentAgencyPickerQuery.data ?? [];
    return rows
      .map((c) => ({ value: String(c.companyId), label: c.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [talentAgencyPickerQuery.data]);
  const venueTypes: ApiVenueType[] = venueTypesQuery.data ?? [];
  const dmaFlatRows: ApiDmaMarket[] = dmaMarketsQuery.data?.data ?? [];
  const talentAgentOptions = useMemo(
    () =>
      (talentAgentContactsQuery.data ?? []).map((row: ApiCompanyContact) => ({
        value: String(row.contactAssignmentId),
        label: `${row.firstName} ${row.lastName}`.trim(),
      })),
    [talentAgentContactsQuery.data],
  );

  const venueStatusSelectOptions = useMemo(() => {
    const fromApi = venueStatusMetaQuery.data?.venueStatuses ?? [];
    const list =
      fromApi.length > 0 ? fromApi : (VENUE_STATUS_VALUES as readonly string[]).slice();
    return list.map((v) => ({ value: v, label: v }));
  }, [venueStatusMetaQuery.data]);

  const venueRowsAll = venuesWizardQuery.data ?? [];
  const venueRowsFiltered = useMemo(() => {
    const q = venueSearch.trim().toLowerCase();
    return venueRowsAll.filter((r) => {
      const blob = [
        r.venueName,
        r.entertainmentComplexNames,
        r.dmaMarketName,
        String(r.companyId),
        r.venueTypeName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (q && !blob.includes(q)) return false;
      if (selectedPreferredVenueTypeIds.length === 0) return true;
      return (
        r.venueTypeId != null &&
        selectedPreferredVenueTypeIds.includes(r.venueTypeId)
      );
    });
  }, [venueRowsAll, venueSearch, selectedPreferredVenueTypeIds]);

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

  const recordVenueLabels = useCallback((rows: ApiAllVenueRow[]) => {
    if (rows.length === 0) return;
    setVenueSeenLabels((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const r of rows) {
        const label = formatVenueWizardLabel(r);
        if (next.get(r.companyId) !== label) {
          next.set(r.companyId, label);
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
    recordVenueLabels(venueRowsAll);
  }, [venueRowsAll, recordVenueLabels]);

  useEffect(() => {
    setSelectedVenueCompanyIds([]);
    setVenueSeenLabels(new Map());
    setVenueSearch('');
  }, [selectedDmaIdsKey]);

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

  useEffect(() => {
    if (selectedTourId == null) {
      setProjectTourMgmtCompanyId(null);
      setSelectedPreferredVenueTypeIds([]);
      return;
    }
    const t = tours.find((x) => x.tourId === selectedTourId);
    if (t == null) {
      /** Picker list may not include the row yet (e.g. right after “Create Tour”) — do not clear `projectTourMgmtCompanyId`; onSuccess already set it from the API response. */
      return;
    }
    setProjectTourMgmtCompanyId(t.talentAgencyCompanyId ?? null);
    if (t.venueTypePreferenceId != null && t.venueTypePreferenceId >= 1) {
      setSelectedPreferredVenueTypeIds([t.venueTypePreferenceId]);
    } else {
      setSelectedPreferredVenueTypeIds([]);
    }
  }, [selectedTourId, tours]);

  useEffect(() => {
    setSelectedTalentAgentContactId(null);
  }, [projectTourMgmtCompanyId]);

  /** One section per selected market (even if no venues pass type/search filters). */
  const venuesGroupedBySelectedDma = useMemo(() => {
    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    return selectedDmaIds.map((dmaid) => {
      const meta = dmaFlatRows.find((d) => d.dmaid === dmaid);
      const label = meta
        ? formatDmaPickerLabel(meta)
        : dmaSeenLabels.get(dmaid) ?? `Market #${dmaid}`;
      const selMk = norm(meta?.marketName);
      const rows = venueRowsFiltered.filter((v) => {
        if (v.dmaId != null && v.dmaId === dmaid) return true;
        if (selMk.length > 0 && norm(v.dmaMarketName) === selMk) return true;
        return false;
      });
      return { dmaid, label, rows };
    });
  }, [selectedDmaIds, dmaFlatRows, venueRowsFiltered, dmaSeenLabels]);

  const inputCls =
    'w-full min-w-0 cursor-text bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const lookupsLoading =
    attractionsQuery.isPending ||
    toursQuery.isPending ||
    classesQuery.isPending ||
    talentAgencyPickerQuery.isPending ||
    venueTypesQuery.isPending;

  const selectedTour = selectedTourId ? tours.find((t) => t.tourId === selectedTourId) : null;
  const selectedAttraction =
    selectedAttractionId != null
      ? attractions.find((a) => a.attractionId === selectedAttractionId)
      : null;

  const tourTalentAgencyLocked = Boolean(
    selectedTour != null &&
      selectedTour.talentAgencyCompanyId != null &&
      selectedTour.talentAgencyCompanyId >= 1,
  );

  const tourMgmtStepOptions = useMemo(() => {
    if (tourTalentAgencyLocked && selectedTour) {
      const id = String(selectedTour.talentAgencyCompanyId);
      const label =
        selectedTour.talentAgencyCompanyName?.trim() ||
        managementCompanyOptions.find((o) => o.value === id)?.label ||
        `Company #${id}`;
      return [{ value: id, label }];
    }
    return managementCompanyOptions;
  }, [tourTalentAgencyLocked, selectedTour, managementCompanyOptions]);

  const tourMgmtSelectDisabled =
    tourTalentAgencyLocked ||
    (!tourTalentAgencyLocked && managementCompanyOptions.length === 0);

  const canProceedStep1 = selectedAttractionId != null;
  const canProceedStep2 = selectedTourId != null;
  const canProceedDateRange =
    dateRangeStart.trim().length > 0 &&
    dateRangeEnd.trim().length > 0 &&
    dateRangeStart <= dateRangeEnd;
  const canProceedPreferredVenueType = selectedPreferredVenueTypeIds.length > 0;
  const canProceedTourMgmt =
    projectTourMgmtCompanyId != null && projectTourMgmtCompanyId >= 1;
  const canProceedTalentAgent =
    selectedTalentAgentContactId != null && selectedTalentAgentContactId >= 1;
  const canProceedMarkets = selectedDmaIds.length > 0;
  const canProceedVenues = selectedVenueCompanyIds.length > 0;
  const canProceedVenueStatusStep = wizardVenueStatus.trim().length > 0;
  /** Final step: tour, tour mgmt, markets, venues, venue status, and project stage. */
  const canCreateProject =
    selectedTourId != null &&
    canProceedDateRange &&
    canProceedPreferredVenueType &&
    canProceedTourMgmt &&
    canProceedTalentAgent &&
    canProceedMarkets &&
    canProceedVenues &&
    canProceedVenueStatusStep &&
    Boolean(projectStage);

  const handleBack = () => setStep((s) => Math.max(1, s - 1));
  const handleNext = () => {
    if (step === 3 && !canProceedDateRange) {
      addToast('Choose a valid start and end date range.', 'warning');
      return;
    }
    if (step === 4 && !canProceedPreferredVenueType) {
      addToast('Select at least one preferred venue type.', 'warning');
      return;
    }
    if (step === 5 && !canProceedTourMgmt) {
      addToast('Select a Talent Agency for this project.', 'warning');
      return;
    }
    if (step === 5 && !canProceedTalentAgent) {
      addToast('Select a Talent Agent for this project.', 'warning');
      return;
    }
    if (step === 6 && !canProceedMarkets) {
      addToast('Select at least one market (DMA). Your choices are saved on the project.', 'warning');
      return;
    }
    if (step === 7 && !canProceedVenues) {
      addToast('Select at least one venue in the selected markets.', 'warning');
      return;
    }
    if (step === 7 && !canProceedVenueStatusStep) {
      addToast('Select a venue proposal status for all selected venues.', 'warning');
      return;
    }
    setStep((s) => Math.min(WIZARD_LAST, s + 1));
  };

  const createTourMut = useMutation({
    mutationFn: ({
      body,
      bannerFile,
    }: {
      body: import('@/api/attractionToursApi').CreateTourPayload;
      bannerFile?: File | null;
    }) => createTour(body, bannerFile ? { bannerFile } : undefined),
    onSuccess: async (res) => {
      const pickerKey = ['tours', 'picker', 0, projectWizardLookupLimit] as const;
      qc.setQueryData<ApiTourListRow[]>(pickerKey, (old) => {
        const list = old ?? [];
        const idx = list.findIndex((x) => x.tourId === res.tourId);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = res;
          return next;
        }
        return [...list, res].sort((a, b) =>
          (a.tourName ?? '').localeCompare(b.tourName ?? '', undefined, { sensitivity: 'base' }),
        );
      });
      setSelectedTourId(res.tourId);
      setProjectTourMgmtCompanyId(res.talentAgencyCompanyId ?? null);
      setShowAddTourModal(false);
      addToast('Tour created.', 'success');
      /**
       * Do not invalidate `['tours','picker',…]` here: that refetch replaces this query’s cache and
       * can drop `talentAgencyCompanyId` on rows (until reload), which clears step 3 via the sync effect.
       */
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tours' &&
          q.queryKey[1] !== 'picker',
      });
    },
    onError: (e: unknown) => addToast(friendlyApiError(e, 'Could not create tour.'), 'error'),
  });

  const handleSubmit = async () => {
    if (!selectedTourId) return;
    if (projectTourMgmtCompanyId == null || projectTourMgmtCompanyId < 1) {
      addToast('Select a Talent Agency on the Talent step.', 'error');
      return;
    }
    if (selectedTalentAgentContactId == null || selectedTalentAgentContactId < 1) {
      addToast('Select a Talent Agent on the Talent step.', 'error');
      return;
    }
    if (selectedDmaIds.length === 0) {
      addToast('Select at least one market (DMA) on the Markets step.', 'error');
      return;
    }
    if (!canProceedVenues) {
      addToast('Complete the Venues step before creating the project.', 'error');
      return;
    }
    const stage = projectStage;
    if (!stage) {
      addToast('Select a project stage before creating the project.', 'error');
      return;
    }
    if (!wizardVenueStatus.trim()) {
      addToast('Select a venue proposal status on the Venues step.', 'error');
      return;
    }
    const venuesPayload = selectedVenueCompanyIds.map((venueCompanyId) => {
      return {
        venueCompanyId,
        venueStatus: wizardVenueStatus.trim() as VenueStatus,
      };
    });
    setSaving(true);
    try {
      const res = await createProject({
        tourId: selectedTourId,
        talentAgencyCompanyId: projectTourMgmtCompanyId,
        projectStage: stage,
        createdBy: createdBy.trim() ? createdBy.trim() : undefined,
        agentContactId:
          selectedTalentAgentContactId != null
            ? String(selectedTalentAgentContactId)
            : undefined,
        dmaIds: selectedDmaIds,
        venues: venuesPayload,
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

  const setVenueSelected = (r: ApiAllVenueRow, checked: boolean) => {
    recordVenueLabels([r]);
    if (checked) {
      setSelectedVenueCompanyIds((prev) =>
        prev.includes(r.companyId) ? prev : [...prev, r.companyId],
      );
    } else {
      setSelectedVenueCompanyIds((prev) => prev.filter((id) => id !== r.companyId));
    }
  };

  const removeWizardVenueChip = (companyId: number) => {
    setSelectedVenueCompanyIds((prev) => prev.filter((id) => id !== companyId));
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

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Date Range</h3>
          <p className="text-xs text-text-muted">
            Select the project date range before moving to preferred venue types.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <input
                type="date"
                className={inputCls}
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
              />
            </FormField>
            <FormField label="End Date" required>
              <input
                type="date"
                className={inputCls}
                value={dateRangeEnd}
                min={dateRangeStart || undefined}
                onChange={(e) => setDateRangeEnd(e.target.value)}
              />
            </FormField>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Preferred Venue Type</h3>
          <p className="text-xs text-text-muted">
            Choose all preferred venue types linked to this Tour.
          </p>
          <div className="max-h-[min(22rem,45vh)] overflow-y-auto rounded-md border border-border bg-surface divide-y divide-border/60">
            {venueTypes.length === 0 && (
              <p className="text-sm text-text-muted px-3 py-6 text-center">No venue types returned from lookups.</p>
            )}
            {venueTypes.map((row) => {
              const checked = selectedPreferredVenueTypeIds.includes(row.venueTypeId);
              return (
                <label
                  key={row.venueTypeId}
                  className="flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-hover/80 text-text-primary"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border text-ems-accent focus:ring-ems-accent"
                    checked={checked}
                    onChange={() => {
                      setSelectedPreferredVenueTypeIds((prev) =>
                        prev.includes(row.venueTypeId)
                          ? prev.filter((id) => id !== row.venueTypeId)
                          : [...prev, row.venueTypeId],
                      );
                    }}
                  />
                  <span className="min-w-0 break-words">{row.venueTypeName}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Talent Agency & Talent Agent</h3>
          <p className="text-xs text-text-muted">
            {tourTalentAgencyLocked
              ? 'This tour already has a talent agency on file. It is shown below and cannot be changed from this wizard.'
              : 'Select the talent agency for this tour. It is saved on the tour when you create the project.'}
          </p>
          <FormField label="Talent Agency">
            <Select2
              options={tourMgmtStepOptions}
              value={projectTourMgmtCompanyId != null ? String(projectTourMgmtCompanyId) : ''}
              onChange={(v) => setProjectTourMgmtCompanyId(v ? Number(v) : null)}
              placeholder={
                tourMgmtStepOptions.length === 0
                  ? 'No talent agencies in directory'
                  : 'Select a company…'
              }
              disabled={tourMgmtSelectDisabled}
            />
          </FormField>
          <FormField label="Talent Agent">
            <Select2
              options={talentAgentOptions}
              value={selectedTalentAgentContactId != null ? String(selectedTalentAgentContactId) : ''}
              onChange={(v) => setSelectedTalentAgentContactId(v ? Number(v) : null)}
              placeholder={
                projectTourMgmtCompanyId == null
                  ? 'Select a Talent Agency first…'
                  : talentAgentContactsQuery.isPending
                    ? 'Loading contacts…'
                    : 'Select a talent agent…'
              }
              disabled={projectTourMgmtCompanyId == null || talentAgentContactsQuery.isPending}
            />
          </FormField>
          {projectTourMgmtCompanyId != null &&
            !talentAgentContactsQuery.isPending &&
            talentAgentOptions.length === 0 && (
              <p className="text-xs text-ems-coral">
                No contacts found for this Talent Agency. Add a contact under Companies before creating this project.
              </p>
            )}
          {!tourTalentAgencyLocked && managementCompanyOptions.length === 0 && (
            <p className="text-xs text-ems-coral">
              No companies with type &quot;Talent Agency&quot; were returned. Add one under Companies, then reopen this wizard.
            </p>
          )}
        </div>
      )}

      {/* Step 4: Select Markets — dbo.DMA */}
      {step === 6 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Select Markets (DMAs)</h3>
          <p className="text-xs text-text-muted">
            Please select all Markets where you plan to Make an offer
          </p>
          {dmaMarketsQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center border border-dashed border-border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-ems-accent shrink-0" />
              Loading DMA markets…
            </div>
          ) : dmaMarketsQuery.isError ? (
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
          ) : (
            <div className="max-h-[min(24rem,50vh)] overflow-y-auto py-1">
              {dmaFlatRows.length === 0 && (
                <p className="text-sm text-text-muted py-6 text-center">No DMA rows returned.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {dmaFlatRows.map((r) => {
                  const checked = selectedDmaIds.includes(r.dmaid);
                  return (
                    <label
                      key={r.dmaid}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors',
                        checked
                          ? 'border-ems-accent bg-ems-accent/10 text-ems-accent'
                          : 'border-border bg-transparent text-text-secondary hover:border-ems-accent/50 hover:text-text-primary',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleDmaRow(r)}
                      />
                      <span
                        className={[
                          'inline-flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors',
                          checked ? 'border-ems-accent bg-ems-accent text-background' : 'border-border bg-background',
                        ].join(' ')}
                        aria-hidden
                      >
                        {checked ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="whitespace-nowrap">{formatDmaPickerLabel(r)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Venues in selected markets */}
      {step === 7 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Venue Choice</h3>
          <p className="text-xs text-text-muted">
            {`Every market you picked is shown as its own section. Venues under a section match the tour's preferred venue type (if set) and your search. Sections can be empty when nothing matches—adjust the tour type or clear the search to see more.`}
          </p>
          <FormField label="Venue proposal status" required>
            <Select2
              options={venueStatusSelectOptions}
              value={wizardVenueStatus}
              onChange={setWizardVenueStatus}
              placeholder={
                venueStatusMetaQuery.isPending ? 'Loading statuses…' : 'Select status for all selected venues…'
              }
              disabled={venueStatusSelectOptions.length === 0}
            />
          </FormField>
          {venuesWizardQuery.isPending && (
            <div className="flex flex-col items-center gap-2 text-sm text-text-muted py-10 justify-center border border-dashed border-border rounded-lg bg-surface/50">
              <Loader2 className="h-8 w-8 animate-spin text-ems-accent shrink-0" aria-hidden />
              <span role="status">Loading venues for {selectedDmaIds.length} selected market{selectedDmaIds.length === 1 ? '' : 's'}…</span>
            </div>
          )}
          {venuesWizardQuery.isError && (
            <div className="rounded-lg border border-ems-coral/40 bg-ems-coral/10 px-3 py-2 text-sm text-text-primary space-y-2">
              <p>Could not load venues: {friendlyApiError(venuesWizardQuery.error)}</p>
              <button
                type="button"
                className="text-sm font-medium text-ems-accent hover:underline"
                onClick={() => void venuesWizardQuery.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {!venuesWizardQuery.isPending && !venuesWizardQuery.isError && (
            <>
              <FormField label="Filter venues">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Search by venue name, complex, DMA name, or company ID…"
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={venuesWizardQuery.isFetching}
                />
              </FormField>
              <div className="relative rounded-md border border-border bg-surface">
                {venuesWizardQuery.isFetching && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-background/75 backdrop-blur-[2px] text-sm text-text-muted"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="h-7 w-7 animate-spin text-ems-accent shrink-0" aria-hidden />
                    Updating venues…
                  </div>
                )}
                <div
                  className={`max-h-[min(24rem,50vh)] overflow-y-auto divide-y divide-border/60 ${venuesWizardQuery.isFetching ? 'pointer-events-none min-h-[10rem]' : ''}`}
                >
                  {venuesGroupedBySelectedDma.length === 0 && (
                    <p className="text-sm text-text-muted px-3 py-6 text-center">Select at least one market on the previous step.</p>
                  )}
                  {venuesGroupedBySelectedDma.map(({ dmaid, label, rows }) => (
                    <div key={dmaid} className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
                      {rows.length === 0 ? (
                        <p className="text-xs text-text-muted px-2 py-2 rounded bg-hover/40 border border-border/60">
                          {venueRowsAll.length === 0
                            ? 'No venues were returned for this market from the directory.'
                            : 'No venues in this market match your preferred venue type or search filter.'}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {rows.map((r) => {
                            const checked = selectedVenueCompanyIds.includes(r.companyId);
                            const complex = (r.entertainmentComplexNames ?? '').trim() || '—';
                            return (
                              <label
                                key={r.companyId}
                                className="flex items-start gap-2.5 px-2 py-1.5 text-sm cursor-pointer hover:bg-hover/80 rounded text-text-primary"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border text-ems-accent focus:ring-ems-accent"
                                  checked={checked}
                                  onChange={(e) => setVenueSelected(r, e.target.checked)}
                                />
                                <span className="min-w-0 break-words">
                                  <span className="font-medium">{r.venueName}</span>
                                  <span className="text-text-muted text-xs block mt-0.5">
                                    Entertainment Complex: {complex} · Capacity: {r.seatingCapacity.toLocaleString()}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {venueRowsAll.length > 0 && (
                <p className="text-[11px] text-text-muted leading-relaxed">
                  <span className="font-medium text-text-secondary">
                    {venueRowsFiltered.length.toLocaleString()} of {venueRowsAll.length.toLocaleString()} venue
                    {venueRowsAll.length === 1 ? '' : 's'}
                  </span>{' '}
                  {selectedPreferredVenueTypeIds.length > 0
                    ? "match the tour's preferred venue type and your search."
                    : 'match your search (no preferred venue type on this tour).'}{' '}
                  {selectedDmaIds.length} market{selectedDmaIds.length === 1 ? '' : 's'} selected — browse by section above.
                </p>
              )}
              {venueRowsAll.length === 0 && selectedDmaIds.length > 0 && (
                <p className="text-[11px] text-text-muted">
                  No venues were returned for the selected markets. Try different markets or check the venue directory.
                </p>
              )}
            </>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">Selected venues</p>
            {selectedVenueCompanyIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedVenueCompanyIds.map((cid) => (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-ems-accent/10 text-text-primary text-xs rounded-md border border-ems-accent/30 max-w-full"
                  >
                    <span className="truncate">{venueSeenLabels.get(cid) ?? `Venue #${cid}`}</span>
                    <button
                      type="button"
                      onClick={() => removeWizardVenueChip(cid)}
                      className="text-text-muted hover:text-ems-coral shrink-0"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">None yet — check at least one venue above.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 8: Project Summary */}
      {step === 8 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Project Summary</h3>
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
            <FormField label="Date Range">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {dateRangeStart && dateRangeEnd ? `${dateRangeStart} to ${dateRangeEnd}` : '—'}
              </div>
            </FormField>
            <FormField label="Preferred Venue Type">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {selectedPreferredVenueTypeIds.length > 0
                  ? selectedPreferredVenueTypeIds
                    .map((id) => venueTypes.find((v) => v.venueTypeId === id)?.venueTypeName ?? `Type #${id}`)
                    .join(', ')
                  : '—'}
              </div>
            </FormField>
            <FormField label="Talent Agency">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {projectTourMgmtCompanyId != null
                  ? (tourMgmtStepOptions.find((o) => o.value === String(projectTourMgmtCompanyId))?.label ??
                    `Company #${projectTourMgmtCompanyId}`)
                  : '—'}
              </div>
            </FormField>
            <FormField label="Talent Agent">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {selectedTalentAgentContactId != null
                  ? (talentAgentOptions.find((o) => o.value === String(selectedTalentAgentContactId))?.label ??
                    `Contact #${selectedTalentAgentContactId}`)
                  : '—'}
              </div>
            </FormField>
            <FormField label="Markets (DMAs)">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {selectedDmaIds.length > 0
                  ? selectedDmaIds
                    .map((id) => dmaSeenLabels.get(id) ?? `DMA #${id}`)
                    .join(', ')
                  : '— Add at least one on the Markets step —'}
              </div>
            </FormField>
            <FormField label="Selected Venues">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {selectedVenueCompanyIds.length > 0
                  ? selectedVenueCompanyIds
                    .map((cid) => venueSeenLabels.get(cid) ?? `Venue #${cid}`)
                    .join(', ')
                  : '— Complete the Venues step —'}
              </div>
            </FormField>
            <FormField label="Venue proposal status">
              <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
                {wizardVenueStatus.trim() || '— Choose on the Venues step —'}
              </div>
            </FormField>
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs text-text-muted">
                Choose{' '}
                <span className="font-medium">Under Construction</span>, <span className="font-medium">Pending</span>, or{' '}
                <span className="font-medium">Inactive</span>, then click Create Project.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Project Stage">
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
                (step === 3 && !canProceedDateRange) ||
                (step === 4 && !canProceedPreferredVenueType) ||
                (step === 5 && (!canProceedTourMgmt || !canProceedTalentAgent)) ||
                (step === 6 && !canProceedMarkets) ||
                (step === 7 && (!canProceedVenues || !canProceedVenueStatusStep || venuesWizardQuery.isPending)) ||
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