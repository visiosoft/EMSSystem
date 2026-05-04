import { apiFetch } from './config';
import type { ApiPaginatedResponse } from './companyApi';

export interface ApiAllVenueRow {
  companyId: number;
  /** Comma-separated names from dbo.VenueComplexMember when multiple complexes apply. */
  entertainmentComplexNames: string | null;
  venueName: string;
  seatingCapacity: number;
  venueTypeId: number | null;
  venueTypeName: string | null;
  dmaId: number | null;
  dmaMarketName: string | null;
}

export const allVenuesQueryKey = ['venue-directory', 'venues'] as const;

export function fetchAllVenues(
  offset: number,
  limit: number,
  opts: {
    q?: string;
    complexName?: string;
    complexCompanyId?: number;
    venueTypeId?: number;
    dmaId?: number;
    /** Filter to venues in any of these DMA markets (same MarketName family in dbo.DMA). */
    dmaIds?: number[];
    /** venue | type | dma | capacity | complex */
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  } = {},
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  const q = opts.q?.trim();
  if (q) params.set('q', q);
  const cn = opts.complexName?.trim();
  if (cn) params.set('complexName', cn);
  if (opts.complexCompanyId != null && opts.complexCompanyId > 0) {
    params.set('complexCompanyId', String(opts.complexCompanyId));
  }
  if (opts.venueTypeId != null && opts.venueTypeId > 0) {
    params.set('venueTypeId', String(opts.venueTypeId));
  }
  if (opts.dmaIds != null && opts.dmaIds.length > 0) {
    params.set('dmaIds', opts.dmaIds.join(','));
  } else if (opts.dmaId != null && opts.dmaId > 0) {
    params.set('dmaId', String(opts.dmaId));
  }
  if (opts.sortBy?.trim()) {
    params.set('sortBy', opts.sortBy.trim());
    if (opts.sortDir) params.set('sortDir', opts.sortDir);
  }
  return apiFetch<ApiPaginatedResponse<ApiAllVenueRow>>(
    `/venue-directory/venues?${params.toString()}`,
  );
}
