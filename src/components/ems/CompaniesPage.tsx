import React, { useState, useEffect } from 'react';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Drawer, Modal, FormField, ActionMenu } from './Primitives';
import { Select2, toOptions, toObjOptions } from './Select2';
import type { Company, Contact } from '@/data/constants';
import { getDmaFromPostalCode } from '@/data/constants';

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
        <Drawer onClose={() => setSelectedCompanyId(null)} width={1000}>
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
                  <div><span className="text-text-muted text-xs">Status</span><div className="text-text-primary">{selectedCompany.status}</div></div>
                  <div><span className="text-text-muted text-xs">DMA(s)</span><div className="text-text-primary">{selectedCompany.dmaIds.map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</div></div>
                  <div><span className="text-text-muted text-xs">Service Area DMA(s)</span><div className="text-text-primary">{(selectedCompany.serviceAreaDmaIds || selectedCompany.dmaIds).map(d => dmas.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</div></div>
                </div>
                {selectedCompany.physicalStreet && (
                  <div>
                    <span className="text-text-muted text-xs block mb-1">Physical Address</span>
                    <div className="text-text-primary text-sm">
                      {selectedCompany.physicalStreet}<br />
                      {selectedCompany.physicalCity}{selectedCompany.physicalCity && selectedCompany.physicalState ? ', ' : ''}{selectedCompany.physicalState} {selectedCompany.physicalPostalCode}<br />
                      {selectedCompany.physicalCountry}
                    </div>
                  </div>
                )}
                {selectedCompany.mailingStreet && (
                  <div>
                    <span className="text-text-muted text-xs block mb-1">Mailing Address</span>
                    <div className="text-text-primary text-sm">
                      {selectedCompany.mailingStreet}<br />
                      {selectedCompany.mailingCity}{selectedCompany.mailingCity && selectedCompany.mailingState ? ', ' : ''}{selectedCompany.mailingState} {selectedCompany.mailingPostalCode}<br />
                      {selectedCompany.mailingCountry}
                    </div>
                  </div>
                )}
              </div>
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

// ─── Contact Form ─────────────────────────────────────────────────────────────

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
      <div className="grid grid-cols-2 gap-4">
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

// ─── Company Form ─────────────────────────────────────────────────────────────

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

  const [physicalStreet, setPhysicalStreet] = useState(initial?.physicalStreet || '123 Main St');
  const [physicalCity, setPhysicalCity] = useState(initial?.physicalCity || '');
  const [physicalState, setPhysicalState] = useState(initial?.physicalState || '');
  const [physicalPostalCode, setPhysicalPostalCode] = useState(initial?.physicalPostalCode || '');
  const [physicalCountry, setPhysicalCountry] = useState(initial?.physicalCountry || 'USA');

  // Auto-fill DMA based on postal code
  useEffect(() => {
    if (physicalPostalCode && physicalPostalCode.length >= 5) {
      const autoDma = getDmaFromPostalCode(physicalPostalCode);
      if (autoDma && !selectedDmas.includes(autoDma)) {
        setSelectedDmas(prev => [...prev, autoDma]);
      }
    } else if (!physicalPostalCode || physicalPostalCode.length < 5) {
      // Clear all DMAs when postal code is empty or too short
      setSelectedDmas([]);
    }
  }, [physicalPostalCode]);

  const [mailingEnabled, setMailingEnabled] = useState(!!(initial?.mailingStreet || initial?.mailingCity));
  const [mailingStreet, setMailingStreet] = useState(initial?.mailingStreet || '');
  const [mailingCity, setMailingCity] = useState(initial?.mailingCity || '');
  const [mailingState, setMailingState] = useState(initial?.mailingState || '');
  const [mailingPostalCode, setMailingPostalCode] = useState(initial?.mailingPostalCode || '');
  const [mailingCountry, setMailingCountry] = useState(initial?.mailingCountry || 'USA');

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

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent placeholder:text-text-muted';
  const companyTypeOptions = toOptions(['Venue', 'TalentAgency', 'Ticketing', 'Labor', 'AdAgency', 'Sponsor']);
  const statusOptions = toOptions(['Active', 'Prospective', 'Inactive']);

  const toggleDma = (id: string, arr: string[], setArr: (v: string[]) => void) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  return (
    <div className="space-y-5">
      {errors.length > 0 && <div className="text-ems-coral text-sm bg-ems-coral-dim border border-ems-coral/20 rounded px-3 py-2">{errors.join(', ')}</div>}

      {/* Row 1: Company Type + Status */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Company Type" required>
          <Select2 options={companyTypeOptions} value={type} onChange={setType} />
        </FormField>
        <FormField label="Status" required>
          <Select2 options={statusOptions} value={status} onChange={setStatus} />
        </FormField>
      </div>

      {/* Row 2: Company Name (full width) */}
      <FormField label="Company Name" required>
        <input className={inputCls} value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="e.g. Madison Square Garden" />
      </FormField>

      {/* Row 3: Addresses side-by-side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Physical Address */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Physical Address</h3>
          <FormField label="Street Address">
            <input className={inputCls} value={physicalStreet} onChange={e => setPhysicalStreet(e.target.value)} placeholder="123 Main St" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="City">
              <input className={inputCls} value={physicalCity} onChange={e => setPhysicalCity(e.target.value)} />
            </FormField>
            <FormField label="State">
              <input className={inputCls} value={physicalState} onChange={e => setPhysicalState(e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Postal Code">
              <input className={inputCls} value={physicalPostalCode} onChange={e => setPhysicalPostalCode(e.target.value)} />
            </FormField>
            <FormField label="Country">
              <input className={inputCls} value={physicalCountry} onChange={e => setPhysicalCountry(e.target.value)} placeholder="USA" />
            </FormField>
          </div>
        </div>

        {/* Mailing Address */}
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
                <input className={inputCls} value={mailingStreet} onChange={e => setMailingStreet(e.target.value)} placeholder="P.O. Box or street" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City"><input className={inputCls} value={mailingCity} onChange={e => setMailingCity(e.target.value)} /></FormField>
                <FormField label="State"><input className={inputCls} value={mailingState} onChange={e => setMailingState(e.target.value)} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Postal Code"><input className={inputCls} value={mailingPostalCode} onChange={e => setMailingPostalCode(e.target.value)} /></FormField>
                <FormField label="Country"><input className={inputCls} value={mailingCountry} onChange={e => setMailingCountry(e.target.value)} placeholder="USA" /></FormField>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[152px] bg-surface rounded-lg border border-dashed border-border">
              <span className="text-xs text-text-muted">Mailing address same as physical</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: DMA selections side-by-side */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">DMA(s) <span className="text-text-muted font-normal">(Auto-filled from postal code)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {dmas.map(d => (
              <button key={d.id} type="button"
                onClick={() => toggleDma(d.id, selectedDmas, setSelectedDmas)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${selectedDmas.includes(d.id) ? 'bg-ems-accent-dim text-ems-accent border-ems-accent/30' : 'bg-elevated text-text-secondary border-border hover:bg-hover'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">Service Area DMA(s) <span className="text-text-muted font-normal">(Manual selection)</span></label>
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

      {/* Footer actions */}
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary px-5 py-1.5 hover:text-text-primary text-sm">Cancel</button>
        <button onClick={handleSave} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-5 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
