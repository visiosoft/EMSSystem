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
  name: string;
  type: string;
  city: string;
  state: string;
  dmaIds: string[];
  serviceAreaDmaIds: string[];
  /** dbo.Company.CompanyTypeID when loaded from API */
  companyTypeId?: number;
  /** dbo.Company.DMAID when loaded from API */
  dmaId?: number;
  /** dbo.DMA.MarketName for the company's DMAID (display). */
  dmaMarketName?: string;
  venueProfile?: VenueProfile;
  ticketing?: CompanyTicketing;
  physicalStreet?: string;
  physicalCity?: string;
  physicalState?: string;
  physicalPostalCode?: string;
  physicalCountry?: string;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingPostalCode?: string;
  mailingCountry?: string;
}

export const COMPANIES: Company[] = [
  { id: 'co-01', name: 'United Center',
    type: 'Venue', city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'],
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 20000, seatedCap: 18500, gaCap: 1500, stageType: 'End Stage', isDefault: true },
                                     { name: 'Half House', totalCap: 10000, seatedCap: 9200, gaCap: 800, stageType: 'End Stage', isDefault: false }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 6, parking: 4000,
      inHouseAudio: true, inHouseLighting: true, exclusiveTicketingId: 'co-09', houseAgencyId: 'co-12' } },
  { id: 'co-02', name: 'Madison Square Garden',
    type: 'Venue', city: 'New York', state: 'NY', dmaIds: ['dma-01'], serviceAreaDmaIds: ['dma-01'],
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 20789, seatedCap: 19500, gaCap: 1289, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:30 PM', loadInDocks: 8, parking: 0,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-03', name: 'Crypto.com Arena',
    type: 'Venue', city: 'Los Angeles', state: 'CA', dmaIds: ['dma-02'], serviceAreaDmaIds: ['dma-02'],
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19068, seatedCap: 17500, gaCap: 1568, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 6, parking: 2800,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-04', name: 'Bridgestone Arena',
    type: 'Venue', city: 'Nashville', state: 'TN', dmaIds: ['dma-13'], serviceAreaDmaIds: ['dma-13'],
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19500, seatedCap: 18000, gaCap: 1500, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 5, parking: 3500,
      inHouseAudio: true, inHouseLighting: false } },
  { id: 'co-05', name: 'Amalie Arena',
    type: 'Venue', city: 'Tampa', state: 'FL', dmaIds: ['dma-14'], serviceAreaDmaIds: ['dma-14'],
    venueProfile: { configurations: [{ name: 'Full House', totalCap: 19092, seatedCap: 17800, gaCap: 1292, stageType: 'End Stage', isDefault: true }],
      ageRestriction: 'All Ages', curfew: '11:00 PM', loadInDocks: 4, parking: 2200,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-06', name: 'The Fillmore Detroit',
    type: 'Venue', city: 'Detroit', state: 'MI', dmaIds: ['dma-15'], serviceAreaDmaIds: ['dma-15'],
    venueProfile: { configurations: [{ name: 'General Admission', totalCap: 2600, seatedCap: 400, gaCap: 2200, stageType: 'Proscenium', isDefault: true }],
      ageRestriction: '18+', curfew: '2:00 AM', loadInDocks: 2, parking: 800,
      inHouseAudio: true, inHouseLighting: true } },
  { id: 'co-07', name: 'Creative Ventures Agency',
    type: 'TalentAgency', city: 'Beverly Hills', state: 'CA', dmaIds: [], serviceAreaDmaIds: [] },
  { id: 'co-08', name: 'United Talent Partners',
    type: 'TalentAgency', city: 'New York', state: 'NY', dmaIds: [], serviceAreaDmaIds: [] },
  { id: 'co-09', name: 'TicketFlow',
    type: 'Ticketing', city: 'Nashville', state: 'TN', dmaIds: [], serviceAreaDmaIds: [],
    ticketing: {
      seatingChartFiles: [],
      ticketingSystem: 'Ticketmaster',
      venueWebsite: 'https://www.ticketflow.example',
      seatingType: 'Mixed',
      managers: [
        { id: 'tm-09-1', contactId: 'ct-15', displayName: 'Alicia Moran', phone: '(615) 555-0166', email: 'a.moran@ticketflow.com' },
      ],
    } },
  { id: 'co-10', name: 'IATSE Local 2',
    type: 'Labor', city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'] },
  { id: 'co-11', name: 'Pacific Stagecraft',
    type: 'Labor', city: 'Los Angeles', state: 'CA', dmaIds: ['dma-02'], serviceAreaDmaIds: ['dma-02'] },
  { id: 'co-12', name: 'Momentum Live Media',
    type: 'AdAgency', city: 'Chicago', state: 'IL', dmaIds: ['dma-03'], serviceAreaDmaIds: ['dma-03'] },
];

export interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  roles: string[];
  email: string;
  phone: string;
  status: string;
  department?: string;
  cellPhone?: string;
  workEmail?: string;
  workPhone?: string;
  /** dbo.ContactAssignment.ContactAssignmentID */
  contactAssignmentId?: number;
  /** dbo.Contact.ContactID */
  contactId?: number;
  roleId?: number;
  departmentId?: number;
  departmentName?: string;
}

