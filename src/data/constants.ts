export const DMAS = [
  { id: 'dma-01', name: 'New York', status: 'Active' },
  { id: 'dma-02', name: 'Los Angeles', status: 'Active' },
  { id: 'dma-03', name: 'Chicago', status: 'Active' },
  { id: 'dma-04', name: 'Dallas', status: 'Active' },
  { id: 'dma-05', name: 'Houston', status: 'Active' },
  { id: 'dma-06', name: 'Philadelphia', status: 'Active' },
  { id: 'dma-07', name: 'Miami', status: 'Active' },
  { id: 'dma-08', name: 'Atlanta', status: 'Active' },
  { id: 'dma-09', name: 'Seattle', status: 'Active' },
  { id: 'dma-10', name: 'Denver', status: 'Active' },
  { id: 'dma-11', name: 'Boston', status: 'Active' },
  { id: 'dma-12', name: 'San Francisco', status: 'Active' },
  { id: 'dma-13', name: 'Nashville', status: 'Active' },
  { id: 'dma-14', name: 'Tampa-St. Pete', status: 'Active' },
  { id: 'dma-15', name: 'Detroit', status: 'Active' },
];

export const USERS = [
  { id: 'usr-01', name: 'Tom Wallace', role: 'Management', email: 't.wallace@iae.com', lastLogin: 'Today' },
  { id: 'usr-02', name: 'Sarah Kim', role: 'Booker', email: 'sarah.kim@iae.com', lastLogin: '2h ago' },
  { id: 'usr-03', name: 'David Park', role: 'Booker', email: 'd.park@iae.com', lastLogin: 'Yesterday' },
  { id: 'usr-04', name: 'Marcus Thompson', role: 'WorkflowStaff', email: 'marcus.t@iae.com', lastLogin: '3h ago' },
  { id: 'usr-05', name: 'Jennifer Okafor', role: 'WorkflowStaff', email: 'j.okafor@iae.com', lastLogin: '1h ago' },
  { id: 'usr-06', name: 'Alex Rivera', role: 'WorkflowStaff', email: 'a.rivera@iae.com', lastLogin: 'Today' },
  { id: 'usr-07', name: 'David Park', role: 'WorkflowStaff', email: 'd.park@iae.com', lastLogin: '4h ago' },
  { id: 'usr-08', name: 'Priya Sharma', role: 'WorkflowStaff', email: 'p.sharma@iae.com', lastLogin: '4h ago' },
];

export const CURRENT_USER = USERS[0];

export interface VenueConfig {
  name: string;
  totalCap: number;
  seatedCap: number;
  gaCap: number;
  stageType: string;
  isDefault: boolean;
}

export interface VenueProfile {
  configurations: VenueConfig[];
  ageRestriction: string;
  curfew: string;
  loadInDocks: number;
  parking: number;
  inHouseAudio: boolean;
  inHouseLighting: boolean;
  exclusiveTicketingId?: string;
  houseAgencyId?: string;
}

export interface TicketingManagerRow {
  id: string;
  /** When set, name/email can sync from this contact */
  contactId?: string;
  displayName: string;
  phone: string;
  email: string;
}

export interface CompanyTicketing {
  seatingChartFiles: { id: string; name: string }[];
  ticketingSystem: string;
  venueWebsite: string;
  seatingType: string;
  managers: TicketingManagerRow[];
}

export interface Company {
  id: string;
  legalName: string;
  tradeName: string;
  types: string[];
  city: string;
  state: string;
  dmaIds: string[];
  serviceAreaDmaIds: string[];
  standing: string;
  status: string;
  venueProfile?: VenueProfile;
  /** Ticketing provider / venue ticketing configuration */
  ticketing?: CompanyTicketing;
  // Physical Address
  physicalStreet?: string;
  physicalCity?: string;
  physicalState?: string;
  physicalPostalCode?: string;
  physicalCountry?: string;
  // Mailing Address
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingPostalCode?: string;
  mailingCountry?: string;
}

