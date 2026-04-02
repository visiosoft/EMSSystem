import React, { useState } from 'react';
import { TOURS, ATTRACTIONS, COMPANIES, CONTACTS, DMAS, USERS, formatCurrency, formatDate, getStatusColor } from '@/data/constants';
import { StatusBadge, Avatar, SearchInput, FilterChips, TabBar, Modal, FormField, ActionMenu } from './Primitives';
import type { Project, Offer, Engagement } from '@/data/constants';

interface Props {
  projects: Project[];
  engagements: Engagement[];
  tours?: typeof TOURS;
  attractions?: typeof ATTRACTIONS;
  companies?: typeof COMPANIES;
  contacts?: typeof CONTACTS;
  dmas?: typeof DMAS;
  users?: typeof USERS;
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info', action?: { label: string; onClick: () => void }) => void;
  onCreateEngagement: (offer: Offer, project: Project) => string;
  onUpdateProjects: (projects: Project[]) => void;
  onDeleteProject?: (projectId: string) => void;
}

export function ProjectsPage({ projects, engagements, onNavigate, addToast, onCreateEngagement, onUpdateProjects, onDeleteProject }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
        <button onClick={() => setShowCreateWizard(true)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Create Project</button>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-64"><SearchInput value={search} onChange={setSearch} /></div>
        <FilterChips options={['All', 'Active', 'OffersSent', 'PartiallyBooked', 'FullyBooked', 'Dead']} active={statusFilter} onChange={setStatusFilter} />
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-text-muted text-xs border-b border-border bg-surface">
            <th className="text-left py-2.5 px-3">Project Name</th>
            <th className="text-left py-2.5 px-3">Attraction — Tour</th>
            <th className="text-left py-2.5 px-3">Booker</th>
            <th className="text-left py-2.5 px-3">DMA(s)</th>
            <th className="text-left py-2.5 px-3">Offers</th>
            <th className="text-left py-2.5 px-3">Target On-Sale</th>
            <th className="text-left py-2.5 px-3">Status</th>
            <th />
          </tr></thead>
          <tbody>
            {filtered.map(p => {
              const tour = TOURS.find(t => t.id === p.tourId);
              const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
              const booker = USERS.find(u => u.id === p.bookerId);
              const accepted = p.offers.filter(o => o.status === 'Accepted').length;
              const submitted = p.offers.filter(o => o.status === 'Submitted').length;
              return (
                <tr key={p.id} onClick={() => onNavigate('project-detail', { projectId: p.id })}
                  className="border-b border-border/50 hover:bg-hover cursor-pointer">
                  <td className="py-2.5 px-3 text-text-primary font-medium">{p.name}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{attr?.name} — {tour?.name}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{booker?.name}</td>
                  <td className="py-2.5 px-3 text-xs text-text-secondary">{p.dmaIds.map(d => DMAS.find(dm => dm.id === d)?.name).join(', ')}</td>
                  <td className="py-2.5 px-3 text-xs">{submitted > 0 && <span className="text-ems-blue">{submitted} Submitted</span>}{accepted > 0 && <span className="text-ems-green ml-1">{accepted} Accepted</span>}{p.offers.length === 0 && <span className="text-text-muted">—</span>}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{formatDate(p.targetOnSale)}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={p.status} /></td>
                  <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                    <ActionMenu items={[
                      { label: 'Edit', onClick: () => setEditProject(p) },
                      {
                        label: 'Delete',
                        onClick: () => {
                          if (onDeleteProject) onDeleteProject(p.id);
                          else onUpdateProjects(projects.filter(x => x.id !== p.id));
                          addToast('Project deleted', 'warning');
                        },
                        danger: true,
                      },
                    ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCreateWizard && (
        <CreateProjectWizard onClose={() => setShowCreateWizard(false)} onSave={(proj) => {
          onUpdateProjects([proj, ...projects]);
          setShowCreateWizard(false);
          addToast('Project created successfully', 'success');
          onNavigate('project-detail', { projectId: proj.id });
        }} />
      )}
      {editProject && (
        <Modal title="Edit Project" onClose={() => setEditProject(null)} width={600}>
          <EditProjectForm project={editProject} onSave={(next) => {
            onUpdateProjects(projects.map(p => p.id === next.id ? next : p));
            setEditProject(null);
            addToast('Project updated', 'success');
          }} onCancel={() => setEditProject(null)} />
        </Modal>
      )}
    </div>
  );
}

// Project Detail Page
export function ProjectDetailPage({ project, projects, engagements, onNavigate, addToast, onCreateEngagement, onUpdateProjects }: {
  project: Project;
  projects: Project[];
  engagements: Engagement[];
  tours?: typeof TOURS;
  attractions?: typeof ATTRACTIONS;
  companies?: typeof COMPANIES;
  contacts?: typeof CONTACTS;
  dmas?: typeof DMAS;
  users?: typeof USERS;
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info', action?: { label: string; onClick: () => void }) => void;
  onCreateEngagement: (offer: Offer, project: Project) => string;
  onUpdateProjects: (projects: Project[]) => void;
}) {
  const [showRecordResponse, setShowRecordResponse] = useState<string | null>(null);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [editOfferId, setEditOfferId] = useState<string | null>(null);

  const tour = TOURS.find(t => t.id === project.tourId);
  const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
  const booker = USERS.find(u => u.id === project.bookerId);
  const agent = CONTACTS.find(c => c.id === project.agentContactId);
  const agentCompany = agent ? COMPANIES.find(co => co.id === agent.companyId) : null;

  const handleRecordResponse = (offerId: string, response: string, notes: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id !== project.id) return p;
      return {
        ...p,
        offers: p.offers.map(o => {
          if (o.id !== offerId) return o;
          if (response === 'Accepted') {
            const engId = onCreateEngagement(o, project);
            return { ...o, status: 'Accepted', responseAt: new Date().toISOString().split('T')[0], responseNotes: notes, engagementId: engId };
          }
          return { ...o, status: response, responseAt: new Date().toISOString().split('T')[0], responseNotes: notes };
        }),
      };
    });
    onUpdateProjects(updatedProjects);
    setShowRecordResponse(null);

    if (response === 'Accepted') {
      addToast('Engagement created successfully', 'success', {
        label: 'View Engagement →',
        onClick: () => {
          const updated = updatedProjects.find(p => p.id === project.id);
          const offer = updated?.offers.find(o => o.id === offerId);
          if (offer?.engagementId) onNavigate('engagement-detail', { engagementId: offer.engagementId });
        },
      });
    } else {
      addToast(`Offer ${response.toLowerCase()}`, response === 'Declined' ? 'warning' : 'info');
    }
  };

  // Offer status summary for donut chart
  const statusCounts: Record<string, number> = {};
  project.offers.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  return (
    <div className="space-y-4">
      <button onClick={() => onNavigate('projects')} className="text-text-muted hover:text-text-primary text-sm">← Back to Projects</button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{project.name}</h1>
          <div className="text-sm text-text-secondary">{attr?.name} — {tour?.name} · {booker?.name} · DMAs: {project.dmaIds.map(d => DMAS.find(dm => dm.id === d)?.name).join(', ')}</div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid grid-cols-[60%_40%] gap-6">
        {/* Left — Venues & Offers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">Candidate Venues & Offers</h2>
            <button onClick={() => setShowAddVenue(true)} className="text-ems-accent text-sm hover:underline">+ Add Venue</button>
          </div>

          {project.offers.map(offer => {
            const venue = COMPANIES.find(c => c.id === offer.venueId);
            return (
              <div key={offer.id} className={`bg-card border border-border rounded-lg overflow-hidden ${offer.status === 'Declined' ? 'opacity-60' : ''}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-text-primary font-medium">{venue?.tradeName}</span>
                      <div className="text-xs text-text-secondary">{venue?.city}, {venue?.state} · {offer.configName} · Cap: {venue?.venueProfile?.configurations.find(c => c.name === offer.configName)?.totalCap?.toLocaleString()}</div>
                    </div>
                    <StatusBadge status={offer.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2 mt-2">
                    <div><span className="text-text-muted">Proposed Dates: </span><span className="text-text-primary">{offer.proposedDates.map(d => formatDate(d)).join(', ')} — {offer.showTime}</span></div>
                    <div><span className="text-text-muted">Deal: </span><span className="text-text-primary">{offer.dealType}</span></div>
                    <div><span className="text-text-muted">Guarantee: </span><span className="text-text-primary font-mono">{formatCurrency(offer.guarantee)}</span></div>
                    {offer.splitPct && <div><span className="text-text-muted">Split: </span><span className="text-text-primary">{offer.splitPct}% artist / {100 - offer.splitPct}% IAE after {formatCurrency(offer.breakeven)}</span></div>}
                    <div><span className="text-text-muted">Mktg Co-Op: </span><span className="text-text-primary font-mono">{formatCurrency(offer.marketingCoOp)}</span></div>
                  </div>
                  {offer.responseNotes && <div className="text-xs text-text-secondary mt-2 italic">"{offer.responseNotes}"</div>}
                  <div className="flex gap-2 mt-3 justify-end">
                    <button onClick={() => setEditOfferId(offer.id)} className="bg-elevated text-text-primary text-xs px-3 py-1 rounded border border-border hover:bg-hover">Edit</button>
                    <button onClick={() => {
                      const updatedProjects = projects.map(p => p.id === project.id ? { ...p, offers: p.offers.filter(o => o.id !== offer.id) } : p);
                      onUpdateProjects(updatedProjects);
                      addToast('Offer deleted', 'warning');
                    }} className="bg-elevated text-ems-coral text-xs px-3 py-1 rounded border border-border hover:bg-hover">Delete</button>
                    {offer.status === 'Submitted' && (
                      <button onClick={() => setShowRecordResponse(offer.id)} className="bg-elevated text-text-primary text-xs px-3 py-1 rounded border border-border hover:bg-hover">Record Response ▾</button>
                    )}
                    {offer.engagementId && (
                      <button onClick={() => onNavigate('engagement-detail', { engagementId: offer.engagementId })} className="text-ems-accent text-xs hover:underline">View Engagement {offer.engagementId} →</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {project.offers.length === 0 && <div className="text-text-muted text-sm bg-card border border-border rounded-lg p-4">No offers yet. Add a venue to get started.</div>}
        </div>

        {/* Right — Project Info */}
        <div className="space-y-4">
          {agent && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={`${agent.firstName} ${agent.lastName}`} />
                <div>
                  <div className="text-text-primary font-medium text-sm">{agent.firstName} {agent.lastName}</div>
                  <div className="text-xs text-text-secondary">{agent.title}</div>
                  <div className="text-xs text-text-secondary">{agentCompany?.tradeName}</div>
                </div>
              </div>
              <div className="text-xs space-y-1 mt-2">
                <div className="text-ems-blue">📧 {agent.email}</div>
                <div className="text-text-secondary">📞 {agent.phone}</div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div><span className="text-text-muted text-xs">Target On-Sale: </span><span className="text-text-primary text-sm font-mono">{formatDate(project.targetOnSale)}</span></div>
            <div><span className="text-text-muted text-xs">Notes</span><p className="text-text-secondary text-sm mt-1">{project.notes}</p></div>
          </div>

          {/* Offer Status Donut */}
          {project.offers.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-text-muted mb-2">Offer Status</h3>
              <div className="flex items-center gap-4">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  {(() => {
                    const total = project.offers.length;
                    const colors: Record<string, string> = { Draft: '#484F58', Submitted: '#388BFD', Accepted: '#3FB950', Declined: '#F85149', Countered: '#D29922' };
                    let offset = 0;
                    return Object.entries(statusCounts).map(([status, count]) => {
                      const pct = count / total;
                      const dash = pct * 283;
                      const el = <circle key={status} cx="60" cy="60" r="45" fill="none" stroke={colors[status] || '#484F58'} strokeWidth="12" strokeDasharray={`${dash} ${283 - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
                      offset += dash;
                      return el;
                    });
                  })()}
                  <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fill="#E6EDF3" fontSize="18" fontFamily="JetBrains Mono">{project.offers.length}</text>
                </svg>
                <div className="space-y-1">
                  {Object.entries(statusCounts).map(([s, c]) => (
                    <div key={s} className="flex items-center gap-1.5 text-xs">
                      <StatusBadge status={s} />
                      <span className="text-text-secondary font-mono">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Response Modal */}
      {showRecordResponse && (
        <RecordResponseModal
          offerId={showRecordResponse}
          offer={project.offers.find(o => o.id === showRecordResponse)!}
          onSave={handleRecordResponse}
          onClose={() => setShowRecordResponse(null)}
        />
      )}

      {/* Add Venue Modal */}
      {showAddVenue && (
        <Modal title="Add Venue to Project" onClose={() => setShowAddVenue(false)} width={500}>
          <AddVenueForm project={project} onSave={(offer) => {
            const updatedProjects = projects.map(p => p.id === project.id ? { ...p, offers: [offer, ...p.offers] } : p);
            onUpdateProjects(updatedProjects);
            setShowAddVenue(false);
            addToast('Venue added to project', 'success');
          }} onCancel={() => setShowAddVenue(false)} />
        </Modal>
      )}

      {editOfferId && (
        <Modal title="Edit Offer" onClose={() => setEditOfferId(null)} width={500}>
          <EditOfferForm
            offer={project.offers.find(o => o.id === editOfferId)!}
            onSave={(offer) => {
              const updatedProjects = projects.map(p => p.id === project.id ? { ...p, offers: p.offers.map(o => o.id === offer.id ? offer : o) } : p);
              onUpdateProjects(updatedProjects);
              setEditOfferId(null);
              addToast('Offer updated', 'success');
            }}
            onCancel={() => setEditOfferId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function EditProjectForm({ project, onSave, onCancel }: { project: Project; onSave: (p: Project) => void; onCancel: () => void }) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [targetOnSale, setTargetOnSale] = useState(project.targetOnSale || '');
  const [notes, setNotes] = useState(project.notes);
  return (
    <div className="space-y-3">
      <FormField label="Name"><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={name} onChange={e => setName(e.target.value)} /></FormField>
      <FormField label="Status"><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={status} onChange={e => setStatus(e.target.value)}>{['Active', 'OffersSent', 'PartiallyBooked', 'FullyBooked', 'Dead'].map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
      <FormField label="Target On-Sale"><input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={targetOnSale} onChange={e => setTargetOnSale(e.target.value)} /></FormField>
      <FormField label="Notes"><textarea className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} /></FormField>
      <div className="flex justify-end gap-2"><button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button><button onClick={() => onSave({ ...project, name, status, targetOnSale: targetOnSale || null, notes })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button></div>
    </div>
  );
}

function EditOfferForm({ offer, onSave, onCancel }: { offer: Offer; onSave: (o: Offer) => void; onCancel: () => void }) {
  const [status, setStatus] = useState(offer.status);
  const [date, setDate] = useState(offer.proposedDates[0] || '');
  const [time, setTime] = useState(offer.showTime);
  const [guarantee, setGuarantee] = useState(String(offer.guarantee));
  return (
    <div className="space-y-3">
      <FormField label="Status"><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={status} onChange={e => setStatus(e.target.value)}>{['Draft', 'Submitted', 'Accepted', 'Declined', 'Countered'].map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
      <FormField label="Date"><input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Show Time"><input type="time" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={time} onChange={e => setTime(e.target.value)} /></FormField>
      <FormField label="Guarantee"><input type="number" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={guarantee} onChange={e => setGuarantee(e.target.value)} /></FormField>
      <div className="flex justify-end gap-2"><button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button><button onClick={() => onSave({ ...offer, status, proposedDates: [date], showTime: time, guarantee: Number(guarantee) || 0 })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button></div>
    </div>
  );
}

function RecordResponseModal({ offerId, offer, onSave, onClose }: { offerId: string; offer: Offer; onSave: (id: string, response: string, notes: string) => void; onClose: () => void }) {
  const [response, setResponse] = useState('Accepted');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const venue = COMPANIES.find(c => c.id === offer.venueId);

  const handleSave = () => {
    if (response === 'Accepted' && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    onSave(offerId, response, notes);
  };

  return (
    <Modal title="Record Talent Agent Response" onClose={onClose} width={500}>
      <div className="space-y-3">
        <div className="text-sm text-text-secondary">Offer: {venue?.tradeName} · {formatDate(offer.proposedDates[0])}</div>
        <FormField label="Response">
          <div className="flex gap-4">{['Accepted', 'Declined', 'Countered'].map(r => (
            <label key={r} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
              <input type="radio" checked={response === r} onChange={() => { setResponse(r); setShowConfirm(false); }} className="accent-ems-accent" />{r}
            </label>
          ))}</div>
        </FormField>
        <FormField label="Notes">
          <textarea className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
        </FormField>
        {showConfirm && (
          <div className="bg-ems-accent-dim border border-ems-accent/30 rounded-lg p-3 text-sm text-ems-accent">
            Accepting this offer will automatically create a new Engagement. Proceed?
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-text-secondary px-4 py-1.5">Cancel</button>
          <button onClick={handleSave} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">
            {showConfirm ? 'Confirm & Create Engagement' : 'Save Response'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddVenueForm({ project, onSave, onCancel }: { project: Project; onSave: (o: Offer) => void; onCancel: () => void }) {
  const [venueId, setVenueId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const venues = COMPANIES.filter(c => c.types.includes('Venue'));
  const tour = TOURS.find(t => t.id === project.tourId);

  return (
    <div className="space-y-3">
      <FormField label="Venue" required>
        <select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={venueId} onChange={e => setVenueId(e.target.value)}>
          <option value="">Select...</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.tradeName}</option>)}
        </select>
      </FormField>
      <FormField label="Proposed Date" required>
        <input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={date} onChange={e => setDate(e.target.value)} />
      </FormField>
      <FormField label="Show Time" required>
        <input type="time" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={time} onChange={e => setTime(e.target.value)} />
      </FormField>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button>
        <button onClick={() => {
          if (!venueId || !date) return;
          const venue = venues.find(v => v.id === venueId);
          const config = venue?.venueProfile?.configurations.find(c => c.isDefault);
          onSave({
            id: `ofr-${Date.now()}`, venueId, configName: config?.name || 'Default', proposedDates: [date], showTime: time,
            dealType: tour?.dealType || 'Guarantee', guarantee: tour?.guarantee || 0, splitPct: tour?.splitPct || null, breakeven: tour?.breakeven || null,
            marketingCoOp: 0, status: 'Draft',
          });
        }} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Add to Project</button>
      </div>
    </div>
  );
}

function CreateProjectWizard({ onClose, onSave }: { onClose: () => void; onSave: (p: Project) => void }) {
  const [step, setStep] = useState(1);
  const [tourId, setTourId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [selectedDmas, setSelectedDmas] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [targetOnSale, setTargetOnSale] = useState('');
  const [notes, setNotes] = useState('');

  const activeTours = TOURS.filter(t => t.status === 'ActiveRouting');
  const selectedTour = TOURS.find(t => t.id === tourId);
  const selectedAttr = selectedTour ? ATTRACTIONS.find(a => a.id === selectedTour.attractionId) : null;
  const agencyContacts = selectedAttr ? CONTACTS.filter(c => c.companyId === selectedAttr.agencyId) : [];

  return (
    <Modal title="Create Project" onClose={onClose} width={700}>
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step === s ? 'bg-ems-accent text-background' : step > s ? 'bg-ems-green-dim text-ems-green' : 'bg-elevated text-text-muted'}`}>{s}</div>
              {s < 5 && <div className={`w-8 h-0.5 ${step > s ? 'bg-ems-green' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">Select Attraction-Tour</h3>
            {activeTours.map(t => {
              const attr = ATTRACTIONS.find(a => a.id === t.attractionId);
              return (
                <button key={t.id} onClick={() => { setTourId(t.id); if (attr) setName(`${attr.name} ${new Date().getFullYear()}`); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${tourId === t.id ? 'border-ems-accent bg-ems-accent-dim' : 'border-border bg-elevated hover:bg-hover'}`}>
                  <div className="text-text-primary font-medium">{attr?.name} — {t.name}</div>
                  <div className="text-xs text-text-secondary">{attr?.marketTier} · <StatusBadge status={t.status} /></div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">Select Talent Agent</h3>
            {agencyContacts.map(ct => (
              <button key={ct.id} onClick={() => setAgentId(ct.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${agentId === ct.id ? 'border-ems-accent bg-ems-accent-dim' : 'border-border bg-elevated hover:bg-hover'}`}>
                <div className="text-text-primary font-medium">{ct.firstName} {ct.lastName}</div>
                <div className="text-xs text-text-secondary">{ct.title} · {COMPANIES.find(c => c.id === ct.companyId)?.tradeName}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">Target DMAs</h3>
            <div className="flex flex-wrap gap-2">
              {DMAS.map(d => (
                <button key={d.id} onClick={() => setSelectedDmas(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${selectedDmas.includes(d.id) ? 'bg-ems-accent-dim text-ems-accent border border-ems-accent/30' : 'bg-elevated text-text-secondary border border-border hover:bg-hover'}`}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">Project Details</h3>
            <FormField label="Project Name" required>
              <input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={name} onChange={e => setName(e.target.value)} />
            </FormField>
            <FormField label="Target On-Sale Date">
              <input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary" value={targetOnSale} onChange={e => setTargetOnSale(e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <textarea className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
            </FormField>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">Review & Create</h3>
            <div className="bg-elevated rounded-lg p-4 space-y-2 text-sm">
              <div><span className="text-text-muted">Tour: </span><span className="text-text-primary">{selectedAttr?.name} — {selectedTour?.name}</span></div>
              <div><span className="text-text-muted">Agent: </span><span className="text-text-primary">{CONTACTS.find(c => c.id === agentId)?.firstName} {CONTACTS.find(c => c.id === agentId)?.lastName}</span></div>
              <div><span className="text-text-muted">DMAs: </span><span className="text-text-primary">{selectedDmas.map(d => DMAS.find(dm => dm.id === d)?.name).join(', ')}</span></div>
              <div><span className="text-text-muted">Project: </span><span className="text-text-primary">{name}</span></div>
              <div><span className="text-text-muted">On-Sale: </span><span className="text-text-primary">{formatDate(targetOnSale) || '—'}</span></div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="text-text-secondary px-4 py-1.5">{step > 1 ? '← Back' : 'Cancel'}</button>
          <button onClick={() => {
            if (step < 5) { setStep(step + 1); return; }
            onSave({
              id: `prj-${Date.now()}`, name, tourId, bookerId: 'usr-01', agentContactId: agentId,
              dmaIds: selectedDmas, status: 'Active', targetOnSale: targetOnSale || null, notes,
              createdAt: new Date().toISOString().split('T')[0], offers: [],
            });
          }} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">
            {step === 5 ? 'Create Project' : 'Next →'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
