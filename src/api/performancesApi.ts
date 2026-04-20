import { apiFetch } from './config';

export interface ApiPerformanceCalendarRow {
  performanceId: number;
  engagementId: number;
  performanceStatus: string;
  performanceDate: string;      // YYYY-MM-DD
  performanceTime: string;      // HH:MM:SS
  engagementStatus: string;
  tourId: number | null;
  tourName: string | null;
  attractionId: number | null;
  attractionName: string | null;
  venueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
}

export function fetchPerformances(year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year !== undefined) params.set('year', String(year));
  if (month !== undefined) params.set('month', String(month));
  const qs = params.toString();
  return apiFetch<ApiPerformanceCalendarRow[]>(`/performances${qs ? `?${qs}` : ''}`);
}
