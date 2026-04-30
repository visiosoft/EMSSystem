import { apiFetch } from './config';

export interface ApiAddress {
  addressId: number;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface ApiCompanyListRow {
  companyId: number;
  companyName: string;
  companyTypeId: number;
  companyTypeName: string;
  physicalCity: string;
  physicalStateProvince: string;
  dmaId: number | null;
  dmaMarketName: string;
  physicalAddress: ApiAddress;
  mailingAddress: ApiAddress;
}

export interface ApiCompanyType {
  companyTypeId: number;
  companyTypeName: string;
}

export interface ApiRole {
  roleId: number;
  roleName: string;
}

export interface ApiDepartment {
  departmentId: number;
  departmentName: string;
}

export interface ApiSeatingType {
  seatingTypeId: number;
  seatingName: string;
}

export interface ApiVenueType {
  venueTypeId: number;
  venueTypeName: string;
}

export interface ApiBrand {
  brandId: number;
  brandName: string;
}

export interface ApiTax {
  taxId: number;
  taxName: string;
  taxRate: string;
  taxJurisdictionType: string;
}

export interface ApiServiceProvided {
  serviceProvidedId: number;
  serviceName: string;
}

export interface ApiStagehandProviderCompany {
  companyId: number;
  companyName: string;
}

export interface ApiNonResidentWithholdingOption {
  withholdingId: number;
  withholdingTaxRate: string;
  dmaid: number | null;
  taxAgencyId: number | null;
}

export type ApiVenueProfileResponse =
  | { missing: true }
  | {
      missing: false;
      companyId: number;
      venueName: string;
      seatingCapacity: number;
      salesTaxRate: string | null;
      taxInCart: boolean;
      insuranceLanguage: string | null;
      insurancePolicyCopyRequirements: string | null;
      venueRelationshipIae: string;
      venueTypeId: number | null;
      venueTypeName: string | null;
      entertainmentComplexCompanyIds: number[];
      entertainmentComplexes: { companyId: number; companyName: string }[];
      seatingTypeId: number | null;
      seatingTypeName: string | null;
      ticketingSystem: string | null;
      venueWebsite: string | null;
      loadDockAddress: ApiAddress | null;
    };

export interface ApiCompanyContact {
  contactAssignmentId: number;
  contactId: number;
  contactInfoId: number;
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string | null;
  workPhone: string | null;
  roleId: number;
  roleName: string;
  departmentId: number;
  departmentName: string;
}

export interface ApiEngagementRow {
  engagementId: number;
  engagementStatus: string;
  tourName: string | null;
  attractionName: string | null;
  /** Same format as the main Engagements list. */
  displayTitle: string;
}

export interface ApiVenueTicketing {
  seatingTypeId: number | null;
  seatingTypeName: string | null;
  ticketingSystem: string | null;
  venueWebsite: string | null;
}

/** One contact row for a venue role (UI may show several per role). */
export type ApiVenueRoleContact = {
  contactInfoId: number;
  fullName: string;
  email: string;
  phone: string | null;
  cellPhone: string | null;
};

export type ApiVenueDetailsResponse =
  | { missing: true }
  | {
      missing: false;
      venueProfile: ApiVenueProfileResponse | null;
      brandIds: number[];
      taxIds: number[];
      stagehandProviderCompanyId: number | null;
      nonResidentWithholdingId: number | null;
      hasStateTaxOnTickets: 0 | 1;
      hasCityTaxOnTickets: 0 | 1;
      financeDirectors: ApiVenueRoleContact[];
      settlementManagers: ApiVenueRoleContact[];
      marketingDirectors: ApiVenueRoleContact[];
      technicalDirectors: ApiVenueRoleContact[];
      ticketingManagers: ApiVenueRoleContact[];
      bookingDirectors: ApiVenueRoleContact[];
      rentalManagers: ApiVenueRoleContact[];
      calendarManagers: ApiVenueRoleContact[];
      contractManagers: ApiVenueRoleContact[];
      stagehandProviderContacts: ApiVenueRoleContact[];
      nonResidentWithholding: null | {
        withholdingId: number;
        withholdingTaxRate: string;
        dmaid: number | null;
        taxAgencyId: number | null;
        withholdingLink: null | {
          linkId: number;
          linkType: string;
          linkUrl: string;
          linkName: string;
          linkPath: string;
        };
        artistWaiverInstructions: null | {
          linkId: number;
          linkType: string;
          linkUrl: string;
          linkName: string;
          linkPath: string;
        };
        iaeWaiverInstructions: null | {
          linkId: number;
          linkType: string;
          linkUrl: string;
          linkName: string;
          linkPath: string;
        };
      };
    };

export interface CreateCompanyPayload {
  companyName: string;
  companyTypeId: number;
  dmaId?: number;
  physical: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
  mailingSameAsPhysical?: boolean;
  mailing?: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
}

export interface UpdateCompanyPayload {
  companyName?: string;
  companyTypeId?: number;
  dmaId?: number;
  physical?: CreateCompanyPayload['physical'];
  mailing?: CreateCompanyPayload['mailing'];
  mailingSameAsPhysical?: boolean;
}

export interface ApiPaginatedResponse<T> {
  data: T[];
  total: number;
}

/**
 * React Query key for the companies list cache (full list, client-side filter/pagination on Companies page).
 */
export const companiesApiQueryKey = ['companies', 'api'] as const;

/** Prefix for targeted search queries when the in-memory list has no matches. */
export const companiesServerSearchQueryKeyPrefix = ['companies', 'api', 'serverSearch'] as const;

export type CompanyListQueryOpts = { q?: string; companyType?: string };

export function fetchCompanies(offset = 0, limit = 25, opts?: CompanyListQueryOpts) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = opts?.q?.trim();
  if (trimmed) params.set('q', trimmed);
  const ct = opts?.companyType?.trim();
  if (ct && ct !== 'All') params.set('companyType', ct);
  return apiFetch<ApiPaginatedResponse<ApiCompanyListRow>>(`/companies?${params}`);
}

