import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput, ActionMenu } from './Primitives';
import { Select2 } from './Select2';
import { fetchDailySales, type ApiDailySalesRow } from '@/api/dailySalesApi';
import { friendlyApiError } from '@/lib/friendlyApiError';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  // Legacy props kept for Index.tsx compatibility — no longer used
  dailySales?: unknown;
  onUpdateDailySales?: unknown;
  engagements?: unknown;
  tours?: unknown;
  attractions?: unknown;
  companies?: unknown;
}

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-xl font-semibold text-text-primary mt-1">{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-center gap-3 px-6 py-8 border-b border-border bg-surface/40">
        <Loader2 className="h-8 w-8 text-ems-accent animate-spin" aria-hidden />
        <div className="text-sm font-medium text-text-primary">Loading daily sales…</div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <tr key={i} className="border-b border-border/40">
              {Array.from({ length: 7 }).map((__, j) => (
                <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-24 bg-muted/80" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DailySalesPage ───────────────────────────────────────────────────────────

export function DailySalesPage({ onNavigate }: Props) {
  const [search, setSearch] = useState('');
  const [attractionFilter, setAttractionFilter] = useState('');
  const [page, setPage] = useState(1);

  const salesQuery = useQuery({
    queryKey: ['daily-sales'],
    queryFn: () => fetchDailySales(),
    staleTime: 2 * 60 * 1000,
  });

  const rows = salesQuery.data ?? [];

  // Unique attractions for filter dropdown
  const attractionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.attractionName) seen.set(r.attractionName, r.attractionName);
    }
    return [
      { value: '', label: 'All attractions' },
      ...[...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => ({ value: v, label: l })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (attractionFilter && r.attractionName !== attractionFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [
        r.attractionName ?? '', r.tourName ?? '',
        r.venueCompanyName ?? '', r.venueName ?? '',
        r.city ?? '', r.salesDate, r.performanceDate,
        String(r.engagementId),
      ].join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, attractionFilter]);

  // Summary stats
  const totalTickets = useMemo(() => filtered.reduce((s, r) => s + (r.ticketsSold ?? 0), 0), [filtered]);
  const totalRevenue = useMemo(() => filtered.reduce((s, r) => s + (r.revenue ?? 0), 0), [filtered]);
  const uniqueEngagements = useMemo(() => new Set(filtered.map(r => r.engagementId)).size, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  React.useEffect(() => { setPage(1); }, [search, attractionFilter]);

  const isLoading = salesQuery.isPending;
  const isRefreshing = salesQuery.isFetching && !salesQuery.isPending;

  return (
    <div className="space-y-4">
      {/* Top refresh bar */}
      {isRefreshing && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-pulse bg-ems-accent/90" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-primary">Daily Sales</h1>
        {!isLoading && (
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
            {filtered.length.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Error */}
      {salesQuery.isError && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
          Could not load daily sales: {friendlyApiError(salesQuery.error)}
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard label="Total Tickets Sold" value={totalTickets.toLocaleString()} sub={`across ${filtered.length} sales records`} />
          <SummaryCard label="Total Revenue" value={fmtCurrency(totalRevenue)} sub={`${uniqueEngagements} engagement${uniqueEngagements !== 1 ? 's' : ''}`} />
          <SummaryCard label="Avg per Record" value={filtered.length ? fmtCurrency(totalRevenue / filtered.length) : '—'} sub="revenue per sales entry" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sales…" disabled={isLoading} />
        </div>
        <div className="w-full sm:w-64">
          <Select2 options={attractionOptions} value={attractionFilter} onChange={setAttractionFilter} disabled={isLoading} placeholder="Filter by attraction" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? <TableSkeleton /> : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Sales Date</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Tour</th>
                  <th className="text-left py-2.5 px-3">Venue</th>
                  <th className="text-left py-2.5 px-3">Performance</th>
                  <th className="text-right py-2.5 px-3">Tickets Sold</th>
                  <th className="text-right py-2.5 px-3">Revenue</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !salesQuery.isError && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-text-muted">
                      {rows.length === 0 ? 'No daily sales data in the database yet.' : 'No records match your search.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((r, i) => (
                  <tr
                    key={`${r.performanceId}-${r.salesDate}-${i}`}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                    onClick={() => onNavigate('engagement-detail', { engagementId: r.engagementId })}
                  >
                    <td className="py-2.5 px-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                      {fmtDateShort(r.salesDate)}
                    </td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">
                      {r.attractionName ?? <span className="text-text-muted italic">Unknown</span>}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary">
                      {r.tourName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary">
                      <div>{r.venueName ?? r.venueCompanyName ?? '—'}</div>
                      {(r.city || r.stateProvince) && (
                        <div className="text-xs text-text-muted">
                          {[r.city, r.stateProvince].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs tabular-nums whitespace-nowrap">
                      {r.performanceDate ? fmtDateShort(r.performanceDate) : '—'}
                      {r.performanceTime ? ` · ${formatTime12(r.performanceTime)}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-primary">
                      {r.ticketsSold != null ? r.ticketsSold.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ems-green font-medium">
                      {fmtCurrency(r.revenue)}
                    </td>
                    <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                      <ActionMenu items={[
                        {
                          label: 'View Engagement',
                          onClick: () => onNavigate('engagement-detail', { engagementId: r.engagementId }),
                        },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)}
                </span>{' '}
                of <span className="text-text-primary font-medium">{filtered.length.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-2">
                <button disabled={pageClamped <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium">
                  Previous
                </button>
                <span className="tabular-nums text-text-muted">Page {pageClamped} / {pageCount}</span>
                <button disabled={pageClamped >= pageCount} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs font-medium">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
