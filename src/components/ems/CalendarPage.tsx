import React, { useState, useMemo } from 'react';
import { TOURS, ATTRACTIONS, COMPANIES, CONTACTS, DMAS, formatDate } from '@/data/constants';
import { StatusBadge, Modal, FormField } from './Primitives';
import type { Engagement } from '@/data/constants';

interface Props {
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type CalendarEntry = {
  id: string;
  date: string;
  showTime: string;
  tourName: string;
  attractionName: string;
  venueName: string;
  venueCity: string;
  status: string;
  engagementId?: string;
};

// ─── Status Color Config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  Confirmed:  { bg: 'bg-ems-green-dim border-ems-green/30',   text: 'text-ems-green',   dot: 'bg-ems-green',   label: 'Confirmed' },
  OnSale:     { bg: 'bg-ems-blue-dim border-ems-blue/30',     text: 'text-ems-blue',    dot: 'bg-ems-blue',    label: 'On Sale' },
  Draft:      { bg: 'bg-elevated border-border',               text: 'text-text-secondary', dot: 'bg-text-muted', label: 'Draft' },
  Settled:    { bg: 'bg-ems-accent-dim border-ems-accent/30', text: 'text-ems-accent',  dot: 'bg-ems-accent',  label: 'Settled' },
  Cancelled:  { bg: 'bg-ems-coral-dim border-ems-coral/30',   text: 'text-ems-coral',   dot: 'bg-ems-coral',   label: 'Cancelled' },
  SoftHold:   { bg: 'bg-ems-amber-dim border-ems-amber/30',   text: 'text-ems-amber',   dot: 'bg-ems-amber',   label: 'Soft Hold' },
  HardHold:   { bg: 'bg-ems-amber-dim border-ems-amber/30',   text: 'text-ems-amber',   dot: 'bg-ems-amber',   label: 'Hard Hold' },
};

const ALL_STATUSES = ['Confirmed', 'OnSale', 'Draft', 'Settled', 'Cancelled', 'SoftHold', 'HardHold'];

