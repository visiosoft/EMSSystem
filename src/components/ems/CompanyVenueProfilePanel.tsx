import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { ContactPhoneRow } from './ContactPhoneRow';
import { FormField } from './Primitives';
import { Select2 } from './Select2';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/contactPhoneOptions';
import {
  parsePhoneFieldValue,
  tryE164FromDisplay,
  PHONE_INVALID_MESSAGE,
  type PhoneCountrySelection,
} from '@/lib/contactPhoneField';
import type { Company } from '@/data/constants';
import type {
  ApiBrand,
  ApiCompanyContact,
  ApiSeatingType,
  ApiNonResidentWithholdingOption,
  ApiServiceProvided,
  ApiTax,
  ApiVenueDetailsResponse,
  ApiVenueRoleContact,
  ApiVenueType,
} from '@/api/companyApi';
import {
  companiesPickerQueryKey,
  entertainmentComplexCompaniesQueryKey,
  fetchCompaniesPickerRows,
  fetchEntertainmentComplexCompanyRows,
  fetchCompanyContacts,
  fetchVenueDetails,
  fetchVenueProfile,
  provisionVenueProfile,
  updateVenueProfile,
  updateVenueDetails,
} from '@/api/companyApi';
import { allVenuesQueryKey } from '@/api/venueDirectoryApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { TICKETING_SYSTEM_OPTIONS } from '@/lib/ticketingSystemOptions';

