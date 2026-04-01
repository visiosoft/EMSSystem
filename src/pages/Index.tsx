import React, { useState, useCallback } from 'react';
import { Sidebar, Header } from '@/components/ems/Layout';
import { ToastContainer } from '@/components/ems/Primitives';
import { DashboardPage } from '@/components/ems/DashboardPage';
import { CompaniesPage } from '@/components/ems/CompaniesPage';
import { AttractionToursPage } from '@/components/ems/AttractionToursPage';
import { CalendarPage } from '@/components/ems/CalendarPage';
import { ProjectsPage, ProjectDetailPage } from '@/components/ems/ProjectsPage';
import { EngagementsPage } from '@/components/ems/EngagementsPage';
import { EngagementDetailPage } from '@/components/ems/EngagementDetailPage';
import { AnalyticsPage } from '@/components/ems/AnalyticsPage';
import { SettingsPage } from '@/components/ems/SettingsPage';
import { PROJECTS_INIT, ENGAGEMENTS_INIT, TOURS, ATTRACTIONS, COMPANIES } from '@/data/constants';
import type { ToastItem } from '@/components/ems/Primitives';
import type { Project, Engagement, Offer } from '@/data/constants';

const Index = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewData, setViewData] = useState<any>({});
  const [projects, setProjects] = useState<Project[]>(PROJECTS_INIT);
  const [engagements, setEngagements] = useState<Engagement[]>(ENGAGEMENTS_INIT);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const navigate = useCallback((view: string, data?: any) => {
    setCurrentView(view);
    setViewData(data || {});
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info', action?: { label: string; onClick: () => void }) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, action }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const createEngagement = useCallback((offer: Offer, project: Project): string => {
    const tour = TOURS.find(t => t.id === project.tourId);
    const attr = tour ? ATTRACTIONS.find(a => a.id === tour.attractionId) : null;
    const venue = COMPANIES.find(c => c.id === offer.venueId);
    const id = `eng-${Date.now().toString().slice(-4)}`;
    const newEng: Engagement = {
      id, name: `${attr?.name} — ${tour?.name} @ ${venue?.tradeName}`,
      tourId: project.tourId, venueId: offer.venueId, configName: offer.configName, bookerId: project.bookerId,
      projectId: project.id, offerId: offer.id,
      showDates: [{ date: offer.proposedDates[0], doorTime: '19:00', showTime: offer.showTime, runtime: 120 }],
      showCount: 1, status: 'Draft',
      dealType: offer.dealType, guarantee: offer.guarantee, splitPct: offer.splitPct, breakeven: offer.breakeven,
      projectedGross: 0, projectedMargin: 0, actualGross: null, actualMargin: null,
      workflows: {
        marketing: { status: 'NotStarted', assigneeId: 'usr-02', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
        production: { status: 'NotStarted', assigneeId: 'usr-04', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
        eventBusiness: { status: 'NotStarted', assigneeId: 'usr-05', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
        creative: { status: 'NotStarted', assigneeId: 'usr-06', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
        sales: { status: 'NotStarted', assigneeId: 'usr-07', notes: '', milestonesComplete: 0, milestonesTotal: 4 },
        finance: { status: 'NotStarted', assigneeId: 'usr-08', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
      },
    };
    setEngagements(prev => [...prev, newEng]);
    return id;
  }, []);

  const updateEngagement = useCallback((eng: Engagement) => {
    setEngagements(prev => prev.map(e => e.id === eng.id ? eng : e));
  }, []);

  const getBreadcrumb = () => {
    const map: Record<string, string[]> = {
      dashboard: ['Dashboard'],
      companies: ['Companies'],
      'attraction-tours': ['Attraction-Tours'],
      calendar: ['Calendar'],
      projects: ['Projects'],
      'project-detail': ['Projects', projects.find(p => p.id === viewData.projectId)?.name || 'Detail'],
      engagements: ['Engagements'],
      'engagement-detail': ['Engagements', engagements.find(e => e.id === viewData.engagementId)?.id?.toUpperCase() || 'Detail'],
      analytics: ['Analytics'],
      settings: ['Settings'],
    };
    return map[currentView] || ['Dashboard'];
  };

  const sidebarView = ['project-detail', 'engagement-detail'].includes(currentView) ? currentView.split('-')[0] + 's' : currentView;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentView={sidebarView} onNavigate={navigate} />
      <div className="ml-60">
        <Header breadcrumb={getBreadcrumb()} />
        <main className="p-6">
          {currentView === 'dashboard' && <DashboardPage engagements={engagements} onNavigate={navigate} />}
          {currentView === 'companies' && <CompaniesPage onNavigate={navigate} addToast={addToast} />}
          {currentView === 'attraction-tours' && <AttractionToursPage onNavigate={navigate} addToast={addToast} />}
          {currentView === 'calendar' && <CalendarPage engagements={engagements} onNavigate={navigate} addToast={addToast} />}
          {currentView === 'projects' && <ProjectsPage projects={projects} engagements={engagements} onNavigate={navigate} addToast={addToast} onCreateEngagement={createEngagement} onUpdateProjects={setProjects} />}
          {currentView === 'project-detail' && (() => {
            const project = projects.find(p => p.id === viewData.projectId);
            return project ? <ProjectDetailPage project={project} projects={projects} engagements={engagements} onNavigate={navigate} addToast={addToast} onCreateEngagement={createEngagement} onUpdateProjects={setProjects} /> : <div className="text-text-muted">Project not found</div>;
          })()}
          {currentView === 'engagements' && <EngagementsPage engagements={engagements} onNavigate={navigate} statusFilter={viewData.statusFilter} />}
          {currentView === 'engagement-detail' && (() => {
            const eng = engagements.find(e => e.id === viewData.engagementId);
            return eng ? <EngagementDetailPage engagement={eng} engagements={engagements} onNavigate={navigate} addToast={addToast} onUpdateEngagement={updateEngagement} /> : <div className="text-text-muted">Engagement not found</div>;
          })()}
          {currentView === 'analytics' && <AnalyticsPage />}
          {currentView === 'settings' && <SettingsPage addToast={addToast} />}
        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default Index;
