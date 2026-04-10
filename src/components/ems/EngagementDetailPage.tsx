import React, { useState } from 'react';
import { formatCurrency } from '@/data/constants';
import { StatusBadge, Avatar, TabBar, Modal, ProgressBar, Drawer } from './Primitives';
import { Select2, toOptions } from './Select2';
import type { Engagement } from '@/data/constants';

// ─── Date Formatting ──────────────────────────────────────────────────────────

function formatFullDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShortDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeDisplay(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const disp = hr % 12 || 12;
  return `${disp}:${m} ${ampm}`;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: 'create' | 'update' | 'delete' | 'upload' | 'status' | 'workflow';
}

const INITIAL_AUDIT: AuditEntry[] = [
  { id: 'a1', timestamp: '2025-10-01T08:03:00', user: 'S. Kim', action: 'Status changed', details: 'Confirmed → On Sale', type: 'status' },
  { id: 'a2', timestamp: '2025-09-29T15:15:00', user: 'J. Okafor', action: 'Document uploaded', details: 'Contract - Draft v2.docx', type: 'upload' },
  { id: 'a3', timestamp: '2025-09-28T11:22:00', user: 'M. Thompson', action: 'Workflow updated', details: 'Production: Audio advance complete', type: 'workflow' },
  { id: 'a4', timestamp: '2025-09-25T09:44:00', user: 'A. Rivera', action: 'Creative asset approved', details: 'Event Poster - Final.tiff', type: 'upload' },
  { id: 'a5', timestamp: '2025-09-22T14:30:00', user: 'J. Okafor', action: 'Contract updated', details: 'Sent → Awaiting execution', type: 'update' },
  { id: 'a6', timestamp: '2025-09-18T10:15:00', user: 'S. Kim', action: 'Contact assigned', details: 'Jake Morrison (Tour Manager)', type: 'update' },
  { id: 'a7', timestamp: '2025-09-15T16:00:00', user: 'S. Kim', action: 'Status changed', details: 'Draft → Confirmed', type: 'status' },
  { id: 'a8', timestamp: '2025-09-15T15:58:00', user: 'System', action: 'Engagement created', details: 'Created from Offer OFR-001', type: 'create' },
];

function formatAuditTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const AUDIT_TYPE_COLORS: Record<string, string> = {
  create: 'bg-ems-green-dim text-ems-green',
  update: 'bg-ems-blue-dim text-ems-blue',
  delete: 'bg-ems-coral-dim text-ems-coral',
  upload: 'bg-ems-purple-dim text-ems-purple',
  status: 'bg-ems-amber-dim text-ems-amber',
  workflow: 'bg-elevated text-text-secondary',
};

// ─── Department Config ────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { key: 'marketing', label: 'Marketing', icon: '🎯', color: 'text-ems-blue' },
  { key: 'production', label: 'Production', icon: '🔧', color: 'text-ems-amber' },
  { key: 'business', label: 'Business', icon: '📋', color: 'text-ems-accent' },
  { key: 'creative', label: 'Creative', icon: '🎨', color: 'text-ems-purple' },
  { key: 'finance', label: 'Finance', icon: '💰', color: 'text-ems-green' },
] as const;

type DeptKey = 'marketing' | 'production' | 'business' | 'creative' | 'finance';

const DEPT_MILESTONES: Record<DeptKey, string[]> = {
  marketing: ['On-sale announcement drafted', 'Social media campaign launched', 'Media buy executed', 'Press release distributed', 'Final marketing recap'],
  production: ['Rider delivered to venue', 'Advance call completed', 'Stage plot approved', 'Audio advance complete', 'Lighting advance', 'Power advance'],
  business: ['Deal memo signed', 'Contract drafted', 'Contract sent', 'Contract executed', 'Ticketing manifest finalized', 'Insurance COIs received'],
  creative: ['Event poster received', 'IAE review complete', 'Artist approval received', 'Digital assets deployed', 'In-venue signage deployed'],
  finance: ['Budget approved', 'Venue deposit paid', 'Talent guarantee scheduled', 'Labor invoices processed', 'Post-show settlement'],
};

