import React, { useState } from 'react';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Drawer, Modal, FormField, ActionMenu } from './Primitives';
import type { Company, Contact } from '@/data/constants';

interface Props {
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  companies: Company[];
  contacts: Contact[];
  dmas: { id: string; name: string; status: string }[];
  onUpdateCompanies: (companies: Company[]) => void;
  onUpdateContacts: (contacts: Contact[]) => void;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Companies</h1>
          <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary">{filtered.length}</span>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Add Company</button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search companies..." /></div>
        <FilterChips options={typeOptions} active={typeFilter} onChange={setTypeFilter} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Company Name</th>
              <th className="text-left py-2.5 px-3">Type(s)</th>
              <th className="text-left py-2.5 px-3">City, State</th>
              <th className="text-left py-2.5 px-3">DMA(s)</th>
              <th className="text-left py-2.5 px-3">Standing</th>
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
                <td className="py-2.5 px-3 text-xs text-text-secondary">{c.standing}</td>
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
        <Drawer onClose={() => setSelectedCompanyId(null)} width={600}>
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

          <TabBar tabs={['Overview', 'Contacts', 'Engagements', 'Documents']} active={drawerTab} onChange={setDrawerTab} />

          <div className="p-4">
            {drawerTab === 'Overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-text-muted text-xs">Legal Name</span><div className="text-text-primary">{selectedCompany.legalName}</div></div>
                  <div><span className="text-text-muted text-xs">Trade Name</span><div className="text-text-primary">{selectedCompany.tradeName}</div></div>
                  <div><span className="text-text-muted text-xs">City/State</span><div className="text-text-primary">{selectedCompany.city}, {selectedCompany.state}</div></div>
                  <div><span className="text-text-muted text-xs">Standing</span><div className="text-text-primary">{selectedCompany.standing}</div></div>
                  <div><span className="text-text-muted text-xs">DMA(s)</span><div className="text-text-primary">{selectedCompany.dmaIds.map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</div></div>
                </div>
              </div>
            )}

