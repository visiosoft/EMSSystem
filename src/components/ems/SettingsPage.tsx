import React, { useState } from 'react';
import { USERS, DMAS } from '@/data/constants';
import { StatusBadge, TabBar, ActionMenu } from './Primitives';

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function SettingsPage({ addToast }: Props) {
  const [tab, setTab] = useState('Users');
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      <TabBar tabs={['Users', 'Lookup Tables', 'System']} active={tab} onChange={setTab} />

      {tab === 'Users' && (
        <div className="space-y-3">
          <button onClick={() => setShowInvite(!showInvite)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Invite User</button>
          {showInvite && (
            <div className="bg-elevated border border-border rounded-lg p-3 flex gap-3 items-end">
              <div className="flex-1"><label className="text-xs text-text-muted">Email</label><input className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary mt-1" /></div>
              <div className="w-40"><label className="text-xs text-text-muted">Role</label><select className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary mt-1"><option>Booker</option><option>WorkflowStaff</option><option>Management</option><option>Admin</option></select></div>
              <button onClick={() => { setShowInvite(false); addToast('Invite sent', 'success'); }} className="bg-ems-accent text-background px-3 py-1.5 rounded text-sm">Send</button>
            </div>
          )}
          <table className="w-full text-sm bg-card border border-border rounded-lg overflow-hidden">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface"><th className="text-left py-2.5 px-3">Name</th><th className="text-left py-2.5 px-3">Email</th><th className="text-left py-2.5 px-3">Role</th><th className="text-left py-2.5 px-3">Last Login</th><th className="text-left py-2.5 px-3">Status</th></tr></thead>
            <tbody>
              {USERS.map(u => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 text-text-primary">{u.name}</td>
                  <td className="py-2.5 px-3 text-ems-blue text-xs">{u.email}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{u.role}</td>
                  <td className="py-2.5 px-3 text-text-secondary text-xs">{u.lastLogin}</td>
                  <td className="py-2.5 px-3"><StatusBadge status="Active" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Lookup Tables' && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">DMAs</h3>
          <table className="w-full text-sm bg-card border border-border rounded-lg overflow-hidden">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface"><th className="text-left py-2.5 px-3">Name</th><th className="text-left py-2.5 px-3">Status</th><th className="w-20"></th></tr></thead>
            <tbody>
              {DMAS.map(d => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 text-text-primary">{d.name}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                  <td className="py-2.5 px-3 text-right">
                    <ActionMenu items={[
                      { label: 'Edit', onClick: () => addToast('Edit DMA', 'info') },
                      { label: 'Deactivate', onClick: () => addToast('DMA deactivated', 'warning'), danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => addToast('Add DMA', 'info')} className="text-ems-accent text-sm hover:underline">+ Add DMA</button>
        </div>
      )}

      {tab === 'System' && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="space-y-3 text-sm">
            {[
              { label: 'Application Version', value: '1.0.0-beta' },
              { label: 'Environment', value: 'Production' },
              { label: 'Database', value: 'Azure SQL (East US)' },
              { label: 'Storage', value: 'Azure Blob Storage' },
              { label: 'Last Backup', value: 'Today 3:00 AM UTC' },
              { label: 'Auth Provider', value: 'Azure Active Directory' },
              { label: 'Active Users', value: '8 of 50 licensed' },
            ].map((r, i) => (
              <div key={i} className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-muted">{r.label}</span>
                <span className="text-text-primary font-mono">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
