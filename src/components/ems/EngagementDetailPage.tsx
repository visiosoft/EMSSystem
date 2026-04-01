import React, { useState } from 'react';
import { COMPANIES, TOURS, ATTRACTIONS, USERS, CONTACTS, formatCurrency, formatDate, getWorkflowDotColor } from '@/data/constants';
import { StatusBadge, Avatar, TabBar, Modal, ProgressBar, Drawer } from './Primitives';
import type { Engagement } from '@/data/constants';

interface Props {
  engagement: Engagement;
  engagements: Engagement[];
  onNavigate: (view: string, data?: any) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateEngagement: (eng: Engagement) => void;
}

export function EngagementDetailPage({ engagement, engagements, onNavigate, addToast, onUpdateEngagement }: Props) {
  const [tab, setTab] = useState('Overview');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [openWorkflow, setOpenWorkflow] = useState<string | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);

  const venue = COMPANIES.find(c => c.id === engagement.venueId);
  const tour = TOURS.find(t => t.id === engagement.tourId);
  const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
  const booker = USERS.find(u => u.id === engagement.bookerId);

  const workflowKeys = ['marketing', 'production', 'eventBusiness', 'creative', 'sales', 'finance'] as const;
  const workflowLabels: Record<string, string> = { marketing: '🎯 Marketing', production: '🔧 Production', eventBusiness: '📋 Event Business', creative: '🎨 Creative', sales: '📊 Sales', finance: '💰 Finance' };
  const workflowMilestones: Record<string, string[]> = {
    marketing: ['On-sale announcement drafted', 'Social media campaign launched', 'Media buy executed', 'Press release distributed', 'Final marketing recap'],
    production: ['Rider delivered to venue', 'Advance call completed', 'Stage plot approved', 'Audio advance complete', 'Lighting advance', 'Power advance'],
    eventBusiness: ['Deal memo signed', 'Contract drafted', 'Contract sent', 'Contract executed', 'Ticketing manifest finalized', 'Insurance COIs received'],
    creative: ['Event poster received', 'IAE review complete', 'Artist approval received', 'Digital assets deployed', 'In-venue signage deployed'],
    sales: ['Sales targets set', 'Group sales outreach', 'VIP packages configured', 'Sponsorship confirmed'],
    finance: ['Budget approved', 'Venue deposit paid', 'Talent guarantee scheduled', 'Labor invoices processed', 'Post-show settlement'],
  };

  const handleStatusChange = (newStatus: string) => {
    onUpdateEngagement({ ...engagement, status: newStatus });
    addToast(`Status changed to ${newStatus}`, 'success');
    setShowStatusMenu(false);
  };

  const toggleMilestone = (wfKey: string, idx: number) => {
    const wf = engagement.workflows[wfKey as keyof typeof engagement.workflows];
    const newComplete = idx < wf.milestonesComplete ? idx : idx + 1;
    const newStatus = newComplete >= wf.milestonesTotal ? 'Complete' : newComplete > 0 ? 'InProgress' : 'NotStarted';
    onUpdateEngagement({
      ...engagement,
      workflows: { ...engagement.workflows, [wfKey]: { ...wf, milestonesComplete: newComplete, status: newStatus } },
    });
  };

  return (
    <div className="space-y-4">
      <button onClick={() => onNavigate('engagements')} className="text-text-muted hover:text-text-primary text-sm">← Back to Engagements</button>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{engagement.name}</h1>
            <div className="text-sm text-text-secondary">{formatDate(engagement.showDates[0]?.date)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="flex items-center gap-1"><StatusBadge status={engagement.status} /><span className="text-text-muted text-xs">▾</span></button>
              {showStatusMenu && (
                <div className="absolute right-0 top-full mt-1 bg-elevated border border-border rounded-md shadow-lg z-30 min-w-[140px] py-1">
                  {['Draft', 'Confirmed', 'OnSale', 'Settled', 'Closed'].map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)} className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-hover">{s}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowCancelModal(true)} className="text-ems-coral text-xs hover:underline">Cancel Engagement</button>
          </div>
        </div>

        {/* Info strip */}
        <div className="grid grid-cols-5 gap-4 mt-3 pt-3 border-t border-border text-xs">
          <div><span className="text-text-muted block">Attraction-Tour</span><span className="text-text-primary">{attr?.name}<br/>{tour?.name}</span></div>
          <div><span className="text-text-muted block">Venue</span><span className="text-text-primary">{venue?.tradeName}<br/>{venue?.city}, {venue?.state}</span></div>
          <div><span className="text-text-muted block">Show Date & Time</span><span className="text-text-primary">{formatDate(engagement.showDates[0]?.date)}<br/>Doors {engagement.showDates[0]?.doorTime} · Show {engagement.showDates[0]?.showTime}</span></div>
          <div><span className="text-text-muted block">Capacity</span><span className="text-text-primary">{venue?.venueProfile?.configurations.find(c => c.name === engagement.configName)?.totalCap?.toLocaleString()}<br/>{engagement.configName}</span></div>
          <div><span className="text-text-muted block">Booker</span><span className="text-text-primary">{booker?.name}<br/>{booker?.email}</span></div>
        </div>
      </div>

      <TabBar tabs={['Overview', 'Workflows', 'Contacts', 'Documents', 'Audit Log']} active={tab} onChange={setTab} />

      {/* Overview Tab */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-[55%_45%] gap-6">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">Deal Structure</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-text-muted text-xs">Type: </span><span className="text-text-primary">{engagement.dealType}</span></div>
                <div><span className="text-text-muted text-xs">Guarantee: </span><span className="text-text-primary font-mono">{formatCurrency(engagement.guarantee)}</span></div>
                {engagement.splitPct && <div><span className="text-text-muted text-xs">Split: </span><span className="text-text-primary">{engagement.splitPct}% artist / {100 - engagement.splitPct}% IAE</span></div>}
                {engagement.breakeven && <div><span className="text-text-muted text-xs">Break-Even: </span><span className="text-text-primary font-mono">{formatCurrency(engagement.breakeven)}</span></div>}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">Financial Summary</h3>
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
                        <td className={`py-1.5 text-right font-mono ${engagement.status === 'Settled' || engagement.actualGross ? '' : 'text-text-muted'}`}>{r.act != null ? formatCurrency(r.act) : '—'}</td>
                        <td className={`py-1.5 text-right font-mono ${favorable === true ? 'text-ems-green' : favorable === false ? 'text-ems-coral' : 'text-text-muted'}`}>{variance != null ? `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">{venue?.tradeName}</h3>
              <div className="text-xs text-text-secondary space-y-1">
                <div>{venue?.city}, {venue?.state}</div>
                <div>Config: {engagement.configName} · {venue?.venueProfile?.configurations.find(c => c.name === engagement.configName)?.totalCap?.toLocaleString()} cap</div>
                {venue?.venueProfile && <>
                  <div>Audio: {venue.venueProfile.inHouseAudio ? '✓' : '✗'} · Lighting: {venue.venueProfile.inHouseLighting ? '✓' : '✗'}</div>
                  {venue.venueProfile.exclusiveTicketingId && <div>Ticketing: {COMPANIES.find(c => c.id === venue.venueProfile?.exclusiveTicketingId)?.tradeName}</div>}
                </>}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-xs">
              <button onClick={() => onNavigate('project-detail', { projectId: engagement.projectId })} className="text-ems-accent hover:underline">↗ Project: {engagement.projectId}</button>
              <div className="text-text-secondary mt-1">{engagement.showCount} show (single)</div>
            </div>
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {tab === 'Workflows' && (
        <div className="grid grid-cols-2 gap-4">
          {workflowKeys.map(key => {
            const wf = engagement.workflows[key];
            const assignee = USERS.find(u => u.id === wf.assigneeId);
            const milestones = workflowMilestones[key];
            const pct = wf.milestonesTotal > 0 ? Math.round((wf.milestonesComplete / wf.milestonesTotal) * 100) : 0;
            return (
              <div key={key} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-primary font-medium text-sm">{workflowLabels[key]}</span>
                  <StatusBadge status={wf.status} />
                </div>
                <div className="text-xs text-text-secondary mb-2">Assigned: {assignee?.name}</div>
                <div className="mb-2"><ProgressBar value={wf.milestonesComplete} max={wf.milestonesTotal} /><span className="text-xs text-text-muted ml-2">{pct}% complete</span></div>
                <div className="space-y-1">
                  {milestones.map((m, i) => (
                    <label key={i} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-hover rounded px-1 py-0.5">
                      <input type="checkbox" checked={i < wf.milestonesComplete} onChange={() => toggleMilestone(key, i)} className="accent-ems-accent" />
                      <span className={i < wf.milestonesComplete ? 'text-text-muted line-through' : 'text-text-primary'}>{m}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => setOpenWorkflow(key)} className="text-ems-accent text-xs mt-3 hover:underline">Open Full Workflow →</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Contacts Tab */}
      {tab === 'Contacts' && (
        <div className="space-y-4">
          {[
            { title: 'Attraction-Tour Contacts', contacts: (tour?.contacts || []).map(tc => CONTACTS.find(c => c.id === tc.contactId)).filter(Boolean) },
            { title: 'Venue Contacts', contacts: CONTACTS.filter(c => c.companyId === engagement.venueId) },
            { title: 'IAE Internal', contacts: workflowKeys.map(k => USERS.find(u => u.id === engagement.workflows[k].assigneeId)).filter(Boolean) },
          ].map((section, si) => (
            <div key={si}>
              <h3 className="text-sm font-medium text-text-primary mb-2">{section.title}</h3>
              <table className="w-full text-sm mb-4">
                <thead><tr className="text-text-muted text-xs border-b border-border"><th className="text-left py-1.5">Name</th><th className="text-left py-1.5">Title/Role</th><th className="text-left py-1.5">Email</th><th className="text-left py-1.5">Phone</th></tr></thead>
                <tbody>
                  {section.contacts.map((ct: any, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 text-text-primary">{ct.firstName || ct.name} {ct.lastName || ''}</td>
                      <td className="py-1.5 text-text-secondary text-xs">{ct.title || ct.role}</td>
                      <td className="py-1.5 text-ems-blue text-xs">{ct.email}</td>
                      <td className="py-1.5 text-text-secondary text-xs">{ct.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'Documents' && (
        <div className="space-y-3">
          <button onClick={() => addToast('Upload simulated', 'success')} className="text-ems-accent text-sm hover:underline">+ Upload Document</button>
          <table className="w-full text-sm">
            <thead><tr className="text-text-muted text-xs border-b border-border"><th className="text-left py-1.5">File Name</th><th className="text-left py-1.5">Type</th><th className="text-left py-1.5">Workflow</th><th className="text-left py-1.5">Uploaded By</th><th className="text-left py-1.5">Date</th><th className="text-right py-1.5">Size</th><th></th></tr></thead>
            <tbody>
              {[
                { name: 'Deal Memo - Signed.pdf', type: 'PDF', workflow: 'Event Business', by: 'J. Okafor', date: 'Apr 15', size: '248 KB' },
                { name: 'Contract - Draft v2.docx', type: 'DOCX', workflow: 'Event Business', by: 'J. Okafor', date: 'Apr 18', size: '312 KB' },
                { name: 'Technical Rider - Afterglow.pdf', type: 'PDF', workflow: 'Production', by: 'M. Thompson', date: 'Apr 16', size: '1.2 MB' },
                { name: 'Stage Plot.pdf', type: 'PDF', workflow: 'Production', by: 'M. Thompson', date: 'Apr 16', size: '890 KB' },
                { name: 'Event Poster - Final.tiff', type: 'TIFF', workflow: 'Creative', by: 'A. Rivera', date: 'Apr 20', size: '45 MB' },
                { name: 'Settlement Worksheet Draft.xlsx', type: 'XLSX', workflow: 'Finance', by: 'P. Sharma', date: 'Apr 22', size: '128 KB' },
                { name: 'Artist Insurance COI.pdf', type: 'PDF', workflow: 'Event Business', by: 'J. Okafor', date: 'Apr 19', size: '198 KB' },
              ].map((f, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 text-text-primary">{f.name}</td>
                  <td className="py-1.5 text-text-secondary text-xs">{f.type}</td>
                  <td className="py-1.5 text-text-secondary text-xs">{f.workflow}</td>
                  <td className="py-1.5 text-text-secondary text-xs">{f.by}</td>
                  <td className="py-1.5 text-text-secondary text-xs">{f.date}</td>
                  <td className="py-1.5 text-right text-text-muted text-xs font-mono">{f.size}</td>
                  <td className="py-1.5 text-right space-x-2">
                    <button onClick={() => addToast('Download started', 'info')} className="text-ems-blue text-xs hover:underline">⬇</button>
                    <button onClick={() => addToast('File deleted', 'warning')} className="text-ems-coral text-xs hover:underline">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Log Tab */}
      {tab === 'Audit Log' && (
        <table className="w-full text-sm">
          <thead><tr className="text-text-muted text-xs border-b border-border"><th className="text-left py-1.5">Timestamp</th><th className="text-left py-1.5">User</th><th className="text-left py-1.5">Action</th><th className="text-left py-1.5">Details</th></tr></thead>
          <tbody>
            {[
              { time: 'Oct 1, 2025 8:03 AM', user: 'S. Kim', action: 'Status changed', detail: 'Confirmed → On Sale' },
              { time: 'Sep 29, 2025 3:15 PM', user: 'J. Okafor', action: 'Document uploaded', detail: 'Contract - Draft v2.docx' },
              { time: 'Sep 28, 2025 11:22 AM', user: 'M. Thompson', action: 'Workflow updated', detail: 'Production: Audio advance complete' },
              { time: 'Sep 25, 2025 9:44 AM', user: 'A. Rivera', action: 'Creative asset approved', detail: 'Event Poster - Final.tiff' },
              { time: 'Sep 22, 2025 2:30 PM', user: 'J. Okafor', action: 'Contract status updated', detail: 'Sent → Awaiting execution' },
              { time: 'Sep 18, 2025 10:15 AM', user: 'S. Kim', action: 'Contact assigned', detail: 'Jake Morrison (Tour Manager)' },
              { time: 'Sep 15, 2025 4:00 PM', user: 'S. Kim', action: 'Status changed', detail: 'Draft → Confirmed' },
              { time: 'Sep 15, 2025 4:00 PM', user: 'System', action: 'Workflows created', detail: '6 workflow records auto-created' },
              { time: 'Sep 15, 2025 3:58 PM', user: 'S. Kim', action: 'Engagement created', detail: 'Created from Offer OFR-001' },
            ].map((log, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-1.5 font-mono text-xs text-text-muted">{log.time}</td>
                <td className="py-1.5 text-text-primary">{log.user}</td>
                <td className="py-1.5 text-text-secondary">{log.action}</td>
                <td className="py-1.5 text-text-secondary text-xs">{log.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Workflow Full Panel */}
      {openWorkflow && (
        <Drawer onClose={() => setOpenWorkflow(null)} width={720}>
          <WorkflowFullPanel
            workflowKey={openWorkflow}
            engagement={engagement}
            onClose={() => setOpenWorkflow(null)}
            onToggleMilestone={toggleMilestone}
            onShowSettlement={() => setShowSettlement(true)}
            addToast={addToast}
          />
        </Drawer>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelEngagementModal engagement={engagement} onConfirm={(reason, party, date) => {
          onUpdateEngagement({
            ...engagement, status: 'Cancelled', cancellationReason: reason, cancellingParty: party, cancellationDate: date,
            workflows: Object.fromEntries(workflowKeys.map(k => [k, { ...engagement.workflows[k], status: 'Cancelled' }])) as any,
          });
          setShowCancelModal(false);
          addToast('Engagement cancelled', 'warning');
        }} onClose={() => setShowCancelModal(false)} />
      )}

      {/* Settlement */}
      {showSettlement && (
        <SettlementModal engagement={engagement} onClose={() => setShowSettlement(false)} addToast={addToast} />
      )}
    </div>
  );
}

function WorkflowFullPanel({ workflowKey, engagement, onClose, onToggleMilestone, onShowSettlement, addToast }: {
  workflowKey: string;
  engagement: Engagement;
  onClose: () => void;
  onToggleMilestone: (key: string, idx: number) => void;
  onShowSettlement: () => void;
  addToast: (msg: string, type: any) => void;
}) {
  const wf = engagement.workflows[workflowKey as keyof typeof engagement.workflows];
  const assignee = USERS.find(u => u.id === wf.assigneeId);
  const labels: Record<string, string> = { marketing: 'Marketing', production: 'Production', eventBusiness: 'Event Business', creative: 'Creative', sales: 'Sales', finance: 'Finance' };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{labels[workflowKey]} Workflow</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={wf.status} />
        <span className="text-sm text-text-secondary">Assigned: {assignee?.name}</span>
      </div>

      <ProgressBar value={wf.milestonesComplete} max={wf.milestonesTotal} />
      <div className="text-xs text-text-muted">{wf.milestonesComplete} / {wf.milestonesTotal} milestones ({Math.round((wf.milestonesComplete / wf.milestonesTotal) * 100)}%)</div>

      {/* Workflow-specific content */}
      {workflowKey === 'marketing' && (
        <div className="space-y-3">
          <div className="bg-elevated rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Total Budget</span><span className="text-text-primary font-mono">$38,000</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Venue Co-Op</span><span className="text-text-primary font-mono">$12,000</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Actuals to Date</span><span className="text-text-primary font-mono">$18,400 (70.8%)</span></div>
          </div>
          <h4 className="text-xs font-medium text-text-muted uppercase">Ad Placements</h4>
          <table className="w-full text-xs">
            <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-1">Channel</th><th className="text-left py-1">Vendor</th><th className="text-right py-1">Cost</th><th className="text-left py-1">Dates</th><th className="text-left py-1">Status</th></tr></thead>
            <tbody>
              {[
                { ch: 'Radio', vendor: 'WXRT Chicago', cost: '$4,200', dates: 'Oct 1–13', status: 'Active' },
                { ch: 'Digital', vendor: 'Google/Meta', cost: '$8,500', dates: 'Sep 28–Oct 14', status: 'Active' },
                { ch: 'OOH', vendor: 'Lamar Outdoor', cost: '$3,700', dates: 'Oct 7–14', status: 'Active' },
              ].map((p, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1 text-text-primary">{p.ch}</td><td className="py-1 text-text-secondary">{p.vendor}</td>
                  <td className="py-1 text-right font-mono">{p.cost}</td><td className="py-1 text-text-secondary">{p.dates}</td>
                  <td className="py-1"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {workflowKey === 'production' && (
        <div className="space-y-3">
          <div className="bg-elevated rounded-lg p-3 font-mono text-xs space-y-1">
            <div>Stage: 60' W × 40' D</div><div>Rigging: 40,000 lbs</div><div>Trucks: 8</div><div>Crew: 42</div><div>Power: 400A 3-phase</div>
          </div>
          <h4 className="text-xs font-medium text-text-muted uppercase">Load-In Schedule</h4>
          <table className="w-full text-xs">
            <tbody>
              {[
                { day: 'Oct 13', time: '6:00 AM', activity: 'Trucks arrive / begin unload' },
                { day: 'Oct 13', time: '7:00 AM', activity: 'Stage build begins' },
                { day: 'Oct 14', time: '10:00 AM', activity: 'Sound check' },
                { day: 'Oct 14', time: '7:00 PM', activity: 'Doors open' },
                { day: 'Oct 14', time: '8:00 PM', activity: 'Show start' },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50"><td className="py-1 text-text-secondary">{r.day}</td><td className="py-1 font-mono">{r.time}</td><td className="py-1 text-text-primary">{r.activity}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="bg-elevated rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Labor Vendor</span><span className="text-text-primary">IATSE Local 2 Chicago</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Estimated</span><span className="font-mono">$28,000</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Actual</span><span className="font-mono">$31,400</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Variance</span><span className="text-ems-coral font-mono">+$3,400</span></div>
          </div>
        </div>
      )}

      {workflowKey === 'eventBusiness' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-text-muted uppercase">Contract Status</h4>
          <div className="flex items-center gap-2">
            {['Deal Memo', 'Draft', 'Sent', 'Executed', 'Settled'].map((step, i) => (
              <React.Fragment key={step}>
                <div className={`text-xs px-2 py-1 rounded ${i < 3 ? 'bg-ems-green-dim text-ems-green' : i === 3 ? 'bg-ems-amber-dim text-ems-amber' : 'bg-elevated text-text-muted'}`}>{step} {i < 3 ? '✅' : '⬜'}</div>
                {i < 4 && <span className="text-text-muted">→</span>}
              </React.Fragment>
            ))}
          </div>
          <h4 className="text-xs font-medium text-text-muted uppercase mt-4">Ticketing Manifest</h4>
          <table className="w-full text-xs">
            <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-1">Tier</th><th className="text-right py-1">Price</th><th className="text-right py-1">Inventory</th><th className="text-right py-1">Sold</th><th className="text-right py-1">Remaining</th></tr></thead>
            <tbody>
              {[
                { tier: 'Floor GA', price: 85, inv: 4500, sold: 3812 },
                { tier: 'Lower Bowl', price: 125, inv: 8000, sold: 5941 },
                { tier: 'Upper Bowl', price: 75, inv: 5204, sold: 2890 },
                { tier: 'VIP Package', price: 350, inv: 500, sold: 200 },
              ].map((t, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1 text-text-primary">{t.tier}</td><td className="py-1 text-right font-mono">${t.price}</td>
                  <td className="py-1 text-right font-mono">{t.inv.toLocaleString()}</td><td className="py-1 text-right font-mono">{t.sold.toLocaleString()}</td>
                  <td className="py-1 text-right font-mono">{(t.inv - t.sold).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={onShowSettlement} className="bg-ems-accent text-background text-xs px-3 py-1.5 rounded mt-2">Generate Settlement Worksheet</button>
        </div>
      )}

      {workflowKey === 'sales' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Gross to Date', value: '$421,200' },
              { label: 'Units Sold', value: '12,843' },
              { label: 'Capacity', value: '70.4%' },
              { label: 'Days to Show', value: '14' },
            ].map((k, i) => (
              <div key={i} className="bg-elevated rounded p-2 text-center">
                <div className="text-sm font-semibold text-text-primary font-mono">{k.value}</div>
                <div className="text-[10px] text-text-muted">{k.label}</div>
              </div>
            ))}
          </div>
          <h4 className="text-xs font-medium text-text-muted uppercase">Weekly Sales Velocity</h4>
          <svg width="300" height="120" className="w-full">
            {[3200, 2800, 1900, 1600, 1400, 1050].map((v, i) => {
              const maxV = 3200;
              const h = (v / maxV) * 80;
              const x = i * 50 + 10;
              return (
                <g key={i}>
                  <rect x={x} y={100 - h} width={35} height={h} fill="hsl(168, 100%, 42%)" rx="2" />
                  <text x={x + 17} y={95 - h} textAnchor="middle" fill="#8B949E" fontSize="9" fontFamily="JetBrains Mono">{v}</text>
                  <text x={x + 17} y={115} textAnchor="middle" fill="#484F58" fontSize="9">W{i + 1}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {(workflowKey === 'creative' || workflowKey === 'finance') && (
        <div className="text-sm text-text-secondary">
          {workflowKey === 'finance' && <button onClick={onShowSettlement} className="bg-ems-accent text-background text-xs px-3 py-1.5 rounded mt-2">Generate Settlement Worksheet</button>}
        </div>
      )}
    </div>
  );
}

function CancelEngagementModal({ engagement, onConfirm, onClose }: { engagement: Engagement; onConfirm: (reason: string, party: string, date: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [party, setParty] = useState('IAE');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <Modal title="Cancel Engagement" onClose={onClose} width={500}>
      <div className="space-y-3">
        <div className="text-sm text-ems-coral">This action cannot be undone.</div>
        <div><label className="text-xs text-text-muted">Reason *</label><textarea className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary h-20 resize-none mt-1" value={reason} onChange={e => setReason(e.target.value)} /></div>
        <div><label className="text-xs text-text-muted">Cancelling Party *</label>
          <div className="flex gap-3 mt-1">{['IAE', 'Attraction', 'Venue', 'Force Majeure'].map(p => (
            <label key={p} className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"><input type="radio" checked={party === p} onChange={() => setParty(p)} className="accent-ems-accent" />{p}</label>
          ))}</div>
        </div>
        <div><label className="text-xs text-text-muted">Date *</label><input type="date" className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="text-text-secondary px-4 py-1.5">Cancel</button><button onClick={() => { if (reason) onConfirm(reason, party, date); }} className="bg-ems-coral text-background px-4 py-1.5 rounded-md text-sm font-medium">Confirm Cancellation</button></div>
      </div>
    </Modal>
  );
}

function SettlementModal({ engagement, onClose, addToast }: { engagement: Engagement; onClose: () => void; addToast: (msg: string, type: any) => void }) {
  const venue = COMPANIES.find(c => c.id === engagement.venueId);
  return (
    <Modal title={`Settlement Worksheet — ${engagement.id.toUpperCase()}`} onClose={onClose} width={600}>
      <div className="space-y-3 text-sm">
        <div className="text-text-secondary">{engagement.name} · {formatDate(engagement.showDates[0]?.date)}</div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-border"><td colSpan={2} className="py-1.5 font-medium text-text-primary">GROSS RECEIPTS</td></tr>
            <tr><td className="py-1 text-text-secondary">Ticket Sales (12,843 × avg $46.54)</td><td className="py-1 text-right font-mono text-text-primary">$598,500</td></tr>
            <tr><td className="py-1 text-text-secondary">VIP Revenue</td><td className="py-1 text-right font-mono text-text-primary">$62,300</td></tr>
            <tr><td className="py-1 text-text-secondary">Merch (est, 15%)</td><td className="py-1 text-right font-mono text-text-primary">$18,000</td></tr>
            <tr><td className="py-1 text-text-secondary">Sponsorship Revenue</td><td className="py-1 text-right font-mono text-text-primary">$33,000</td></tr>
            <tr className="border-t border-border font-medium"><td className="py-1.5 text-text-primary">TOTAL GROSS</td><td className="py-1.5 text-right font-mono text-ems-accent">$711,800</td></tr>

            <tr className="border-t border-border"><td colSpan={2} className="py-1.5 font-medium text-text-primary">DEDUCTIONS</td></tr>
            <tr><td className="py-1 text-text-secondary">Ticketing Fees (6%)</td><td className="py-1 text-right font-mono text-ems-coral">-$35,910</td></tr>
            <tr><td className="py-1 text-text-secondary">Venue Rent</td><td className="py-1 text-right font-mono text-ems-coral">-$45,000</td></tr>
            <tr><td className="py-1 text-text-secondary">Marketing Spend</td><td className="py-1 text-right font-mono text-ems-coral">-$41,200</td></tr>
            <tr><td className="py-1 text-text-secondary">Production / Labor</td><td className="py-1 text-right font-mono text-ems-coral">-$31,400</td></tr>
            <tr><td className="py-1 text-text-secondary">Catering</td><td className="py-1 text-right font-mono text-ems-coral">-$8,200</td></tr>
            <tr><td className="py-1 text-text-secondary">Misc / Insurance</td><td className="py-1 text-right font-mono text-ems-coral">-$4,100</td></tr>
            <tr className="border-t border-border font-medium"><td className="py-1.5 text-text-primary">TOTAL DEDUCTIONS</td><td className="py-1.5 text-right font-mono text-ems-coral">-$165,810</td></tr>

            <tr className="border-t-2 border-border"><td className="py-1.5 text-text-primary font-medium">NET RECEIPTS</td><td className="py-1.5 text-right font-mono text-text-primary font-medium">$545,990</td></tr>
            <tr><td className="py-1 text-text-secondary">Break-Even Threshold</td><td className="py-1 text-right font-mono">$320,000</td></tr>
            <tr><td className="py-1 text-text-secondary">Amount Over Break-Even</td><td className="py-1 text-right font-mono">$225,990</td></tr>

            <tr className="border-t border-border"><td colSpan={2} className="py-1.5 font-medium text-text-primary">ARTIST PAYMENT</td></tr>
            <tr><td className="py-1 text-text-secondary">Guarantee (floor)</td><td className="py-1 text-right font-mono">$175,000</td></tr>
            <tr><td className="py-1 text-text-secondary">85% of $225,990 over break-even</td><td className="py-1 text-right font-mono">+$192,092</td></tr>
            <tr className="border-t border-border font-medium"><td className="py-1.5 text-text-primary">ARTIST TOTAL</td><td className="py-1.5 text-right font-mono text-ems-amber">$367,092</td></tr>

            <tr className="border-t-2 border-ems-accent bg-ems-accent-dim"><td className="py-2 text-ems-accent font-semibold">IAE NET</td><td className="py-2 text-right font-mono text-ems-accent font-semibold">$178,898</td></tr>
          </tbody>
        </table>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-text-secondary px-4 py-1.5">Close</button>
          <button onClick={() => addToast('PDF export simulated', 'info')} className="bg-elevated text-text-primary px-4 py-1.5 rounded border border-border text-sm">Export PDF</button>
          <button onClick={() => addToast('Settlement finalized', 'success')} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Finalize</button>
        </div>
      </div>
    </Modal>
  );
}