export const CONTACTS: Contact[] = [
  { id: 'ct-01', companyId: 'co-01', firstName: 'Ray', lastName: 'Kowalski', roles: ['BoxOffice', 'Settlement'], email: 'r.kowalski@uc.com', phone: '(312) 555-0188', status: 'Active' },
  { id: 'ct-02', companyId: 'co-01', firstName: 'Brenda', lastName: 'Cole', roles: ['ProductionManager'], email: 'b.cole@uc.com', phone: '(312) 555-0122', status: 'Active' },
  { id: 'ct-03', companyId: 'co-01', firstName: 'Tyler', lastName: 'Marsh', roles: ['Marketing'], email: 't.marsh@uc.com', phone: '(312) 555-0109', status: 'Active' },
  { id: 'ct-04', companyId: 'co-07', firstName: 'Marcus', lastName: 'Gold', roles: ['Booking'], email: 'm.gold@creativeventures.com', phone: '(310) 555-0142', status: 'Active' },
  { id: 'ct-05', companyId: 'co-07', firstName: 'Lisa', lastName: 'Chen', roles: ['Booking'], email: 'l.chen@creativeventures.com', phone: '(310) 555-0165', status: 'Active' },
  { id: 'ct-06', companyId: 'co-08', firstName: 'Derek', lastName: 'Sullivan', roles: ['Booking'], email: 'd.sullivan@utp.com', phone: '(212) 555-0177', status: 'Active' },
  { id: 'ct-07', companyId: 'co-08', firstName: 'Nina', lastName: 'Vasquez', roles: ['Booking'], email: 'n.vasquez@utp.com', phone: '(212) 555-0133', status: 'Active' },
  { id: 'ct-08', companyId: 'co-07', firstName: 'Jake', lastName: 'Morrison', roles: ['Other'], email: 'jake.m@cv.com', phone: '(213) 555-0191', status: 'Active' },
  { id: 'ct-09', companyId: 'co-07', firstName: 'Dana', lastName: 'Rosario', roles: ['ProductionManager'], email: 'd.rosario@tour.com', phone: '(213) 555-0104', status: 'Active' },
  { id: 'ct-10', companyId: 'co-07', firstName: 'Wei', lastName: 'Chen', roles: ['Settlement'], email: 'w.chen@tour.com', phone: '(213) 555-0133', status: 'Active' },
  { id: 'ct-11', companyId: 'co-07', firstName: 'Lena', lastName: 'Park', roles: ['Marketing'], email: 'l.park@parkpr.com', phone: '(310) 555-0177', status: 'Active' },
  { id: 'ct-12', companyId: 'co-04', firstName: 'Carl', lastName: 'Hughes', roles: ['BoxOffice'], email: 'c.hughes@bridgestone.com', phone: '(615) 555-0144', status: 'Active' },
  { id: 'ct-13', companyId: 'co-04', firstName: 'Sarah', lastName: 'Nolan', roles: ['ProductionManager'], email: 's.nolan@bridgestone.com', phone: '(615) 555-0128', status: 'Active' },
  { id: 'ct-14', companyId: 'co-02', firstName: 'James', lastName: 'Ferraro', roles: ['Booking', 'BoxOffice'], email: 'j.ferraro@msg.com', phone: '(212) 555-0199', status: 'Active' },
  { id: 'ct-15', companyId: 'co-09', firstName: 'Alicia', lastName: 'Moran', roles: ['BoxOffice'], email: 'a.moran@ticketflow.com', phone: '(615) 555-0166', status: 'Active' },
  { id: 'ct-16', companyId: 'co-06', firstName: 'Damon', lastName: 'Pierce', roles: ['Booking', 'BoxOffice'], email: 'd.pierce@fillmoredetroit.com', phone: '(313) 555-0155', status: 'Active' },
];