export function CalendarPage({ engagements, onNavigate, addToast }: Props) {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddHold, setShowAddHold] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(['Confirmed', 'OnSale', 'Draft', 'Settled', 'SoftHold', 'HardHold']));
  const [customHolds, setCustomHolds] = useState<CalendarEntry[]>([]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    const now = new Date();
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const toggleStatus = (status: string) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const selectAllStatuses = () => setActiveStatuses(new Set(ALL_STATUSES));
  const clearAllStatuses = () => setActiveStatuses(new Set());

  // Build all entries from engagements + custom holds
  const allEntries: CalendarEntry[] = useMemo(() => [
    ...engagements.map(eng => {
      const tour = TOURS.find(t => t.id === eng.tourId);
      const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
      const venue = COMPANIES.find(c => c.id === eng.venueId);
      return {
        id: eng.id,
        date: eng.showDates[0]?.date || '',
        showTime: eng.showDates[0]?.showTime || '',
        tourName: tour?.name || '',
        attractionName: attr?.name || '',
        venueName: venue?.tradeName || '',
        venueCity: venue?.city || '',
        status: eng.status,
        engagementId: eng.id,
      };
    }),
    ...customHolds,
  ], [engagements, customHolds]);

  const filteredEntries = useMemo(() =>
    allEntries.filter(e => activeStatuses.has(e.status)),
    [allEntries, activeStatuses]
  );

  const getEntriesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEntries.filter(e => e.date === dateStr);
  };

  const handleEventClick = (entry: CalendarEntry) => {
    if (entry.engagementId) {
      onNavigate('engagement-detail', { engagementId: entry.engagementId });
    }
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  // For list view: get entries in this month sorted by date
  const monthEntries = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return filteredEntries
      .filter(e => e.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEntries, year, month]);

  return (
    <div className="space-y-4">
      {/* ─── Header Row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-md bg-elevated border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
            >
              ‹
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-text-primary min-w-[160px] sm:min-w-[200px] text-center">
              {monthNames[month]} {year}
            </h1>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-md bg-elevated border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
            >
              ›
            </button>
          </div>
          <button
            onClick={goToday}
            className="text-xs bg-elevated px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-elevated border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-ems-accent-dim text-ems-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-hover'
              }`}
            >
              <span>▦</span> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-ems-accent-dim text-ems-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-hover'
              }`}
            >
              <span>≡</span> List
            </button>
          </div>
          <button
            onClick={() => setShowAddHold(true)}
            className="bg-ems-accent hover:bg-ems-accent/80 text-background px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            + Add Hold
          </button>
        </div>
      </div>

      {/* ─── Status Filter Bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted font-medium">Filter:</span>
        {ALL_STATUSES.map(status => {
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
          const active = activeStatuses.has(status);
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                active
                  ? `${cfg.bg} ${cfg.text}`
                  : 'bg-elevated text-text-muted border-border opacity-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-text-muted'}`} />
              {cfg.label}
            </button>
          );
        })}
        <div className="flex gap-1 ml-auto">
          <button onClick={selectAllStatuses} className="text-xs text-ems-accent hover:underline">All</button>
          <span className="text-text-muted text-xs">·</span>
          <button onClick={clearAllStatuses} className="text-xs text-text-muted hover:text-text-secondary">None</button>
        </div>
      </div>

      {/* ─── CALENDAR GRID VIEW ─────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] sm:text-xs text-text-muted py-2 sm:py-2.5 bg-surface font-medium">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="border-b border-r border-border/40 min-h-[70px] sm:min-h-[110px] bg-surface/30" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayEntries = getEntriesForDay(day);
              const isCurrentDay = isToday(day);
              return (
                <div
                  key={day}
                  className={`border-b border-r border-border/40 min-h-[70px] sm:min-h-[110px] p-1 sm:p-1.5 relative transition-colors ${
                    isCurrentDay ? 'bg-ems-accent-dim/20' : 'hover:bg-hover/20'
                  }`}
                >
                  <div className={`text-[10px] sm:text-xs font-medium text-right mb-0.5 sm:mb-1 ${
                    isCurrentDay
                      ? 'w-5 h-5 bg-ems-accent text-background rounded-full flex items-center justify-center ml-auto text-[10px]'
                      : 'text-text-muted'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5 hidden sm:block">
                    {dayEntries.slice(0, 3).map((entry, idx) => {
                      const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.Draft;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleEventClick(entry)}
                          className={`w-full text-left text-[10px] px-1.5 py-1 rounded border truncate font-medium transition-opacity hover:opacity-80 ${cfg.bg} ${cfg.text}`}
                          title={`${entry.attractionName} @ ${entry.venueName}`}
                        >
                          {entry.attractionName || entry.tourName}
                        </button>
                      );
                    })}
                    {dayEntries.length > 3 && (
                      <button
                        onClick={() => setSelectedDay(day)}
                        className="text-[10px] text-ems-accent hover:underline px-1"
                      >
                        +{dayEntries.length - 3} more
                      </button>
                    )}
                  </div>
                  {/* Mobile: show dots only */}
                  <div className="flex gap-0.5 sm:hidden flex-wrap">
                    {dayEntries.slice(0, 4).map((entry, idx) => {
                      const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.Draft;
                      return <span key={idx} className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />;
                    })}
                    {dayEntries.length > 4 && <span className="text-[8px] text-text-muted">+{dayEntries.length - 4}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── LIST VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {monthEntries.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              No events match the current filters for {monthNames[month]} {year}
            </div>
          ) : (
            <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[550px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Show Time</th>
                  <th className="text-left py-2.5 px-3">Attraction — Tour</th>
                  <th className="text-left py-2.5 px-3">Venue</th>
                  <th className="text-left py-2.5 px-3">Market</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.Draft;
                  return (
                    <tr
                      key={i}
                      onClick={() => handleEventClick(entry)}
                      className={`border-b border-border/50 hover:bg-hover cursor-pointer ${!entry.engagementId ? 'opacity-70' : ''}`}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs text-text-secondary">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-text-secondary">
                        {entry.showTime ? (() => {
                          const [h, m] = entry.showTime.split(':');
                          const hr = parseInt(h);
                          return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                        })() : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className="text-text-primary font-medium">{entry.attractionName}</span>
                          {entry.tourName && <span className="text-text-muted">— {entry.tourName}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary text-xs">{entry.venueName}</td>
                      <td className="py-2.5 px-3 text-text-secondary text-xs">{entry.venueCity}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* ─── Day Detail Popover ──────────────────────────────────────────── */}
      {selectedDay !== null && (
        <Modal title={`${monthNames[month]} ${selectedDay}, ${year}`} onClose={() => setSelectedDay(null)} width={440}>
          <div className="space-y-2">
            {getEntriesForDay(selectedDay).map((entry, i) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.Draft;
              return (
                <div key={i} className={`border rounded-lg p-3 ${cfg.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${cfg.text}`}>{entry.attractionName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <div className={`text-xs ${cfg.text} opacity-80`}>{entry.venueName} · {entry.venueCity}</div>
                  {entry.engagementId && (
                    <button
                      onClick={() => { setSelectedDay(null); handleEventClick(entry); }}
                      className="text-ems-accent text-xs mt-2 hover:underline flex items-center gap-1"
                    >
                      View Engagement →
                    </button>
                  )}
                </div>
              );
            })}
            {getEntriesForDay(selectedDay).length === 0 && (
              <div className="text-text-muted text-sm text-center py-4">No events on this date.</div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Add Hold Modal ──────────────────────────────────────────────── */}
      {showAddHold && (
        <Modal title="Add Hold" onClose={() => setShowAddHold(false)} width={500}>
          <AddHoldForm
            onSave={(entry) => {
              setCustomHolds([entry, ...customHolds]);
              setShowAddHold(false);
              addToast('Hold added to calendar', 'success');
            }}
            onCancel={() => setShowAddHold(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Add Hold Form ────────────────────────────────────────────────────────────

function AddHoldForm({ onSave, onCancel }: { onSave: (e: CalendarEntry) => void; onCancel: () => void }) {
  const [tourId, setTourId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [holdType, setHoldType] = useState('SoftHold');

  const activeTours = TOURS.filter(t => t.status === 'ActiveRouting');
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  return (
    <div className="space-y-3">
      <FormField label="Tour" required>
        <select className={inputCls} value={tourId} onChange={e => setTourId(e.target.value)}>
          <option value="">Select tour...</option>
          {activeTours.map(t => (
            <option key={t.id} value={t.id}>
              {ATTRACTIONS.find(a => a.id === t.attractionId)?.name} — {t.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Venue" required>
        <select className={inputCls} value={venueId} onChange={e => setVenueId(e.target.value)}>
          <option value="">Select venue...</option>
          {COMPANIES.filter(c => c.types.includes('Venue')).map(c => (
            <option key={c.id} value={c.id}>{c.tradeName}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Date" required>
        <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
      </FormField>
      <FormField label="Show Time" required>
        <input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} />
      </FormField>
      <FormField label="Hold Type" required>
        <div className="flex gap-4">
          {['SoftHold', 'HardHold'].map(h => (
            <label key={h} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input type="radio" checked={holdType === h} onChange={() => setHoldType(h)} className="accent-ems-accent" />
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${h === 'SoftHold' ? 'bg-ems-amber' : 'bg-ems-amber'}`} />
                {h === 'SoftHold' ? 'Soft Hold' : 'Hard Hold'}
              </div>
            </label>
          ))}
        </div>
      </FormField>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm hover:text-text-primary">Cancel</button>
        <button
          onClick={() => {
            if (!tourId || !venueId || !date) return;
            const tour = TOURS.find(t => t.id === tourId);
            const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
            const venue = COMPANIES.find(c => c.id === venueId);
            onSave({
              id: `hold-${Date.now()}`,
              date,
              showTime: time,
              tourName: tour?.name || '',
              attractionName: attr?.name || '',
              venueName: venue?.tradeName || '',
              venueCity: venue?.city || '',
              status: holdType,
            });
          }}
          className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium"
        >
          Save Hold
        </button>
      </div>
    </div>
  );
}
