/**
 * Project Module API – aligned with dbo.EngagementProject,
 * dbo.EngagementProjectVenue, and dbo.EngagementProjectPerformanceOption.
 *
 * Database tables involved:
 *   EngagementProject                  (header)
 *   EngagementProjectDMA               (selected dbo.DMA rows per project)
 *   EngagementProjectVenue             (candidate venue per project)
 *   EngagementProjectPerformanceOption (proposed date/time per project-level)
 *
 * NOTE: Fields marked "FRONTEND-ONLY" are not stored in the DB. They should be
 * included in API payloads if the backend chooses to persist them elsewhere;
 * otherwise the backend should silently ignore them.
 */

import { apiFetch } from './config';
import type { ApiPaginatedResponse } from './companyApi';

// ---------------------------------------------------------------------------
// Lookup types
// ---------------------------------------------------------------------------

/** Client-defined allowed values for `dbo.EngagementProject.ProjectStage`. */
export const PROJECT_STAGE_VALUES = [
  'Under Construction',
  'Pending',
  'Inactive',
] as const;
export type ProjectStage = (typeof PROJECT_STAGE_VALUES)[number];

export interface ProjectStageMeta {
  projectStages: string[];
  source: 'application' | 'check_constraint' | 'environment' | 'existing_rows' | 'empty';
}

/** Allowed `dbo.EngagementProjectVenue.VenueStatus` from CHECK / env / existing rows. */
export interface VenueStatusMeta {
  venueStatuses: string[];
  source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
}

/** Allowed `dbo.EngagementProjectPerformanceOption.OptionStatus` from CHECK / env / existing rows. */
export interface OptionStatusMeta {
  optionStatuses: string[];
  source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
}

/** Human-readable label for a stage (works for any string from the DB). */
export function projectStageDisplayLabel(
  value: string,
  knownLabels?: Record<string, string>,
): string {
  if (knownLabels?.[value]) return knownLabels[value];
  return value.replace(/([A-Z])/g, ' $1').trim() || value;
}

/** Valid values for EngagementProjectVenue.VenueStatus */
export const VENUE_STATUS_VALUES = [
  'Proposed',
  'Offered',
  'Accepted',
  'Declined',
  'Cancelled',
] as const;
export type VenueStatus = (typeof VENUE_STATUS_VALUES)[number];

/** Valid values for EngagementProjectPerformanceOption.OptionStatus */
export const OPTION_STATUS_VALUES = [
  'Proposed',
  'Confirmed',
  'Declined',
  'Countered',
] as const;
export type OptionStatus = (typeof OPTION_STATUS_VALUES)[number];

// ---------------------------------------------------------------------------
// Performance date option (EngagementProjectPerformanceOption)
// ---------------------------------------------------------------------------

export interface ApiPerformanceOption {
  /** PK – EngagementProjectPerformanceOptionID */
  performanceOptionId: number;
  /** FK → EngagementProject */
  engagementProjectId: number;
  /** FK → EngagementProjectVenue when set */
  engagementProjectVenueId?: number | null;
  /** DATE (ISO "YYYY-MM-DD") — NOT NULL in DB */
  proposedDate: string;
  /** TIME ("HH:MM") — nullable in DB */
  proposedTime: string | null;
  /** NOT NULL in DB */
  optionStatus: OptionStatus;
}

export interface CreatePerformanceOptionPayload {
  /** ISO date "YYYY-MM-DD" — REQUIRED */
  proposedDate: string;
  /** "HH:MM" — optional */
  proposedTime?: string | null;
  /** REQUIRED */
  optionStatus: OptionStatus;
}

export type UpdatePerformanceOptionPayload = Partial<CreatePerformanceOptionPayload>;

// ---------------------------------------------------------------------------
// Project venue (EngagementProjectVenue)
// ---------------------------------------------------------------------------

export interface ApiProjectVenue {
  /** PK – EngagementProjectVenueID */
  engagementProjectVenueId: number;
  /** FK → EngagementProject */
  engagementProjectId: number;
  /** FK → Company.CompanyID — NOT NULL */
  venueCompanyId: number;
  /** Display name (denormalised from Company/Venue for convenience) */
  venueCompanyName: string | null;
  venueName: string | null;
  /** NOT NULL in DB */
  venueStatus: VenueStatus;

  // -------------------------------------------------------------------------
  // FRONTEND-ONLY fields – not in EngagementProjectVenue table
  // Include in payload if backend can persist them; otherwise backend ignores.
  // -------------------------------------------------------------------------
  configName?: string | null;
  dealType?: string | null;
  guarantee?: number | null;
  splitPct?: number | null;
  breakeven?: number | null;
  marketingCoOp?: number | null;
  /** If this venue was accepted and converted to an Engagement */
  engagementId?: number | null;

  /** Date options for this venue (EngagementProjectPerformanceOption) */
  performanceOptions: ApiPerformanceOption[];
}

export interface CreateProjectVenuePayload {
  /** REQUIRED – FK → Company.CompanyID */
  venueCompanyId: number;
  /** REQUIRED */
  venueStatus: VenueStatus;
  /** One or more proposed date/time options */
  performanceOptions?: CreatePerformanceOptionPayload[];

  // FRONTEND-ONLY (optional in payload)
  configName?: string | null;
  dealType?: string | null;
  guarantee?: number | null;
  splitPct?: number | null;
  breakeven?: number | null;
  marketingCoOp?: number | null;
}

export type UpdateProjectVenuePayload = Partial<Omit<CreateProjectVenuePayload, 'venueCompanyId'>>;

// ---------------------------------------------------------------------------
// Project (EngagementProject)
// ---------------------------------------------------------------------------