            {drawerTab === 'Contacts' && (
              <div className="space-y-3">
                <button onClick={() => setShowAddContact(!showAddContact)} className="text-ems-accent text-sm hover:underline">+ Add Contact</button>
                {showAddContact && <ContactForm onSave={(ct) => {
                  const newContact: Contact = { id: `ct-${Date.now()}`, companyId: selectedCompany.id, status: 'Active', firstName: ct.firstName || '', lastName: ct.lastName || '', title: ct.title || '', email: ct.email || '', phone: ct.phone || '', roles: ct.roles || [] };
                  onUpdateContacts([newContact, ...contacts]);
                  setShowAddContact(false);
                  addToast('Contact added', 'success');
                }} onCancel={() => setShowAddContact(false)} />}
                <table className="w-full text-sm">
                  <thead><tr className="text-text-muted text-xs border-b border-border"><th className="text-left py-2">Name</th><th className="text-left py-2">Title</th><th className="text-left py-2">Roles</th><th className="text-left py-2">Email</th><th className="text-left py-2">Phone</th><th /></tr></thead>
                  <tbody>
                    {companyContacts.map(ct => (
                      <tr key={ct.id} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">{ct.firstName} {ct.lastName}</td>
                        <td className="py-2 text-text-secondary">{ct.title}</td>
                        <td className="py-2">{ct.roles.map(r => <span key={r} className="text-xs bg-elevated px-1 py-0.5 rounded text-text-secondary mr-1">{r}</span>)}</td>
                        <td className="py-2 text-ems-blue text-xs">{ct.email}</td>
                        <td className="py-2 text-text-secondary text-xs">{ct.phone}</td>
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
          </div>
        </Drawer>
      )}

      {showAddModal && (
        <Modal title="Add Company" onClose={() => setShowAddModal(false)} width={800}>
          <CompanyForm dmas={dmas} onSave={(data) => { onUpdateCompanies([data, ...companies]); setShowAddModal(false); addToast('Company created successfully', 'success'); }} onCancel={() => setShowAddModal(false)} />
        </Modal>
      )}

      {editCompany && (
        <Modal title="Edit Company" onClose={() => setEditCompany(null)} width={800}>
          <CompanyForm dmas={dmas} initial={editCompany} onSave={(data) => { onUpdateCompanies(companies.map(c => c.id === editCompany.id ? data : c)); setEditCompany(null); addToast('Company updated', 'success'); }} onCancel={() => setEditCompany(null)} />
        </Modal>
      )}

      {editContact && (
        <Modal title="Edit Contact" onClose={() => setEditContact(null)} width={700}>
          <ContactForm initial={editContact} onSave={(ct) => { onUpdateContacts(contacts.map(c => c.id === editContact.id ? { ...c, ...ct } : c)); setEditContact(null); addToast('Contact updated', 'success'); }} onCancel={() => setEditContact(null)} />
        </Modal>
      )}
    </div>
  );
}

function ContactForm({ onSave, onCancel, initial }: { onSave: (ct: Partial<Contact>) => void; onCancel: () => void; initial?: Contact }) {
  const [firstName, setFirstName] = useState(initial?.firstName || '');
  const [lastName, setLastName] = useState(initial?.lastName || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');

  return (
    <div className="bg-elevated border border-border rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <FormField label="First Name" required><input className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary" value={firstName} onChange={e => setFirstName(e.target.value)} /></FormField>
        <FormField label="Last Name" required><input className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary" value={lastName} onChange={e => setLastName(e.target.value)} /></FormField>
        <FormField label="Title"><input className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary" value={title} onChange={e => setTitle(e.target.value)} /></FormField>
        <FormField label="Email"><input className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary" value={email} onChange={e => setEmail(e.target.value)} /></FormField>
        <FormField label="Phone"><input className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary" value={phone} onChange={e => setPhone(e.target.value)} /></FormField>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-text-secondary text-sm px-3 py-1 hover:text-text-primary">Cancel</button>
        <button onClick={() => onSave({ firstName, lastName, title, email, phone, roles: initial?.roles || [] })} className="bg-ems-accent text-background text-sm px-3 py-1 rounded">Save Contact</button>
      </div>
    </div>
  );
}

function CompanyForm({ onSave, onCancel, initial, dmas }: { onSave: (c: Company) => void; onCancel: () => void; initial?: Company; dmas: { id: string; name: string; status: string }[] }) {
  const [legalName, setLegalName] = useState(initial?.legalName || '');
  const [tradeName, setTradeName] = useState(initial?.tradeName || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state || '');
  const [type, setType] = useState(initial?.types[0] || 'Venue');
  const [standing, setStanding] = useState(initial?.standing || 'PreferredVendor');
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [selectedDmas, setSelectedDmas] = useState<string[]>(initial?.dmaIds || []);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = () => {
    if (!legalName.trim() || !tradeName.trim()) {
      setErrors(['Legal Name and Trade Name are required']);
      return;
    }
    onSave({
      id: initial?.id || `co-${Date.now()}`,
      legalName,
      tradeName,
      city,
      state,
      types: [type],
      dmaIds: selectedDmas,
      standing,
      status,
      venueProfile: initial?.venueProfile,
    });
  };

  return (
    <div className="space-y-4">
      {errors.length > 0 && <div className="text-ems-coral text-sm">{errors.join(', ')}</div>}
      <FormField label="Legal Name" required><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={legalName} onChange={e => setLegalName(e.target.value)} /></FormField>
      <FormField label="Trade Name" required><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={tradeName} onChange={e => setTradeName(e.target.value)} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City"><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={city} onChange={e => setCity(e.target.value)} /></FormField>
        <FormField label="State"><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={state} onChange={e => setState(e.target.value)} /></FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Type"><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={type} onChange={e => setType(e.target.value)}>{['Venue', 'TalentAgency', 'Ticketing', 'Labor', 'AdAgency', 'Sponsor'].map(t => <option key={t} value={t}>{t}</option>)}</select></FormField>
        <FormField label="Standing"><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={standing} onChange={e => setStanding(e.target.value)}>{['MasterAgreement', 'PreferredVendor', 'DealByDeal'].map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
        <FormField label="Status"><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={status} onChange={e => setStatus(e.target.value)}>{['Active', 'Prospective', 'Inactive'].map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">DMA(s)</label>
        <div className="flex flex-wrap gap-2">
          {dmas.map(d => (
            <button key={d.id} type="button" onClick={() => setSelectedDmas(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])} className={`px-2 py-1 text-xs rounded border ${selectedDmas.includes(d.id) ? 'bg-ems-accent-dim text-ems-accent border-ems-accent/30' : 'bg-elevated text-text-secondary border-border'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 hover:text-text-primary">Cancel</button>
        <button onClick={handleSave} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
