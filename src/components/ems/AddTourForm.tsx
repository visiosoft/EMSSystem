import React, { useState } from 'react';
import { FormField } from './Primitives';
import { Select2 } from './Select2';
import type { ApiAttractionListRow, ApiClass, CreateTourPayload } from '@/api/attractionToursApi';

/** Simplified 3-field creation form — full details can be added later via Edit. */
export function AddTourForm({
  attractions,
  classes,
  submitting,
  onSave,
  onCancel,
  lockAttractionId,
}: {
  attractions: ApiAttractionListRow[];
  classes: ApiClass[];
  submitting: boolean;
  onSave: (body: CreateTourPayload) => void;
  onCancel: () => void;
  /** When set, attraction is fixed (e.g. project wizard) and the attraction picker is hidden. */
  lockAttractionId?: number;
}) {
  const [name, setName] = useState('');
  const [attractionId, setAttractionId] = useState(
    () => (lockAttractionId != null ? String(lockAttractionId) : ''),
  );
  const [classId, setClassId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    attractionId?: string;
    classId?: string;
  }>({});

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

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Enter the essentials now — all other details can be filled in later from the Tour entry.
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
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
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
            if (Object.keys(next).length) {
              setFieldErrors(next);
              return;
            }
            setFieldErrors({});
            onSave({
              tourName: tn,
              attractionId: lockAttractionId ?? Number(attractionId),
              classId: Number(classId),
              ascap: false,
              bmi: false,
              sesac: false,
              gmr: false,
              tourManagementCompanyId: null,
              audienceGender: null,
              audienceAgeRange: null,
              tourInsuranceLanguage: null,
              venueTypePreferenceId: null,
            });
          }}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-ems-accent text-background hover:bg-ems-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Create Tour'}
        </button>
      </div>
    </div>
  );
}
