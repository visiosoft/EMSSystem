import React, { useState } from 'react';
import { ATTRACTIONS, TOURS, COMPANIES, CONTACTS, DMAS, USERS, formatDate, formatCurrency } from '@/data/constants';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Drawer } from './Primitives';

interface Props {
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function AttractionToursPage({ onNavigate, addToast }: Props) {
  const [pageTab, setPageTab] = useState('Attractions');
  const [search, setSearch] = useState('');
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [attrDrawerTab, setAttrDrawerTab] = useState('Overview');
  const [tourDrawerTab, setTourDrawerTab] = useState('Details');

  const attraction = selectedAttraction ? ATTRACTIONS.find(a => a.id === selectedAttraction) : null;
  const tour = selectedTour ? TOURS.find(t => t.id === selectedTour) : null;

  const filteredAttractions = ATTRACTIONS.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));
  const filteredTours = TOURS.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Attraction-Tours</h1>
        <TabBar tabs={['Attractions', 'Tours']} active={pageTab} onChange={setPageTab} />
      </div>

      <div className="w-64"><SearchInput value={search} onChange={setSearch} /></div>

      {pageTab === 'Attractions' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Attraction Name</th>
              <th className="text-left py-2.5 px-3">Genre(s)</th>
              <th className="text-left py-2.5 px-3">Market Tier</th>
              <th className="text-left py-2.5 px-3">Agency</th>
              <th className="text-left py-2.5 px-3">Active Tours</th>
              <th className="text-left py-2.5 px-3">IAE Status</th>
            </tr></thead>
            <tbody>
              {filteredAttractions.map(a => {
                const agency = COMPANIES.find(c => c.id === a.agencyId);
                const tourCount = TOURS.filter(t => t.attractionId === a.id).length;
                return (
                  <tr key={a.id} onClick={() => { setSelectedAttraction(a.id); setAttrDrawerTab('Overview'); }}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 text-text-primary font-medium">{a.name}</td>
                    <td className="py-2.5 px-3">{a.genres.map(g => <span key={g} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary mr-1">{g}</span>)}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{a.marketTier}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{agency?.tradeName}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{tourCount}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={a.iaeStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageTab === 'Tours' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Tour Name</th>
              <th className="text-left py-2.5 px-3">Attraction</th>
              <th className="text-left py-2.5 px-3">Status</th>
              <th className="text-left py-2.5 px-3">Routing Period</th>
              <th className="text-left py-2.5 px-3">Deal Type</th>
              <th className="text-left py-2.5 px-3">Territory DMAs</th>
            </tr></thead>
            <tbody>
              {filteredTours.map(t => {
                const attr = ATTRACTIONS.find(a => a.id === t.attractionId);
                return (
                  <tr key={t.id} onClick={() => { setSelectedTour(t.id); setTourDrawerTab('Details'); }}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 text-text-primary font-medium">{t.name}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{attr?.name}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={t.status} /></td>
                    <td className="py-2.5 px-3 text-xs font-mono">{formatDate(t.startDate)} – {formatDate(t.endDate)}</td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs">{t.dealType}</td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary">{t.dmaIds.slice(0, 3).map(d => DMAS.find(dm => dm.id === d)?.name).join(', ')}{t.dmaIds.length > 3 ? `...+${t.dmaIds.length - 3}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attraction Drawer */}
      {attraction && (
        <Drawer onClose={() => setSelectedAttraction(null)} width={620}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{attraction.name}</h2>
                <div className="flex gap-1.5 mt-1">
                  {attraction.genres.map(g => <span key={g} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{g}</span>)}
                  <span className="text-xs bg-ems-blue-dim px-1.5 py-0.5 rounded text-ems-blue">{attraction.marketTier}</span>
                  <StatusBadge status={attraction.iaeStatus} />
                </div>
              </div>
              <button onClick={() => setSelectedAttraction(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
            </div>
          </div>
          <TabBar tabs={['Overview', 'Tours', 'Engagement History', 'Performance']} active={attrDrawerTab} onChange={setAttrDrawerTab} />
          <div className="p-4">
            {attrDrawerTab === 'Overview' && (
              <div className="space-y-3 text-sm">
                {(() => {
                  const agency = COMPANIES.find(c => c.id === attraction.agencyId);
                  const agent = CONTACTS.find(c => c.id === attraction.primaryAgentContactId);
                  const owner = USERS.find(u => u.id === attraction.ownerId);
                  return (<>
                    <div><span className="text-text-muted text-xs">Primary Agency</span><div className="text-text-primary">{agency?.tradeName}</div></div>
                    {agent && (
                      <div className="bg-elevated rounded-lg p-3">
                        <div className="flex items-center gap-2"><Avatar name={`${agent.firstName} ${agent.lastName}`} size="md" />
                          <div><div className="text-text-primary font-medium">{agent.firstName} {agent.lastName}</div><div className="text-xs text-text-secondary">{agent.title}</div></div>
                        </div>
                        <div className="mt-2 text-xs space-y-1"><div className="text-ems-blue">📧 {agent.email}</div><div className="text-text-secondary">📞 {agent.phone}</div></div>
                      </div>
                    )}
                    <div><span className="text-text-muted text-xs">IAE Relationship Owner</span><div className="text-text-primary">{owner?.name}</div></div>
                  </>);
                })()}
              </div>
            )}
            {attrDrawerTab === 'Tours' && (
              <div className="space-y-3">
                {TOURS.filter(t => t.attractionId === attraction.id).map(t => (
                  <div key={t.id} className="bg-elevated border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-text-primary font-medium">{t.name}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="text-xs text-text-secondary">{formatDate(t.startDate)} – {formatDate(t.endDate)} · {attraction.marketTier}</div>
                    {t.guarantee && <div className="text-xs text-text-secondary mt-1">Guarantee: {formatCurrency(t.guarantee)}{t.splitPct ? ` / ${t.splitPct}-${100 - t.splitPct} split` : ''}</div>}
                    <button onClick={() => { setSelectedAttraction(null); setSelectedTour(t.id); setTourDrawerTab('Details'); }} className="text-ems-accent text-xs mt-2 hover:underline">View Tour Details →</button>
                  </div>
                ))}
              </div>
            )}
            {attrDrawerTab === 'Performance' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total IAE Shows', value: '12' },
                    { label: 'Avg Gross/Show', value: '$350,000' },
                    { label: 'Avg Attendance', value: '14,200' },
                    { label: 'Total IAE Revenue', value: '$4,200,000' },
                  ].map((k, i) => (
                    <div key={i} className="bg-elevated rounded-lg p-3">
                      <div className="text-xs text-text-muted">{k.label}</div>
                      <div className="text-lg font-semibold text-text-primary font-mono">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {attrDrawerTab === 'Engagement History' && (
              <div className="text-sm text-text-secondary">Engagement history for {attraction.name}</div>
            )}
          </div>
        </Drawer>
      )}

      {/* Tour Drawer */}
      {tour && (
        <Drawer onClose={() => setSelectedTour(null)} width={640}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{tour.name}</h2>
                <div className="text-sm text-text-secondary">{ATTRACTIONS.find(a => a.id === tour.attractionId)?.name}</div>
                <StatusBadge status={tour.status} />
              </div>
              <button onClick={() => setSelectedTour(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
            </div>
          </div>
          <TabBar tabs={['Details', 'Technical Rider', 'Hospitality Rider', 'Contacts', 'Availability']} active={tourDrawerTab} onChange={setTourDrawerTab} />
          <div className="p-4 text-sm">
            {tourDrawerTab === 'Details' && (
              <div className="space-y-3">
                <div className="bg-elevated rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-medium text-text-muted uppercase">Deal Structure</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-text-muted text-xs">Type: </span><span className="text-text-primary">{tour.dealType}</span></div>
                    <div><span className="text-text-muted text-xs">Guarantee: </span><span className="text-text-primary font-mono">{formatCurrency(tour.guarantee)}</span></div>
                    {tour.splitPct && <div><span className="text-text-muted text-xs">Split: </span><span className="text-text-primary">{tour.splitPct}% artist</span></div>}
                    {tour.breakeven && <div><span className="text-text-muted text-xs">Breakeven: </span><span className="text-text-primary font-mono">{formatCurrency(tour.breakeven)}</span></div>}
                  </div>
                </div>
                <div><span className="text-text-muted text-xs">Routing: </span><span className="text-text-primary">{formatDate(tour.startDate)} – {formatDate(tour.endDate)}</span></div>
                {tour.radiusMiles > 0 && <div><span className="text-text-muted text-xs">Radius: </span><span className="text-text-primary">{tour.radiusMiles} mi / {tour.radiusDays} days</span></div>}
                <div>
                  <span className="text-text-muted text-xs block mb-1">Territory DMAs</span>
                  <div className="flex flex-wrap gap-1">{tour.dmaIds.map(d => <span key={d} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{DMAS.find(dm => dm.id === d)?.name}</span>)}</div>
                </div>
              </div>
            )}
            {tourDrawerTab === 'Technical Rider' && (
              <div className="space-y-2 text-sm">
                <div className="bg-elevated rounded-lg p-3 font-mono text-xs space-y-1">
                  {tour.stageWidth && <div>Stage Dimensions: {tour.stageWidth}' W × {tour.stageDepth}' D</div>}
                  {tour.riggingLoad && <div>Rigging Load: {tour.riggingLoad.toLocaleString()} lbs</div>}
                  {tour.trucks && <div>Production Trucks: {tour.trucks}</div>}
                  {tour.crew && <div>Touring Crew: {tour.crew}</div>}
                </div>
                <p className="text-text-secondary">{tour.technicalRider}</p>
              </div>
            )}
            {tourDrawerTab === 'Hospitality Rider' && (
              <div className="space-y-2 text-sm">
                <div className="bg-elevated rounded-lg p-3 font-mono text-xs space-y-1">
                  {tour.dressingRooms && <div>Dressing Rooms: {tour.dressingRooms}</div>}
                </div>
                <p className="text-text-secondary">{tour.hospitalityRider}</p>
              </div>
            )}
            {tourDrawerTab === 'Contacts' && (
              <div>
                {(tour.contacts || []).map(tc => {
                  const ct = CONTACTS.find(c => c.id === tc.contactId);
                  if (!ct) return null;
                  return (
                    <div key={tc.contactId} className="flex items-center gap-2 py-2 border-b border-border/50">
                      <Avatar name={`${ct.firstName} ${ct.lastName}`} size="sm" />
                      <div className="flex-1"><div className="text-text-primary">{ct.firstName} {ct.lastName}</div><div className="text-xs text-text-secondary">{tc.role}</div></div>
                      <div className="text-xs text-text-secondary">{ct.phone}</div>
                    </div>
                  );
                })}
                {(!tour.contacts || tour.contacts.length === 0) && <div className="text-text-muted">No contacts assigned.</div>}
              </div>
            )}
            {tourDrawerTab === 'Availability' && (
              <MiniCalendar />
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}

function MiniCalendar() {
  const [month, setMonth] = useState(9); // October
  const [year, setYear] = useState(2025);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => null);

  const holds: Record<number, string> = { 14: 'confirmed', 18: 'softHold', 22: 'hardHold' };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} className="text-text-muted hover:text-text-primary">◀</button>
        <span className="text-text-primary font-medium">{months[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} className="text-text-muted hover:text-text-primary">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="text-text-muted py-1">{d}</div>)}
        {blanks.map((_, i) => <div key={`b-${i}`} />)}
        {days.map(d => {
          const hold = holds[d];
          let dotColor = '';
          if (hold === 'confirmed') dotColor = 'bg-ems-accent';
          else if (hold === 'softHold') dotColor = 'bg-ems-amber';
          else if (hold === 'hardHold') dotColor = 'bg-ems-amber';
          return (
            <div key={d} className="py-1.5 rounded hover:bg-hover cursor-pointer relative text-text-secondary hover:text-text-primary">
              {d}
              {dotColor && <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${dotColor}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
