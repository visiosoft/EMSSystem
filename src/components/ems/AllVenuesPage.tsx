/**
 * All Venues — list + board from dbo.Venue + Venue-type dbo.Company.
 * “Complex” = dbo.Company.CompanyName (same as venue profile “Complex name”).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, LayoutList, Loader2 } from 'lucide-react';
import { Select2 } from './Select2';
import {
  getPageParams,
  getPageRange,
  getTotalPages,
  PAGE_SIZE,
  type PageSizeOption,
} from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';
import {
  allVenuesQueryKey,
  fetchAllVenues,
  type ApiAllVenueRow,
} from '@/api/venueDirectoryApi';
import {
  companiesPickerQueryKey,
  fetchCompaniesPickerRows,
  fetchDmaMarkets,
  fetchLookups,
  type ApiCompanyListRow,
} from '@/api/companyApi';

type ViewMode = 'list' | 'board';

function useDebouncedValue<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

function complexOptions(companyRows: ApiCompanyListRow[]) {
  return companyRows
    .filter(
      (c) => c.companyTypeName?.trim().toLowerCase() === 'venue',
    )
    .map((c) => ({ value: String(c.companyId), label: c.companyName }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export function AllVenuesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [venueInput, setVenueInput] = useState('');
  const debouncedVenue = useDebouncedValue(venueInput, 400);
  const [complexId, setComplexId] = useState('');
  const [venueTypeId, setVenueTypeId] = useState('');
  const [dmaId, setDmaId] = useState('');

  const lookupsQ = useQuery({
    queryKey: ['lookups', 'all-venues'],
    queryFn: fetchLookups,
    staleTime: 30 * 60_000,
  });

  const companiesQ = useQuery({
    queryKey: companiesPickerQueryKey(),
    queryFn: fetchCompaniesPickerRows,
    staleTime: 30 * 60_000,
  });

  const dmasQ = useQuery({
    queryKey: ['dmas', 'all-venues'],
    queryFn: fetchDmaMarkets,
    staleTime: 30 * 60_000,
  });

  const complexOpts = useMemo(
    () => (companiesQ.data ? complexOptions(companiesQ.data) : []),
    [companiesQ.data],
  );
  const venueTypeOpts = useMemo(() => {
    const vt = lookupsQ.data?.venueTypes ?? [];
    return vt
      .map((x) => ({ value: String(x.venueTypeId), label: x.venueTypeName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [lookupsQ.data?.venueTypes]);

  const dmaOpts = useMemo(() => {
    const d = dmasQ.data ?? [];
    return d
      .map((x) => ({ value: String(x.dmaid), label: x.marketName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [dmasQ.data]);

  const filterParams = useMemo(
    () => ({
      q: debouncedVenue.trim() || undefined,
      complexCompanyId:
        complexId !== '' && Number.isFinite(Number(complexId))
          ? Number(complexId)
          : undefined,
      venueTypeId:
        venueTypeId !== '' && Number.isFinite(Number(venueTypeId))
          ? Number(venueTypeId)
          : undefined,
      dmaId: dmaId !== '' && Number.isFinite(Number(dmaId)) ? Number(dmaId) : undefined,
    }),
    [debouncedVenue, complexId, venueTypeId, dmaId],
  );

  useEffect(() => {
    setPage(1);
  }, [filterParams]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const { offset, limit } = getPageParams(page, pageSize);
  const listQ = useQuery({
    queryKey: [
      ...allVenuesQueryKey,
      page,
      pageSize,
      filterParams,
    ] as const,
    queryFn: () => fetchAllVenues(offset, limit, filterParams),
  });

  const total = listQ.data?.total ?? 0;
  const rows: ApiAllVenueRow[] = listQ.data?.data ?? [];
  const pageCount = getTotalPages(total, pageSize);
  const { rangeStart, rangeEnd } = getPageRange(page, total, pageSize);
  const loading = listQ.isPending || listQ.isFetching;
  const filtersLoading =
    lookupsQ.isPending || companiesQ.isPending || dmasQ.isPending;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary tracking-tight">All Venues</h1>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1 min-w-0">
          <div>
            <label className="text-text-muted text-xs block mb-1">Venue</label>
            <input
              type="search"
              value={venueInput}
              onChange={(e) => setVenueInput(e.target.value)}
              placeholder="Search by venue name"
              className="w-full min-w-0 bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Venue Complex</label>
            <div className={filtersLoading ? 'opacity-60 pointer-events-none' : ''}>
              <Select2
                options={complexOpts}
                value={complexId}
                onChange={setComplexId}
                allowClear
                placeholder="Choose an option"
                searchPlaceholder="Search complexes..."
              />
            </div>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Venue Type</label>
            <div className={filtersLoading ? 'opacity-60 pointer-events-none' : ''}>
              <Select2
                options={venueTypeOpts}
                value={venueTypeId}
                onChange={setVenueTypeId}
                allowClear
                placeholder="Choose an option"
                searchPlaceholder="Search types..."
              />
            </div>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Venue DMA</label>
            <div className={filtersLoading ? 'opacity-60 pointer-events-none' : ''}>
              <Select2
                options={dmaOpts}
                value={dmaId}
                onChange={setDmaId}
                allowClear
                placeholder="Choose an option"
                searchPlaceholder="Search markets..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-0.5 shrink-0 self-end">
          <button
            type="button"
            title="List view"
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md border border-transparent transition-colors ${
              viewMode === 'list'
                ? 'bg-elevated text-ems-accent border-ems-accent/30'
                : 'text-text-muted hover:text-text-primary'
            }`}
            aria-pressed={viewMode === 'list'}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Board view"
            onClick={() => setViewMode('board')}
            className={`p-2 rounded-md border border-transparent transition-colors ${
              viewMode === 'board'
                ? 'bg-elevated text-ems-accent border-ems-accent/30'
                : 'text-text-muted hover:text-text-primary'
            }`}
            aria-pressed={viewMode === 'board'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="relative border border-border rounded-lg overflow-hidden bg-surface">
          {loading ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[1px]"
              aria-live="polite"
            >
              <Loader2 className="h-7 w-7 text-ems-accent animate-spin" />
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-ems-accent text-xs font-semibold border-b border-border bg-elevated/30">
                  <th className="text-left py-2.5 px-3">Venue Name</th>
                  <th className="text-left py-2.5 px-3">Complex</th>
                  <th className="text-left py-2.5 px-3">Venue Type</th>
                  <th className="text-left py-2.5 px-3">Capacity</th>
                  <th className="text-left py-2.5 px-3">DMA</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-text-muted text-sm"
                    >
                      No venues match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.companyId}
                      className="border-b border-border/50 hover:bg-elevated/40"
                    >
                      <td className="py-2.5 px-3 text-text-primary">{r.venueName || '—'}</td>
                      <td className="py-2.5 px-3 text-text-primary">{r.complexName || '—'}</td>
                      <td className="py-2.5 px-3 text-text-primary">
                        {r.venueTypeName || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-text-primary tabular-nums">
                        {r.seatingCapacity}
                      </td>
                      <td className="py-2.5 px-3 text-text-muted">
                        {r.dmaMarketName || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="relative min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-7 w-7 text-ems-accent animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-12">
              No venues match the current filters.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {rows.map((r) => (
                <li
                  key={r.companyId}
                  className="border border-border rounded-lg p-4 bg-surface shadow-sm"
                >
                  <div className="text-sm font-medium text-text-primary line-clamp-2">
                    {r.venueName}
                  </div>
                  <div className="text-xs text-text-muted mt-1">{r.complexName || '—'}</div>
                  <dl className="mt-3 space-y-1.5 text-xs text-text-primary">
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">Venue Type</dt>
                      <dd>{r.venueTypeName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">Capacity</dt>
                      <dd className="tabular-nums">{r.seatingCapacity}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">DMA</dt>
                      <dd className="text-right line-clamp-2">{r.dmaMarketName || '—'}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Showing {rangeStart}–{rangeEnd} of {total}
            </span>
            <span className="inline-flex items-center gap-x-1.5 text-text-secondary">
              <span aria-hidden>·</span>
              <PageSizeSelect
                value={pageSize}
                onChange={setPageSize}
                disabled={loading}
              />
              <span>per page</span>
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-border text-text-primary disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded border border-border text-text-primary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
