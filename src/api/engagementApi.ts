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
  /** Tour banner image URL from dbo.Link (Tour.BannerLinkID) */
  tourBannerImageUrl: string | null;
  /** Entertainment complex company names for primary venue (comma-separated) */
  entertainmentComplexNames: string | null;
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

/** Only persisted fields on dbo.Engagement */
export interface UpdateEngagementPayload {
  engagementStatus?: string;
  tourId?: number;
  primaryVenueCompanyId?: number;
}

/** dbo.EngagementFinances — one row per engagement (GET returns nulls for missing row / empty fields) */
export interface ApiEngagementFinanceRow {
  financeId: number | null;
  engagementId: number;
  estimatedBreakeven: number | null;
  grossPotential: number | null;
  promoterProfit: number | null;
  venueTerms: string | null;
  confirmationPacketApproved: boolean | null;
  iaeWaiverApplicationConfirmationNumber: string | null;
  iaeWaiverApplicationSubmissionDate: string | null;
  iaeApplicationWaiverStatus: string | null;
  dateFundsReceived: string | null;
  fundsDue: number | null;
  fundsWithheld: number | null;
  fundsOwed: number | null;
  receivableBankAccount: string | null;
  requiredNonResidentWithholdingId: number | null;
  artistFinanceId: number | null;
  settlementFinanceId: number | null;
}

export type UpdateEngagementFinancePayload = {
  estimatedBreakeven?: number | null;
  grossPotential?: number | null;
  promoterProfit?: number | null;
  venueTerms?: string | null;
  confirmationPacketApproved?: boolean | null;
  iaeWaiverApplicationConfirmationNumber?: string | null;
  iaeWaiverApplicationSubmissionDate?: string | null;
  iaeApplicationWaiverStatus?: string | null;
  dateFundsReceived?: string | null;
  fundsDue?: number | null;
  fundsWithheld?: number | null;
  fundsOwed?: number | null;
  receivableBankAccount?: string | null;
  requiredNonResidentWithholdingId?: number | null;
  artistFinanceId?: number | null;
  settlementFinanceId?: number | null;
};

export interface ApiEngagementFinanceLookups {
  nonResidentWithholdings: { id: number; label: string }[];
  artistFinances: { id: number; label: string }[];
  settlementFinances: { id: number; label: string }[];
  iaeApplicationWaiverStatuses: { value: string; label: string }[];
}

export const fetchEngagementFinanceLookups = () =>
  apiFetch<ApiEngagementFinanceLookups>('/engagements/finance-lookups');

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
  /** Server whitelist: attraction, tour, venue, market, date */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
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
    opts.sortBy ?? '',
    opts.sortDir ?? '',
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
  if (opts?.sortBy?.trim()) {
    params.set('sortBy', opts.sortBy.trim());
    if (opts.sortDir) params.set('sortDir', opts.sortDir);
  }
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

export const fetchEngagementFinance = (id: number) =>
  apiFetch<ApiEngagementFinanceRow>(`/engagements/${id}/finance`);

export const updateEngagementFinance = (id: number, body: UpdateEngagementFinancePayload) =>
  apiFetch<void>(`/engagements/${id}/finance`, { method: 'PATCH', body: JSON.stringify(body) });