const DEPT_DOCS: Record<DeptKey, { name: string; type: string; by: string; date: string; size: string }[]> = {
  marketing: [
    { name: 'Media Buy Plan Q4.pdf', type: 'PDF', by: 'S. Kim', date: 'Oct 1', size: '312 KB' },
    { name: 'Social Assets Pack.zip', type: 'ZIP', by: 'A. Rivera', date: 'Oct 3', size: '45 MB' },
  ],
  production: [
    { name: 'Technical Rider - Afterglow.pdf', type: 'PDF', by: 'M. Thompson', date: 'Apr 16', size: '1.2 MB' },
    { name: 'Stage Plot.pdf', type: 'PDF', by: 'M. Thompson', date: 'Apr 16', size: '890 KB' },
  ],
  business: [
    { name: 'Deal Memo - Signed.pdf', type: 'PDF', by: 'J. Okafor', date: 'Apr 15', size: '248 KB' },
    { name: 'Contract - Draft v2.docx', type: 'DOCX', by: 'J. Okafor', date: 'Apr 18', size: '312 KB' },
    { name: 'Artist Insurance COI.pdf', type: 'PDF', by: 'J. Okafor', date: 'Apr 19', size: '198 KB' },
  ],
  creative: [
    { name: 'Event Poster - Final.tiff', type: 'TIFF', by: 'A. Rivera', date: 'Apr 20', size: '45 MB' },
  ],
  finance: [
    { name: 'Settlement Worksheet Draft.xlsx', type: 'XLSX', by: 'P. Sharma', date: 'Apr 22', size: '128 KB' },
  ],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  engagement: Engagement;
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateEngagement: (eng: Engagement) => void;
  onDeleteEngagement: (engagementId: string) => void;
  companies: { id: string; tradeName: string; city: string; state: string; venueProfile?: any }[];
  tours: { id: string; name: string; attractionId: string; contacts?: { contactId: string; role: string }[] }[];
  attractions: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  contacts: { id: string; firstName: string; lastName: string; title: string; email: string; phone: string; companyId: string }[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EngagementDetailPage({ engagement, engagements, onNavigate, addToast, onUpdateEngagement, onDeleteEngagement, companies, tours, attractions, users, contacts }: Props) {
  const [tab, setTab] = useState('Overview');
  const [activeDept, setActiveDept] = useState<DeptKey>('marketing');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showAddDate, setShowAddDate] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT);

  const venue = companies.find(c => c.id === engagement.venueId);
  const tour = tours.find(t => t.id === engagement.tourId);
  const attr = tour ? attractions.find(a => a.id === tour.attractionId) : null;
  const booker = users.find(u => u.id === engagement.bookerId);

  const addAuditEntry = (action: string, details: string, type: AuditEntry['type']) => {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'T. Wallace',
      action, details, type,
    };
    setAuditLog(prev => [entry, ...prev]);
  };

  const handleStatusChange = (newStatus: string) => {
    const old = engagement.status;
    onUpdateEngagement({ ...engagement, status: newStatus });
    addAuditEntry('Status changed', `${old} → ${newStatus}`, 'status');
    addToast(`Status changed to ${newStatus}`, 'success');
  };

  const handleAddDate = (date: string, doorTime: string, showTime: string) => {
    const newDates = [...engagement.showDates, { date, doorTime, showTime, runtime: 120 }];
    onUpdateEngagement({ ...engagement, showDates: newDates });
    addAuditEntry('Show date added', formatShortDate(date), 'update');
    addToast('Show date added', 'success');
    setShowAddDate(false);
  };

  const handleRemoveDate = (idx: number) => {
    if (engagement.showDates.length <= 1) { addToast('At least one show date is required', 'warning'); return; }
    const removed = engagement.showDates[idx];
    const newDates = engagement.showDates.filter((_, i) => i !== idx);
    onUpdateEngagement({ ...engagement, showDates: newDates });
    addAuditEntry('Show date removed', formatShortDate(removed.date), 'update');
    addToast('Show date removed', 'warning');
  };

  const toggleMilestone = (deptKey: DeptKey, idx: number) => {
    const wfKey = deptKey === 'business' ? 'eventBusiness' : deptKey;
    const wf = engagement.workflows[wfKey as keyof typeof engagement.workflows];
    const newComplete = idx < wf.milestonesComplete ? idx : idx + 1;
    const newStatus = newComplete >= wf.milestonesTotal ? 'Complete' : newComplete > 0 ? 'InProgress' : 'NotStarted';
    onUpdateEngagement({
      ...engagement,
      workflows: { ...engagement.workflows, [wfKey]: { ...wf, milestonesComplete: newComplete, status: newStatus } },
    });
    addAuditEntry('Workflow milestone updated', `${DEPARTMENTS.find(d => d.key === deptKey)?.label}: ${DEPT_MILESTONES[deptKey][idx]}`, 'workflow');
  };

  const getWfForDept = (deptKey: DeptKey) => {
    const wfKey = deptKey === 'business' ? 'eventBusiness' : deptKey;
    return engagement.workflows[wfKey as keyof typeof engagement.workflows];
  };

  const statusOptions = toOptions(['Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed']);

  return (
    <div className="space-y-4">
      <button onClick={() => onNavigate('engagements')} className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1">← Back to Engagements</button>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{engagement.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {engagement.showDates.map((sd, i) => (
                <span key={i} className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary font-mono">
                  {formatShortDate(sd.date)} · {formatTimeDisplay(sd.showTime)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-40">
              <Select2 options={statusOptions} value={engagement.status} onChange={handleStatusChange} placeholder="Status..." />
            </div>
            <button onClick={() => setShowCancelModal(true)} className="text-ems-coral text-xs hover:underline">Cancel</button>
            <button onClick={() => { onDeleteEngagement(engagement.id); addToast('Engagement deleted', 'warning'); onNavigate('engagements'); }} className="text-ems-coral text-xs hover:underline">Delete</button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mt-3 pt-3 border-t border-border text-xs">
          <div><span className="text-text-muted block mb-0.5">Attraction — Tour</span><span className="text-text-primary font-medium">{attr?.name}</span><br/><span className="text-text-secondary">{tour?.name}</span></div>
          <div><span className="text-text-muted block mb-0.5">Venue</span><span className="text-text-primary font-medium">{venue?.tradeName}</span><br/><span className="text-text-secondary">{venue?.city}, {venue?.state}</span></div>
          <div>
            <span className="text-text-muted block mb-0.5">Show Date(s)</span>
            {engagement.showDates.map((sd, i) => (
              <div key={i} className="text-text-primary">{formatShortDate(sd.date)}<span className="text-text-secondary"> · Show {formatTimeDisplay(sd.showTime)}</span></div>
            ))}
          </div>
          <div><span className="text-text-muted block mb-0.5">Capacity</span><span className="text-text-primary font-medium">{venue?.venueProfile?.configurations.find((c: any) => c.name === engagement.configName)?.totalCap?.toLocaleString()}</span><br/><span className="text-text-secondary">{engagement.configName}</span></div>
          <div><span className="text-text-muted block mb-0.5">Booker</span><span className="text-text-primary font-medium">{booker?.name}</span><br/><span className="text-text-secondary">{booker?.email}</span></div>
        </div>
      </div>

      <TabBar tabs={['Overview', 'Departments', 'Contacts', 'Dates', 'Audit Log']} active={tab} onChange={setTab} />

      {/* ── OVERVIEW ── */}
      {tab === 'Overview' && (
        <div className="space-y-4">
          {/* Department Overview Cards */}
          <div className="grid grid-cols-5 gap-3">
            {DEPARTMENTS.map(dept => {
              const wf = getWfForDept(dept.key);
              const pct = wf.milestonesTotal > 0 ? Math.round((wf.milestonesComplete / wf.milestonesTotal) * 100) : 0;
              const docs = DEPT_DOCS[dept.key] || [];
              return (
                <button
                  key={dept.key}
                  onClick={() => { setTab('Departments'); setActiveDept(dept.key); }}
                  className="bg-card border border-border rounded-lg p-3 text-left hover:border-ems-accent/40 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">{dept.icon}</span>
                    <StatusBadge status={wf.status} />
                  </div>
                  <div className="text-sm font-medium text-text-primary mb-1">{dept.label}</div>
                  <div className="mb-1.5"><ProgressBar value={wf.milestonesComplete} max={wf.milestonesTotal} /></div>
                  <div className="text-xs text-text-muted">{pct}% · {docs.length} doc{docs.length !== 1 ? 's' : ''}</div>
                </button>
              );
            })}
          </div>

          {/* Deal Structure + Venue Info */}
          <div className="grid grid-cols-[55%_45%] gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Deal Structure</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-muted text-xs block">Type</span><span className="text-text-primary">{engagement.dealType}</span></div>
                <div><span className="text-text-muted text-xs block">Guarantee</span><span className="text-text-primary font-mono">{formatCurrency(engagement.guarantee)}</span></div>
                {engagement.splitPct && <div><span className="text-text-muted text-xs block">Split</span><span className="text-text-primary">{engagement.splitPct}% artist / {100 - engagement.splitPct}% IAE</span></div>}
                {engagement.breakeven && <div><span className="text-text-muted text-xs block">Break-Even</span><span className="text-text-primary font-mono">{formatCurrency(engagement.breakeven)}</span></div>}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{venue?.tradeName}</h3>
              <div className="text-xs text-text-secondary space-y-1">
                <div>{venue?.city}, {venue?.state}</div>
                <div>Config: {engagement.configName} · {venue?.venueProfile?.configurations.find((c: any) => c.name === engagement.configName)?.totalCap?.toLocaleString()} cap</div>
                {venue?.venueProfile && <>
                  <div>Audio: {venue.venueProfile.inHouseAudio ? '✓ In-house' : '✗ Not available'} · Lighting: {venue.venueProfile.inHouseLighting ? '✓ In-house' : '✗ Not available'}</div>
                </>}
                <button onClick={() => onNavigate('project-detail', { projectId: engagement.projectId })} className="text-ems-accent hover:underline mt-1 block">↗ View Project {engagement.projectId}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPARTMENTS ── */}
      {tab === 'Departments' && (
        <div className="space-y-4">
          {/* Dept selector */}
          <div className="flex gap-2">
            {DEPARTMENTS.map(dept => {
              const wf = getWfForDept(dept.key);
              return (
                <button
                  key={dept.key}
                  onClick={() => setActiveDept(dept.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeDept === dept.key ? 'bg-ems-accent-dim text-ems-accent border-ems-accent/30' : 'bg-elevated text-text-secondary border-border hover:bg-hover'}`}
                >
                  <span>{dept.icon}</span>
                  <span>{dept.label}</span>
                  <StatusBadge status={wf.status} />
                </button>
              );
            })}
          </div>

          {/* Dept content */}
          {DEPARTMENTS.map(dept => {
            if (dept.key !== activeDept) return null;
            const wf = getWfForDept(dept.key);
            const milestones = DEPT_MILESTONES[dept.key];
            const docs = DEPT_DOCS[dept.key] || [];
            const pct = wf.milestonesTotal > 0 ? Math.round((wf.milestonesComplete / wf.milestonesTotal) * 100) : 0;
            const assignee = users.find(u => u.id === wf.assigneeId);

            // Finance tab — restricted
            if (dept.key === 'finance') {
              return (
                <div key={dept.key} className="grid grid-cols-[55%_45%] gap-4">
                  <div className="space-y-4">
                    {/* Milestones */}
                    <div className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text-primary">Finance Checklist</h3>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={wf.status} />
                          <span className="text-xs text-text-muted">{pct}% · {assignee?.name}</span>
                        </div>
                      </div>
                      <ProgressBar value={wf.milestonesComplete} max={wf.milestonesTotal} />
                      <div className="space-y-1 mt-3">
                        {milestones.map((m, i) => (
                          <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-hover rounded px-2 py-1.5">
                            <input type="checkbox" checked={i < wf.milestonesComplete} onChange={() => toggleMilestone(dept.key, i)} className="accent-ems-accent w-4 h-4 flex-shrink-0" />
                            <span className={i < wf.milestonesComplete ? 'text-text-muted line-through' : 'text-text-primary'}>{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Financial Summary — Finance only */}
                    <div className="bg-card border border-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-text-primary mb-3">Financial Summary</h3>
                      <table className="w-full text-xs">
                        <thead><tr className="text-text-muted border-b border-border">
                          <th className="text-left py-1.5">Category</th><th className="text-right py-1.5">Projected</th><th className="text-right py-1.5">Actual</th><th className="text-right py-1.5">Variance</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { cat: 'Gross Revenue', proj: 620000, act: 598500 },
                            { cat: 'Guarantee Paid', proj: 175000, act: 175000 },
                            { cat: 'Venue Rent', proj: 45000, act: 45000 },
                            { cat: 'Marketing Spend', proj: 38000, act: 41200 },
                            { cat: 'Labor (Production)', proj: 28000, act: 31400 },
                            { cat: 'Ticketing Fees', proj: 37200, act: 35910 },
                            { cat: 'IAE Net Margin', proj: engagement.projectedMargin, act: engagement.actualMargin },
                          ].map((r, i) => {
                            const variance = r.act != null ? r.act - r.proj : null;
                            const isCost = ['Venue Rent', 'Marketing Spend', 'Labor (Production)', 'Ticketing Fees', 'Guarantee Paid'].includes(r.cat);
                            const favorable = variance != null ? (isCost ? variance < 0 : variance > 0) : null;
                            return (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-1.5 text-text-primary">{r.cat}</td>
                                <td className="py-1.5 text-right font-mono">{formatCurrency(r.proj)}</td>
                                <td className="py-1.5 text-right font-mono">{r.act != null ? formatCurrency(r.act) : '—'}</td>
                                <td className={`py-1.5 text-right font-mono ${favorable === true ? 'text-ems-green' : favorable === false ? 'text-ems-coral' : 'text-text-muted'}`}>{variance != null ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <button onClick={() => setShowSettlement(true)} className="bg-ems-accent text-background text-xs px-3 py-1.5 rounded mt-3">Generate Settlement Worksheet</button>
                    </div>
                  </div>
                  {/* Documents */}
                  <DeptDocuments dept={dept.key} docs={docs} addToast={addToast} addAuditEntry={addAuditEntry} />
                </div>
              );
            }

            return (
              <div key={dept.key} className="grid grid-cols-[55%_45%] gap-4">
                {/* Milestones */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-primary">{dept.label} Checklist</h3>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={wf.status} />
                      <span className="text-xs text-text-muted">{pct}% · {assignee?.name}</span>
                    </div>
                  </div>
                  <ProgressBar value={wf.milestonesComplete} max={wf.milestonesTotal} />
                  <div className="space-y-1 mt-3">
                    {milestones.map((m, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-hover rounded px-2 py-1.5">
                        <input type="checkbox" checked={i < wf.milestonesComplete} onChange={() => toggleMilestone(dept.key, i)} className="accent-ems-accent w-4 h-4 flex-shrink-0" />
                        <span className={i < wf.milestonesComplete ? 'text-text-muted line-through' : 'text-text-primary'}>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Documents */}
                <DeptDocuments dept={dept.key} docs={docs} addToast={addToast} addAuditEntry={addAuditEntry} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONTACTS ── */}
      {tab === 'Contacts' && (
        <div className="space-y-4">
          {[
            { title: 'Attraction-Tour Contacts', contacts: (tour?.contacts || []).map(tc => contacts.find(c => c.id === tc.contactId)).filter(Boolean) },
            { title: 'Venue Contacts', contacts: contacts.filter(c => c.companyId === engagement.venueId) },
            { title: 'IAE Internal', contacts: ['marketing', 'production', 'eventBusiness', 'creative', 'sales', 'finance'].map(k => users.find(u => u.id === engagement.workflows[k as keyof typeof engagement.workflows].assigneeId)).filter(Boolean) },
          ].map((section, si) => (
            <div key={si}>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{section.title}</h3>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="text-text-muted text-xs border-b border-border bg-surface"><th className="text-left py-2 px-3">Name</th><th className="text-left py-2 px-3">Title/Role</th><th className="text-left py-2 px-3">Email</th><th className="text-left py-2 px-3">Phone</th></tr></thead>
                  <tbody>
                    {section.contacts.map((ct: any, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 text-text-primary">{ct.firstName || ct.name} {ct.lastName || ''}</td>
                        <td className="py-2 px-3 text-text-secondary text-xs">{ct.title || ct.role}</td>
                        <td className="py-2 px-3 text-ems-blue text-xs">{ct.email}</td>
                        <td className="py-2 px-3 text-text-secondary text-xs">{ct.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DATES ── */}
      {tab === 'Dates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Show Dates & Performances</h3>
            <button onClick={() => setShowAddDate(true)} className="text-ems-accent text-sm hover:underline">+ Add Date</button>
          </div>
          <div className="space-y-2">
            {engagement.showDates.map((sd, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">{formatFullDate(sd.date)}</div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Doors {formatTimeDisplay(sd.doorTime)} · Show {formatTimeDisplay(sd.showTime)} · {sd.runtime} min runtime
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {i === 0 && <span className="text-xs bg-ems-accent-dim text-ems-accent px-2 py-0.5 rounded">Primary</span>}
                  {engagement.showDates.length > 1 && (
                    <button onClick={() => handleRemoveDate(i)} className="text-ems-coral text-xs hover:underline">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {engagement.showDates.length === 0 && <div className="text-text-muted text-sm">No show dates added.</div>}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'Audit Log' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Activity & Audit Log</h3>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Timestamp</th>
                  <th className="text-left py-2.5 px-3">User</th>
                  <th className="text-left py-2.5 px-3">Action</th>
                  <th className="text-left py-2.5 px-3">Details</th>
                  <th className="text-left py-2.5 px-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50">
                    <td className="py-2 px-3 font-mono text-xs text-text-muted whitespace-nowrap">{formatAuditTimestamp(entry.timestamp)}</td>
                    <td className="py-2 px-3 text-text-primary text-xs font-medium">{entry.user}</td>
                    <td className="py-2 px-3 text-text-secondary text-xs">{entry.action}</td>
                    <td className="py-2 px-3 text-text-secondary text-xs">{entry.details}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${AUDIT_TYPE_COLORS[entry.type]}`}>{entry.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddDate && (
        <Modal title="Add Show Date" onClose={() => setShowAddDate(false)} width={480}>
          <AddDateForm onSave={handleAddDate} onCancel={() => setShowAddDate(false)} />
        </Modal>
      )}

      {showCancelModal && (
        <CancelEngagementModal engagement={engagement} onConfirm={(reason, party, date) => {
          onUpdateEngagement({ ...engagement, status: 'Cancelled', cancellationReason: reason, cancellingParty: party, cancellationDate: date });
          addAuditEntry('Engagement cancelled', `Party: ${party}. ${reason}`, 'update');
          setShowCancelModal(false);
          addToast('Engagement cancelled', 'warning');
        }} onClose={() => setShowCancelModal(false)} />
      )}

      {showSettlement && (
        <SettlementModal engagement={engagement} onClose={() => setShowSettlement(false)} addToast={addToast} companies={companies} />
      )}
    </div>
  );
}

// ─── Department Documents Panel ───────────────────────────────────────────────

function DeptDocuments({ dept, docs, addToast, addAuditEntry }: {
  dept: DeptKey;
  docs: { name: string; type: string; by: string; date: string; size: string }[];
  addToast: (msg: string, type: any) => void;
  addAuditEntry: (action: string, details: string, type: any) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Documents</h3>
        <button
          onClick={() => { addToast('Upload simulated', 'success'); addAuditEntry('Document uploaded', 'New document', 'upload'); }}
          className="text-ems-accent text-xs hover:underline"
        >+ Upload</button>
      </div>
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg">
          <span className="text-text-muted text-sm">No documents yet</span>
          <button onClick={() => addToast('Upload simulated', 'success')} className="text-ems-accent text-xs mt-1 hover:underline">Upload a file</button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-xs font-medium truncate">{f.name}</div>
                <div className="text-text-muted text-[10px] mt-0.5">{f.type} · {f.by} · {f.date} · {f.size}</div>
              </div>
              <div className="flex gap-2 ml-2 flex-shrink-0">
                <button onClick={() => addToast('Download started', 'info')} className="text-ems-blue text-xs hover:underline">⬇</button>
                <button onClick={() => addToast('File deleted', 'warning')} className="text-ems-coral text-xs hover:underline">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Date Form ────────────────────────────────────────────────────────────

function AddDateForm({ onSave, onCancel }: { onSave: (date: string, doorTime: string, showTime: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState('');
  const [doorTime, setDoorTime] = useState('19:00');
  const [showTime, setShowTime] = useState('20:00');
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Show Date <span className="text-ems-coral">*</span></label>
        <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        {date && <div className="text-xs text-text-muted mt-1">{formatFullDate(date)}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">Door Time</label>
          <input type="time" className={inputCls} value={doorTime} onChange={e => setDoorTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">Show Time</label>
          <input type="time" className={inputCls} value={showTime} onChange={e => setShowTime(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm hover:text-text-primary">Cancel</button>
        <button onClick={() => { if (date) onSave(date, doorTime, showTime); }} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Add Date</button>
      </div>
    </div>
  );
}

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

function CancelEngagementModal({ engagement, onConfirm, onClose }: { engagement: Engagement; onConfirm: (reason: string, party: string, date: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [party, setParty] = useState('IAE');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <Modal title="Cancel Engagement" onClose={onClose} width={500}>
      <div className="space-y-3">
        <div className="text-sm text-ems-coral bg-ems-coral-dim border border-ems-coral/20 rounded px-3 py-2">⚠️ This action cannot be undone.</div>
        <div><label className="text-xs font-medium text-text-secondary block mb-1">Reason *</label><textarea className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none focus:outline-none focus:border-ems-accent" value={reason} onChange={e => setReason(e.target.value)} /></div>
        <div><label className="text-xs font-medium text-text-secondary block mb-1">Cancelling Party *</label>
          <div className="flex gap-4 mt-1">{['IAE', 'Attraction', 'Venue', 'Force Majeure'].map(p => (
            <label key={p} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"><input type="radio" checked={party === p} onChange={() => setParty(p)} className="accent-ems-accent" />{p}</label>
          ))}</div>
        </div>
        <div><label className="text-xs font-medium text-text-secondary block mb-1">Date *</label><input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="text-text-secondary px-4 py-1.5 text-sm">Cancel</button>
          <button onClick={() => { if (reason) onConfirm(reason, party, date); }} className="bg-ems-coral text-background px-4 py-1.5 rounded-md text-sm font-medium">Confirm Cancellation</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Settlement Modal ─────────────────────────────────────────────────────────

function SettlementModal({ engagement, onClose, addToast, companies }: { engagement: Engagement; onClose: () => void; addToast: (msg: string, type: any) => void; companies: { id: string; tradeName: string }[] }) {
  const venue = companies.find(c => c.id === engagement.venueId);
  const primaryDate = engagement.showDates[0];
  return (
    <Modal title={`Settlement Worksheet — ${engagement.id.toUpperCase()}`} onClose={onClose} width={600}>
      <div className="space-y-3 text-sm">
        <div className="text-text-secondary">{engagement.name} · {formatShortDate(primaryDate?.date)}</div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-border"><td colSpan={2} className="py-1.5 font-semibold text-text-primary">GROSS RECEIPTS</td></tr>
            <tr><td className="py-1 text-text-secondary">Ticket Sales (12,843 × avg $46.54)</td><td className="py-1 text-right font-mono text-text-primary">$598,500</td></tr>
            <tr><td className="py-1 text-text-secondary">VIP Revenue</td><td className="py-1 text-right font-mono text-text-primary">$62,300</td></tr>
            <tr className="border-t border-border font-semibold"><td className="py-1.5 text-text-primary">TOTAL GROSS</td><td className="py-1.5 text-right font-mono text-ems-accent">$711,800</td></tr>
            <tr className="border-t border-border"><td colSpan={2} className="py-1.5 font-semibold text-text-primary">DEDUCTIONS</td></tr>
            <tr><td className="py-1 text-text-secondary">Ticketing Fees (6%)</td><td className="py-1 text-right font-mono text-ems-coral">-$35,910</td></tr>
            <tr><td className="py-1 text-text-secondary">Venue Rent</td><td className="py-1 text-right font-mono text-ems-coral">-$45,000</td></tr>
            <tr className="border-t-2 border-ems-accent bg-ems-accent-dim"><td className="py-2 text-ems-accent font-semibold">IAE NET</td><td className="py-2 text-right font-mono text-ems-accent font-semibold">$178,898</td></tr>
          </tbody>
        </table>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-text-secondary px-4 py-1.5 text-sm">Close</button>
          <button onClick={() => addToast('PDF export simulated', 'info')} className="bg-elevated text-text-primary px-4 py-1.5 rounded border border-border text-sm">Export PDF</button>
          <button onClick={() => addToast('Settlement finalized', 'success')} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Finalize</button>
        </div>
      </div>
    </Modal>
  );
}
