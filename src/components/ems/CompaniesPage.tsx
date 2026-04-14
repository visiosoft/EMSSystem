import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Drawer, Modal, FormField, ActionMenu } from './Primitives';
import { Select2, toOptions, toObjOptions } from './Select2';
import type { Company, Contact, CompanyTicketing } from '@/data/constants';
import { lookupDmasForPostal } from '@/data/constants';
import { useAddressAutofill } from '@/hooks/useAddressAutofill';
import { useCompanyPlaceSearch } from '@/hooks/useCompanyPlaceSearch';
import type { PlaceDetailsResult } from '@/lib/googlePlaces';

interface Props {
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  companies: Company[];
  contacts: Contact[];
  dmas: { id: string; name: string; status: string }[];
  onUpdateCompanies: (companies: Company[]) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
}

const overviewLabelCls = 'text-text-muted text-xs';
const overviewValueCls = 'text-text-primary mt-0.5';

function renderPhysicalAddressValue(c: Company) {
  const hasPhysical = !!(c.physicalStreet || c.physicalCity || c.physicalState || c.physicalPostalCode || c.physicalCountry);
  if (hasPhysical) {
    const cityState = [c.physicalCity, c.physicalState].filter(Boolean).join(', ');
    const line2 = [cityState, c.physicalPostalCode].filter(Boolean).join(' ');
    return (
      <div className={overviewValueCls}>
        {c.physicalStreet ? <>{c.physicalStreet}<br /></> : null}
        {line2 ? <>{line2}<br /></> : null}
        {c.physicalCountry || null}
      </div>
    );
  }
  if (c.city || c.state) {
    return <div className={overviewValueCls}>{[c.city, c.state].filter(Boolean).join(', ')}</div>;
  }
  return <div className={`${overviewValueCls} text-text-muted`}>—</div>;
}

function renderMailingAddressValue(c: Company) {
  const hasMailing = !!(c.mailingStreet || c.mailingCity || c.mailingState || c.mailingPostalCode || c.mailingCountry);
  if (hasMailing) {
    const cityState = [c.mailingCity, c.mailingState].filter(Boolean).join(', ');
    const line2 = [cityState, c.mailingPostalCode].filter(Boolean).join(' ');
    return (
      <div className={overviewValueCls}>
        {c.mailingStreet ? <>{c.mailingStreet}<br /></> : null}
        {line2 ? <>{line2}<br /></> : null}
        {c.mailingCountry || null}
      </div>
    );
  }
  return renderPhysicalAddressValue(c);
}

function OverviewFields({ selectedCompany, dmas }: { selectedCompany: Company; dmas: { id: string; name: string; status: string }[] }) {
  const c = selectedCompany;
  const dmaNames = c.dmaIds.map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—';
  const serviceNames = (c.serviceAreaDmaIds || c.dmaIds).map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—';

  return (
    <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
      <div>
        <span className={overviewLabelCls}>Company Type</span>
        <div className={overviewValueCls}>{c.types.join(', ') || '—'}</div>
      </div>
      <div>
        <span className={overviewLabelCls}>Status</span>
        <div className={overviewValueCls}>{c.status}</div>
      </div>
      <div className="sm:col-span-2">
        <span className={overviewLabelCls}>Company Name</span>
        <div className={`${overviewValueCls} font-medium`}>{c.tradeName}</div>
      </div>
      <div className="min-w-0">
        <span className={overviewLabelCls}>Physical Address</span>
        {renderPhysicalAddressValue(c)}
      </div>
      <div className="min-w-0">
        <span className={overviewLabelCls}>Mailing Address</span>
        {renderMailingAddressValue(c)}
      </div>
      <div>
        <span className={overviewLabelCls}>DMA(s)</span>
        <div className={overviewValueCls}>{dmaNames}</div>
      </div>
      <div>
        <span className={overviewLabelCls}>Service Area DMA(s)</span>
        <div className={overviewValueCls}>{serviceNames}</div>
      </div>
    </div>
  );
}

