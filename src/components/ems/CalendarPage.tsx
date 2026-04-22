import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { StatusBadge } from './Primitives';
import {
  fetchPerformances,
  fetchPerformancesPaged,
  type ApiPerformanceCalendarRow,
} from '@/api/performancesApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { getPageParams, getTotalPages, getPageRange, PAGE_SIZE } from '@/lib/serverPagination';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (view: string, data?: Record<string, unknown>) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// ─── Status colour map ────────────────────────────────────────────────────────

/** Engagement visibility only — matches dbo/API canonical values. */
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Unknown: { bg: 'bg-elevated       border-border',          text: 'text-text-secondary', dot: 'bg-text-muted' },
  Private: { bg: 'bg-ems-purple-dim border-ems-purple/30',  text: 'text-ems-purple',     dot: 'bg-ems-purple' },
  Public:  { bg: 'bg-ems-green-dim  border-ems-green/30',   text: 'text-ems-green',      dot: 'bg-ems-green' },
};

const ENGAGEMENT_VISIBILITY_STATUSES = ['Unknown', 'Private', 'Public'] as const;

function cfgFor(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.Unknown;
}

/** Map a calendar row to canonical engagement visibility for filters and styling. */
function engagementVisibilityKey(p: ApiPerformanceCalendarRow): string {
  const raw = (p.engagementStatus || p.performanceStatus || 'Unknown').trim();
  const lower = raw.toLowerCase();
  if (lower === 'private') return 'Private';
  if (lower === 'public') return 'Public';
  if (lower === 'unknown') return 'Unknown';
  return 'Unknown';
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime12(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function entryLabel(p: ApiPerformanceCalendarRow): string {
  return p.attractionName ?? p.tourName ?? `Engagement #${p.engagementId}`;
}

function CalendarListTableSkeleton() {
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden min-h-[22rem]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 border-b border-border bg-surface/40">
        <Loader2 className="h-10 w-10 text-ems-accent animate-spin shrink-0" aria-hidden />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-sm font-semibold text-text-primary">Loading performances</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Fetching {PAGE_SIZE} rows from the server…
          </p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Date</th>
              <th className="text-left py-2.5 px-3">Time</th>
              <th className="text-left py-2.5 px-3">Attraction</th>
              <th className="text-left py-2.5 px-3">Tour</th>
              <th className="text-left py-2.5 px-3">Venue</th>
              <th className="text-left py-2.5 px-3">City</th>
              <th className="text-left py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="py-3 px-3">
                    <Skeleton className="h-4 w-full max-w-[7rem] bg-muted/80" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────

export function CalendarPage({ onNavigate }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());      // 0-based
  const [year,  setYear]  = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(ENGAGEMENT_VISIBILITY_STATUSES),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [listPage, setListPage] = useState(1);

  const visibilityKey = useMemo(
    () => [...activeStatuses].sort().join(','),
    [activeStatuses],
  );
  const visibilityForApi = useMemo(
    () =>
      activeStatuses.size === 0
        ? [...ENGAGEMENT_VISIBILITY_STATUSES]
        : Array.from(activeStatuses),
    [activeStatuses],
  );

  const gridQuery = useQuery({
    queryKey: ['performances', 'grid', year, month + 1],
    queryFn: () => fetchPerformances(year, month + 1),
    enabled: viewMode === 'grid',
    staleTime: 2 * 60 * 1000,
  });

  const { offset: listOffset, limit: listLimit } = getPageParams(listPage);
  const listQuery = useQuery({
    queryKey: ['performances', 'list', year, month + 1, listPage, visibilityKey, listOffset, listLimit],
    queryFn: () =>
      fetchPerformancesPaged(year, month + 1, listOffset, listLimit, visibilityForApi),
    enabled: viewMode === 'list',
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const listTotal = listQuery.data?.total ?? 0;
  const listRows = listQuery.data?.data ?? [];
  const listPageCount = getTotalPages(listTotal);
  const listPageClamped = Math.min(listPage, listPageCount);
  const { rangeStart: listRangeStart, rangeEnd: listRangeEnd } = getPageRange(
    listPageClamped,
    listTotal,
  );
  const listLoading = listQuery.isPending || listQuery.isFetching;
  const gridLoading = gridQuery.isPending || gridQuery.isFetching;

  useEffect(() => {
    setListPage(1);
  }, [year, month, visibilityKey]);

  useEffect(() => {
    if (listPage > listPageCount) setListPage(listPageCount);
  }, [listPage, listPageCount]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
    setSelectedDay(null);
  };

  const toggleStatus = (s: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const performances = gridQuery.data ?? [];

  // Filter by active status filters (use engagementStatus or performanceStatus)
  const visiblePerfs = useMemo(() => {
    return performances.filter((p) => {
      const st = engagementVisibilityKey(p);
      return activeStatuses.has(st) || activeStatuses.size === 0;
    });
  }, [performances, activeStatuses]);

  // Map day → performances
  const byDay = useMemo(() => {
    const map = new Map<number, ApiPerformanceCalendarRow[]>();
    for (const p of visiblePerfs) {
      if (!p.performanceDate) continue;
      const d = new Date(p.performanceDate + 'T12:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(p);
      }
    }
    return map;
  }, [visiblePerfs, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const todayDate = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  const selectedDayPerfs = selectedDay != null ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-xs rounded border ${viewMode === 'grid' ? 'bg-ems-accent text-background border-ems-accent' : 'border-border text-text-secondary hover:bg-hover'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs rounded border ${viewMode === 'list' ? 'bg-ems-accent text-background border-ems-accent' : 'border-border text-text-secondary hover:bg-hover'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="px-3 py-1.5 border border-border rounded text-sm hover:bg-hover">‹</button>
        <button onClick={goToday}   className="px-3 py-1.5 border border-border rounded text-xs hover:bg-hover">Today</button>
        <button onClick={nextMonth} className="px-3 py-1.5 border border-border rounded text-sm hover:bg-hover">›</button>
        <span className="text-base font-semibold text-text-primary ml-1">
          {MONTH_NAMES[month]} {year}
        </span>
        {(gridQuery.isFetching || listQuery.isFetching) && (
          <Loader2 className="h-4 w-4 animate-spin text-ems-accent" aria-hidden />
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {ENGAGEMENT_VISIBILITY_STATUSES.map((s) => {
          const cfg = cfgFor(s);
          const on = activeStatuses.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-opacity ${on ? cfg.bg + ' ' + cfg.text : 'bg-surface border-border text-text-muted opacity-50'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${on ? cfg.dot : 'bg-text-muted'}`} />
              {s}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {(gridQuery.isError || listQuery.isError) && (
        <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
          Could not load performances:{' '}
          {friendlyApiError((gridQuery.error ?? listQuery.error) as Error)}
        </div>
      )}

      {/* Grid loading */}
      {gridLoading && viewMode === 'grid' && (
        <div className="flex items-center justify-center py-20 text-text-muted gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-ems-accent" />
          <span className="text-sm">Loading performances…</span>
        </div>
      )}

      {/* Grid view */}
      {!gridLoading && viewMode === 'grid' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs text-text-muted font-medium bg-surface">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-border/40 min-h-[80px] bg-surface/30" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPerfs = byDay.get(day) ?? [];
              const isToday = day === todayDate && month === todayMonth && year === todayYear;
              const isSelected = day === selectedDay;
              const colIndex = (firstDayOfWeek + i) % 7;
              const isLastCol = colIndex === 6;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[80px] border-b ${isLastCol ? '' : 'border-r'} border-border/40 p-1.5 cursor-pointer transition-colors
                    ${isSelected ? 'bg-ems-accent/10' : 'hover:bg-hover'}`}
                >
                  <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1
                    ${isToday ? 'bg-ems-accent text-background' : 'text-text-secondary'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayPerfs.slice(0, 3).map((p) => {
                      const cfg = cfgFor(engagementVisibilityKey(p));
                      return (
                        <div
                          key={p.performanceId}
                          onClick={(e) => { e.stopPropagation(); onNavigate('engagement-detail', { engagementId: p.engagementId }); }}
                          className={`text-[10px] truncate px-1 py-0.5 rounded border ${cfg.bg} ${cfg.text} leading-tight cursor-pointer hover:opacity-80`}
                          title={`${entryLabel(p)} @ ${p.venueName ?? p.venueCompanyName ?? '—'} · ${formatTime12(p.performanceTime)}`}
                        >
                          {entryLabel(p)}
                        </div>
                      );
                    })}
                    {dayPerfs.length > 3 && (
                      <div className="text-[10px] text-text-muted px-1">+{dayPerfs.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && listLoading && <CalendarListTableSkeleton />}

      {viewMode === 'list' && !listLoading && (
        <>
          <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Time</th>
                  <th className="text-left py-2.5 px-3">Attraction</th>
                  <th className="text-left py-2.5 px-3">Tour</th>
                  <th className="text-left py-2.5 px-3">Venue</th>
                  <th className="text-left py-2.5 px-3">City</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 && !listQuery.isError && (
                  <tr>
                    <td colSpan={7} className="py-12 px-3 text-center text-sm text-text-muted">
                      No performances in {MONTH_NAMES[month]} {year}
                      {activeStatuses.size > 0 &&
                      activeStatuses.size < ENGAGEMENT_VISIBILITY_STATUSES.length
                        ? ' for the selected filters.'
                        : '.'}
                    </td>
                  </tr>
                )}
                {listRows.map((p) => (
                  <tr
                    key={p.performanceId}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer"
                    onClick={() => onNavigate('engagement-detail', { engagementId: p.engagementId })}
                  >
                    <td className="py-2.5 px-3 text-text-secondary text-xs tabular-nums whitespace-nowrap">
                      {new Date(p.performanceDate + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs tabular-nums">
                      {formatTime12(p.performanceTime)}
                    </td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">{p.attractionName ?? '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{p.tourName ?? '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary">
                      {p.venueName ?? p.venueCompanyName ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs">
                      {[p.city, p.stateProvince].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={engagementVisibilityKey(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {listTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
              <p className="tabular-nums">
                Showing{' '}
                <span className="text-text-primary font-medium">
                  {listRangeStart}–{listRangeEnd}
                </span>{' '}
                of <span className="text-text-primary font-medium">{listTotal.toLocaleString()}</span>
                <span className="text-text-muted"> ({PAGE_SIZE} per page)</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={listPageClamped <= 1 || listQuery.isFetching}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-text-muted tabular-nums px-1">
                  Page {listPageClamped} / {listPageCount}
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  disabled={listPageClamped >= listPageCount || listQuery.isFetching}
                  onClick={() => setListPage((p) => Math.min(listPageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Side panel: selected day detail */}
      {selectedDay !== null && selectedDayPerfs.length > 0 && viewMode === 'grid' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {MONTH_NAMES[month]} {selectedDay}, {year} — {selectedDayPerfs.length} performance{selectedDayPerfs.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {selectedDayPerfs.map((p) => {
              const cfg = cfgFor(engagementVisibilityKey(p));
              return (
                <div
                  key={p.performanceId}
                  onClick={() => onNavigate('engagement-detail', { engagementId: p.engagementId })}
                  className={`p-3 rounded-lg border cursor-pointer hover:opacity-90 ${cfg.bg}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`text-sm font-medium ${cfg.text}`}>{entryLabel(p)}</div>
                      {p.tourName && p.tourName !== p.attractionName && (
                        <div className="text-xs text-text-secondary mt-0.5">{p.tourName}</div>
                      )}
                    </div>
                    <StatusBadge status={engagementVisibilityKey(p)} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-text-secondary">
                    <span>🕐 {formatTime12(p.performanceTime)}</span>
                    <span>📍 {p.venueName ?? p.venueCompanyName ?? '—'}</span>
                    {(p.city || p.stateProvince) && (
                      <span>{[p.city, p.stateProvince].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty grid state */}
      {!gridLoading && viewMode === 'grid' && visiblePerfs.length === 0 && (
        <div className="text-sm text-text-muted text-center py-6">
          No performances found for {MONTH_NAMES[month]} {year}.
        </div>
      )}
    </div>
  );
}