/** Values for attraction genre multi-select and tour-type picklists */
export const GENRE_OPTIONS = [
  'Pop', 'R&B', 'Rock', 'Alternative', 'Comedy', 'Electronic', 'Indie', 'Country', 'Americana',
  'Hip-Hop', 'Jazz', 'Latin', 'Folk', 'Metal', 'Soul', 'Blues', 'Classical',
];

export const DEAL_TYPE_OPTIONS = [
  { value: 'Guarantee', label: 'Guarantee' },
  { value: 'GuaranteeVsSplit', label: 'Guarantee vs Split' },
  { value: 'FlatFee', label: 'Flat Fee' },
];

export const TOUR_TYPE_OR_GENRE_OPTIONS = [
  { value: 'World Tour', label: 'World Tour' },
  { value: 'Regional Tour', label: 'Regional Tour' },
  { value: 'Residency', label: 'Residency' },
  { value: 'Theater Run', label: 'Theater Run' },
  { value: 'Arena Tour', label: 'Arena Tour' },
  { value: 'Club Tour', label: 'Club Tour' },
  { value: 'Festival Circuit', label: 'Festival Circuit' },
  { value: 'Acoustic Tour', label: 'Acoustic Tour' },
  ...GENRE_OPTIONS.map(g => ({ value: g, label: g })),
];

export interface Attraction {
  id: string;
  name: string;
  genres: string[];
}

