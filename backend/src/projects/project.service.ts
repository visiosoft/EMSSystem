import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { EngagementProject } from '../entities/engagement-project.entity';
import { EngagementProjectDma } from '../entities/engagement-project-dma.entity';
import { EngagementProjectVenue } from '../entities/engagement-project-venue.entity';
import { EngagementProjectPerformanceOption } from '../entities/engagement-project-performance-option.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Dma } from '../entities/dma.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectVenueDto } from './dto/add-project-venue.dto';
import { UpdateProjectVenueDto } from './dto/update-project-venue.dto';
import { AddPerformanceOptionDto } from './dto/add-performance-option.dto';
import { UpdatePerformanceOptionDto } from './dto/update-performance-option.dto';
import {
  isAllowedProjectStage,
  PROJECT_STAGE_VALUES,
} from './project-stage.constants';
import { parseStringLiteralsFromCheckDefinition } from './venue-status-check.util';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  private static readonly VENUE_STATUS_LIST_TTL_MS = 60_000;
  private venueStatusListCache: {
    at: number;
    result: {
      values: string[];
      source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
    };
  } | null = null;

  private static readonly OPTION_STATUS_LIST_TTL_MS = 60_000;
  private optionStatusListCache: {
    at: number;
    result: {
      values: string[];
      source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
    };
  } | null = null;

  constructor(
    @InjectRepository(EngagementProject)
    private readonly projectRepo: Repository<EngagementProject>,
    @InjectRepository(EngagementProjectVenue)
    private readonly projectVenueRepo: Repository<EngagementProjectVenue>,
    @InjectRepository(EngagementProjectPerformanceOption)
    private readonly optionRepo: Repository<EngagementProjectPerformanceOption>,
    @InjectRepository(EngagementProjectDma)
    private readonly projectDmaRepo: Repository<EngagementProjectDma>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(Attraction)
    private readonly attractionRepo: Repository<Attraction>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalizeTime(t: string | null | undefined): string | null {
    if (!t) return null;
    const parts = t.trim().split(':');
    if (parts.length === 2)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    if (parts.length === 3)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0').slice(0, 2)}`;
    throw new BadRequestException({
      message: 'Invalid time format. Use HH:MM or HH:MM:SS.',
    });
  }

  private formatTime(t: string | null): string | null {
    if (!t) return null;
    // DB may return HH:MM:SS or HH:MM, normalize to HH:MM for response
    const parts = t.split(':');
    if (parts.length >= 2)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return t;
  }

  /**
   * Project stages are fixed in this application: Under Construction, Pending, Inactive
   * (aligned with dbo.EngagementProject.ProjectStage CHECK; DTOs validate with @IsIn).
   */
  async getProjectStageMeta(): Promise<{
    projectStages: string[];
    source: 'application';
  }> {
    return { projectStages: [...PROJECT_STAGE_VALUES], source: 'application' };
  }

  private parseVenueStatusEnvAllowlist(): string[] {
    const raw = process.env.VENUE_STATUS_ALLOWLIST?.trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async loadVenueStatusFromCheck(): Promise<string[] | null> {
    const rows: { definition: string }[] = await this.dataSource.query(
      `
      SELECT cc.definition AS [definition]
      FROM sys.check_constraints AS cc
      INNER JOIN sys.objects AS t ON cc.parent_object_id = t.object_id
      WHERE t.object_id = OBJECT_ID('dbo.EngagementProjectVenue', 'U')
        AND cc.is_disabled = 0
        AND cc.definition LIKE N'%VenueStatus%'
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      for (const v of parseStringLiteralsFromCheckDefinition(r.definition)) {
        if (v.length) collected.add(v);
      }
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  private async loadVenueStatusFromExistingRows(): Promise<string[] | null> {
    const rows: Record<string, string>[] = await this.dataSource.query(
      `
      SELECT DISTINCT LTRIM(RTRIM(CAST([VenueStatus] AS NVARCHAR(200)))) AS [s]
      FROM [dbo].[EngagementProjectVenue]
      WHERE [VenueStatus] IS NOT NULL
        AND LEN(LTRIM(RTRIM(CAST([VenueStatus] AS NVARCHAR(200))))) > 0
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      const v = r['s'] ?? r['S'];
      if (v != null) collected.add(String(v).trim());
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  private async resolveVenueStatusAllowlist(): Promise<{
    values: string[];
    source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
  }> {
    const fromEnv = this.parseVenueStatusEnvAllowlist();
    if (fromEnv.length > 0) {
      return { values: fromEnv, source: 'environment' };
    }
    try {
      const fromCheck = await this.loadVenueStatusFromCheck();
      if (fromCheck && fromCheck.length > 0) {
        return { values: fromCheck, source: 'check_constraint' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read CHECK for dbo.EngagementProjectVenue.VenueStatus: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    try {
      const fromRows = await this.loadVenueStatusFromExistingRows();
      if (fromRows && fromRows.length > 0) {
        this.logger.log(
          `Venue status list taken from existing dbo.EngagementProjectVenue rows (${fromRows.length} distinct value(s)).`,
        );
        return { values: fromRows, source: 'existing_rows' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read distinct VenueStatus: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    this.logger.warn(
      'No venue status allowlist: set VENUE_STATUS_ALLOWLIST on the API, or ensure the CHECK for VenueStatus can be read, or have at least one project venue row.',
    );
    return { values: [], source: 'empty' };
  }

  /**
   * Allowed `VenueStatus` values for dbo.EngagementProjectVenue — from the SQL Server CHECK
   * on the column, or from env `VENUE_STATUS_ALLOWLIST` (comma-separated), or from existing rows.
   */
  async getVenueStatusMeta(): Promise<{
    venueStatuses: string[];
    source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
  }> {
    const now = Date.now();
    if (
      this.venueStatusListCache &&
      now - this.venueStatusListCache.at <
        ProjectService.VENUE_STATUS_LIST_TTL_MS
    ) {
      const r = this.venueStatusListCache.result;
      return { venueStatuses: r.values, source: r.source };
    }
    const r = await this.resolveVenueStatusAllowlist();
    this.venueStatusListCache = { at: now, result: r };
    return { venueStatuses: r.values, source: r.source };
  }

  private assertValidProjectStage(stage: string): void {
    if (!isAllowedProjectStage(stage)) {
      throw new BadRequestException({
        message: `Invalid project stage "${stage}". Allowed values: ${PROJECT_STAGE_VALUES.join(', ')}.`,
      });
    }
  }

  private async assertValidVenueStatus(status: string): Promise<void> {
    const { venueStatuses } = await this.getVenueStatusMeta();
    if (venueStatuses.length === 0) {
      return;
    }
    if (!venueStatuses.includes(status)) {
      throw new BadRequestException({
        message: `Invalid venue status "${status}". Allowed values: ${venueStatuses.join(', ')}.`,
      });
    }
  }

  private parseOptionStatusEnvAllowlist(): string[] {
    const raw = process.env.OPTION_STATUS_ALLOWLIST?.trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async loadOptionStatusFromCheck(): Promise<string[] | null> {
    const rows: { definition: string }[] = await this.dataSource.query(
      `
      SELECT cc.definition AS [definition]
      FROM sys.check_constraints AS cc
      INNER JOIN sys.objects AS t ON cc.parent_object_id = t.object_id
      WHERE t.object_id = OBJECT_ID('dbo.EngagementProjectPerformanceOption', 'U')
        AND cc.is_disabled = 0
        AND cc.definition LIKE N'%OptionStatus%'
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      for (const v of parseStringLiteralsFromCheckDefinition(r.definition)) {
        if (v.length) collected.add(v);
      }
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  private async loadOptionStatusFromExistingRows(): Promise<string[] | null> {
    const rows: Record<string, string>[] = await this.dataSource.query(
      `
      SELECT DISTINCT LTRIM(RTRIM(CAST([OptionStatus] AS NVARCHAR(200)))) AS [s]
      FROM [dbo].[EngagementProjectPerformanceOption]
      WHERE [OptionStatus] IS NOT NULL
        AND LEN(LTRIM(RTRIM(CAST([OptionStatus] AS NVARCHAR(200))))) > 0
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      const v = r['s'] ?? r['S'];
      if (v != null) collected.add(String(v).trim());
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  private async resolveOptionStatusAllowlist(): Promise<{
    values: string[];
    source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
  }> {
    const fromEnv = this.parseOptionStatusEnvAllowlist();
    if (fromEnv.length > 0) {
      return { values: fromEnv, source: 'environment' };
    }
    try {
      const fromCheck = await this.loadOptionStatusFromCheck();
      if (fromCheck && fromCheck.length > 0) {
        return { values: fromCheck, source: 'check_constraint' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read CHECK for dbo.EngagementProjectPerformanceOption.OptionStatus: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    try {
      const fromRows = await this.loadOptionStatusFromExistingRows();
      if (fromRows && fromRows.length > 0) {
        this.logger.log(
          `Option status list taken from existing dbo.EngagementProjectPerformanceOption rows (${fromRows.length} distinct value(s)).`,
        );
        return { values: fromRows, source: 'existing_rows' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read distinct OptionStatus: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    this.logger.warn(
      'No option status allowlist: set OPTION_STATUS_ALLOWLIST on the API, or ensure the CHECK for OptionStatus can be read, or have at least one performance option row.',
    );
    return { values: [], source: 'empty' };
  }

  /**
   * Allowed `OptionStatus` values for dbo.EngagementProjectPerformanceOption — from SQL Server CHECK,
   * env `OPTION_STATUS_ALLOWLIST` (comma-separated), or existing rows.
   */
  async getOptionStatusMeta(): Promise<{
    optionStatuses: string[];
    source: 'environment' | 'check_constraint' | 'existing_rows' | 'empty';
  }> {
    const now = Date.now();
    if (
      this.optionStatusListCache &&
      now - this.optionStatusListCache.at <
        ProjectService.OPTION_STATUS_LIST_TTL_MS
    ) {
      const r = this.optionStatusListCache.result;
      return { optionStatuses: r.values, source: r.source };
    }
    const r = await this.resolveOptionStatusAllowlist();
    this.optionStatusListCache = { at: now, result: r };
    return { optionStatuses: r.values, source: r.source };
  }

  private async assertValidOptionStatus(status: string): Promise<void> {
    const { optionStatuses } = await this.getOptionStatusMeta();
    if (optionStatuses.length === 0) {
      return;
    }
    if (!optionStatuses.includes(status)) {
      throw new BadRequestException({
        message: `Invalid performance option status "${status}". Allowed values: ${optionStatuses.join(', ')}.`,
      });
    }
  }

  private async assertTourExists(tourId: number): Promise<Tour> {
    const tour = await this.tourRepo.findOne({ where: { tourId } });
    if (!tour) {
      throw new BadRequestException({
        message: `Tour with ID ${tourId} not found.`,
      });
    }
    return tour;
  }

  private async assertCompanyIsTalentAgency(companyId: number): Promise<void> {
    const co = await this.companyRepo.findOne({
      where: { companyId },
      relations: { companyType: true },
    });
    if (!co) {
      throw new BadRequestException({ message: 'Company not found.' });
    }
    const typeName = co.companyType?.companyTypeName?.trim().toLowerCase() ?? '';
    if (typeName !== 'talent agency') {
      throw new BadRequestException({
        message: 'Talent agency must be a company of type Talent Agency.',
      });
    }
  }

  private async assertVenueCompany(venueCompanyId: number): Promise<void> {
    const company = await this.companyRepo.findOne({
      where: { companyId: venueCompanyId },
    });
    if (!company) {
      throw new BadRequestException({
        message: `Company with ID ${venueCompanyId} not found.`,
      });
    }
    const venue = await this.venueRepo.findOne({
      where: { companyId: venueCompanyId },
    });
    if (!venue) {
      throw new BadRequestException({
        message: 'Company exists but is not a venue.',
      });
    }
  }

  private async assertProjectExists(id: number): Promise<EngagementProject> {
    const project = await this.projectRepo.findOne({
      where: { engagementProjectId: id },
    });
    if (!project) {
      throw new NotFoundException({
        message: `Project with ID ${id} not found.`,
      });
    }
    return project;
  }

  /** Distinct positive DMA IDs, sorted ascending (for stable inserts / responses). */
  private normalizeDmaIds(ids: number[] | undefined): number[] {
    if (!ids?.length) return [];
    const seen = new Set<number>();
    for (const n of ids) {
      if (typeof n === 'number' && Number.isInteger(n) && n >= 1) seen.add(n);
    }
    return [...seen].sort((a, b) => a - b);
  }

  private async assertDmasExist(
    manager: EntityManager,
    dmaIds: number[],
  ): Promise<void> {
    if (dmaIds.length === 0) return;
    const dmaRepo = manager.getRepository(Dma);
    const cnt = await dmaRepo
      .createQueryBuilder('d')
      .where('d.dmaid IN (:...ids)', { ids: dmaIds })
      .getCount();
    if (cnt !== dmaIds.length) {
      throw new BadRequestException({
        message:
          'One or more selected markets (DMA) are not in the database. Refresh the list and try again.',
      });
    }
  }

  private async insertProjectDmasInTransaction(
    manager: EntityManager,
    projectId: number,
    dmaIds: number[] | undefined,
  ): Promise<void> {
    const normalized = this.normalizeDmaIds(dmaIds);
    if (normalized.length === 0) return;
    await this.assertDmasExist(manager, normalized);
    for (const dmaid of normalized) {
      await manager.save(
        EngagementProjectDma,
        manager.create(EngagementProjectDma, {
          engagementProjectId: projectId,
          dmaid,
        }),
      );
    }
  }

  private async assertVenueInProject(
    projectId: number,
    venueId: number,
  ): Promise<EngagementProjectVenue> {
    const venue = await this.projectVenueRepo.findOne({
      where: {
        engagementProjectId: projectId,
        engagementProjectVenueId: venueId,
      },
    });
    if (!venue) {
      throw new NotFoundException({
        message: `Venue proposal with ID ${venueId} not found in project ${projectId}.`,
      });
    }
    return venue;
  }

  private async assertOptionInProject(
    projectId: number,
    optionId: number,
  ): Promise<EngagementProjectPerformanceOption> {
    const option = await this.optionRepo.findOne({
      where: { engagementProjectId: projectId, performanceOptionId: optionId },
    });
    if (!option) {
      throw new NotFoundException({
        message: `Performance option with ID ${optionId} not found in project ${projectId}.`,
      });
    }
    return option;
  }

  /** Map SQL errors from project venue / option writes to HTTP exceptions (avoids generic 500). */
  private mapProjectVenueQueryFailed(
    op: 'add' | 'mutate',
    projectId: number,
    e: QueryFailedError,
    venueStatus?: string,
  ): never {
    const d = String(e.driverError ?? e.message);
    this.logger.error(
      `Project venue ${op} failed (projectId=${projectId}): ${d}`,
    );

    const driver = e.driverError as
      | { number?: number; message?: string }
      | undefined;
    const n = driver?.number;
    if (
      n === 2627 ||
      n === 2601 ||
      /duplicate key|UNIQUE KEY constraint/i.test(d)
    ) {
      throw new ConflictException({
        message: 'This venue is already added to this project.',
        detail: d,
      });
    }
    if (n === 547 || /FOREIGN KEY/i.test(d)) {
      throw new BadRequestException({
        message:
          'This venue can’t be linked. Check that the company is a valid venue in the system and the project still exists.',
        detail: d,
      });
    }
    if (
      venueStatus &&
      (/CHECK constraint|VenueStatus/i.test(d) || /VenueStatus/i.test(d))
    ) {
      throw new BadRequestException({
        message: `This venue status isn’t accepted by the database: ${venueStatus}.`,
        detail: d,
      });
    }
    throw new BadRequestException({
      message:
        'Could not add the venue. The database rejected the change — check the server log for details.',
      detail: d,
    });
  }

  // ─── Build response shape ─────────────────────────────────────────────────

  private async buildProjectResponse(project: EngagementProject) {
    const tour = await this.tourRepo.findOne({
      where: { tourId: project.tourId },
      relations: { attraction: true, talentAgencyCompany: true },
    });
    const attraction = tour?.attraction ?? null;
    const effectiveMgmtId = tour?.talentAgencyCompanyId ?? null;
    const effectiveMgmtName = tour?.talentAgencyCompany?.companyName ?? null;

    const dbVenues = await this.projectVenueRepo.find({
      where: { engagementProjectId: project.engagementProjectId },
    });

    const options = await this.optionRepo.find({
      where: { engagementProjectId: project.engagementProjectId },
      order: { proposedDate: 'ASC' },
    });

    const projectDmas = await this.projectDmaRepo.find({
      where: { engagementProjectId: project.engagementProjectId },
      order: { dmaid: 'ASC' },
    });

    const firstVenueId = dbVenues[0]?.engagementProjectVenueId;
    const optionsForVenue = (venueRowId: number) => {
      const linked = options.filter(
        (o) => o.engagementProjectVenueId === venueRowId,
      );
      if (linked.length > 0) return linked;
      /** Legacy rows (no venue FK): surface once on the first venue only. */
      if (venueRowId === firstVenueId) {
        return options.filter((o) => o.engagementProjectVenueId == null);
      }
      return [];
    };

    const venuesWithDetails = await Promise.all(
      dbVenues.map(async (v) => {
        const company = await this.companyRepo.findOne({
          where: { companyId: v.venueCompanyId },
        });
        const venue = await this.venueRepo.findOne({
          where: { companyId: v.venueCompanyId },
        });
        return {
          engagementProjectVenueId: v.engagementProjectVenueId,
          engagementProjectId: v.engagementProjectId,
          venueCompanyId: v.venueCompanyId,
          venueCompanyName: company?.companyName ?? null,
          venueName: venue?.venueName ?? null,
          venueStatus: v.venueStatus,
          // Frontend-only fields returned as null (Option A — we never persisted them)
          configName: null,
          dealType: null,
          guarantee: null,
          splitPct: null,
          breakeven: null,
          marketingCoOp: null,
          engagementId: null,
          performanceOptions: optionsForVenue(v.engagementProjectVenueId).map(
            (o) => ({
              performanceOptionId: o.performanceOptionId,
              engagementProjectId: o.engagementProjectId,
              engagementProjectVenueId: o.engagementProjectVenueId ?? null,
              proposedDate: o.proposedDate,
              proposedTime: this.formatTime(o.proposedTime),
              optionStatus: o.optionStatus,
            }),
          ),
        };
      }),
    );

    return {
      engagementProjectId: project.engagementProjectId,
      tourId: project.tourId,
      attractionId: tour?.attractionId ?? null,
      tourName: tour?.tourName ?? null,
      attractionName: attraction?.attractionName ?? null,
      talentAgencyCompanyId: effectiveMgmtId,
      talentAgencyCompanyName: effectiveMgmtName,
      projectStage: project.projectStage,
      createdDate: project.createdDate,
      createdBy: project.createdBy,
      name: null,
      bookerId: null,
      agentContactId: null,
      dmaIds: projectDmas.map((d) => d.dmaid),
      targetOnSale: null,
      notes: null,
      venues: venuesWithDetails,
    };
  }

  // ─── Project CRUD ─────────────────────────────────────────────────────────

  async create(
    dto: CreateProjectDto,
  ): Promise<{ engagementProjectId: number }> {
    const tourRow = await this.assertTourExists(dto.tourId);
    await this.assertCompanyIsTalentAgency(dto.talentAgencyCompanyId);
    if (
      tourRow.talentAgencyCompanyId != null &&
      tourRow.talentAgencyCompanyId !== dto.talentAgencyCompanyId
    ) {
      throw new BadRequestException({
        message:
          'The selected tour already has a different talent agency on file. Use that agency or update the tour first.',
      });
    }
    this.assertValidProjectStage(dto.projectStage);

    if (!dto.venues?.length) {
      throw new BadRequestException({
        message: 'Select at least one venue.',
      });
    }
    for (const v of dto.venues) {
      await this.assertVenueCompany(v.venueCompanyId);
      await this.assertValidVenueStatus(v.venueStatus);
      for (const o of v.performanceOptions ?? []) {
        if ((o.proposedDate ?? '').trim().length === 0) continue;
        await this.assertValidOptionStatus(o.optionStatus);
      }
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const project = manager.create(EngagementProject, {
          tourId: dto.tourId,
          projectStage: dto.projectStage,
          createdDate: new Date(),
          createdBy: dto.createdBy?.trim() ?? null,
        });
        const savedProject = await manager.save(EngagementProject, project);

        await this.insertProjectDmasInTransaction(
          manager,
          savedProject.engagementProjectId,
          dto.dmaIds,
        );

        for (const v of dto.venues ?? []) {
          const pv = manager.create(EngagementProjectVenue, {
            engagementProjectId: savedProject.engagementProjectId,
            venueCompanyId: v.venueCompanyId,
            venueStatus: v.venueStatus,
          });
          const savedPv = await manager.save(EngagementProjectVenue, pv);

          for (const opt of v.performanceOptions ?? []) {
            const o = manager.create(EngagementProjectPerformanceOption, {
              engagementProjectId: savedProject.engagementProjectId,
              engagementProjectVenueId: savedPv.engagementProjectVenueId,
              proposedDate: opt.proposedDate,
              proposedTime: this.normalizeTime(opt.proposedTime),
              optionStatus: opt.optionStatus,
            });
            await manager.save(o);
          }
        }

        await manager.update(
          Tour,
          { tourId: dto.tourId },
          { talentAgencyCompanyId: dto.talentAgencyCompanyId },
        );

        return { engagementProjectId: savedProject.engagementProjectId };
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const d = String((err as QueryFailedError).driverError ?? err.message);
        this.logger.warn(`Create project failed: ${d}`);
        const isStageCheck =
          /CHECK constraint/i.test(d) && /ProjectStage/i.test(d);
        const isOptionStatusCheck =
          /CHECK constraint/i.test(d) && /OptionStatus/i.test(d);
        throw new BadRequestException({
          message: isStageCheck
            ? `This project stage isn’t accepted by the database. Use one of: ${PROJECT_STAGE_VALUES.join(', ')}.`
            : isOptionStatusCheck
              ? 'A proposed date option used a status the database does not allow. Refresh the page and try again, or ask an administrator which option statuses are valid.'
              : 'Could not create the project. Check that the tour exists and that the information you entered matches your organization’s rules.',
          detail: d,
        });
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateProjectDto): Promise<void> {
    const project = await this.assertProjectExists(id);
    if (dto.projectStage !== undefined) {
      this.assertValidProjectStage(dto.projectStage);
      project.projectStage = dto.projectStage;
    }
    if (dto.createdBy !== undefined)
      project.createdBy = dto.createdBy?.trim() ?? null;
    if (dto.tourId !== undefined) {
      await this.assertTourExists(dto.tourId);
      project.tourId = dto.tourId;
    }
    if (dto.talentAgencyCompanyId !== undefined) {
      await this.assertCompanyIsTalentAgency(dto.talentAgencyCompanyId);
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        if (dto.dmaIds !== undefined) {
          await manager.delete(EngagementProjectDma, {
            engagementProjectId: id,
          });
          const normalized = this.normalizeDmaIds(dto.dmaIds);
          if (normalized.length > 0) {
            await this.assertDmasExist(manager, normalized);
            for (const dmaid of normalized) {
              await manager.save(
                EngagementProjectDma,
                manager.create(EngagementProjectDma, {
                  engagementProjectId: id,
                  dmaid,
                }),
              );
            }
          }
        }
        if (dto.talentAgencyCompanyId !== undefined) {
          const effectiveTourId = dto.tourId ?? project.tourId;
          await manager.update(
            Tour,
            { tourId: effectiveTourId },
            { talentAgencyCompanyId: dto.talentAgencyCompanyId },
          );
        }
        await manager.save(EngagementProject, project);
      });
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      if (e instanceof QueryFailedError) {
        const d = String((e as QueryFailedError).driverError ?? e.message);
        this.logger.warn(`Update project failed (id=${id}): ${d}`);
        throw new BadRequestException({
          message:
            'Could not update the project. Check the information you entered, or ask your administrator if something is blocked by your system’s rules.',
          detail: d,
        });
      }
      throw e;
    }
  }

  async remove(id: number): Promise<void> {
    await this.assertProjectExists(id);
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(EngagementProjectPerformanceOption, {
          engagementProjectId: id,
        });
        await manager.delete(EngagementProjectVenue, {
          engagementProjectId: id,
        });
        await manager.delete(EngagementProjectDma, {
          engagementProjectId: id,
        });
        await manager.delete(EngagementProject, { engagementProjectId: id });
      });
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const detail = String((e as QueryFailedError).driverError ?? e.message);
        this.logger.warn(`Project delete blocked (id=${id}): ${detail}`);
        throw new ConflictException({
          message:
            'This project can’t be removed because it’s still linked to other records. Remove or reassign those links first, or ask an administrator for help.',
          detail,
        });
      }
      throw e;
    }
  }

  async listPaginated(
    offset: number,
    limit: number,
    search?: string,
    projectStageFilter?: string,
    sortByRaw?: string,
    sortDirRaw?: string,
  ): Promise<{
    data: Array<{
      engagementProjectId: number;
      tourId: number;
      tourName: string | null;
      attractionName: string | null;
      talentAgencyCompanyId: number | null;
      talentAgencyCompanyName: string | null;
      projectStage: string;
      createdDate: Date;
      createdBy: string | null;
      name: null;
      bookerId: null;
      agentContactId: null;
      dmaIds: number[];
      targetOnSale: null;
      notes: null;
    }>;
    total: number;
  }> {
    const qb = this.projectRepo
      .createQueryBuilder('ep')
      .innerJoinAndSelect('ep.tour', 't')
      .leftJoinAndSelect('t.attraction', 'a')
      .leftJoinAndSelect('t.talentAgencyCompany', 'tmg');

    const stage = (projectStageFilter ?? '').trim();
    if (stage && stage !== 'All') {
      qb.andWhere('ep.projectStage = :projectStage', { projectStage: stage });
    }

    const q = (search ?? '').trim();
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('CAST(ep.engagementProjectId AS VARCHAR(20)) LIKE :like', {
            like,
          })
            .orWhere("LOWER(ISNULL(t.tourName, '')) LIKE LOWER(:like)", {
              like,
            })
            .orWhere("LOWER(ISNULL(a.attractionName, '')) LIKE LOWER(:like)", {
              like,
            })
            .orWhere("LOWER(ISNULL(tmg.companyName, '')) LIKE LOWER(:like)", {
              like,
            })
            .orWhere("LOWER(ISNULL(ep.projectStage, '')) LIKE LOWER(:like)", {
              like,
            })
            .orWhere("LOWER(ISNULL(ep.createdBy, '')) LIKE LOWER(:like)", {
              like,
            })
            .orWhere('CONVERT(VARCHAR(30), ep.createdDate, 126) LIKE :like', {
              like,
            });
        }),
      );
    }

    const sortBy = (sortByRaw ?? '').trim().toLowerCase();
    const sortDir =
      (sortDirRaw ?? '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortWhitelist: Record<string, string> = {
      attraction: 'a.attractionName',
      tour: 't.tourName',
      tourmgmt: 'tmg.companyName',
      createdby: 'ep.createdBy',
      created: 'ep.createdDate',
    };
    const sortExpr = sortWhitelist[sortBy];
    if (sortExpr) {
      qb.orderBy(sortExpr, sortDir).addOrderBy('ep.engagementProjectId', 'DESC');
    } else {
      qb.orderBy('ep.engagementProjectId', 'DESC');
    }

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    const projectIds = rows.map((p) => p.engagementProjectId);
    const dmaByProject = new Map<number, number[]>();
    if (projectIds.length > 0) {
      const links = await this.projectDmaRepo.find({
        where: { engagementProjectId: In(projectIds) },
        order: { engagementProjectId: 'ASC', dmaid: 'ASC' },
      });
      for (const link of links) {
        const arr = dmaByProject.get(link.engagementProjectId) ?? [];
        arr.push(link.dmaid);
        dmaByProject.set(link.engagementProjectId, arr);
      }
    }

    return {
      data: rows.map((p) => ({
        engagementProjectId: p.engagementProjectId,
        tourId: p.tourId,
        attractionId: p.tour?.attractionId ?? null,
        tourName: p.tour?.tourName ?? null,
        attractionName: p.tour?.attraction?.attractionName ?? null,
        talentAgencyCompanyId: p.tour?.talentAgencyCompanyId ?? null,
        talentAgencyCompanyName: p.tour?.talentAgencyCompany?.companyName ?? null,
        projectStage: p.projectStage,
        createdDate: p.createdDate,
        createdBy: p.createdBy,
        name: null,
        bookerId: null,
        agentContactId: null,
        dmaIds: dmaByProject.get(p.engagementProjectId) ?? [],
        targetOnSale: null,
        notes: null,
      })),
      total,
    };
  }

  async getOne(id: number) {
    const project = await this.projectRepo.findOne({
      where: { engagementProjectId: id },
      relations: {
        tour: { attraction: true, talentAgencyCompany: true },
      },
    });
    if (!project) {
      throw new NotFoundException({
        message: `Project with ID ${id} not found.`,
      });
    }
    return this.buildProjectResponse(project);
  }

  // ─── Project Venue APIs ───────────────────────────────────────────────────

  async addVenue(
    projectId: number,
    dto: AddProjectVenueDto,
  ): Promise<{ engagementProjectVenueId: number }> {
    await this.assertProjectExists(projectId);
    await this.assertVenueCompany(dto.venueCompanyId);
    await this.assertValidVenueStatus(dto.venueStatus);

    const existing = await this.projectVenueRepo.findOne({
      where: {
        engagementProjectId: projectId,
        venueCompanyId: dto.venueCompanyId,
      },
    });
    if (existing) {
      throw new ConflictException({
        message: 'This venue is already added to this project.',
      });
    }

    for (const opt of dto.performanceOptions ?? []) {
      await this.assertValidOptionStatus(opt.optionStatus);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const pv = manager.create(EngagementProjectVenue, {
          engagementProjectId: projectId,
          venueCompanyId: dto.venueCompanyId,
          venueStatus: dto.venueStatus,
        });
        const saved = await manager.save(pv);

        for (const opt of dto.performanceOptions ?? []) {
          const o = manager.create(EngagementProjectPerformanceOption, {
            engagementProjectId: projectId,
            engagementProjectVenueId: saved.engagementProjectVenueId,
            proposedDate: opt.proposedDate,
            proposedTime: this.normalizeTime(opt.proposedTime),
            optionStatus: opt.optionStatus,
          });
          await manager.save(o);
        }

        return { engagementProjectVenueId: saved.engagementProjectVenueId };
      });
    } catch (e: unknown) {
      if (
        e instanceof ConflictException ||
        e instanceof BadRequestException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      if (e instanceof QueryFailedError) {
        return this.mapProjectVenueQueryFailed(
          'add',
          projectId,
          e,
          dto.venueStatus,
        );
      }
      throw e;
    }
  }

  async updateVenue(
    projectId: number,
    venueId: number,
    dto: UpdateProjectVenueDto,
  ): Promise<void> {
    const pv = await this.assertVenueInProject(projectId, venueId);
    if (dto.venueStatus !== undefined) {
      await this.assertValidVenueStatus(dto.venueStatus);
      pv.venueStatus = dto.venueStatus;
    }
    await this.projectVenueRepo.save(pv);
  }

  async removeVenue(projectId: number, venueId: number): Promise<void> {
    await this.assertVenueInProject(projectId, venueId);
    await this.optionRepo.delete({
      engagementProjectVenueId: venueId,
    });
    await this.projectVenueRepo.delete({
      engagementProjectId: projectId,
      engagementProjectVenueId: venueId,
    });
  }

  // ─── Performance Option APIs ──────────────────────────────────────────────

  async addPerformanceOption(
    projectId: number,
    dto: AddPerformanceOptionDto,
  ): Promise<{ performanceOptionId: number }> {
    await this.assertProjectExists(projectId);
    await this.assertValidOptionStatus(dto.optionStatus);
    const opt = this.optionRepo.create({
      engagementProjectId: projectId,
      engagementProjectVenueId: null,
      proposedDate: dto.proposedDate,
      proposedTime: this.normalizeTime(dto.proposedTime),
      optionStatus: dto.optionStatus,
    });
    const saved = await this.optionRepo.save(opt);
    return { performanceOptionId: saved.performanceOptionId };
  }

  async updatePerformanceOption(
    projectId: number,
    optionId: number,
    dto: UpdatePerformanceOptionDto,
  ): Promise<void> {
    const opt = await this.assertOptionInProject(projectId, optionId);
    if (dto.proposedDate !== undefined) opt.proposedDate = dto.proposedDate;
    if (dto.proposedTime !== undefined)
      opt.proposedTime = this.normalizeTime(dto.proposedTime);
    if (dto.optionStatus !== undefined) {
      await this.assertValidOptionStatus(dto.optionStatus);
      opt.optionStatus = dto.optionStatus;
    }
    await this.optionRepo.save(opt);
  }

  async removePerformanceOption(
    projectId: number,
    optionId: number,
  ): Promise<void> {
    await this.assertOptionInProject(projectId, optionId);
    await this.optionRepo.delete({
      engagementProjectId: projectId,
      performanceOptionId: optionId,
    });
  }
}