interface Props {
  company: Company;
  venueTypes: ApiVenueType[];
  seatingTypes: ApiSeatingType[];
  brands: ApiBrand[];
  taxes: ApiTax[];
  servicesProvided: ApiServiceProvided[];
  nonResidentWithholdings: ApiNonResidentWithholdingOption[];
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

/** For dbo.DMAID / CompanyID (TaxAgencyID) — positive integers only; empty → null. */
function parseOptPositiveInt(s: string): number | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function newClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random()}`;
}

type VenueLocalContactBlock = {
  id: string;
  contactInfoPick: string;
  fullName: string;
  email: string;
  workPhoneCountry: PhoneCountrySelection;
  workPhoneDisplay: string;
  cellPhoneCountry: PhoneCountrySelection;
  cellPhoneDisplay: string;
};

function emptyContactBlock(): VenueLocalContactBlock {
  return {
    id: newClientId(),
    contactInfoPick: '',
    fullName: '',
    email: '',
    workPhoneCountry: '',
    workPhoneDisplay: '',
    cellPhoneCountry: '',
    cellPhoneDisplay: '',
  };
}

type SectionSaveKey =
  | 'core'
  | 'loadDock'
  | 'finance'
  | 'marketing'
  | 'technical'
  | 'ticketing'
  | 'booking'
  | 'amusement'
  | 'nrw'
  | null;

type VenueSectionBaselines = {
  core: string;
  loadDock: string;
  finance: string;
  marketing: string;
  technical: string;
  ticketing: string;
  booking: string;
  amusement: string;
  nrw: string;
};

function apiRowToBlock(row: ApiVenueRoleContact): VenueLocalContactBlock {
  const w = parsePhoneFieldValue(row.phone, DEFAULT_PHONE_COUNTRY, {
    noCountryWhenEmpty: true,
  });
  const c = parsePhoneFieldValue(row.cellPhone, DEFAULT_PHONE_COUNTRY, {
    noCountryWhenEmpty: true,
  });
  return {
    id: newClientId(),
    contactInfoPick: String(row.contactInfoId),
    fullName: row.fullName ?? '',
    email: row.email ?? '',
    workPhoneCountry: w.country,
    workPhoneDisplay: w.display,
    cellPhoneCountry: c.country,
    cellPhoneDisplay: c.display,
  };
}

function blockPhonesToE164(b: VenueLocalContactBlock): { phone: string; cellPhone: string } {
  return {
    phone: tryE164FromDisplay(b.workPhoneDisplay, b.workPhoneCountry) || '',
    cellPhone: tryE164FromDisplay(b.cellPhoneDisplay, b.cellPhoneCountry) || '',
  };
}

function validateContactBlocks(blocks: VenueLocalContactBlock[]): string | null {
  for (const b of blocks) {
    if (b.workPhoneDisplay.trim() && !b.workPhoneCountry) {
      return 'Select a country for work phone, or clear the number.';
    }
    if (b.cellPhoneDisplay.trim() && !b.cellPhoneCountry) {
      return 'Select a country for cell phone, or clear the number.';
    }
    const p = blockPhonesToE164(b);
    if (b.workPhoneDisplay.trim() && !p.phone) {
      return PHONE_INVALID_MESSAGE;
    }
    if (b.cellPhoneDisplay.trim() && !p.cellPhone) {
      return PHONE_INVALID_MESSAGE;
    }
  }
  return null;
}

function blocksToContactPayload(blocks: VenueLocalContactBlock[] | undefined) {
  const list = Array.isArray(blocks) ? blocks : [];
  return list
    .map((b) => {
      const { phone, cellPhone } = blockPhonesToE164(b);
      return {
        fullName: b.fullName.trim(),
        email: b.email.trim(),
        phone,
        cellPhone,
      };
    })
    .filter(
      (c) => c.email.length + c.fullName.length + c.phone.length + c.cellPhone.length > 0,
    );
}

function contactBlocksSignature(blocks: VenueLocalContactBlock[] | undefined) {
  return JSON.stringify(blocksToContactPayload(blocks));
}

function loadDockFromFormFields(
  line1: string,
  line2: string,
  city: string,
  state: string,
  postal: string,
  country: string,
) {
  const loadDock = {
    addressLine1: line1.trim(),
    addressLine2: line2.trim(),
    city: city.trim(),
    stateProvince: state.trim(),
    postalCode: postal.trim(),
    country: country.trim(),
  };
  const hasAny = Object.values(loadDock).some((v) => v.length > 0);
  if (!hasAny) return null;
  return {
    addressLine1: loadDock.addressLine1,
    addressLine2: loadDock.addressLine2 || null,
    city: loadDock.city,
    stateProvince: loadDock.stateProvince,
    postalCode: loadDock.postalCode,
    country: loadDock.country,
  };
}

function taxIdsSignatureFromState(
  taxIds: number[],
  stateTaxId: string,
  cityTaxId: string,
  stateOn: boolean,
  cityOn: boolean,
  taxes: ApiTax[] | undefined,
) {
  const taxById = new Map((taxes ?? []).map((t) => [t.taxId, t]));
  const other = (taxIds ?? []).filter((id) => {
    const t = taxById.get(id);
    if (!t) return true;
    const j = t.taxJurisdictionType?.toLowerCase();
    return j !== 'state' && j !== 'city';
  });
  const out: number[] = [...other];
  const st = stateTaxId ? Number(stateTaxId) : null;
  const ct = cityTaxId ? Number(cityTaxId) : null;
  if (stateOn && st != null && Number.isFinite(st)) out.push(st);
  if (cityOn && ct != null && Number.isFinite(ct)) out.push(ct);
  return JSON.stringify([...new Set(out)].sort((a, b) => a - b));
}

function taxIdsSignatureFromServerDetails(
  d: Extract<ApiVenueDetailsResponse, { missing: false }>,
  taxes: ApiTax[] | undefined,
) {
  return taxIdsSignatureFromState(
    d.taxIds ?? [],
    (() => {
      const taxById = new Map((taxes ?? []).map((t) => [t.taxId, t]));
      const current = (d.taxIds ?? [])
        .map((id) => taxById.get(id))
        .filter(Boolean) as ApiTax[];
      const st = current.find((t) => t.taxJurisdictionType?.toLowerCase() === 'state');
      return st ? String(st.taxId) : '';
    })(),
    (() => {
      const taxById = new Map((taxes ?? []).map((t) => [t.taxId, t]));
      const current = (d.taxIds ?? [])
        .map((id) => taxById.get(id))
        .filter(Boolean) as ApiTax[];
      const ct = current.find((t) => t.taxJurisdictionType?.toLowerCase() === 'city');
      return ct ? String(ct.taxId) : '';
    })(),
    d.hasStateTaxOnTickets === 1,
    d.hasCityTaxOnTickets === 1,
    taxes,
  );
}

function nonResidentWireSignature(args: {
  id: string;
  taxRate: string;
  dma: string;
  agency: string;
  linkName: string;
  linkUrl: string;
  mail: string;
  iae: string;
  artist: string;
}): string {
  return JSON.stringify({
    id: String(args.id ?? '').trim(),
    taxRate: String(args.taxRate ?? '').trim(),
    dma: String(args.dma ?? '').replace(/\D/g, ''),
    agency: String(args.agency ?? '').replace(/\D/g, ''),
    linkName: String(args.linkName ?? '').trim(),
    linkUrl: String(args.linkUrl ?? '').trim(),
    mail: String(args.mail ?? '').trim(),
    iae: String(args.iae ?? '').trim(),
    artist: String(args.artist ?? '').trim(),
  });
}

function contactSigFromApiRows(rows: ApiVenueRoleContact[] | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return contactBlocksSignature([]);
  }
  return contactBlocksSignature(rows.map(apiRowToBlock));
}

function dedupeContactsByInfoId(rows: ApiCompanyContact[]): ApiCompanyContact[] {
  const m = new Map<number, ApiCompanyContact>();
  for (const r of rows) {
    if (!m.has(r.contactInfoId)) m.set(r.contactInfoId, r);
  }
  return [...m.values()].sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });
}

function VenueRoleContactBlockGroup({
  roleTitle,
  blocks,
  onUpdate,
  onAdd,
  onRemove,
  getOptions,
  onPick,
  inputCls,
}: {
  roleTitle: string;
  blocks: VenueLocalContactBlock[] | undefined;
  onUpdate: (id: string, patch: Partial<VenueLocalContactBlock>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  getOptions: (block: VenueLocalContactBlock) => { value: string; label: string }[];
  onPick: (id: string, value: string) => void;
  inputCls: string;
}) {
  const list = Array.isArray(blocks) ? blocks : [];

  return (
    <div className="space-y-6">
      {list.map((block, idx) => (
        <div
          key={block.id}
          className="space-y-3 border-b border-border last:border-0 last:pb-0 pb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(6.5rem,8.5rem)_1fr] gap-x-3 gap-y-2">
            <div className="text-sm font-medium text-text-primary sm:pt-0.5">
              {idx === 0 ? roleTitle : ''}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  <Select2
                    className="w-full"
                    value={block.contactInfoPick}
                    onChange={(v) => onPick(block.id, v)}
                    options={getOptions(block)}
                    placeholder="Name"
                  />
                </div>
                {idx === 0 && (
                  <button
                    type="button"
                    onClick={onAdd}
                    className="flex-shrink-0 p-1.5 rounded-md text-emerald-600 hover:bg-emerald-600/10"
                    title="Add another"
                    aria-label="Add another contact"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                )}
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => onRemove(block.id)}
                    className="flex-shrink-0 p-1.5 rounded-md text-text-muted hover:bg-hover"
                    aria-label="Remove this contact"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <ContactPhoneRow
                id={`${block.id}-work`}
                label="Work Phone"
                country={block.workPhoneCountry}
                display={block.workPhoneDisplay}
                onCountry={(c) => onUpdate(block.id, { workPhoneCountry: c })}
                onDisplay={(d) => onUpdate(block.id, { workPhoneDisplay: d })}
              />
              <ContactPhoneRow
                id={`${block.id}-cell`}
                label="Cell Phone"
                country={block.cellPhoneCountry}
                display={block.cellPhoneDisplay}
                onCountry={(c) => onUpdate(block.id, { cellPhoneCountry: c })}
                onDisplay={(d) => onUpdate(block.id, { cellPhoneDisplay: d })}
              />
              <input
                className={inputCls}
                type="email"
                value={block.email}
                onChange={(e) => onUpdate(block.id, { email: e.target.value })}
                placeholder="Email"
                autoComplete="email"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompanyVenueProfilePanel({
  company,
  venueTypes,
  seatingTypes,
  brands,
  taxes,
  servicesProvided,
  nonResidentWithholdings,
  addToast,
}: Props) {
  const qc = useQueryClient();
  const companyId = Number(company.id);

  const vq = useQuery({
    queryKey: ['companies', company.id, 'venue-profile'],
    queryFn: () => fetchVenueProfile(companyId),
    enabled: Number.isFinite(companyId),
  });

  const detailsQ = useQuery({
    queryKey: ['companies', company.id, 'venue-details'],
    queryFn: () => fetchVenueDetails(companyId),
    enabled: Number.isFinite(companyId),
  });

  const companiesPickerQ = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const entertainmentComplexPickerQ = useQuery({
    queryKey: entertainmentComplexCompaniesQueryKey(),
    queryFn: fetchEntertainmentComplexCompanyRows,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const companyContactsQ = useQuery({
    queryKey: ['companies', String(company.id), 'contacts'],
    queryFn: () => fetchCompanyContacts(companyId),
    enabled: Number.isFinite(companyId),
    staleTime: 2 * 60 * 1000,
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
  const [entertainmentComplexCompanyId, setEntertainmentComplexCompanyId] = useState<
    number | null
  >(null);
  const entertainmentComplexCompanyIdRef = useRef<number | null>(null);
  const [seatingTypeId, setSeatingTypeId] = useState<string>('');
  const [loadDockAddressLine1, setLoadDockAddressLine1] = useState('');
  const [loadDockAddressLine2, setLoadDockAddressLine2] = useState('');
  const [loadDockCity, setLoadDockCity] = useState('');
  const [loadDockStateProvince, setLoadDockStateProvince] = useState('');
  const [loadDockPostalCode, setLoadDockPostalCode] = useState('');
  const [loadDockCountry, setLoadDockCountry] = useState('');
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [financeBlocks, setFinanceBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [settlementBlocks, setSettlementBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [marketingBlocks, setMarketingBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [technicalBlocks, setTechnicalBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [stagehandContactBlocks, setStagehandContactBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [ticketingManagerBlocks, setTicketingManagerBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [bookingDirectorBlocks, setBookingDirectorBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [rentalManagerBlocks, setRentalManagerBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [calendarManagerBlocks, setCalendarManagerBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [contractManagerBlocks, setContractManagerBlocks] = useState<VenueLocalContactBlock[]>([
    emptyContactBlock(),
  ]);
  const [taxIds, setTaxIds] = useState<number[]>([]);
  const [nonResidentWithholdingId, setNonResidentWithholdingId] = useState('');
  const [stateTaxId, setStateTaxId] = useState<string>('');
  const [cityTaxId, setCityTaxId] = useState<string>('');
  const [withholdingTaxRate, setWithholdingTaxRate] = useState('');
  const [withholdingDmaId, setWithholdingDmaId] = useState<string>('');
  const [withholdingTaxAgencyCompanyId, setWithholdingTaxAgencyCompanyId] =
    useState<string>('');
  const [withholdingLinkUrl, setWithholdingLinkUrl] = useState('');
  const [withholdingLinkName, setWithholdingLinkName] = useState('');
  const [withholdingMailingAddress, setWithholdingMailingAddress] = useState('');
  const [iaeWaiverUrl, setIaeWaiverUrl] = useState('');
  const [artistWaiverUrl, setArtistWaiverUrl] = useState('');
  const [withholdingLinkId, setWithholdingLinkId] = useState<number | null>(null);
  const [iaeWaiverLinkId, setIaeWaiverLinkId] = useState<number | null>(null);
  const [artistWaiverLinkId, setArtistWaiverLinkId] = useState<number | null>(null);
  const [draftOnly, setDraftOnly] = useState<Record<string, string>>({});
  const [draftOnlyFlags, setDraftOnlyFlags] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<SectionSaveKey>(null);
  const [sectionBaseline, setSectionBaseline] = useState<VenueSectionBaselines | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  const baseNameContactOptions = useMemo(() => {
    const rows = dedupeContactsByInfoId(companyContactsQ.data ?? []);
    return [
      { value: '', label: 'Name' },
      ...rows.map((r) => ({
        value: String(r.contactInfoId),
        label: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email,
      })),
    ];
  }, [companyContactsQ.data]);

  const contactByInfoId = useMemo(() => {
    const rows = dedupeContactsByInfoId(companyContactsQ.data ?? []);
    const m = new Map<number, ApiCompanyContact>();
    for (const r of rows) m.set(r.contactInfoId, r);
    return m;
  }, [companyContactsQ.data]);

  const contactOptionsForBlock = useCallback(
    (pick: string, fullName: string) => {
      if (!pick) return baseNameContactOptions;
      if (baseNameContactOptions.some((o) => o.value === pick)) {
        return baseNameContactOptions;
      }
      const label = fullName.trim() || 'Contact';
      return [...baseNameContactOptions, { value: pick, label }];
    },
    [baseNameContactOptions],
  );

  const applyBlockContactPick = useCallback(
    (
      set: React.Dispatch<React.SetStateAction<VenueLocalContactBlock[]>>,
      blockId: string,
      idStr: string,
    ) => {
      set((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) {
            return b;
          }
          if (!idStr) {
            return { ...b, ...emptyContactBlock(), id: b.id, contactInfoPick: '' };
          }
          const c = contactByInfoId.get(Number(idStr));
          if (!c) {
            return { ...b, contactInfoPick: idStr };
          }
          const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
          const w = parsePhoneFieldValue(c.workPhone, DEFAULT_PHONE_COUNTRY, {
            noCountryWhenEmpty: true,
          });
          const c2 = parsePhoneFieldValue(c.cellPhone, DEFAULT_PHONE_COUNTRY, {
            noCountryWhenEmpty: true,
          });
          return {
            ...b,
            contactInfoPick: idStr,
            fullName: name,
            email: c.email,
            workPhoneCountry: w.country,
            workPhoneDisplay: w.display,
            cellPhoneCountry: c2.country,
            cellPhoneDisplay: c2.display,
          };
        }),
      );
    },
    [contactByInfoId],
  );

  const brandAddOptions = useMemo(
    () =>
      (brands ?? [])
        .filter((b) => !brandIds.includes(b.brandId))
        .map((b) => ({ value: String(b.brandId), label: b.brandName })),
    [brands, brandIds],
  );

  const venueMgmtCompanyOptions = useMemo(() => {
    const rows = companiesPickerQ.data ?? [];
    const filtered = rows.filter(
      (r) => String(r.companyTypeName ?? '').trim().toLowerCase() === 'venue management company',
    );
    return filtered.map((r) => ({
      value: String(r.companyId),
      label: r.companyName,
    }));
  }, [companiesPickerQ.data]);

  const entertainmentComplexNameById = useMemo(() => {
    const m = new Map<number, string>();
    const d = vq.data;
    if (d && !d.missing) {
      for (const x of d.entertainmentComplexes ?? []) {
        m.set(x.companyId, x.companyName);
      }
    }
    for (const c of entertainmentComplexPickerQ.data ?? []) {
      if (!m.has(c.companyId)) m.set(c.companyId, c.companyName);
    }
    return m;
  }, [vq.data, entertainmentComplexPickerQ.data]);

  /** Single-select list: all entertainment-complex companies except this venue. */
  const entertainmentComplexSelectOptions = useMemo(() => {
    const rows = entertainmentComplexPickerQ.data ?? [];
    const opts = rows
      .filter((r) => r.companyId !== companyId)
      .map((r) => ({ value: String(r.companyId), label: r.companyName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    const sel = entertainmentComplexCompanyId;
    if (
      sel != null &&
      Number.isInteger(sel) &&
      sel > 0 &&
      !opts.some((o) => o.value === String(sel))
    ) {
      const label = entertainmentComplexNameById.get(sel) ?? `#${sel}`;
      opts.push({ value: String(sel), label });
      opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }
    return opts;
  }, [
    entertainmentComplexPickerQ.data,
    companyId,
    entertainmentComplexCompanyId,
    entertainmentComplexNameById,
  ]);

  const venueTypeOptions = useMemo(
    () =>
      (venueTypes ?? []).map((v) => ({
        value: String(v.venueTypeId),
        label: v.venueTypeName,
      })),
    [venueTypes],
  );

  const seatingOptions = useMemo(
    () =>
      (seatingTypes ?? []).map((s) => ({
        value: String(s.seatingTypeId),
        label: s.seatingName,
      })),
    [seatingTypes],
  );

  const ticketingSystemOptions = useMemo(
    () => [
      { value: '', label: 'Clear…' },
      ...TICKETING_SYSTEM_OPTIONS.map((name) => ({ value: name, label: name })),
    ],
    [],
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
    const ids = Array.isArray(full.entertainmentComplexCompanyIds)
      ? full.entertainmentComplexCompanyIds.filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const single = ids[0] ?? null;
    entertainmentComplexCompanyIdRef.current = single;
    setEntertainmentComplexCompanyId(single);
    setSeatingTypeId(full.seatingTypeId != null ? String(full.seatingTypeId) : '');
    setLoadDockAddressLine1(full.loadDockAddress?.addressLine1 ?? '');
    setLoadDockAddressLine2(full.loadDockAddress?.addressLine2 ?? '');
    setLoadDockCity(full.loadDockAddress?.city ?? '');
    setLoadDockStateProvince(full.loadDockAddress?.stateProvince ?? '');
    setLoadDockPostalCode(full.loadDockAddress?.postalCode ?? '');
    setLoadDockCountry(full.loadDockAddress?.country ?? '');
  }, [vq.data]);

  useEffect(() => {
    entertainmentComplexCompanyIdRef.current = entertainmentComplexCompanyId;
  }, [entertainmentComplexCompanyId]);

  useEffect(() => {
    const d = detailsQ.data;
    if (!d || d.missing) return;
    setBrandIds(d.brandIds ?? []);
    setTaxIds(d.taxIds ?? []);
    setNonResidentWithholdingId(
      d.nonResidentWithholdingId != null
        ? String(d.nonResidentWithholdingId)
        : (nonResidentWithholdings?.length === 1
            ? String(nonResidentWithholdings[0].withholdingId)
            : ''),
    );
    setDraftOnlyFlags((prev) => ({
      ...prev,
      stateTaxOnTickets: d.hasStateTaxOnTickets === 1,
      cityTaxOnTickets: d.hasCityTaxOnTickets === 1,
    }));

    // Derive pickers from taxIds
    const taxById = new Map<number, ApiTax>();
    (taxes ?? []).forEach((t) => taxById.set(t.taxId, t));
    const current = (d.taxIds ?? []).map((id) => taxById.get(id)).filter(Boolean) as ApiTax[];
    const st = current.find((t) => t.taxJurisdictionType?.toLowerCase() === 'state');
    const ct = current.find((t) => t.taxJurisdictionType?.toLowerCase() === 'city');
    setStateTaxId(st ? String(st.taxId) : '');
    setCityTaxId(ct ? String(ct.taxId) : '');

    // Persisted venue contacts → hydrate form fields
    setFinanceBlocks(
      Array.isArray(d.financeDirectors) && d.financeDirectors.length > 0
        ? d.financeDirectors.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setSettlementBlocks(
      Array.isArray(d.settlementManagers) && d.settlementManagers.length > 0
        ? d.settlementManagers.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setMarketingBlocks(
      Array.isArray(d.marketingDirectors) && d.marketingDirectors.length > 0
        ? d.marketingDirectors.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setTechnicalBlocks(
      Array.isArray(d.technicalDirectors) && d.technicalDirectors.length > 0
        ? d.technicalDirectors.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setStagehandContactBlocks(
      Array.isArray(d.stagehandProviderContacts) && d.stagehandProviderContacts.length > 0
        ? d.stagehandProviderContacts.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setTicketingManagerBlocks(
      Array.isArray(d.ticketingManagers) && d.ticketingManagers.length > 0
        ? d.ticketingManagers.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setBookingDirectorBlocks(
      Array.isArray(d.bookingDirectors) && d.bookingDirectors.length > 0
        ? d.bookingDirectors.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setRentalManagerBlocks(
      Array.isArray(d.rentalManagers) && d.rentalManagers.length > 0
        ? d.rentalManagers.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setCalendarManagerBlocks(
      Array.isArray(d.calendarManagers) && d.calendarManagers.length > 0
        ? d.calendarManagers.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    setContractManagerBlocks(
      Array.isArray(d.contractManagers) && d.contractManagers.length > 0
        ? d.contractManagers.map(apiRowToBlock)
        : [emptyContactBlock()],
    );
    const w = d.nonResidentWithholding;
    if (w) {
      setWithholdingTaxRate(w.withholdingTaxRate ?? '');
      setWithholdingDmaId(w.dmaid != null ? String(w.dmaid) : '');
      setWithholdingTaxAgencyCompanyId(
        w.taxAgencyId != null ? String(w.taxAgencyId) : '',
      );
      setWithholdingLinkId(w.withholdingLink?.linkId ?? null);
      setWithholdingLinkUrl(w.withholdingLink?.linkUrl ?? '');
      setWithholdingLinkName(w.withholdingLink?.linkName ?? '');
      setWithholdingMailingAddress(w.withholdingLink?.linkPath ?? '');
      setIaeWaiverLinkId(w.iaeWaiverInstructions?.linkId ?? null);
      setIaeWaiverUrl(w.iaeWaiverInstructions?.linkUrl ?? '');
      setArtistWaiverLinkId(w.artistWaiverInstructions?.linkId ?? null);
      setArtistWaiverUrl(w.artistWaiverInstructions?.linkUrl ?? '');
    } else {
      setWithholdingTaxRate('');
      setWithholdingDmaId('');
      setWithholdingTaxAgencyCompanyId('');
      setWithholdingLinkId(null);
      setWithholdingLinkUrl('');
      setWithholdingLinkName('');
      setWithholdingMailingAddress('');
      setIaeWaiverLinkId(null);
      setIaeWaiverUrl('');
      setArtistWaiverLinkId(null);
      setArtistWaiverUrl('');
    }
  }, [detailsQ.data, taxes, nonResidentWithholdings]);

  useEffect(() => {
    const vp = vq.data;
    const d = detailsQ.data;
    if (!vp || vp.missing || !d || d.missing) {
      setSectionBaseline(null);
      return;
    }
    const full = vp;
    const effNrwId =
      d.nonResidentWithholdingId != null
        ? String(d.nonResidentWithholdingId)
        : (nonResidentWithholdings?.length === 1
            ? String(nonResidentWithholdings[0].withholdingId)
            : '');

    const loadDock = loadDockFromFormFields(
      full.loadDockAddress?.addressLine1 ?? '',
      full.loadDockAddress?.addressLine2 ?? '',
      full.loadDockAddress?.city ?? '',
      full.loadDockAddress?.stateProvince ?? '',
      full.loadDockAddress?.postalCode ?? '',
      full.loadDockAddress?.country ?? '',
    );

    const w = d.nonResidentWithholding;
    setSectionBaseline({
      core: JSON.stringify({
        venueName: full.venueName,
        seatingCapacity: String(full.seatingCapacity),
        salesTaxRate: taxRateToFormValue(full.salesTaxRate),
        insuranceLanguage: full.insuranceLanguage ?? '',
        venueTypeId: full.venueTypeId != null ? String(full.venueTypeId) : '',
        entertainmentComplexCompanyId:
          (full.entertainmentComplexCompanyIds ?? []).find(
            (id) => Number.isInteger(id) && id > 0,
          ) ?? null,
      }),
      loadDock: JSON.stringify(loadDock),
      finance: JSON.stringify([
        contactSigFromApiRows(d.financeDirectors),
        contactSigFromApiRows(d.settlementManagers),
      ]),
      marketing: JSON.stringify({
        brands: [...(d.brandIds ?? [])].sort((a, b) => a - b),
        c: contactSigFromApiRows(d.marketingDirectors),
      }),
      technical: JSON.stringify({
        t: contactSigFromApiRows(d.technicalDirectors),
        s: contactSigFromApiRows(d.stagehandProviderContacts),
        d: loadDock,
      }),
      ticketing: JSON.stringify({
        seat: full.seatingTypeId != null ? String(full.seatingTypeId) : '',
        m: contactSigFromApiRows(d.ticketingManagers),
      }),
      booking: JSON.stringify({
        ins: full.insurancePolicyCopyRequirements ?? '',
        iae: String(full.venueRelationshipIae ?? ''),
        b: contactSigFromApiRows(d.bookingDirectors),
        r: contactSigFromApiRows(d.rentalManagers),
        c: contactSigFromApiRows(d.calendarManagers),
        x: contactSigFromApiRows(d.contractManagers),
      }),
      amusement: JSON.stringify({
        cart: full.taxInCart,
        st: d.hasStateTaxOnTickets === 1,
        ct: d.hasCityTaxOnTickets === 1,
        t: taxIdsSignatureFromServerDetails(
          d as Extract<ApiVenueDetailsResponse, { missing: false }>,
          taxes,
        ),
      }),
      nrw: nonResidentWireSignature(
        w
          ? {
              id: effNrwId,
              taxRate: w.withholdingTaxRate ?? '',
              dma: w.dmaid != null ? String(w.dmaid) : '',
              agency: w.taxAgencyId != null ? String(w.taxAgencyId) : '',
              linkName: w.withholdingLink?.linkName ?? '',
              linkUrl: w.withholdingLink?.linkUrl ?? '',
              mail: w.withholdingLink?.linkPath ?? '',
              iae: w.iaeWaiverInstructions?.linkUrl ?? '',
              artist: w.artistWaiverInstructions?.linkUrl ?? '',
            }
          : {
              id: effNrwId,
              taxRate: '',
              dma: '',
              agency: '',
              linkName: '',
              linkUrl: '',
              mail: '',
              iae: '',
              artist: '',
            },
      ),
    });
  }, [vq.data, detailsQ.data, taxes, nonResidentWithholdings, companyId]);

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/90 focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';
  const sectionCls = 'rounded-xl border border-border bg-card/40 p-5 space-y-4';
  const sectionSaveBtnCls =
    'inline-flex items-center justify-center gap-2 min-w-[8.5rem] bg-ems-accent text-background text-sm px-4 py-2 rounded-md font-semibold disabled:opacity-60';

  const setDraftOnlyField = (key: string, value: string) => {
    setDraftOnly((prev) => ({ ...prev, [key]: value }));
  };

  const setDraftOnlyFlag = (key: string, value: boolean) => {
    setDraftOnlyFlags((prev) => ({ ...prev, [key]: value }));
  };

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

  const isSaving = savingKey !== null;

  const isCoreDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify({
        venueName: venueName.trim(),
        seatingCapacity,
        salesTaxRate: taxRateToFormValue(salesTaxRate),
        insuranceLanguage: insuranceLanguage ?? '',
        venueTypeId: venueTypeId || '',
        entertainmentComplexCompanyId,
      }) !== sectionBaseline.core
    );
  }, [
    sectionBaseline,
    venueName,
    seatingCapacity,
    salesTaxRate,
    insuranceLanguage,
    venueTypeId,
    entertainmentComplexCompanyId,
  ]);

  const isLoadDockDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify(
        loadDockFromFormFields(
          loadDockAddressLine1,
          loadDockAddressLine2,
          loadDockCity,
          loadDockStateProvince,
          loadDockPostalCode,
          loadDockCountry,
        ),
      ) !== sectionBaseline.loadDock
    );
  }, [
    sectionBaseline,
    loadDockAddressLine1,
    loadDockAddressLine2,
    loadDockCity,
    loadDockStateProvince,
    loadDockPostalCode,
    loadDockCountry,
  ]);

  const isFinanceDirty = useMemo(
    () =>
      !!sectionBaseline &&
      JSON.stringify([
        contactBlocksSignature(financeBlocks),
        contactBlocksSignature(settlementBlocks),
      ]) !== sectionBaseline.finance,
    [sectionBaseline, financeBlocks, settlementBlocks],
  );

  const isMarketingDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify({
        brands: [...brandIds].sort((a, b) => a - b),
        c: contactBlocksSignature(marketingBlocks),
      }) !== sectionBaseline.marketing
    );
  }, [sectionBaseline, brandIds, marketingBlocks]);

  const isTechnicalDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify({
        t: contactBlocksSignature(technicalBlocks),
        s: contactBlocksSignature(stagehandContactBlocks),
        d: loadDockFromFormFields(
          loadDockAddressLine1,
          loadDockAddressLine2,
          loadDockCity,
          loadDockStateProvince,
          loadDockPostalCode,
          loadDockCountry,
        ),
      }) !== sectionBaseline.technical
    );
  }, [
    sectionBaseline,
    technicalBlocks,
    stagehandContactBlocks,
    loadDockAddressLine1,
    loadDockAddressLine2,
    loadDockCity,
    loadDockStateProvince,
    loadDockPostalCode,
    loadDockCountry,
  ]);

  const isTicketingDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify({
        seat: seatingTypeId || '',
        m: contactBlocksSignature(ticketingManagerBlocks),
      }) !== sectionBaseline.ticketing
    );
  }, [sectionBaseline, seatingTypeId, ticketingManagerBlocks]);

  const isBookingDirty = useMemo(
    () =>
      !!sectionBaseline &&
      JSON.stringify({
        ins: insurancePolicyCopyRequirements,
        iae: String(venueRelationshipIae ?? ''),
        b: contactBlocksSignature(bookingDirectorBlocks),
        r: contactBlocksSignature(rentalManagerBlocks),
        c: contactBlocksSignature(calendarManagerBlocks),
        x: contactBlocksSignature(contractManagerBlocks),
      }) !== sectionBaseline.booking,
    [
      sectionBaseline,
      insurancePolicyCopyRequirements,
      venueRelationshipIae,
      bookingDirectorBlocks,
      rentalManagerBlocks,
      calendarManagerBlocks,
      contractManagerBlocks,
    ],
  );

  const isAmusementDirty = useMemo(() => {
    if (!sectionBaseline) return false;
    return (
      JSON.stringify({
        cart: taxInCart,
        st: !!draftOnlyFlags.stateTaxOnTickets,
        ct: !!draftOnlyFlags.cityTaxOnTickets,
        t: taxIdsSignatureFromState(
          taxIds,
          stateTaxId,
          cityTaxId,
          !!draftOnlyFlags.stateTaxOnTickets,
          !!draftOnlyFlags.cityTaxOnTickets,
          taxes,
        ),
      }) !== sectionBaseline.amusement
    );
  }, [
    sectionBaseline,
    taxInCart,
    draftOnlyFlags.stateTaxOnTickets,
    draftOnlyFlags.cityTaxOnTickets,
    taxIds,
    stateTaxId,
    cityTaxId,
    taxes,
  ]);

  const isNrwDirty = useMemo(
    () =>
      !!sectionBaseline &&
      nonResidentWireSignature({
        id: nonResidentWithholdingId,
        taxRate: withholdingTaxRate,
        dma: withholdingDmaId,
        agency: withholdingTaxAgencyCompanyId,
        linkName: withholdingLinkName,
        linkUrl: withholdingLinkUrl,
        mail: withholdingMailingAddress,
        iae: iaeWaiverUrl,
        artist: artistWaiverUrl,
      }) !== sectionBaseline.nrw,
    [
      sectionBaseline,
      nonResidentWithholdingId,
      withholdingTaxRate,
      withholdingDmaId,
      withholdingTaxAgencyCompanyId,
      withholdingLinkName,
      withholdingLinkUrl,
      withholdingMailingAddress,
      iaeWaiverUrl,
      artistWaiverUrl,
    ],
  );

  const getLoadDockApi = (): {
    err: string | null;
    value: {
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    } | null;
  } => {
    const loadDock = {
      addressLine1: loadDockAddressLine1.trim(),
      addressLine2: loadDockAddressLine2.trim(),
      city: loadDockCity.trim(),
      stateProvince: loadDockStateProvince.trim(),
      postalCode: loadDockPostalCode.trim(),
      country: loadDockCountry.trim(),
    };
    const hasAnyLoadDockField = Object.values(loadDock).some((v) => v.length > 0);
    const hasAllRequiredLoadDockFields =
      loadDock.addressLine1.length > 0 &&
      loadDock.city.length > 0 &&
      loadDock.stateProvince.length > 0 &&
      loadDock.postalCode.length > 0 &&
      loadDock.country.length > 0;
    if (hasAnyLoadDockField && !hasAllRequiredLoadDockFields) {
      return {
        err: 'Load-in dock address needs line 1, city, state or province, postal code, and country. Clear all fields to remove the address.',
        value: null,
      };
    }
    return {
      err: null,
      value: hasAnyLoadDockField
        ? {
            addressLine1: loadDock.addressLine1,
            addressLine2: loadDock.addressLine2 || null,
            city: loadDock.city,
            stateProvince: loadDock.stateProvince,
            postalCode: loadDock.postalCode,
            country: loadDock.country,
          }
        : null,
    };
  };

  const buildTaxIdsPayload = () => {
    const taxById = new Map((taxes ?? []).map((t) => [t.taxId, t]));
    const other = (taxIds ?? []).filter((id) => {
      const t = taxById.get(id);
      if (!t) return true;
      const j = t.taxJurisdictionType?.toLowerCase();
      return j !== 'state' && j !== 'city';
    });
    const out: number[] = [...other];
    const st = stateTaxId ? Number(stateTaxId) : null;
    const ct = cityTaxId ? Number(cityTaxId) : null;
    if (draftOnlyFlags.stateTaxOnTickets && st != null && Number.isFinite(st)) out.push(st);
    if (draftOnlyFlags.cityTaxOnTickets && ct != null && Number.isFinite(ct)) out.push(ct);
    return Array.from(new Set(out));
  };

  /** Only refetch the server data the saved section actually changes (getVenueDetails is heavy). */
  const refetchAfterSectionSave = (section: NonNullable<SectionSaveKey>) => {
    const inv = (kind: 'venue-profile' | 'venue-details') =>
      qc.invalidateQueries({ queryKey: ['companies', company.id, kind] });
    switch (section) {
      case 'core':
        return Promise.all([
          inv('venue-profile'),
          inv('venue-details'),
          qc.invalidateQueries({ queryKey: allVenuesQueryKey }),
        ]);
      case 'loadDock':
        return inv('venue-profile');
      case 'finance':
      case 'marketing':
        return inv('venue-details');
      case 'technical':
      case 'ticketing':
      case 'booking':
      case 'amusement':
        return Promise.all([inv('venue-profile'), inv('venue-details')]);
      case 'nrw':
        return inv('venue-details');
    }
  };

  const buildNonResidentWithholdingBody = () => ({
    withholdingTaxRate,
    dmaid: parseOptPositiveInt(withholdingDmaId),
    taxAgencyId: parseOptPositiveInt(withholdingTaxAgencyCompanyId),
    withholdingLink:
      withholdingLinkUrl.trim() || withholdingLinkName.trim() || withholdingMailingAddress.trim()
        ? {
            linkId: withholdingLinkId,
            linkType: 'URL' as const,
            linkUrl: withholdingLinkUrl,
            linkName: withholdingLinkName,
            linkPath: withholdingMailingAddress,
          }
        : null,
    iaeWaiverInstructions: iaeWaiverUrl.trim()
      ? {
          linkId: iaeWaiverLinkId,
          linkType: 'URL' as const,
          linkUrl: iaeWaiverUrl,
          linkName: '',
          linkPath: '',
        }
      : null,
    artistWaiverInstructions: artistWaiverUrl.trim()
      ? {
          linkId: artistWaiverLinkId,
          linkType: 'URL' as const,
          linkUrl: artistWaiverUrl,
          linkName: '',
          linkPath: '',
        }
      : null,
  });

  const saveCoreVenue = async () => {
    if (!venueName.trim()) {
      addToast('Enter a venue name.', 'warning');
      return;
    }
    const cap = Number.parseInt(seatingCapacity, 10);
    if (!Number.isFinite(cap) || cap < 0) {
      addToast('Seating capacity must be a non-negative number.', 'warning');
      return;
    }
    setSavingKey('core');
    try {
      await updateVenueProfile(companyId, {
        venueName: venueName.trim(),
        seatingCapacity: cap,
        salesTaxRate: trimTaxRatePayload(salesTaxRate),
        insuranceLanguage: insuranceLanguage.trim() || null,
        venueTypeId: venueTypeId ? Number(venueTypeId) : null,
        entertainmentComplexCompanyIds:
          entertainmentComplexCompanyIdRef.current != null &&
          Number.isFinite(entertainmentComplexCompanyIdRef.current)
            ? [entertainmentComplexCompanyIdRef.current]
            : [],
      });
      await refetchAfterSectionSave('core');
      addToast('General venue information saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save general venue information. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveLoadInDock = async () => {
    const { err, value } = getLoadDockApi();
    if (err) {
      addToast(err, 'warning');
      return;
    }
    setSavingKey('loadDock');
    try {
      await updateVenueDetails(companyId, { venueProfile: { loadDockAddress: value } });
      await refetchAfterSectionSave('loadDock');
      addToast('Load-in dock address saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save the load-in address. Please check the fields.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveFinanceSection = async () => {
    const financeErr = validateContactBlocks(financeBlocks);
    if (financeErr) {
      addToast(financeErr, 'warning');
      return;
    }
    const settlementErr = validateContactBlocks(settlementBlocks);
    if (settlementErr) {
      addToast(settlementErr, 'warning');
      return;
    }
    setSavingKey('finance');
    try {
      await updateVenueDetails(companyId, {
        financeDirectors: blocksToContactPayload(financeBlocks ?? []),
        settlementManagers: blocksToContactPayload(settlementBlocks ?? []),
      });
      await refetchAfterSectionSave('finance');
      addToast('Finance contacts saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save finance contacts. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveMarketingSection = async () => {
    const marketingErr = validateContactBlocks(marketingBlocks);
    if (marketingErr) {
      addToast(marketingErr, 'warning');
      return;
    }
    setSavingKey('marketing');
    try {
      await updateVenueDetails(companyId, {
        marketingDirectors: blocksToContactPayload(marketingBlocks ?? []),
        brandIds,
      });
      await refetchAfterSectionSave('marketing');
      addToast('Marketing details saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save marketing details. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveTechnicalSection = async () => {
    const technicalErr = validateContactBlocks(technicalBlocks);
    if (technicalErr) {
      addToast(technicalErr, 'warning');
      return;
    }
    const stagehandContactErr = validateContactBlocks(stagehandContactBlocks);
    if (stagehandContactErr) {
      addToast(stagehandContactErr, 'warning');
      return;
    }
    const { err, value: loadDockAddress } = getLoadDockApi();
    if (err) {
      addToast(err, 'warning');
      return;
    }
    setSavingKey('technical');
    try {
      await updateVenueDetails(companyId, {
        technicalDirectors: blocksToContactPayload(technicalBlocks ?? []),
        stagehandProviderContacts: blocksToContactPayload(stagehandContactBlocks ?? []),
        venueProfile: { loadDockAddress },
      });
      await refetchAfterSectionSave('technical');
      addToast('Technical details saved.', 'success');
    } catch (e) {
      addToast(
        friendlyApiError(e, 'Could not save technical details. If the load-in address is incomplete, use the Load-in block above.'),
        'error',
      );
    } finally {
      setSavingKey(null);
    }
  };

  const saveTicketingSection = async () => {
    const ticketingMgrErr = validateContactBlocks(ticketingManagerBlocks);
    if (ticketingMgrErr) {
      addToast(ticketingMgrErr, 'warning');
      return;
    }
    setSavingKey('ticketing');
    try {
      await updateVenueDetails(companyId, {
        venueProfile: {
          seatingTypeId: seatingTypeId ? Number(seatingTypeId) : null,
        },
        ticketingManagers: blocksToContactPayload(ticketingManagerBlocks ?? []),
      });
      await refetchAfterSectionSave('ticketing');
      addToast('Ticketing information saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save ticketing information. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveBookingSection = async () => {
    for (const { label, blocks } of [
      { label: 'Booking Director', blocks: bookingDirectorBlocks },
      { label: 'Rental manager', blocks: rentalManagerBlocks },
      { label: 'Calendar manager', blocks: calendarManagerBlocks },
      { label: 'Contracts manager', blocks: contractManagerBlocks },
    ] as const) {
      const err = validateContactBlocks(blocks);
      if (err) {
        addToast(`${label}: ${err}`, 'warning');
        return;
      }
    }
    setSavingKey('booking');
    try {
      await updateVenueDetails(companyId, {
        venueProfile: {
          insurancePolicyCopyRequirements: insurancePolicyCopyRequirements.trim() || null,
          venueRelationshipIae: venueRelationshipIae.trim().slice(0, 100),
        },
        bookingDirectors: blocksToContactPayload(bookingDirectorBlocks ?? []),
        rentalManagers: blocksToContactPayload(rentalManagerBlocks ?? []),
        calendarManagers: blocksToContactPayload(calendarManagerBlocks ?? []),
        contractManagers: blocksToContactPayload(contractManagerBlocks ?? []),
      });
      await refetchAfterSectionSave('booking');
      addToast('Booking and programming information saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save booking and programming information. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveAmusementSection = async () => {
    if (draftOnlyFlags.stateTaxOnTickets) {
      const st = stateTaxId ? Number(stateTaxId) : null;
      if (st == null || !Number.isFinite(st)) {
        addToast('Select a state tax for tickets, or turn off “State tax on tickets.”', 'warning');
        return;
      }
    }
    if (draftOnlyFlags.cityTaxOnTickets) {
      const ct = cityTaxId ? Number(cityTaxId) : null;
      if (ct == null || !Number.isFinite(ct)) {
        addToast('Select a city tax for tickets, or turn off “City tax on tickets.”', 'warning');
        return;
      }
    }
    setSavingKey('amusement');
    try {
      await updateVenueDetails(companyId, {
        venueProfile: { taxInCart },
        taxIds: buildTaxIdsPayload(),
        hasStateTaxOnTickets: draftOnlyFlags.stateTaxOnTickets ? 1 : 0,
        hasCityTaxOnTickets: draftOnlyFlags.cityTaxOnTickets ? 1 : 0,
      });
      await refetchAfterSectionSave('amusement');
      addToast('Amusement and sales tax settings saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save tax settings. Please try again.'), 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveNonResidentWithholdingSection = async () => {
    const wantsNrw =
      withholdingTaxRate.trim() ||
      withholdingDmaId.trim() ||
      withholdingTaxAgencyCompanyId.trim() ||
      withholdingLinkName.trim() ||
      withholdingLinkUrl.trim() ||
      withholdingMailingAddress.trim() ||
      iaeWaiverUrl.trim() ||
      artistWaiverUrl.trim();
    const wid = parseOptPositiveInt(nonResidentWithholdingId);
    if (wantsNrw && !wid) {
      addToast(
        'Enter a withholding ID in this section, or ask an administrator to set one up.',
        'warning',
      );
      return;
    }
    if (withholdingDmaId.trim() && parseOptPositiveInt(withholdingDmaId) == null) {
      addToast('Enter a valid market number, or leave it empty.', 'warning');
      return;
    }
    if (
      withholdingTaxAgencyCompanyId.trim() &&
      parseOptPositiveInt(withholdingTaxAgencyCompanyId) == null
    ) {
      addToast('Enter a valid payable entity number, or leave it empty.', 'warning');
      return;
    }
    setSavingKey('nrw');
    try {
      if (!wantsNrw && !wid) {
        await updateVenueDetails(companyId, { nonResidentWithholdingId: null });
      } else {
        await updateVenueDetails(companyId, {
          nonResidentWithholdingId: wid,
          nonResidentWithholding: buildNonResidentWithholdingBody(),
        });
      }
      await refetchAfterSectionSave('nrw');
      addToast('Non-resident withholding details saved.', 'success');
    } catch (e) {
      addToast(
        friendlyApiError(
          e,
          'Could not save withholding information. Check the ID and any links, then try again.',
        ),
        'error',
      );
    } finally {
      setSavingKey(null);
    }
  };

  if (vq.isLoading || detailsQ.isLoading) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-text-muted py-4"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ems-accent" aria-hidden />
        <span>Loading venue details…</span>
      </div>
    );
  }

  if (vq.isError || detailsQ.isError) {
    return (
      <p className="text-sm text-ems-coral">
        {((vq.error ?? detailsQ.error) as Error).message}
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

      <div className={sectionCls}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Entertainment Complex">
            <div className="space-y-2">
              <p className="text-[11px] text-text-muted leading-snug">
                One entertainment complex per venue. Clear the selection for a standalone venue.
              </p>
              <Select2
                className="w-full"
                allowClear
                disabled={entertainmentComplexPickerQ.isLoading}
                options={entertainmentComplexSelectOptions}
                value={
                  entertainmentComplexCompanyId != null
                    ? String(entertainmentComplexCompanyId)
                    : ''
                }
                onChange={(v) => {
                  if (!v) {
                    entertainmentComplexCompanyIdRef.current = null;
                    setEntertainmentComplexCompanyId(null);
                    return;
                  }
                  const id = Number(v);
                  if (!Number.isFinite(id) || id <= 0) return;
                  entertainmentComplexCompanyIdRef.current = id;
                  setEntertainmentComplexCompanyId(id);
                }}
                placeholder="No entertainment complex"
              />
            </div>
          </FormField>
          <FormField label="DMA">
            <input className={inputCls} value={company.dmaMarketName ?? ''} disabled />
          </FormField>
          <FormField label="Physical address">
            <input
              className={inputCls}
              value={[
                company.physicalStreet,
                company.physicalCity,
                company.physicalState,
                company.physicalPostalCode,
                company.physicalCountry,
              ]
                .filter(Boolean)
                .join(', ')}
              disabled
            />
          </FormField>
          <FormField label="Mailing address">
            <input
              className={inputCls}
              value={[
                company.mailingStreet || company.physicalStreet,
                company.mailingCity || company.physicalCity,
                company.mailingState || company.physicalState,
                company.mailingPostalCode || company.physicalPostalCode,
                company.mailingCountry || company.physicalCountry,
              ]
                .filter(Boolean)
                .join(', ')}
              disabled
            />
          </FormField>
        </div>
        <div className="border-t border-border pt-5" />
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
          <FormField label="Venue type">
            <Select2
              options={venueTypeOptions}
              value={venueTypeId}
              onChange={setVenueTypeId}
              placeholder="Select type…"
              allowClear
            />
          </FormField>
          <FormField label="Management company">
            <Select2
              options={[
                { value: '', label: 'Clear…' },
                ...(companiesPickerQ.isLoading
                  ? [{ value: '', label: 'Loading…' }]
                  : venueMgmtCompanyOptions),
              ]}
              value={draftOnly.managementCompany ?? ''}
              onChange={(v) => setDraftOnlyField('managementCompany', v)}
              placeholder="Select management company…"
              allowClear
            />
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              Not Stored in Database 
            </p>
          </FormField>
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
          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => void saveCoreVenue()}
              disabled={isSaving || !isCoreDirty}
              className={sectionSaveBtnCls}
            >
              {savingKey === 'core' ? 'Saving…' : 'Save general information'}
            </button>
          </div>
            <div className="md:col-span-2 border-t border-border pt-5">
            <p className="text-sm font-medium text-text-primary mb-1">
              Load-in Dock Physical Address
            </p>
            <p className="text-xs text-text-muted mb-3">
              Saved with the venue. Use the button below to store this address.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Address line 1">
                <input
                  className={inputCls}
                  value={loadDockAddressLine1}
                  onChange={(e) => setLoadDockAddressLine1(e.target.value)}
                  maxLength={200}
                />
              </FormField>
              <FormField label="Address line 2">
                <input
                  className={inputCls}
                  value={loadDockAddressLine2}
                  onChange={(e) => setLoadDockAddressLine2(e.target.value)}
                  maxLength={200}
                />
              </FormField>
              <FormField label="City">
                <input
                  className={inputCls}
                  value={loadDockCity}
                  onChange={(e) => setLoadDockCity(e.target.value)}
                  maxLength={100}
                />
              </FormField>
              <FormField label="State / Province">
                <input
                  className={inputCls}
                  value={loadDockStateProvince}
                  onChange={(e) => setLoadDockStateProvince(e.target.value)}
                  maxLength={100}
                />
              </FormField>
              <FormField label="Postal code">
                <input
                  className={inputCls}
                  value={loadDockPostalCode}
                  onChange={(e) => setLoadDockPostalCode(e.target.value)}
                  maxLength={20}
                />
              </FormField>
              <FormField label="Country">
                <input
                  className={inputCls}
                  value={loadDockCountry}
                  onChange={(e) => setLoadDockCountry(e.target.value)}
                  maxLength={100}
                />
              </FormField>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => void saveLoadInDock()}
                disabled={isSaving || !isLoadDockDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'loadDock' ? 'Saving…' : 'Save load-in address'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={sectionCls}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold text-text-primary">
            Additional Venue Sections
          </h4>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-4 space-y-4 xl:col-span-2">
            <h5 className="text-sm font-semibold text-text-primary">Finance Details</h5>
            <VenueRoleContactBlockGroup
              roleTitle="Finance Director"
              blocks={financeBlocks}
              onUpdate={(id, patch) =>
                setFinanceBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setFinanceBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setFinanceBlocks((p) => (p.length < 2 ? p : p.filter((b) => b.id !== id)))
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setFinanceBlocks, id, v)}
              inputCls={inputCls}
            />
            <VenueRoleContactBlockGroup
              roleTitle="Settlement Manager"
              blocks={settlementBlocks}
              onUpdate={(id, patch) =>
                setSettlementBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setSettlementBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setSettlementBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setSettlementBlocks, id, v)}
              inputCls={inputCls}
            />
            <div className="flex flex-wrap justify-end pt-1">
              <button
                type="button"
                onClick={() => void saveFinanceSection()}
                disabled={isSaving || !isFinanceDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'finance' ? 'Saving…' : 'Save finance section'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4 xl:col-span-2">
            <h5 className="text-sm font-semibold text-text-primary">Marketing Details</h5>
            <VenueRoleContactBlockGroup
              roleTitle="Marketing Director"
              blocks={marketingBlocks}
              onUpdate={(id, patch) =>
                setMarketingBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setMarketingBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setMarketingBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setMarketingBlocks, id, v)}
              inputCls={inputCls}
            />
            <div className="space-y-1.5 pt-1">
              <div className="text-sm font-medium text-text-primary">Brand or Series</div>
              <Select2
                className="w-full"
                value=""
                onChange={(v) => {
                  if (!v) return;
                  const id = Number(v);
                  if (!Number.isFinite(id) || brandIds.includes(id)) return;
                  setBrandIds((prev) => Array.from(new Set([...prev, id])));
                }}
                options={brandAddOptions}
                placeholder="Brand or Series"
              />
              {brandIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {brandIds.map((id) => {
                    const name = brands.find((b) => b.brandId === id)?.brandName ?? `#${id}`;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-xs text-text-primary border border-border rounded px-2 py-0.5 bg-surface/50"
                      >
                        {name}
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-surface-hover"
                          onClick={() => setBrandIds((prev) => prev.filter((x) => x !== id))}
                          aria-label={`Remove ${name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end pt-1">
              <button
                type="button"
                onClick={() => void saveMarketingSection()}
                disabled={isSaving || !isMarketingDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'marketing' ? 'Saving…' : 'Save marketing section'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4 xl:col-span-2">
            <h5 className="text-sm font-semibold text-text-primary">Technical Details</h5>
            <FormField label="Venue Technical Rider">
              <input
                type="file"
                className={inputCls}
                onChange={() => {}}
              />
            </FormField>
            <VenueRoleContactBlockGroup
              roleTitle="Technical Director"
              blocks={technicalBlocks}
              onUpdate={(id, patch) =>
                setTechnicalBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setTechnicalBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setTechnicalBlocks((p) => (p.length < 2 ? p : p.filter((b) => b.id !== id)))
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setTechnicalBlocks, id, v)}
              inputCls={inputCls}
            />
            <VenueRoleContactBlockGroup
              roleTitle="Stagehand Provider"
              blocks={stagehandContactBlocks}
              onUpdate={(id, patch) =>
                setStagehandContactBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setStagehandContactBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setStagehandContactBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setStagehandContactBlocks, id, v)}
              inputCls={inputCls}
            />
            <FormField label="Load-in Dock Physical Address">
              <input
                className={inputCls}
                value={loadDockAddressLine1}
                onChange={(e) => setLoadDockAddressLine1(e.target.value)}
                placeholder="Load-in Dock Address"
                maxLength={200}
                autoComplete="street-address"
              />
            </FormField>
            <div className="flex flex-wrap justify-end pt-1">
              <button
                type="button"
                onClick={() => void saveTechnicalSection()}
                disabled={isSaving || !isTechnicalDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'technical' ? 'Saving…' : 'Save technical section'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4 xl:col-span-2">
            <h5 className="text-sm font-semibold text-text-primary">Ticketing</h5>
            <FormField label="Seating Chart">
              <input
                type="file"
                className={inputCls}
                onChange={() => {}}
              />
            </FormField>
            <FormField label="Ticketing System">
              <Select2
                className="w-full"
                options={ticketingSystemOptions}
                value={draftOnly.ticketingSystem ?? ''}
                onChange={(v) => setDraftOnlyField('ticketingSystem', v)}
                placeholder="Ticketing System"
                allowClear
              />
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Not Stored in Database
              </p>
            </FormField>
            <FormField label="Venue Website">
              <input
                className={inputCls}
                type="url"
                value={draftOnly.venueWebsite ?? ''}
                onChange={(e) => setDraftOnlyField('venueWebsite', e.target.value)}
                placeholder="https://"
                maxLength={2048}
                autoComplete="url"
              />
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Not Stored in Database
              </p>
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
            <VenueRoleContactBlockGroup
              roleTitle="Ticketing Manager"
              blocks={ticketingManagerBlocks}
              onUpdate={(id, patch) =>
                setTicketingManagerBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setTicketingManagerBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setTicketingManagerBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setTicketingManagerBlocks, id, v)}
              inputCls={inputCls}
            />
            <div className="flex flex-wrap justify-end pt-1">
              <button
                type="button"
                onClick={() => void saveTicketingSection()}
                disabled={isSaving || !isTicketingDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'ticketing' ? 'Saving…' : 'Save ticketing section'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-6 xl:col-span-2">
            <h5 className="text-sm font-semibold text-text-primary">Booking & Programming</h5>
            <VenueRoleContactBlockGroup
              roleTitle="Booking Director"
              blocks={bookingDirectorBlocks}
              onUpdate={(id, patch) =>
                setBookingDirectorBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setBookingDirectorBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setBookingDirectorBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setBookingDirectorBlocks, id, v)}
              inputCls={inputCls}
            />
            <VenueRoleContactBlockGroup
              roleTitle="Rental Manager"
              blocks={rentalManagerBlocks}
              onUpdate={(id, patch) =>
                setRentalManagerBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setRentalManagerBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setRentalManagerBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setRentalManagerBlocks, id, v)}
              inputCls={inputCls}
            />
            <VenueRoleContactBlockGroup
              roleTitle="Calendar Manager"
              blocks={calendarManagerBlocks}
              onUpdate={(id, patch) =>
                setCalendarManagerBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setCalendarManagerBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setCalendarManagerBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setCalendarManagerBlocks, id, v)}
              inputCls={inputCls}
            />
            <VenueRoleContactBlockGroup
              roleTitle="Contracts Manager"
              blocks={contractManagerBlocks}
              onUpdate={(id, patch) =>
                setContractManagerBlocks((prev) =>
                  prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
                )
              }
              onAdd={() => setContractManagerBlocks((p) => [...p, emptyContactBlock()])}
              onRemove={(id) =>
                setContractManagerBlocks((p) =>
                  p.length < 2 ? p : p.filter((b) => b.id !== id),
                )
              }
              getOptions={(b) => contactOptionsForBlock(b.contactInfoPick, b.fullName)}
              onPick={(id, v) => applyBlockContactPick(setContractManagerBlocks, id, v)}
              inputCls={inputCls}
            />
            <div className="max-w-3xl space-y-3 pt-1">
              <FormField label="Insurance policy copy requirements">
                <textarea
                  className={`${inputCls} min-h-[120px] resize-y`}
                  value={insurancePolicyCopyRequirements}
                  onChange={(e) => setInsurancePolicyCopyRequirements(e.target.value)}
                  rows={4}
                  placeholder="Insurance policy copy requirements"
                />
              </FormField>
              <FormField label="Venue Relationship to IAE">
                <Select2
                  options={[
                    { value: 'CoPro', label: 'CoPro' },
                    { value: 'Rental', label: 'Rental' },
                    { value: 'Standard', label: 'Standard' },
                  ]}
                  value={venueRelationshipIae}
                  onChange={setVenueRelationshipIae}
                  placeholder="Venue relationship to IAE"
                  allowClear
                />
              </FormField>
            </div>
            <div className="flex flex-wrap justify-end pt-1">
              <button
                type="button"
                onClick={() => void saveBookingSection()}
                disabled={isSaving || !isBookingDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'booking' ? 'Saving…' : 'Save booking & programming'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-5">
            <h5 className="text-sm font-semibold text-text-primary">Amusement or Sales Taxes</h5>
            <div className="space-y-4 max-w-2xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-sm text-text-primary">
                  Is there a state tax on tickets?
                </p>
                <div className="flex items-center gap-6 sm:pt-0.5 shrink-0" role="radiogroup" aria-label="State tax on tickets">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-state"
                      checked={!!draftOnlyFlags.stateTaxOnTickets}
                      onChange={() => setDraftOnlyFlag('stateTaxOnTickets', true)}
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-state"
                      checked={!draftOnlyFlags.stateTaxOnTickets}
                      onChange={() => {
                        setDraftOnlyFlag('stateTaxOnTickets', false);
                        setStateTaxId('');
                      }}
                    />
                    No
                  </label>
                </div>
              </div>
              {!!draftOnlyFlags.stateTaxOnTickets && (
                <div className="pl-0 sm:pl-2">
                  <Select2
                    options={[
                      { value: '', label: 'Select state tax…' },
                      ...(taxes ?? [])
                        .filter((t) => t.taxJurisdictionType?.toLowerCase() === 'state')
                        .map((t) => ({
                          value: String(t.taxId),
                          label: `${t.taxName} (${t.taxRate})`,
                        })),
                    ]}
                    value={stateTaxId}
                    onChange={setStateTaxId}
                    placeholder="Select state tax…"
                    allowClear
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-sm text-text-primary">
                  Is there a city tax on tickets?
                </p>
                <div className="flex items-center gap-6 sm:pt-0.5 shrink-0" role="radiogroup" aria-label="City tax on tickets">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-city"
                      checked={!!draftOnlyFlags.cityTaxOnTickets}
                      onChange={() => setDraftOnlyFlag('cityTaxOnTickets', true)}
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-city"
                      checked={!draftOnlyFlags.cityTaxOnTickets}
                      onChange={() => {
                        setDraftOnlyFlag('cityTaxOnTickets', false);
                        setCityTaxId('');
                      }}
                    />
                    No
                  </label>
                </div>
              </div>
              {!!draftOnlyFlags.cityTaxOnTickets && (
                <div className="pl-0 sm:pl-2">
                  <Select2
                    options={[
                      { value: '', label: 'Select city tax…' },
                      ...(taxes ?? [])
                        .filter((t) => t.taxJurisdictionType?.toLowerCase() === 'city')
                        .map((t) => ({
                          value: String(t.taxId),
                          label: `${t.taxName} (${t.taxRate})`,
                        })),
                    ]}
                    value={cityTaxId}
                    onChange={setCityTaxId}
                    placeholder="Select city tax…"
                    allowClear
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-sm text-text-primary">
                  Can tax be included in
                  <br />
                  Shopping Cart
                </p>
                <div className="flex items-center gap-6 sm:pt-0.5 shrink-0" role="radiogroup" aria-label="Tax included in shopping cart">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-cart"
                      checked={!!taxInCart}
                      onChange={() => setTaxInCart(true)}
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-muted">
                    <input
                      type="radio"
                      className="border-border text-ems-accent focus:ring-ems-accent/20"
                      name="amuse-cart"
                      checked={!taxInCart}
                      onChange={() => setTaxInCart(false)}
                    />
                    No
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end pt-2 max-w-2xl">
              <button
                type="button"
                onClick={() => void saveAmusementSection()}
                disabled={isSaving || !isAmusementDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'amusement' ? 'Saving…' : 'Save amusement & sales tax'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4">
            <h5 className="text-sm font-semibold text-text-primary">
              Non-Resident Withholding Taxes
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4 max-w-3xl">
              <div className="text-sm text-text-primary sm:text-right sm:pr-1">Withholding</div>
              <div className="min-w-0">
                <input
                  className={inputCls}
                  value={nonResidentWithholdingId}
                  onChange={(e) => setNonResidentWithholdingId(e.target.value.replace(/\D/g, ''))}
                  placeholder="—"
                  inputMode="numeric"
                  maxLength={12}
                  aria-label="Withholding"
                />
              </div>
            </div>
            <div className="space-y-3 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">Market</div>
                <input
                  className={inputCls}
                  value={withholdingDmaId}
                  onChange={(e) => setWithholdingDmaId(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="—"
                  inputMode="numeric"
                  maxLength={12}
                  aria-label="Market"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-start gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1 sm:pt-2.5">Name of Form</div>
                <div className="space-y-1.5">
                  <input
                    className={inputCls}
                    value={withholdingLinkName}
                    onChange={(e) => setWithholdingLinkName(e.target.value)}
                    placeholder="Form or document name"
                    maxLength={255}
                    aria-label="Name of form"
                  />
                  <input
                    className={inputCls}
                    value={withholdingLinkUrl}
                    onChange={(e) => setWithholdingLinkUrl(e.target.value)}
                    placeholder="https://..."
                    maxLength={2048}
                    aria-label="Form link"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">Tax</div>
                <input
                  className={inputCls}
                  value={withholdingTaxRate}
                  onChange={(e) => setWithholdingTaxRate(e.target.value)}
                  placeholder="e.g. 0.15"
                  inputMode="decimal"
                  aria-label="Withholding tax rate"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">Payable Entity</div>
                <input
                  className={inputCls}
                  value={withholdingTaxAgencyCompanyId}
                  onChange={(e) => setWithholdingTaxAgencyCompanyId(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="—"
                  inputMode="numeric"
                  maxLength={12}
                  aria-label="Payable entity"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">Mailing Address</div>
                <input
                  className={inputCls}
                  value={withholdingMailingAddress}
                  onChange={(e) => setWithholdingMailingAddress(e.target.value)}
                  placeholder="Mailing address"
                  maxLength={1024}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">IAE Waiver Instructions</div>
                <input
                  className={inputCls}
                  value={iaeWaiverUrl}
                  onChange={(e) => setIaeWaiverUrl(e.target.value)}
                  placeholder="https://..."
                  maxLength={2048}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] sm:items-center gap-2 sm:gap-4">
                <div className="text-sm text-text-primary sm:text-right sm:pr-1">Artist Waiver Instructions</div>
                <input
                  className={inputCls}
                  value={artistWaiverUrl}
                  onChange={(e) => setArtistWaiverUrl(e.target.value)}
                  placeholder="https://..."
                  maxLength={2048}
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end pt-2 max-w-3xl">
              <button
                type="button"
                onClick={() => void saveNonResidentWithholdingSection()}
                disabled={isSaving || !isNrwDirty}
                className={sectionSaveBtnCls}
              >
                {savingKey === 'nrw' ? 'Saving…' : 'Save non-resident withholding'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}