export const COMPANIES: Company[] = [
  { id: 'co-01', legalName: 'United Center Entertainment LLC', tradeName: 'United Center',
    types: ['Venue'], city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'],
    standing: 'Master Agreement', status: 'Active',
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 20000, seatedCap: 18500, gaCap: 1500, stageType: 'End Stage', isDefault: true },
                                     { name: 'Half House', totalCap: 10000, seatedCap: 9200, gaCap: 800, stageType: 'End Stage', isDefault: false }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 6, parking: 4000,
      inHouseAudio: true, inHouseLighting: true, exclusiveTicketingId: 'co-09', houseAgencyId: 'co-12' } },
  { id: 'co-02', legalName: 'Madison Square Garden Sports Corp.', tradeName: 'Madison Square Garden',
    types: ['Venue'], city: 'New York', state: 'NY', dmaIds: ['dma-01'], serviceAreaDmaIds: ['dma-01'],
    standing: 'Preferred Vendor', status: 'Active',
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 20789, seatedCap: 19500, gaCap: 1289, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:30 PM', loadInDocks: 8, parking: 0,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-03', legalName: 'AEG Presents Arena Management LLC', tradeName: 'Crypto.com Arena',
    types: ['Venue'], city: 'Los Angeles', state: 'CA', dmaIds: ['dma-02'], serviceAreaDmaIds: ['dma-02'],
    standing: 'Preferred Vendor', status: 'Active',
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19068, seatedCap: 17500, gaCap: 1568, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 6, parking: 2800,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-04', legalName: 'Bridgestone Arena Operations LLC', tradeName: 'Bridgestone Arena',
    types: ['Venue'], city: 'Nashville', state: 'TN', dmaIds: ['dma-13'], serviceAreaDmaIds: ['dma-13'],
    standing: 'Master Agreement', status: 'Active',
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19500, seatedCap: 18000, gaCap: 1500, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 5, parking: 3500,
      inHouseAudio: true, inHouseLighting: false } },
  { id: 'co-05', legalName: 'Amalie Arena Group Inc.', tradeName: 'Amalie Arena',
    types: ['Venue'], city: 'Tampa', state: 'FL', dmaIds: ['dma-14'], serviceAreaDmaIds: ['dma-14'],
    standing: 'Deal by Deal', status: 'Active',
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19092, seatedCap: 17800, gaCap: 1292, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 4, parking: 2200,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-06', legalName: 'The Fillmore Detroit LLC', tradeName: 'The Fillmore Detroit',
    types: ['Venue'], city: 'Detroit', state: 'MI', dmaIds: ['dma-15'], serviceAreaDmaIds: ['dma-15'],
    standing: 'Preferred Vendor', status: 'Active',
    venueProfile: { configurations: [{ name: 'General Admission', totalCap: 2600, seatedCap: 400, gaCap: 2200, stageType: 'Proscenium', isDefault: true }],
      ageRestriction: '18+', curfew: '2:00 AM', loadInDocks: 2, parking: 800,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-07', legalName: 'Creative Ventures Agency Inc.', tradeName: 'Creative Ventures Agency',
    types: ['TalentAgency'], city: 'Beverly Hills', state: 'CA', dmaIds: [], serviceAreaDmaIds: [],
    standing: 'Master Agreement', status: 'Active' },
  { id: 'co-08', legalName: 'United Talent Partners LLC', tradeName: 'United Talent Partners',
    types: ['TalentAgency'], city: 'New York', state: 'NY', dmaIds: [], serviceAreaDmaIds: [],
    standing: 'Preferred Vendor', status: 'Active' },
  { id: 'co-09', legalName: 'TicketFlow Inc.', tradeName: 'TicketFlow',
    types: ['Ticketing'], city: 'Nashville', state: 'TN', dmaIds: [], serviceAreaDmaIds: [],
    standing: 'Master Agreement', status: 'Active',
    ticketing: {
      seatingChartFiles: [],
      ticketingSystem: 'Ticketmaster',
      venueWebsite: 'https://www.ticketflow.example',
      seatingType: 'Mixed',
      managers: [
        { id: 'tm-09-1', contactId: 'ct-15', displayName: 'Alicia Moran', phone: '(615) 555-0166', email: 'a.moran@ticketflow.com' },
      ],
    } },
  { id: 'co-10', legalName: 'IATSE Local 2 Chicago', tradeName: 'IATSE Local 2',
    types: ['Labor'], city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'],
    standing: 'Master Agreement', status: 'Active' },
  { id: 'co-11', legalName: 'Pacific Stagecraft LLC', tradeName: 'Pacific Stagecraft',
    types: ['Labor'], city: 'Los Angeles', state: 'CA', dmaIds: ['dma-02'], serviceAreaDmaIds: ['dma-02'],
    standing: 'Preferred Vendor', status: 'Active' },
  { id: 'co-12', legalName: 'Momentum Live Media Inc.', tradeName: 'Momentum Live Media',
    types: ['AdAgency'], city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'],
    standing: 'Preferred Vendor', status: 'Active' },
];

export interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  title: string;
  roles: string[];
  email: string;
  phone: string;
  status: string;
  // New fields
  department?: string;
  cellPhone?: string;
  workEmail?: string;
  workPhone?: string;
}

export const CONTACTS: Contact[] = [
  { id: 'ct-01', companyId: 'co-01', firstName: 'Ray', lastName: 'Kowalski', title: 'Box Office Manager', roles: ['BoxOffice', 'Settlement'], email: 'r.kowalski@uc.com', phone: '(312) 555-0188', status: 'Active' },
  { id: 'ct-02', companyId: 'co-01', firstName: 'Brenda', lastName: 'Cole', title: 'House Production Manager', roles: ['ProductionManager'], email: 'b.cole@uc.com', phone: '(312) 555-0122', status: 'Active' },
  { id: 'ct-03', companyId: 'co-01', firstName: 'Tyler', lastName: 'Marsh', title: 'Marketing Director', roles: ['Marketing'], email: 't.marsh@uc.com', phone: '(312) 555-0109', status: 'Active' },
  { id: 'ct-04', companyId: 'co-07', firstName: 'Marcus', lastName: 'Gold', title: 'Senior Agent', roles: ['Booking'], email: 'm.gold@creativeventures.com', phone: '(310) 555-0142', status: 'Active' },
  { id: 'ct-05', companyId: 'co-07', firstName: 'Lisa', lastName: 'Chen', title: 'Agent', roles: ['Booking'], email: 'l.chen@creativeventures.com', phone: '(310) 555-0165', status: 'Active' },
  { id: 'ct-06', companyId: 'co-08', firstName: 'Derek', lastName: 'Sullivan', title: 'VP Agent', roles: ['Booking'], email: 'd.sullivan@utp.com', phone: '(212) 555-0177', status: 'Active' },
  { id: 'ct-07', companyId: 'co-08', firstName: 'Nina', lastName: 'Vasquez', title: 'Agent', roles: ['Booking'], email: 'n.vasquez@utp.com', phone: '(212) 555-0133', status: 'Active' },
  { id: 'ct-08', companyId: 'co-07', firstName: 'Jake', lastName: 'Morrison', title: 'Tour Manager', roles: ['Other'], email: 'jake.m@cv.com', phone: '(213) 555-0191', status: 'Active' },
  { id: 'ct-09', companyId: 'co-07', firstName: 'Dana', lastName: 'Rosario', title: 'Production Manager', roles: ['ProductionManager'], email: 'd.rosario@tour.com', phone: '(213) 555-0104', status: 'Active' },
  { id: 'ct-10', companyId: 'co-07', firstName: 'Wei', lastName: 'Chen', title: 'Tour Accountant', roles: ['Settlement'], email: 'w.chen@tour.com', phone: '(213) 555-0133', status: 'Active' },
  { id: 'ct-11', companyId: 'co-07', firstName: 'Lena', lastName: 'Park', title: 'Publicist', roles: ['Marketing'], email: 'l.park@parkpr.com', phone: '(310) 555-0177', status: 'Active' },
  { id: 'ct-12', companyId: 'co-04', firstName: 'Carl', lastName: 'Hughes', title: 'Box Office Director', roles: ['BoxOffice'], email: 'c.hughes@bridgestone.com', phone: '(615) 555-0144', status: 'Active' },
  { id: 'ct-13', companyId: 'co-04', firstName: 'Sarah', lastName: 'Nolan', title: 'Production Manager', roles: ['ProductionManager'], email: 's.nolan@bridgestone.com', phone: '(615) 555-0128', status: 'Active' },
  { id: 'ct-14', companyId: 'co-02', firstName: 'James', lastName: 'Ferraro', title: 'VP Booking', roles: ['Booking', 'BoxOffice'], email: 'j.ferraro@msg.com', phone: '(212) 555-0199', status: 'Active' },
  { id: 'ct-15', companyId: 'co-09', firstName: 'Alicia', lastName: 'Moran', title: 'Account Manager', roles: ['BoxOffice'], email: 'a.moran@ticketflow.com', phone: '(615) 555-0166', status: 'Active' },
  { id: 'ct-16', companyId: 'co-06', firstName: 'Damon', lastName: 'Pierce', title: 'General Manager', roles: ['Booking', 'BoxOffice'], email: 'd.pierce@fillmoredetroit.com', phone: '(313) 555-0155', status: 'Active' },
];

