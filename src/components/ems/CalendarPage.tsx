import React, { useState } from 'react';
import { TOURS, ATTRACTIONS, COMPANIES, DMAS, formatDate } from '@/data/constants';
import { StatusBadge, Modal, FilterChips, FormField } from './Primitives';
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
  status: string;
  engagementId?: string;
};

export function CalendarPage({ engagements, onNavigate, addToast }: Props) {
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2025);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddHold, setShowAddHold] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customHolds, setCustomHolds] = useState<CalendarEntry[]>([]);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Build calendar entries from engagements
  const entries: CalendarEntry[] = [
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
        status: eng.status,
        engagementId: eng.id,
      };
    }),
    ...customHolds,
  ];

  const filtered = entries.filter(e => statusFilter === 'All' || e.status === statusFilter);

  const getEntriesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(e => e.date === dateStr);
  };

  const statusColors: Record<string, string> = {
    Confirmed: 'bg-ems-green-dim text-ems-green border-ems-green/30',
    OnSale: 'bg-ems-blue-dim text-ems-blue border-ems-blue/30',
    Draft: 'bg-elevated text-text-secondary border-border',
    Settled: 'bg-ems-accent-dim text-ems-accent border-ems-accent/30',
    Cancelled: 'bg-ems-coral-dim text-ems-coral border-ems-coral/30',
    SoftHold: 'bg-ems-amber-dim text-ems-amber border-ems-amber/30',
    HardHold: 'bg-ems-amber-dim text-ems-amber border-ems-amber/30',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} className="text-text-muted hover:text-text-primary text-lg">◀</button>
          <h1 className="text-xl font-semibold text-text-primary">{months[month]} {year}</h1>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} className="text-text-muted hover:text-text-primary text-lg">▶</button>
          <button onClick={() => { const now = new Date(); setMonth(now.getMonth()); setYear(now.getFullYear()); }} className="text-xs bg-elevated px-2 py-1 rounded text-text-secondary hover:text-text-primary border border-border">Today</button>
        </div>
        <div className="flex items-center gap-2">
          <FilterChips options={['All', 'Confirmed', 'OnSale', 'Draft']} active={statusFilter} onChange={setStatusFilter} />
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="text-xs bg-elevated px-3 py-1.5 rounded text-text-secondary hover:text-text-primary border border-border">{viewMode === 'grid' ? 'List View' : 'Grid View'}</button>
          <button onClick={() => setShowAddHold(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-3 py-1.5 rounded-md text-sm font-medium">+ Add Hold</button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex gap-4 text-xs">
        {[{ s: 'Confirmed', c: 'bg-ems-green' }, { s: 'On Sale', c: 'bg-ems-blue' }, { s: 'Soft Hold', c: 'bg-ems-amber' }, { s: 'Hard Hold', c: 'bg-ems-amber' }, { s: 'Cancelled', c: 'bg-ems-coral' }].map(l => (
          <span key={l.s} className="flex items-center gap-1 text-text-secondary"><span className={`w-2 h-2 rounded-full ${l.c}`} />{l.s}</span>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs text-text-muted py-2 bg-surface">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`b-${i}`} className="border-b border-r border-border/50 min-h-[100px]" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayEntries = getEntriesForDay(day);
              return (
                <div key={day} className="border-b border-r border-border/50 min-h-[100px] p-1 hover:bg-hover/30 relative">
                  <div className="text-xs text-text-muted text-right">{day}</div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEntries.slice(0, 3).map((e, i) => (
                      <button key={i} onClick={() => e.engagementId ? onNavigate('engagement-detail', { engagementId: e.engagementId }) : setSelectedDay(day)}
                        className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate border ${statusColors[e.status] || 'bg-elevated text-text-secondary border-border'}`}>
                        {e.attractionName}
                      </button>
                    ))}
                    {dayEntries.length > 3 && (
                      <button onClick={() => setSelectedDay(day)} className="text-[10px] text-ems-accent hover:underline">+{dayEntries.length - 3} more</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Date</th><th className="text-left py-2.5 px-3">Show Time</th><th className="text-left py-2.5 px-3">Tour</th><th className="text-left py-2.5 px-3">Venue</th><th className="text-left py-2.5 px-3">Status</th>
            </tr></thead>
            <tbody>
              {filtered.sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-hover cursor-pointer" onClick={() => e.engagementId && onNavigate('engagement-detail', { engagementId: e.engagementId })}>
                  <td className="py-2.5 px-3 font-mono text-xs">{formatDate(e.date)}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{e.showTime}</td>
                  <td className="py-2.5 px-3 text-text-primary">{e.attractionName} — {e.tourName}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{e.venueName}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Day Popover */}
      {selectedDay && (
        <Modal title={`${months[month]} ${selectedDay}, ${year}`} onClose={() => setSelectedDay(null)} width={400}>
          <div className="space-y-2">
            {getEntriesForDay(selectedDay).map((e, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="text-text-primary font-medium text-sm">{e.attractionName} — {e.tourName}</div>
                <div className="text-xs text-text-secondary">{e.venueName} · {e.showTime} · <StatusBadge status={e.status} /></div>
                {e.engagementId && <button onClick={() => { setSelectedDay(null); onNavigate('engagement-detail', { engagementId: e.engagementId }); }} className="text-ems-accent text-xs mt-1 hover:underline">View Engagement →</button>}
              </div>
            ))}
            {getEntriesForDay(selectedDay).length === 0 && <div className="text-text-muted text-sm">No events on this date.</div>}
          </div>
        </Modal>
      )}

      {/* Add Hold */}
      {showAddHold && (
        <Modal title="Add Hold" onClose={() => setShowAddHold(false)} width={500}>
          <AddHoldForm onSave={(entry) => { setCustomHolds([entry, ...customHolds]); setShowAddHold(false); addToast('Hold added to calendar', 'success'); }} onCancel={() => setShowAddHold(false)} />
        </Modal>
      )}
    </div>
  );
}

function AddHoldForm({ onSave, onCancel }: { onSave: (e: CalendarEntry) => void; onCancel: () => void }) {
  const [tourId, setTourId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [holdType, setHoldType] = useState('SoftHold');

  const activeTours = TOURS.filter(t => t.status === 'ActiveRouting');

  return (
    <div className="space-y-3">
      <FormField label="Tour" required>
        <select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={tourId} onChange={e => setTourId(e.target.value)}>
          <option value="">Select tour...</option>
          {activeTours.map(t => <option key={t.id} value={t.id}>{ATTRACTIONS.find(a => a.id === t.attractionId)?.name} — {t.name}</option>)}
        </select>
      </FormField>
      <FormField label="Venue" required>
        <select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={venueId} onChange={e => setVenueId(e.target.value)}>
          <option value="">Select venue...</option>
          {COMPANIES.filter(c => c.types.includes('Venue')).map(c => <option key={c.id} value={c.id}>{c.tradeName}</option>)}
        </select>
      </FormField>
      <FormField label="Date" required>
        <input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={date} onChange={e => setDate(e.target.value)} />
      </FormField>
      <FormField label="Show Time" required>
        <input type="time" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={time} onChange={e => setTime(e.target.value)} />
      </FormField>
      <FormField label="Hold Type" required>
        <div className="flex gap-3">
          {['SoftHold', 'HardHold'].map(h => (
            <label key={h} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
              <input type="radio" checked={holdType === h} onChange={() => setHoldType(h)} className="accent-ems-accent" />{h === 'SoftHold' ? 'Soft Hold' : 'Hard Hold'}
            </label>
          ))}
        </div>
      </FormField>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 hover:text-text-primary">Cancel</button>
        <button onClick={() => {
          if (!tourId || !venueId || !date) return;
          const tour = TOURS.find(t => t.id === tourId);
          const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
          const venue = COMPANIES.find(c => c.id === venueId);
          onSave({ id: `hold-${Date.now()}`, date, showTime: time, tourName: tour?.name || '', attractionName: attr?.name || '', venueName: venue?.tradeName || '', status: holdType });
        }} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save Hold</button>
      </div>
    </div>
  );
}
