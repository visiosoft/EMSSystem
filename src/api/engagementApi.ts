/**
 * Engagement Module API
 *
 * dbo.Engagement columns: EngagementID, EngagementStatus, TourID (NOT NULL).
 * Opening show is the earliest dbo.Performance (see openingPerformanceDate/Time).
 * AttractionID was REMOVED from dbo.Engagement.
 * AttractionID is on dbo.Tour — reach via: Engagement.TourID → Tour.AttractionID → Attraction
 *
 * dbo.EngagementVenue: EngagementID, VenueCompanyID, IsPrimary
 */
import { apiFetch } from './config';

export interface ApiEngagementListRow {
  engagementId: number;
  engagementStatus: string;
  /** Earliest dbo.Performance (opening show), if any */
  openingPerformanceDate: string | null;
  openingPerformanceTime: string | null;
  tourId: number;
  tourName: string;
  /** Derived via Tour.AttractionID — may be null if tour has no attraction */
  attractionId: number | null;
  attractionName: string | null;
  primaryVenueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  displayTitle: string;
  appCreated: boolean;
}

export interface ApiEngagementVenueRow {
  engagementId: number;
  venueCompanyId: number;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  isPrimary: boolean;
}

export interface CreateEngagementPayload {
  engagementStatus: string;
  /** ISO date YYYY-MM-DD — stored as dbo.Performance.PerformanceDate */
  openingShowDate: string;
  /** HH:mm or HH:mm:ss — stored as dbo.Performance.PerformanceTime */
  openingShowTime: string;
  /** TourID — NOT NULL in DB. Required. Attraction is derived from the tour. */
  tourId: number;
  /** Creates EngagementVenue(IsPrimary=1) */
  primaryVenueCompanyId: number;
  secondaryVenueCompanyIds?: number[];
  // Frontend-only
  bookerId?: string | null;
  showDate?: string | null;
  dealType?: string | null;
  guarantee?: number | null;
}

/** Only persisted fields — see Finance tab UI for optional fields pending DB work */
export interface UpdateEngagementPayload {
  engagementStatus?: string;
  tourId?: number;
  primaryVenueCompanyId?: number;
}

export interface ApiPerformanceRow {
  performanceId: number;
  engagementId: number;
  performanceStatus: string;
  performanceDate: string;
  performanceTime: string;
}

export interface CreatePerformancePayload {
  performanceDate: string;
  performanceTime: string;
  performanceStatus?: string;
}

/** Full list (legacy). Prefer {@link fetchEngagementsPaged} for the EMS list screen. */
export const fetchEngagements = () => apiFetch<ApiEngagementListRow[]>('/engagements');

export interface ApiEngagementsPageResponse {
  data: ApiEngagementListRow[];
  total: number;
}

export interface ApiEngagementFilterOptions {
  attractionNames: string[];
  dmaMarketNames: string[];
  venueLabels: string[];
}

export type EngagementPagedQueryOpts = {
  q?: string;
  status?: string;
  attraction?: string;
  dma?: string;
  venue?: string;
  timing?: 'all' | 'upcoming' | 'past';
};

export function engagementsPagedQueryKey(
  offset: number,
  limit: number,
  opts: EngagementPagedQueryOpts,
) {
  return [
    'engagements',
    'paged',
    offset,
    limit,
    opts.q ?? '',
    opts.status ?? 'All',
    opts.attraction ?? '',
    opts.dma ?? '',
    opts.venue ?? '',
    opts.timing ?? 'all',
  ] as const;
}

export function fetchEngagementsPaged(
  offset = 0,
  limit = 25,
  opts?: EngagementPagedQueryOpts,
) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (opts?.q?.trim()) params.set('q', opts.q.trim());
  if (opts?.status && opts.status !== 'All') params.set('status', opts.status);
  if (opts?.attraction?.trim()) params.set('attraction', opts.attraction.trim());
  if (opts?.dma?.trim()) params.set('dma', opts.dma.trim());
  if (opts?.venue?.trim()) params.set('venue', opts.venue.trim());
  if (opts?.timing && opts.timing !== 'all') params.set('timing', opts.timing);
  return apiFetch<ApiEngagementsPageResponse>(`/engagements/paged?${params}`);
}

export function fetchEngagementFilterOptions() {
  return apiFetch<ApiEngagementFilterOptions>('/engagements/filter-options');
}
export const fetchEngagement = (id: number) => apiFetch<ApiEngagementListRow>(`/engagements/${id}`);
export const fetchEngagementVenues = (id: number) => apiFetch<ApiEngagementVenueRow[]>(`/engagements/${id}/venues`);
export const addEngagementVenue = (id: number, body: { venueCompanyId: number; isPrimary?: boolean }) =>
  apiFetch<void>(`/engagements/${id}/venues`, { method: 'POST', body: JSON.stringify(body) });
export const removeEngagementVenue = (id: number, venueCompanyId: number) =>
  apiFetch<void>(`/engagements/${id}/venues/${venueCompanyId}`, { method: 'DELETE' });
export const createEngagement = (body: CreateEngagementPayload) =>
  apiFetch<{ engagementId: number }>('/engagements', { method: 'POST', body: JSON.stringify(body) });
export const updateEngagement = (id: number, body: UpdateEngagementPayload) =>
  apiFetch<void>(`/engagements/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteEngagement = (id: number) =>
  apiFetch<void>(`/engagements/${id}`, { method: 'DELETE' });
export const fetchEngagementPerformances = (id: number) =>
  apiFetch<ApiPerformanceRow[]>(`/engagements/${id}/performances`);
export const createEngagementPerformance = (id: number, body: CreatePerformancePayload) =>
  apiFetch<{ performanceId: number }>(`/engagements/${id}/performances`, { method: 'POST', body: JSON.stringify(body) });

export const updateEngagementPerformance = (
  engagementId: number,
  performanceId: number,
  body: { performanceDate?: string; performanceTime?: string; performanceStatus?: string },
) =>
  apiFetch<void>(`/engagements/${engagementId}/performances/${performanceId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const deleteEngagementPerformance = (engagementId: number, performanceId: number) =>
  apiFetch<void>(`/engagements/${engagementId}/performances/${performanceId}`, {
    method: 'DELETE',
  });
