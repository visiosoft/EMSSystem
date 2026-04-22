import { apiFetch } from './config';

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
  tourManagementCompanyId: number | null;
  tourManagementCompanyName: string | null;
  techRiderLinkId: number | null;
  venueTypePreferenceId: number | null;
  venueTypePreferenceName: string | null;
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
  tourManagementCompanyId?: number | null;
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

export function fetchAttractions(offset = 0, limit = 25, q?: string) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  return apiFetch<ApiPaginatedResponse<ApiAttractionListRow>>(`/attractions?${params}`);
}

export function createAttraction(body: CreateAttractionPayload) {
  return apiFetch<{ attractionId: number }>('/attractions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAttraction(id: number, body: UpdateAttractionPayload) {
  return apiFetch<void>(`/attractions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAttraction(id: number) {
  return apiFetch<void>(`/attractions/${id}`, { method: 'DELETE' });
}

export function fetchTours(offset = 0, limit = 25, q?: string) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  return apiFetch<ApiPaginatedResponse<ApiTourListRow>>(`/tours?${params}`);
}

export function createTour(body: CreateTourPayload) {
  return apiFetch<{ tourId: number }>('/tours', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTour(id: number, body: UpdateTourPayload) {
  return apiFetch<void>(`/tours/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
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