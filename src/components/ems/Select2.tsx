import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface Select2Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Select2Props {
  options: Select2Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function Select2({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  allowClear = false,
}: Select2Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
      setHighlightedIndex(filtered.findIndex(o => o.value === value));
    }
  }, [open]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        onChange(filtered[highlightedIndex].value);
        setOpen(false);
        setSearch('');
      }
    }
  }, [open, filtered, highlightedIndex, onChange]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setSearch('');
  };

  const [dropUp, setDropUp] = useState(false);
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220 && rect.top > 220);
    }
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`select2 relative ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        className={[
          'select2-selection',
          'w-full flex items-center justify-between',
          'bg-surface border border-border rounded px-3 py-1.5',
          'text-sm text-left transition-colors',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-ems-accent/60',
          open ? 'border-ems-accent ring-1 ring-ems-accent/30' : '',
        ].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          className="select2-arrow ml-2 flex-shrink-0 text-text-muted transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 10 }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className={[
            'select2-dropdown',
            'absolute z-[200] w-full',
            'bg-elevated border border-border rounded-md shadow-xl',
            'overflow-hidden',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          ].join(' ')}
          style={{ minWidth: '100%' }}
        >
          <div className="select2-search p-2 border-b border-border">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs select-none">⌕</span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setHighlightedIndex(0); }}
                placeholder="Search..."
                className={[
                  'select2-search__field',
                  'w-full pl-7 pr-3 py-1.5',
                  'bg-surface border border-border rounded text-sm',
                  'text-text-primary placeholder:text-text-muted',
                  'focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/30',
                ].join(' ')}
              />
            </div>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            className="select2-results max-h-48 overflow-y-auto py-1"
          >
            {allowClear && (
              <li
                role="option"
                aria-selected={value === ''}
                onClick={() => handleSelect('')}
                className={[
                  'select2-results__option',
                  'px-3 py-2 text-sm cursor-pointer transition-colors',
                  'text-text-muted italic',
                  value === '' ? 'bg-ems-accent-dim text-ems-accent' : 'hover:bg-hover',
                ].join(' ')}
              >
                {placeholder}
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="select2-results__option px-3 py-2 text-sm text-text-muted text-center">
                No results found
              </li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={[
                    'select2-results__option',
                    'px-3 py-2 text-sm transition-colors select-none',
                    opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                    opt.value === value
                      ? 'select2-results__option--selected bg-ems-accent-dim text-ems-accent font-medium'
                      : idx === highlightedIndex
                      ? 'select2-results__option--highlighted bg-hover text-text-primary'
                      : 'text-text-primary hover:bg-hover',
                  ].filter(Boolean).join(' ')}
                >
                  {opt.value === value && (
                    <span className="mr-1.5 text-ems-accent text-xs">✓</span>
                  )}
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function toOptions(items: string[]): Select2Option[] {
  return items.map(v => ({ value: v, label: v }));
}

export function toObjOptions<T extends { id: string }>(
  items: T[],
  labelFn: (item: T) => string
): Select2Option[] {
  return items.map(item => ({ value: item.id, label: labelFn(item) }));
}

interface Select2MultiProps {
  options: Select2Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function Select2Multi({
  options,
  values,
  onChange,
  placeholder = 'Select...',
  className = '',
}: Select2MultiProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };

  const summary = values.length === 0
    ? placeholder
    : values.map(v => options.find(o => o.value === v)?.label || v).join(', ');

  const [dropUp, setDropUp] = useState(false);
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220 && rect.top > 220);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`select2 relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={[
          'select2-selection',
          'w-full flex items-center justify-between gap-2',
          'bg-surface border border-border rounded px-3 py-1.5',
          'text-sm text-left transition-colors',
          'cursor-pointer hover:border-ems-accent/60',
          open ? 'border-ems-accent ring-1 ring-ems-accent/30' : '',
        ].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`min-w-0 flex-1 truncate ${values.length === 0 ? 'text-text-muted' : 'text-text-primary'}`}>
          {summary}
        </span>
        <span
          className="select2-arrow ml-2 flex-shrink-0 text-text-muted transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 10 }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className={[
            'select2-dropdown',
            'absolute z-[200] w-full',
            'bg-elevated border border-border rounded-md shadow-xl',
            'overflow-hidden',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          ].join(' ')}
          style={{ minWidth: '100%' }}
        >
          <div className="select2-search p-2 border-b border-border">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs select-none">⌕</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className={[
                  'select2-search__field',
                  'w-full pl-7 pr-3 py-1.5',
                  'bg-surface border border-border rounded text-sm',
                  'text-text-primary placeholder:text-text-muted',
                  'focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/30',
                ].join(' ')}
              />
            </div>
          </div>

          <ul role="listbox" className="select2-results max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="select2-results__option px-3 py-2 text-sm text-text-muted text-center">
                No results found
              </li>
            ) : (
              filtered.map(opt => {
                const selected = values.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    onClick={() => !opt.disabled && toggle(opt.value)}
                    className={[
                      'select2-results__option',
                      'px-3 py-2 text-sm transition-colors select-none',
                      opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                      selected
                        ? 'bg-ems-accent-dim text-ems-accent font-medium'
                        : 'text-text-primary hover:bg-hover',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="mr-2 text-xs w-4 inline-block text-center">{selected ? '✓' : ''}</span>
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