export function CompaniesPage({ addToast, companies, contacts, dmas, onUpdateCompanies, onUpdateContacts }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [drawerTab, setDrawerTab] = useState('Overview');
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const typeOptions = ['All', 'Venue', 'TalentAgency', 'Ticketing', 'Labor', 'AdAgency', 'Sponsor'];
  const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) || null : null;
  const filtered = companies.filter(c => {
    if (search && !c.tradeName.toLowerCase().includes(search.toLowerCase()) && !c.legalName.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'All' && !c.types.includes(typeFilter)) return false;
    return true;
  });
  const companyContacts = selectedCompany ? contacts.filter(ct => ct.companyId === selectedCompany.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Companies</h1>
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{filtered.length}</span>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Add Company</button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search companies..." /></div>
        <FilterChips options={typeOptions} active={typeFilter} onChange={setTypeFilter} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Company Name</th>
              <th className="text-left py-2.5 px-3">Type(s)</th>
              <th className="text-left py-2.5 px-3">City, State</th>
              <th className="text-left py-2.5 px-3">DMA(s)</th>
              <th className="text-left py-2.5 px-3">Service Area DMA(s)</th>
              <th className="text-left py-2.5 px-3">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} onClick={() => { setSelectedCompanyId(c.id); setDrawerTab('Overview'); }} className="border-b border-border/50 hover:bg-hover cursor-pointer">
                <td className="py-2.5 px-3 text-text-primary font-medium">{c.tradeName}</td>
                <td className="py-2.5 px-3"><div className="flex gap-1">{c.types.map(t => <span key={t} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{t}</span>)}</div></td>
                <td className="py-2.5 px-3 text-text-secondary">{c.city}, {c.state}</td>
                <td className="py-2.5 px-3 text-xs text-text-secondary">{c.dmaIds.map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</td>
                <td className="py-2.5 px-3 text-xs text-text-secondary">{(c.serviceAreaDmaIds || c.dmaIds).map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</td>
                <td className="py-2.5 px-3"><StatusBadge status={c.status} /></td>
                <td className="py-2.5 px-3">
                  <ActionMenu items={[
                    { label: 'View Details', onClick: () => { setSelectedCompanyId(c.id); setDrawerTab('Overview'); } },
                    { label: 'Edit', onClick: () => setEditCompany(c) },
                    { label: 'Delete', onClick: () => { onUpdateCompanies(companies.filter(x => x.id !== c.id)); onUpdateContacts(contacts.filter(ct => ct.companyId !== c.id)); if (selectedCompanyId === c.id) setSelectedCompanyId(null); addToast('Company deleted', 'warning'); }, danger: true },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCompany && (
        <Drawer onClose={() => setSelectedCompanyId(null)} width={1080}>
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Avatar name={selectedCompany.tradeName} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary">{selectedCompany.tradeName}</h2>
              <div className="flex gap-1.5 mt-1">
                {selectedCompany.types.map(t => <span key={t} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{t}</span>)}
                <StatusBadge status={selectedCompany.status} />
              </div>
            </div>
            <button onClick={() => setSelectedCompanyId(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
          </div>

          <TabBar tabs={['Overview', 'Contacts', 'Engagements', 'Documents', 'Ticketing']} active={drawerTab} onChange={setDrawerTab} />

          <div className="p-4">
            {drawerTab === 'Overview' && (
              <OverviewFields selectedCompany={selectedCompany} dmas={dmas} />
            )}

            {drawerTab === 'Contacts' && (
              <div className="space-y-3">
                <button onClick={() => setShowAddContact(!showAddContact)} className="text-ems-accent text-sm hover:underline">+ Add Contact</button>
                {showAddContact && <ContactForm companies={companies} onSave={(ct) => {
                  const newContact: Contact = {
                    id: `ct-${Date.now()}`,
                    companyId: selectedCompany.id,
                    status: 'Active',
                    firstName: ct.firstName || '',
                    lastName: ct.lastName || '',
                    title: ct.title || '',
                    email: ct.email || ct.workEmail || '',
                    phone: ct.phone || ct.workPhone || '',
                    roles: ct.roles || [],
                    department: ct.department,
                    cellPhone: ct.cellPhone,
                    workEmail: ct.workEmail,
                    workPhone: ct.workPhone,
                  };
                  onUpdateContacts([newContact, ...contacts]);
                  setShowAddContact(false);
                  addToast('Contact added', 'success');
                }} onCancel={() => setShowAddContact(false)} currentCompanyId={selectedCompany.id} />}
                <table className="w-full text-sm">
                  <thead><tr className="text-text-muted text-xs border-b border-border"><th className="text-left py-2">Name</th><th className="text-left py-2">Title</th><th className="text-left py-2">Roles</th><th className="text-left py-2">Email</th><th className="text-left py-2">Phone</th><th /></tr></thead>
                  <tbody>
                    {companyContacts.map(ct => (
                      <tr key={ct.id} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">{ct.firstName} {ct.lastName}</td>
                        <td className="py-2 text-text-secondary">{ct.title}</td>
                        <td className="py-2">{ct.roles.map(r => <span key={r} className="text-xs bg-elevated px-1 py-0.5 rounded text-text-secondary mr-1">{r}</span>)}</td>
                        <td className="py-2 text-ems-blue text-xs">{ct.workEmail || ct.email}</td>
                        <td className="py-2 text-text-secondary text-xs">{ct.workPhone || ct.phone}</td>
                        <td className="py-2 text-right">
                          <ActionMenu items={[
                            { label: 'Edit', onClick: () => setEditContact(ct) },
                            { label: 'Delete', onClick: () => { onUpdateContacts(contacts.filter(x => x.id !== ct.id)); addToast('Contact deleted', 'warning'); }, danger: true },
                          ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {drawerTab === 'Engagements' && <div className="text-sm text-text-secondary"><p>Engagements involving {selectedCompany.tradeName} will appear here.</p></div>}
            {drawerTab === 'Documents' && <div className="space-y-3"><button onClick={() => addToast('Upload simulated', 'success')} className="text-ems-accent text-sm hover:underline">+ Upload Document</button><div className="text-sm text-text-muted">No documents uploaded yet.</div></div>}

            {drawerTab === 'Ticketing' && (
              <CompanyTicketingTab
                company={selectedCompany}
                contacts={companyContacts}
                onSave={(ticketing) => {
                  onUpdateCompanies(companies.map(c => (c.id === selectedCompany.id ? { ...c, ticketing } : c)));
                  addToast('Ticketing details saved', 'success');
                }}
              />
            )}
          </div>
        </Drawer>
      )}

      {showAddModal && (
        <Modal title="Add Company" onClose={() => setShowAddModal(false)} width={960}>
          <CompanyForm dmas={dmas} onSave={(data) => { onUpdateCompanies([data, ...companies]); setShowAddModal(false); addToast('Company created successfully', 'success'); }} onCancel={() => setShowAddModal(false)} />
        </Modal>
      )}

      {editCompany && (
        <Modal title="Edit Company" onClose={() => setEditCompany(null)} width={960}>
          <CompanyForm dmas={dmas} initial={editCompany} onSave={(data) => { onUpdateCompanies(companies.map(c => c.id === editCompany.id ? data : c)); setEditCompany(null); addToast('Company updated', 'success'); }} onCancel={() => setEditCompany(null)} />
        </Modal>
      )}

      {editContact && (
        <Modal title="Edit Contact" onClose={() => setEditContact(null)} width={700}>
          <ContactForm companies={companies} initial={editContact} onSave={(ct) => { onUpdateContacts(contacts.map(c => c.id === editContact.id ? { ...c, ...ct } : c)); setEditContact(null); addToast('Contact updated', 'success'); }} onCancel={() => setEditContact(null)} currentCompanyId={editContact.companyId} />
        </Modal>
      )}
    </div>
  );
}

const TICKETING_SYSTEM_OPTIONS = ['Ticketmaster', 'AXS', 'SeatGeek', 'Etix', 'Dice', 'See Tickets', 'Other'];
const SEATING_TYPE_OPTIONS = ['Reserved Seating', 'General Admission', 'Mixed', 'Standing Room Only', 'Festival / GA + Reserved', 'Other'];

function defaultCompanyTicketing(): CompanyTicketing {
  return {
    seatingChartFiles: [],
    ticketingSystem: '',
    venueWebsite: '',
    seatingType: '',
    managers: [],
  };
}

function CompanyTicketingTab({
  company,
  contacts,
  onSave,
}: {
  company: Company;
  contacts: Contact[];
  onSave: (t: CompanyTicketing) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFileList, setShowFileList] = useState(false);
  const [draft, setDraft] = useState<CompanyTicketing>(() => company.ticketing ?? defaultCompanyTicketing());

  useEffect(() => {
    setDraft(company.ticketing ? JSON.parse(JSON.stringify(company.ticketing)) as CompanyTicketing : defaultCompanyTicketing());
  }, [company]);

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/90 focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';
  const labelCls = 'text-sm font-medium text-text-secondary block mb-1.5';
  const sublabelCls = 'text-xs text-text-secondary/90 block mb-2';

  const contactOptions = useMemo(
    () => [{ value: '', label: 'Select name…' }, ...contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))],
    [contacts],
  );

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setDraft(prev => ({
      ...prev,
      seatingChartFiles: [
        ...prev.seatingChartFiles,
        ...arr.map(f => ({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name: f.name })),
      ],
    }));
  };

  const applyContactToManager = (managerId: string, contactId: string) => {
    const ct = contacts.find(c => c.id === contactId);
    setDraft(prev => ({
      ...prev,
      managers: prev.managers.map(m => {
        if (m.id !== managerId) return m;
        if (!ct) return { ...m, contactId: undefined };
        return {
          ...m,
          contactId: ct.id,
          displayName: `${ct.firstName} ${ct.lastName}`,
          email: ct.workEmail || ct.email,
          phone: ct.workPhone || ct.phone,
        };
      }),
    }));
  };

  const addManager = () => {
    setDraft(prev => ({
      ...prev,
      managers: [
        ...prev.managers,
        { id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, displayName: '', phone: '', email: '' },
      ],
    }));
  };

  const removeManager = (id: string) => {
    setDraft(prev => ({ ...prev, managers: prev.managers.filter(m => m.id !== id) }));
  };

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-text-primary tracking-tight">Ticketing</h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          Upload seating charts, set the ticketing platform and venue links, and list who runs ticketing for this company.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card/40 p-5 sm:p-6 space-y-6">
        <section className="space-y-3">
          <div>
            <span className={labelCls}>Seating chart</span>
            <p className={sublabelCls}>Maps and diagrams (PDF, images, or CAD). Stored as references in this demo.</p>
          </div>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="group border border-dashed border-border rounded-lg px-4 py-7 text-center bg-surface/60 hover:bg-hover/60 hover:border-ems-accent/40 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.svg,.dwg"
              onChange={e => { const l = e.target.files; if (l) addFiles(l); e.target.value = ''; }}
            />
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-elevated border border-border text-text-secondary mb-2 group-hover:border-ems-accent/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </span>
            <span className="text-sm font-medium text-text-primary block">Attach file</span>
            <span className="text-xs text-text-secondary mt-1 block">Drop files here or click to browse</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => setShowFileList(v => !v)}
              className="text-ems-accent hover:text-ems-accent/90 hover:underline"
            >
              {showFileList ? 'Hide file list' : 'Show file list'} ({draft.seatingChartFiles.length})
            </button>
          </div>
          {showFileList && draft.seatingChartFiles.length > 0 && (
            <ul className="text-sm text-text-primary bg-surface border border-border rounded-md divide-y divide-border/80 max-h-36 overflow-y-auto">
              {draft.seatingChartFiles.map(f => (
                <li key={f.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="truncate text-text-secondary">{f.name}</span>
                  <button
                    type="button"
                    className="text-xs text-ems-coral shrink-0 hover:underline"
                    onClick={() => setDraft(prev => ({ ...prev, seatingChartFiles: prev.seatingChartFiles.filter(x => x.id !== f.id) }))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="h-px bg-border/80" aria-hidden />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <span className={labelCls}>Ticketing system</span>
            <Select2
              options={toOptions(TICKETING_SYSTEM_OPTIONS)}
              value={draft.ticketingSystem}
              onChange={v => setDraft(prev => ({ ...prev, ticketingSystem: v }))}
              placeholder="Select system…"
              allowClear
            />
          </div>
          <div>
            <span className={labelCls}>Seating type</span>
            <Select2
              options={toOptions(SEATING_TYPE_OPTIONS)}
              value={draft.seatingType}
              onChange={v => setDraft(prev => ({ ...prev, seatingType: v }))}
              placeholder="Select type…"
              allowClear
            />
          </div>
          <div className="md:col-span-2">
            <span className={labelCls}>Venue website</span>
            <input
              className={inputCls}
              type="url"
              value={draft.venueWebsite}
              onChange={e => setDraft(prev => ({ ...prev, venueWebsite: e.target.value }))}
              placeholder="https://example.com/tickets"
            />
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card/40 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-text-primary">Ticketing managers</h4>
            <p className="text-sm text-text-secondary mt-0.5">Link company contacts or enter details manually.</p>
          </div>
          <button
            type="button"
            onClick={addManager}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-ems-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-ems-accent/90"
          >
            <span className="text-base leading-none">+</span>
            Add manager
          </button>
        </div>

        {draft.managers.length === 0 ? (
          <p className="text-sm text-text-secondary py-2 border-t border-border/60 pt-4">
            No managers added yet. Use <span className="text-text-primary font-medium">Add manager</span> to create a row.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.managers.map((m, idx) => (
              <div
                key={m.id}
                className="rounded-lg border border-border/90 bg-surface/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 mb-1">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Manager {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeManager(m.id)}
                    className="text-xs font-medium text-text-secondary hover:text-ems-coral"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
                  <div className="min-w-0">
                    <span className={labelCls}>Contact</span>
                    <Select2
                      options={contactOptions}
                      value={m.contactId ?? ''}
                      onChange={cid => {
                        if (cid) applyContactToManager(m.id, cid);
                        else setDraft(prev => ({
                          ...prev,
                          managers: prev.managers.map(x => (x.id === m.id ? { ...x, contactId: undefined } : x)),
                        }));
                      }}
                      placeholder="Select from contacts…"
                      allowClear
                    />
                  </div>
                  <div>
                    <span className={labelCls}>Phone</span>
                    <input
                      className={inputCls}
                      value={m.phone}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        managers: prev.managers.map(x => (x.id === m.id ? { ...x, phone: e.target.value } : x)),
                      }))}
                      placeholder="(555) 000-0000"
                      type="tel"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className={labelCls}>Display name</span>
                    <input
                      className={inputCls}
                      value={m.displayName}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        managers: prev.managers.map(x => (x.id === m.id ? { ...x, displayName: e.target.value } : x)),
                      }))}
                      placeholder="Shown on internal records"
                    />
                  </div>
                  <div>
                    <span className={labelCls}>Email</span>
                    <input
                      className={inputCls}
                      type="email"
                      value={m.email}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        managers: prev.managers.map(x => (x.id === m.id ? { ...x, email: e.target.value } : x)),
                      }))}
                      placeholder="name@company.com"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="w-full sm:w-auto min-w-[200px] rounded-md bg-ems-accent px-5 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-ems-accent/90"
        >
          Save ticketing details
        </button>
      </footer>
    </div>
  );
}

const CONTACT_ROLES = ['Booking', 'BoxOffice', 'ProductionManager', 'Marketing', 'Settlement', 'TourManager', 'TourAccountant', 'Publicist', 'Other'];
const DEPARTMENTS = ['Booking', 'Production', 'Marketing', 'Finance', 'Operations', 'Legal', 'Management', 'Other'];

function ContactForm({ onSave, onCancel, initial, companies, currentCompanyId }: {
  onSave: (ct: Partial<Contact>) => void;
  onCancel: () => void;
  initial?: Contact;
  companies: Company[];
  currentCompanyId?: string;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName || '');
  const [lastName, setLastName] = useState(initial?.lastName || '');
  const [companyId, setCompanyId] = useState(initial?.companyId || currentCompanyId || '');
  const [department, setDepartment] = useState(initial?.department || '');
  const [role, setRole] = useState(initial?.roles?.[0] || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [workEmail, setWorkEmail] = useState(initial?.workEmail || initial?.email || '');
  const [workPhone, setWorkPhone] = useState(initial?.workPhone || initial?.phone || '');
  const [cellPhone, setCellPhone] = useState(initial?.cellPhone || '');

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  return (
    <div className="bg-elevated border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <FormField label="First Name" required><input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} /></FormField>
          <FormField label="Last Name" required><input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} /></FormField>
          <FormField label="Company">
            <Select2 options={[{ value: '', label: 'Select company...' }, ...toObjOptions(companies, c => c.tradeName)]} value={companyId} onChange={setCompanyId} placeholder="Select company..." />
          </FormField>
          <FormField label="Department">
            <Select2 options={[{ value: '', label: 'Select department...' }, ...toOptions(DEPARTMENTS)]} value={department} onChange={setDepartment} placeholder="Select department..." />
          </FormField>
          <FormField label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Agent" /></FormField>
        </div>
        <div className="space-y-3">
          <FormField label="Role">
            <Select2 options={[{ value: '', label: 'Select role...' }, ...toOptions(CONTACT_ROLES)]} value={role} onChange={setRole} placeholder="Select role..." />
          </FormField>
          <FormField label="Work Email"><input type="email" className={inputCls} value={workEmail} onChange={e => setWorkEmail(e.target.value)} placeholder="name@company.com" /></FormField>
          <FormField label="Work Phone"><input type="tel" className={inputCls} value={workPhone} onChange={e => setWorkPhone(e.target.value)} placeholder="(555) 000-0000" /></FormField>
          <FormField label="Cell Phone"><input type="tel" className={inputCls} value={cellPhone} onChange={e => setCellPhone(e.target.value)} placeholder="(555) 000-0000" /></FormField>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary text-sm px-3 py-1.5 hover:text-text-primary">Cancel</button>
        <button onClick={() => onSave({ firstName, lastName, title, email: workEmail, phone: workPhone, roles: role ? [role] : [], department, cellPhone, workEmail, workPhone, companyId })} className="bg-ems-accent text-background text-sm px-4 py-1.5 rounded-md font-medium">Save Contact</button>
      </div>
    </div>
  );
}

function CompanyForm({ onSave, onCancel, initial, dmas }: {
  onSave: (c: Company) => void;
  onCancel: () => void;
  initial?: Company;
  dmas: { id: string; name: string; status: string }[];
}) {
  const [legalName, setLegalName] = useState(initial?.legalName || '');
  const [tradeName, setTradeName] = useState(initial?.tradeName || '');
  const [type, setType] = useState(initial?.types[0] || 'Venue');
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [selectedDmas, setSelectedDmas] = useState<string[]>(initial?.dmaIds || []);
  const [selectedServiceDmas, setSelectedServiceDmas] = useState<string[]>(initial?.serviceAreaDmaIds || initial?.dmaIds || []);
  const [errors, setErrors] = useState<string[]>([]);

  const [physicalStreet, setPhysicalStreet] = useState(initial?.physicalStreet || '');
  const [physicalCity, setPhysicalCity] = useState(initial?.physicalCity || '');
  const [physicalState, setPhysicalState] = useState(initial?.physicalState || '');
  const [physicalPostalCode, setPhysicalPostalCode] = useState(initial?.physicalPostalCode || '');
  const [physicalCountry, setPhysicalCountry] = useState(initial?.physicalCountry || 'USA');
  const [lastGoogleFormattedMailing, setLastGoogleFormattedMailing] = useState('');

  useEffect(() => {
    const digits = physicalPostalCode.replace(/\D/g, '');
    if (digits.length < 3) return;
    const { dmaIds } = lookupDmasForPostal(physicalPostalCode, physicalCountry);
    dmaIds.forEach((id) => {
      setSelectedDmas((prev) => (prev.includes(id) ? prev : [...prev, id]));
    });
  }, [physicalPostalCode, physicalCountry]);

  const [mailingEnabled, setMailingEnabled] = useState(!!(initial?.mailingStreet || initial?.mailingCity));
  const [mailingStreet, setMailingStreet] = useState(initial?.mailingStreet || '');
  const [mailingCity, setMailingCity] = useState(initial?.mailingCity || '');
  const [mailingState, setMailingState] = useState(initial?.mailingState || '');
  const [mailingPostalCode, setMailingPostalCode] = useState(initial?.mailingPostalCode || '');
  const [mailingCountry, setMailingCountry] = useState(initial?.mailingCountry || 'USA');

  const patchPhysicalAddress = useCallback((patch: Partial<{ street: string; city: string; state: string; postalCode: string; country: string }>) => {
    if (patch.street !== undefined) setPhysicalStreet(patch.street);
    if (patch.city !== undefined) setPhysicalCity(patch.city);
    if (patch.state !== undefined) setPhysicalState(patch.state);
    if (patch.postalCode !== undefined) setPhysicalPostalCode(patch.postalCode);
    if (patch.country !== undefined) setPhysicalCountry(patch.country);
  }, []);

  const patchMailingAddress = useCallback((patch: Partial<{ street: string; city: string; state: string; postalCode: string; country: string }>) => {
    if (patch.street !== undefined) setMailingStreet(patch.street);
    if (patch.city !== undefined) setMailingCity(patch.city);
    if (patch.state !== undefined) setMailingState(patch.state);
    if (patch.postalCode !== undefined) setMailingPostalCode(patch.postalCode);
    if (patch.country !== undefined) setMailingCountry(patch.country);
  }, []);

  const onPlaceResolved = useCallback(
    (details: PlaceDetailsResult) => {
      const name = details.placeName?.trim();
      if (name) setTradeName(name);
      patchPhysicalAddress({
        street: details.physical.street || '',
        city: details.physical.city || '',
        state: details.physical.state || '',
        postalCode: details.physical.postalCode || '',
        country: details.physical.country || 'USA',
      });
      patchMailingAddress({
        street: details.mailing.street || '',
        city: details.mailing.city || '',
        state: details.mailing.state || '',
        postalCode: details.mailing.postalCode || '',
        country: details.mailing.country || 'USA',
      });
      setLastGoogleFormattedMailing(details.formattedAddress?.trim() || '');
      const pc = details.physical.postalCode;
      if (pc) {
        const { dmaIds } = lookupDmasForPostal(pc, details.physical.country);
        dmaIds.forEach((id) => {
          setSelectedDmas((prev) => (prev.includes(id) ? prev : [...prev, id]));
        });
      }
    },
    [patchPhysicalAddress, patchMailingAddress],
  );

  const companyPlace = useCompanyPlaceSearch({ query: tradeName, onPlaceResolved });

  const physicalAutofill = useAddressAutofill({
    value: {
      street: physicalStreet,
      city: physicalCity,
      state: physicalState,
      postalCode: physicalPostalCode,
      country: physicalCountry,
    },
    onPatch: patchPhysicalAddress,
    enabled: false,
  });

  const mailingAutofill = useAddressAutofill({
    value: {
      street: mailingStreet,
      city: mailingCity,
      state: mailingState,
      postalCode: mailingPostalCode,
      country: mailingCountry,
    },
    onPatch: patchMailingAddress,
    enabled: mailingEnabled,
  });

  const postalDmaLookup = useMemo(
    () => lookupDmasForPostal(physicalPostalCode, physicalCountry),
    [physicalPostalCode, physicalCountry],
  );
  const postalDigits = useMemo(() => physicalPostalCode.replace(/\D/g, ''), [physicalPostalCode]);

  const handleSave = () => {
    if (!tradeName.trim()) { setErrors(['Company Name is required']); return; }
    onSave({
      id: initial?.id || `co-${Date.now()}`,
      legalName: legalName || tradeName,
      tradeName,
      city: physicalCity || '',
      state: physicalState || '',
      types: [type],
      dmaIds: selectedDmas,
      serviceAreaDmaIds: selectedServiceDmas,
      standing: initial?.standing || 'PreferredVendor',
      status,
      venueProfile: initial?.venueProfile,
      ticketing: initial?.ticketing,
      physicalStreet: physicalStreet || undefined,
      physicalCity: physicalCity || undefined,
      physicalState: physicalState || undefined,
      physicalPostalCode: physicalPostalCode || undefined,
      physicalCountry: physicalCountry || undefined,
      mailingStreet: mailingEnabled ? (mailingStreet || undefined) : undefined,
      mailingCity: mailingEnabled ? (mailingCity || undefined) : undefined,
      mailingState: mailingEnabled ? (mailingState || undefined) : undefined,
      mailingPostalCode: mailingEnabled ? (mailingPostalCode || undefined) : undefined,
      mailingCountry: mailingEnabled ? (mailingCountry || undefined) : undefined,
    });
  };

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted disabled:bg-elevated disabled:text-text-muted disabled:cursor-not-allowed disabled:opacity-70';
  const companyTypeOptions = toOptions(['Venue', 'TalentAgency', 'Ticketing', 'Labor', 'AdAgency', 'Sponsor']);
  const statusOptions = toOptions(['Active', 'Prospective', 'Inactive']);

  const toggleDma = (id: string, arr: string[], setArr: (v: string[]) => void) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  return (
    <div className="space-y-5">
      {errors.length > 0 && <div className="text-ems-coral text-sm bg-ems-coral-dim border border-ems-coral/20 rounded px-3 py-2">{errors.join(', ')}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Company Type" required>
          <Select2 options={companyTypeOptions} value={type} onChange={setType} />
        </FormField>
        <FormField label="Status" required>
          <Select2 options={statusOptions} value={status} onChange={setStatus} />
        </FormField>
      </div>

      <FormField label="Company Name" required>
        <div className="relative">
          <input
            className={inputCls}
            value={tradeName}
            onChange={e => setTradeName(e.target.value)}
            onFocus={companyPlace.onNameFocus}
            onBlur={companyPlace.onNameBlur}
            placeholder="Search venue or address…"
            autoComplete="off"
          />
          {companyPlace.menuOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-52 overflow-auto">
              {companyPlace.loading && companyPlace.suggestions.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
              )}
              {companyPlace.suggestions.map(s => (
                <button
                  key={s.placeId}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover"
                  onMouseDown={e => {
                    e.preventDefault();
                    companyPlace.selectPrediction(s);
                  }}
                >
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>
      </FormField>
      {!companyPlace.configured && (
        <p className="text-[11px] text-text-muted -mt-3">Add a Places API key to search by name.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Physical Address</h3>
          <FormField label="Street Address">
            <input
              className={inputCls}
              value={physicalStreet}
              onChange={e => setPhysicalStreet(e.target.value)}
              placeholder="Filled from company search, or edit"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="City">
              <input className={inputCls} value={physicalCity} onChange={e => setPhysicalCity(e.target.value)} disabled />
            </FormField>
            <FormField label="State">
              <input className={inputCls} value={physicalState} onChange={e => setPhysicalState(e.target.value)} disabled />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Postal Code">
              <input
                className={inputCls}
                value={physicalPostalCode}
                onChange={e => setPhysicalPostalCode(e.target.value)}
                onBlur={physicalAutofill.resolveByPostalCode}
                placeholder="Enter postal code"
              />
            </FormField>
            <FormField label="Country">
              <input className={inputCls} value={physicalCountry} onChange={e => setPhysicalCountry(e.target.value)} placeholder="USA" disabled />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text-primary">Mailing Address</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMailingEnabled(!mailingEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mailingEnabled ? 'bg-ems-accent' : 'bg-elevated border border-border'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${mailingEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-text-secondary">{mailingEnabled ? 'Edit' : 'Same as physical'}</span>
            </div>
          </div>
          {mailingEnabled ? (
            <>
              <FormField label="Street Address">
                <div className="relative">
                  <input
                    className={inputCls}
                    value={mailingStreet}
                    onChange={e => setMailingStreet(e.target.value)}
                    onFocus={mailingAutofill.onStreetFocus}
                    onBlur={mailingAutofill.onStreetBlur}
                    placeholder="Start typing street address..."
                  />
                  {mailingAutofill.showSuggestions && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-48 overflow-auto">
                      {mailingAutofill.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-hover"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            mailingAutofill.selectSuggestion(suggestion);
                          }}
                        >
                          {suggestion.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City"><input className={inputCls} value={mailingCity} onChange={e => setMailingCity(e.target.value)} disabled /></FormField>
                <FormField label="State"><input className={inputCls} value={mailingState} onChange={e => setMailingState(e.target.value)} disabled /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Postal Code">
                  <input
                    className={inputCls}
                    value={mailingPostalCode}
                    onChange={e => setMailingPostalCode(e.target.value)}
                    onBlur={mailingAutofill.resolveByPostalCode}
                    placeholder="Enter postal code"
                  />
                </FormField>
                <FormField label="Country"><input className={inputCls} value={mailingCountry} onChange={e => setMailingCountry(e.target.value)} placeholder="USA" disabled /></FormField>
              </div>
            </>
          ) : (
            <div className="min-h-[120px] bg-surface rounded-lg border border-dashed border-border p-3 flex items-center">
              <p className="text-xs text-text-secondary leading-relaxed break-words w-full">
                {lastGoogleFormattedMailing || '—'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">DMA(s)</label>
          {selectedDmas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedDmas
                .map(id => dmas.find(d => d.id === id))
                .filter(Boolean)
                .map(dma => (
                  <span
                    key={dma!.id}
                    className="px-2.5 py-1 text-xs rounded-md border bg-ems-accent-dim text-ems-accent border-ems-accent/30"
                  >
                    {dma!.name}
                  </span>
                ))}
            </div>
          ) : (
            <div className="text-xs bg-surface border border-dashed border-border rounded-md px-3 py-2">
              {postalDigits.length >= 3 && postalDmaLookup.dmaIds.length === 0 ? (
                <span className="text-ems-coral/90">No market matched for this postal code.</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">Service area</label>
          <div className="flex flex-wrap gap-1.5">
            {dmas.map(d => (
              <button key={d.id} type="button"
                onClick={() => toggleDma(d.id, selectedServiceDmas, setSelectedServiceDmas)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${selectedServiceDmas.includes(d.id) ? 'bg-ems-accent-dim text-ems-accent border-ems-accent/30' : 'bg-elevated text-text-secondary border-border hover:bg-hover'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm">Cancel</button>
        <button onClick={handleSave} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
