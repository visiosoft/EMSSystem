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
  dmaId: number;
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
      seatingTypeId: number | null;
      seatingTypeName: string | null;
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
}

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
 * React Query key for raw `GET /companies` (ApiCompanyListRow[]).
 * Do not use `['companies']` alone for fetchCompanies — CompaniesPage stores UI-mapped rows under that key.
 * Include offset + limit in the key so React Query re-fetches on page change.
 */
export type CompanyListQueryOpts = { q?: string; companyType?: string };

export function companiesApiQueryKey(
  offset: number,
  limit: number,
  q = '',
  companyType = 'All',
) {
  return ['companies', 'api', offset, limit, q, companyType] as const;
}

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

export function companiesPickerQueryKey() {
  return ['companies', 'picker', 0, COMPANIES_PICKER_LIMIT] as const;
}

export async function fetchCompaniesPickerRows(): Promise<ApiCompanyListRow[]> {
  const res = await fetchCompanies(0, COMPANIES_PICKER_LIMIT);
  return res.data ?? [];
}

export function fetchCompany(id: number) {
  return apiFetch<ApiCompanyListRow>(`/companies/${id}`);
}

export function createCompany(body: CreateCompanyPayload) {
  return apiFetch<{ companyId: number } & Record<string, unknown>>('/companies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCompany(id: number, body: UpdateCompanyPayload) {
  return apiFetch<unknown>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteCompany(id: number) {
  return apiFetch<void>(`/companies/${id}`, { method: 'DELETE' });
}

export function fetchCompanyContacts(companyId: number) {
  return apiFetch<ApiCompanyContact[]>(`/companies/${companyId}/contacts`);
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
    seatingTypeId: number | null;
  }>,
) {
  return apiFetch<void>(`/companies/${companyId}/venue-profile`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function updateVenueTicketing(
  companyId: number,
  body: { seatingTypeId?: number | null },
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
  ]).then(([companyTypes, roles, departments, seatingTypes, venueTypes]) => ({
    companyTypes,
    roles,
    departments,
    seatingTypes,
    venueTypes,
  }));
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