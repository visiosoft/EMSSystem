import { apiFetch } from './config';

// ─── Legacy flat list ─────────────────────────────────────────────────────────

export interface ApiDailySalesRow {
  performanceId: number;
  engagementId: number;
  salesDate: string;
  performanceDate: string;
  performanceTime: string;
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

// ─── By-performance view (new) ────────────────────────────────────────────────

export interface ApiPerformanceSalesRow {
  performanceId: number;
  engagementId: number;
  performanceDate: string;       // YYYY-MM-DD
  performanceTime: string;       // HH:MM:SS
  performanceStatus: string;
  engagementStatus: string;
  attractionName: string | null;
  tourName: string | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  /** Today's date YYYY-MM-DD */
  todayDate: string;
  todayTicketsSold: number | null;
  todayRevenue: number | null;
  /** Yesterday's date YYYY-MM-DD */
  yesterdayDate: string;
  yesterdayTicketsSold: number | null;
  yesterdayRevenue: number | null;
}

export function fetchDailySalesByPerformance(performanceDate?: string) {
  const qs = performanceDate ? `?performanceDate=${encodeURIComponent(performanceDate)}` : '';
  return apiFetch<ApiPerformanceSalesRow[]>(`/daily-sales/by-performance${qs}`);
}

// ─── Update (upsert) ──────────────────────────────────────────────────────────

export interface UpdateDailySalesPayload {
  ticketsSold?: number | null;
  revenue?: number | null;
}

export function updateDailySales(
  performanceId: number,
  salesDate: string,
  body: UpdateDailySalesPayload,
) {
  return apiFetch<void>(
    `/daily-sales/${performanceId}/${encodeURIComponent(salesDate)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}