export interface ApiProjectListRow {
  /** PK – EngagementProjectID */
  engagementProjectId: number;
  /** FK → Tour.TourID — NOT NULL */
  tourId: number;
  /** From Tour → Attraction (for filters / UI) */
  attractionId?: number | null;
  tourName: string | null;
  attractionName: string | null;
  /** From Tour.TalentAgencyCompanyID → Company */
  talentAgencyCompanyId?: number | null;
  talentAgencyCompanyName?: string | null;
  /** EngagementProject.ProjectStage — NOT NULL (may be legacy values not in `PROJECT_STAGE_VALUES`) */
  projectStage: string;
  /** ISO datetime */
  createdDate: string;
  /** nullable in DB */
  createdBy: string | null;

  /** dbo.EngagementProjectDMA — DMAID values for this project */
  dmaIds?: number[];

  // -------------------------------------------------------------------------
  // FRONTEND-ONLY – not in EngagementProject table
  // -------------------------------------------------------------------------
  name?: string | null;
  bookerId?: string | null;
  agentContactId?: string | null;
  targetOnSale?: string | null;
  notes?: string | null;
}

export interface ApiProjectDetail extends ApiProjectListRow {
  venues: ApiProjectVenue[];
}

export interface CreateProjectPayload {
  /** REQUIRED – FK → Tour.TourID */
  tourId: number;
  /** Sent by the wizard; persisted on dbo.Tour.TalentAgencyCompanyID when the project is created. */
  talentAgencyCompanyId: number;
  /** REQUIRED */
  projectStage: ProjectStage;
  /** nullable */
  createdBy?: string | null;

  /** Persisted to dbo.EngagementProjectDMA (deduped on save; at least one required). */
  dmaIds: number[];

  // FRONTEND-ONLY (optional in payload)
  name?: string | null;
  bookerId?: string | null;
  agentContactId?: string | null;
  targetOnSale?: string | null;
  notes?: string | null;

  /** Venues and per-venue proposed dates (required for create-project wizard). */
  venues: CreateProjectVenuePayload[];
}

export interface UpdateProjectPayload {
  projectStage?: ProjectStage;
  createdBy?: string | null;
  tourId?: number;
  /** When provided, must match a Talent Agency company (tour row is the source of truth). */
  talentAgencyCompanyId?: number;

  /** Replaces all project–DMA rows when provided (empty array clears). */
  dmaIds?: number[];

  // FRONTEND-ONLY
  name?: string | null;
  bookerId?: string | null;
  agentContactId?: string | null;
  targetOnSale?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Fixed list: `Under Construction`, `Pending`, `Inactive` (see `PROJECT_STAGE_VALUES`). */
export function fetchProjectStageMeta() {
  return apiFetch<ProjectStageMeta>('/projects/meta/project-stages');
}

export function fetchVenueStatusMeta() {
  return apiFetch<VenueStatusMeta>('/projects/meta/venue-statuses');
}

export function fetchOptionStatusMeta() {
  return apiFetch<OptionStatusMeta>('/projects/meta/option-statuses');
}

export type ProjectListQueryOpts = {
  q?: string;
  projectStage?: string;
  /** Server whitelist: attraction, tour, tourmgmt, createdby, created */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

/** React Query key for paginated `GET /projects`. */
export function projectsApiQueryKey(
  offset: number,
  limit: number,
  q = '',
  projectStage = 'All',
  sortBy = '',
  sortDir = '',
) {
  return ['projects', 'api', offset, limit, q, projectStage, sortBy, sortDir] as const;
}

export function fetchProjects(offset = 0, limit = 25, opts?: ProjectListQueryOpts) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const trimmed = opts?.q?.trim();
  if (trimmed) params.set('q', trimmed);
  const st = opts?.projectStage?.trim();
  if (st && st !== 'All') params.set('projectStage', st);
  const sb = opts?.sortBy?.trim();
  if (sb) params.set('sortBy', sb);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  return apiFetch<ApiPaginatedResponse<ApiProjectListRow>>(`/projects?${params}`);
}

export function fetchProject(id: number) {
  return apiFetch<ApiProjectDetail>(`/projects/${id}`);
}

export function createProject(body: CreateProjectPayload) {
  return apiFetch<{ engagementProjectId: number }>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProject(id: number, body: UpdateProjectPayload) {
  return apiFetch<void>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProject(id: number) {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}

// --- Venue proposals ---------------------------------------------------------

export function fetchProjectVenues(projectId: number) {
  return apiFetch<ApiProjectVenue[]>(`/projects/${projectId}/venues`);
}

export function createProjectVenue(projectId: number, body: CreateProjectVenuePayload) {
  return apiFetch<{ engagementProjectVenueId: number }>(`/projects/${projectId}/venues`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProjectVenue(
  projectId: number,
  venueId: number,
  body: UpdateProjectVenuePayload,
) {
  return apiFetch<void>(`/projects/${projectId}/venues/${venueId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProjectVenue(projectId: number, venueId: number) {
  return apiFetch<void>(`/projects/${projectId}/venues/${venueId}`, {
    method: 'DELETE',
  });
}

// --- Performance date options ------------------------------------------------

export function createPerformanceOption(
  projectId: number,
  body: CreatePerformanceOptionPayload,
) {
  return apiFetch<{ performanceOptionId: number }>(`/projects/${projectId}/performance-options`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePerformanceOption(
  projectId: number,
  optionId: number,
  body: UpdatePerformanceOptionPayload,
) {
  return apiFetch<void>(`/projects/${projectId}/performance-options/${optionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deletePerformanceOption(projectId: number, optionId: number) {
  return apiFetch<void>(`/projects/${projectId}/performance-options/${optionId}`, {
    method: 'DELETE',
  });
}