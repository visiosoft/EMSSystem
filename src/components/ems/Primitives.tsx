import React, { useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getStatusColor, getInitials } from '@/data/constants';

export function StatusBadge({ status }: { status: string }) {
  const { bg, text } = getStatusColor(status);
  const label = status.replace(/([A-Z])/g, ' $1').trim();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

export function Avatar({ name, size = 'md', color }: { name: string; size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  const colors = ['bg-ems-accent-dim text-ems-accent', 'bg-ems-blue-dim text-ems-blue', 'bg-ems-purple-dim text-ems-purple', 'bg-ems-amber-dim text-ems-amber', 'bg-ems-green-dim text-ems-green'];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`${sizes[size]} ${color || colors[idx]} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const colors = {
    success: 'border-l-4 border-l-ems-green',
    error: 'border-l-4 border-l-ems-coral',
    warning: 'border-l-4 border-l-ems-amber',
    info: 'border-l-4 border-l-ems-blue',
  };

  return (
    <div className={`animate-slide-up bg-elevated border border-border rounded-lg p-3 shadow-lg ${colors[toast.type]}`}>
      <div className="flex items-start gap-2">
        <span className="text-text-primary text-sm flex-1">{toast.message}</span>
        <button onClick={onDismiss} className="text-text-muted hover:text-text-secondary text-xs">✕</button>
      </div>
      {toast.action && (
        <button onClick={toast.action.onClick} className="text-ems-accent text-xs mt-1 hover:underline">
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  width = 600,
  /** Use for dialogs with portaled-style dropdowns: avoids max-h + overflow-y clipping and inner scrollbars */
  allowContentOverflow = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
  allowContentOverflow?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const dialogScrollCls = allowContentOverflow
    ? 'overflow-visible max-h-none'
    : 'max-h-[90vh] overflow-y-auto';

  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${allowContentOverflow ? 'items-start pt-10 sm:pt-16 pb-10 overflow-y-auto' : 'items-center'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative animate-fade-in bg-elevated border border-border rounded-lg shadow-xl box-border ${dialogScrollCls}`}
        style={{ width: `min(${width}px, 95vw)` }}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-elevated z-10">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ title, children, onClose, width = 600 }: { title?: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end max-sm:items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative animate-slide-in-right bg-surface border-l border-border h-full overflow-auto max-sm:h-[85vh] max-sm:w-full max-sm:border-l-0 max-sm:border-t max-sm:rounded-t-2xl" style={{ width, maxWidth: '95vw' }}>
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-lg">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex border-b border-border overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
            active === t
              ? 'text-ems-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-ems-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const showClear = value.length > 0 && !disabled;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" aria-hidden>
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-busy={disabled}
        className={`w-full bg-elevated border border-border rounded-md py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/30 disabled:opacity-50 disabled:cursor-not-allowed pl-8 ${showClear ? 'pr-9' : 'pr-3'}`}
      />
      {showClear && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={(e) => {
            e.preventDefault();
            onChange('');
          }}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ems-accent/40"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function FilterChips({
  options,
  active,
  onChange,
  disabled,
}: {
  options: string[] | { value: string; label: string }[];
  active: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const normalized = (options as any[]).map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  return (
    <div className={`flex flex-wrap gap-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {normalized.map(o => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            active === o.value
              ? 'bg-ems-accent-dim text-ems-accent border border-ems-accent/30'
              : 'bg-elevated text-text-secondary border border-border hover:bg-hover'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max, color = 'bg-ems-accent' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SelectInput({ options, value, onChange, placeholder }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-elevated border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FormField({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  /** Show “(Optional)” — use for fields not yet persisted to the database */
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-secondary">
        {label}
        {required && <span className="text-ems-coral ml-0.5">*</span>}
        {optional && (
          <span className="text-text-muted font-normal ml-1">(Optional)</span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-ems-coral">{error}</p>}
    </div>
  );
}

export function ActionMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 168;
    const rowHeight = 36;
    const menuHeight = items.length * rowHeight + 12;
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 6;
    }
    if (top < 8) top = 8;
    setCoords({ top, left });
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menu =
    open &&
    coords &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[300] min-w-[160px] rounded-md border border-border bg-elevated py-1 shadow-lg"
        style={{ top: coords.top, left: coords.left }}
        role="menu"
      >
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              setOpen(false);
            }}
            className={`flex w-full px-3 py-1.5 text-left text-sm hover:bg-hover ${
              item.danger ? 'text-ems-coral' : 'text-text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>,
      document.body,
    );

  return (
    <div className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded px-1 text-text-muted hover:bg-hover hover:text-text-secondary"
      >
        ⋮
      </button>
      {menu}
    </div>
  );
}
