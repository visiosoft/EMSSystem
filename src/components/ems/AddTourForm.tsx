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
    String(lockAttractionId ?? attractions[0]?.attractionId ?? ''),
  );
  const [classId, setClassId] = useState(String(classes[0]?.classId ?? ''));

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

  const valid = name.trim().length > 0 && attractionId && classId;

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Enter the essentials now — all other details can be filled in later from the Tour entry.
      </p>
      {lockAttractionId != null ? (
        <FormField label="Attraction" required>
          <div className="text-sm text-text-primary bg-surface px-3 py-1.5 rounded border border-border">
            {lockedAttraction?.attractionName ?? `Attraction #${lockAttractionId}`}
          </div>
        </FormField>
      ) : (
        <FormField label="Attraction" required>
          <Select2 options={attractionOptions} value={attractionId} onChange={setAttractionId} />
        </FormField>
      )}
      <FormField label="Class (genre)" required>
        <Select2 options={classOptions} value={classId} onChange={setClassId} />
      </FormField>
      <FormField label="Tour Name" required>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          disabled={!valid || submitting}
          onClick={() =>
            onSave({
              tourName: name.trim(),
              attractionId: Number(attractionId),
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
            })
          }
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-ems-accent text-background hover:bg-ems-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Create Tour'}
        </button>
      </div>
    </div>
  );
}
