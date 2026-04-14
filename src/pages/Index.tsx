import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar, Header } from '@/components/ems/Layout';
import { ToastContainer } from '@/components/ems/Primitives';
import { CompaniesPage } from '@/components/ems/CompaniesPage';
import { AttractionToursPage } from '@/components/ems/AttractionToursPage';
import { CalendarPage } from '@/components/ems/CalendarPage';
import { ProjectsPage, ProjectDetailPage } from '@/components/ems/ProjectsPage';
import { EngagementsPage } from '@/components/ems/EngagementsPage';
import { EngagementDetailPage, LegacyEngagementDetailPage } from '@/components/ems/EngagementDetailPage';
import { SettingsPage } from '@/components/ems/SettingsPage';
import { PROJECTS_INIT, ENGAGEMENTS_INIT, DAILY_SALES_INIT, TOURS, ATTRACTIONS, COMPANIES, CONTACTS, USERS, DMAS } from '@/data/constants';
import type { ToastItem } from '@/components/ems/Primitives';
import type { Project, Engagement, Offer, Company, Contact, Attraction, Tour, DailySaleEntry } from '@/data/constants';
import { DailySalesPage } from '@/components/ems/DailySalesPage';
import { fetchEngagements, mapApiEngagementToLegacy } from '@/api/engagementApi';

const Index = () => {
  const [currentView, setCurrentView] = useState('companies');
  const [viewData, setViewData] = useState<any>({});
  const [projects, setProjects] = useState<Project[]>(PROJECTS_INIT);
  const [companies, setCompanies] = useState<Company[]>(COMPANIES);
  const [contacts, setContacts] = useState<Contact[]>(CONTACTS);
  const [attractions, setAttractions] = useState<Attraction[]>(ATTRACTIONS);
  const [tours, setTours] = useState<Tour[]>(TOURS);
  const [users, setUsers] = useState(USERS);
  const [dmas, setDmas] = useState(DMAS);
  const [dailySales, setDailySales] = useState<DailySaleEntry[]>(DAILY_SALES_INIT);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const engagementsQuery = useQuery({
    queryKey: ['engagements'],
    queryFn: fetchEngagements,
  });

  /** Engagements created from the Projects prototype (local IDs only). */
  const [projectEngagements, setProjectEngagements] = useState<Engagement[]>([]);

  const engagements = useMemo(() => {
    const apiRows = (engagementsQuery.data ?? []).map(mapApiEngagementToLegacy);
    const byId = new Map<string, Engagement>();
    for (const e of apiRows) byId.set(e.id, e);
    for (const e of projectEngagements) byId.set(e.id, e);
    for (const e of ENGAGEMENTS_INIT) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
    return Array.from(byId.values());
  }, [engagementsQuery.data, projectEngagements]);

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
    const tour = tours.find(t => t.id === project.tourId);
    const attr = tour ? attractions.find(a => a.id === tour.attractionId) : null;
    const venue = companies.find(c => c.id === offer.venueId);
    const id = `eng-${Date.now().toString().slice(-4)}`;
    const newEng: Engagement = {
      id, name: `${attr?.name} — ${tour?.name} @ ${venue?.name}`,
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
    setProjectEngagements(prev => [newEng, ...prev]);
    return id;
  }, [attractions, companies, tours]);

  const deleteProject = useCallback((projectId: string) => {
    const toDelete = engagements.filter(e => e.projectId === projectId).map(e => e.id);
    setProjectEngagements(prev => prev.filter(e => e.projectId !== projectId));
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (toDelete.length > 0) addToast(`Deleted project and ${toDelete.length} linked engagement(s)`, 'warning');
  }, [addToast, engagements]);

  const getBreadcrumb = () => {
    const map: Record<string, string[]> = {
      companies: ['Companies'],
      'attraction-tours': ['Attraction-Tours'],
      calendar: ['Calendar'],
      projects: ['Projects'],
      'project-detail': ['Projects', projects.find(p => p.id === viewData.projectId)?.name || 'Detail'],
      engagements: ['Engagements'],
      'daily-sales': ['Daily Sales'],
      'engagement-detail': [
        'Engagements',
        viewData.engagementId != null
          ? `#${viewData.engagementId}`
          : 'Detail',
      ],
      settings: ['Settings'],
    };
    return map[currentView] || ['Companies'];
  };

  const sidebarView = ['project-detail', 'engagement-detail'].includes(currentView) ? currentView.split('-')[0] + 's' : currentView;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentView={sidebarView} onNavigate={navigate} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="lg:ml-60 min-h-screen">
        <Header breadcrumb={getBreadcrumb()} onMenuToggle={() => setMobileSidebarOpen(prev => !prev)} />
        <main className="p-4 lg:p-6">
          {currentView === 'companies' && (
            <CompaniesPage addToast={addToast} />
          )}
          {currentView === 'attraction-tours' && <AttractionToursPage addToast={addToast} />}
          {currentView === 'calendar' && <CalendarPage engagements={engagements} onNavigate={navigate} addToast={addToast} />}
          {currentView === 'projects' && (
            <ProjectsPage
              projects={projects}
              engagements={engagements}
              tours={tours}
              attractions={attractions}
              companies={companies}
              contacts={contacts}
              dmas={dmas}
              users={users}
              onNavigate={navigate}
              addToast={addToast}
              onCreateEngagement={createEngagement}
              onUpdateProjects={setProjects}
              onDeleteProject={deleteProject}
            />
          )}
          {currentView === 'project-detail' && (() => {
            const project = projects.find(p => p.id === viewData.projectId);
            return project ? (
              <ProjectDetailPage
                project={project}
                projects={projects}
                engagements={engagements}
                tours={tours}
                attractions={attractions}
                companies={companies}
                contacts={contacts}
                dmas={dmas}
                users={users}
                onNavigate={navigate}
                addToast={addToast}
                onCreateEngagement={createEngagement}
                onUpdateProjects={setProjects}
              />
            ) : <div className="text-text-muted">Project not found</div>;
          })()}
          {currentView === 'engagements' && (
            <EngagementsPage
              onNavigate={navigate}
              statusFilter={viewData.statusFilter}
              addToast={addToast}
            />
          )}
          {currentView === 'daily-sales' && (
            <DailySalesPage
              dailySales={dailySales}
              onUpdateDailySales={setDailySales}
              engagements={engagements}
              tours={tours}
              attractions={attractions}
              companies={companies}
              onNavigate={navigate}
              addToast={addToast}
            />
          )}
          {currentView === 'engagement-detail' && (() => {
            const raw = viewData.engagementId;
            const s = raw != null ? String(raw) : '';
            const n = Number(s);
            const isNumericApiId = s !== '' && Number.isFinite(n) && String(n) === s;
            if (isNumericApiId) {
              return (
                <EngagementDetailPage engagementId={n} onNavigate={navigate} addToast={addToast} />
              );
            }
            const legacy = engagements.find((e) => e.id === s);
            if (legacy) {
              return <LegacyEngagementDetailPage engagement={legacy} onNavigate={navigate} />;
            }
            return <div className="text-text-muted">Engagement not found</div>;
          })()}
          {currentView === 'settings' && <SettingsPage addToast={addToast} users={users} dmas={dmas} onUpdateUsers={setUsers} onUpdateDmas={setDmas} />}
        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default Index;
