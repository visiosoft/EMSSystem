import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { FormField } from './Primitives';
import { Select2 } from './Select2';
import type { Company } from '@/data/constants';
import type { ApiSeatingType, ApiVenueType } from '@/api/companyApi';
import {
  fetchVenueProfile,
  provisionVenueProfile,
  updateVenueProfile,
} from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';

interface Props {
  company: Company;
  venueTypes: ApiVenueType[];
  seatingTypes: ApiSeatingType[];
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/** API / DB decimals may arrive as numbers; keep controlled inputs as strings. */
function taxRateToFormValue(v: unknown): string {
  if (v == null || v === '') return '';
  return String(v);
}

function trimTaxRatePayload(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

export function CompanyVenueProfilePanel({
  company,
  venueTypes,
  seatingTypes,
  addToast,
}: Props) {
  const qc = useQueryClient();
  const companyId = Number(company.id);

  const vq = useQuery({
    queryKey: ['companies', company.id, 'venue-profile'],
    queryFn: () => fetchVenueProfile(companyId),
    enabled: Number.isFinite(companyId),
  });

  const [venueName, setVenueName] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('0');
  const [salesTaxRate, setSalesTaxRate] = useState('');
  const [taxInCart, setTaxInCart] = useState(false);
  const [insuranceLanguage, setInsuranceLanguage] = useState('');
  const [insurancePolicyCopyRequirements, setInsurancePolicyCopyRequirements] =
    useState('');
  const [venueRelationshipIae, setVenueRelationshipIae] = useState('Standard');
  const [venueTypeId, setVenueTypeId] = useState<string>('');
  const [seatingTypeId, setSeatingTypeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const venueTypeOptions = useMemo(
    () =>
      venueTypes.map((v) => ({
        value: String(v.venueTypeId),
        label: v.venueTypeName,
      })),
    [venueTypes],
  );

  const seatingOptions = useMemo(
    () =>
      seatingTypes.map((s) => ({
        value: String(s.seatingTypeId),
        label: s.seatingName,
      })),
    [seatingTypes],
  );

  useEffect(() => {
    const d = vq.data;
    if (!d || d.missing) return;
    const full = d as Exclude<typeof d, { missing: true }>;
    setVenueName(full.venueName);
    setSeatingCapacity(String(full.seatingCapacity));
    setSalesTaxRate(taxRateToFormValue(full.salesTaxRate));
    setTaxInCart(full.taxInCart);
    setInsuranceLanguage(full.insuranceLanguage ?? '');
    setInsurancePolicyCopyRequirements(full.insurancePolicyCopyRequirements ?? '');
    setVenueRelationshipIae(full.venueRelationshipIae);
    setVenueTypeId(full.venueTypeId != null ? String(full.venueTypeId) : '');
    setSeatingTypeId(full.seatingTypeId != null ? String(full.seatingTypeId) : '');
  }, [vq.data]);

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/90 focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      await provisionVenueProfile(companyId);
      await qc.invalidateQueries({ queryKey: ['companies', company.id, 'venue-profile'] });
      addToast('Venue profile created.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not create venue profile.'), 'error');
    } finally {
      setProvisioning(false);
    }
  };

  const handleSave = async () => {
    const cap = Number.parseInt(seatingCapacity, 10);
    if (!Number.isFinite(cap) || cap < 0) {
      addToast('Seating capacity must be a non-negative number.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateVenueProfile(companyId, {
        venueName: venueName.trim(),
        seatingCapacity: cap,
        salesTaxRate: trimTaxRatePayload(salesTaxRate),
        taxInCart,
        insuranceLanguage: insuranceLanguage.trim() || null,
        insurancePolicyCopyRequirements:
          insurancePolicyCopyRequirements.trim() || null,
        venueRelationshipIae: venueRelationshipIae.trim().slice(0, 100),
        venueTypeId: venueTypeId ? Number(venueTypeId) : null,
        seatingTypeId: seatingTypeId ? Number(seatingTypeId) : null,
      });
      await qc.invalidateQueries({ queryKey: ['companies', company.id, 'venue-profile'] });
      addToast('Venue profile saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save venue profile.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (vq.isLoading) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-text-muted py-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden />
        <span>Loading venue profile…</span>
      </div>
    );
  }

  if (vq.isError) {
    return (
      <p className="text-sm text-ems-coral">
        {(vq.error as Error).message}
      </p>
    );
  }

  const data = vq.data;
  if (!data) return null;

  if (data.missing) {
    return (
      <div className="space-y-4 max-w-xl">
        <p className="text-sm text-text-secondary leading-relaxed">
          A venue profile has not been set up for this company yet. This can happen for
          older venue records. Create the profile so this location can be used as a
          venue on engagements, then add or edit details below.
        </p>
        <button
          type="button"
          onClick={() => void handleProvision()}
          disabled={provisioning}
          className="inline-flex items-center justify-center gap-2 min-w-[10rem] bg-ems-accent text-background text-sm px-4 py-2 rounded-md font-medium disabled:opacity-60"
        >
          {provisioning ? 'Creating…' : 'Create venue profile'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-text-primary tracking-tight">
          Venue profile
        </h3>
      </header>

      <div className="rounded-xl border border-border bg-card/40 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Venue name" required>
            <input
              className={inputCls}
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              maxLength={200}
            />
          </FormField>
          <FormField label="Seating capacity" required>
            <input
              type="number"
              className={inputCls}
              min={0}
              value={seatingCapacity}
              onChange={(e) => setSeatingCapacity(e.target.value)}
            />
          </FormField>
          <FormField label="Sales tax rate">
            <input
              className={inputCls}
              value={salesTaxRate}
              onChange={(e) => setSalesTaxRate(e.target.value)}
              placeholder="e.g. 0.0825"
            />
          </FormField>
          <FormField label="Tax in cart">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={taxInCart}
                onChange={(e) => setTaxInCart(e.target.checked)}
                className="rounded border-border"
              />
              <span>Apply tax in cart</span>
            </label>
          </FormField>
          <FormField label="Venue type">
            <Select2
              options={venueTypeOptions}
              value={venueTypeId}
              onChange={setVenueTypeId}
              placeholder="Select type…"
              allowClear
            />
          </FormField>
          <FormField label="Seating type">
            <Select2
              options={seatingOptions}
              value={seatingTypeId}
              onChange={setSeatingTypeId}
              placeholder="Select seating…"
              allowClear
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="IAE relationship">
              <Select2
                options={[
                  { value: 'CoPro', label: 'CoPro' },
                  { value: 'Rental', label: 'Rental' },
                ]}
                value={venueRelationshipIae}
                onChange={setVenueRelationshipIae}
                placeholder="Select relationship…"
                allowClear
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Insurance language">
              <textarea
                className={`${inputCls} min-h-[72px]`}
                value={insuranceLanguage}
                onChange={(e) => setInsuranceLanguage(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Insurance policy copy requirements">
              <textarea
                className={`${inputCls} min-h-[72px]`}
                value={insurancePolicyCopyRequirements}
                onChange={(e) => setInsurancePolicyCopyRequirements(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] bg-ems-accent text-background text-sm px-4 py-2 rounded-md font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}