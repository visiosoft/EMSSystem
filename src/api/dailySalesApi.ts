import { apiFetch } from './config';

export interface ApiDailySalesRow {
  performanceId: number;
  engagementId: number;
  salesDate: string;            // YYYY-MM-DD
  performanceDate: string;      // YYYY-MM-DD
  performanceTime: string;      // HH:MM:SS
  performanceStatus: string;
  engagementStatus: string;
  ticketsSold: number | null;
  revenue: number | null;
  tourId: number | null;
  tourName: string | null;
  attractionId: number | null;
  attractionName: string | null;
  venueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
}

export function fetchDailySales(engagementId?: number) {
  const qs = engagementId != null ? `?engagementId=${engagementId}` : '';
  return apiFetch<ApiDailySalesRow[]>(`/daily-sales${qs}`);
}
