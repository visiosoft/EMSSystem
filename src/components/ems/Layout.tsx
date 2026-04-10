import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Avatar } from './Primitives';
import { CURRENT_USER } from '@/data/constants';

/* ─── IAE Logo Component ─────────────────────────────────────────────── */

function IaeLogo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div className="rounded bg-elevated animate-pulse" style={{ width: 48, height: 24 }} />;
  }

  const isDark = resolvedTheme !== 'light';

  return (
    <div
      style={{
        width: 48,
        height: 24,
        borderRadius: 4,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/iae_logo.png"
        alt="IAE Logo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: 4,
          filter: isDark ? 'none' : 'invert(1)',
          mixBlendMode: isDark ? 'screen' : 'multiply',
          transition: 'filter 0.25s ease',
        }}
      />
    </div>
  );
}

/* ─── Full-size logo for header / splash use ─────────────────────────── */

export function IaeLogoFull({ height = 28 }: { height?: number }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isDark = resolvedTheme !== 'light';

  return (
    <img
      src="/iae_logo.png"
      alt="IAE"
      style={{
        height,
        width: 'auto',
        objectFit: 'contain',
        filter: isDark ? 'none' : 'invert(1)',
        mixBlendMode: isDark ? 'screen' : 'multiply',
        transition: 'filter 0.25s ease',
      }}
    />
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────── */

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV_SECTIONS = [
  // OVERVIEW section hidden — Dashboard disabled
  // { label: 'OVERVIEW', items: [{ key: 'dashboard', label: 'Dashboard', icon: '◆' }] },
  { label: 'PRIMARY DATA', items: [
    { key: 'companies', label: 'Companies', icon: '⬡' },
    { key: 'attraction-tours', label: 'Attraction-Tours', icon: '⬡' },
    { key: 'calendar', label: 'Calendar', icon: '⬡' },
  ] },
  { label: 'OPERATIONS', items: [
    { key: 'projects', label: 'Projects', icon: '⬡' },
    { key: 'engagements', label: 'Engagements', icon: '⬡' },
    { key: 'daily-sales', label: 'Daily Sales', icon: '⬡' },
  ] },
  // REPORTS section hidden — Analytics disabled
  // { label: 'REPORTS', items: [{ key: 'analytics', label: 'Analytics', icon: '⬡' }] },
  { label: 'SYSTEM', items: [{ key: 'settings', label: 'Settings', icon: '⬡' }] },
];

export function Sidebar({ currentView, onNavigate, mobileOpen, onMobileClose }: SidebarProps) {
  const handleNav = (key: string) => {
    onNavigate(key);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <div className={`w-60 h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-40 transition-transform duration-200 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo + Brand */}
        <div className="h-14 flex items-center px-4 border-b border-border gap-2">
          <IaeLogo />
          <div className="flex flex-col leading-tight">
            <span className="text-text-primary font-semibold text-sm tracking-wide">IAE</span>
            <span className="text-text-muted text-[10px] tracking-widest uppercase font-medium">Event Flow</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-1">
              <div className="px-4 py-2 text-[10px] font-semibold text-text-muted tracking-wider uppercase">{section.label}</div>
              {section.items.map(item => {
                const isActive = currentView === item.key || (item.key === 'dashboard' && currentView === 'dashboard');
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-ems-accent-dim text-ems-accent border-l-[3px] border-l-ems-accent'
                        : 'text-text-secondary hover:bg-hover hover:text-text-primary border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <span className="text-xs">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Avatar name={CURRENT_USER.name} size="sm" />
            <div>
              <div className="text-xs text-text-primary font-medium">{CURRENT_USER.name}</div>
              <div className="text-[10px] text-text-muted">{CURRENT_USER.role}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Animated Theme Toggle ─────────────────────────────────────────── */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div
        className="rounded-full bg-elevated border border-border"
        style={{ width: 52, height: 26 }}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme !== 'light';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 52,
        height: 26,
        borderRadius: 13,
        border: 'none',
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        backgroundColor: isDark ? 'hsl(223 35% 19%)' : 'hsl(208 75% 76%)',
        transition: 'background-color 0.4s ease',
        flexShrink: 0,
      }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--ems-accent) / 0.4)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {isDark && (
        <>
          <span style={{ position:'absolute', top:5, left:6, width:2, height:2, borderRadius:'50%', background:'rgba(255,255,255,0.65)', pointerEvents:'none' }} />
          <span style={{ position:'absolute', top:14, left:10, width:1.5, height:1.5, borderRadius:'50%', background:'rgba(255,255,255,0.45)', pointerEvents:'none' }} />
          <span style={{ position:'absolute', top:8, left:14, width:1.5, height:1.5, borderRadius:'50%', background:'rgba(255,255,255,0.55)', pointerEvents:'none' }} />
        </>
      )}
      {!isDark && (
        <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:9, height:9, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.7)', pointerEvents:'none' }} />
      )}
      <span
        className="theme-toggle-thumb"
        style={{
          position: 'absolute',
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isDark ? 'translateX(27px)' : 'translateX(2px)',
          backgroundColor: isDark ? 'hsl(228 40% 28%)' : '#ffffff',
          boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.18)',
        }}
      >
        {isDark ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#93b8f5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e08800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="4"/>
            <line x1="12" y1="20" x2="12" y2="22"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="2" y1="12" x2="4" y2="12"/>
            <line x1="20" y1="12" x2="22" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        )}
      </span>
    </button>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

interface HeaderProps {
  breadcrumb: string[];
  onSearch?: (q: string) => void;
  onMenuToggle?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Header({ breadcrumb, onMenuToggle }: HeaderProps) {
  const greeting = getGreeting();

  return (
    <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger menu - visible on mobile/tablet only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-hover text-text-secondary hover:text-text-primary transition-colors shrink-0"
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-1 text-sm truncate">
          {breadcrumb.map((b, i) => (
            <span key={i} className={i === breadcrumb.length - 1 ? 'text-text-primary font-medium truncate' : 'text-text-muted hidden sm:inline'}>
              {i > 0 && <span className="text-text-muted mx-1 hidden sm:inline">/</span>}
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right hidden md:block">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">{greeting},</span>
            <span className="text-sm font-semibold text-text-primary">Tom 👋</span>
          </div>
          <div className="text-[11px] text-text-muted leading-none mt-0.5">
            Have a great day ahead
          </div>
        </div>
        <ThemeToggle />
        <div className="w-8 h-8 rounded-full bg-ems-accent-dim border border-ems-accent/30 flex items-center justify-center text-ems-accent text-xs font-bold select-none">
          TW
        </div>
      </div>
    </div>
  );
}