/** One-shot cap for venue/company pickers (avoids loading unbounded rows). */
export const COMPANIES_PICKER_LIMIT = 5000;

/** Must match dbo.CompanyType.CompanyName for entertainment-complex companies (Companies screen filter). */
export const ENTERTAINMENT_COMPLEX_COMPANY_TYPE = 'Entertainment Complex';

export function companiesPickerQueryKey() {
  return ['companies', 'picker', 0, COMPANIES_PICKER_LIMIT] as const;
}

export async function fetchCompaniesPickerRows(): Promise<ApiCompanyListRow[]> {
  const res = await fetchCompanies(0, COMPANIES_PICKER_LIMIT);
  return res.data ?? [];
}

/** Server-filtered list: only companies of type Entertainment Complex (for venue complex pickers). */
export function entertainmentComplexCompaniesQueryKey() {
  return [
    'companies',
    'picker',
    'entertainment-complex',
    0,
    COMPANIES_PICKER_LIMIT,
  ] as const;
}

export async function fetchEntertainmentComplexCompanyRows(): Promise<
  ApiCompanyListRow[]
> {
  const res = await fetchCompanies(0, COMPANIES_PICKER_LIMIT, {
    companyType: ENTERTAINMENT_COMPLEX_COMPANY_TYPE,
  });
  return res.data ?? [];
}

export function fetchCompany(id: number) {
  return apiFetch<ApiCompanyListRow>(`/companies/${id}`);
}

