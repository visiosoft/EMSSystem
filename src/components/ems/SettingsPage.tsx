import React, { useState } from 'react';
import { StatusBadge, TabBar, ActionMenu, Modal, FormField } from './Primitives';
import { Select2, toOptions } from './Select2';

interface UserRow { id: string; name: string; role: string; email: string; lastLogin: string; }
interface DmaRow { id: string; name: string; status: string; }

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  users: UserRow[];
  dmas: DmaRow[];
  onUpdateUsers: (users: UserRow[]) => void;
  onUpdateDmas: (dmas: DmaRow[]) => void;
}

export function SettingsPage({ addToast, users, dmas, onUpdateUsers, onUpdateDmas }: Props) {
  const [tab, setTab] = useState('Users');
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Booker');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [showAddDma, setShowAddDma] = useState(false);
  const [editDma, setEditDma] = useState<DmaRow | null>(null);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      <TabBar tabs={['Users', 'Lookup Tables', 'System']} active={tab} onChange={setTab} />

      {tab === 'Users' && (
        <div className="space-y-3">
          <button onClick={() => setShowInvite(!showInvite)} className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium">+ Invite User</button>
          {showInvite && (
            <div className="bg-elevated border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-text-muted">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' mt-1'} />
              </div>
              <div className="w-48">
                <label className="text-xs text-text-muted">Role</label>
                <div className="mt-1">
                  <Select2
                    options={toOptions(['Booker', 'WorkflowStaff', 'Management', 'Admin'])}
                    value={role}
                    onChange={setRole}
                  />
                </div>
              </div>
              <button onClick={() => {
                if (!email) return;
                const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
                const name = namePart.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                onUpdateUsers([{ id: `usr-${Date.now()}`, name, email, role, lastLogin: 'Never' }, ...users]);
                setEmail(''); setRole('Booker'); setShowInvite(false);
                addToast('User invited', 'success');
              }} className="bg-ems-accent text-background px-3 py-1.5 rounded text-sm">Send</button>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm bg-card border border-border rounded-lg min-w-[550px]">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface"><th className="text-left py-2.5 px-3">Name</th><th className="text-left py-2.5 px-3">Email</th><th className="text-left py-2.5 px-3">Role</th><th className="text-left py-2.5 px-3">Last Login</th><th className="text-left py-2.5 px-3">Status</th><th /></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 text-text-primary">{u.name}</td>
                  <td className="py-2.5 px-3 text-ems-blue text-xs">{u.email}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{u.role}</td>
                  <td className="py-2.5 px-3 text-text-secondary text-xs">{u.lastLogin}</td>
                  <td className="py-2.5 px-3"><StatusBadge status="Active" /></td>
                  <td className="py-2.5 px-3 text-right">
                    <ActionMenu items={[
                      { label: 'Edit', onClick: () => setEditUser(u) },
                      { label: 'Delete', onClick: () => { onUpdateUsers(users.filter(x => x.id !== u.id)); addToast('User removed', 'warning'); }, danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'Lookup Tables' && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">DMAs</h3>
          <div className="overflow-x-auto">
          <table className="w-full text-sm bg-card border border-border rounded-lg min-w-[300px]">
            <thead><tr className="text-text-muted text-xs border-b border-border bg-surface"><th className="text-left py-2.5 px-3">Name</th><th className="text-left py-2.5 px-3">Status</th><th className="w-20"></th></tr></thead>
            <tbody>
              {dmas.map(d => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 text-text-primary">{d.name}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                  <td className="py-2.5 px-3 text-right">
                    <ActionMenu items={[
                      { label: 'Edit', onClick: () => setEditDma(d) },
                      { label: 'Delete', onClick: () => { onUpdateDmas(dmas.filter(x => x.id !== d.id)); addToast('DMA deleted', 'warning'); }, danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <button onClick={() => setShowAddDma(true)} className="text-ems-accent text-sm hover:underline">+ Add DMA</button>
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
              { label: 'Active Users', value: `${users.length} users` },
            ].map((r, i) => (
              <div key={i} className="flex justify-between border-b border-border/50 pb-2"><span className="text-text-muted">{r.label}</span><span className="text-text-primary font-mono">{r.value}</span></div>
            ))}
          </div>
        </div>
      )}

      {editUser && <Modal title="Edit User" onClose={() => setEditUser(null)} width={500}><UserForm initial={editUser} onSave={(u) => { onUpdateUsers(users.map(x => x.id === u.id ? u : x)); setEditUser(null); addToast('User updated', 'success'); }} onCancel={() => setEditUser(null)} /></Modal>}
      {showAddDma && <Modal title="Add DMA" onClose={() => setShowAddDma(false)} width={500}><DmaForm onSave={(d) => { onUpdateDmas([d, ...dmas]); setShowAddDma(false); addToast('DMA created', 'success'); }} onCancel={() => setShowAddDma(false)} /></Modal>}
      {editDma && <Modal title="Edit DMA" onClose={() => setEditDma(null)} width={500}><DmaForm initial={editDma} onSave={(d) => { onUpdateDmas(dmas.map(x => x.id === d.id ? d : x)); setEditDma(null); addToast('DMA updated', 'success'); }} onCancel={() => setEditDma(null)} /></Modal>}
    </div>
  );
}

function UserForm({ initial, onSave, onCancel }: { initial: UserRow; onSave: (u: UserRow) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [role, setRole] = useState(initial.role);
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  return (
    <div className="space-y-3">
      <FormField label="Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></FormField>
      <FormField label="Email"><input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></FormField>
      <FormField label="Role">
        <Select2 options={toOptions(['Booker', 'WorkflowStaff', 'Management', 'Admin'])} value={role} onChange={setRole} />
      </FormField>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button>
        <button onClick={() => onSave({ ...initial, name, email, role })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}

function DmaForm({ initial, onSave, onCancel }: { initial?: DmaRow; onSave: (d: DmaRow) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [status, setStatus] = useState(initial?.status || 'Active');
  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';
  return (
    <div className="space-y-3">
      <FormField label="DMA Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></FormField>
      <FormField label="Status">
        <Select2 options={toOptions(['Active', 'Inactive'])} value={status} onChange={setStatus} />
      </FormField>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5">Cancel</button>
        <button onClick={() => onSave({ id: initial?.id || `dma-${Date.now()}`, name, status })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