export interface Attraction {
  id: string;
  name: string;
  genres: string[];
  marketTier: string;
  agencyId: string;
  primaryAgentContactId: string;
  iaeStatus: string;
  ownerId: string;
}

export const ATTRACTIONS: Attraction[] = [
  { id: 'atr-01', name: 'Stella Vance', genres: ['Pop', 'R&B'], marketTier: 'Arena', agencyId: 'co-07', primaryAgentContactId: 'ct-04', iaeStatus: 'Active', ownerId: 'usr-02' },
  { id: 'atr-02', name: 'Iron Meridian', genres: ['Rock', 'Alternative'], marketTier: 'Arena', agencyId: 'co-08', primaryAgentContactId: 'ct-06', iaeStatus: 'Active', ownerId: 'usr-03' },
  { id: 'atr-03', name: 'Cleo & The Current', genres: ['Pop', 'Indie'], marketTier: 'Theater', agencyId: 'co-07', primaryAgentContactId: 'ct-05', iaeStatus: 'Active', ownerId: 'usr-02' },
  { id: 'atr-04', name: 'Marcus Fontaine', genres: ['Comedy'], marketTier: 'Theater', agencyId: 'co-08', primaryAgentContactId: 'ct-07', iaeStatus: 'Active', ownerId: 'usr-02' },
  { id: 'atr-05', name: 'Aurora Rising', genres: ['Electronic', 'Pop'], marketTier: 'Arena', agencyId: 'co-07', primaryAgentContactId: 'ct-04', iaeStatus: 'Prospective', ownerId: 'usr-03' },
  { id: 'atr-06', name: 'The Blackwood Collective', genres: ['Country', 'Americana'], marketTier: 'Arena', agencyId: 'co-08', primaryAgentContactId: 'ct-06', iaeStatus: 'Active', ownerId: 'usr-03' },
];

export interface TourContact {
  contactId: string;
  role: string;
}

export interface Tour {
  id: string;
  attractionId: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  dmaIds: string[];
  dealType: string;
  guarantee: number | null;
  splitPct: number | null;
  breakeven: number | null;
  radiusMiles: number;
  radiusDays: number;
  stageWidth: number | null;
  stageDepth: number | null;
  riggingLoad: number | null;
  trucks: number | null;
  crew: number | null;
  technicalRider: string;
  hospitalityRider: string;
  dressingRooms: number | null;
  contacts?: TourContact[];
}

