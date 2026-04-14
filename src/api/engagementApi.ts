import { apiFetch } from './config';
import type { Engagement } from '@/data/constants';

export interface ApiEngagementListRow {
  engagementId: number;
  engagementStatus: string;
  engagementScaling: string | null;
  attractionId: number;
  attractionName: string;
  tourId: number | null;
  tourName: string | null;
  primaryVenueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  displayTitle: string;
  appCreated: boolean;
}

export interface CreateEngagementPayload {
  engagementStatus: string;
  engagementScaling?: string | null;
  attractionId: number;
  tourId?: number | null;
  primaryVenueCompanyId: number;
}

export type UpdateEngagementPayload = Partial<CreateEngagementPayload>;

const defaultWorkflow = {
  marketing: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
  production: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
  eventBusiness: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
  creative: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
  sales: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 4 },
  finance: { status: 'NotStarted', assigneeId: '', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
};

/** Maps an API row to the legacy `Engagement` shape for Projects / Daily Sales that still expect it. */
export function mapApiEngagementToLegacy(row: ApiEngagementListRow): Engagement {
  return {
    id: String(row.engagementId),
    name: row.displayTitle,
    tourId: row.tourId != null ? String(row.tourId) : '',
    venueId: row.primaryVenueCompanyId != null ? String(row.primaryVenueCompanyId) : '',
    configName: '—',
    bookerId: '',
    projectId: '',
    offerId: null,
    showDates: [],
    showCount: 0,
    status: row.engagementStatus,
    dealType: '—',
    guarantee: 0,
    splitPct: null,
    breakeven: null,
    projectedGross: 0,
    projectedMargin: 0,
    actualGross: null,
    actualMargin: null,
    workflows: { ...defaultWorkflow },
  };
}

export function fetchEngagements() {
  return apiFetch<ApiEngagementListRow[]>('/engagements');
}

export function fetchEngagement(id: number) {
  return apiFetch<ApiEngagementListRow>(`/engagements/${id}`);
}

export function createEngagement(body: CreateEngagementPayload) {
  return apiFetch<{ engagementId: number }>('/engagements', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEngagement(id: number, body: UpdateEngagementPayload) {
  return apiFetch<void>(`/engagements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEngagement(id: number) {
  return apiFetch<void>(`/engagements/${id}`, {
    method: 'DELETE',
  });
}

export interface ApiPerformanceRow {
  performanceId: number;
  engagementId: number;
  performanceStatus: string;
  performanceDate: string;
  performanceTime: string;
}

export function fetchEngagementPerformances(engagementId: number) {
  return apiFetch<ApiPerformanceRow[]>(`/engagements/${engagementId}/performances`);
}

export function createEngagementPerformance(
  engagementId: number,
  body: {
    performanceDate: string;
    performanceTime: string;
    performanceStatus?: string;
  },
) {
  return apiFetch<{ performanceId: number }>(`/engagements/${engagementId}/performances`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
