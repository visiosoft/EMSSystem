import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { StatusBadge, TabBar, ActionMenu, Modal, FormField, SearchInput } from './Primitives';
import { Select2, toOptions } from './Select2';
import { friendlyApiError } from '@/lib/friendlyApiError';
import {
  getPageParams,
  getTotalPages,
  getPageRange,
  PAGE_SIZE,
  type PageSizeOption,
} from '@/lib/serverPagination';
import { PageSizeSelect } from './PageSizeSelect';
import { fetchDmaMarketsPaged } from '@/api/companyApi';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow { id: string; name: string; role: string; email: string; lastLogin: string; }

interface Props {
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  users: UserRow[];
  dmas?: unknown;           // kept for API compat with Index.tsx but ignored
  onUpdateUsers: (users: UserRow[]) => void;
  onUpdateDmas?: (dmas: unknown[]) => void; // kept for API compat
}

function DmaMarketsTableSkeleton({ rowCount = PAGE_SIZE }: { rowCount?: number }) {
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden min-h-[22rem]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 border-b border-border bg-surface/40">
        <Loader2 className="h-10 w-10 text-ems-accent animate-spin shrink-0" aria-hidden />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-sm font-semibold text-text-primary">Loading DMA markets</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Fetching {rowCount} rows from the server…
          </p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-clip">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border bg-surface">
              <th className="text-left py-2.5 px-3">Market name</th>
              <th className="text-left py-2.5 px-3">Postal code</th>
              <th className="text-left py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="py-3 px-3">
                  <Skeleton className="h-4 w-48 max-w-[16rem] bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-4 w-20 bg-muted/80" />
                </td>
                <td className="py-3 px-3">
                  <Skeleton className="h-6 w-16 rounded-full bg-muted/80" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export function SettingsPage({ addToast, users, onUpdateUsers }: Props) {
  const [tab, setTab] = useState('Users');
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Booker');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [dmaSearchInput, setDmaSearchInput] = useState('');
  const [dmaSearchDebounced, setDmaSearchDebounced] = useState('');
  const [dmaPage, setDmaPage] = useState(1);
  const [dmaPageSize, setDmaPageSize] = useState<PageSizeOption>(PAGE_SIZE);

  const inputCls = 'w-full bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent';

  const { offset: dmaOffset, limit: dmaLimit } = getPageParams(dmaPage, dmaPageSize);

  useEffect(() => {
    const t = window.setTimeout(() => setDmaSearchDebounced(dmaSearchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [dmaSearchInput]);

  useEffect(() => {
    setDmaPage(1);
  }, [dmaSearchDebounced]);

  useEffect(() => {
    setDmaPage(1);
  }, [dmaPageSize]);

  const dmaQuery = useQuery({
    queryKey: ['dma-markets', 'settings', dmaPage, dmaPageSize, dmaSearchDebounced, dmaOffset, dmaLimit],
    queryFn: () =>
      fetchDmaMarketsPaged(dmaOffset, dmaLimit, dmaSearchDebounced || undefined),
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'Lookup Tables',
    placeholderData: (prev) => prev,
  });

  const dmaTotal = dmaQuery.data?.total ?? 0;
  const dmaRows = dmaQuery.data?.data ?? [];
  const dmaPageCount = getTotalPages(dmaTotal, dmaPageSize);
  const dmaPageClamped = Math.min(dmaPage, dmaPageCount);
  const { rangeStart: dmaRangeStart, rangeEnd: dmaRangeEnd } = getPageRange(
    dmaPageClamped,
    dmaTotal,
    dmaPageSize,
  );
  const dmaTableLoading = dmaQuery.isPending || dmaQuery.isFetching;

  useEffect(() => {
    if (dmaPage > dmaPageCount) setDmaPage(dmaPageCount);
  }, [dmaPage, dmaPageCount]);

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
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-text-primary">DMA Markets</h3>
              {!dmaTableLoading && !dmaQuery.isError && (
                <span className="text-xs bg-elevated px-2 py-0.5 rounded text-text-secondary tabular-nums">
                  {dmaTotal.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="w-full sm:w-72">
            <SearchInput
              value={dmaSearchInput}
              onChange={setDmaSearchInput}
              placeholder="Search market name or postal code…"
              disabled={dmaTableLoading}
            />
          </div>

          {dmaQuery.isError && (
            <div className="text-sm text-ems-coral border border-ems-coral/30 rounded-md px-3 py-2 bg-ems-coral-dim">
              Could not load DMA markets: {friendlyApiError(dmaQuery.error)}
            </div>
          )}

          {dmaTableLoading ? (
            <DmaMarketsTableSkeleton rowCount={dmaPageSize} />
          ) : (
            <>
              <div className="bg-card border border-border rounded-lg overflow-x-auto overflow-y-clip">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-border bg-surface">
                      <th className="text-left py-2.5 px-3">Market name</th>
                      <th className="text-left py-2.5 px-3">Postal code</th>
                      <th className="text-left py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dmaRows.length === 0 && !dmaQuery.isError && (
                      <tr>
                        <td colSpan={3} className="py-12 px-3 text-center text-sm text-text-muted">
                          {dmaSearchDebounced
                            ? 'No DMA rows match your search.'
                            : 'No DMA markets returned from the database.'}
                        </td>
                      </tr>
                    )}
                    {dmaRows.map((d) => (
                      <tr key={d.dmaid} className="border-b border-border/50 hover:bg-hover/60">
                        <td className="py-2.5 px-3 text-text-primary font-medium">{d.marketName}</td>
                        <td className="py-2.5 px-3 text-text-secondary font-mono tabular-nums">
                          {d.postalCode || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status="Active" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dmaTotal > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary px-1">
                  <p className="tabular-nums">
                    Showing{' '}
                    <span className="text-text-primary font-medium">
                      {dmaRangeStart}–{dmaRangeEnd}
                    </span>{' '}
                    of <span className="text-text-primary font-medium">{dmaTotal.toLocaleString()}</span>
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted">
                      <span aria-hidden>·</span>
                      <PageSizeSelect
                        value={dmaPageSize}
                        onChange={setDmaPageSize}
                        disabled={dmaQuery.isFetching}
                      />
                      <span>per page</span>
                    </span>
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={dmaPageClamped <= 1 || dmaQuery.isFetching}
                      onClick={() => setDmaPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="text-text-muted tabular-nums px-1">
                      Page {dmaPageClamped} / {dmaPageCount}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                      disabled={dmaPageClamped >= dmaPageCount || dmaQuery.isFetching}
                      onClick={() => setDmaPage((p) => Math.min(dmaPageCount, p + 1))}
                    >
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