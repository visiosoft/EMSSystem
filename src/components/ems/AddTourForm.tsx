import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { FormField } from './Primitives';
import { Select2 } from './Select2';
import type { ApiAttractionListRow, ApiClass, CreateTourPayload } from '@/api/attractionToursApi';

/** Where the form is embedded — controls which optional blocks are shown. */
export type AddTourFormVariant = 'project-wizard' | 'attraction-tours';

/** Simplified creation form — full details can be added later from the Tour entry. */
export function AddTourForm({
  variant,
  attractions,
  classes,
  managementCompanyOptions,
  submitting,
  onSave,
  onCancel,
  lockAttractionId,
}: {
  variant: AddTourFormVariant;
  attractions: ApiAttractionListRow[];
  classes: ApiClass[];
  /** Talent agencies only — required for creating a tour. */
  managementCompanyOptions?: { value: string; label: string }[];
  submitting: boolean;
  onSave: (body: CreateTourPayload, bannerFile?: File | null) => void;
  onCancel: () => void;
  /** When set, attraction is fixed (e.g. project wizard) and the attraction picker is hidden. */
  lockAttractionId?: number;
}) {
  const [name, setName] = useState('');
  const [attractionId, setAttractionId] = useState(
    () => (lockAttractionId != null ? String(lockAttractionId) : ''),
  );
  const [classId, setClassId] = useState('');
  const [talentAgencyCompanyId, setTalentAgencyCompanyId] = useState('');
  const [ascap, setAscap] = useState(false);
  const [bmi, setBmi] = useState(false);
  const [sesac, setSesac] = useState(false);
  const [gmr, setGmr] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerInputKey, setBannerInputKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    attractionId?: string;
    classId?: string;
    talentAgencyCompanyId?: string;
  }>({});

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview(null);
      return;
    }
    const u = URL.createObjectURL(bannerFile);
    setBannerPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [bannerFile]);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const attractionOptions = attractions.map((a) => ({
    value: String(a.attractionId),
    label: a.attractionName,
  }));
  const classOptions = classes.map((c) => ({
    value: String(c.classId),
    label: c.className,
  }));

  const lockedAttraction =
    lockAttractionId != null ? attractions.find((a) => a.attractionId === lockAttractionId) : null;

  const showBannerUpload = variant === 'attraction-tours';
  const talentAgencyOptions = managementCompanyOptions ?? [];
  const talentAgencyFieldLabel = variant === 'project-wizard' ? 'Talent Agent' : 'Talent Agency';
  const talentAgencyPlaceholder =
    variant === 'project-wizard' ? 'Select talent agent…' : 'Select talent agency…';

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Fields marked with <span className="text-ems-coral">*</span> are required for every new tour. Optional
        details can be added later from the full tour entry.
      </p>
      {lockAttractionId != null ? (
        <FormField label="Attraction" required>
          <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
            {lockedAttraction?.attractionName ?? 'Attraction'}
          </div>
        </FormField>
      ) : (
        <FormField label="Attraction" required error={fieldErrors.attractionId}>
          <Select2
            options={attractionOptions}
            value={attractionId}
            placeholder="Select attraction…"
            onChange={(v) => {
              setAttractionId(v);
              setFieldErrors((e) => {
                const n = { ...e };
                delete n.attractionId;
                return n;
              });
            }}
          />
        </FormField>
      )}
      <FormField label="Class (genre)" required error={fieldErrors.classId}>
        <Select2
          options={classOptions}
          value={classId}
          placeholder="Select class (genre)…"
          onChange={(v) => {
            setClassId(v);
            setFieldErrors((e) => {
              const n = { ...e };
              delete n.classId;
              return n;
            });
          }}
        />
      </FormField>
      <FormField label={talentAgencyFieldLabel} required error={fieldErrors.talentAgencyCompanyId}>
        <Select2
          options={talentAgencyOptions}
          value={talentAgencyCompanyId}
          placeholder={talentAgencyPlaceholder}
          onChange={(v) => {
            setTalentAgencyCompanyId(v);
            setFieldErrors((e) => {
              const n = { ...e };
              delete n.talentAgencyCompanyId;
              return n;
            });
          }}
        />
        {talentAgencyOptions.length === 0 && (
          <p className="text-[11px] text-text-muted mt-1">
            No companies with type{' '}
            <span className="font-medium text-text-secondary">Talent Agency</span> are loaded yet.
          </p>
        )}
      </FormField>
      <FormField label="Tour Name" required error={fieldErrors.name}>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFieldErrors((e) => {
              const n = { ...e };
              delete n.name;
              return n;
            });
          }}
          maxLength={200}
          placeholder="e.g. World Tour 2025"
          autoFocus
        />
      </FormField>
      <FormField label="Performing rights (ASCAP, BMI, SESAC, GMR)" required>
        <p className="text-[11px] text-text-muted mb-2">
          Each flag is stored on the tour — turn on any PRO memberships that apply.
        </p>
        <div
          className="flex flex-wrap gap-x-6 gap-y-2.5 rounded-md border border-border/80 bg-surface/50 px-3 py-3"
          role="group"
          aria-label="Performing rights licensing"
        >
          {(
            [
              ['add-tour-ascap', 'ASCAP', ascap, setAscap] as const,
              ['add-tour-bmi', 'BMI', bmi, setBmi] as const,
              ['add-tour-sesac', 'SESAC', sesac, setSesac] as const,
              ['add-tour-gmr', 'GMR', gmr, setGmr] as const,
            ] as const
          ).map(([id, label, checked, setChecked]) => (
            <label
              key={id}
              htmlFor={id}
              className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-primary select-none"
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={submitting}
                onChange={(e) => setChecked(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-ems-accent focus:ring-ems-accent focus:ring-offset-0"
              />
              {label}
            </label>
          ))}
        </div>
      </FormField>
      {showBannerUpload && (
        <FormField label="Tour banner image" optional>
          <p className="text-[11px] text-text-muted mb-2">
            JPEG, PNG, WebP, or GIF — max 5 MB. Used on tour and engagement tiles.
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
              }}
            />
            {(bannerPreview || bannerFile) && (
              <div className="flex items-start gap-3">
                {bannerPreview && (
                  <img
                    src={bannerPreview}
                    alt=""
                    className="h-16 w-28 rounded-md border border-border object-cover bg-elevated"
                  />
                )}
                {bannerFile && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setBannerFile(null);
                      setBannerInputKey((k) => k + 1);
                    }}
                    className="text-xs text-ems-accent hover:underline disabled:opacity-50"
                  >
                    Clear image
                  </button>
                )}
              </div>
            )}
            {!bannerFile && (
              <p className="text-[11px] text-text-muted flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                No file selected
              </p>
            )}
          </div>
        </FormField>
      )}
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => {
            setBannerFile(null);
            setBannerInputKey((k) => k + 1);
            setAscap(false);
            setBmi(false);
            setSesac(false);
            setGmr(false);
            onCancel();
          }}
          className="text-text-secondary px-4 py-1.5 text-sm"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            const next: typeof fieldErrors = {};
            const tn = name.trim();
            if (!tn) next.name = 'Tour name is required.';
            else if (tn.length > 200) next.name = 'Tour name must be 200 characters or fewer.';
            if (lockAttractionId == null) {
              const a = Number(attractionId);
              if (!attractionId || !Number.isFinite(a) || a < 1) {
                next.attractionId = 'Attraction is required.';
              }
            }
            const c = Number(classId);
            if (!classId || !Number.isFinite(c) || c < 1) {
              next.classId = 'Class (genre) is required.';
            }
            const talentAgency = Number(talentAgencyCompanyId);
            if (
              !talentAgencyCompanyId ||
              !Number.isFinite(talentAgency) ||
              talentAgency < 1
            ) {
              next.talentAgencyCompanyId = `${talentAgencyFieldLabel} is required.`;
            }
            if (Object.keys(next).length) {
              setFieldErrors(next);
              return;
            }
            setFieldErrors({});
            onSave(
              {
                tourName: tn,
                attractionId: lockAttractionId ?? Number(attractionId),
                classId: Number(classId),
                ascap,
                bmi,
                sesac,
                gmr,
                talentAgencyCompanyId: Number(talentAgencyCompanyId),
                audienceGender: null,
                audienceAgeRange: null,
                tourInsuranceLanguage: null,
                venueTypePreferenceId: null,
              },
              showBannerUpload ? bannerFile : undefined,
            );
          }}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-ems-accent text-background hover:bg-ems-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Create Tour'}
        </button>
      </div>
    </div>
  );
}
