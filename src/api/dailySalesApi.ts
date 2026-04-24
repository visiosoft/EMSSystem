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

export interface ApiPerformanceSalesPage {
  items: ApiPerformanceSalesRow[];
  total: number;
  page: number;
  pageSize: number;
  todayDate: string;
  yesterdayDate: string;
  summary: {
    todayTickets: number;
    todayRevenue: number;
    yesterdayTickets: number;
    yesterdayRevenue: number;
  };
  attractionNames: string[];
}

export function fetchDailySalesByPerformance(
  asOfDate?: string,
  options?: { page?: number; pageSize?: number; search?: string; attraction?: string },
) {
  const p = new URLSearchParams();
  if (asOfDate) p.set('asOfDate', asOfDate);
  if (options?.page != null) p.set('page', String(options.page));
  if (options?.pageSize != null) p.set('pageSize', String(options.pageSize));
  if (options?.search) p.set('search', options.search);
  if (options?.attraction) p.set('attraction', options.attraction);
  const qs = p.toString() ? `?${p.toString()}` : '';
  return apiFetch<ApiPerformanceSalesPage>(`/daily-sales/by-performance${qs}`);
}

// ─── Update (upsert) — one running-total row per (performance, sales date) ──

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
