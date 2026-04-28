import React, { useState, useCallback } from 'react';
import { Sidebar, Header } from '@/components/ems/Layout';
import { ToastContainer } from '@/components/ems/Primitives';
import { CompaniesPage } from '@/components/ems/CompaniesPage';
import { AttractionToursPage } from '@/components/ems/AttractionToursPage';
import { CalendarPage } from '@/components/ems/CalendarPage';
import { ProjectsPage, ProjectDetailPage } from '@/components/ems/ProjectsPage';
import { EngagementsPage } from '@/components/ems/EngagementsPage';
import { EngagementDetailPage } from '@/components/ems/EngagementDetailPage';
import { SettingsPage } from '@/components/ems/SettingsPage';
import { DailySalesPage } from '@/components/ems/DailySalesPage';
import { USERS } from '@/data/constants';
import type { ToastItem } from '@/components/ems/Primitives';

const Index = () => {
  const [currentView, setCurrentView] = useState('projects');
  const [viewData, setViewData] = useState<Record<string, unknown>>({});
  const [users, setUsers] = useState(USERS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navigate = useCallback((view: string, data?: Record<string, unknown>) => {
    setCurrentView(view);
    setViewData(data ?? {});
  }, []);

  const addToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    action?: { label: string; onClick: () => void },
  ) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, action }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const getBreadcrumb = (): string[] => {
    const map: Record<string, string[]> = {
      companies:          ['Companies'],
      'attraction-tours': ['Attraction Tours'],
      calendar:           ['Calendar'],
      projects:           ['Projects'],
      'project-detail':   ['Projects', 'Project detail'],
      engagements:        ['Engagements'],
      'daily-sales':      ['Daily Sales'],
      'engagement-detail': ['Engagements', 'Engagement detail'],
      settings:           ['Settings'],
    };
    return map[currentView] ?? ['Projects'];
  };

  const sidebarView = ['project-detail', 'engagement-detail'].includes(currentView)
    ? currentView.split('-')[0] + 's'
    : currentView;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentView={sidebarView} onNavigate={navigate} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="lg:ml-60 min-h-screen">
        <Header breadcrumb={getBreadcrumb()} onMenuToggle={() => setMobileSidebarOpen(prev => !prev)} />
        <main className="p-4 lg:p-6">

          {currentView === 'companies' && <CompaniesPage addToast={addToast} />}

          {currentView === 'attraction-tours' && <AttractionToursPage addToast={addToast} />}

          {currentView === 'calendar' && <CalendarPage onNavigate={navigate} addToast={addToast} />}

          {currentView === 'projects' && (
            <ProjectsPage onNavigate={navigate} addToast={addToast} />
          )}

          {currentView === 'project-detail' && (
            <ProjectDetailPage onNavigate={navigate} addToast={addToast} />
          )}

          {currentView === 'engagements' && (
            <EngagementsPage
              onNavigate={navigate}
              statusFilter={viewData.statusFilter as string | undefined}
              addToast={addToast}
            />
          )}

          {currentView === 'daily-sales' && (
            <DailySalesPage onNavigate={navigate} addToast={addToast} />
          )}

          {currentView === 'engagement-detail' && (() => {
            const raw = viewData.engagementId;
            const s = raw != null ? String(raw) : '';
            const n = Number(s);
            const isNumericApiId = s !== '' && Number.isFinite(n) && String(n) === s;
            if (isNumericApiId) {
              return <EngagementDetailPage engagementId={n} onNavigate={navigate} addToast={addToast} />;
            }
            return <div className="text-text-muted text-sm">Engagement not found</div>;
          })()}

          {currentView === 'settings' && (
            <SettingsPage addToast={addToast} users={users} onUpdateUsers={setUsers} />
          )}

        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default Index;