export const TOURS: Tour[] = [
  { id: 'tour-01', attractionId: 'atr-01', name: 'Afterglow World Tour', status: 'ActiveRouting',
    startDate: '2025-01-15', endDate: '2025-12-15', dmaIds: ['dma-01','dma-02','dma-03','dma-04','dma-07','dma-09','dma-10','dma-11'],
    dealType: 'GuaranteeVsSplit', guarantee: 175000, splitPct: 85, breakeven: 320000,
    radiusMiles: 90, radiusDays: 30, stageWidth: 60, stageDepth: 40, riggingLoad: 40000, trucks: 8, crew: 42,
    technicalRider: 'Stage 60W×40D. Touring PA required, no house system. Touring lighting rig required. 400A 3-phase power. 6 loading docks minimum.',
    hospitalityRider: '4 dressing rooms. 1 private artist suite. Hot catering for 50. 20 hotel rooms 3-star min.',
    dressingRooms: 4,
    contacts: [{ contactId: 'ct-08', role: 'TourManager' }, { contactId: 'ct-09', role: 'ProductionManager' }, { contactId: 'ct-10', role: 'TourAccountant' }, { contactId: 'ct-11', role: 'Publicist' }] },
  { id: 'tour-02', attractionId: 'atr-01', name: 'Afterglow: The Residency', status: 'ActiveRouting',
    startDate: '2025-03-01', endDate: '2025-06-30', dmaIds: ['dma-12'],
    dealType: 'FlatFee', guarantee: 220000, splitPct: null, breakeven: null,
    radiusMiles: 0, radiusDays: 0, stageWidth: 60, stageDepth: 40, riggingLoad: 40000, trucks: 8, crew: 42,
    technicalRider: 'Same as Afterglow World Tour.', hospitalityRider: 'Same as Afterglow World Tour.', dressingRooms: 4 },
  { id: 'tour-03', attractionId: 'atr-02', name: 'Fault Lines Tour', status: 'ActiveRouting',
    startDate: '2025-02-01', endDate: '2025-11-30', dmaIds: ['dma-01','dma-02','dma-03','dma-06','dma-11'],
    dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
    radiusMiles: 75, radiusDays: 21, stageWidth: 48, stageDepth: 32, riggingLoad: 30000, trucks: 6, crew: 35,
    technicalRider: 'Stage 48W×32D. Touring PA required. House lighting acceptable. 200A single-phase.',
    hospitalityRider: '3 dressing rooms. Hot meal for 40.', dressingRooms: 3,
    contacts: [{ contactId: 'ct-06', role: 'TourManager' }] },
  { id: 'tour-04', attractionId: 'atr-02', name: 'Acoustic Sessions', status: 'Announced',
    startDate: '2025-09-01', endDate: '2025-12-15', dmaIds: ['dma-01','dma-03','dma-11'],
    dealType: 'FlatFee', guarantee: 45000, splitPct: null, breakeven: null,
    radiusMiles: 50, radiusDays: 14, stageWidth: 24, stageDepth: 20, riggingLoad: 5000, trucks: 2, crew: 12,
    technicalRider: 'Minimal production. House PA acceptable.', hospitalityRider: '2 dressing rooms.', dressingRooms: 2 },
  { id: 'tour-05', attractionId: 'atr-03', name: 'Electric Spring Tour', status: 'ActiveRouting',
    startDate: '2025-04-01', endDate: '2025-08-31', dmaIds: ['dma-03','dma-15','dma-07','dma-08'],
    dealType: 'GuaranteeVsSplit', guarantee: 35000, splitPct: 80, breakeven: 85000,
    radiusMiles: 60, radiusDays: 14, stageWidth: 32, stageDepth: 24, riggingLoad: 12000, trucks: 3, crew: 18,
    technicalRider: 'Theater-scale production. House PA acceptable.', hospitalityRider: '2 dressing rooms. Catering for 22.', dressingRooms: 2 },
  { id: 'tour-06', attractionId: 'atr-04', name: 'Oversharing Tour', status: 'ActiveRouting',
    startDate: '2025-01-01', endDate: '2025-12-31', dmaIds: ['dma-01','dma-02','dma-03','dma-04','dma-05','dma-06','dma-07','dma-08','dma-09','dma-10','dma-11','dma-12','dma-13','dma-14','dma-15'],
    dealType: 'FlatFee', guarantee: 28000, splitPct: null, breakeven: null,
    radiusMiles: 30, radiusDays: 7, stageWidth: 20, stageDepth: 16, riggingLoad: 3000, trucks: 1, crew: 8,
    technicalRider: 'Minimal. Stool, mic, basic lighting. House PA required.', hospitalityRider: '1 dressing room. Rider: 6-pack IPA, cheese plate.', dressingRooms: 1 },
  { id: 'tour-07', attractionId: 'atr-06', name: 'Heartland Highway', status: 'ActiveRouting',
    startDate: '2025-03-15', endDate: '2025-10-31', dmaIds: ['dma-04','dma-05','dma-08','dma-13','dma-14'],
    dealType: 'GuaranteeVsSplit', guarantee: 130000, splitPct: 85, breakeven: 260000,
    radiusMiles: 100, radiusDays: 28, stageWidth: 52, stageDepth: 36, riggingLoad: 35000, trucks: 7, crew: 38,
    technicalRider: 'Country-scale production. Full touring rig. Steel guitar, fiddle monitors required.',
    hospitalityRider: '4 dressing rooms. Southern catering for 45.', dressingRooms: 4,
    contacts: [{ contactId: 'ct-07', role: 'TourManager' }] },
  { id: 'tour-08', attractionId: 'atr-05', name: 'Neon Drift', status: 'Announced',
    startDate: '2025-06-01', endDate: '2025-12-31', dmaIds: ['dma-02','dma-09','dma-12'],
    dealType: 'GuaranteeVsSplit', guarantee: null, splitPct: null, breakeven: null,
    radiusMiles: 90, radiusDays: 21, stageWidth: null, stageDepth: null, riggingLoad: null, trucks: null, crew: null,
    technicalRider: 'TBD — advance pending.', hospitalityRider: 'TBD.', dressingRooms: null },
];

export interface Offer {
  id: string;
  venueId: string;
  configName: string;
  proposedDates: string[];
  showTime: string;
  dealType: string;
  guarantee: number;
  splitPct: number | null;
  breakeven: number | null;
  marketingCoOp: number;
  status: string;
  submittedAt?: string;
  responseAt?: string | null;
  responseNotes?: string;
  engagementId?: string;
}

export interface Project {
  id: string;
  name: string;
  tourId: string;
  bookerId: string;
  agentContactId: string;
  dmaIds: string[];
  status: string;
  targetOnSale: string | null;
  notes: string;
  createdAt: string;
  offers: Offer[];
}

