import React, { useState } from 'react';
import { COMPANIES, CONTACTS, DMAS, USERS, formatDate } from '@/data/constants';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Drawer, Modal, FormField, ActionMenu } from './Primitives';
import type { Company, Contact } from '@/data/constants';

interface Props {
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function CompaniesPage({ onNavigate, addToast }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [drawerTab, setDrawerTab] = useState('Overview');
  const [showAddContact, setShowAddContact] = useState(false);
  const [contacts, setContacts] = useState(CONTACTS);

  const typeOptions = ['All', 'Venue', 'TalentAgency', 'Ticketing', 'Labor', 'AdAgency', 'Sponsor'];

  const filtered = COMPANIES.filter(c => {
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
              <tr key={c.id} onClick={() => { setSelectedCompany(c); setDrawerTab('Overview'); }}
                className="border-b border-border/50 hover:bg-hover cursor-pointer">
                <td className="py-2.5 px-3 text-text-primary font-medium">{c.tradeName}</td>
                <td className="py-2.5 px-3">
                  <div className="flex gap-1">{c.types.map(t => <span key={t} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{t}</span>)}</div>
                </td>
                <td className="py-2.5 px-3 text-text-secondary">{c.city}, {c.state}</td>
                <td className="py-2.5 px-3 text-text-secondary text-xs">{c.dmaIds.map(d => DMAS.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</td>
                <td className="py-2.5 px-3 text-xs text-text-secondary">{c.standing}</td>
                <td className="py-2.5 px-3"><StatusBadge status={c.status} /></td>
                <td className="py-2.5 px-3">
                  <ActionMenu items={[
                    { label: 'View Details', onClick: () => { setSelectedCompany(c); setDrawerTab('Overview'); } },
                    { label: 'Edit', onClick: () => addToast('Edit mode not available in prototype', 'info') },
                    { label: 'Deactivate', onClick: () => addToast('Company deactivated', 'warning'), danger: true },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Company Drawer */}
      {selectedCompany && (
        <Drawer onClose={() => setSelectedCompany(null)} width={600}>
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Avatar name={selectedCompany.tradeName} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary">{selectedCompany.tradeName}</h2>
              <div className="flex gap-1.5 mt-1">
                {selectedCompany.types.map(t => <span key={t} className="text-xs bg-elevated px-1.5 py-0.5 rounded text-text-secondary">{t}</span>)}
                <StatusBadge status={selectedCompany.status} />
              </div>
            </div>
            <button onClick={() => setSelectedCompany(null)} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
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
                  <div><span className="text-text-muted text-xs">DMA(s)</span><div className="text-text-primary">{selectedCompany.dmaIds.map(d => DMAS.find(dm => dm.id === d)?.name).filter(Boolean).join(', ') || '—'}</div></div>
                </div>
                {selectedCompany.venueProfile && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-text-primary mb-2">Venue Profile</h3>
                    <table className="w-full text-xs">
                      <thead><tr className="text-text-muted border-b border-border">
                        <th className="text-left py-1.5">Config</th><th className="text-right py-1.5">Total</th><th className="text-right py-1.5">Seated</th><th className="text-right py-1.5">GA</th><th className="text-left py-1.5">Stage</th>
                      </tr></thead>
                      <tbody>
                        {selectedCompany.venueProfile.configurations.map((cfg, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5 text-text-primary">{cfg.name} {cfg.isDefault && '★'}</td>
                            <td className="py-1.5 text-right font-mono">{cfg.totalCap.toLocaleString()}</td>
                            <td className="py-1.5 text-right font-mono">{cfg.seatedCap.toLocaleString()}</td>
                            <td className="py-1.5 text-right font-mono">{cfg.gaCap.toLocaleString()}</td>
                            <td className="py-1.5 text-text-secondary">{cfg.stageType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div><span className="text-text-muted">Age: </span><span className="text-text-primary">{selectedCompany.venueProfile.ageRestriction}</span></div>
                      <div><span className="text-text-muted">Curfew: </span><span className="text-text-primary">{selectedCompany.venueProfile.curfew}</span></div>
                      <div><span className="text-text-muted">Audio: </span><span className="text-text-primary">{selectedCompany.venueProfile.inHouseAudio ? '✓' : '✗'}</span></div>
                      <div><span className="text-text-muted">Lighting: </span><span className="text-text-primary">{selectedCompany.venueProfile.inHouseLighting ? '✓' : '✗'}</span></div>
                      <div><span className="text-text-muted">Load-In Docks: </span><span className="text-text-primary">{selectedCompany.venueProfile.loadInDocks}</span></div>
                      <div><span className="text-text-muted">Parking: </span><span className="text-text-primary">{selectedCompany.venueProfile.parking.toLocaleString()}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {drawerTab === 'Contacts' && (
              <div className="space-y-3">
                <button onClick={() => setShowAddContact(!showAddContact)} className="text-ems-accent text-sm hover:underline">+ Add Contact</button>
                {showAddContact && <AddContactForm onSave={(ct) => {
                  const newContact: Contact = { id: `ct-${Date.now()}`, companyId: selectedCompany.id, status: 'Active', firstName: ct.firstName || '', lastName: ct.lastName || '', title: ct.title || '', email: ct.email || '', phone: ct.phone || '', roles: ct.roles || [] };
                  setContacts([...contacts, newContact]);
                  setShowAddContact(false);
                  addToast('Contact added', 'success');
                }} onCancel={() => setShowAddContact(false)} />}
                <table className="w-full text-sm">
                  <thead><tr className="text-text-muted text-xs border-b border-border">
                    <th className="text-left py-2">Name</th><th className="text-left py-2">Title</th><th className="text-left py-2">Roles</th><th className="text-left py-2">Email</th><th className="text-left py-2">Phone</th>
                  </tr></thead>
                  <tbody>
                    {companyContacts.map(ct => (
                      <tr key={ct.id} className="border-b border-border/50">
                        <td className="py-2 text-text-primary">{ct.firstName} {ct.lastName}</td>
                        <td className="py-2 text-text-secondary">{ct.title}</td>
                        <td className="py-2">{ct.roles.map(r => <span key={r} className="text-xs bg-elevated px-1 py-0.5 rounded text-text-secondary mr-1">{r}</span>)}</td>
                        <td className="py-2 text-ems-blue text-xs">{ct.email}</td>
                        <td className="py-2 text-text-secondary text-xs">{ct.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {drawerTab === 'Engagements' && (
              <div className="text-sm text-text-secondary">
                <p>Engagements involving {selectedCompany.tradeName} will appear here.</p>
              </div>
            )}

            {drawerTab === 'Documents' && (
              <div className="space-y-3">
                <button onClick={() => addToast('Upload simulated', 'success')} className="text-ems-accent text-sm hover:underline">+ Upload Document</button>
                <div className="text-sm text-text-muted">No documents uploaded yet.</div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <Modal title="Add Company" onClose={() => setShowAddModal(false)} width={800}>
          <AddCompanyForm onSave={() => { setShowAddModal(false); addToast('Company created successfully', 'success'); }} onCancel={() => setShowAddModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function AddContactForm({ onSave, onCancel }: { onSave: (ct: Partial<Contact>) => void; onCancel: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

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
        <button onClick={() => onSave({ firstName, lastName, title, email, phone, roles: [] })} className="bg-ems-accent text-background text-sm px-3 py-1 rounded">Save Contact</button>
      </div>
    </div>
  );
}

function AddCompanyForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = () => {
    if (!name.trim()) {
      setErrors(['Legal Name is required']);
      return;
    }
    onSave();
  };

  return (
    <div className="space-y-4">
      {errors.length > 0 && <div className="text-ems-coral text-sm">{errors.join(', ')}</div>}
      <FormField label="Legal Name" required>
        <input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={name} onChange={e => setName(e.target.value)} />
      </FormField>
      <FormField label="Trade Name">
        <input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" required><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" /></FormField>
        <FormField label="State" required><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" /></FormField>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 hover:text-text-primary">Cancel</button>
        <button onClick={handleSave} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