export function createCompany(body: CreateCompanyPayload) {
  return apiFetch<ApiCompanyListRow>('/companies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCompany(id: number, body: UpdateCompanyPayload) {
  return apiFetch<ApiCompanyListRow>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteCompany(id: number) {
  return apiFetch<void>(`/companies/${id}`, { method: 'DELETE' });
}

export function fetchCompanyContacts(companyId: number) {
  return apiFetch<ApiCompanyContact[]>(`/companies/${companyId}/contacts`).then(
    (data) => (Array.isArray(data) ? data : []),
  );
}

export function createCompanyContact(
  companyId: number,
  body: {
    firstName: string;
    lastName: string;
    email: string;
    cellPhone?: string | null;
    workPhone?: string | null;
    roleId: number;
    departmentId: number;
  },
) {
  return apiFetch<ApiCompanyContact>(`/companies/${companyId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateContactAssignment(
  assignmentId: number,
  body: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    cellPhone: string | null;
    workPhone: string | null;
    roleId: number;
    departmentId: number;
  }>,
) {
  return apiFetch<ApiCompanyContact>(`/contact-assignments/${assignmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteContactAssignment(assignmentId: number) {
  return apiFetch<void>(`/contact-assignments/${assignmentId}`, {
    method: 'DELETE',
  });
}

export function fetchCompanyEngagements(companyId: number) {
  return apiFetch<ApiEngagementRow[]>(`/companies/${companyId}/engagements`);
}

export function fetchVenueTicketing(companyId: number) {
  return apiFetch<ApiVenueTicketing | null>(
    `/companies/${companyId}/venue-ticketing`,
  );
}

export function fetchVenueProfile(companyId: number) {
  return apiFetch<ApiVenueProfileResponse>(
    `/companies/${companyId}/venue-profile`,
  );
}

export function provisionVenueProfile(companyId: number) {
  return apiFetch<{ created: boolean }>(
    `/companies/${companyId}/venue-profile/provision`,
    { method: 'POST' },
  );
}

export function updateVenueProfile(
  companyId: number,
  body: Partial<{
    venueName: string;
    seatingCapacity: number;
    salesTaxRate: string | null;
    taxInCart: boolean;
    insuranceLanguage: string | null;
    insurancePolicyCopyRequirements: string | null;
    venueRelationshipIae: string;
    venueTypeId: number | null;
    entertainmentComplexCompanyIds: number[];
    seatingTypeId: number | null;
    ticketingSystem: string | null;
    venueWebsite: string | null;
    loadDockAddress: {
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    } | null;
  }>,
) {
  return apiFetch<void>(`/companies/${companyId}/venue-profile`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function updateVenueTicketing(
  companyId: number,
  body: {
    seatingTypeId?: number | null;
    ticketingSystem?: string | null;
    venueWebsite?: string | null;
  },
) {
  return apiFetch<{ updated: boolean }>(`/companies/${companyId}/venue-ticketing`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchLookups() {
  return Promise.all([
    apiFetch<ApiCompanyType[]>('/lookups/company-types'),
    apiFetch<ApiRole[]>('/lookups/roles'),
    apiFetch<ApiDepartment[]>('/lookups/departments'),
    apiFetch<ApiSeatingType[]>('/lookups/seating-types'),
    apiFetch<ApiVenueType[]>('/lookups/venue-types'),
    apiFetch<ApiBrand[]>('/lookups/brands'),
    apiFetch<ApiTax[]>('/lookups/taxes'),
    apiFetch<ApiServiceProvided[]>('/lookups/services-provided'),
    apiFetch<ApiStagehandProviderCompany[]>('/lookups/stagehand-providers'),
    apiFetch<ApiNonResidentWithholdingOption[]>('/lookups/non-resident-withholdings'),
  ]).then(
    ([
      companyTypes,
      roles,
      departments,
      seatingTypes,
      venueTypes,
      brands,
      taxes,
      servicesProvided,
      stagehandProviders,
      nonResidentWithholdings,
    ]) => ({
      companyTypes,
      roles,
      departments,
      seatingTypes,
      venueTypes,
      brands,
      taxes,
      servicesProvided,
      stagehandProviders,
      nonResidentWithholdings,
    }),
  );
}

export function fetchVenueDetails(companyId: number) {
  return apiFetch<ApiVenueDetailsResponse>(`/companies/${companyId}/venue-details`);
}

export function updateVenueDetails(
  companyId: number,
  body: Partial<{
    venueProfile: Parameters<typeof updateVenueProfile>[1];
    brandIds: number[];
    taxIds: number[];
    stagehandProviderCompanyId: number | null;
    nonResidentWithholdingId: number | null;
    hasStateTaxOnTickets: 0 | 1;
    hasCityTaxOnTickets: 0 | 1;
    financeDirectors: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    settlementManagers: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    marketingDirectors: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    technicalDirectors: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    ticketingManagers: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    bookingDirectors: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    rentalManagers: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    calendarManagers: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    contractManagers: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    stagehandProviderContacts: {
      fullName?: string;
      email?: string;
      phone?: string;
      cellPhone?: string;
    }[];
    financeDirector: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    settlementManager: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    marketingDirector: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    technicalDirector: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    ticketingManager: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    bookingDirector: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    rentalManager: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    calendarManager: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    contractManager: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    stagehandProviderContact: { fullName?: string; email?: string; phone?: string; cellPhone?: string };
    nonResidentWithholding: Partial<{
      withholdingTaxRate: string;
      dmaid: number | null;
      taxAgencyId: number | null;
      withholdingLink: {
        linkId?: number | null;
        linkType?: string;
        linkUrl?: string;
        linkName?: string;
        linkPath?: string;
      } | null;
      artistWaiverInstructions: {
        linkId?: number | null;
        linkType?: string;
        linkUrl?: string;
        linkName?: string;
        linkPath?: string;
      } | null;
      iaeWaiverInstructions: {
        linkId?: number | null;
        linkType?: string;
        linkUrl?: string;
        linkName?: string;
        linkPath?: string;
      } | null;
    }>;
  }>,
) {
  return apiFetch<{ updated: boolean }>(`/companies/${companyId}/venue-details`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchDmaByPostal(postalCode: string) {
  const enc = encodeURIComponent(postalCode);
  return apiFetch<{ dmaid: number; marketName: string; postalCode: string } | null>(
    `/lookups/dma-by-postal/${enc}`,
  );
}

export interface ApiDmaMarket {
  dmaid: number;
  marketName: string;
  /** From dbo.DMA.PostalCode — one row per postal in this schema. */
  postalCode: string;
}

export function searchDmaMarkets(query?: string, limit = 50) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (limit) params.set('limit', String(limit));
  return apiFetch<ApiDmaMarket[]>(`/lookups/dma-markets/search?${params.toString()}`);
}

/**
 * First chunk of DMA rows for pickers (e.g. project wizard). Prefer `searchDmaMarkets` / paged
 * APIs for large lists — `GET /lookups/dma-markets` is paginated `{ data, total }`.
 */
export function fetchDmaMarkets() {
  return searchDmaMarkets('', 500);
}

export interface ApiDmaMarketsPageResponse {
  data: ApiDmaMarket[];
  total: number;
}

export function fetchDmaMarketsPaged(offset: number, limit: number, q?: string) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  return apiFetch<ApiDmaMarketsPageResponse>(`/lookups/dma-markets?${params.toString()}`);
}