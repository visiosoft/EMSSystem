/**
 * Simplified Create Project Form - Uses API data
 * 
 * To use: Import this in ProjectsPage.tsx and replace CreateProjectWizard
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTours } from '@/api/attractionToursApi';
import { fetchAttractions } from '@/api/attractionToursApi';
import { Modal, FormField } from './Primitives';
import { Select2 } from './Select2';
import { PROJECT_STAGE_VALUES, type ProjectStage, type CreateProjectPayload } from '@/api/projectApi';

const PROJECT_STAGE_OPTIONS = PROJECT_STAGE_VALUES.map((v) => ({
  value: v,
  label:
    v === 'OffersSent'
      ? 'Offers Sent'
      : v === 'PartiallyBooked'
      ? 'Partially Booked'
      : v === 'FullyBooked'
      ? 'Fully Booked'
      : v,
}));

interface Props {
  onClose: () => void;
  onSave: (payload: CreateProjectPayload) => Promise<void>;
}

export function SimpleCreateProjectForm({ onClose, onSave }: Props) {
  const [tourId, setTourId] = useState('');
  const [projectStage, setProjectStage] = useState<ProjectStage>('Active');
  const [createdBy, setCreatedBy] = useState('');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toursQuery = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
  });

  const attractionsQuery = useQuery({
    queryKey: ['attractions'],
    queryFn: fetchAttractions,
  });

  const tours = toursQuery.data || [];
  const attractions = attractionsQuery.data || [];

  const handleSubmit = async () => {
    if (!tourId) return;
    
    setSaving(true);
    try {
      await onSave({
        tourId: Number(tourId),
        projectStage,
        createdBy: createdBy.trim() || null,
        name: projectName.trim() || null,
        notes: notes.trim() || null,
        venues: [],
      });
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setSaving(false);
    }
  };

  const tourOptions = tours.map((t) => {
    const attraction = attractions.find((a) => a.attractionId === t.attractionId);
    return {
      value: String(t.tourId),
      label: `${attraction?.attractionName || 'Unknown'} - ${t.tourName}`,
    };
  });

  return (
    <Modal title="Create Project" onClose={onClose} width={600}>
      <div className="space-y-4">
        <div className="rounded-lg border border-border/50 bg-elevated/30 px-4 py-3 space-y-3">
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide">
            Required Fields
          </p>
          
          <FormField label="Tour" required>
            <Select2
              options={[{ value: '', label: 'Select tour...' }, ...tourOptions]}
              value={tourId}
              onChange={setTourId}
              placeholder="Select tour..."
            />
          </FormField>

          <FormField label="Project Stage" required>
            <Select2
              options={PROJECT_STAGE_OPTIONS}
              value={projectStage}
              onChange={(v) => setProjectStage(v as ProjectStage)}
            />
          </FormField>
        </div>

        <div className="rounded-lg border border-dashed border-border px-4 py-3 space-y-3">
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide">
            Optional Fields
          </p>

          <FormField label="Project Name">
            <input
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Spring 2025 Tour"
            />
          </FormField>

          <FormField label="Created By">
            <input
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Your name"
              maxLength={200}
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none focus:outline-none focus:border-ems-accent"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-text-secondary px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tourId || saving}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tourId && !saving
                ? 'bg-ems-accent hover:bg-ems-accent/80 text-background'
                : 'bg-elevated text-text-muted cursor-not-allowed'
            }`}
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
