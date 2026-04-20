import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { StatusBadge, TabBar, ActionMenu, Modal, FormField } from './Primitives';
import { Select2, toOptions } from './Select2';
import { apiFetch } from '@/api/config';
import { friendlyApiError } from '@/lib/friendlyApiError';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow { id: string; name: string; role: string; email: string; lastLogin: string; }

interface DmaMarket { marketName: string; }

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  users: UserRow[];
  dmas?: unknown;           // kept for API compat with Index.tsx but ignored
  onUpdateUsers: (users: UserRow[]) => void;
  onUpdateDmas?: (dmas: unknown[]) => void; // kept for API compat
}

// ─── DMA market fetch ─────────────────────────────────────────────────────────

function fetchDmaMarkets(): Promise<DmaMarket[]> {
  return apiFetch<DmaMarket[]>('/lookups/dma-markets');
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export function SettingsPage({ addToast, users, onUpdateUsers }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Users');
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Booker');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [dmaSearch, setDmaSearch] = useState('');
  const [dmaPage, setDmaPage] = useState(1);

  const DMA_PAGE_SIZE = 50;

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const dmaQuery = useQuery({
    queryKey: ['dma-markets'],
    queryFn: fetchDmaMarkets,
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'Lookup Tables',
  });

  const filteredDmas = (dmaQuery.data ?? []).filter(d =>
    !dmaSearch.trim() || d.marketName.toLowerCase().includes(dmaSearch.toLowerCase()),
  );
  const dmaPageCount = Math.max(1, Math.ceil(filteredDmas.length / DMA_PAGE_SIZE));
  const dmaPageClamped = Math.min(dmaPage, dmaPageCount);
  const dmaRows = filteredDmas.slice((dmaPageClamped - 1) * DMA_PAGE_SIZE, dmaPageClamped * DMA_PAGE_SIZE);

  React.useEffect(() => { setDmaPage(1); }, [dmaSearch]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      <TabBar tabs={['Users', 'Lookup Tables', 'System']} active={tab} onChange={setTab} />

      {/* ─── Users tab ─────────────────────────────────────────────────────── */}
      {tab === 'Users' && (
        <div className="space-y-3">
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-ems-accent hover:bg-ems-accent/80 text-background px-4 py-1.5 rounded-md text-sm font-medium"
          >
            + Invite User
          </button>

          {showInvite && (
            <div className="bg-elevated border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-text-muted">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' mt-1'} />
              </div>
              <div className="w-48">
                <label className="text-xs text-text-muted">Role</label>
                <div className="mt-1">
                  <Select2 options={toOptions(['Booker', 'WorkflowStaff', 'Management', 'Admin'])} value={role} onChange={setRole} />
                </div>
              </div>
              <button onClick={() => {
                if (!email) return;
                const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
                const name = namePart.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                onUpdateUsers([{ id: `usr-${Date.now()}`, name, email, role, lastLogin: 'Never' }, ...users]);
                setEmail(''); setRole('Booker'); setShowInvite(false);
                addToast('User invited', 'success');
              }} className="bg-ems-accent text-background px-3 py-1.5 rounded text-sm">
                Send
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-card border border-border rounded-lg min-w-[550px]">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-surface">
                  <th className="text-left py-2.5 px-3">Name</th>
                  <th className="text-left py-2.5 px-3">Email</th>
                  <th className="text-left py-2.5 px-3">Role</th>
                  <th className="text-left py-2.5 px-3">Last Login</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                  <th />
                </tr>
              </thead>
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
                        { label: 'Delete', danger: true, onClick: () => { onUpdateUsers(users.filter(x => x.id !== u.id)); addToast('User removed', 'warning'); } },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Lookup Tables tab ─────────────────────────────────────────────── */}
      {tab === 'Lookup Tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-medium text-text-primary">
                DMA Markets
              </h3>
              {!dmaQuery.isPending && (
                <p className="text-xs text-text-muted mt-0.5">
                  {filteredDmas.length.toLocaleString()} distinct market{filteredDmas.length !== 1 ? 's' : ''}
                  {dmaSearch ? ' matching search' : ' in database'}
                </p>
              )}
            </div>
            {dmaQuery.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />
            )}
          </div>

          {/* Search */}
          <input
            className={inputCls + ' max-w-xs'}
            value={dmaSearch}
            onChange={e => setDmaSearch(e.target.value)}
            placeholder="Search market names…"
          />

          {/* Error */}
          {dmaQuery.isError && (
            <div className="text-sm text-ems-coral border border-ems-coral/30 rounded px-3 py-2 bg-ems-coral-dim">
              Could not load DMA markets: {friendlyApiError(dmaQuery.error)}
            </div>
          )}

          {/* Loading */}
          {dmaQuery.isPending && (
            <div className="flex items-center gap-2 text-sm text-text-muted py-6">
              <Loader2 className="h-4 w-4 animate-spin text-ems-accent" />
              Loading DMA markets…
            </div>
          )}

          {/* Table */}
          {!dmaQuery.isPending && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm bg-card border border-border rounded-lg min-w-[300px]">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border bg-surface">
                      <th className="text-left py-2.5 px-3">Market Name</th>
                      <th className="text-left py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dmaRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-sm text-text-muted">
                          {dmaSearch ? 'No markets match your search.' : 'No DMA markets found.'}
                        </td>
                      </tr>
                    )}
                    {dmaRows.map(d => (
                      <tr key={d.marketName} className="border-b border-border/50">
                        <td className="py-2.5 px-3 text-text-primary">{d.marketName}</td>
                        <td className="py-2.5 px-3"><StatusBadge status="Active" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredDmas.length > DMA_PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs text-text-secondary px-1">
                  <span className="tabular-nums">
                    Showing {(dmaPageClamped - 1) * DMA_PAGE_SIZE + 1}–{Math.min(dmaPageClamped * DMA_PAGE_SIZE, filteredDmas.length)} of {filteredDmas.length.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button disabled={dmaPageClamped <= 1} onClick={() => setDmaPage(p => p - 1)}
                      className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs">
                      Previous
                    </button>
                    <span className="tabular-nums">Page {dmaPageClamped} / {dmaPageCount}</span>
                    <button disabled={dmaPageClamped >= dmaPageCount} onClick={() => setDmaPage(p => p + 1)}
                      className="px-3 py-1.5 rounded border border-border bg-elevated hover:bg-hover disabled:opacity-40 text-xs">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── System tab ────────────────────────────────────────────────────── */}
      {tab === 'System' && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="space-y-3 text-sm">
            {[
              { label: 'Application Version', value: '1.0.0-beta' },
              { label: 'Environment', value: 'Production' },
              { label: 'Database', value: 'Azure SQL — EngagementDB_Dev' },
              { label: 'DB Host', value: 'engagementdb-sql-dev.database.windows.net' },
              { label: 'Auth Provider', value: 'Azure Active Directory' },
              { label: 'Active Users', value: `${users.length} users` },
            ].map((r, i) => (
              <div key={i} className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-muted">{r.label}</span>
                <span className="text-text-primary font-mono">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <Modal title="Edit User" onClose={() => setEditUser(null)} width={500}>
          <UserForm
            initial={editUser}
            onSave={(u) => { onUpdateUsers(users.map(x => x.id === u.id ? u : x)); setEditUser(null); addToast('User updated', 'success'); }}
            onCancel={() => setEditUser(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── UserForm ─────────────────────────────────────────────────────────────────

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
        <button onClick={onCancel} className="text-text-secondary px-4 py-1.5 text-sm">Cancel</button>
        <button onClick={() => onSave({ ...initial, name, email, role })} className="bg-ems-accent text-background px-4 py-1.5 rounded-md text-sm font-medium">Save</button>
      </div>
    </div>
  );
}
