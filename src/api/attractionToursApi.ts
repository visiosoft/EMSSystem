import { apiFetch, apiFetchMultipart } from './config';

export interface ApiClass {
  classId: number;
  className: string;
}

export interface ApiVenueType {
  venueTypeId: number;
  venueTypeName: string;
}

export interface ApiAttractionListRow {
  attractionId: number;
  attractionName: string;
  activeTourCount: number;
  /** Banner from dbo.Link for the tour with the highest TourID on this attraction */
  latestTourBannerImageUrl: string | null;
  appCreated: boolean;
}

export interface ApiTourListRow {
  tourId: number;
  tourName: string;
  attractionId: number;
  attractionName: string;
  classId: number;
  className: string;
  audienceGender: string | null;
  audienceAgeRange: string | null;
  ascap: boolean;
  bmi: boolean;
  sesac: boolean;
  gmr: boolean;
  tourInsuranceLanguage: string | null;
  talentAgencyCompanyId: number | null;
  talentAgencyCompanyName: string | null;
  techRiderLinkId: number | null;
  venueTypePreferenceId: number | null;
  venueTypePreferenceName: string | null;
  tourBannerImageUrl: string | null;
  appCreated: boolean;
}

export interface CreateAttractionPayload {
  attractionName: string;
  // NOTE: ClassID is NOT on dbo.Attraction — it lives on dbo.Tour
}

export interface UpdateAttractionPayload {
  attractionName?: string;
}

export interface CreateTourPayload {
  tourName: string;
  attractionId: number;
  classId: number;
  ascap?: boolean;
  bmi?: boolean;
  sesac?: boolean;
  gmr?: boolean;
  talentAgencyCompanyId?: number | null;
  audienceGender?: string | null;
  audienceAgeRange?: string | null;
  tourInsuranceLanguage?: string | null;
  venueTypePreferenceId?: number | null;
  techRiderLinkId?: number | null;
}

export type UpdateTourPayload = Partial<CreateTourPayload>;

export interface ApiPaginatedResponse<T> {
  data: T[];
  total: number;
}

export function fetchAttractions(
  offset = 0,
  limit = 25,
  q?: string,
  sort?: { sortBy?: string; sortDir?: 'asc' | 'desc' },
) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  if (sort?.sortBy?.trim()) params.set('sortBy', sort.sortBy.trim());
  if (sort?.sortDir) params.set('sortDir', sort.sortDir);
  return apiFetch<ApiPaginatedResponse<ApiAttractionListRow>>(`/attractions?${params}`);
}

export function createAttraction(body: CreateAttractionPayload) {
  return apiFetch<ApiAttractionListRow>('/attractions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAttraction(id: number, body: UpdateAttractionPayload) {
  return apiFetch<ApiAttractionListRow>(`/attractions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAttraction(id: number) {
  return apiFetch<void>(`/attractions/${id}`, { method: 'DELETE' });
}

/** List cache (full slice) for AttractionTours page. */
export const attractionsListQueryKey = ['attractions'] as const;
export const toursListQueryKey = ['tours'] as const;

/** When committed search has no in-cache matches, hit the API with a dedicated key. */
export const attractionsServerSearchKeyPrefix = ['attractions', 'serverSearch'] as const;
export const toursServerSearchKeyPrefix = ['tours', 'serverSearch'] as const;

export function fetchTours(
  offset = 0,
  limit = 25,
  q?: string,
  sort?: { sortBy?: string; sortDir?: 'asc' | 'desc' },
) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  if (sort?.sortBy?.trim()) params.set('sortBy', sort.sortBy.trim());
  if (sort?.sortDir) params.set('sortDir', sort.sortDir);
  return apiFetch<ApiPaginatedResponse<ApiTourListRow>>(`/tours?${params}`);
}

function buildCreateTourFormData(body: CreateTourPayload): FormData {
  const fd = new FormData();
  fd.append('tourName', body.tourName);
  fd.append('attractionId', String(body.attractionId));
  fd.append('classId', String(body.classId));
  fd.append('ascap', String(Boolean(body.ascap)));
  fd.append('bmi', String(Boolean(body.bmi)));
  fd.append('sesac', String(Boolean(body.sesac)));
  fd.append('gmr', String(Boolean(body.gmr)));
  if (body.talentAgencyCompanyId != null && body.talentAgencyCompanyId >= 1) {
    fd.append('talentAgencyCompanyId', String(body.talentAgencyCompanyId));
  }
  if (body.audienceGender != null && body.audienceGender !== '') {
    fd.append('audienceGender', body.audienceGender);
  }
  if (body.audienceAgeRange != null && body.audienceAgeRange !== '') {
    fd.append('audienceAgeRange', body.audienceAgeRange);
  }
  if (body.tourInsuranceLanguage != null && body.tourInsuranceLanguage !== '') {
    fd.append('tourInsuranceLanguage', body.tourInsuranceLanguage);
  }
  if (body.venueTypePreferenceId != null && body.venueTypePreferenceId >= 1) {
    fd.append('venueTypePreferenceId', String(body.venueTypePreferenceId));
  }
  if (body.techRiderLinkId != null && body.techRiderLinkId >= 1) {
    fd.append('techRiderLinkId', String(body.techRiderLinkId));
  }
  return fd;
}

function buildUpdateTourFormData(body: UpdateTourPayload): FormData {
  const fd = new FormData();
  const keys: (keyof CreateTourPayload)[] = [
    'tourName',
    'attractionId',
    'classId',
    'ascap',
    'bmi',
    'sesac',
    'gmr',
    'talentAgencyCompanyId',
    'audienceGender',
    'audienceAgeRange',
    'tourInsuranceLanguage',
    'venueTypePreferenceId',
    'techRiderLinkId',
  ];
  for (const k of keys) {
    const v = body[k];
    if (v === undefined) continue;
    if (v === null) {
      fd.append(k, '');
      continue;
    }
    if (typeof v === 'boolean') {
      fd.append(k, v ? 'true' : 'false');
      continue;
    }
    fd.append(k, String(v));
  }
  return fd;
}

/** Optional `bannerFile` is stored under `/uploads/tour-banners/` and linked via dbo.Link + Tour.BannerLinkID. */
export function createTour(
  body: CreateTourPayload,
  opts?: { bannerFile?: File | null },
) {
  const fd = buildCreateTourFormData(body);
  if (opts?.bannerFile) fd.append('bannerImage', opts.bannerFile);
  return apiFetchMultipart<ApiTourListRow>('/tours', { method: 'POST', body: fd });
}

export function updateTour(
  id: number,
  body: UpdateTourPayload,
  opts?: { bannerFile?: File | null; removeBanner?: boolean },
) {
  const fd = buildUpdateTourFormData(body);
  if (opts?.bannerFile) fd.append('bannerImage', opts.bannerFile);
  if (opts?.removeBanner) fd.append('removeBanner', 'true');
  return apiFetchMultipart<ApiTourListRow>(`/tours/${id}`, { method: 'PATCH', body: fd });
}

export function deleteTour(id: number) {
  return apiFetch<void>(`/tours/${id}`, { method: 'DELETE' });
}

export function fetchClasses() {
  return apiFetch<ApiClass[]>('/lookups/classes');
}

export function fetchVenueTypesLookup() {
  return apiFetch<ApiVenueType[]>('/lookups/venue-types');
}