export const PROJECTS_INIT: Project[] = [
  { id: 'prj-01', name: 'Stella Vance Midwest Fall', tourId: 'tour-01', bookerId: 'usr-02',
    agentContactId: 'ct-04', dmaIds: ['dma-03', 'dma-15'], status: 'PartiallyBooked',
    targetOnSale: '2025-10-01', notes: 'Priority market. Aiming for back-to-back nights if possible.',
    createdAt: '2025-04-08',
    offers: [
      { id: 'ofr-01', venueId: 'co-01', configName: 'Full House', proposedDates: ['2025-10-14'],
        showTime: '20:00', dealType: 'GuaranteeVsSplit', guarantee: 175000, splitPct: 85, breakeven: 320000,
        marketingCoOp: 12000, status: 'Accepted', submittedAt: '2025-04-12', responseAt: '2025-04-15',
        responseNotes: 'Accepted. Great market, excited to be at the UC.', engagementId: 'eng-01' },
      { id: 'ofr-02', venueId: 'co-04', configName: 'Full House', proposedDates: ['2025-11-08'],
        showTime: '20:00', dealType: 'GuaranteeVsSplit', guarantee: 175000, splitPct: 85, breakeven: 320000,
        marketingCoOp: 10000, status: 'Submitted', submittedAt: '2025-04-12', responseAt: null, responseNotes: '' },
    ]
  },
  { id: 'prj-02', name: 'Iron Meridian East Coast Swing', tourId: 'tour-03', bookerId: 'usr-03',
    agentContactId: 'ct-06', dmaIds: ['dma-01', 'dma-06', 'dma-11'], status: 'OffersSent',
    targetOnSale: '2025-08-15', notes: 'Target 3 markets in sequence. MSG first priority.',
    createdAt: '2025-04-20',
    offers: [
      { id: 'ofr-03', venueId: 'co-02', configName: 'Full House', proposedDates: ['2025-09-20'],
        showTime: '20:00', dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
        marketingCoOp: 15000, status: 'Submitted', submittedAt: '2025-04-22' },
      { id: 'ofr-04', venueId: 'co-02', configName: 'Full House', proposedDates: ['2025-10-03'],
        showTime: '20:00', dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
        marketingCoOp: 15000, status: 'Submitted', submittedAt: '2025-04-22' },
      { id: 'ofr-05', venueId: 'co-03', configName: 'Full House', proposedDates: ['2025-11-01'],
        showTime: '20:00', dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
        marketingCoOp: 12000, status: 'Submitted', submittedAt: '2025-04-22' },
    ]
  },
  { id: 'prj-03', name: 'Blackwood Collective Southern Run', tourId: 'tour-07', bookerId: 'usr-04',
    agentContactId: 'ct-07', dmaIds: ['dma-13', 'dma-14', 'dma-08'], status: 'Active',
    targetOnSale: '2025-06-01', notes: 'Strong country markets. Nashville hometown show potential.',
    createdAt: '2025-04-25',
    offers: [
      { id: 'ofr-06', venueId: 'co-04', configName: 'Full House', proposedDates: ['2025-08-22'],
        showTime: '19:30', dealType: 'GuaranteeVsSplit', guarantee: 130000, splitPct: 85, breakeven: 260000,
        marketingCoOp: 10000, status: 'Draft' },
      { id: 'ofr-07', venueId: 'co-05', configName: 'Full House', proposedDates: ['2025-08-25'],
        showTime: '19:30', dealType: 'GuaranteeVsSplit', guarantee: 130000, splitPct: 85, breakeven: 260000,
        marketingCoOp: 8000, status: 'Draft' },
    ]
  },
  { id: 'prj-04', name: 'Cleo Theater Spring Chicago + Detroit', tourId: 'tour-05', bookerId: 'usr-05',
    agentContactId: 'ct-05', dmaIds: ['dma-03', 'dma-15'], status: 'FullyBooked',
    targetOnSale: '2025-03-01', notes: 'Both markets confirmed.',
    createdAt: '2025-02-10',
    offers: [
      { id: 'ofr-08', venueId: 'co-06', configName: 'General Admission', proposedDates: ['2025-05-03'],
        showTime: '20:00', dealType: 'GuaranteeVsSplit', guarantee: 35000, splitPct: 80, breakeven: 85000,
        marketingCoOp: 4000, status: 'Accepted', submittedAt: '2025-02-14', responseAt: '2025-02-20', engagementId: 'eng-04' },
    ]
  },
  { id: 'prj-05', name: 'Marcus Fontaine Comedy Chicago', tourId: 'tour-06', bookerId: 'usr-02',
    agentContactId: 'ct-07', dmaIds: ['dma-03'], status: 'Active',
    targetOnSale: '2025-05-15', notes: 'Small room. Targeting Fillmore or metro area clubs.',
    createdAt: '2025-04-30',
    offers: []
  },
  { id: 'prj-06', name: 'Aurora Rising West Coast Intro', tourId: 'tour-08', bookerId: 'usr-03',
    agentContactId: 'ct-04', dmaIds: ['dma-02', 'dma-09', 'dma-12'], status: 'Active',
    targetOnSale: null, notes: 'Tour still being announced. Monitoring for routing confirmation.',
    createdAt: '2025-05-01',
    offers: []
  },
];

export interface WorkflowStatus {
  status: string;
  assigneeId: string;
  notes: string;
  milestonesComplete: number;
  milestonesTotal: number;
}

export interface ShowDate {
  date: string;
  doorTime: string;
  showTime: string;
  runtime: number;
}

export interface Engagement {
  id: string;
  name: string;
  tourId: string;
  venueId: string;
  configName: string;
  bookerId: string;
  projectId: string;
  offerId: string | null;
  showDates: ShowDate[];
  showCount: number;
  status: string;
  dealType: string;
  guarantee: number;
  splitPct: number | null;
  breakeven: number | null;
  projectedGross: number;
  projectedMargin: number;
  actualGross: number | null;
  actualMargin: number | null;
  cancellationReason?: string;
  cancellationDate?: string;
  cancellingParty?: string;
  workflows: {
    marketing: WorkflowStatus;
    production: WorkflowStatus;
    eventBusiness: WorkflowStatus;
    creative: WorkflowStatus;
    sales: WorkflowStatus;
    finance: WorkflowStatus;
  };
}

/** Daily ticket sales logged against an engagement (attraction / venue / city come from the engagement). */
export interface DailySaleEntry {
  id: string;
  engagementId: string;
  /** ISO date YYYY-MM-DD */
  saleDate: string;
  ticketsSold: number;
  totalRevenue: number;
  notes?: string;
}

