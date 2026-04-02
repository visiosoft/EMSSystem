import { Avatar } from './Primitives';
import { CURRENT_USER } from '@/data/constants';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const NAV_SECTIONS = [
  { label: 'OVERVIEW', items: [{ key: 'dashboard', label: 'Dashboard', icon: '◆' }] },
  { label: 'PRIMARY DATA', items: [
    { key: 'companies', label: 'Companies', icon: '⬡' },
    { key: 'attraction-tours', label: 'Attraction-Tours', icon: '⬡' },
    { key: 'calendar', label: 'Calendar', icon: '⬡' },
  ] },
  { label: 'OPERATIONS', items: [
    { key: 'projects', label: 'Projects', icon: '⬡' },
    { key: 'engagements', label: 'Engagements', icon: '⬡' },
  ] },
  { label: 'REPORTS', items: [{ key: 'analytics', label: 'Analytics', icon: '⬡' }] },
  { label: 'SYSTEM', items: [{ key: 'settings', label: 'Settings', icon: '⬡' }] },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <div className="w-60 h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-40">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="text-ems-accent text-lg mr-2">◈</span>
        <span className="text-text-primary font-semibold text-base">IAE EMS</span>
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
                  onClick={() => onNavigate(item.key)}
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
  );
}

interface HeaderProps {
  breadcrumb: string[];
  onSearch?: (q: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Header({ breadcrumb }: HeaderProps) {
  const greeting = getGreeting();

  return (
    <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumb.map((b, i) => (
          <span key={i} className={i === breadcrumb.length - 1 ? 'text-text-primary font-medium' : 'text-text-muted'}>
            {i > 0 && <span className="text-text-muted mx-1">/</span>}
            {b}
          </span>
        ))}
      </div>

      {/* Greeting */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">{greeting},</span>
            <span className="text-sm font-semibold text-text-primary">Tom 👋</span>
          </div>
          <div className="text-[11px] text-text-muted leading-none mt-0.5">
            Have a great day ahead
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-ems-accent-dim border border-ems-accent/30 flex items-center justify-center text-ems-accent text-xs font-bold select-none">
          TW
        </div>
      </div>
    </div>
  );
}