export const ATTRACTIONS: Attraction[] = [
  { id: 'atr-01', name: 'Stella Vance', genres: ['Pop', 'R&B'] },
  { id: 'atr-02', name: 'Iron Meridian', genres: ['Rock', 'Alternative'] },
  { id: 'atr-03', name: 'Cleo & The Current', genres: ['Pop', 'Indie'] },
  { id: 'atr-04', name: 'Marcus Fontaine', genres: ['Comedy'] },
  { id: 'atr-05', name: 'Aurora Rising', genres: ['Electronic', 'Pop'] },
  { id: 'atr-06', name: 'The Blackwood Collective', genres: ['Country', 'Americana'] },
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
  talentAgentContactId: string;
  tourTypeOrGenre: string;
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
    talentAgentContactId: 'ct-04', tourTypeOrGenre: 'World Tour', splitPct: 85, breakeven: 320000,
    radiusMiles: 90, radiusDays: 30, stageWidth: 60, stageDepth: 40, riggingLoad: 40000, trucks: 8, crew: 42,
    technicalRider: 'Stage 60W×40D. Touring PA required, no house system. Touring lighting rig required. 400A 3-phase power. 6 loading docks minimum.',
    hospitalityRider: '4 dressing rooms. 1 private artist suite. Hot catering for 50. 20 hotel rooms 3-star min.',
    dressingRooms: 4,
    contacts: [{ contactId: 'ct-08', role: 'TourManager' }, { contactId: 'ct-09', role: 'ProductionManager' }, { contactId: 'ct-10', role: 'TourAccountant' }, { contactId: 'ct-11', role: 'Publicist' }] },
  { id: 'tour-02', attractionId: 'atr-01', name: 'Afterglow: The Residency', status: 'ActiveRouting',
    startDate: '2025-03-01', endDate: '2025-06-30', dmaIds: ['dma-12'],
    talentAgentContactId: 'ct-04', tourTypeOrGenre: 'Residency', splitPct: null, breakeven: null,
    radiusMiles: 0, radiusDays: 0, stageWidth: 60, stageDepth: 40, riggingLoad: 40000, trucks: 8, crew: 42,
    technicalRider: 'Same as Afterglow World Tour.', hospitalityRider: 'Same as Afterglow World Tour.', dressingRooms: 4 },
  { id: 'tour-03', attractionId: 'atr-02', name: 'Fault Lines Tour', status: 'ActiveRouting',
    startDate: '2025-02-01', endDate: '2025-11-30', dmaIds: ['dma-01','dma-02','dma-03','dma-06','dma-11'],
    talentAgentContactId: 'ct-06', tourTypeOrGenre: 'Arena Tour', splitPct: null, breakeven: null,
    radiusMiles: 75, radiusDays: 21, stageWidth: 48, stageDepth: 32, riggingLoad: 30000, trucks: 6, crew: 35,
    technicalRider: 'Stage 48W×32D. Touring PA required. House lighting acceptable. 200A single-phase.',
    hospitalityRider: '3 dressing rooms. Hot meal for 40.', dressingRooms: 3,
    contacts: [{ contactId: 'ct-06', role: 'TourManager' }] },
  { id: 'tour-04', attractionId: 'atr-02', name: 'Acoustic Sessions', status: 'Announced',
    startDate: '2025-09-01', endDate: '2025-12-15', dmaIds: ['dma-01','dma-03','dma-11'],
    talentAgentContactId: 'ct-06', tourTypeOrGenre: 'Acoustic Tour', splitPct: null, breakeven: null,
    radiusMiles: 50, radiusDays: 14, stageWidth: 24, stageDepth: 20, riggingLoad: 5000, trucks: 2, crew: 12,
    technicalRider: 'Minimal production. House PA acceptable.', hospitalityRider: '2 dressing rooms.', dressingRooms: 2 },
  { id: 'tour-05', attractionId: 'atr-03', name: 'Electric Spring Tour', status: 'ActiveRouting',
    startDate: '2025-04-01', endDate: '2025-08-31', dmaIds: ['dma-03','dma-15','dma-07','dma-08'],
    talentAgentContactId: 'ct-05', tourTypeOrGenre: 'Theater Run', splitPct: 80, breakeven: 85000,
    radiusMiles: 60, radiusDays: 14, stageWidth: 32, stageDepth: 24, riggingLoad: 12000, trucks: 3, crew: 18,
    technicalRider: 'Theater-scale production. House PA acceptable.', hospitalityRider: '2 dressing rooms. Catering for 22.', dressingRooms: 2 },
  { id: 'tour-06', attractionId: 'atr-04', name: 'Oversharing Tour', status: 'ActiveRouting',
    startDate: '2025-01-01', endDate: '2025-12-31', dmaIds: ['dma-01','dma-02','dma-03','dma-04','dma-05','dma-06','dma-07','dma-08','dma-09','dma-10','dma-11','dma-12','dma-13','dma-14','dma-15'],
    talentAgentContactId: 'ct-07', tourTypeOrGenre: 'Comedy', splitPct: null, breakeven: null,
    radiusMiles: 30, radiusDays: 7, stageWidth: 20, stageDepth: 16, riggingLoad: 3000, trucks: 1, crew: 8,
    technicalRider: 'Minimal. Stool, mic, basic lighting. House PA required.', hospitalityRider: '1 dressing room. Rider: 6-pack IPA, cheese plate.', dressingRooms: 1 },
  { id: 'tour-07', attractionId: 'atr-06', name: 'Heartland Highway', status: 'ActiveRouting',
    startDate: '2025-03-15', endDate: '2025-10-31', dmaIds: ['dma-04','dma-05','dma-08','dma-13','dma-14'],
    talentAgentContactId: 'ct-06', tourTypeOrGenre: 'Country', splitPct: 85, breakeven: 260000,
    radiusMiles: 100, radiusDays: 28, stageWidth: 52, stageDepth: 36, riggingLoad: 35000, trucks: 7, crew: 38,
    technicalRider: 'Country-scale production. Full touring rig. Steel guitar, fiddle monitors required.',
    hospitalityRider: '4 dressing rooms. Southern catering for 45.', dressingRooms: 4,
    contacts: [{ contactId: 'ct-07', role: 'TourManager' }] },
  { id: 'tour-08', attractionId: 'atr-05', name: 'Neon Drift', status: 'Announced',
    startDate: '2025-06-01', endDate: '2025-12-31', dmaIds: ['dma-02','dma-09','dma-12'],
    talentAgentContactId: 'ct-04', tourTypeOrGenre: 'Electronic', splitPct: null, breakeven: null,
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

export interface DailySaleEntry {
  id: string;
  engagementId: string;
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

export { lookupDmasForPostal, getDmaFromPostalCode } from './dmaPostalLookup';
export type { PostalDmaLookupResult, PostalDmaSource } from './dmaPostalLookup';

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
    Unknown: { bg: 'bg-elevated', text: 'text-text-muted' },
    Private: { bg: 'bg-ems-purple-dim', text: 'text-ems-purple' },
    Public: { bg: 'bg-ems-green-dim', text: 'text-ems-green' },
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
