import React, { useState } from 'react';
import { formatCurrency, formatDate } from '@/data/constants';
import { StatusBadge, Avatar, SearchInput, TabBar, Drawer, Modal, FormField, ActionMenu } from './Primitives';
import { Select2, toOptions, toObjOptions } from './Select2';
import type { Attraction, Tour, Company, Contact } from '@/data/constants';

export const TOUR_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'ActiveRouting', label: 'Active Routing' },
  { value: 'Announced', label: 'Announced' },
  { value: 'Closed', label: 'Closed' },
];

export const DEAL_TYPE_OPTIONS = [
  { value: 'Guarantee', label: 'Guarantee' },
  { value: 'GuaranteeVsSplit', label: 'Guarantee vs Split' },
  { value: 'FlatFee', label: 'Flat Fee' },
];

interface Props {
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  attractions: Attraction[];
  tours: Tour[];
  companies: Company[];
  contacts: Contact[];
  dmas: { id: string; name: string; status: string }[];
  users: { id: string; name: string }[];
  onUpdateAttractions: (attractions: Attraction[]) => void;
  onUpdateTours: (tours: Tour[]) => void;
}

export function AttractionToursPage({ addToast, attractions, tours, companies, contacts, dmas, users, onUpdateAttractions, onUpdateTours }: Props) {
  const [pageTab, setPageTab] = useState('Attractions');
  const [search, setSearch] = useState('');
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [attrDrawerTab, setAttrDrawerTab] = useState('Overview');
  const [tourDrawerTab, setTourDrawerTab] = useState('Details');
  const [showAddAttraction, setShowAddAttraction] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);
  const [editAttraction, setEditAttraction] = useState<Attraction | null>(null);
  const [editTour, setEditTour] = useState<Tour | null>(null);

  const attraction = selectedAttraction ? attractions.find(a => a.id === selectedAttraction) : null;
  const tour = selectedTour ? tours.find(t => t.id === selectedTour) : null;
  const filteredAttractions = attractions.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));
  const filteredTours = tours.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">Attraction-Tours</h1>
          <TabBar tabs={['Attractions', 'Tours']} active={pageTab} onChange={setPageTab} />
        </div>
        {pageTab === 'Attractions'
          ? <button onClick={() => setShowAddAttraction(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Add Attraction</button>
          : <button onClick={() => setShowAddTour(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Add Tour</button>}
      </div>

      <div className="w-full sm:w-64"><SearchInput value={search} onChange={setSearch} /></div>

      {pageTab === 'Attractions' && (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Attraction Name</th><th className="text-left py-2.5 px-3">Genre(s)</th><th className="text-left py-2.5 px-3">Market Tier</th><th className="text-left py-2.5 px-3">Agency</th><th className="text-left py-2.5 px-3">Active Tours</th><th className="text-left py-2.5 px-3">Status</th><th />
            </tr></thead>
            <tbody>
              {filteredAttractions.map(a => {
                const agency = companies.find(c => c.id === a.agencyId);
                const tourCount = tours.filter(t => t.attractionId === a.id).length;
                return (
                  <tr key={a.id} onClick={() => { setSelectedAttraction(a.id); setAttrDrawerTab('Overview'); }} className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 text-text-primary font-medium">{a.name}</td>
                    <td className="py-2.5 px-3">{a.genres.map(g => <span key={g} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary mr-1">{g}</span>)}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{a.marketTier}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{agency?.tradeName}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{tourCount}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={a.iaeStatus} /></td>
                    <td className="py-2.5 px-3 text-right">
                      <ActionMenu items={[
                        { label: 'Edit', onClick: () => setEditAttraction(a) },
                        { label: 'Delete', onClick: () => { onUpdateAttractions(attractions.filter(x => x.id !== a.id)); onUpdateTours(tours.filter(t => t.attractionId !== a.id)); if (selectedAttraction === a.id) setSelectedAttraction(null); addToast('Attraction deleted', 'warning'); }, danger: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageTab === 'Tours' && (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Tour Name</th><th className="text-left py-2.5 px-3">Attraction</th><th className="text-left py-2.5 px-3">Status</th><th className="text-left py-2.5 px-3">Routing Period</th><th className="text-left py-2.5 px-3">Deal Type</th><th className="text-left py-2.5 px-3">Territory Markets</th><th />
            </tr></thead>
            <tbody>
              {filteredTours.map(t => {
                const attr = attractions.find(a => a.id === t.attractionId);
                return (
                  <tr key={t.id} onClick={() => { setSelectedTour(t.id); setTourDrawerTab('Details'); }} className="border-b border-border/50 hover:bg-hover cursor-pointer">
                    <td className="py-2.5 px-3 text-text-primary font-medium">{t.name}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{attr?.name}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={t.status} /></td>
                    <td className="py-2.5 px-3 text-xs font-mono">{formatDate(t.startDate)} – {formatDate(t.endDate)}</td>
                    <td className="py-2.5 px-3 text-text-secondary text-xs">
                      {DEAL_TYPE_OPTIONS.find(d => d.value === t.dealType)?.label || t.dealType}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-text-secondary">{t.dmaIds.slice(0, 3).map(d => dmas.find(dm => dm.id === d)?.name).join(', ')}{t.dmaIds.length > 3 ? `...+${t.dmaIds.length - 3}` : ''}</td>
                    <td className="py-2.5 px-3 text-right">
                      <ActionMenu items={[
                        { label: 'Edit', onClick: () => setEditTour(t) },
                        { label: 'Delete', onClick: () => { onUpdateTours(tours.filter(x => x.id !== t.id)); if (selectedTour === t.id) setSelectedTour(null); addToast('Tour deleted', 'warning'); }, danger: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {attraction && (
        <Drawer onClose={() => setSelectedAttraction(null)} width={1000}>
          <div className="p-4 border-b border-border"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-text-primary">{attraction.name}</h2><div className="flex gap-1.5 mt-1">{attraction.genres.map(g => <span key={g} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{g}</span>)}<span className="text-xs bg-ems-blue-dim px-1.5 py-0.5 rounded text-ems-blue">{attraction.marketTier}</span><StatusBadge status={attraction.iaeStatus} /></div></div><button onClick={() => setSelectedAttraction(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button></div></div>
          <TabBar tabs={['Overview', 'Tours']} active={attrDrawerTab} onChange={setAttrDrawerTab} />
          <div className="p-4">
            {attrDrawerTab === 'Overview' && (() => {
              const agency = companies.find(c => c.id === attraction.agencyId);
              const agent = contacts.find(c => c.id === attraction.primaryAgentContactId);
              const owner = users.find(u => u.id === attraction.ownerId);
              return (
                <div className="space-y-3 text-sm">
                  <div><span className="text-text-muted text-xs">Primary Agency</span><div className="text-text-primary">{agency?.tradeName}</div></div>
                  {agent && <div className="bg-elevated rounded-lg p-3"><div className="flex items-center gap-2"><Avatar name={`${agent.firstName} ${agent.lastName}`} size="md" /><div><div className="text-text-primary font-medium">{agent.firstName} {agent.lastName}</div><div className="text-xs text-text-secondary">{agent.title}</div></div></div></div>}
                  <div><span className="text-text-muted text-xs">Relationship Owner</span><div className="text-text-primary">{owner?.name}</div></div>
                </div>
              );
            })()}
            {attrDrawerTab === 'Tours' && <div className="space-y-3">{tours.filter(t => t.attractionId === attraction.id).map(t => <div key={t.id} className="bg-elevated border border-border rounded-lg p-3"><div className="flex items-center justify-between mb-1"><span className="text-text-primary font-medium">{t.name}</span><StatusBadge status={t.status} /></div><div className="text-xs text-text-secondary">{formatDate(t.startDate)} – {formatDate(t.endDate)} · {attraction.marketTier}</div>{t.guarantee && <div className="text-xs text-text-secondary mt-1">Guarantee: {formatCurrency(t.guarantee)}</div>}</div>)}</div>}
          </div>
        </Drawer>
      )}

      {tour && (
        <Drawer onClose={() => setSelectedTour(null)} width={640}>
          <div className="p-4 border-b border-border"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-text-primary">{tour.name}</h2><div className="text-sm text-text-secondary">{attractions.find(a => a.id === tour.attractionId)?.name}</div><StatusBadge status={tour.status} /></div><button onClick={() => setSelectedTour(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button></div></div>
          <TabBar tabs={['Details', 'Contacts']} active={tourDrawerTab} onChange={setTourDrawerTab} />
          <div className="p-4 text-sm">
            {tourDrawerTab === 'Details' && (
              <div className="space-y-2">
                <div><span className="text-text-muted text-xs">Deal Type: </span><span className="text-text-primary">{DEAL_TYPE_OPTIONS.find(d => d.value === tour.dealType)?.label || tour.dealType}</span></div>
                <div><span className="text-text-muted text-xs">Routing: </span><span className="text-text-primary">{formatDate(tour.startDate)} – {formatDate(tour.endDate)}</span></div>
              </div>
            )}
            {tourDrawerTab === 'Contacts' && <div>{(tour.contacts || []).map(tc => { const ct = contacts.find(c => c.id === tc.contactId); if (!ct) return null; return <div key={tc.contactId} className="flex items-center gap-2 py-2 border-b border-border/50"><Avatar name={`${ct.firstName} ${ct.lastName}`} size="sm" /><div className="flex-1"><div className="text-text-primary">{ct.firstName} {ct.lastName}</div><div className="text-xs text-text-secondary">{tc.role}</div></div></div>; })}{(!tour.contacts || tour.contacts.length === 0) && <div className="text-text-muted">No contacts assigned.</div>}</div>}
          </div>
        </Drawer>
      )}

      {showAddAttraction && <Modal title="Add Attraction" onClose={() => setShowAddAttraction(false)} width={700}><AttractionForm companies={companies} contacts={contacts} users={users} onSave={(a) => { onUpdateAttractions([a, ...attractions]); setShowAddAttraction(false); addToast('Attraction created', 'success'); }} onCancel={() => setShowAddAttraction(false)} /></Modal>}
      {editAttraction && <Modal title="Edit Attraction" onClose={() => setEditAttraction(null)} width={700}><AttractionForm companies={companies} contacts={contacts} users={users} initial={editAttraction} onSave={(a) => { onUpdateAttractions(attractions.map(x => x.id === editAttraction.id ? a : x)); setEditAttraction(null); addToast('Attraction updated', 'success'); }} onCancel={() => setEditAttraction(null)} /></Modal>}
      {showAddTour && <Modal title="Add Tour" onClose={() => setShowAddTour(false)} width={750}><TourForm attractions={attractions} onSave={(t) => { onUpdateTours([t, ...tours]); setShowAddTour(false); addToast('Tour created', 'success'); }} onCancel={() => setShowAddTour(false)} /></Modal>}
      {editTour && <Modal title="Edit Tour" onClose={() => setEditTour(null)} width={750}><TourForm attractions={attractions} initial={editTour} onSave={(t) => { onUpdateTours(tours.map(x => x.id === editTour.id ? t : x)); setEditTour(null); addToast('Tour updated', 'success'); }} onCancel={() => setEditTour(null)} /></Modal>}
    </div>
  );
}

function AttractionForm({ onSave, onCancel, initial, companies, contacts, users }: { onSave: (a: Attraction) => void; onCancel: () => void; initial?: Attraction; companies: Company[]; contacts: Contact[]; users: { id: string; name: string }[] }) {
  const [name, setName] = useState(initial?.name || '');
  const [genres, setGenres] = useState((initial?.genres || []).join(', '));
  const [marketTier, setMarketTier] = useState(initial?.marketTier || 'Arena');
  const [agencyId, setAgencyId] = useState(initial?.agencyId || companies.find(c => c.types.includes('TalentAgency'))?.id || '');
  const [primaryAgentContactId, setPrimaryAgentContactId] = useState(initial?.primaryAgentContactId || '');
  const [ownerId, setOwnerId] = useState(initial?.ownerId || users[0]?.id || '');
  const [iaeStatus, setIaeStatus] = useState(initial?.iaeStatus || 'Active');

  const agencyContacts = contacts.filter(c => c.companyId === agencyId);
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const agencyOptions = toObjOptions(companies.filter(c => c.types.includes('TalentAgency')), c => c.tradeName);
  const agentOptions = toObjOptions(agencyContacts, c => `${c.firstName} ${c.lastName}`);
  const ownerOptions = toObjOptions(users, u => u.name);

  return (
    <div className="space-y-3">
      <FormField label="Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></FormField>
      <FormField label="Genres (comma separated)"><input className={inputCls} value={genres} onChange={e => setGenres(e.target.value)} /></FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Market Tier">
          <Select2 options={toOptions(['Arena', 'Theater', 'Club'])} value={marketTier} onChange={setMarketTier} />
        </FormField>
        <FormField label="Status">
          <Select2 options={[
            { value: 'Active', label: 'Active' },
            { value: 'Prospective', label: 'Prospective' },
            { value: 'Dead', label: 'Inactive' },
          ]} value={iaeStatus} onChange={setIaeStatus} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Agency">
          <Select2 options={agencyOptions} value={agencyId} onChange={v => { setAgencyId(v); setPrimaryAgentContactId(''); }} />
        </FormField>
        <FormField label="Primary Agent">
          <Select2 options={agentOptions} value={primaryAgentContactId} onChange={setPrimaryAgentContactId} placeholder="Select agent..." />
        </FormField>
      </div>
      <FormField label="Relationship Owner">
        <Select2 options={ownerOptions} value={ownerId} onChange={setOwnerId} />
      </FormField>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button>
        <button onClick={() => onSave({ id: initial?.id || `atr-${Date.now()}`, name, genres: genres.split(',').map(x => x.trim()).filter(Boolean), marketTier, agencyId, primaryAgentContactId, iaeStatus, ownerId })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}

export interface TourFormProps {
  onSave: (t: Tour) => void;
  onCancel?: () => void;
  initial?: Tour;
  attractions: Attraction[];
  wizardMode?: boolean;
  onChange?: (data: Partial<Tour> & { isValid: boolean }) => void;
}

export function TourForm({ onSave, onCancel, initial, attractions, wizardMode = false, onChange }: TourFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [attractionId, setAttractionId] = useState(initial?.attractionId || attractions[0]?.id || '');
  const [status, setStatus] = useState(initial?.status || 'ActiveRouting');
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [dealType, setDealType] = useState(initial?.dealType || 'Guarantee');
  const [guarantee, setGuarantee] = useState(String(initial?.guarantee || 0));

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  const attractionOptions = toObjOptions(attractions, a => a.name);

  const isValid = !!name.trim() && !!startDate && !!endDate;

  React.useEffect(() => {
    if (wizardMode && onChange) {
      onChange({
        attractionId,
        name,
        status,
        startDate,
        endDate,
        dealType,
        guarantee: Number(guarantee) || 0,
        isValid,
      });
    }
  }, [name, attractionId, status, startDate, endDate, dealType, guarantee]);

  const buildTour = (): Tour => ({
    id: initial?.id || `tour-${Date.now()}`,
    attractionId,
    name,
    status,
    startDate,
    endDate,
    dealType,
    guarantee: Number(guarantee) || 0,
    dmaIds: [],
    splitPct: initial?.splitPct || null,
    breakeven: initial?.breakeven || null,
    radiusMiles: initial?.radiusMiles || 0,
    radiusDays: initial?.radiusDays || 0,
    stageWidth: initial?.stageWidth || null,
    stageDepth: initial?.stageDepth || null,
    riggingLoad: initial?.riggingLoad || null,
    trucks: initial?.trucks || null,
    crew: initial?.crew || null,
    technicalRider: initial?.technicalRider || '',
    hospitalityRider: initial?.hospitalityRider || '',
    dressingRooms: initial?.dressingRooms || null,
    contacts: initial?.contacts || [],
  });

  return (
    <div className="space-y-4">
      <FormField label="Tour Name" required>
        <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. World Tour 2025" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Artist / Attraction">
          <Select2 options={attractionOptions} value={attractionId} onChange={setAttractionId} />
        </FormField>
        <FormField label="Tour Status">
          <Select2 options={TOUR_STATUS_OPTIONS} value={status} onChange={setStatus} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Start Date" required>
          <input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="End Date" required>
          <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Deal Type">
          <Select2 options={DEAL_TYPE_OPTIONS} value={dealType} onChange={setDealType} />
        </FormField>
        <FormField label="Guarantee Amount ($)">
          <input type="number" className={inputCls} value={guarantee} onChange={e => setGuarantee(e.target.value)} placeholder="0" />
        </FormField>
      </div>

      {!wizardMode && (
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          {onCancel && <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm hover:text-text-primary">Cancel</button>}
          <button
            onClick={() => onSave(buildTour())}
            disabled={!isValid}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isValid ? 'bg-ems-accent text-background hover:bg-ems-accent/80' : 'bg-elevated text-text-muted cursor-not-allowed'}`}
          >
            Save Tour
          </button>
        </div>
      )}
    </div>
  );
}
