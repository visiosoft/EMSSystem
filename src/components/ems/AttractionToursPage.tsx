import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { patchEachInList, removeQueriesByPrefix } from '@/api/cacheHelpers';
import {
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
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
  attractionsListQueryKey,
  toursListQueryKey,
  attractionsServerSearchKeyPrefix,
  toursServerSearchKeyPrefix,
  fetchAttractions,
  fetchClasses,
  fetchTours,
  fetchVenueTypesLookup,
  updateAttraction,
  updateTour,
  type ApiAttractionListRow,
  type ApiClass,
  type ApiTourListRow,
  type ApiVenueType,
} from '@/api/attractionToursApi';
import {
  fetchCompanies,
  COMPANIES_PICKER_LIMIT,
  fetchCompanyContacts,
  type ApiCompanyContact,
  type ApiCompanyListRow,
} from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { clearFormFieldError } from '@/lib/clearFormFieldError';
import {
  getPageParams,
  getTotalPages,
  getPageRange,
  PAGE_SIZE,
  type PageSizeOption,
  isAllPageSize,
} from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';
import { formatE164ForDisplay } from '@/lib/contactPhoneField';
import { type ApiPaginatedResponse } from '@/api/attractionToursApi';
import { TOUR_STATUS_OPTIONS } from './tourFormLegacy';
import { AddTourForm } from './AddTourForm';


/**
 * Talent-agency picklist plus the tour's current management company when that
 * company is not in the list (e.g. different company type), so the UI shows a name not a raw ID.
 */
function buildTourManagementSelectOptions(
  talentAgencyOptions: { value: string; label: string }[],
  allCompanies: { companyId: number; companyName: string }[],
  currentCompanyId: number | null | undefined,
  currentCompanyName: string | null | undefined,
): { value: string; label: string }[] {
  const opts = [...talentAgencyOptions];
  const idStr =
    currentCompanyId != null && Number.isFinite(Number(currentCompanyId))
      ? String(currentCompanyId)
      : '';
  if (idStr && !opts.some((o) => o.value === idStr)) {
    const fromTour = currentCompanyName?.trim();
    const fromList = allCompanies.find((c) => String(c.companyId) === idStr)?.companyName;
    const label = fromTour || fromList || 'Other company';
    opts.push({ value: idStr, label });
  }
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return [{ value: '', label: '—' }, ...opts];
}

