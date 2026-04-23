import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
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
  fetchVenueTypesLookup,
  updateAttraction,
  updateTour,
  type ApiAttractionListRow,
  type ApiClass,
  type ApiTourListRow,
  type ApiVenueType,
} from '@/api/attractionToursApi';
import {
  companiesPickerQueryKey,
  fetchCompaniesPickerRows,
  fetchCompanyContacts,
  type ApiCompanyContact,
  type ApiCompanyListRow,
} from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { getPageParams, getTotalPages, getPageRange, PAGE_SIZE } from '@/lib/serverPagination';
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
    const label = fromTour || fromList || `Company #${idStr}`;
    opts.push({ value: idStr, label });
  }
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return [{ value: '', label: '—' }, ...opts];
}

/** Matches Companies page loading + table shell styling. */
function AttractionToursTableSkeleton({ variant }: { variant: 'attractions' | 'tours' }) {
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
        {t.tourManagementCompanyName ?? '—'}
      </div>
    </div>
  );
}

// ─── Shared inline-edit primitive ────────────────────────────────────────────

function InlineField({
  label, value, onChange, placeholder = '—', multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const commit = () => { if (draft !== value) onChange(draft); setEditing(false); };

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">{label}</label>
        <div className="flex items-start gap-1.5">
          {multiline ? (
            <textarea ref={ref as React.Ref<HTMLTextAreaElement>} rows={3} value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setEditing(false)}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none resize-none" />
          ) : (
            <input ref={ref as React.Ref<HTMLInputElement>} value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none" />
          )}
          <div className="flex gap-0.5 mt-0.5 shrink-0">
            <button onClick={commit} className="p-1 text-ems-accent hover:bg-elevated rounded"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-text-muted hover:bg-elevated rounded"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">{label}</label>
      <div onClick={start} title="Click to edit"
        className="group flex items-start gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors">
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
  allowClear = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowClear?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const display =
    options.find((o) => o.value === value)?.label ??
    (value ? value : '—');

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">{label}</label>
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
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">{label}</label>
      <div
        onClick={() => setEditing(true)}
        className="group flex items-center gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
        title="Click to edit"
      >
        <span className="text-sm text-text-primary flex-1">{display}</span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      </div>
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
  onSaved: () => void;
}) {
  const [name, setName] = useState(attraction.attractionName);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(attraction.attractionName);
    setDirty(false);
  }, [attraction.attractionId, attraction.attractionName]);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast('Name is required.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateAttraction(attraction.attractionId, {
        attractionName: name.trim(),
      });
      setDirty(false);
      addToast('Attraction updated.', 'success');
      onSaved();
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
          }}
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
  onSaved: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const contactsQuery = useQuery({
    queryKey: ['tour-management-company-contacts', tour.tourManagementCompanyId],
    queryFn: () => fetchCompanyContacts(tour.tourManagementCompanyId!),
    enabled: !!tour.tourManagementCompanyId,
  });

  // Editable state
  const [tourName, setTourName] = useState(tour.tourName);
  const [attractionId, setAttractionId] = useState(String(tour.attractionId));
  const [classId, setClassId] = useState(String(tour.classId));
  const [tourManagementCompanyId, setTourManagementCompanyId] = useState(
    tour.tourManagementCompanyId != null ? String(tour.tourManagementCompanyId) : '',
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

  useEffect(() => {
    setTourName(tour.tourName);
    setAttractionId(String(tour.attractionId));
    setClassId(String(tour.classId));
    setTourManagementCompanyId(
      tour.tourManagementCompanyId != null ? String(tour.tourManagementCompanyId) : '',
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
    setDirty(false);
  }, [tour.tourId]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
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
        tour.tourManagementCompanyId,
        tour.tourManagementCompanyName,
      ),
    [
      managementCompanyOptions,
      companies,
      tour.tourManagementCompanyId,
      tour.tourManagementCompanyName,
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
    if (!tourName.trim()) {
      addToast('Tour name is required.', 'warning');
      return;
    }
    if (!attractionId || !classId) {
      addToast('Attraction and Genre / Class are required.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateTour(tour.tourId, {
        tourName: tourName.trim(),
        attractionId: Number(attractionId),
        classId: Number(classId),
        tourManagementCompanyId: tourManagementCompanyId
          ? Number(tourManagementCompanyId)
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
      });
      setDirty(false);
      addToast('Tour updated.', 'success');
      onSaved();
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
    setTourManagementCompanyId(
      tour.tourManagementCompanyId != null ? String(tour.tourManagementCompanyId) : '',
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
    setDirty(false);
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
            <InlineField label="Tour Name" value={tourName} onChange={mark(setTourName)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              <InlineSelectField
                label="Attraction"
                value={attractionId}
                onChange={mark(setAttractionId)}
                options={attractionOptions}
              />
              <InlineSelectField
                label="Genre / Class"
                value={classId}
                onChange={mark(setClassId)}
                options={classOptions}
              />
              <InlineSelectField
                label="Tour Management Company"
                value={tourManagementCompanyId}
                onChange={mark(setTourManagementCompanyId)}
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
              <InlineField label="Audience Gender" value={audienceGender} onChange={mark(setAudienceGender)} placeholder="Not set" />
              <InlineField label="Audience Age Range" value={audienceAgeRange} onChange={mark(setAudienceAgeRange)} placeholder="Not set" />
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
            <InlineField label="Tour Insurance Language" value={insuranceLanguage} onChange={mark(setInsuranceLanguage)} placeholder="Not set" multiline />

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
            {!tour.tourManagementCompanyId ? (
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
                      {c.workPhone && <div>{c.workPhone}</div>}
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

export function AttractionToursPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState('Attractions');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
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

  const { offset: attrOffset, limit: attrLimit } = getPageParams(pageTab === 'Attractions' ? page : 1);
  const { offset: tourOffset, limit: tourLimit } = getPageParams(pageTab === 'Tours' ? page : 1);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const attractionsQuery = useQuery({
    queryKey: ['attractions', attrOffset, attrLimit, searchDebounced],
    queryFn: () => fetchAttractions(attrOffset, attrLimit, searchDebounced || undefined),
    placeholderData: (prev) => prev,
    enabled: pageTab === 'Attractions',
  });
  const toursQuery = useQuery({
    queryKey: ['tours', tourOffset, tourLimit, searchDebounced],
    queryFn: () => fetchTours(tourOffset, tourLimit, searchDebounced || undefined),
    placeholderData: (prev) => prev,
    enabled: pageTab === 'Tours',
  });
  /** On the Tours tab, paginated `attractions` is not loaded — fetch a wide pick list for drawer + tour modals. */
  const needToursTabAttractionPicklist =
    pageTab === 'Tours' && (selectedTourId != null || showAddTour || editTour != null);
  const tourDrawerAttractionsQuery = useQuery({
    queryKey: ['attractions', 'tour-drawer-picker', 0, 8000],
    queryFn: async () => (await fetchAttractions(0, 8000, undefined)).data,
    staleTime: 60_000,
    enabled: needToursTabAttractionPicklist,
  });
  /** Classes + venue types only — avoids loading thousands of companies on every visit. */
  const lightLookupsQuery = useQuery({
    queryKey: ['attraction-tours-lookups', 'light'],
    queryFn: async () => {
      const [classes, venueTypes] = await Promise.all([fetchClasses(), fetchVenueTypesLookup()]);
      return { classes, venueTypes };
    },
  });

  const attractionsPage = attractionsQuery.data as ApiPaginatedResponse<import('@/api/attractionToursApi').ApiAttractionListRow> | undefined;
  const toursPage = toursQuery.data as ApiPaginatedResponse<import('@/api/attractionToursApi').ApiTourListRow> | undefined;
  const attractions = attractionsPage?.data ?? [];
  const attractionsForPicker =
    pageTab === 'Tours' && needToursTabAttractionPicklist
      ? (tourDrawerAttractionsQuery.data ?? [])
      : attractions;
  const tours = toursPage?.data ?? [];
  const attractionsTotal = attractionsPage?.total ?? 0;
  const toursTotal = toursPage?.total ?? 0;

  /** Large company picklist only when tour drawer or edit-tour modal needs talent-agency options. */
  const needTourCompanyPicklist =
    editTour != null ||
    (pageTab === 'Tours' &&
      selectedTourId != null &&
      tours.some((t) => t.tourId === selectedTourId));

  const companiesQuery = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 60_000,
    enabled: needTourCompanyPicklist,
  });

  const refetchAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['attractions'] }),
      qc.invalidateQueries({ queryKey: ['tours'] }),
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
    onSuccess: async (_, attractionId) => {
      await refetchAll();
      setPendingDeleteAttraction(null);
      setSelectedAttractionId((cur) => (cur === attractionId ? null : cur));
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

  /** Initial load + server pagination refetch (matches Companies: skeleton until each request finishes). */
  const loading =
    lightLookupsQuery.isPending ||
    (pageTab === 'Attractions' &&
      (attractionsQuery.isPending || attractionsQuery.isFetching)) ||
    (pageTab === 'Tours' && (toursQuery.isPending || toursQuery.isFetching));
  /** Top progress bar when a non-blocking refetch runs (pagination uses full `loading` skeleton). */
  const refreshing = attractionsQuery.isFetching || toursQuery.isFetching;

  const serverTotal = pageTab === 'Attractions' ? attractionsTotal : toursTotal;
  const pageCount = getTotalPages(serverTotal);
  const { rangeStart, rangeEnd } = getPageRange(page, serverTotal);
  const paginated = pageTab === 'Attractions' ? attractions : tours;

  useEffect(() => { setPage(1); }, [searchDebounced, pageTab]);

  const selectedAttraction = selectedAttractionId
    ? attractions.find((a) => a.attractionId === selectedAttractionId) ?? null
    : null;
  const selectedTour = selectedTourId ? tours.find((t) => t.tourId === selectedTourId) ?? null : null;

  const attractionTours = selectedAttraction
    ? tours.filter((t) => t.attractionId === selectedAttraction.attractionId)
    : [];

  const light = lightLookupsQuery.data;
  const classes = light?.classes ?? [];
  const venueTypes = light?.venueTypes ?? [];
  const companies = companiesQuery.data ?? [];

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

      {(attractionsQuery.isError ||
        toursQuery.isError ||
        lightLookupsQuery.isError ||
        (needTourCompanyPicklist && companiesQuery.isError)) && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
          Could not load Attraction-Tours data.{' '}
          {(attractionsQuery.error as Error)?.message ||
            (toursQuery.error as Error)?.message ||
            (lightLookupsQuery.error as Error)?.message ||
            (companiesQuery.error as Error)?.message}
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
                      <th className="text-left py-2.5 px-3">Active Tours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attractions.length === 0 && !attractionsQuery.isError && (
                      <tr>
                        <td colSpan={3} className="py-12 px-3 text-center text-sm text-text-muted">
                          {!searchDebounced
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
              {attractionsTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
                  <p className="tabular-nums">
                    Showing{' '}
                    <span className="text-text-primary font-medium">
                      {rangeStart}–{rangeEnd}
                    </span>{' '}
                    of <span className="text-text-primary font-medium">{attractionsTotal.toLocaleString()}</span>
                    <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
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
                      <th className="text-left py-2.5 px-3">Tour Name</th>
                      <th className="text-left py-2.5 px-3">Attraction</th>
                      <th className="text-left py-2.5 px-3">Class</th>
                      <th className="text-left py-2.5 px-3">Tour Management Company</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tours.length === 0 && !toursQuery.isError && (
                      <tr>
                        <td colSpan={5} className="py-12 px-3 text-center text-sm text-text-muted">
                          {!searchDebounced ? 'No tours found.' : 'No tours match your search.'}
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
                        <td className="py-2.5 px-3 text-text-secondary text-sm">{t.tourManagementCompanyName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {toursTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
                  <p className="tabular-nums">
                    Showing{' '}
                    <span className="text-text-primary font-medium">
                      {rangeStart}–{rangeEnd}
                    </span>{' '}
                    of <span className="text-text-primary font-medium">{toursTotal.toLocaleString()}</span>
                    <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
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
          onSaved={() => void refetchAll()}
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
          onSaved={() => void refetchAll()}
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
      {showAddTour && classes.length > 0 && (pageTab === 'Attractions' ? attractions.length > 0 : tourDrawerAttractionsQuery.isSuccess) && attractionsForPicker.length > 0 && (
        <Modal title="Add Tour" onClose={() => setShowAddTour(false)} width={600} allowContentOverflow>
          <AddTourForm
            attractions={attractionsForPicker}
            classes={classes}
            submitting={createTourMut.isPending}
            onCancel={() => setShowAddTour(false)}
            onSave={(body) => void createTourMut.mutateAsync(body)}
          />
        </Modal>
      )}
      {editTour && (pageTab === 'Attractions' || tourDrawerAttractionsQuery.isSuccess) && (
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
            onSave={(body) => void updateTourMut.mutateAsync({ id: editTour.tourId, body })}
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
  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  const valid = name.trim().length > 0;
  return (
    <div className="space-y-4">
      <FormField label="Attraction Name" required>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
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
          disabled={!valid || submitting}
          onClick={() => onSave({ attractionName: name.trim() })}
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
        initial?.tourManagementCompanyId,
        initial?.tourManagementCompanyName,
      ),
    [
      managementCompanyOptions,
      companies,
      initial?.tourManagementCompanyId,
      initial?.tourManagementCompanyName,
    ],
  );
  const statusOptions = [{ value: '', label: '—' }, ...TOUR_STATUS_OPTIONS];
  const venueTypeOptions = [{ value: '', label: '—' }, ...venueTypes.map((v) => ({ value: String(v.venueTypeId), label: v.venueTypeName }))];

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
    audienceGender: audienceGender.trim() || null,
    audienceAgeRange: audienceAgeRange.trim() || null,
    tourInsuranceLanguage: tourInsuranceLanguage.trim() || null,
    venueTypePreferenceId: venueTypePreferenceId ? Number(venueTypePreferenceId) : null,
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
        <FormField label="Audience Gender">
          <input
            className={inputCls}
            value={audienceGender}
            onChange={(e) => setAudienceGender(e.target.value)}
            maxLength={100}
            placeholder="e.g. All, Female, Male"
          />
        </FormField>
        <FormField label="Audience Age Range">
          <input
            className={inputCls}
            value={audienceAgeRange}
            onChange={(e) => setAudienceAgeRange(e.target.value)}
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
      <FormField label="Tour Insurance Language">
        <textarea
          className={inputCls}
          value={tourInsuranceLanguage}
          onChange={(e) => setTourInsuranceLanguage(e.target.value)}
          rows={3}
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