export const ENGAGEMENTS_INIT: Engagement[] = [
  { id: 'eng-01', name: 'Stella Vance — Afterglow World Tour @ United Center',
    tourId: 'tour-01', venueId: 'co-01', configName: 'Full House', bookerId: 'usr-02',
    projectId: 'prj-01', offerId: 'ofr-01',
    showDates: [{ date: '2025-10-14', doorTime: '19:00', showTime: '20:00', runtime: 120 }],
    showCount: 1, status: 'OnSale',
    dealType: 'GuaranteeVsSplit', guarantee: 175000, splitPct: 85, breakeven: 320000,
    projectedGross: 620000, projectedMargin: 123800,
    actualGross: 598500, actualMargin: 95490,
    workflows: {
      marketing:     { status: 'InProgress', assigneeId: 'usr-02', notes: '', milestonesComplete: 2, milestonesTotal: 5 },
      production:    { status: 'InProgress', assigneeId: 'usr-04', notes: '', milestonesComplete: 4, milestonesTotal: 6 },
      eventBusiness: { status: 'NeedsAttention', assigneeId: 'usr-05', notes: 'Contract pending countersignature', milestonesComplete: 3, milestonesTotal: 6 },
      creative:      { status: 'Complete', assigneeId: 'usr-06', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      sales:         { status: 'InProgress', assigneeId: 'usr-07', notes: '', milestonesComplete: 2, milestonesTotal: 4 },
      finance:       { status: 'InProgress', assigneeId: 'usr-08', notes: '', milestonesComplete: 1, milestonesTotal: 5 },
    }
  },
  { id: 'eng-02', name: 'Stella Vance — Afterglow World Tour @ Bridgestone Arena',
    tourId: 'tour-01', venueId: 'co-04', configName: 'Full House', bookerId: 'usr-02',
    projectId: 'prj-01', offerId: 'ofr-02',
    showDates: [{ date: '2025-11-08', doorTime: '19:00', showTime: '20:00', runtime: 120 }],
    showCount: 1, status: 'Confirmed',
    dealType: 'GuaranteeVsSplit', guarantee: 175000, splitPct: 85, breakeven: 320000,
    projectedGross: 580000, projectedMargin: 110000,
    actualGross: null, actualMargin: null,
    workflows: {
      marketing:     { status: 'InProgress', assigneeId: 'usr-02', notes: '', milestonesComplete: 1, milestonesTotal: 5 },
      production:    { status: 'InProgress', assigneeId: 'usr-04', notes: '', milestonesComplete: 2, milestonesTotal: 6 },
      eventBusiness: { status: 'InProgress', assigneeId: 'usr-05', notes: '', milestonesComplete: 2, milestonesTotal: 6 },
      creative:      { status: 'InProgress', assigneeId: 'usr-06', notes: '', milestonesComplete: 1, milestonesTotal: 5 },
      sales:         { status: 'NotStarted', assigneeId: 'usr-07', notes: '', milestonesComplete: 0, milestonesTotal: 4 },
      finance:       { status: 'NotStarted', assigneeId: 'usr-08', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
    }
  },
  { id: 'eng-03', name: 'Iron Meridian — Fault Lines Tour @ Madison Square Garden',
    tourId: 'tour-03', venueId: 'co-02', configName: 'Full House', bookerId: 'usr-03',
    projectId: 'prj-02', offerId: 'ofr-03',
    showDates: [{ date: '2025-09-20', doorTime: '19:00', showTime: '20:00', runtime: 110 }],
    showCount: 1, status: 'Settled',
    dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
    projectedGross: 880000, projectedMargin: 180000,
    actualGross: 892000, actualMargin: 191000,
    workflows: {
      marketing:     { status: 'Complete', assigneeId: 'usr-02', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      production:    { status: 'Complete', assigneeId: 'usr-04', notes: '', milestonesComplete: 6, milestonesTotal: 6 },
      eventBusiness: { status: 'Complete', assigneeId: 'usr-05', notes: '', milestonesComplete: 6, milestonesTotal: 6 },
      creative:      { status: 'Complete', assigneeId: 'usr-06', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      sales:         { status: 'Complete', assigneeId: 'usr-07', notes: '', milestonesComplete: 4, milestonesTotal: 4 },
      finance:       { status: 'Complete', assigneeId: 'usr-08', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
    }
  },
  { id: 'eng-04', name: 'Cleo & The Current — Electric Spring Tour @ The Fillmore Detroit',
    tourId: 'tour-05', venueId: 'co-06', configName: 'General Admission', bookerId: 'usr-05',
    projectId: 'prj-04', offerId: 'ofr-08',
    showDates: [{ date: '2025-05-03', doorTime: '19:00', showTime: '20:00', runtime: 90 }],
    showCount: 1, status: 'Closed',
    dealType: 'GuaranteeVsSplit', guarantee: 35000, splitPct: 80, breakeven: 85000,
    projectedGross: 205000, projectedMargin: 38000,
    actualGross: 198000, actualMargin: 34000,
    workflows: {
      marketing:     { status: 'Complete', assigneeId: 'usr-02', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      production:    { status: 'Complete', assigneeId: 'usr-04', notes: '', milestonesComplete: 6, milestonesTotal: 6 },
      eventBusiness: { status: 'Complete', assigneeId: 'usr-05', notes: '', milestonesComplete: 6, milestonesTotal: 6 },
      creative:      { status: 'Complete', assigneeId: 'usr-06', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      sales:         { status: 'Complete', assigneeId: 'usr-07', notes: '', milestonesComplete: 4, milestonesTotal: 4 },
      finance:       { status: 'Complete', assigneeId: 'usr-08', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
    }
  },
  { id: 'eng-05', name: 'The Blackwood Collective — Heartland Highway @ Bridgestone Arena',
    tourId: 'tour-07', venueId: 'co-04', configName: 'Full House', bookerId: 'usr-04',
    projectId: 'prj-03', offerId: 'ofr-06',
    showDates: [{ date: '2025-08-22', doorTime: '18:30', showTime: '19:30', runtime: 150 }],
    showCount: 1, status: 'Confirmed',
    dealType: 'GuaranteeVsSplit', guarantee: 130000, splitPct: 85, breakeven: 260000,
    projectedGross: 510000, projectedMargin: 95000,
    actualGross: null, actualMargin: null,
    workflows: {
      marketing:     { status: 'InProgress', assigneeId: 'usr-02', notes: '', milestonesComplete: 2, milestonesTotal: 5 },
      production:    { status: 'InProgress', assigneeId: 'usr-04', notes: '', milestonesComplete: 3, milestonesTotal: 6 },
      eventBusiness: { status: 'InProgress', assigneeId: 'usr-05', notes: '', milestonesComplete: 2, milestonesTotal: 6 },
      creative:      { status: 'NeedsAttention', assigneeId: 'usr-06', notes: 'Artwork not received yet', milestonesComplete: 0, milestonesTotal: 5 },
      sales:         { status: 'NotStarted', assigneeId: 'usr-07', notes: '', milestonesComplete: 0, milestonesTotal: 4 },
      finance:       { status: 'NotStarted', assigneeId: 'usr-08', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
    }
  },
  { id: 'eng-06', name: 'Marcus Fontaine — Oversharing Tour @ The Fillmore Detroit',
    tourId: 'tour-06', venueId: 'co-06', configName: 'General Admission', bookerId: 'usr-02',
    projectId: 'prj-05', offerId: null,
    showDates: [{ date: '2025-07-12', doorTime: '19:00', showTime: '20:00', runtime: 105 }],
    showCount: 1, status: 'OnSale',
    dealType: 'FlatFee', guarantee: 28000, splitPct: null, breakeven: null,
    projectedGross: 112000, projectedMargin: 22000,
    actualGross: null, actualMargin: null,
    workflows: {
      marketing:     { status: 'InProgress', assigneeId: 'usr-02', notes: '', milestonesComplete: 2, milestonesTotal: 5 },
      production:    { status: 'Complete', assigneeId: 'usr-04', notes: '', milestonesComplete: 6, milestonesTotal: 6 },
      eventBusiness: { status: 'InProgress', assigneeId: 'usr-05', notes: '', milestonesComplete: 4, milestonesTotal: 6 },
      creative:      { status: 'Complete', assigneeId: 'usr-06', notes: '', milestonesComplete: 5, milestonesTotal: 5 },
      sales:         { status: 'InProgress', assigneeId: 'usr-07', notes: '', milestonesComplete: 2, milestonesTotal: 4 },
      finance:       { status: 'NotStarted', assigneeId: 'usr-08', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
    }
  },
  { id: 'eng-07', name: 'Iron Meridian — Fault Lines Tour @ Crypto.com Arena',
    tourId: 'tour-03', venueId: 'co-03', configName: 'Full House', bookerId: 'usr-03',
    projectId: 'prj-02', offerId: 'ofr-05',
    showDates: [{ date: '2025-11-01', doorTime: '19:00', showTime: '20:00', runtime: 110 }],
    showCount: 1, status: 'Draft',
    dealType: 'Guarantee', guarantee: 95000, splitPct: null, breakeven: null,
    projectedGross: 710000, projectedMargin: 145000,
    actualGross: null, actualMargin: null,
    workflows: {
      marketing:     { status: 'NotStarted', assigneeId: 'usr-02', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
      production:    { status: 'NotStarted', assigneeId: 'usr-04', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
      eventBusiness: { status: 'NotStarted', assigneeId: 'usr-05', notes: '', milestonesComplete: 0, milestonesTotal: 6 },
      creative:      { status: 'NotStarted', assigneeId: 'usr-06', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
      sales:         { status: 'NotStarted', assigneeId: 'usr-07', notes: '', milestonesComplete: 0, milestonesTotal: 4 },
      finance:       { status: 'NotStarted', assigneeId: 'usr-08', notes: '', milestonesComplete: 0, milestonesTotal: 5 },
    }
  },
  { id: 'eng-08', name: 'Cleo & The Current — Electric Spring Tour @ United Center',
    tourId: 'tour-05', venueId: 'co-01', configName: 'Full House', bookerId: 'usr-02',
    projectId: 'prj-04', offerId: null,
    showDates: [{ date: '2025-06-07', doorTime: '19:00', showTime: '20:00', runtime: 90 }],
    showCount: 1, status: 'Cancelled',
    cancellationReason: 'Artist illness requiring extended recovery. Force majeure declared.',
    cancellationDate: '2025-04-15', cancellingParty: 'Attraction',
    dealType: 'GuaranteeVsSplit', guarantee: 35000, splitPct: 80, breakeven: 85000,
    projectedGross: 420000, projectedMargin: 78000,
    actualGross: null, actualMargin: null,
    workflows: {
      marketing:     { status: 'Cancelled', assigneeId: 'usr-02', notes: 'All campaigns halted', milestonesComplete: 2, milestonesTotal: 5 },
      production:    { status: 'Cancelled', assigneeId: 'usr-04', notes: '', milestonesComplete: 1, milestonesTotal: 6 },
      eventBusiness: { status: 'Cancelled', assigneeId: 'usr-05', notes: 'Refunds processing', milestonesComplete: 3, milestonesTotal: 6 },
      creative:      { status: 'Cancelled', assigneeId: 'usr-06', notes: '', milestonesComplete: 3, milestonesTotal: 5 },
      sales:         { status: 'Cancelled', assigneeId: 'usr-07', notes: '', milestonesComplete: 2, milestonesTotal: 4 },
      finance:       { status: 'Cancelled', assigneeId: 'usr-08', notes: 'Insurance claim filed', milestonesComplete: 1, milestonesTotal: 5 },
    }
  },
];

export const DAILY_SALES_INIT: DailySaleEntry[] = [
  { id: 'ds-01', engagementId: 'eng-01', saleDate: '2025-10-05', ticketsSold: 1091, totalRevenue: 72363, notes: 'Weekend push' },
  { id: 'ds-02', engagementId: 'eng-03', saleDate: '2025-09-20', ticketsSold: 4200, totalRevenue: 312000 },
  { id: 'ds-03', engagementId: 'eng-06', saleDate: '2025-07-01', ticketsSold: 856, totalRevenue: 44880 },
];

// Postal code to DMA mapping utility
export function getDmaFromPostalCode(postalCode: string): string | null {
  if (!postalCode || postalCode.length < 3) return null;
  
  const code = postalCode.substring(0, 3).toLowerCase();
  
  // Simplified ZIP code to DMA mapping (first 3 digits)
  const zipToDmaMap: Record<string, string> = {
    // New York (100-119, 070)
    '070': 'dma-01', '100': 'dma-01', '101': 'dma-01', '102': 'dma-01', '103': 'dma-01', '104': 'dma-01',
    '105': 'dma-01', '106': 'dma-01', '107': 'dma-01', '108': 'dma-01', '109': 'dma-01',
    '110': 'dma-01', '111': 'dma-01', '112': 'dma-01', '113': 'dma-01', '114': 'dma-01',
    '115': 'dma-01', '116': 'dma-01', '117': 'dma-01', '118': 'dma-01', '119': 'dma-01',
    
    // Los Angeles (900-909)
    '900': 'dma-02', '901': 'dma-02', '902': 'dma-02', '903': 'dma-02', '904': 'dma-02',
    '905': 'dma-02', '906': 'dma-02', '907': 'dma-02', '908': 'dma-02', '909': 'dma-02',
    
    // Chicago (600-609)
    '600': 'dma-03', '601': 'dma-03', '602': 'dma-03', '603': 'dma-03', '604': 'dma-03',
    '605': 'dma-03', '606': 'dma-03', '607': 'dma-03', '608': 'dma-03', '609': 'dma-03',
    
    // Dallas (750-759)
    '750': 'dma-04', '751': 'dma-04', '752': 'dma-04', '753': 'dma-04', '754': 'dma-04',
    '755': 'dma-04', '756': 'dma-04', '757': 'dma-04', '758': 'dma-04', '759': 'dma-04',
    
    // Houston (770-779)
    '770': 'dma-05', '771': 'dma-05', '772': 'dma-05', '773': 'dma-05', '774': 'dma-05',
    '775': 'dma-05', '776': 'dma-05', '777': 'dma-05', '778': 'dma-05', '779': 'dma-05',
    
    // Philadelphia (190-199)
    '190': 'dma-06', '191': 'dma-06', '192': 'dma-06', '193': 'dma-06', '194': 'dma-06',
    '195': 'dma-06', '196': 'dma-06', '197': 'dma-06', '198': 'dma-06', '199': 'dma-06',
    
    // Miami (330-339)
    '330': 'dma-07', '331': 'dma-07', '332': 'dma-07', '333': 'dma-07', '334': 'dma-07',
    '335': 'dma-07', '336': 'dma-07', '337': 'dma-07', '338': 'dma-07', '339': 'dma-07',
    
    // Atlanta (300-309)
    '300': 'dma-08', '301': 'dma-08', '302': 'dma-08', '303': 'dma-08', '304': 'dma-08',
    '305': 'dma-08', '306': 'dma-08', '307': 'dma-08', '308': 'dma-08', '309': 'dma-08',
    
    // Seattle (980-989)
    '980': 'dma-09', '981': 'dma-09', '982': 'dma-09', '983': 'dma-09', '984': 'dma-09',
    '985': 'dma-09', '986': 'dma-09', '987': 'dma-09', '988': 'dma-09', '989': 'dma-09',
    
    // Denver (800-809)
    '800': 'dma-10', '801': 'dma-10', '802': 'dma-10', '803': 'dma-10', '804': 'dma-10',
    '805': 'dma-10', '806': 'dma-10', '807': 'dma-10', '808': 'dma-10', '809': 'dma-10',
    
    // Boston (020-029)
    '020': 'dma-11', '021': 'dma-11', '022': 'dma-11', '023': 'dma-11', '024': 'dma-11',
    '025': 'dma-11', '026': 'dma-11', '027': 'dma-11', '028': 'dma-11', '029': 'dma-11',
    
    // San Francisco (940-949)
    '940': 'dma-12', '941': 'dma-12', '942': 'dma-12', '943': 'dma-12', '944': 'dma-12',
    '945': 'dma-12', '946': 'dma-12', '947': 'dma-12', '948': 'dma-12', '949': 'dma-12',
    
    // Nashville (370-379)
    '370': 'dma-13', '371': 'dma-13', '372': 'dma-13', '373': 'dma-13', '374': 'dma-13',
    '375': 'dma-13', '376': 'dma-13', '377': 'dma-13', '378': 'dma-13', '379': 'dma-13',
    
    // Tampa-St. Pete (330-339) - same as Miami for simplicity
    // Seattle (980-989) already mapped
    
    // Detroit (480-489)
    '480': 'dma-15', '481': 'dma-15', '482': 'dma-15', '483': 'dma-15', '484': 'dma-15',
    '485': 'dma-15', '486': 'dma-15', '487': 'dma-15', '488': 'dma-15', '489': 'dma-15',
  };
  
  return zipToDmaMap[code] || null;
}

// Helper functions
export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getStatusColor(status: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    Draft: { bg: 'bg-elevated', text: 'text-text-secondary' },
    Confirmed: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
    OnSale: { bg: 'bg-ems-blue-dim', text: 'text-ems-blue' },
    Settled: { bg: 'bg-ems-accent-dim', text: 'text-ems-accent' },
    Closed: { bg: 'bg-elevated', text: 'text-text-muted' },
    Cancelled: { bg: 'bg-ems-coral-dim', text: 'text-ems-coral' },
    Active: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
    ActiveRouting: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
    Announced: { bg: 'bg-ems-blue-dim', text: 'text-ems-blue' },
    OffersSent: { bg: 'bg-ems-blue-dim', text: 'text-ems-blue' },
    PartiallyBooked: { bg: 'bg-ems-amber-dim', text: 'text-ems-amber' },
    FullyBooked: { bg: 'bg-ems-accent-dim', text: 'text-ems-accent' },
    Dead: { bg: 'bg-ems-coral-dim', text: 'text-ems-coral' },
    NeedsAttention: { bg: 'bg-ems-amber-dim', text: 'text-ems-amber' },
    InProgress: { bg: 'bg-ems-blue-dim', text: 'text-ems-blue' },
    Complete: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
    NotStarted: { bg: 'bg-elevated', text: 'text-text-muted' },
    Prospective: { bg: 'bg-ems-purple-dim', text: 'text-ems-purple' },
    Submitted: { bg: 'bg-ems-blue-dim', text: 'text-ems-blue' },
    Accepted: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
    Declined: { bg: 'bg-ems-coral-dim', text: 'text-ems-coral' },
    Countered: { bg: 'bg-ems-amber-dim', text: 'text-ems-amber' },
  };
  return map[status] || { bg: 'bg-elevated', text: 'text-text-secondary' };
}

export function getWorkflowDotColor(status: string): string {
  const map: Record<string, string> = {
    NotStarted: 'bg-text-muted',
    InProgress: 'bg-ems-blue',
    NeedsAttention: 'bg-ems-amber',
    Complete: 'bg-ems-green',
    Cancelled: 'bg-ems-coral',
  };
  return map[status] || 'bg-text-muted';
}