/** Matches Companies page loading + table shell styling. */
function AttractionToursTableSkeleton({
  variant,
  rowCount = PAGE_SIZE,
}: {
  variant: 'attractions' | 'tours';
  rowCount?: number;
}) {
  const isAttr = variant === 'attractions';
  const colCount = isAttr ? 2 : 5;
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
                  <th className="text-left py-2.5 px-3">Active Tours</th>
                </>
              ) : (
                <>
                  <th className="text-left py-2.5 px-3">Tour Name</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Class</th>
                  <th className="text-left py-2.5 px-3">Tour Management Company</th>
                  <th className="w-10" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
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

type AttractionsViewMode = 'list' | 'tiles';
const ATTRACTIONS_VIEW_MODE_STORAGE_KEY = 'iae-attractions-view-mode-v1';

/**
 * Tile view only. Large = original 1 / 2 / 3-column grid, full-width cards.
 * Medium/Small = extra columns (5 / 6 on xl) so each tile is ~66% / ~50% of a large tile’s width without empty gutters.
 */
type AttractionsTileSize = 'large' | 'medium' | 'small';
const ATTRACTIONS_TILE_SIZE_STORAGE_KEY = 'iae-attractions-tile-size-v1';

function licenseSummary(t: ApiTourListRow): string {
  const parts: string[] = [];
  if (t.ascap) parts.push('ASCAP');
  if (t.bmi) parts.push('BMI');
  if (t.sesac) parts.push('SESAC');
  if (t.gmr) parts.push('GMR');
  return parts.length ? parts.join(' · ') : '—';
}

function loadAttractionsViewMode(): AttractionsViewMode {
  if (typeof window === 'undefined') return 'tiles';
  try {
    const raw = localStorage.getItem(ATTRACTIONS_VIEW_MODE_STORAGE_KEY);
    return raw === 'list' || raw === 'tiles' ? raw : 'tiles';
  } catch {
    return 'tiles';
  }
}

function saveAttractionsViewMode(mode: AttractionsViewMode) {
  try {
    localStorage.setItem(ATTRACTIONS_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function loadAttractionsTileSize(): AttractionsTileSize {
  if (typeof window === 'undefined') return 'large';
  try {
    const raw = localStorage.getItem(ATTRACTIONS_TILE_SIZE_STORAGE_KEY);
    return raw === 'large' || raw === 'medium' || raw === 'small' ? raw : 'large';
  } catch {
    return 'large';
  }
}

function saveAttractionsTileSize(size: AttractionsTileSize) {
  try {
    localStorage.setItem(ATTRACTIONS_TILE_SIZE_STORAGE_KEY, size);
  } catch {
    /* ignore */
  }
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'AT';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function getThumbnailUrl(entity: Record<string, unknown>): string | null {
  const keys = [
    'thumbnailUrl',
    'attractionThumbnailUrl',
    'tourThumbnailUrl',
    'tourBannerImageUrl',
    'latestTourBannerImageUrl',
    'imageUrl',
    'posterUrl',
  ];
  for (const key of keys) {
    const val = entity[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

/** Read-only tour summary when viewing an attraction (editing is on the Tours tab / tour drawer). */
function TourCardReadOnly({ t }: { t: ApiTourListRow }) {
  return (
    <div className="bg-elevated border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-text-primary font-medium leading-snug">{t.tourName}</div>
          <div className="mt-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wide block mb-1">
              Genre / Class
            </span>
            <div className="text-sm text-text-primary">{t.className || '—'}</div>
          </div>
        </div>
        <span className="text-[10px] text-text-muted shrink-0 text-right max-w-[40%]" title={licenseSummary(t)}>
          {licenseSummary(t)}
        </span>
      </div>
      <div className="text-[11px] text-text-secondary">
        <span className="text-text-muted">Tour Management Company </span>
        {t.talentAgencyCompanyName ?? '—'}
      </div>
    </div>
  );
}

function TourThumbnailTile({ tour }: { tour: ApiTourListRow }) {
  const thumb = getThumbnailUrl(tour as unknown as Record<string, unknown>);
  return (
    <div className="rounded-lg border border-border/80 bg-card p-2.5">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border/70 bg-elevated">
        {thumb ? (
          <img src={thumb} alt={`${tour.tourName} thumbnail`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-text-muted">
            <ImageIcon className="h-4 w-4" aria-hidden />
            <span className="text-[10px] uppercase tracking-wide">No image</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs font-medium text-text-primary truncate" title={tour.tourName}>
        {tour.tourName}
      </p>
      <p className="text-[11px] text-text-muted truncate">{tour.className || '—'}</p>
    </div>
  );
}

// ─── Shared inline-edit primitive ────────────────────────────────────────────

function FieldLabelWithReq({
  label, required,
}: { label: string; required?: boolean }) {
  return (
    <label className="text-xs text-text-muted block mb-0.5">
      {label}
      {required && <span className="text-ems-coral ml-0.5">*</span>}
    </label>
  );
}

function InlineField({
  label, value, onChange, placeholder = '—', multiline = false, required, maxLength, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  error?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const commit = () => { if (draft !== value) onChange(draft); setEditing(false); };

  if (editing) {
    return (
      <div>
        <FieldLabelWithReq label={label} required={required} />
        <div className="flex items-start gap-1.5">
          {multiline ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={3}
              value={draft}
              maxLength={maxLength}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setEditing(false)}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none resize-none"
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              value={draft}
              maxLength={maxLength}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
            />
          )}
          <div className="flex gap-0.5 mt-0.5 shrink-0">
            <button onClick={commit} className="p-1 text-ems-accent hover:bg-elevated rounded"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-text-muted hover:bg-elevated rounded"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {error && <p className="text-xs text-ems-coral mt-1">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      <FieldLabelWithReq label={label} required={required} />
      <div
        onClick={start}
        title="Click to edit"
        className="group flex items-start gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
      >
        <span className={`text-sm flex-1 ${value ? 'text-text-primary' : 'text-text-muted italic'}`}>
          {value || placeholder}
        </span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-0.5" />
      </div>
      {error && <p className="text-xs text-ems-coral mt-0.5">{error}</p>}
    </div>
  );
}

function InlineSelectField({
  label,
  value,
  onChange,
  options,
  allowClear = false,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowClear?: boolean;
  required?: boolean;
  error?: string;
}) {
  const [editing, setEditing] = useState(false);
  const display =
    options.find((o) => o.value === value)?.label ??
    (value ? value : '—');

  if (editing) {
    return (
      <div>
        <FieldLabelWithReq label={label} required={required} />
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <Select2
              options={options}
              value={value}
              onChange={(v) => {
                onChange(v);
                setEditing(false);
              }}
              allowClear={allowClear}
              placeholder="Select…"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="p-1 text-text-muted hover:bg-elevated rounded shrink-0"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="text-xs text-ems-coral mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <FieldLabelWithReq label={label} required={required} />
      <div
        onClick={() => setEditing(true)}
        className="group flex items-center gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
        title="Click to edit"
      >
        <span className="text-sm text-text-primary flex-1">{display}</span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      </div>
      {error && <p className="text-xs text-ems-coral mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Attraction side panel (list + detail) ─────────────────────────────────

function AttractionSidePanel({
  attraction,
  tours,
  addToast,
  onClose,
  onDelete,
  onSaved,
}: {
  attraction: ApiAttractionListRow;
  tours: ApiTourListRow[];
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onClose: () => void;
  onDelete: (a: ApiAttractionListRow) => void;
  /** Receives the fresh list row returned by PATCH /attractions/:id so the parent can patch its cache. */
  onSaved: (row: ApiAttractionListRow) => void;
}) {
  const [name, setName] = useState(attraction.attractionName);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    setName(attraction.attractionName);
    setDirty(false);
    setNameError(undefined);
  }, [attraction.attractionId, attraction.attractionName]);

  const handleSave = async () => {
    const t = name.trim();
    if (!t) {
      setNameError('Attraction name is required.');
      return;
    }
    if (t.length > 200) {
      setNameError('Attraction name must be 200 characters or fewer.');
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      const updated = await updateAttraction(attraction.attractionId, {
        attractionName: name.trim(),
      });
      setDirty(false);
      addToast('Attraction updated.', 'success');
      onSaved(updated);
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer onClose={onClose} width={1000}>
      <div className="p-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{name}</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {attraction.activeTourCount} tour{attraction.activeTourCount !== 1 ? 's' : ''}
            {attraction.appCreated && (
              <span className="ml-2 text-ems-accent">· Created in this app</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDelete(attraction)}
            title="Delete attraction"
            className="p-1.5 text-text-muted hover:text-ems-coral hover:bg-ems-coral-dim rounded-md transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-secondary rounded-md transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <p className="flex items-start gap-1.5 text-[11px] text-text-muted select-none leading-relaxed">
          <Pencil className="h-3 w-3 shrink-0 mt-0.5" />
          Click the attraction name to edit it.
        </p>

        <InlineField
          label="Attraction Name"
          value={name}
          onChange={(v) => {
            setName(v);
            setDirty(true);
            setNameError(undefined);
          }}
          required
          maxLength={200}
          error={nameError}
        />

        <div>
          <h3 className="text-sm font-medium text-text-primary mb-1">Tours</h3>
          <p className="text-[11px] text-text-muted mb-3">Reference only — not editable in this panel.</p>
          <div className="space-y-3">
            {tours.length === 0 && (
              <div className="text-text-muted text-sm">No tours attached yet.</div>
            )}
            {tours.map((t) => (
              <TourCardReadOnly key={t.tourId} t={t} />
            ))}
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
                onClick={() => {
                  setName(attraction.attractionName);
                  setDirty(false);
                  setNameError(undefined);
                }}
                disabled={saving}
                className="text-text-secondary text-xs px-3 py-1.5 hover:text-text-primary rounded-md hover:bg-elevated transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-ems-accent hover:bg-ems-accent/80 text-background text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function TourDrawer({
  tour,
  attractions,
  classes,
  venueTypes,
  companies,
  managementCompanyOptions,
  addToast,
  onClose,
  onDelete,
  onSaved,
  activeTab,
  onTabChange,
}: {
  tour: ApiTourListRow;
  attractions: ApiAttractionListRow[];
  classes: ApiClass[];
  venueTypes: ApiVenueType[];
  companies: ApiCompanyListRow[];
  managementCompanyOptions: { value: string; label: string }[];
  addToast: (msg: string, type: 'success'|'error'|'warning'|'info') => void;
  onClose: () => void;
  onDelete: (t: ApiTourListRow) => void;
  /** Receives the fresh list row returned by PATCH /tours/:id plus the previous attraction id (for activeTourCount bookkeeping). */
  onSaved: (row: ApiTourListRow, prevAttractionId: number) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const contactsQuery = useQuery({
    queryKey: ['tour-management-company-contacts', tour.talentAgencyCompanyId],
    queryFn: () => fetchCompanyContacts(tour.talentAgencyCompanyId!),
    enabled: !!tour.talentAgencyCompanyId,
  });

  // Editable state
  const [tourName, setTourName] = useState(tour.tourName);
  const [attractionId, setAttractionId] = useState(String(tour.attractionId));
  const [classId, setClassId] = useState(String(tour.classId));
  const [talentAgencyCompanyId, setTalentAgencyCompanyId] = useState(
    tour.talentAgencyCompanyId != null ? String(tour.talentAgencyCompanyId) : '',
  );
  const [venueTypePreferenceId, setVenueTypePreferenceId] = useState(
    tour.venueTypePreferenceId != null ? String(tour.venueTypePreferenceId) : '',
  );
  const [audienceGender, setAudienceGender] = useState(tour.audienceGender ?? '');
  const [audienceAgeRange, setAudienceAgeRange] = useState(tour.audienceAgeRange ?? '');
  const [insuranceLanguage, setInsuranceLanguage] = useState(tour.tourInsuranceLanguage ?? '');
  const [ascap, setAscap] = useState(tour.ascap);
  const [bmi, setBmi] = useState(tour.bmi);
  const [sesac, setSesac] = useState(tour.sesac);
  const [gmr, setGmr] = useState(tour.gmr);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tourFieldErrors, setTourFieldErrors] = useState<{
    tourName?: string;
    attractionId?: string;
    classId?: string;
    audienceGender?: string;
    audienceAgeRange?: string;
    insurance?: string;
  }>({});
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [stripBanner, setStripBanner] = useState(false);
  const [bannerInputKey, setBannerInputKey] = useState(0);

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview(null);
      return;
    }
    const u = URL.createObjectURL(bannerFile);
    setBannerPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [bannerFile]);

  useEffect(() => {
    setTourName(tour.tourName);
    setAttractionId(String(tour.attractionId));
    setClassId(String(tour.classId));
    setTalentAgencyCompanyId(
      tour.talentAgencyCompanyId != null ? String(tour.talentAgencyCompanyId) : '',
    );
    setVenueTypePreferenceId(
      tour.venueTypePreferenceId != null ? String(tour.venueTypePreferenceId) : '',
    );
    setAudienceGender(tour.audienceGender ?? '');
    setAudienceAgeRange(tour.audienceAgeRange ?? '');
    setInsuranceLanguage(tour.tourInsuranceLanguage ?? '');
    setAscap(tour.ascap);
    setBmi(tour.bmi);
    setSesac(tour.sesac);
    setGmr(tour.gmr);
    setBannerFile(null);
    setStripBanner(false);
    setBannerInputKey((k) => k + 1);
    setDirty(false);
    setTourFieldErrors({});
  }, [tour.tourId]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setTourFieldErrors({});
    setter(v);
    setDirty(true);
  };

  const attractionOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of attractions) {
      byId.set(String(a.attractionId), a.attractionName);
    }
    const id = String(tour.attractionId);
    if (tour.attractionName) {
      byId.set(id, tour.attractionName);
    } else if (!byId.has(id)) {
      byId.set(id, id);
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [attractions, tour.attractionId, tour.attractionName]);
  const classOptions = classes.map((c) => ({
    value: String(c.classId),
    label: c.className,
  }));
  const mgmtOptions = useMemo(
    () =>
      buildTourManagementSelectOptions(
        managementCompanyOptions,
        companies,
        tour.talentAgencyCompanyId,
        tour.talentAgencyCompanyName,
      ),
    [
      managementCompanyOptions,
      companies,
      tour.talentAgencyCompanyId,
      tour.talentAgencyCompanyName,
    ],
  );
  const venueTypeOpts = [
    { value: '', label: '—' },
    ...venueTypes.map((v) => ({
      value: String(v.venueTypeId),
      label: v.venueTypeName,
    })),
  ];

  const headerAttractionName =
    attractions.find((a) => a.attractionId === Number(attractionId))?.attractionName ??
    tour.attractionName;
  const headerClassName =
    classes.find((c) => c.classId === Number(classId))?.className ?? tour.className;

  const handleSave = async () => {
    const next: typeof tourFieldErrors = {};
    const tn = tourName.trim();
    if (!tn) next.tourName = 'Tour name is required.';
    else if (tn.length > 200) next.tourName = 'Tour name must be 200 characters or fewer.';
    if (!attractionId) next.attractionId = 'Attraction is required.';
    if (!classId) next.classId = 'Genre / Class is required.';
    const ag = audienceGender.trim();
    if (ag.length > 100) next.audienceGender = 'Audience gender must be 100 characters or fewer.';
    const ar = audienceAgeRange.trim();
    if (ar.length > 100) next.audienceAgeRange = 'Audience age range must be 100 characters or fewer.';
    const ins = insuranceLanguage.trim();
    if (ins.length > 2000) next.insurance = 'Tour insurance language must be 2000 characters or fewer.';
    if (Object.keys(next).length) {
      setTourFieldErrors(next);
      return;
    }
    setTourFieldErrors({});
    setSaving(true);
    try {
      const updated = await updateTour(
        tour.tourId,
        {
          tourName: tourName.trim(),
          attractionId: Number(attractionId),
          classId: Number(classId),
          talentAgencyCompanyId: talentAgencyCompanyId
            ? Number(talentAgencyCompanyId)
            : null,
          venueTypePreferenceId: venueTypePreferenceId
            ? Number(venueTypePreferenceId)
            : null,
          audienceGender: audienceGender.trim() || null,
          audienceAgeRange: audienceAgeRange.trim() || null,
          tourInsuranceLanguage: insuranceLanguage.trim() || null,
          ascap,
          bmi,
          sesac,
          gmr,
        },
        {
          bannerFile: bannerFile ?? undefined,
          removeBanner: Boolean(
            tour.tourBannerImageUrl && stripBanner && !bannerFile,
          ),
        },
      );
      setDirty(false);
      setBannerFile(null);
      setStripBanner(false);
      setBannerInputKey((k) => k + 1);
      addToast('Tour updated.', 'success');
      onSaved(updated, tour.attractionId);
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update tour.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setTourName(tour.tourName);
    setAttractionId(String(tour.attractionId));
    setClassId(String(tour.classId));
    setTalentAgencyCompanyId(
      tour.talentAgencyCompanyId != null ? String(tour.talentAgencyCompanyId) : '',
    );
    setVenueTypePreferenceId(
      tour.venueTypePreferenceId != null ? String(tour.venueTypePreferenceId) : '',
    );
    setAudienceGender(tour.audienceGender ?? '');
    setAudienceAgeRange(tour.audienceAgeRange ?? '');
    setInsuranceLanguage(tour.tourInsuranceLanguage ?? '');
    setAscap(tour.ascap);
    setBmi(tour.bmi);
    setSesac(tour.sesac);
    setGmr(tour.gmr);
    setBannerFile(null);
    setStripBanner(false);
    setBannerInputKey((k) => k + 1);
    setDirty(false);
    setTourFieldErrors({});
  };

  const contacts = contactsQuery.data ?? [];

  return (
    <Drawer onClose={onClose} width={1000}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{tourName}</h2>
          <div className="text-sm text-text-secondary">{headerAttractionName}</div>
          <p className="text-xs text-text-muted mt-1">
            {headerClassName}
            {tour.appCreated && <span className="ml-2 text-ems-accent">· Created in this app</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDelete(tour)}
            title="Delete tour"
            className="p-1.5 text-text-muted hover:text-ems-coral hover:bg-ems-coral-dim rounded-md transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md transition-colors text-lg leading-none">✕</button>
        </div>
      </div>

      <TabBar tabs={['Details', 'Contacts']} active={activeTab} onChange={onTabChange} />

      <div className="p-4 text-sm relative">
        {activeTab === 'Details' && (
          <div className="space-y-5 pb-2">
            <p className="flex items-center gap-1.5 text-[11px] text-text-muted select-none">
              <Pencil className="h-3 w-3" /> Click any field to edit it
            </p>
            <InlineField
              label="Tour Name"
              value={tourName}
              onChange={mark(setTourName)}
              required
              maxLength={200}
              error={tourFieldErrors.tourName}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              <InlineSelectField
                label="Attraction"
                value={attractionId}
                onChange={mark(setAttractionId)}
                options={attractionOptions}
                required
                error={tourFieldErrors.attractionId}
              />
              <InlineSelectField
                label="Genre / Class"
                value={classId}
                onChange={mark(setClassId)}
                options={classOptions}
                required
                error={tourFieldErrors.classId}
              />
              <InlineSelectField
                label="Tour Management Company"
                value={talentAgencyCompanyId}
                onChange={mark(setTalentAgencyCompanyId)}
                options={mgmtOptions}
                allowClear
              />
              <InlineSelectField
                label="Preferred Venue Type"
                value={venueTypePreferenceId}
                onChange={mark(setVenueTypePreferenceId)}
                options={venueTypeOpts}
                allowClear
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InlineField
                label="Audience Gender"
                value={audienceGender}
                onChange={mark(setAudienceGender)}
                placeholder="Not set"
                maxLength={100}
                error={tourFieldErrors.audienceGender}
              />
              <InlineField
                label="Audience Age Range"
                value={audienceAgeRange}
                onChange={mark(setAudienceAgeRange)}
                placeholder="Not set"
                maxLength={100}
                error={tourFieldErrors.audienceAgeRange}
              />
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-text-muted">Licensing</span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Performing rights — toggle ASCAP, BMI, SESAC, or GMR, then save.
                </p>
              </div>
              <div
                className="flex flex-wrap gap-x-6 gap-y-2.5 rounded-md border border-border/80 bg-surface/50 px-3 py-3"
                role="group"
                aria-label="Performing rights licensing"
              >
                {(
                  [
                    ['ascap', 'ASCAP', ascap, setAscap] as const,
                    ['bmi', 'BMI', bmi, setBmi] as const,
                    ['sesac', 'SESAC', sesac, setSesac] as const,
                    ['gmr', 'GMR', gmr, setGmr] as const,
                  ] as const
                ).map(([id, label, checked, setChecked]) => (
                  <label
                    key={id}
                    htmlFor={`tour-${tour.tourId}-license-${id}`}
                    className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-primary select-none"
                  >
                    <input
                      id={`tour-${tour.tourId}-license-${id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setTourFieldErrors({});
                        setChecked(e.target.checked);
                        setDirty(true);
                      }}
                      className="h-4 w-4 rounded border-border bg-background text-ems-accent focus:ring-ems-accent focus:ring-offset-0"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <InlineField
              label="Tour Insurance Language"
              value={insuranceLanguage}
              onChange={mark(setInsuranceLanguage)}
              placeholder="Not set"
              multiline
              maxLength={2000}
              error={tourFieldErrors.insurance}
            />

            <div className="rounded-md border border-border/80 bg-surface/50 px-3 py-3 space-y-2">
              <div className="text-xs font-medium text-text-secondary">Tour banner image</div>
              <p className="text-[11px] text-text-muted">
                Optional. JPEG, PNG, WebP, or GIF — max 5 MB.
              </p>
              <input
                key={bannerInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={saving}
                className="block w-full text-xs text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-hover"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setBannerFile(f);
                  if (f) setStripBanner(false);
                  setTourFieldErrors({});
                  setDirty(true);
                }}
              />
              {tour.tourBannerImageUrl && !bannerPreview && (
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={tour.tourBannerImageUrl}
                    alt=""
                    className="h-16 w-28 rounded-md border border-border object-cover bg-elevated"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={stripBanner}
                      disabled={saving}
                      onChange={(e) => {
                        setStripBanner(e.target.checked);
                        if (e.target.checked) {
                          setBannerFile(null);
                          setBannerInputKey((k) => k + 1);
                        }
                        setTourFieldErrors({});
                        setDirty(true);
                      }}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Remove current image
                  </label>
                </div>
              )}
              {bannerPreview && (
                <div className="flex items-start gap-3">
                  <img
                    src={bannerPreview}
                    alt=""
                    className="h-16 w-28 rounded-md border border-border object-cover bg-elevated"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setBannerFile(null);
                      setBannerInputKey((k) => k + 1);
                      setDirty(true);
                    }}
                    className="text-xs text-ems-accent hover:underline disabled:opacity-50"
                  >
                    Clear new upload
                  </button>
                </div>
              )}
            </div>

            {/* Save bar */}
            {dirty && (
              <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-between gap-3 z-10">
                <span className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ems-accent inline-block animate-pulse" /> Unsaved changes
                </span>
                <div className="flex gap-2">
                  <button onClick={discard} disabled={saving} className="text-text-secondary text-xs px-3 py-1.5 hover:text-text-primary rounded-md hover:bg-elevated disabled:opacity-50">Discard</button>
                  <button onClick={() => void handleSave()} disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-ems-accent hover:bg-ems-accent/80 text-background text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-60">
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}Save changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Contacts' && (
          <div>
            {!tour.talentAgencyCompanyId ? (
              <p className="text-text-secondary">No Tour Management Company assigned to this tour.</p>
            ) : contactsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-text-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading contacts…</div>
            ) : contacts.length === 0 ? (
              <p className="text-text-secondary">No contacts listed for this Tour Management Company.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map(c => (
                  <div key={c.contactAssignmentId} className="bg-elevated border border-border rounded-lg p-3">
                    <div className="font-medium text-text-primary">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-text-secondary">{c.roleName} • {c.departmentName}</div>
                    <div className="mt-2 text-xs text-text-secondary space-y-1">
                      <div>{c.email}</div>
                      {c.workPhone && <div>{formatE164ForDisplay(c.workPhone)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

const ATTRACTIONS_TOURS_LIST_LIMIT = 8000;

/**
 * Drop server-search caches. They're keyed by the query string, so after any
 * mutation they may contain stale rows — rather than trying to patch every
 * variant we just remove them and let the next search repopulate on demand.
 */
function clearAttractionToursServerSearchCaches(qc: QueryClient) {
  removeQueriesByPrefix(qc, attractionsServerSearchKeyPrefix);
  removeQueriesByPrefix(qc, toursServerSearchKeyPrefix);
}

const compareTours = (a: ApiTourListRow, b: ApiTourListRow) =>
  a.tourName.localeCompare(b.tourName, undefined, { sensitivity: 'base' });

export function AttractionToursPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState('Attractions');
  const [attractionInput, setAttractionInput] = useState('');
  const [attractionSearch, setAttractionSearch] = useState('');
  const [showAttractionSuggestions, setShowAttractionSuggestions] = useState(false);
  const [tourInput, setTourInput] = useState('');
  const [tourSearch, setTourSearch] = useState('');
  const [showTourSuggestions, setShowTourSuggestions] = useState(false);
  const attractionSearchRef = useRef<HTMLDivElement>(null);
  const tourSearchRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [attractionSort, setAttractionSort] = useState<{
    col: 'name' | 'tours';
    dir: 'asc' | 'desc';
  }>({ col: 'name', dir: 'asc' });
  const [tourSort, setTourSort] = useState<{
    col: 'tour' | 'attraction' | 'class' | 'management';
    dir: 'asc' | 'desc';
  }>({ col: 'tour', dir: 'asc' });
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE);
  const [attractionsViewMode, setAttractionsViewMode] = useState<AttractionsViewMode>(loadAttractionsViewMode);
  const [attractionsTileSize, setAttractionsTileSize] = useState<AttractionsTileSize>(loadAttractionsTileSize);
  const [expandedAttractionTileId, setExpandedAttractionTileId] = useState<number | null>(null);

  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [tourDrawerTab, setTourDrawerTab] = useState('Details');

  const [showAddAttraction, setShowAddAttraction] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);
  const [editAttraction, setEditAttraction] = useState<ApiAttractionListRow | null>(null);
  const [editTour, setEditTour] = useState<ApiTourListRow | null>(null);

  const [pendingDeleteAttraction, setPendingDeleteAttraction] = useState<ApiAttractionListRow | null>(null);
  const [pendingDeleteTour, setPendingDeleteTour] = useState<ApiTourListRow | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attractionSearchRef.current && !attractionSearchRef.current.contains(e.target as Node)) {
        setShowAttractionSuggestions(false);
      }
      if (tourSearchRef.current && !tourSearchRef.current.contains(e.target as Node)) {
        setShowTourSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Hiding a tab’s search UI does not unmount its state; clear the inactive list search when switching tabs. */
  useEffect(() => {
    if (pageTab === 'Tours') {
      setAttractionInput('');
      setAttractionSearch('');
      setShowAttractionSuggestions(false);
    } else {
      setTourInput('');
      setTourSearch('');
      setShowTourSuggestions(false);
    }
  }, [pageTab]);

  useEffect(() => {
    if (pageTab !== 'Attractions') {
      setExpandedAttractionTileId(null);
    }
  }, [pageTab]);

  const attractionsQuery = useQuery({
    queryKey: [
      ...attractionsListQueryKey,
      attractionSort.col,
      attractionSort.dir,
    ] as const,
    queryFn: async () =>
      fetchAttractions(0, ATTRACTIONS_TOURS_LIST_LIMIT, undefined, {
        sortBy: attractionSort.col === 'tours' ? 'tours' : 'name',
        sortDir: attractionSort.dir,
      }),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const toursQuery = useQuery({
    queryKey: [...toursListQueryKey, tourSort.col, tourSort.dir] as const,
    queryFn: async () =>
      fetchTours(0, ATTRACTIONS_TOURS_LIST_LIMIT, undefined, {
        sortBy:
          tourSort.col === 'tour'
            ? 'tour'
            : tourSort.col === 'attraction'
              ? 'attraction'
              : tourSort.col === 'class'
                ? 'class'
                : 'management',
        sortDir: tourSort.dir,
      }),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lookupsQuery = useQuery({
    queryKey: ['attraction-tours-lookups'],
    queryFn: async () => {
      const [classes, companies, venueTypes] = await Promise.all([
        fetchClasses(),
        fetchCompanies(0, COMPANIES_PICKER_LIMIT, {}),
        fetchVenueTypesLookup(),
      ]);
      return { classes, companies: companies.data, venueTypes };
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const attractionsPage = attractionsQuery.data as
    | ApiPaginatedResponse<import('@/api/attractionToursApi').ApiAttractionListRow>
    | undefined;
  const toursPage = toursQuery.data as
    | ApiPaginatedResponse<import('@/api/attractionToursApi').ApiTourListRow>
    | undefined;
  const attractions = attractionsPage?.data ?? [];
  const tours = toursPage?.data ?? [];
  const attractionsForPicker = attractions;

  const attractionSuggestions = useMemo(() => {
    const q = attractionInput.trim().toLowerCase();
    if (!q) return [];
    return attractions
      .map((a) => a.attractionName)
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [attractionInput, attractions]);

  const tourSuggestions = useMemo(() => {
    const q = tourInput.trim().toLowerCase();
    if (!q) return [];
    const matches = tours.filter(
      (t) =>
        t.tourName.toLowerCase().includes(q) ||
        t.attractionName.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        (t.talentAgencyCompanyName && t.talentAgencyCompanyName.toLowerCase().includes(q)),
    );
    return [...new Set(matches.map((t) => t.tourName))].slice(0, 8);
  }, [tourInput, tours]);

  const filteredAttractions = useMemo(() => {
    const q = attractionSearch.trim().toLowerCase();
    return attractions.filter(
      (a) => !q || a.attractionName.toLowerCase().includes(q),
    );
  }, [attractions, attractionSearch]);

  const filteredTours = useMemo(() => {
    const q = tourSearch.trim().toLowerCase();
    return tours.filter(
      (t) =>
        !q ||
        t.tourName.toLowerCase().includes(q) ||
        t.attractionName.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        (t.talentAgencyCompanyName && t.talentAgencyCompanyName.toLowerCase().includes(q)),
    );
  }, [tours, tourSearch]);

  const needServerAttractionSearch = Boolean(
    attractionSearch.trim() && filteredAttractions.length === 0,
  );
  const serverAttractionsSearchQuery = useQuery({
    queryKey: [
      ...attractionsServerSearchKeyPrefix,
      attractionSearch,
      attractionSort.col,
      attractionSort.dir,
    ] as const,
    queryFn: () =>
      fetchAttractions(0, ATTRACTIONS_TOURS_LIST_LIMIT, attractionSearch, {
        sortBy: attractionSort.col === 'tours' ? 'tours' : 'name',
        sortDir: attractionSort.dir,
      }),
    enabled: needServerAttractionSearch,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const displayAttractions = useMemo((): ApiAttractionListRow[] => {
    if (needServerAttractionSearch) {
      return serverAttractionsSearchQuery.data?.data ?? [];
    }
    return filteredAttractions;
  }, [needServerAttractionSearch, serverAttractionsSearchQuery.data, filteredAttractions]);

  const needServerTourSearch = Boolean(
    tourSearch.trim() && filteredTours.length === 0,
  );
  const serverToursSearchQuery = useQuery({
    queryKey: [
      ...toursServerSearchKeyPrefix,
      tourSearch,
      tourSort.col,
      tourSort.dir,
    ] as const,
    queryFn: () =>
      fetchTours(0, ATTRACTIONS_TOURS_LIST_LIMIT, tourSearch, {
        sortBy:
          tourSort.col === 'tour'
            ? 'tour'
            : tourSort.col === 'attraction'
              ? 'attraction'
              : tourSort.col === 'class'
                ? 'class'
                : 'management',
        sortDir: tourSort.dir,
      }),
    enabled: needServerTourSearch,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const displayTours = useMemo((): ApiTourListRow[] => {
    if (needServerTourSearch) {
      return serverToursSearchQuery.data?.data ?? [];
    }
    return filteredTours;
  }, [needServerTourSearch, serverToursSearchQuery.data, filteredTours]);

  /**
   * Surgical cache helpers — product requirement is a 30-minute staleTime on
   * the main lists, with every create/update/delete reflected in the cache
   * IMMEDIATELY without a full refetch. Since the backend now returns full
   * `ApiAttractionListRow` / `ApiTourListRow` objects, we can splice them in
   * place with `setQueryData` and leave the staleness window untouched.
   */
  const upsertAttractionInCache = useCallback((_row: ApiAttractionListRow) => {
    void qc.invalidateQueries({ queryKey: ['attractions'], exact: false });
    void qc.invalidateQueries({ queryKey: ['tours'], exact: false });
    clearAttractionToursServerSearchCaches(qc);
  }, [qc]);

  const upsertTourInCache = useCallback(
    (_row: ApiTourListRow, prevAttractionId: number | null) => {
      void qc.invalidateQueries({ queryKey: ['tours'], exact: false });
      if (prevAttractionId == null || prevAttractionId !== _row.attractionId) {
        void qc.invalidateQueries({ queryKey: ['attractions'], exact: false });
      }
      clearAttractionToursServerSearchCaches(qc);
    },
    [qc],
  );

  const createAttrMut = useMutation({
    mutationFn: createAttraction,
    onSuccess: (row) => {
      upsertAttractionInCache(row);
      setShowAddAttraction(false);
      addToast('Attraction created.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not create attraction.'), 'error'),
  });

  const updateAttrMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof updateAttraction>[1] }) =>
      updateAttraction(id, body),
    onSuccess: (row) => {
      upsertAttractionInCache(row);
      setEditAttraction(null);
      addToast('Attraction updated.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not update attraction.'), 'error'),
  });

  const deleteAttrMut = useMutation({
    mutationFn: deleteAttraction,
    onSuccess: (_, attractionId) => {
      void qc.invalidateQueries({ queryKey: ['attractions'], exact: false });
      void qc.invalidateQueries({ queryKey: ['tours'], exact: false });
      clearAttractionToursServerSearchCaches(qc);
      setPendingDeleteAttraction(null);
      setSelectedAttractionId((cur) => (cur === attractionId ? null : cur));
      addToast('Attraction removed.', 'warning');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete attraction.'), 'error'),
  });

  const createTourMut = useMutation({
    mutationFn: ({
      body,
      bannerFile,
    }: {
      body: import('@/api/attractionToursApi').CreateTourPayload;
      bannerFile?: File | null;
    }) => createTour(body, bannerFile ? { bannerFile } : undefined),
    onSuccess: (row) => {
      upsertTourInCache(row, null);
      setShowAddTour(false);
      addToast('Tour created.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not create tour.'), 'error'),
  });

  const updateTourMut = useMutation({
    mutationFn: ({
      id,
      body,
      prevAttractionId,
      bannerFile,
      removeBanner,
    }: {
      id: number;
      body: Parameters<typeof updateTour>[1];
      prevAttractionId: number;
      bannerFile?: File | null;
      removeBanner?: boolean;
    }) =>
      updateTour(id, body, {
        ...(bannerFile ? { bannerFile } : {}),
        ...(removeBanner ? { removeBanner: true } : {}),
      }).then((row) => ({ row, prevAttractionId })),
    onSuccess: ({ row, prevAttractionId }) => {
      upsertTourInCache(row, prevAttractionId);
      setEditTour(null);
      addToast('Tour updated.', 'success');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not update tour.'), 'error'),
  });

  const deleteTourMut = useMutation({
    mutationFn: deleteTour,
    onSuccess: (_, tourId) => {
      void qc.invalidateQueries({ queryKey: ['tours'], exact: false });
      void qc.invalidateQueries({ queryKey: ['attractions'], exact: false });
      clearAttractionToursServerSearchCaches(qc);
      setPendingDeleteTour(null);
      setSelectedTourId((cur) => (cur === tourId ? null : cur));
      addToast('Tour removed.', 'warning');
    },
    onError: (e) => addToast(friendlyApiError(e, 'Could not delete tour.'), 'error'),
  });

  const listForTable = useMemo(
    () => (pageTab === 'Attractions' ? displayAttractions : displayTours),
    [pageTab, displayAttractions, displayTours],
  );
  const serverTotal = listForTable.length;
  const { offset, limit } = getPageParams(page, pageSize);
  const paginated = useMemo(
    () => listForTable.slice(offset, offset + limit),
    [listForTable, offset, limit],
  );
  const pageCount = getTotalPages(serverTotal, pageSize);
  const { rangeStart, rangeEnd } = getPageRange(page, serverTotal, pageSize);

  const attractionTilesGridClass =
    attractionsTileSize === 'large'
      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start'
      : attractionsTileSize === 'medium'
        ? 'grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start'
        : 'grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3 items-start';

  /** Initial load: lookups + both full lists, or a targeted server search on the active tab. */
  const loading =
    lookupsQuery.isPending ||
    attractionsQuery.isPending ||
    toursQuery.isPending ||
    (pageTab === 'Attractions' &&
      needServerAttractionSearch &&
      (serverAttractionsSearchQuery.isPending || serverAttractionsSearchQuery.isFetching)) ||
    (pageTab === 'Tours' &&
      needServerTourSearch &&
      (serverToursSearchQuery.isPending || serverToursSearchQuery.isFetching));
  /** Top progress bar when a background refetch runs after mutations, etc. */
  const refreshing =
    (attractionsQuery.isFetching && !attractionsQuery.isPending) ||
    (toursQuery.isFetching && !toursQuery.isPending) ||
    (lookupsQuery.isFetching && !lookupsQuery.isPending);

  const toggleAttractionSort = useCallback((col: 'name' | 'tours') => {
    setAttractionSort((s) =>
      s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' },
    );
    setPage(1);
  }, []);

  const toggleTourSort = useCallback(
    (col: 'tour' | 'attraction' | 'class' | 'management') => {
      setTourSort((s) =>
        s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' },
      );
      setPage(1);
    },
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [attractionSearch, tourSearch, pageTab, attractionSort, tourSort]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const selectedAttraction = selectedAttractionId
    ? attractions.find((a) => a.attractionId === selectedAttractionId) ??
      displayAttractions.find((a) => a.attractionId === selectedAttractionId) ??
      null
    : null;
  const selectedTour = selectedTourId
    ? tours.find((t) => t.tourId === selectedTourId) ??
      displayTours.find((t) => t.tourId === selectedTourId) ??
      null
    : null;

  const attractionTours = selectedAttraction
    ? tours.filter(
        (t) =>
          Number(t.attractionId) === Number(selectedAttraction.attractionId),
      )
    : [];

  const toursByAttractionId = useMemo(() => {
    const byAttraction = new Map<number, ApiTourListRow[]>();
    for (const t of tours) {
      const arr = byAttraction.get(t.attractionId);
      if (arr) arr.push(t);
      else byAttraction.set(t.attractionId, [t]);
    }
    for (const arr of byAttraction.values()) {
      arr.sort(compareTours);
    }
    return byAttraction;
  }, [tours]);

  const lkp = lookupsQuery.data;
  const classes = lkp?.classes ?? [];
  const venueTypes = lkp?.venueTypes ?? [];
  const companies = lkp?.companies ?? [];

  const managementCompanyOptions = useMemo(() => {
    const talentAgencies = companies.filter(
      (c) => (c.companyTypeName ?? '').trim().toLowerCase() === 'talent agency',
    );
    return talentAgencies
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
              You’re about to remove{' '}
              <span className="font-medium text-text-primary">
                {pendingDeleteAttraction?.attractionName ?? 'this attraction'}
              </span>{' '}
              from your list. If something blocks the removal, you’ll see a short explanation right after
              you confirm.
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
              You’re about to remove{' '}
              <span className="font-medium text-text-primary">
                {pendingDeleteTour?.tourName ?? 'this tour'}
              </span>{' '}
              from your list. If something blocks the removal, you’ll see a short explanation right after you
              confirm.
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
          <h1 className="text-xl font-semibold text-text-primary">Attraction Tours</h1>
          {loading ? (
            <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden />
          ) : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {serverTotal.toLocaleString()}
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
        {pageTab === 'Attractions' ? (
          <div className="relative w-full min-w-0 sm:w-64" ref={attractionSearchRef}>
            <div className="flex min-w-0 items-center border border-border rounded-md bg-surface overflow-hidden focus-within:border-ems-accent transition-colors">
              <input
                type="text"
                className="min-w-0 flex-1 cursor-text bg-transparent px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search attractions..."
                value={attractionInput}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value;
                  setAttractionInput(v);
                  setShowAttractionSuggestions(true);
                  if (!v.trim()) setAttractionSearch('');
                }}
                onFocus={() => {
                  if (attractionInput.trim()) setShowAttractionSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setAttractionSearch(attractionInput.trim());
                    setShowAttractionSuggestions(false);
                  }
                  if (e.key === 'Escape') setShowAttractionSuggestions(false);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setAttractionSearch(attractionInput.trim());
                  setShowAttractionSuggestions(false);
                }}
                className="shrink-0 cursor-pointer px-2.5 py-1.5 text-text-muted hover:text-ems-accent transition-colors"
                title="Search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {showAttractionSuggestions && attractionSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                {attractionSuggestions.map((s, i) => (
                  <button
                    key={`${i}-${s}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setAttractionInput(s);
                      setAttractionSearch(s);
                      setShowAttractionSuggestions(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full min-w-0 sm:w-64" ref={tourSearchRef}>
            <div className="flex min-w-0 items-center border border-border rounded-md bg-surface overflow-hidden focus-within:border-ems-accent transition-colors">
              <input
                type="text"
                className="min-w-0 flex-1 cursor-text bg-transparent px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search tours..."
                value={tourInput}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value;
                  setTourInput(v);
                  setShowTourSuggestions(true);
                  if (!v.trim()) setTourSearch('');
                }}
                onFocus={() => {
                  if (tourInput.trim()) setShowTourSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setTourSearch(tourInput.trim());
                    setShowTourSuggestions(false);
                  }
                  if (e.key === 'Escape') setShowTourSuggestions(false);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setTourSearch(tourInput.trim());
                  setShowTourSuggestions(false);
                }}
                className="shrink-0 cursor-pointer px-2.5 py-1.5 text-text-muted hover:text-ems-accent transition-colors"
                title="Search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {showTourSuggestions && tourSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                {tourSuggestions.map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTourInput(s);
                      setTourSearch(s);
                      setShowTourSuggestions(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {pageTab === 'Attractions' && (
          <div className="sm:ml-auto flex flex-wrap items-center gap-2 justify-end">
            <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => {
                  setAttractionsViewMode('list');
                  saveAttractionsViewMode('list');
                  setExpandedAttractionTileId(null);
                }}
                className={[
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  attractionsViewMode === 'list'
                    ? 'bg-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
                title="List view"
              >
                <List className="h-3.5 w-3.5" aria-hidden />
                List
              </button>
              <button
                type="button"
                onClick={() => {
                  setAttractionsViewMode('tiles');
                  saveAttractionsViewMode('tiles');
                }}
                className={[
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  attractionsViewMode === 'tiles'
                    ? 'bg-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
                title="Tile view"
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Tiles
              </button>
            </div>
            {attractionsViewMode === 'tiles' && (
              <div
                className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
                role="group"
                aria-label="Attraction tile size"
              >
                {(
                  [
                    { id: 'large' as const, label: 'L', title: 'Large — 3 columns on wide screens (original)' },
                    { id: 'medium' as const, label: 'M', title: 'Medium — ~66% of large tile width, more columns' },
                    { id: 'small' as const, label: 'S', title: 'Small — ~50% of large tile width, more columns' },
                  ] as const
                ).map(({ id, label, title }) => (
                  <button
                    key={id}
                    type="button"
                    title={title}
                    aria-label={title}
                    aria-pressed={attractionsTileSize === id}
                    onClick={() => {
                      setAttractionsTileSize(id);
                      saveAttractionsTileSize(id);
                    }}
                    className={[
                      'min-w-[1.75rem] px-2 py-1 text-xs font-semibold rounded transition-colors',
                      attractionsTileSize === id
                        ? 'bg-elevated text-text-primary'
                        : 'text-text-secondary hover:text-text-primary',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <AttractionToursTableSkeleton
          variant={pageTab === 'Attractions' ? 'attractions' : 'tours'}
          rowCount={isAllPageSize(pageSize) ? PAGE_SIZE : pageSize}
        />
      ) : (
        <>
          {pageTab === 'Attractions' && (
            <>
              {attractionsViewMode === 'list' ? (
                <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-text-muted text-xs border-b border-border bg-surface">
                        <th className="text-left py-2.5 px-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                            onClick={() => toggleAttractionSort('name')}
                          >
                            Attraction Name
                            {attractionSort.col === 'name' &&
                              (attractionSort.dir === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                              ))}
                          </button>
                        </th>
                        <th className="text-left py-2.5 px-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                            onClick={() => toggleAttractionSort('tours')}
                          >
                            Active Tours
                            {attractionSort.col === 'tours' &&
                              (attractionSort.dir === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                              ))}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serverTotal === 0 && !attractionsQuery.isError && (
                        <tr>
                          <td colSpan={3} className="py-12 px-3 text-center text-sm text-text-muted">
                            {!attractionSearch.trim()
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
                          <td className="py-2.5 px-3 text-text-secondary tabular-nums text-sm">{a.activeTourCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {serverTotal === 0 && !attractionsQuery.isError ? (
                    <div className="rounded-lg border border-border bg-card py-12 px-3 text-center text-sm text-text-muted">
                      {!attractionSearch.trim()
                        ? 'No attractions found.'
                        : 'No attractions match your search.'}
                    </div>
                  ) : (
                    <div className={attractionTilesGridClass}>
                      {(paginated as ApiAttractionListRow[]).map((a) => {
                        const isExpanded = expandedAttractionTileId === a.attractionId;
                        const toursForAttraction = toursByAttractionId.get(a.attractionId) ?? [];
                        const thumb = getThumbnailUrl(a as unknown as Record<string, unknown>);
                        return (
                          <div
                            key={a.attractionId}
                            className="rounded-xl border border-border bg-card overflow-hidden w-full min-w-0"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAttractionTileId((cur) =>
                                  cur === a.attractionId ? null : a.attractionId,
                                )
                              }
                              className="w-full text-left transition-colors hover:bg-surface/40"
                            >
                              <div className="p-3">
                                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/70 bg-elevated">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={`${a.attractionName} thumbnail`}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ems-accent-dim/50 to-ems-purple-dim/50 text-text-secondary">
                                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 text-sm font-semibold text-text-primary">
                                        {initialsFromName(a.attractionName)}
                                      </span>
                                      <span className="text-[11px] uppercase tracking-wide">Attraction</span>
                                    </div>
                                  )}
                                  <span className="absolute right-2 top-2 rounded-md bg-card/90 border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                    {a.activeTourCount} tours
                                  </span>
                                </div>
                                <div className="mt-2.5 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate" title={a.attractionName}>
                                      {a.attractionName}
                                    </p>
                                    <p className="text-[11px] text-text-muted">Common proper name</p>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
                                  )}
                                </div>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-border/80 bg-surface/30 px-3 py-3 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Related Tours
                                  </h3>
                                  <button
                                    type="button"
                                    className="text-xs text-ems-accent hover:text-ems-accent/80 font-medium"
                                    onClick={() => setSelectedAttractionId(a.attractionId)}
                                  >
                                    Open details
                                  </button>
                                </div>
                                {toursForAttraction.length === 0 ? (
                                  <p className="text-xs text-text-muted">No tours attached yet.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {toursForAttraction.map((t) => (
                                      <TourThumbnailTile key={t.tourId} tour={t} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {pageTab === 'Attractions' && serverTotal > 0 && (
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
                        disabled={attractionsQuery.isFetching}
                      />
                      <span>per page</span>
                    </span>
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page <= 1 || attractionsQuery.isFetching}
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
                      disabled={page >= pageCount || attractionsQuery.isFetching}
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
                      <th className="text-left py-2.5 px-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                          onClick={() => toggleTourSort('tour')}
                        >
                          Tour Name
                          {tourSort.col === 'tour' &&
                            (tourSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ))}
                        </button>
                      </th>
                      <th className="text-left py-2.5 px-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                          onClick={() => toggleTourSort('attraction')}
                        >
                          Attraction
                          {tourSort.col === 'attraction' &&
                            (tourSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ))}
                        </button>
                      </th>
                      <th className="text-left py-2.5 px-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                          onClick={() => toggleTourSort('class')}
                        >
                          Class
                          {tourSort.col === 'class' &&
                            (tourSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ))}
                        </button>
                      </th>
                      <th className="text-left py-2.5 px-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                          onClick={() => toggleTourSort('management')}
                        >
                          Tour Management Company
                          {tourSort.col === 'management' &&
                            (tourSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-ems-accent" aria-hidden />
                            ))}
                        </button>
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTours.length === 0 && !toursQuery.isError && (
                      <tr>
                        <td colSpan={5} className="py-12 px-3 text-center text-sm text-text-muted">
                          {!tourSearch.trim() ? 'No tours found.' : 'No tours match your search.'}
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
                          <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{t.className}</span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-sm">{t.talentAgencyCompanyName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageTab === 'Tours' && serverTotal > 0 && (
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
                        disabled={toursQuery.isFetching}
                      />
                      <span>per page</span>
                    </span>
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={page <= 1 || toursQuery.isFetching}
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
                      disabled={page >= pageCount || toursQuery.isFetching}
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
        <AttractionSidePanel
          attraction={selectedAttraction}
          tours={attractionTours}
          addToast={addToast}
          onClose={() => setSelectedAttractionId(null)}
          onDelete={(a) => setPendingDeleteAttraction(a)}
          onSaved={(row) => upsertAttractionInCache(row)}
        />
      )}

      {selectedTour && (
        <TourDrawer
          tour={selectedTour}
          attractions={attractionsForPicker}
          classes={classes}
          venueTypes={venueTypes}
          companies={companies}
          managementCompanyOptions={managementCompanyOptions}
          addToast={addToast}
          onClose={() => setSelectedTourId(null)}
          onDelete={(t) => setPendingDeleteTour(t)}
          onSaved={(row, prevAttractionId) => upsertTourInCache(row, prevAttractionId)}
          activeTab={tourDrawerTab}
          onTabChange={setTourDrawerTab}
        />
      )}

      {showAddAttraction && (
        <Modal title="Add Attraction" onClose={() => setShowAddAttraction(false)} width={600} allowContentOverflow>
          <AttractionForm
            submitting={createAttrMut.isPending}
            onCancel={() => setShowAddAttraction(false)}
            onSave={(body) => void createAttrMut.mutateAsync(body)}
          />
        </Modal>
      )}
      {editAttraction && (
        <Modal title="Edit Attraction" onClose={() => setEditAttraction(null)} width={600} allowContentOverflow>
          <AttractionForm
            initial={editAttraction}
            submitting={updateAttrMut.isPending}
            onCancel={() => setEditAttraction(null)}
            onSave={(body) => void updateAttrMut.mutateAsync({ id: editAttraction.attractionId, body })}
          />
        </Modal>
      )}
      {showAddTour && classes.length > 0 && attractionsForPicker.length > 0 && (
        <Modal title="Add Tour" onClose={() => setShowAddTour(false)} width={600} allowContentOverflow>
          <AddTourForm
            variant="attraction-tours"
            attractions={attractionsForPicker}
            classes={classes}
            submitting={createTourMut.isPending}
            onCancel={() => setShowAddTour(false)}
            onSave={(body, bannerFile) =>
              void createTourMut.mutateAsync({ body, bannerFile: bannerFile ?? undefined })
            }
          />
        </Modal>
      )}
      {editTour && (
        <Modal title="Edit Tour" onClose={() => setEditTour(null)} width={960} allowContentOverflow>
          <TourFormDb
            attractions={attractionsForPicker}
            classes={classes}
            companies={companies}
            managementCompanyOptions={managementCompanyOptions}
            venueTypes={venueTypes}
            initial={editTour}
            submitting={updateTourMut.isPending}
            onCancel={() => setEditTour(null)}
            onSave={(body, opts) =>
              void updateTourMut.mutateAsync({
                id: editTour.tourId,
                body,
                prevAttractionId: editTour.attractionId,
                bannerFile: opts?.bannerFile,
                removeBanner: opts?.removeBanner,
              })
            }
          />
        </Modal>
      )}
    </div>
  );
}

function AttractionForm({
  initial,
  submitting,
  onSave,
  onCancel,
}: {
  initial?: ApiAttractionListRow;
  submitting: boolean;
  onSave: (body: { attractionName: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.attractionName ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  return (
    <div className="space-y-4">
      <FormField label="Attraction Name" required error={nameError}>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
          maxLength={200}
        />
      </FormField>
      <p className="text-xs text-text-muted">
        Genre (Class) is set at the Tour level, not the Attraction level.
      </p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-text-secondary px-4 py-1.5" disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            const t = name.trim();
            if (!t) {
              setNameError('Attraction name is required.');
              return;
            }
            if (t.length > 200) {
              setNameError('Attraction name must be 200 characters or fewer.');
              return;
            }
            setNameError(undefined);
            onSave({ attractionName: t });
          }}
          className="inline-flex items-center gap-2 bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : 'Save'}
        </button>
      </div>
    </div>
  );
}

function TourFormDb({
  attractions,
  classes,
  companies,
  managementCompanyOptions,
  venueTypes,
  initial,
  submitting,
  onSave,
  onCancel,
}: {
  attractions: ApiAttractionListRow[];
  classes: ApiClass[];
  companies: ApiCompanyListRow[];
  managementCompanyOptions: { value: string; label: string }[];
  venueTypes: ApiVenueType[];
  initial?: ApiTourListRow;
  submitting: boolean;
  onSave: (
    body: import('@/api/attractionToursApi').CreateTourPayload | import('@/api/attractionToursApi').UpdateTourPayload,
    opts?: { bannerFile?: File | null; removeBanner?: boolean },
  ) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.tourName ?? '');
  const [attractionId, setAttractionId] = useState(
    String(initial?.attractionId ?? attractions[0]?.attractionId ?? ''),
  );
  const [classId, setClassId] = useState(String(initial?.classId ?? classes[0]?.classId ?? ''));
  const [talentAgentCompanyId, setTalentAgentCompanyId] = useState(
    initial?.talentAgencyCompanyId != null ? String(initial.talentAgencyCompanyId) : '',
  );
  /** Not persisted — skipped on save. */
  const [uiStatus, setUiStatus] = useState('');
  const [ascap, setAscap] = useState(initial?.ascap ?? false);
  const [bmi, setBmi] = useState(initial?.bmi ?? false);
  const [sesac, setSesac] = useState(initial?.sesac ?? false);
  const [gmr, setGmr] = useState(initial?.gmr ?? false);
  const [audienceGender, setAudienceGender] = useState(initial?.audienceGender ?? '');
  const [audienceAgeRange, setAudienceAgeRange] = useState(initial?.audienceAgeRange ?? '');
  const [tourInsuranceLanguage, setTourInsuranceLanguage] = useState(initial?.tourInsuranceLanguage ?? '');
  const [venueTypePreferenceId, setVenueTypePreferenceId] = useState(
    initial?.venueTypePreferenceId != null ? String(initial.venueTypePreferenceId) : '',
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [stripBanner, setStripBanner] = useState(false);
  const [bannerInputKey, setBannerInputKey] = useState(0);

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview(null);
      return;
    }
    const u = URL.createObjectURL(bannerFile);
    setBannerPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [bannerFile]);

  useEffect(() => {
    setBannerFile(null);
    setStripBanner(false);
    setBannerInputKey((k) => k + 1);
  }, [initial?.tourId]);

  const clearError = useCallback((key: string) => {
    setFieldErrors((e) => clearFormFieldError(e, key));
  }, []);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const attractionOptions = attractions.map((a) => ({
    value: String(a.attractionId),
    label: a.attractionName,
  }));
  const classOptions = classes.map((c) => ({ value: String(c.classId), label: c.className }));
  const mgmtOptions = useMemo(
    () =>
      buildTourManagementSelectOptions(
        managementCompanyOptions,
        companies,
        initial?.talentAgencyCompanyId,
        initial?.talentAgencyCompanyName,
      ),
    [
      managementCompanyOptions,
      companies,
      initial?.talentAgencyCompanyId,
      initial?.talentAgencyCompanyName,
    ],
  );
  const statusOptions = [{ value: '', label: '—' }, ...TOUR_STATUS_OPTIONS];
  const venueTypeOptions = [{ value: '', label: '—' }, ...venueTypes.map((v) => ({ value: String(v.venueTypeId), label: v.venueTypeName }))];

  const buildPayload = (): import('@/api/attractionToursApi').CreateTourPayload => ({
    tourName: name.trim(),
    attractionId: Number(attractionId),
    classId: Number(classId),
    ascap,
    bmi,
    sesac,
    gmr,
    talentAgencyCompanyId: talentAgentCompanyId ? Number(talentAgentCompanyId) : null,
    audienceGender: audienceGender.trim() || null,
    audienceAgeRange: audienceAgeRange.trim() || null,
    tourInsuranceLanguage: tourInsuranceLanguage.trim() || null,
    venueTypePreferenceId: venueTypePreferenceId ? Number(venueTypePreferenceId) : null,
  });

  const validateAndSave = () => {
    const next: Partial<Record<string, string>> = {};
    const tn = name.trim();
    if (!tn) next.tourName = 'Tour name is required.';
    else if (tn.length > 200) next.tourName = 'Tour name must be 200 characters or fewer.';
    const aId = Number(attractionId);
    if (!attractionId || !Number.isFinite(aId) || aId < 1) {
      next.attraction = 'Attraction is required.';
    }
    const cId = Number(classId);
    if (!classId || !Number.isFinite(cId) || cId < 1) {
      next.class = 'Class (genre) is required.';
    }
    if (audienceGender.trim().length > 100) {
      next.audienceGender = 'Audience gender must be 100 characters or fewer.';
    }
    if (audienceAgeRange.trim().length > 100) {
      next.audienceAge = 'Audience age range must be 100 characters or fewer.';
    }
    if (tourInsuranceLanguage.trim().length > 2000) {
      next.insurance = 'Tour insurance language must be 2000 characters or fewer.';
    }
    if (Object.keys(next).length) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    onSave(buildPayload(), {
      bannerFile: bannerFile ?? undefined,
      removeBanner: Boolean(
        initial?.tourBannerImageUrl && stripBanner && !bannerFile,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <FormField label="Tour Name" required error={fieldErrors.tourName}>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError('tourName');
          }}
          maxLength={200}
          placeholder="e.g. World Tour 2025"
        />
      </FormField>
      <FormField label="Tour banner image" optional>
        <p className="text-[11px] text-text-muted mb-2">
          JPEG, PNG, WebP, or GIF — max 5 MB. Replaces the current banner when you save.
        </p>
        <div className="space-y-2">
          <input
            key={bannerInputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={submitting}
            className="block w-full text-xs text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-hover"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setBannerFile(f);
              if (f) setStripBanner(false);
              setFieldErrors({});
            }}
          />
          {initial?.tourBannerImageUrl && !bannerPreview && (
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={initial.tourBannerImageUrl}
                alt=""
                className="h-16 w-28 rounded-md border border-border object-cover bg-elevated"
              />
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={stripBanner}
                  disabled={submitting}
                  onChange={(e) => {
                    setStripBanner(e.target.checked);
                    if (e.target.checked) {
                      setBannerFile(null);
                      setBannerInputKey((k) => k + 1);
                    }
                    setFieldErrors({});
                  }}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Remove current image
              </label>
            </div>
          )}
          {bannerPreview && (
            <div className="flex items-start gap-3">
              <img
                src={bannerPreview}
                alt=""
                className="h-16 w-28 rounded-md border border-border object-cover bg-elevated"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setBannerFile(null);
                  setBannerInputKey((k) => k + 1);
                }}
                className="text-xs text-ems-accent hover:underline disabled:opacity-50"
              >
                Clear new upload
              </button>
            </div>
          )}
        </div>
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Attraction" required error={fieldErrors.attraction}>
          <Select2
            options={attractionOptions}
            value={attractionId}
            onChange={(v) => {
              setAttractionId(v);
              clearError('attraction');
            }}
          />
        </FormField>
        <FormField label="Class (genre)" required error={fieldErrors.class}>
          <Select2
            options={classOptions}
            value={classId}
            onChange={(v) => {
              setClassId(v);
              clearError('class');
            }}
          />
        </FormField>
      </div>
      <FormField label="Tour Management Company">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Audience Gender" error={fieldErrors.audienceGender}>
          <input
            className={inputCls}
            value={audienceGender}
            onChange={(e) => {
              setAudienceGender(e.target.value);
              clearError('audienceGender');
            }}
            maxLength={100}
            placeholder="e.g. All, Female, Male"
          />
        </FormField>
        <FormField label="Audience Age Range" error={fieldErrors.audienceAge}>
          <input
            className={inputCls}
            value={audienceAgeRange}
            onChange={(e) => {
              setAudienceAgeRange(e.target.value);
              clearError('audienceAge');
            }}
            maxLength={100}
            placeholder="e.g. 18-35, All Ages"
          />
        </FormField>
        <FormField label="Preferred Venue Type">
          <Select2
            options={venueTypeOptions}
            value={venueTypePreferenceId}
            onChange={setVenueTypePreferenceId}
            placeholder="Select venue type…"
            allowClear
          />
        </FormField>
      </div>
      <FormField label="Tour Insurance Language" error={fieldErrors.insurance}>
        <textarea
          className={inputCls}
          value={tourInsuranceLanguage}
          onChange={(e) => {
            setTourInsuranceLanguage(e.target.value);
            clearError('insurance');
          }}
          rows={3}
          maxLength={2000}
          placeholder="Enter insurance requirements and language…"
        />
      </FormField>
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
          disabled={submitting}
          onClick={validateAndSave}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-ems-accent text-background hover:bg-ems-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save Tour'}
        </button>
      </div>
    </div>
  );
}