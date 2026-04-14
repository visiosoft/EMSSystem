import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  StatusBadge,
  Avatar,
  SearchInput,
  TabBar,
  Drawer,
  Modal,
  FormField,
  ActionMenu,
} from './Primitives';
import { Select2, toOptions } from './Select2';
import type { Company, Contact } from '@/data/constants';
import { useAddressAutofill } from '@/hooks/useAddressAutofill';
import { useCompanyPlaceSearch } from '@/hooks/useCompanyPlaceSearch';
import type { PlaceDetailsResult } from '@/lib/googlePlaces';
import {
  createCompany,
  createCompanyContact,
  deleteCompany,
  deleteContactAssignment,
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
import { mapApiCompanyToCompany } from './companyMapping';
import { CompanyTicketingPanel } from './CompanyTicketingPanel';
import { CompanyVenueProfilePanel } from './CompanyVenueProfilePanel';
import { Loader2 } from 'lucide-react';
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

/** Rows per page (10–20 range; keeps a full “screen” of table rows visible). */
const COMPANIES_PAGE_SIZE = 15;

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

function OverviewFields({ selectedCompany }: { selectedCompany: Company }) {
  const c = selectedCompany;
  const dmaDisplay = c.dmaMarketName ?? '—';
  return (
    <div className="text-sm space-y-6">
      <div className="border-b border-border/80 pb-5">
        <span className={overviewLabelCls}>Company name</span>
        <div className={`${overviewValueCls} text-base font-semibold`}>
          {c.name}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
        <div className="min-w-0">
          <span className={overviewLabelCls}>Company type</span>
          <div className={overviewValueCls}>{c.type || '—'}</div>
        </div>
        <div className="min-w-0">
          <span className={overviewLabelCls}>Status</span>
          <div className={overviewValueCls}>{c.status}</div>
          <p className="text-[11px] text-text-muted mt-1.5 leading-snug">
            Optional — not saved in the database.
          </p>
        </div>
        <div className="min-w-0 sm:col-span-1">
          <span className={overviewLabelCls}>Physical address</span>
          {renderPhysicalAddressValue(c)}
        </div>
        <div className="min-w-0 sm:col-span-1">
          <span className={overviewLabelCls}>Mailing address</span>
          {renderMailingAddressValue(c)}
        </div>
        <div className="min-w-0 sm:col-span-2 pt-1 border-t border-border/60">
          <span className={overviewLabelCls}>DMA</span>
          <div className={overviewValueCls}>{dmaDisplay}</div>
        </div>
      </div>
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
          <div className="font-medium text-text-primary">
            #{r.engagementId} — {r.engagementStatus}
          </div>
          <div className="text-text-secondary">
            {r.attractionName ?? '—'}
            {r.tourName ? ` · ${r.tourName}` : ''}
          </div>
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
    title: '',
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
  const [title, setTitle] = useState(initial?.title || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [workPhone, setWorkPhone] = useState(initial?.workPhone || '');
  const [cellPhone, setCellPhone] = useState(initial?.cellPhone || '');
  const [roleId, setRoleId] = useState(
    initial?.roleId != null ? String(initial.roleId) : '',
  );
  const [departmentId, setDepartmentId] = useState(
    initial?.departmentId != null ? String(initial.departmentId) : '',
  );

  useEffect(() => {
    setFirstName(initial?.firstName || '');
    setLastName(initial?.lastName || '');
    setTitle(initial?.title || '');
    setEmail(initial?.email || '');
    setWorkPhone(initial?.workPhone || '');
    setCellPhone(initial?.cellPhone || '');
    setRoleId(initial?.roleId != null ? String(initial.roleId) : '');
    setDepartmentId(
      initial?.departmentId != null ? String(initial.departmentId) : '',
    );
  }, [initial]);

  const inputCls =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

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
      <p className="text-xs text-text-muted">
        Job title is optional — it is not saved to the database.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <FormField label="First Name" required>
            <input
              className={inputCls}
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last Name" required>
            <input
              className={inputCls}
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
          <FormField label="Title">
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional — not saved to the database"
            />
          </FormField>
        </div>
        <div className="space-y-3">
          <FormField label="Email" required>
            <input
              type="email"
              className={inputCls}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Work Phone">
            <input
              type="tel"
              className={inputCls}
              maxLength={30}
              value={workPhone}
              onChange={(e) => setWorkPhone(e.target.value)}
            />
          </FormField>
          <FormField label="Cell Phone">
            <input
              type="tel"
              className={inputCls}
              maxLength={30}
              value={cellPhone}
              onChange={(e) => setCellPhone(e.target.value)}
            />
          </FormField>
          <FormField label="Role" required>
            <Select2
              options={[{ value: '', label: 'Select role…' }, ...roleOpts]}
              value={roleId}
              onChange={setRoleId}
            />
          </FormField>
          <FormField label="Department" required>
            <Select2
              options={[{ value: '', label: 'Select department…' }, ...deptOpts]}
              value={departmentId}
              onChange={setDepartmentId}
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
            if (!firstName.trim() || !lastName.trim() || !email.trim()) {
              return;
            }
            if (!roleId || !departmentId) return;
            setSaving(true);
            try {
              await onSave({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                workPhone: workPhone.trim() || undefined,
                cellPhone: cellPhone.trim() || undefined,
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
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [resolvedDma, setResolvedDma] = useState<string | null>(
    initial?.dmaMarketName ?? null,
  );
  const [dmaLookupBusy, setDmaLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
    initial?.physicalCountry || 'USA',
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
    initial?.mailingCountry || 'USA',
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
    setStatus(initial.status || 'Active');
    setPhysicalStreet(initial.physicalStreet || '');
    setPhysicalCity(initial.physicalCity || '');
    setPhysicalState(initial.physicalState || '');
    setPhysicalPostalCode(initial.physicalPostalCode || '');
    setPhysicalCountry(initial.physicalCountry || 'USA');
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
    setMailingCountry(initial.mailingCountry || 'USA');
    setResolvedDma(initial.dmaMarketName ?? null);
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
      if (patch.street !== undefined) setPhysicalStreet(patch.street);
      if (patch.city !== undefined) setPhysicalCity(patch.city);
      if (patch.state !== undefined) setPhysicalState(patch.state);
      if (patch.postalCode !== undefined) setPhysicalPostalCode(patch.postalCode);
      if (patch.country !== undefined) setPhysicalCountry(patch.country);
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
      if (patch.street !== undefined) setMailingStreet(patch.street);
      if (patch.city !== undefined) setMailingCity(patch.city);
      if (patch.state !== undefined) setMailingState(patch.state);
      if (patch.postalCode !== undefined) setMailingPostalCode(patch.postalCode);
      if (patch.country !== undefined) setMailingCountry(patch.country);
    },
    [],
  );

  const onPlaceResolved = useCallback(
    (details: PlaceDetailsResult) => {
      const name = details.placeName?.trim();
      if (name) setCompanyName(name);
      patchPhysicalAddress({
        street: details.physical.street || '',
        city: details.physical.city || '',
        state: details.physical.state || '',
        postalCode: details.physical.postalCode || '',
        country: details.physical.country || 'USA',
      });
      patchMailingAddress({
        street: details.mailing.street || '',
        city: details.mailing.city || '',
        state: details.mailing.state || '',
        postalCode: details.mailing.postalCode || '',
        country: details.mailing.country || 'USA',
      });
      setLastGoogleFormattedMailing(details.formattedAddress?.trim() || '');
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
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';

  const typeOpts = useMemo(
    () =>
      companyTypes.map((t) => ({
        value: String(t.companyTypeId),
        label: t.companyTypeName,
      })),
    [companyTypes],
  );

  const handleSave = async () => {
    const errs: string[] = [];
    if (!companyName.trim()) errs.push('Company name is required');
    if (!companyTypeId) errs.push('Company type is required');
    if (!physicalStreet.trim()) errs.push('Physical street is required');
    if (!physicalCity.trim()) errs.push('Physical city is required');
    if (!physicalState.trim()) errs.push('Physical state/province is required');
    if (!physicalPostalCode.trim()) errs.push('Physical postal code is required');
    if (!physicalCountry.trim()) errs.push('Physical country is required');
    if (mailingEnabled) {
      if (!mailingStreet.trim()) errs.push('Mailing street is required');
      if (!mailingCity.trim()) errs.push('Mailing city is required');
      if (!mailingState.trim()) errs.push('Mailing state/province is required');
      if (!mailingPostalCode.trim()) errs.push('Mailing postal code is required');
      if (!mailingCountry.trim()) errs.push('Mailing country is required');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }

    const physical = {
      addressLine1: physicalStreet.trim().slice(0, 200),
      addressLine2: null as string | null,
      city: physicalCity.trim().slice(0, 100),
      stateProvince: physicalState.trim().slice(0, 100),
      postalCode: physicalPostalCode.trim().slice(0, 20),
      country: physicalCountry.trim().slice(0, 100),
    };
    const mailingSameAsPhysical = !mailingEnabled;
    const mailing = mailingEnabled
      ? {
          addressLine1: mailingStreet.trim().slice(0, 200),
          addressLine2: null as string | null,
          city: mailingCity.trim().slice(0, 100),
          stateProvince: mailingState.trim().slice(0, 100),
          postalCode: mailingPostalCode.trim().slice(0, 20),
          country: mailingCountry.trim().slice(0, 100),
        }
      : undefined;

    const base: CreateCompanyPayload = {
      companyName: companyName.trim().slice(0, 200),
      companyTypeId: Number(companyTypeId),
      physical,
      mailingSameAsPhysical,
      mailing,
    };

    setErrors([]);
    setSaving(true);
    try {
      await onSubmit(base);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {errors.length > 0 && (
        <div className="text-ems-coral text-sm bg-ems-coral-dim border border-ems-coral/20 rounded px-3 py-2">
          {errors.join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Company Type" required>
          <Select2
            options={typeOpts}
            value={companyTypeId}
            onChange={setCompanyTypeId}
          />
        </FormField>
        <FormField label="Status">
          <Select2
            options={toOptions(['Active', 'Prospective', 'Inactive'])}
            value={status}
            onChange={setStatus}
          />
          <p className="text-[11px] text-text-muted mt-1">
            Optional — not saved in the database.
          </p>
        </FormField>
      </div>

      <FormField label="Company Name" required>
        <div className="relative">
          <input
            className={inputCls}
            maxLength={200}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onFocus={companyPlace.onNameFocus}
            onBlur={companyPlace.onNameBlur}
            placeholder="Search venue or address…"
            autoComplete="off"
          />
          {companyPlace.menuOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-52 overflow-auto">
              {companyPlace.loading && companyPlace.suggestions.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
              )}
              {companyPlace.suggestions.map((s) => (
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
          <FormField label="Street Address" required>
            <input
              className={inputCls}
              maxLength={200}
              value={physicalStreet}
              onChange={(e) => setPhysicalStreet(e.target.value)}
              placeholder="Street line 1"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="City" required>
              <input
                className={inputCls}
                maxLength={100}
                value={physicalCity}
                onChange={(e) => setPhysicalCity(e.target.value)}
              />
            </FormField>
            <FormField label="State / Province" required>
              <input
                className={inputCls}
                maxLength={100}
                value={physicalState}
                onChange={(e) => setPhysicalState(e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Postal Code" required>
              <input
                className={inputCls}
                maxLength={20}
                value={physicalPostalCode}
                onChange={(e) => setPhysicalPostalCode(e.target.value)}
                onBlur={physicalAutofill.resolveByPostalCode}
                placeholder="ZIP / postal"
              />
            </FormField>
            <FormField label="Country" required>
              <input
                className={inputCls}
                maxLength={100}
                value={physicalCountry}
                onChange={(e) => setPhysicalCountry(e.target.value)}
                placeholder="USA"
              />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Mailing Address
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMailingEnabled(!mailingEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mailingEnabled ? 'bg-ems-accent' : 'bg-elevated border border-border'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${mailingEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
              <span className="text-xs text-text-secondary">
                {mailingEnabled ? 'Edit' : 'Same as physical'}
              </span>
            </div>
          </div>
          {mailingEnabled ? (
            <>
              <FormField label="Street Address" required>
                <div className="relative">
                  <input
                    className={inputCls}
                    maxLength={200}
                    value={mailingStreet}
                    onChange={(e) => setMailingStreet(e.target.value)}
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
                <FormField label="City" required>
                  <input
                    className={inputCls}
                    maxLength={100}
                    value={mailingCity}
                    onChange={(e) => setMailingCity(e.target.value)}
                  />
                </FormField>
                <FormField label="State / Province" required>
                  <input
                    className={inputCls}
                    maxLength={100}
                    value={mailingState}
                    onChange={(e) => setMailingState(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Postal Code" required>
                  <input
                    className={inputCls}
                    maxLength={20}
                    value={mailingPostalCode}
                    onChange={(e) => setMailingPostalCode(e.target.value)}
                    onBlur={mailingAutofill.resolveByPostalCode}
                  />
                </FormField>
                <FormField label="Country" required>
                  <input
                    className={inputCls}
                    maxLength={100}
                    value={mailingCountry}
                    onChange={(e) => setMailingCountry(e.target.value)}
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

function CompaniesTableSkeleton({ rows = COMPANIES_PAGE_SIZE }: { rows?: number }) {
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
              <th className="text-left py-2.5 px-3">Status</th>
              <th className="w-10" />
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
                <td className="py-3 px-3">
                  <Skeleton className="h-5 w-14 rounded bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-6 w-6 rounded bg-muted/60 ml-auto" />
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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [drawerTab, setDrawerTab] = useState('Overview');
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [companyPendingDelete, setCompanyPendingDelete] = useState<Company | null>(
    null,
  );

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const rows: ApiCompanyListRow[] = await fetchCompanies();
      return rows.map(mapApiCompanyToCompany);
    },
  });

  /** Reload the companies list from the API (exact key so child queries are untouched). */
  const refetchCompanyList = useCallback(async () => {
    await qc.refetchQueries({ queryKey: ['companies'], exact: true });
  }, [qc]);

  const lookupsQuery = useQuery({
    queryKey: ['lookups'],
    queryFn: fetchLookups,
  });

  const companies = companiesQuery.data ?? [];
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

  const selectedCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId) ?? null
    : null;

  const isVenueCompany =
    selectedCompany?.type?.trim().toLowerCase() === 'venue';

  const drawerTabs = useMemo(() => {
    const base: string[] = ['Overview', 'Contacts', 'Engagements', 'Documents'];
    return isVenueCompany ? [...base, 'Venue Profile', 'Ticketing'] : base;
  }, [isVenueCompany]);

  useEffect(() => {
    if (
      !isVenueCompany &&
      (drawerTab === 'Venue Profile' || drawerTab === 'Ticketing')
    ) {
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

  const filtered = useMemo(() => {
    const rows = companies.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== 'All' && c.type !== typeFilter) return false;
      return true;
    });
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [companies, search, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / COMPANIES_PAGE_SIZE));

  const paginated = useMemo(
    () =>
      filtered.slice(
        (page - 1) * COMPANIES_PAGE_SIZE,
        page * COMPANIES_PAGE_SIZE,
      ),
    [filtered, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const isLoadingCompanies = companiesQuery.isPending;
  const rangeStart =
    filtered.length === 0 ? 0 : (page - 1) * COMPANIES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * COMPANIES_PAGE_SIZE, filtered.length);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => deleteCompany(id),
    onSuccess: async () => {
      await refetchCompanyList();
    },
  });

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
              {filtered.length}
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
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search companies..."
            disabled={isLoadingCompanies}
          />
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
        <CompaniesTableSkeleton rows={COMPANIES_PAGE_SIZE} />
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
                  <th className="text-left py-2.5 px-3">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !companiesQuery.isError && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 px-3 text-center text-sm text-text-muted"
                    >
                      {companies.length === 0
                        ? 'No companies returned from the database.'
                        : 'No companies match your search or filters.'}
                    </td>
                  </tr>
                )}
                {paginated.map((c) => (
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
                    <td className="py-2.5 px-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <ActionMenu
                        items={[
                          {
                            label: 'View Details',
                            onClick: () => {
                              setSelectedCompanyId(c.id);
                              setDrawerTab('Overview');
                            },
                          },
                          { label: 'Edit', onClick: () => setEditCompany(c) },
                          {
                            label: 'Delete',
                            onClick: () => setCompanyPendingDelete(c),
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

          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of <span className="text-text-primary font-medium">{filtered.length}</span>
                {filtered.length > COMPANIES_PAGE_SIZE && (
                  <span className="text-text-muted">
                    {' '}
                    ({COMPANIES_PAGE_SIZE} per page)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={page <= 1}
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
                  disabled={page >= pageCount}
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
              <div className="flex gap-1.5 mt-1">
                <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">
                  {selectedCompany.type}
                </span>
                <StatusBadge status={selectedCompany.status} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCompanyId(null)}
              className="text-text-muted hover:text-text-secondary text-lg"
            >
              ✕
            </button>
          </div>

          <TabBar tabs={drawerTabs} active={drawerTab} onChange={setDrawerTab} />

          <div className="p-4">
            {drawerTab === 'Overview' && (
              <OverviewFields selectedCompany={selectedCompany} />
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
                        await createCompanyContact(
                          Number(selectedCompany.id),
                          payload,
                        );
                        await qc.invalidateQueries({
                          queryKey: ['companies', selectedCompany.id, 'contacts'],
                        });
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
                      <th className="text-left py-2">Title</th>
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
                        <td className="py-2 text-text-secondary">{ct.title || '—'}</td>
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
                                onClick: async () => {
                                  if (ct.contactAssignmentId == null) return;
                                  try {
                                    await deleteContactAssignment(
                                      ct.contactAssignmentId,
                                    );
                                    await qc.invalidateQueries({
                                      queryKey: [
                                        'companies',
                                        selectedCompany.id,
                                        'contacts',
                                      ],
                                    });
                                    addToast('Contact removed from this company.', 'warning');
                                  } catch (e) {
                                    addToast(
                                      friendlyApiError(e, 'Could not remove the contact.'),
                                      'error',
                                    );
                                  }
                                },
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

            {drawerTab === 'Ticketing' && isVenueCompany && lookupsQuery.data && (
              <CompanyTicketingPanel
                company={selectedCompany}
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
        >
          <CompanyFormDb
            key="add-company"
            companyTypes={lookupsQuery.data.companyTypes}
            onCancel={() => setShowAddModal(false)}
            onSubmit={async (payload) => {
              try {
                await createCompany(payload as CreateCompanyPayload);
                await refetchCompanyList();
                setShowAddModal(false);
                addToast('Company saved. You can find it in the list.', 'success');
              } catch (e) {
                addToast(friendlyApiError(e, 'Could not save the company.'), 'error');
              }
            }}
          />
        </Modal>
      )}

      {editCompany && lookupsQuery.data && (
        <Modal
          title="Edit Company"
          onClose={() => setEditCompany(null)}
          width={960}
        >
          <CompanyFormDb
            key={editCompany.id}
            companyTypes={lookupsQuery.data.companyTypes}
            initial={editCompany}
            onCancel={() => setEditCompany(null)}
            onSubmit={async (payload) => {
              try {
                await updateCompany(Number(editCompany.id), payload);
                await refetchCompanyList();
                setEditCompany(null);
                addToast('Changes saved.', 'success');
              } catch (e) {
                addToast(friendlyApiError(e, 'Could not save changes.'), 'error');
              }
            }}
          />
        </Modal>
      )}

      {editContact && lookupsQuery.data && selectedCompany && (
        <Modal
          title="Edit Contact"
          onClose={() => setEditContact(null)}
          width={700}
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
                await updateContactAssignment(
                  editContact.contactAssignmentId,
                  payload,
                );
                await qc.invalidateQueries({
                  queryKey: ['companies', selectedCompany.id, 'contacts'],
                });
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
