import React, { useEffect, useState } from 'react';
import { TOUR_TYPE_OR_GENRE_OPTIONS } from '@/data/constants';
import { FormField } from './Primitives';
import { Select2, toObjOptions } from './Select2';
import type { Attraction, Tour, Company, Contact } from '@/data/constants';

export const TOUR_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'ActiveRouting', label: 'Active Routing' },
  { value: 'Announced', label: 'Announced' },
  { value: 'Closed', label: 'Closed' },
];

export interface TourFormProps {
  onSave: (t: Tour) => void;
  onCancel?: () => void;
  initial?: Tour;
  attractions: Attraction[];
  companies: Company[];
  contacts: Contact[];
  wizardMode?: boolean;
  onChange?: (data: Partial<Tour> & { isValid: boolean }) => void;
}

/** Prototype wizard / demo tour form (not wired to dbo.Tour). Used by Projects flow. */
export function TourForm({
  onSave,
  onCancel,
  initial,
  attractions,
  companies,
  contacts,
  wizardMode = false,
  onChange,
}: TourFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [attractionId, setAttractionId] = useState(initial?.attractionId || attractions[0]?.id || '');
  const [status, setStatus] = useState(initial?.status || 'ActiveRouting');
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');

  const talentPool = contacts.filter((c) =>
    companies.find((co) => co.id === c.companyId && co.type === 'TalentAgency'),
  );
  const talentOptions = toObjOptions(talentPool, (c) => `${c.firstName} ${c.lastName}`);

  const [talentAgentContactId, setTalentAgentContactId] = useState(
    initial?.talentAgentContactId || talentPool[0]?.id || '',
  );
  const [tourTypeOrGenre, setTourTypeOrGenre] = useState(
    initial?.tourTypeOrGenre || TOUR_TYPE_OR_GENRE_OPTIONS[0]?.value || '',
  );

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  const attractionOptions = toObjOptions(attractions, (a) => a.name);

  const isValid = !!name.trim() && !!startDate && !!endDate;

  useEffect(() => {
    if (wizardMode && onChange) {
      onChange({
        attractionId,
        name,
        status,
        startDate,
        endDate,
        talentAgentContactId,
        tourTypeOrGenre,
        isValid,
      });
    }
  }, [
    name,
    attractionId,
    status,
    startDate,
    endDate,
    talentAgentContactId,
    tourTypeOrGenre,
    wizardMode,
    onChange,
    isValid,
  ]);

  const buildTour = (): Tour => ({
    id: initial?.id || `tour-${Date.now()}`,
    attractionId,
    name,
    status,
    startDate,
    endDate,
    talentAgentContactId,
    tourTypeOrGenre,
    dmaIds: initial?.dmaIds || [],
    splitPct: initial?.splitPct || null,
    breakeven: initial?.breakeven || null,
    radiusMiles: initial?.radiusMiles || 0,
    radiusDays: initial?.radiusDays || 0,
    stageWidth: initial?.stageWidth || null,
    stageDepth: initial?.stageDepth || null,
    riggingLoad: initial?.riggingLoad || null,
    trucks: initial?.trucks || null,
    crew: initial?.crew || null,
    technicalRider: initial?.technicalRider || '',
    hospitalityRider: initial?.hospitalityRider || '',
    dressingRooms: initial?.dressingRooms || null,
    contacts: initial?.contacts || [],
  });

  return (
    <div className="space-y-4">
      <FormField label="Tour Name" required>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. World Tour 2025"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Artist / Attraction">
          <Select2 options={attractionOptions} value={attractionId} onChange={setAttractionId} />
        </FormField>
        <FormField label="Tour Status">
          <Select2 options={TOUR_STATUS_OPTIONS} value={status} onChange={setStatus} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Start Date" required>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="End Date" required>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Talent Agent">
          <Select2
            options={talentOptions}
            value={talentAgentContactId}
            onChange={setTalentAgentContactId}
            placeholder="Select agent..."
          />
        </FormField>
        <FormField label="Tour Type or Genres">
          <Select2 options={TOUR_TYPE_OR_GENRE_OPTIONS} value={tourTypeOrGenre} onChange={setTourTypeOrGenre} />
        </FormField>
      </div>

      {!wizardMode && (
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-text-secondary px-4 py-1.5 text-sm hover:text-text-primary"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(buildTour())}
            disabled={!isValid}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isValid ? 'bg-ems-accent text-background hover:bg-ems-accent/80' : 'bg-elevated text-text-muted cursor-not-allowed'
            }`}
          >
            Save Tour
          </button>
        </div>
      )}
    </div>
  );
}
