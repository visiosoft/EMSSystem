import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  TabBar,
  Drawer,
  Modal,
  FormField,
  ActionMenu,
  StatusBadge,
} from './Primitives';
import { Select2, toOptions } from './Select2';
import type { Company, Contact } from '@/data/constants';
import { useAddressAutofill } from '@/hooks/useAddressAutofill';
import { clearFormFieldError, clearFormFieldErrors } from '@/lib/clearFormFieldError';
import {
  COUNTRY_NAME_FORMAT_USER_MESSAGE,
  isValidAddressNameText,
  isValidCountryName,
  sanitizeCityStateInput,
  sanitizeCountryInput,
} from '@/lib/countryField';
import { useCompanyPlaceSearch } from '@/hooks/useCompanyPlaceSearch';
import type { PlaceDetailsResult } from '@/lib/googlePlaces';
import {
  createCompany,
  createCompanyContact,
  deleteCompany,
  deleteContactAssignment,
  companiesApiQueryKey,
  companiesServerSearchQueryKeyPrefix,
  COMPANIES_PICKER_LIMIT,
  type ApiPaginatedResponse,
  type ApiCompanyContact,
  fetchCompanies,
  fetchCompanyContacts,
  fetchCompanyEngagements,
  fetchDmaByPostal,
  fetchLookups,
  updateCompany,
  updateContactAssignment,
  type ApiCompanyListRow,
  type ApiDepartment,
  type ApiRole,
  type ApiSeatingType,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '@/api/companyApi';
import {
  upsertInList,
  removeFromList,
  removeQueriesByPrefix,
} from '@/api/cacheHelpers';
import { mapApiCompanyToCompany } from './companyMapping';
import { CompanyVenueProfilePanel } from './CompanyVenueProfilePanel';
import { ContactPhoneRow } from './ContactPhoneRow';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/contactPhoneOptions';
import {
  type PhoneCountrySelection,
  parsePhoneFieldValue,
  tryE164FromDisplay,
  PHONE_INVALID_MESSAGE,
} from '@/lib/contactPhoneField';
import { Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
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
import { friendlyApiError } from '@/lib/friendlyApiError';
import { getPageParams, getTotalPages, getPageRange, PAGE_SIZE } from '@/lib/serverPagination';
import { clampToMaxLen, COMPANY_FORM } from '@/lib/companyFormLimits';

interface Props {
  onNavigate?: (view: string, data?: unknown) => void;
  addToast: (
    msg: string,
    type: 'success' | 'error' | 'warning' | 'info',
  ) => void;
}

const overviewLabelCls = 'text-text-muted text-xs';
const overviewValueCls = 'text-text-primary mt-0.5';

function renderPhysicalAddressValue(c: Company) {
  const hasPhysical = !!(
    c.physicalStreet ||
    c.physicalCity ||
    c.physicalState ||
    c.physicalPostalCode ||
    c.physicalCountry
  );
  if (hasPhysical) {
    const cityState = [c.physicalCity, c.physicalState].filter(Boolean).join(', ');
    const line2 = [cityState, c.physicalPostalCode].filter(Boolean).join(' ');
    return (
      <div className={overviewValueCls}>
        {c.physicalStreet ? (
          <>
            {c.physicalStreet}
            <br />
          </>
        ) : null}
        {line2 ? (
          <>
            {line2}
            <br />
          </>
        ) : null}
        {c.physicalCountry || null}
      </div>
    );
  }
  if (c.city || c.state) {
    return (
      <div className={overviewValueCls}>
        {[c.city, c.state].filter(Boolean).join(', ')}
      </div>
    );
  }
  return <div className={`${overviewValueCls} text-text-muted`}>—</div>;
}

function renderMailingAddressValue(c: Company) {
  const hasMailing = !!(
    c.mailingStreet ||
    c.mailingCity ||
    c.mailingState ||
    c.mailingPostalCode ||
    c.mailingCountry
  );
  if (hasMailing) {
    const cityState = [c.mailingCity, c.mailingState].filter(Boolean).join(', ');
    const line2 = [cityState, c.mailingPostalCode].filter(Boolean).join(' ');
    return (
      <div className={overviewValueCls}>
        {c.mailingStreet ? (
          <>
            {c.mailingStreet}
            <br />
          </>
        ) : null}
        {line2 ? (
          <>
            {line2}
            <br />
          </>
        ) : null}
        {c.mailingCountry || null}
      </div>
    );
  }
  return renderPhysicalAddressValue(c);
}

// ─── Inline edit primitives ───────────────────────────────────────────────────

/** Google place line: undefined/null/whitespace → "" (no carry-over of old company data). */
function placeAddressField(v: string | undefined | null): string {
  if (v == null) return '';
  return v.trim();
}

function InlineEditField({
  label, value, onChange, placeholder = '—', multiline = false, required, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const commit = () => { if (draft !== value) onChange(draft); setEditing(false); };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">
          {label}
          {required && <span className="text-ems-coral ml-0.5">*</span>}
        </label>
        <div className="flex items-start gap-1.5">
          {multiline ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={3}
              value={draft}
              maxLength={maxLength}
              onChange={(e) => {
                const v = e.target.value;
                setDraft(
                  maxLength != null ? clampToMaxLen(v, maxLength) : v,
                );
              }}
              onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none resize-none"
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              value={draft}
              maxLength={maxLength}
              onChange={(e) => {
                const v = e.target.value;
                setDraft(
                  maxLength != null ? clampToMaxLen(v, maxLength) : v,
                );
              }}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              className="flex-1 bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
            />
          )}
          <div className="flex gap-0.5 mt-0.5 shrink-0">
            <button onClick={commit} title="Save field" className="p-1 text-ems-accent hover:bg-elevated rounded transition-colors"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={cancel} title="Cancel" className="p-1 text-text-muted hover:bg-elevated rounded transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">
        {label}
        {required && <span className="text-ems-coral ml-0.5">*</span>}
      </label>
      <div
        onClick={start}
        className="group flex items-start gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
        title="Click to edit"
      >
        <span className={`text-sm flex-1 ${value ? 'text-text-primary' : 'text-text-muted italic'}`}>
          {value || placeholder}
        </span>
        <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

function InlineSelectField({
  label, value, onChange, options, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const display = (options.find(o => o.value === value)?.label ?? value) || '—';

  if (editing) {
    return (
      <div>
        <label className="text-xs text-text-muted block mb-0.5">
          {label}
          {required && <span className="text-ems-coral ml-0.5">*</span>}
        </label>
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <Select2 options={options} value={value} onChange={v => { onChange(v); setEditing(false); }} />
          </div>
          <button onClick={() => setEditing(false)} className="p-1 text-text-muted hover:bg-elevated rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-text-muted block mb-0.5">
        {label}
        {required && <span className="text-ems-coral ml-0.5">*</span>}
      </label>
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

// ─── Inline-editable Overview tab ────────────────────────────────────────────

function InlineEditableOverview({
  company, companyTypes, addToast, onSaved,
}: {
  company: Company;
  companyTypes: { companyTypeId: number; companyTypeName: string }[];
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  /** Receives the fresh list row returned by PATCH /companies/:id so the parent can patch its cache. */
  onSaved: (row: ApiCompanyListRow) => void | Promise<void>;
}) {
  const [name, setName]             = useState(company.name);
  const [typeId, setTypeId]         = useState(company.companyTypeId != null ? String(company.companyTypeId) : '');
  const [physStreet, setPhysStreet] = useState(company.physicalStreet ?? '');
  const [physCity, setPhysCity]     = useState(company.physicalCity ?? company.city ?? '');
  const [physState, setPhysState]   = useState(company.physicalState ?? company.state ?? '');
  const [physPostal, setPhysPostal] = useState(company.physicalPostalCode ?? '');
  const [physCountry, setPhysCountry] = useState(company.physicalCountry ?? 'USA');
  const [mailStreet, setMailStreet] = useState(company.mailingStreet ?? '');
  const [mailCity, setMailCity]     = useState(company.mailingCity ?? '');
  const [mailState, setMailState]   = useState(company.mailingState ?? '');
  const [mailPostal, setMailPostal] = useState(company.mailingPostalCode ?? '');
  const [mailCountry, setMailCountry] = useState(
    company.mailingCountry ?? company.physicalCountry ?? 'USA',
  );
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [inlineSaveErrors, setInlineSaveErrors] = useState<string[]>([]);
  const [resolvedDma, setResolvedDma] = useState<string | null>(company.dmaMarketName ?? null);
  const [dmaLookupBusy, setDmaLookupBusy] = useState(false);

  /** True only when the effective mailing line differs from physical and needs its own full row + validation. */
  const sameMailingAsPhysical = useMemo(() => {
    const t0 = (s: string) => s.trim();
    const pick = (mail: string, phys: string) => t0(mail) || t0(phys);
    return (
      pick(mailStreet, physStreet) === t0(physStreet) &&
      pick(mailCity, physCity) === t0(physCity) &&
      pick(mailState, physState) === t0(physState) &&
      pick(mailPostal, physPostal) === t0(physPostal) &&
      pick(mailCountry, physCountry) === t0(physCountry)
    );
  }, [
    physStreet, physCity, physState, physPostal, physCountry,
    mailStreet, mailCity, mailState, mailPostal, mailCountry,
  ]);

  const separateMailing = !sameMailingAsPhysical;

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    setInlineSaveErrors([]);
  };

  // Google Places: replace the whole address from the new place only. Per-field
  // empties (no street, no postal, etc.) render as empty fields, not prior company data.
  const onPlaceResolved = useCallback((details: PlaceDetailsResult) => {
    const placeName = details.placeName?.trim();
    if (placeName) setName(clampToMaxLen(placeName, COMPANY_FORM.companyName));
    setPhysStreet(
      clampToMaxLen(placeAddressField(details.physical.street), COMPANY_FORM.addressLine1),
    );
    setPhysCity(
      sanitizeCityStateInput(
        placeAddressField(details.physical.city),
        COMPANY_FORM.city,
      ),
    );
    setPhysState(
      sanitizeCityStateInput(
        placeAddressField(details.physical.state),
        COMPANY_FORM.stateProvince,
      ),
    );
    setPhysPostal(
      clampToMaxLen(placeAddressField(details.physical.postalCode), COMPANY_FORM.postalCode),
    );
    setPhysCountry(sanitizeCountryInput(placeAddressField(details.physical.country)));
    setMailStreet(
      clampToMaxLen(placeAddressField(details.mailing.street), COMPANY_FORM.addressLine1),
    );
    setMailCity(
      sanitizeCityStateInput(
        placeAddressField(details.mailing.city),
        COMPANY_FORM.city,
      ),
    );
    setMailState(
      sanitizeCityStateInput(
        placeAddressField(details.mailing.state),
        COMPANY_FORM.stateProvince,
      ),
    );
    setMailPostal(
      clampToMaxLen(placeAddressField(details.mailing.postalCode), COMPANY_FORM.postalCode),
    );
    setMailCountry(sanitizeCountryInput(placeAddressField(details.mailing.country)));
    setDirty(true);
    setNameEditing(false);
    setInlineSaveErrors([]);
  }, []);

  const companyPlace = useCompanyPlaceSearch({ query: name, onPlaceResolved });

  // DMA auto-resolution from postal code
  useEffect(() => {
    let cancelled = false;
    const pc = physPostal.trim();
    if (pc.length < 3) {
      setDmaLookupBusy(false);
      setResolvedDma(null);
      return;
    }
    const run = async () => {
      setDmaLookupBusy(true);
      try {
        const row = await fetchDmaByPostal(pc);
        if (!cancelled) setResolvedDma(row ? row.marketName : null);
      } catch {
        if (!cancelled) setResolvedDma(null);
      } finally {
        if (!cancelled) setDmaLookupBusy(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [physPostal, physCountry]);

  const typeOptions = companyTypes.map(t => ({ value: String(t.companyTypeId), label: t.companyTypeName }));

  const discard = () => {
    setName(company.name); setTypeId(company.companyTypeId != null ? String(company.companyTypeId) : '');
    setPhysStreet(company.physicalStreet ?? ''); setPhysCity(company.physicalCity ?? company.city ?? '');
    setPhysState(company.physicalState ?? company.state ?? ''); setPhysPostal(company.physicalPostalCode ?? '');
    setPhysCountry(company.physicalCountry ?? 'USA'); setMailStreet(company.mailingStreet ?? '');
    setMailCity(company.mailingCity ?? ''); setMailState(company.mailingState ?? '');
    setMailPostal(company.mailingPostalCode ?? ''); setMailCountry(company.mailingCountry ?? company.physicalCountry ?? 'USA');
    setResolvedDma(company.dmaMarketName ?? null);
    setDirty(false);
    setInlineSaveErrors([]);
  };

  const collectEditCompanyErrors = useCallback((): string[] => {
    const M = COMPANY_FORM;
    const e: string[] = [];
    const n = name.trim();
    if (!n) e.push('Company name is required.');
    else if (n.length > M.companyName) e.push(`Company name must be ${M.companyName} characters or fewer.`);
    if (!typeId) e.push('Company type is required.');
    if (!physStreet.trim()) e.push('Physical street is required.');
    else if (physStreet.trim().length > M.addressLine1) e.push(`Physical street must be ${M.addressLine1} characters or fewer.`);
    if (!physCity.trim()) e.push('Physical city is required.');
    else if (physCity.trim().length > M.city) e.push(`Physical city must be ${M.city} characters or fewer.`);
    else if (!isValidAddressNameText(physCity, M.city)) {
      e.push(`Physical city: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
    }
    if (!physState.trim()) e.push('Physical state or province is required.');
    else if (physState.trim().length > M.stateProvince) e.push(`Physical state or province must be ${M.stateProvince} characters or fewer.`);
    else if (!isValidAddressNameText(physState, M.stateProvince)) {
      e.push(`Physical state or province: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
    }
    if (!physPostal.trim()) e.push('Physical postal code is required.');
    else if (physPostal.trim().length > M.postalCode) e.push(`Physical postal code must be ${M.postalCode} characters or fewer.`);
    if (!physCountry.trim()) e.push('Physical country is required.');
    else if (physCountry.trim().length > M.country) e.push(`Physical country must be ${M.country} characters or fewer.`);
    else if (!isValidCountryName(physCountry)) {
      e.push(`Physical country: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
    }
    // DMA* is shown as required: block save when nothing resolves and we cannot keep dbo.dmaid.
    const pTrim = physPostal.trim();
    const samePostalAsLoaded = pTrim === (company.physicalPostalCode ?? '').trim();
    const canKeepExistingDma =
      samePostalAsLoaded &&
      typeof company.dmaId === 'number' &&
      company.dmaId > 0;
    if (pTrim.length >= 3) {
      if (!dmaLookupBusy && !resolvedDma && !canKeepExistingDma) {
        e.push(
          'DMA is required: this physical postal code does not match any market in the DMA data. Use a different postal (as in the DMA list), or leave the physical postal code unchanged to keep this company’s existing DMA (when it has one).',
        );
      }
    } else if (pTrim.length > 0 && !canKeepExistingDma) {
      e.push(
        'Use a physical postal code of at least 3 characters so a DMA can be found, or leave the postal code unchanged to keep the existing DMA.',
      );
    }
    if (separateMailing) {
      if (!mailStreet.trim()) e.push('Mailing street is required when a separate mailing address is used.');
      else if (mailStreet.trim().length > M.addressLine1) e.push(`Mailing street must be ${M.addressLine1} characters or fewer.`);
      if (!mailCity.trim()) e.push('Mailing city is required when a separate mailing address is used.');
      else if (mailCity.trim().length > M.city) e.push(`Mailing city must be ${M.city} characters or fewer.`);
      else if (!isValidAddressNameText(mailCity, M.city)) {
        e.push(`Mailing city: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
      }
      if (!mailState.trim()) e.push('Mailing state or province is required when a separate mailing address is used.');
      else if (mailState.trim().length > M.stateProvince) e.push(`Mailing state or province must be ${M.stateProvince} characters or fewer.`);
      else if (!isValidAddressNameText(mailState, M.stateProvince)) {
        e.push(`Mailing state or province: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
      }
      if (!mailPostal.trim()) e.push('Mailing postal code is required when a separate mailing address is used.');
      else if (mailPostal.trim().length > M.postalCode) e.push(`Mailing postal code must be ${M.postalCode} characters or fewer.`);
      if (!mailCountry.trim()) e.push('Mailing country is required when a separate mailing address is used.');
      else if (mailCountry.trim().length > M.country) e.push(`Mailing country must be ${M.country} characters or fewer.`);
      else if (!isValidCountryName(mailCountry)) {
        e.push(`Mailing country: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`);
      }
    }
    return e;
  }, [
    name, typeId, physStreet, physCity, physState, physPostal, physCountry,
    separateMailing, mailStreet, mailCity, mailState, mailPostal, mailCountry,
    company.dmaId, company.physicalPostalCode, resolvedDma, dmaLookupBusy,
  ]);

  const handleSave = async () => {
    const errs = collectEditCompanyErrors();
    if (errs.length) {
      setInlineSaveErrors(errs);
      return;
    }
    setInlineSaveErrors([]);
    setSaving(true);
    try {
      const pc = physPostal.trim();
      const dmaFromLookup = pc.length >= 3 ? await fetchDmaByPostal(pc) : null;
      const previousPostal = (company.physicalPostalCode ?? '').trim();
      const postalUnchanged = pc === previousPostal;
      const dmaIdToSend =
        dmaFromLookup?.dmaid != null
          ? dmaFromLookup.dmaid
          : postalUnchanged && typeof company.dmaId === 'number' && company.dmaId > 0
            ? company.dmaId
            : undefined;

      if (dmaIdToSend == null || !Number.isFinite(dmaIdToSend) || dmaIdToSend <= 0) {
        setInlineSaveErrors([
          'A valid DMA is required. The physical postal code and country did not match any DMA, and there is no stored DMA to keep. Use a combination that exists in the DMA data, or leave the physical postal code unchanged to keep the company’s current DMA (when it has one).',
        ]);
        return;
      }

      const M = COMPANY_FORM;
      const updated = await updateCompany(Number(company.id), {
        companyName: name.trim().slice(0, M.companyName),
        companyTypeId: Number(typeId),
        dmaId: dmaIdToSend,
        physical: {
          addressLine1: physStreet.trim().slice(0, M.addressLine1),
          addressLine2: null,
          city: physCity.trim().slice(0, M.city),
          stateProvince: physState.trim().slice(0, M.stateProvince),
          postalCode: physPostal.trim().slice(0, M.postalCode),
          country: physCountry.trim().slice(0, M.country),
        },
        mailingSameAsPhysical: !separateMailing,
        mailing: separateMailing ? {
          addressLine1: mailStreet.trim().slice(0, M.addressLine1),
          addressLine2: null,
          city: mailCity.trim().slice(0, M.city),
          stateProvince: mailState.trim().slice(0, M.stateProvince),
          postalCode: mailPostal.trim().slice(0, M.postalCode),
          country: mailCountry.trim().slice(0, M.country),
        } : undefined,
      });
      await Promise.resolve(onSaved(updated));
      setDirty(false);
      setInlineSaveErrors([]);
      addToast('Company updated successfully.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not update company.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      {/* Edit hint */}
      <p className="flex items-center gap-1.5 text-[11px] text-text-muted mb-4 select-none">
        <Pencil className="h-3 w-3 shrink-0" />
        Click any field to edit it inline
      </p>

      {inlineSaveErrors.length > 0 && (
        <div
          className="mb-4 text-sm bg-ems-coral-dim border border-ems-coral/20 rounded-md px-3 py-2 text-ems-coral"
          role="alert"
        >
          <p className="text-xs font-medium text-text-primary mb-1.5">Please correct the following:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-xs">
            {inlineSaveErrors.map((msg, i) => (
              <li key={`${i}-${msg}`}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6 pb-2">
        {/* Name with Google Places autocomplete */}
        <div className="border-b border-border/80 pb-5">
          {nameEditing ? (
            <div>
              <label className="text-xs text-text-muted block mb-0.5">
                Company Name
                <span className="text-ems-coral ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  className="w-full cursor-text bg-surface border border-ems-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
                  value={name}
                  maxLength={COMPANY_FORM.companyName}
                  onChange={(e) => {
                    setName(clampToMaxLen(e.target.value, COMPANY_FORM.companyName));
                    setDirty(true);
                    setInlineSaveErrors([]);
                    companyPlace.onNameInput();
                  }}
                  onFocus={companyPlace.onNameFocus}
                  onBlur={companyPlace.onNameBlur}
                  placeholder="Search venue or address…"
                  autoComplete="off"
                  spellCheck={false}
                />
                {companyPlace.listVisible && (
                  <div
                    className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded shadow-lg max-h-56 overflow-auto"
                    onMouseDown={(e) => e.preventDefault()}
                    role="listbox"
                    aria-label="Place suggestions"
                  >
                    {companyPlace.loading && (
                      <div
                        className="px-3 py-2.5 text-xs text-text-muted flex items-center gap-2"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-ems-accent"
                          aria-hidden
                        />
                        Searching…
                      </div>
                    )}
                    {!companyPlace.loading && companyPlace.suggestions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-muted">
                        No matching places — try a different name.
                      </div>
                    )}
                    {!companyPlace.loading &&
                      companyPlace.suggestions.map((s) => (
                        <button
                          key={s.placeId}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-elevated text-sm text-text-primary"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            companyPlace.selectPrediction(s);
                          }}
                        >
                          {s.description}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Search for a venue/address to auto-fill all address fields.
              </p>
              <div className="flex gap-0.5 mt-2">
                <button onClick={() => setNameEditing(false)} title="Done" className="p-1 text-ems-accent hover:bg-elevated rounded transition-colors"><Check className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => { setName(company.name); setNameEditing(false); }}
                  title="Cancel"
                  className="p-1 text-text-muted hover:bg-elevated rounded transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-text-muted block mb-0.5">
                Company Name
                <span className="text-ems-coral ml-0.5">*</span>
              </label>
              <div
                onClick={() => setNameEditing(true)}
                className="group flex items-start gap-2 cursor-pointer py-0.5 px-1.5 -mx-1.5 rounded-md hover:bg-elevated transition-colors"
                title="Click to edit"
              >
                <span className={`text-sm flex-1 ${name ? 'text-text-primary' : 'text-text-muted italic'}`}>
                  {name || '—'}
                </span>
                <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Type + DMA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
          <InlineSelectField
            label="Company Type"
            value={typeId}
            onChange={mark(setTypeId)}
            options={typeOptions}
            required
          />
          <div>
            <span className="text-xs text-text-muted">
              DMA
              <span className="text-ems-coral ml-0.5">*</span>
            </span>
            <div className="text-sm text-text-primary mt-0.5 flex items-center gap-1.5">
              {dmaLookupBusy && <Loader2 className="h-3 w-3 animate-spin text-text-muted" />}
              {resolvedDma ?? '—'}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Auto-resolved from postal code.</p>
          </div>
        </div>

        {/* Physical Address */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide border-b border-border/60 pb-1.5">
            Physical Address
          </h4>
          <InlineEditField
            label="Street"
            value={physStreet}
            onChange={mark(setPhysStreet)}
            placeholder="Not set"
            required
            maxLength={COMPANY_FORM.addressLine1}
          />
          <div className="grid grid-cols-2 gap-4">
            <InlineEditField
              label="City"
              value={physCity}
              onChange={mark((v) =>
                setPhysCity(sanitizeCityStateInput(v, COMPANY_FORM.city)),
              )}
              placeholder="Not set"
              required
              maxLength={COMPANY_FORM.city}
            />
            <InlineEditField
              label="State / Province"
              value={physState}
              onChange={mark((v) =>
                setPhysState(
                  sanitizeCityStateInput(v, COMPANY_FORM.stateProvince),
                ),
              )}
              placeholder="Not set"
              required
              maxLength={COMPANY_FORM.stateProvince}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InlineEditField
              label="Postal Code"
              value={physPostal}
              onChange={mark(setPhysPostal)}
              placeholder="Not set"
              required
              maxLength={COMPANY_FORM.postalCode}
            />
            <InlineEditField
              label="Country"
              value={physCountry}
              onChange={mark((v) => setPhysCountry(sanitizeCountryInput(v)))}
              required
              maxLength={COMPANY_FORM.country}
            />
          </div>
        </div>

        {/* Mailing Address */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide border-b border-border/60 pb-1.5">
            Mailing Address
            {separateMailing && <span className="text-ems-coral font-normal normal-case"> *</span>}
          </h4>
          {separateMailing && (
            <p className="text-[11px] text-text-muted -mt-1">
              This mailing line differs from physical: fill all fields. Empty fields inherit the physical line for
              comparison; matching physical on every line stays a single address.
            </p>
          )}
          <InlineEditField
            label="Street"
            value={mailStreet}
            onChange={mark(setMailStreet)}
            placeholder="Same as physical"
            required={separateMailing}
            maxLength={COMPANY_FORM.addressLine1}
          />
          <div className="grid grid-cols-2 gap-4">
            <InlineEditField
              label="City"
              value={mailCity}
              onChange={mark((v) =>
                setMailCity(sanitizeCityStateInput(v, COMPANY_FORM.city)),
              )}
              placeholder="Same as physical"
              required={separateMailing}
              maxLength={COMPANY_FORM.city}
            />
            <InlineEditField
              label="State / Province"
              value={mailState}
              onChange={mark((v) =>
                setMailState(
                  sanitizeCityStateInput(v, COMPANY_FORM.stateProvince),
                ),
              )}
              placeholder="Same as physical"
              required={separateMailing}
              maxLength={COMPANY_FORM.stateProvince}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InlineEditField
              label="Postal Code"
              value={mailPostal}
              onChange={mark(setMailPostal)}
              placeholder="Same as physical"
              required={separateMailing}
              maxLength={COMPANY_FORM.postalCode}
            />
            <InlineEditField
              label="Country"
              value={mailCountry}
              onChange={mark((v) => setMailCountry(sanitizeCountryInput(v)))}
              placeholder="Same as physical"
              required={separateMailing}
              maxLength={COMPANY_FORM.country}
            />
          </div>
        </div>
      </div>

      {/* Sticky save bar — only visible when dirty */}
      {dirty && (
        <div className="sticky bottom-0 -mx-4 px-4 py-3 mt-4 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-between gap-3 z-10">
          <span className="text-xs text-text-secondary flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ems-accent inline-block animate-pulse" />
            Unsaved changes
          </span>
          <div className="flex gap-2">
            <button
              type="button" onClick={discard} disabled={saving}
              className="text-text-secondary text-xs px-3 py-1.5 hover:text-text-primary rounded-md hover:bg-elevated transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button" onClick={() => void handleSave()} disabled={saving}
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

function EngagementsTab({ companyId }: { companyId: string }) {
  const q = useQuery({
    queryKey: ['companies', companyId, 'engagements'],
    queryFn: () => fetchCompanyEngagements(Number(companyId)),
    enabled: Number.isFinite(Number(companyId)),
  });
  if (q.isLoading) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-text-muted py-2"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden />
        <span>Loading engagements…</span>
      </div>
    );
  }
  if (q.isError) {
    return (
      <p className="text-sm text-ems-coral">{(q.error as Error).message}</p>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No engagements are linked to this company yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.engagementId} className="border border-border rounded-md p-3">
          <div
            className="font-medium text-text-primary"
            title={r.displayTitle}
          >
            {r.displayTitle}
          </div>
          {r.engagementStatus && r.engagementStatus.toLowerCase() !== 'unknown' && (
            <div className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <StatusBadge status={r.engagementStatus} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function mapContactRow(
  row: {
    contactAssignmentId: number;
    contactId: number;
    firstName: string;
    lastName: string;
    email: string;
    cellPhone: string | null;
    workPhone: string | null;
    roleId: number;
    roleName: string;
    departmentId: number;
    departmentName: string;
  },
  companyId: string,
): Contact {
  return {
    id: `ca-${row.contactAssignmentId}`,
    contactAssignmentId: row.contactAssignmentId,
    contactId: row.contactId,
    companyId,
    firstName: row.firstName,
    lastName: row.lastName,
    roles: [row.roleName],
    email: row.email,
    phone: row.workPhone || '',
    status: 'Active',
    workEmail: row.email,
    workPhone: row.workPhone || '',
    cellPhone: row.cellPhone || undefined,
    roleId: row.roleId,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
  };
}

function ContactFormDb({
  roles,
  departments,
  onSave,
  onCancel,
  initial,
}: {
  roles: ApiRole[];
  departments: ApiDepartment[];
  onSave: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    cellPhone?: string;
    workPhone?: string;
    roleId: number;
    departmentId: number;
  }) => void | Promise<void>;
  onCancel: () => void;
  initial?: Contact;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName || '');
  const [lastName, setLastName] = useState(initial?.lastName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [workPhoneCountry, setWorkPhoneCountry] =
    useState<PhoneCountrySelection>('');
  const [workPhoneDisplay, setWorkPhoneDisplay] = useState('');
  const [cellPhoneCountry, setCellPhoneCountry] =
    useState<PhoneCountrySelection>('');
  const [cellPhoneDisplay, setCellPhoneDisplay] = useState('');
  const [workPhoneError, setWorkPhoneError] = useState<string | undefined>();
  const [cellPhoneError, setCellPhoneError] = useState<string | undefined>();
  const [roleId, setRoleId] = useState(
    initial?.roleId != null ? String(initial.roleId) : '',
  );
  const [departmentId, setDepartmentId] = useState(
    initial?.departmentId != null ? String(initial.departmentId) : '',
  );
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    department?: string;
  }>({});

  useEffect(() => {
    setWorkPhoneError(undefined);
    setCellPhoneError(undefined);
    setFieldErrors({});
    setFirstName(initial?.firstName || '');
    setLastName(initial?.lastName || '');
    setEmail(initial?.email || '');
    const w = parsePhoneFieldValue(initial?.workPhone, DEFAULT_PHONE_COUNTRY, {
      noCountryWhenEmpty: true,
    });
    setWorkPhoneCountry(w.country);
    setWorkPhoneDisplay(w.display);
    const c = parsePhoneFieldValue(initial?.cellPhone, DEFAULT_PHONE_COUNTRY, {
      noCountryWhenEmpty: true,
    });
    setCellPhoneCountry(c.country);
    setCellPhoneDisplay(c.display);
    setRoleId(initial?.roleId != null ? String(initial.roleId) : '');
    setDepartmentId(
      initial?.departmentId != null ? String(initial.departmentId) : '',
    );
  }, [initial]);

  const inputCls =
    'w-full min-w-0 cursor-text bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const roleOpts = useMemo(
    () =>
      roles.map((r) => ({ value: String(r.roleId), label: r.roleName })),
    [roles],
  );
  const deptOpts = useMemo(
    () =>
      departments.map((d) => ({
        value: String(d.departmentId),
        label: d.departmentName,
      })),
    [departments],
  );

  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-elevated border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <FormField label="First Name" required error={fieldErrors.firstName}>
          <input
            className={inputCls}
            maxLength={100}
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
            }}
          />
        </FormField>
        <FormField label="Last Name" required error={fieldErrors.lastName}>
          <input
            className={inputCls}
            maxLength={100}
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setFieldErrors((er) => ({ ...er, lastName: undefined }));
            }}
          />
        </FormField>
        <FormField label="Email" required error={fieldErrors.email}>
          <input
            type="email"
            className={inputCls}
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((er) => ({ ...er, email: undefined }));
            }}
          />
        </FormField>
        <ContactPhoneRow
          label="Work Phone"
          country={workPhoneCountry}
          display={workPhoneDisplay}
          onCountry={(c) => {
            setWorkPhoneCountry(c);
            setWorkPhoneError(undefined);
          }}
          onDisplay={(d) => {
            setWorkPhoneDisplay(d);
            setWorkPhoneError(undefined);
          }}
          error={workPhoneError}
        />
        <ContactPhoneRow
          label="Cell Phone"
          country={cellPhoneCountry}
          display={cellPhoneDisplay}
          onCountry={(c) => {
            setCellPhoneCountry(c);
            setCellPhoneError(undefined);
          }}
          onDisplay={(d) => {
            setCellPhoneDisplay(d);
            setCellPhoneError(undefined);
          }}
          error={cellPhoneError}
        />
        <FormField label="Role" required error={fieldErrors.role}>
          <Select2
            options={[{ value: '', label: 'Select role…' }, ...roleOpts]}
            value={roleId}
            onChange={(v) => {
              setRoleId(v);
              setFieldErrors((prev) => ({ ...prev, role: undefined }));
            }}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Department" required error={fieldErrors.department}>
            <Select2
              options={[{ value: '', label: 'Select department…' }, ...deptOpts]}
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v);
                setFieldErrors((prev) => ({ ...prev, department: undefined }));
              }}
            />
          </FormField>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const next: {
              firstName?: string;
              lastName?: string;
              email?: string;
              role?: string;
              department?: string;
            } = {};
            if (!firstName.trim()) next.firstName = 'First name is required.';
            if (!lastName.trim()) next.lastName = 'Last name is required.';
            if (!email.trim()) next.email = 'Email is required.';
            if (!roleId) next.role = 'Select a role.';
            if (!departmentId) next.department = 'Select a department.';
            if (Object.keys(next).length > 0) {
              setFieldErrors(next);
              return;
            }
            setFieldErrors({});
            let wErr: string | undefined;
            let cErr: string | undefined;
            if (workPhoneDisplay.trim() && !workPhoneCountry) {
              wErr =
                'Select a country for work phone, or clear the number.';
            }
            if (cellPhoneDisplay.trim() && !cellPhoneCountry) {
              cErr =
                'Select a country for cell phone, or clear the number.';
            }
            if (wErr || cErr) {
              setWorkPhoneError(wErr);
              setCellPhoneError(cErr);
              return;
            }
            const wE = tryE164FromDisplay(workPhoneDisplay, workPhoneCountry);
            const cE = tryE164FromDisplay(cellPhoneDisplay, cellPhoneCountry);
            if (workPhoneDisplay.trim() && !wE) {
              wErr = PHONE_INVALID_MESSAGE;
            }
            if (cellPhoneDisplay.trim() && !cE) {
              cErr = PHONE_INVALID_MESSAGE;
            }
            setWorkPhoneError(wErr);
            setCellPhoneError(cErr);
            if (wErr || cErr) return;
            setSaving(true);
            try {
              await onSave({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                workPhone: wE || undefined,
                cellPhone: cE || undefined,
                roleId: Number(roleId),
                departmentId: Number(departmentId),
              });
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center justify-center gap-2 min-w-[7.5rem] bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            'Save Contact'
          )}
        </button>
      </div>
    </div>
  );
}

const COMPANY_FORM_PHYS_ERR_KEYS = [
  'physicalStreet',
  'physicalCity',
  'physicalState',
  'physicalPostal',
  'physicalCountry',
] as const;

const COMPANY_FORM_MAIL_ERR_KEYS = [
  'mailingStreet',
  'mailingCity',
  'mailingState',
  'mailingPostal',
  'mailingCountry',
] as const;

function CompanyFormDb({
  companyTypes,
  initial,
  onSubmit,
  onCancel,
}: {
  companyTypes: { companyTypeId: number; companyTypeName: string }[];
  initial?: Company;
  onSubmit: (payload: CreateCompanyPayload | UpdateCompanyPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState(initial?.name || '');
  const [companyTypeId, setCompanyTypeId] = useState(
    initial?.companyTypeId != null
      ? String(initial.companyTypeId)
      : companyTypes[0]
        ? String(companyTypes[0].companyTypeId)
        : '',
  );
  const [resolvedDma, setResolvedDma] = useState<string | null>(
    initial?.dmaMarketName ?? null,
  );
  const [dmaLookupBusy, setDmaLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const clearError = useCallback((key: string) => {
    setFieldErrors((e) => clearFormFieldError(e, key));
  }, []);

  const [physicalStreet, setPhysicalStreet] = useState(
    initial?.physicalStreet || '',
  );
  const [physicalCity, setPhysicalCity] = useState(initial?.physicalCity || '');
  const [physicalState, setPhysicalState] = useState(
    initial?.physicalState || '',
  );
  const [physicalPostalCode, setPhysicalPostalCode] = useState(
    initial?.physicalPostalCode || '',
  );
  const [physicalCountry, setPhysicalCountry] = useState(
    initial?.physicalCountry || '',
  );
  const [lastGoogleFormattedMailing, setLastGoogleFormattedMailing] =
    useState('');

  const [mailingEnabled, setMailingEnabled] = useState(
    !!(initial?.mailingStreet || initial?.mailingCity),
  );
  const [mailingStreet, setMailingStreet] = useState(
    initial?.mailingStreet || '',
  );
  const [mailingCity, setMailingCity] = useState(initial?.mailingCity || '');
  const [mailingState, setMailingState] = useState(
    initial?.mailingState || '',
  );
  const [mailingPostalCode, setMailingPostalCode] = useState(
    initial?.mailingPostalCode || '',
  );
  const [mailingCountry, setMailingCountry] = useState(
    initial?.mailingCountry || '',
  );

  useEffect(() => {
    if (!initial) return;
    setCompanyName(initial.name);
    setCompanyTypeId(
      initial.companyTypeId != null
        ? String(initial.companyTypeId)
        : companyTypes[0]
          ? String(companyTypes[0].companyTypeId)
          : '',
    );
    setPhysicalStreet(initial.physicalStreet || '');
    setPhysicalCity(initial.physicalCity || '');
    setPhysicalState(initial.physicalState || '');
    setPhysicalPostalCode(initial.physicalPostalCode || '');
    setPhysicalCountry(initial.physicalCountry || '');
    const hasMailing = !!(
      initial.mailingStreet &&
      (initial.mailingStreet !== initial.physicalStreet ||
        initial.mailingCity !== initial.physicalCity)
    );
    setMailingEnabled(hasMailing);
    setMailingStreet(initial.mailingStreet || '');
    setMailingCity(initial.mailingCity || '');
    setMailingState(initial.mailingState || '');
    setMailingPostalCode(initial.mailingPostalCode || '');
    setMailingCountry(initial.mailingCountry || '');
    setResolvedDma(initial.dmaMarketName ?? null);
    setFieldErrors({});
  }, [initial, companyTypes]);

  useEffect(() => {
    let cancelled = false;
    const pc = physicalPostalCode.trim();
    if (pc.length < 3) {
      setDmaLookupBusy(false);
      setResolvedDma(null);
      return;
    }
    const run = async () => {
      setDmaLookupBusy(true);
      try {
        const row = await fetchDmaByPostal(physicalPostalCode);
        if (!cancelled) {
          setResolvedDma(row ? row.marketName : null);
        }
      } catch {
        if (!cancelled) setResolvedDma(null);
      } finally {
        if (!cancelled) setDmaLookupBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [physicalPostalCode, physicalCountry]);

  const patchPhysicalAddress = useCallback(
    (patch: Partial<{
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    }>) => {
      if (patch.street !== undefined) {
        setPhysicalStreet(clampToMaxLen(patch.street, COMPANY_FORM.addressLine1));
      }
      if (patch.city !== undefined) {
        setPhysicalCity(
          sanitizeCityStateInput(patch.city, COMPANY_FORM.city),
        );
      }
      if (patch.state !== undefined) {
        setPhysicalState(
          sanitizeCityStateInput(patch.state, COMPANY_FORM.stateProvince),
        );
      }
      if (patch.postalCode !== undefined) {
        setPhysicalPostalCode(clampToMaxLen(patch.postalCode, COMPANY_FORM.postalCode));
      }
      if (patch.country !== undefined) {
        setPhysicalCountry(sanitizeCountryInput(patch.country));
      }
      if (Object.keys(patch).length > 0) {
        setFieldErrors((e) => clearFormFieldErrors(e, [...COMPANY_FORM_PHYS_ERR_KEYS]));
      }
    },
    [],
  );

  const patchMailingAddress = useCallback(
    (patch: Partial<{
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    }>) => {
      if (patch.street !== undefined) {
        setMailingStreet(clampToMaxLen(patch.street, COMPANY_FORM.addressLine1));
      }
      if (patch.city !== undefined) {
        setMailingCity(
          sanitizeCityStateInput(patch.city, COMPANY_FORM.city),
        );
      }
      if (patch.state !== undefined) {
        setMailingState(
          sanitizeCityStateInput(patch.state, COMPANY_FORM.stateProvince),
        );
      }
      if (patch.postalCode !== undefined) {
        setMailingPostalCode(clampToMaxLen(patch.postalCode, COMPANY_FORM.postalCode));
      }
      if (patch.country !== undefined) {
        setMailingCountry(sanitizeCountryInput(patch.country));
      }
      if (Object.keys(patch).length > 0) {
        setFieldErrors((e) => clearFormFieldErrors(e, [...COMPANY_FORM_MAIL_ERR_KEYS]));
      }
    },
    [],
  );

  const onPlaceResolved = useCallback(
    (details: PlaceDetailsResult) => {
      const name = details.placeName?.trim();
      if (name) setCompanyName(clampToMaxLen(name, COMPANY_FORM.companyName));
      patchPhysicalAddress({
        street: details.physical.street || '',
        city: details.physical.city || '',
        state: details.physical.state || '',
        postalCode: details.physical.postalCode || '',
        country: sanitizeCountryInput(details.physical.country || ''),
      });
      patchMailingAddress({
        street: details.mailing.street || '',
        city: details.mailing.city || '',
        state: details.mailing.state || '',
        postalCode: details.mailing.postalCode || '',
        country: sanitizeCountryInput(details.mailing.country || ''),
      });
      setLastGoogleFormattedMailing(
        clampToMaxLen(
          details.formattedAddress?.trim() || '',
          COMPANY_FORM.googleFormattedMailingDisplay,
        ),
      );
      setFieldErrors({});
    },
    [patchPhysicalAddress, patchMailingAddress],
  );

  const companyPlace = useCompanyPlaceSearch({
    query: companyName,
    onPlaceResolved,
  });

  const physicalAutofill = useAddressAutofill({
    value: {
      street: physicalStreet,
      city: physicalCity,
      state: physicalState,
      postalCode: physicalPostalCode,
      country: physicalCountry,
    },
    onPatch: patchPhysicalAddress,
    enabled: false,
  });

  const mailingAutofill = useAddressAutofill({
    value: {
      street: mailingStreet,
      city: mailingCity,
      state: mailingState,
      postalCode: mailingPostalCode,
      country: mailingCountry,
    },
    onPatch: patchMailingAddress,
    enabled: mailingEnabled,
  });

  const inputCls =
    'w-full min-w-0 cursor-text bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';

  const typeOpts = useMemo(
    () =>
      companyTypes.map((t) => ({
        value: String(t.companyTypeId),
        label: t.companyTypeName,
      })),
    [companyTypes],
  );

  const handleSave = async () => {
    const M = COMPANY_FORM;
    const next: Partial<Record<string, string>> = {};
    const n = companyName.trim();
    if (!n) next.companyName = 'Company name is required.';
    else if (n.length > M.companyName) {
      next.companyName = `Company name must be ${M.companyName} characters or fewer.`;
    }
    if (!companyTypeId) next.companyType = 'Company type is required.';

    if (!physicalStreet.trim()) next.physicalStreet = 'Physical street is required.';
    else if (physicalStreet.trim().length > M.addressLine1) {
      next.physicalStreet = `Physical street must be ${M.addressLine1} characters or fewer.`;
    }
    if (!physicalCity.trim()) next.physicalCity = 'Physical city is required.';
    else if (physicalCity.trim().length > M.city) {
      next.physicalCity = `Physical city must be ${M.city} characters or fewer.`;
    } else if (!isValidAddressNameText(physicalCity, M.city)) {
      next.physicalCity = `Physical city: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
    }
    if (!physicalState.trim()) next.physicalState = 'Physical state or province is required.';
    else if (physicalState.trim().length > M.stateProvince) {
      next.physicalState = `Physical state or province must be ${M.stateProvince} characters or fewer.`;
    } else if (!isValidAddressNameText(physicalState, M.stateProvince)) {
      next.physicalState = `Physical state or province: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
    }
    if (!physicalPostalCode.trim()) next.physicalPostal = 'Physical postal code is required.';
    else if (physicalPostalCode.trim().length > M.postalCode) {
      next.physicalPostal = `Physical postal code must be ${M.postalCode} characters or fewer.`;
    }
    if (!physicalCountry.trim()) next.physicalCountry = 'Physical country is required.';
    else if (physicalCountry.trim().length > M.country) {
      next.physicalCountry = `Physical country must be ${M.country} characters or fewer.`;
    } else if (!isValidCountryName(physicalCountry)) {
      next.physicalCountry = `Physical country: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
    }

    const pc = physicalPostalCode.trim();
    if (pc.length >= 3) {
      if (!dmaLookupBusy && !resolvedDma) {
        next.dma =
          'This physical postal code does not match any market in the DMA data. Use a different postal code.';
      }
    } else if (pc.length > 0) {
      next.dma = `Use a physical postal code of at least 3 characters so a DMA can be found.`;
    }

    if (mailingEnabled) {
      if (!mailingStreet.trim()) next.mailingStreet = 'Mailing street is required.';
      else if (mailingStreet.trim().length > M.addressLine1) {
        next.mailingStreet = `Mailing street must be ${M.addressLine1} characters or fewer.`;
      }
      if (!mailingCity.trim()) next.mailingCity = 'Mailing city is required.';
      else if (mailingCity.trim().length > M.city) {
        next.mailingCity = `Mailing city must be ${M.city} characters or fewer.`;
      } else if (!isValidAddressNameText(mailingCity, M.city)) {
        next.mailingCity = `Mailing city: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
      }
      if (!mailingState.trim()) next.mailingState = 'Mailing state or province is required.';
      else if (mailingState.trim().length > M.stateProvince) {
        next.mailingState = `Mailing state or province must be ${M.stateProvince} characters or fewer.`;
      } else if (!isValidAddressNameText(mailingState, M.stateProvince)) {
        next.mailingState = `Mailing state or province: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
      }
      if (!mailingPostalCode.trim()) next.mailingPostal = 'Mailing postal code is required.';
      else if (mailingPostalCode.trim().length > M.postalCode) {
        next.mailingPostal = `Mailing postal code must be ${M.postalCode} characters or fewer.`;
      }
      if (!mailingCountry.trim()) next.mailingCountry = 'Mailing country is required.';
      else if (mailingCountry.trim().length > M.country) {
        next.mailingCountry = `Mailing country must be ${M.country} characters or fewer.`;
      } else if (!isValidCountryName(mailingCountry)) {
        next.mailingCountry = `Mailing country: ${COUNTRY_NAME_FORMAT_USER_MESSAGE}`;
      }
    }
    if (Object.keys(next).length) {
      setFieldErrors(next);
      return;
    }

    const physical = {
      addressLine1: physicalStreet.trim().slice(0, M.addressLine1),
      addressLine2: null as string | null,
      city: physicalCity.trim().slice(0, M.city),
      stateProvince: physicalState.trim().slice(0, M.stateProvince),
      postalCode: physicalPostalCode.trim().slice(0, M.postalCode),
      country: physicalCountry.trim().slice(0, M.country),
    };
    const mailingSameAsPhysical = !mailingEnabled;
    const mailing = mailingEnabled
      ? {
          addressLine1: mailingStreet.trim().slice(0, M.addressLine1),
          addressLine2: null as string | null,
          city: mailingCity.trim().slice(0, M.city),
          stateProvince: mailingState.trim().slice(0, M.stateProvince),
          postalCode: mailingPostalCode.trim().slice(0, M.postalCode),
          country: mailingCountry.trim().slice(0, M.country),
        }
      : undefined;

    const base: CreateCompanyPayload = {
      companyName: companyName.trim().slice(0, M.companyName),
      companyTypeId: Number(companyTypeId),
      physical,
      mailingSameAsPhysical,
      mailing,
    };

    setFieldErrors({});
    setSaving(true);
    try {
      await onSubmit(base);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Company Type" required error={fieldErrors.companyType}>
          <Select2
            options={typeOpts}
            value={companyTypeId}
            onChange={(v) => {
              setCompanyTypeId(v);
              clearError('companyType');
            }}
          />
        </FormField>
      </div>

      <FormField label="Company Name" required error={fieldErrors.companyName}>
        <div className="relative">
          <input
            className={inputCls}
            maxLength={COMPANY_FORM.companyName}
            value={companyName}
            onChange={(e) => {
              setCompanyName(
                clampToMaxLen(e.target.value, COMPANY_FORM.companyName),
              );
              clearError('companyName');
              companyPlace.onNameInput();
            }}
            onFocus={companyPlace.onNameFocus}
            onBlur={companyPlace.onNameBlur}
            placeholder="Search venue or address…"
            autoComplete="off"
            spellCheck={false}
          />
            {companyPlace.listVisible && (
              <div
                className="absolute z-30 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-52 overflow-auto"
                onMouseDown={(e) => e.preventDefault()}
                role="listbox"
                aria-label="Place suggestions"
              >
                {companyPlace.loading && (
                  <div
                    className="px-3 py-2.5 text-xs text-text-muted flex items-center gap-2"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ems-accent" aria-hidden />
                    Searching…
                  </div>
                )}
                {!companyPlace.loading && companyPlace.suggestions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-text-muted">
                    No matching places — try a different name.
                  </div>
                )}
                {!companyPlace.loading &&
                  companyPlace.suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        companyPlace.selectPrediction(s);
                      }}
                    >
                      {s.description}
                    </button>
                  ))}
            </div>
          )}
        </div>
      </FormField>
      {!companyPlace.configured && (
        <p className="text-[11px] text-text-muted -mt-3">
          Add a Places API key to search by name.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
            Physical Address
          </h3>
          <FormField label="Street Address" required error={fieldErrors.physicalStreet}>
            <input
              className={inputCls}
              maxLength={COMPANY_FORM.addressLine1}
              value={physicalStreet}
              onChange={(e) => {
                setPhysicalStreet(
                  clampToMaxLen(e.target.value, COMPANY_FORM.addressLine1),
                );
                clearError('physicalStreet');
              }}
              placeholder="Street line 1"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="City" required error={fieldErrors.physicalCity}>
              <input
                className={inputCls}
                maxLength={COMPANY_FORM.city}
                value={physicalCity}
                onChange={(e) => {
                  setPhysicalCity(
                    sanitizeCityStateInput(
                      e.target.value,
                      COMPANY_FORM.city,
                    ),
                  );
                  clearError('physicalCity');
                }}
                autoComplete="address-level2"
              />
            </FormField>
            <FormField label="State / Province" required error={fieldErrors.physicalState}>
              <input
                className={inputCls}
                maxLength={COMPANY_FORM.stateProvince}
                value={physicalState}
                onChange={(e) => {
                  setPhysicalState(
                    sanitizeCityStateInput(
                      e.target.value,
                      COMPANY_FORM.stateProvince,
                    ),
                  );
                  clearError('physicalState');
                }}
                autoComplete="address-level1"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Postal Code" required error={fieldErrors.physicalPostal}>
              <input
                className={inputCls}
                maxLength={COMPANY_FORM.postalCode}
                value={physicalPostalCode}
                onChange={(e) => {
                  setPhysicalPostalCode(
                    clampToMaxLen(e.target.value, COMPANY_FORM.postalCode),
                  );
                  clearError('physicalPostal');
                  clearError('dma');
                }}
                onBlur={physicalAutofill.resolveByPostalCode}
                placeholder="ZIP / postal"
              />
            </FormField>
            <FormField label="Country" required error={fieldErrors.physicalCountry}>
              <input
                className={inputCls}
                maxLength={COMPANY_FORM.country}
                value={physicalCountry}
                onChange={(e) => {
                  setPhysicalCountry(sanitizeCountryInput(e.target.value));
                  clearError('physicalCountry');
                  clearError('dma');
                }}
                placeholder="Country name"
                autoComplete="country-name"
                spellCheck
              />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Mailing Address
              {mailingEnabled && <span className="text-ems-coral font-normal"> *</span>}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFieldErrors((e) => clearFormFieldErrors(e, [...COMPANY_FORM_MAIL_ERR_KEYS]));
                  setMailingEnabled((v) => !v);
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mailingEnabled ? 'bg-ems-accent' : 'bg-elevated border border-border'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${mailingEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
              <span className="text-xs text-text-secondary">
                Edit
              </span>
            </div>
          </div>
          {mailingEnabled ? (
            <>
              <FormField label="Street Address" required error={fieldErrors.mailingStreet}>
                <div className="relative">
                  <input
                    className={inputCls}
                    maxLength={COMPANY_FORM.addressLine1}
                    value={mailingStreet}
                    onChange={(e) => {
                      setMailingStreet(
                        clampToMaxLen(e.target.value, COMPANY_FORM.addressLine1),
                      );
                      clearError('mailingStreet');
                    }}
                    onFocus={mailingAutofill.onStreetFocus}
                    onBlur={mailingAutofill.onStreetBlur}
                    placeholder="Street line 1"
                  />
                  {mailingAutofill.showSuggestions && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-48 overflow-auto">
                      {mailingAutofill.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            mailingAutofill.selectSuggestion(suggestion);
                          }}
                        >
                          {suggestion.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City" required error={fieldErrors.mailingCity}>
                  <input
                    className={inputCls}
                    maxLength={COMPANY_FORM.city}
                    value={mailingCity}
                    onChange={(e) => {
                      setMailingCity(
                        sanitizeCityStateInput(
                          e.target.value,
                          COMPANY_FORM.city,
                        ),
                      );
                      clearError('mailingCity');
                    }}
                    autoComplete="address-level2"
                  />
                </FormField>
                <FormField label="State / Province" required error={fieldErrors.mailingState}>
                  <input
                    className={inputCls}
                    maxLength={COMPANY_FORM.stateProvince}
                    value={mailingState}
                    onChange={(e) => {
                      setMailingState(
                        sanitizeCityStateInput(
                          e.target.value,
                          COMPANY_FORM.stateProvince,
                        ),
                      );
                      clearError('mailingState');
                    }}
                    autoComplete="address-level1"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Postal Code" required error={fieldErrors.mailingPostal}>
                  <input
                    className={inputCls}
                    maxLength={COMPANY_FORM.postalCode}
                    value={mailingPostalCode}
                    onChange={(e) => {
                      setMailingPostalCode(
                        clampToMaxLen(e.target.value, COMPANY_FORM.postalCode),
                      );
                      clearError('mailingPostal');
                    }}
                    onBlur={mailingAutofill.resolveByPostalCode}
                  />
                </FormField>
                <FormField label="Country" required error={fieldErrors.mailingCountry}>
                  <input
                    className={inputCls}
                    maxLength={COMPANY_FORM.country}
                    value={mailingCountry}
                    onChange={(e) => {
                      setMailingCountry(sanitizeCountryInput(e.target.value));
                      clearError('mailingCountry');
                    }}
                    placeholder="Country name"
                    autoComplete="country-name"
                    spellCheck
                  />
                </FormField>
              </div>
            </>
          ) : (
            <div className="min-h-[120px] bg-surface rounded-lg border border-dashed border-border p-3 flex items-center">
              <p className="text-xs text-text-secondary leading-relaxed break-words w-full">
                {lastGoogleFormattedMailing || 'Uses the same mailing address as physical when saved.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary block mb-2">
          DMA (from postal code)
          <span className="text-ems-coral ml-0.5">*</span>
        </label>
        <div
          className="text-xs bg-surface border border-dashed border-border rounded-md px-3 py-2.5 text-text-secondary min-h-[2.5rem] flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          {dmaLookupBusy && physicalPostalCode.trim().length >= 3 ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-ems-accent"
                aria-hidden
              />
              <span className="text-text-muted">
                Checking your postal code against the DMA list…
              </span>
            </>
          ) : (
            <span>
              {resolvedDma ??
                'Enter a postal code that matches a known DMA to resolve it when you save.'}
            </span>
          )}
        </div>
        {fieldErrors.dma && (
          <p className="text-xs text-ems-coral mt-1" role="alert">
            {fieldErrors.dma}
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center justify-center gap-2 min-w-[6.5rem] bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </div>
  );
}

function CompaniesTableSkeleton({ rows = PAGE_SIZE }: { rows?: number }) {
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden min-h-[28rem]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-border bg-surface/40">
        <Loader2
          className="h-11 w-11 text-ems-accent animate-spin shrink-0"
          aria-hidden
        />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-sm font-semibold text-text-primary">
            Loading companies
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Fetching records from the database. This may take a moment on large lists.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Company Name</th>
              <th className="text-left py-2.5 px-3">Type</th>
              <th className="text-left py-2.5 px-3">City, State</th>
              <th className="text-left py-2.5 px-3">DMA</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="py-3 px-3">
                  <Skeleton className="h-4 w-40 max-w-[12rem] bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-5 w-20 rounded bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-4 w-28 bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-3 w-36 bg-muted/60" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompaniesPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [drawerTab, setDrawerTab] = useState('Overview');
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<Contact | null>(null);
  const [companyPendingDelete, setCompanyPendingDelete] = useState<Company | null>(
    null,
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const companiesQuery = useQuery({
    queryKey: companiesApiQueryKey,
    queryFn: async () => {
      const res: ApiPaginatedResponse<ApiCompanyListRow> = await fetchCompanies(
        0,
        COMPANIES_PICKER_LIMIT,
        {},
      );
      return res.data;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const companies = useMemo(
    () => (companiesQuery.data ?? []).map(mapApiCompanyToCompany),
    [companiesQuery.data],
  );

  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return (companiesQuery.data ?? [])
      .map((c) => mapApiCompanyToCompany(c).name)
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchInput, companiesQuery.data]);

  const commitSearch = useCallback(() => {
    setActiveSearch(searchInput.trim());
    setShowSuggestions(false);
  }, [searchInput]);

  /**
   * When no text search: filter the in-memory list by type only.
   * When the user has committed a name search: always use the API — the in-memory
   * list can miss matches (substring false positives) or omit companies outside
   * the loaded set, which previously skipped the server search entirely.
   */
  const cacheFiltered = useMemo(() => {
    const rows = companies.filter((c) => {
      if (typeFilter !== 'All' && c.type !== typeFilter) return false;
      return true;
    });
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [companies, typeFilter]);

  const hasActiveSearch = activeSearch.trim().length > 0;
  const companyTypeParam =
    typeFilter !== 'All' ? typeFilter : undefined;
  const serverSearchQuery = useQuery({
    queryKey: [
      ...companiesServerSearchQueryKeyPrefix,
      activeSearch,
      typeFilter,
    ] as const,
    queryFn: () =>
      fetchCompanies(0, COMPANIES_PICKER_LIMIT, {
        q: activeSearch.trim(),
        companyType: companyTypeParam,
      }),
    enabled: hasActiveSearch,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const displayList = useMemo((): Company[] => {
    if (hasActiveSearch) {
      const data = serverSearchQuery.data?.data ?? [];
      return data.map(mapApiCompanyToCompany);
    }
    return cacheFiltered;
  }, [hasActiveSearch, serverSearchQuery.data, cacheFiltered]);

  const { offset, limit } = getPageParams(page);
  const pagedRows = useMemo(
    () => displayList.slice(offset, offset + limit),
    [displayList, offset, limit],
  );
  const serverTotal = displayList.length;

  /**
   * Surgical cache patches — the user requirement is: cache only refreshes every
   * 30 minutes, but any mutation must reflect in both DB and cached list
   * IMMEDIATELY, without a full list refetch. The backend create/update endpoints
   * return the full `ApiCompanyListRow`, so we can splice the row in place with
   * `setQueryData` and leave `staleTime` untouched.
   *
   * Server-search caches (keyed by `q`+`companyType`) are dropped, since
   * recomputing which variants still contain a given row is fragile — they'll
   * re-fetch on demand next time the user searches.
   */
  const upsertCompanyInCache = useCallback(
    (row: ApiCompanyListRow) => {
      upsertInList<ApiCompanyListRow>(
        qc,
        companiesApiQueryKey,
        row,
        (r) => r.companyId === row.companyId,
        (a, b) =>
          a.companyName.localeCompare(b.companyName, undefined, {
            sensitivity: 'base',
          }),
      );
      removeQueriesByPrefix(qc, companiesServerSearchQueryKeyPrefix);
    },
    [qc],
  );

  const removeCompanyFromCache = useCallback(
    (companyId: number) => {
      removeFromList<ApiCompanyListRow>(
        qc,
        companiesApiQueryKey,
        (r) => r.companyId === companyId,
      );
      removeQueriesByPrefix(qc, companiesServerSearchQueryKeyPrefix);
    },
    [qc],
  );

  const lookupsQuery = useQuery({
    queryKey: ['lookups'],
    queryFn: fetchLookups,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const seatingTypes: ApiSeatingType[] = lookupsQuery.data?.seatingTypes ?? [];
  const venueTypes = lookupsQuery.data?.venueTypes ?? [];
  const roles: ApiRole[] = lookupsQuery.data?.roles ?? [];
  const departments: ApiDepartment[] = lookupsQuery.data?.departments ?? [];

  const typeOptions = useMemo(() => {
    const lookupTypes = lookupsQuery.data?.companyTypes ?? [];
    if (lookupTypes.length > 0) {
      return ['All', ...lookupTypes.map((t) => t.companyTypeName)];
    }
    const set = new Set(companies.map((c) => c.type).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [lookupsQuery.data?.companyTypes, companies]);

  // Prefer the row the user is looking at (table / server search) over a possibly stale main list row.
  const selectedCompany = selectedCompanyId
    ? displayList.find((c) => c.id === selectedCompanyId) ??
      companies.find((c) => c.id === selectedCompanyId) ??
      null
    : null;

  const isVenueCompany =
    selectedCompany?.type?.trim().toLowerCase() === 'venue';

  const drawerTabs = useMemo(() => {
    const base: string[] = ['Overview', 'Contacts', 'Engagements', 'Documents'];
    return isVenueCompany ? [...base, 'Venue Profile'] : base;
  }, [isVenueCompany]);

  useEffect(() => {
    if (!isVenueCompany && drawerTab === 'Venue Profile') {
      setDrawerTab('Overview');
    }
  }, [isVenueCompany, drawerTab]);

  const contactsQuery = useQuery({
    queryKey: ['companies', selectedCompanyId, 'contacts'],
    queryFn: async () => {
      const id = Number(selectedCompanyId);
      const rows = await fetchCompanyContacts(id);
      return rows.map((r) => mapContactRow(r, String(id)));
    },
    enabled: !!selectedCompanyId && drawerTab === 'Contacts',
  });

  const companyContacts = contactsQuery.data ?? [];

  useEffect(() => {
    setPage(1);
  }, [activeSearch, typeFilter]);

  const pageCount = getTotalPages(serverTotal);
  const { rangeStart, rangeEnd } = getPageRange(page, serverTotal);
  const isLoadingCompanies =
    companiesQuery.isPending ||
    (hasActiveSearch &&
      (serverSearchQuery.isPending || serverSearchQuery.isFetching));

  const deleteMut = useMutation({
    mutationFn: async (id: number) => deleteCompany(id),
    onSuccess: (_, id) => {
      removeCompanyFromCache(id);
    },
  });

  const deleteContactMut = useMutation({
    mutationFn: (contactAssignmentId: number) => deleteContactAssignment(contactAssignmentId),
  });

  const confirmDeleteContact = async () => {
    if (contactPendingDelete?.contactAssignmentId == null || selectedCompanyId == null) {
      return;
    }
    const assignmentId = contactPendingDelete.contactAssignmentId;
    try {
      await deleteContactMut.mutateAsync(assignmentId);
      /**
       * Surgical patch instead of invalidate: drop just this contact row from the
       * per-company contacts cache. No refetch, list stays fresh for 30 min.
       */
      removeFromList<Contact>(
        qc,
        ['companies', selectedCompanyId, 'contacts'],
        (c) => c.contactAssignmentId === assignmentId,
      );
      setContactPendingDelete(null);
      addToast('Contact removed from this company.', 'warning');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not remove the contact.'), 'error');
    }
  };

  const confirmDeleteCompany = async () => {
    if (!companyPendingDelete) return;
    const c = companyPendingDelete;
    try {
      await deleteMut.mutateAsync(Number(c.id));
      if (selectedCompanyId === c.id) setSelectedCompanyId(null);
      setCompanyPendingDelete(null);
      addToast('Company removed from the list.', 'warning');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not delete the company.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog
        open={companyPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) setCompanyPendingDelete(null);
        }}
      >
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">
              Remove this company?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              You’re about to remove{' '}
              <span className="font-medium text-text-primary">
                {companyPendingDelete?.name ?? 'this company'}
              </span>{' '}
              from your list. If something blocks the removal, you’ll see a short
              explanation right after you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMut.isPending && (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-ems-accent"
                aria-hidden
              />
              <span>Removing company…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={deleteMut.isPending}
              className="border-border bg-elevated text-text-primary hover:bg-hover mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => void confirmDeleteCompany()}
            >
              {deleteMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Yes, remove company'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={contactPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteContactMut.isPending) setContactPendingDelete(null);
        }}
      >
        <AlertDialogContent className="z-[340] border-border bg-card text-text-primary shadow-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary font-semibold text-lg">
              Remove this contact?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-sm leading-relaxed">
              You’re about to remove{' '}
              <span className="font-medium text-text-primary">
                {contactPendingDelete
                  ? `${contactPendingDelete.firstName} ${contactPendingDelete.lastName}`.trim() || 'this contact'
                  : 'this contact'}
              </span>{' '}
              from this company. They can be added again later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteContactMut.isPending && (
            <div
              className="flex items-center gap-2.5 rounded-lg border border-border border-dashed bg-surface/60 px-3 py-2.5 text-sm text-text-secondary"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-ems-accent"
                aria-hidden
              />
              <span>Removing contact…</span>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={deleteContactMut.isPending}
              className="border-border bg-elevated text-text-primary hover:bg-hover mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteContactMut.isPending}
              className="bg-ems-coral text-white hover:bg-ems-coral/90 sm:ml-0"
              onClick={() => void confirmDeleteContact()}
            >
              {deleteContactMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                'Yes, remove contact'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {companiesQuery.isError && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
          Could not load companies: {(companiesQuery.error as Error).message}. Is
          the API running at <code className="text-xs">/api</code> (see Vite proxy)?
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Companies</h1>
          {isLoadingCompanies ? (
            <Skeleton className="h-5 w-12 rounded bg-muted/80" aria-hidden />
          ) : (
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
              {serverTotal.toLocaleString()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={isLoadingCompanies}
          className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Company
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full min-w-0 sm:w-64" ref={searchWrapperRef}>
          <div className="flex min-w-0 items-center border border-border rounded-md bg-surface overflow-hidden focus-within:border-ems-accent transition-colors">
            <input
              type="text"
              className="min-w-0 flex-1 cursor-text bg-transparent px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
              placeholder="Search companies..."
              value={searchInput}
              disabled={isLoadingCompanies}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value;
                setSearchInput(v);
                setShowSuggestions(true);
                // If the user clears the box, drop the committed filter so the list shows
                // everything again; otherwise the table stayed stuck on the old search.
                if (!v.trim()) {
                  setActiveSearch('');
                }
              }}
              onFocus={() => {
                if (searchInput.trim()) setShowSuggestions(true);
              }}
              onBlur={commitSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSearch();
                if (e.key === 'Escape') setShowSuggestions(false);
              }}
            />
            <button
              type="button"
              onClick={commitSearch}
              className="shrink-0 cursor-pointer px-2.5 py-1.5 text-text-muted hover:text-ems-accent transition-colors"
              title="Search"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
              {showSuggestions && searchSuggestions.length > 0 && (
            <div
              className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searchSuggestions.map((suggestion, i) => (
                <button
                  key={`${i}-${suggestion}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchInput(suggestion);
                    setActiveSearch(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-full sm:w-80 lg:w-96">
          <Select2
            options={toOptions(typeOptions)}
            value={typeFilter}
            onChange={setTypeFilter}
            disabled={isLoadingCompanies}
            placeholder="Filter by company type"
          />
        </div>
      </div>

      {isLoadingCompanies ? (
        <CompaniesTableSkeleton rows={PAGE_SIZE} />
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Company Name</th>
                  <th className="text-left py-2.5 px-3">Type</th>
                  <th className="text-left py-2.5 px-3">City, State</th>
                  <th className="text-left py-2.5 px-3">DMA</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 && !companiesQuery.isError && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 px-3 text-center text-sm text-text-muted"
                    >
                      {!activeSearch && typeFilter === 'All'
                        ? 'No companies returned from the database.'
                        : 'No companies match your search or filters.'}
                    </td>
                  </tr>
                )}
                {pagedRows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setSelectedCompanyId(c.id);
                      setDrawerTab('Overview');
                    }}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-text-primary font-medium">
                      {c.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                        {c.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary">
                      {c.city}, {c.state}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary">
                      {c.dmaMarketName ?? '—'}
                    </td>
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
                <span className="text-text-muted">
                  {' '}({PAGE_SIZE} per page)
                </span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={page <= 1 || isLoadingCompanies}
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
                  disabled={page >= pageCount || isLoadingCompanies}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedCompany && (
        <Drawer
          onClose={() => setSelectedCompanyId(null)}
          width={1080}
        >
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Avatar name={selectedCompany.name} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary">
                {selectedCompany.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                  {selectedCompany.type}
                </span>
              </div>
            </div>
            {/* Delete button in header */}
            <button
              type="button"
              onClick={() => setCompanyPendingDelete(selectedCompany)}
              title="Delete this company"
              className="p-1.5 text-text-muted hover:text-ems-coral hover:bg-ems-coral-dim rounded-md transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedCompanyId(null)}
              className="text-text-muted hover:text-text-secondary text-lg p-1"
            >
              ✕
            </button>
          </div>

          <TabBar tabs={drawerTabs} active={drawerTab} onChange={setDrawerTab} />

          <div className="p-4">
            {drawerTab === 'Overview' && lookupsQuery.data && (
              <InlineEditableOverview
                key={String(selectedCompany.id)}
                company={selectedCompany}
                companyTypes={lookupsQuery.data.companyTypes}
                addToast={addToast}
                onSaved={(row) => {
                  upsertCompanyInCache(row);
                }}
              />
            )}

            {drawerTab === 'Contacts' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="text-ems-accent text-sm hover:underline"
                >
                  + Add Contact
                </button>
                {showAddContact && lookupsQuery.data && (
                  <ContactFormDb
                    roles={roles}
                    departments={departments}
                    onCancel={() => setShowAddContact(false)}
                    onSave={async (payload) => {
                      try {
                        const created = await createCompanyContact(
                          Number(selectedCompany.id),
                          payload,
                        );
                        /**
                         * Splice the brand-new contact into the drawer's contacts
                         * cache directly — no refetch, no drawer flicker.
                         */
                        const mapped = mapContactRow(
                          created as ApiCompanyContact,
                          String(selectedCompany.id),
                        );
                        upsertInList<Contact>(
                          qc,
                          ['companies', selectedCompany.id, 'contacts'],
                          mapped,
                          (c) => c.contactAssignmentId === mapped.contactAssignmentId,
                        );
                        setShowAddContact(false);
                        addToast('Contact added to this company.', 'success');
                      } catch (e) {
                        addToast(
                          friendlyApiError(e, 'Could not add the contact.'),
                          'error',
                        );
                      }
                    }}
                  />
                )}
                {contactsQuery.isLoading && (
                  <div
                    className="flex items-center gap-2 text-sm text-text-muted py-1"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-ems-accent"
                      aria-hidden
                    />
                    <span>Loading contacts…</span>
                  </div>
                )}
                {contactsQuery.isError && (
                  <p className="text-sm text-ems-coral">
                    {(contactsQuery.error as Error).message}
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Roles</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Phone</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {companyContacts.map((ct) => (
                      <tr key={ct.id} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">
                          {ct.firstName} {ct.lastName}
                        </td>
                        <td className="py-2">
                          {ct.roles.map((r) => (
                            <span
                              key={r}
                              className="text-xs bg-elevated px-1 py-0.5 rounded text-text-secondary mr-1"
                            >
                              {r}
                            </span>
                          ))}
                        </td>
                        <td className="py-2 text-ems-blue text-xs">
                          {ct.workEmail || ct.email}
                        </td>
                        <td className="py-2 text-text-secondary text-xs">
                          {ct.workPhone || ct.phone}
                        </td>
                        <td className="py-2 text-right">
                          <ActionMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => setEditContact(ct),
                              },
                              {
                                label: 'Delete',
                                onClick: () => setContactPendingDelete(ct),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {drawerTab === 'Engagements' && selectedCompanyId && (
              <EngagementsTab companyId={selectedCompanyId} />
            )}

            {drawerTab === 'Documents' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    addToast('Document upload is not available in this app yet.', 'info')
                  }
                  className="text-ems-accent text-sm hover:underline"
                >
                  + Upload Document
                </button>
                <div className="text-sm text-text-muted">
                  No documents — file attachments are not stored yet (optional / future).
                </div>
              </div>
            )}

            {drawerTab === 'Venue Profile' && isVenueCompany && lookupsQuery.data && (
              <CompanyVenueProfilePanel
                company={selectedCompany}
                venueTypes={venueTypes}
                seatingTypes={seatingTypes}
                addToast={addToast}
              />
            )}
          </div>
        </Drawer>
      )}

      {showAddModal && lookupsQuery.data && (
        <Modal
          title="Add Company"
          onClose={() => setShowAddModal(false)}
          width={960}
          allowContentOverflow
        >
          <CompanyFormDb
            key="add-company"
            companyTypes={lookupsQuery.data.companyTypes}
            onCancel={() => setShowAddModal(false)}
            onSubmit={async (payload) => {
              try {
                const created = await createCompany(payload as CreateCompanyPayload);
                upsertCompanyInCache(created);
                setShowAddModal(false);
                addToast('Company saved. You can find it in the list.', 'success');
              } catch (e) {
                addToast(friendlyApiError(e, 'Could not save the company.'), 'error');
              }
            }}
          />
        </Modal>
      )}

      {editContact && lookupsQuery.data && selectedCompany && (
        <Modal
          title="Edit Contact"
          onClose={() => setEditContact(null)}
          width={900}
          allowContentOverflow
        >
          <ContactFormDb
            key={editContact.contactAssignmentId ?? editContact.id}
            roles={roles}
            departments={departments}
            initial={editContact}
            onCancel={() => setEditContact(null)}
            onSave={async (payload) => {
              if (editContact.contactAssignmentId == null) return;
              try {
                const updated = await updateContactAssignment(
                  editContact.contactAssignmentId,
                  payload,
                );
                const mapped = mapContactRow(
                  updated as ApiCompanyContact,
                  String(selectedCompany.id),
                );
                upsertInList<Contact>(
                  qc,
                  ['companies', selectedCompany.id, 'contacts'],
                  mapped,
                  (c) => c.contactAssignmentId === mapped.contactAssignmentId,
                );
                setEditContact(null);
                addToast('Contact updated.', 'success');
              } catch (e) {
                addToast(
                  friendlyApiError(e, 'Could not update the contact.'),
                  'error',
                );
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}