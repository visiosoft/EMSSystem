import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { EngagementProject } from '../entities/engagement-project.entity';
import { EngagementProjectVenue } from '../entities/engagement-project-venue.entity';
import { EngagementProjectPerformanceOption } from '../entities/engagement-project-performance-option.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectVenueDto } from './dto/add-project-venue.dto';
import { UpdateProjectVenueDto } from './dto/update-project-venue.dto';
import { AddPerformanceOptionDto } from './dto/add-performance-option.dto';
import { UpdatePerformanceOptionDto } from './dto/update-performance-option.dto';
import { parseStringLiteralsFromCheckDefinition } from './project-stage-check.util';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  private static readonly PROJECT_STAGE_LIST_TTL_MS = 60_000;
  private projectStageListCache: {
    at: number;
    result: {
      values: string[];
      source: 'check_constraint' | 'environment' | 'existing_rows' | 'empty';
    };
  } | null = null;

  constructor(
    @InjectRepository(EngagementProject)
    private readonly projectRepo: Repository<EngagementProject>,
    @InjectRepository(EngagementProjectVenue)
    private readonly projectVenueRepo: Repository<EngagementProjectVenue>,
    @InjectRepository(EngagementProjectPerformanceOption)
    private readonly optionRepo: Repository<EngagementProjectPerformanceOption>,
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
    if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    if (parts.length === 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0').slice(0, 2)}`;
    throw new BadRequestException({ message: 'Invalid time format. Use HH:MM or HH:MM:SS.' });
  }

  private formatTime(t: string | null): string | null {
    if (!t) return null;
    // DB may return HH:MM:SS or HH:MM, normalize to HH:MM for response
    const parts = t.split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return t;
  }

  private parseProjectStageEnvFallback(): string[] {
    const raw = process.env.PROJECT_STAGE_ALLOWLIST?.trim();
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private async loadProjectStageValuesFromDatabase(): Promise<string[] | null> {
    const rows: { definition: string }[] = await this.dataSource.query(
      `
      SELECT cc.definition AS [definition]
      FROM sys.check_constraints AS cc
      INNER JOIN sys.objects AS t ON cc.parent_object_id = t.object_id
      WHERE t.object_id = OBJECT_ID('dbo.EngagementProject', 'U')
        AND cc.is_disabled = 0
        AND cc.definition LIKE N'%ProjectStage%'
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      for (const v of parseStringLiteralsFromCheckDefinition(r.definition)) {
        collected.add(v);
      }
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  /**
   * Values that already exist in the table are guaranteed to satisfy the CHECK
   * (as long as the CHECK has not changed since the rows were inserted).
   */
  private async loadProjectStagesFromExistingRows(): Promise<string[] | null> {
    const rows: Record<string, string>[] = await this.dataSource.query(
      `
      SELECT DISTINCT LTRIM(RTRIM(CAST([ProjectStage] AS NVARCHAR(200)))) AS [stage]
      FROM [dbo].[EngagementProject]
      WHERE [ProjectStage] IS NOT NULL
        AND LEN(LTRIM(RTRIM(CAST([ProjectStage] AS NVARCHAR(200))))) > 0
    `,
    );
    if (!rows?.length) return null;
    const collected = new Set<string>();
    for (const r of rows) {
      const val = r['stage'] ?? r['Stage'];
      if (val != null) collected.add(String(val).trim());
    }
    if (collected.size === 0) return null;
    return [...collected].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private async resolveProjectStageAllowlist(): Promise<{
    values: string[];
    source: 'check_constraint' | 'environment' | 'existing_rows' | 'empty';
  }> {
    const fromEnv = this.parseProjectStageEnvFallback();
    if (fromEnv.length > 0) {
      return { values: fromEnv, source: 'environment' };
    }
    try {
      const fromCheck = await this.loadProjectStageValuesFromDatabase();
      if (fromCheck && fromCheck.length > 0) {
        return { values: fromCheck, source: 'check_constraint' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read CHECK definition for dbo.EngagementProject.ProjectStage: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      const fromRows = await this.loadProjectStagesFromExistingRows();
      if (fromRows && fromRows.length > 0) {
        this.logger.log(
          `Project stage list taken from existing dbo.EngagementProject rows (${fromRows.length} distinct value(s)).`,
        );
        return { values: fromRows, source: 'existing_rows' };
      }
    } catch (e) {
      this.logger.warn(
        `Could not read distinct ProjectStage from dbo.EngagementProject: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    this.logger.warn(
      'No project stages: set PROJECT_STAGE_ALLOWLIST on the API to the exact values allowed by the database CHECK, or add at least one project row the DB will accept so we can read distinct ProjectStage values.',
    );
    return { values: [], source: 'empty' };
  }

  /**
   * Allowed `ProjectStage` values: parsed from the SQL Server CHECK on the column, or
   * from env `PROJECT_STAGE_ALLOWLIST` (comma-separated) if the CHECK cannot be read.
   */
  async getProjectStageMeta(): Promise<{
    projectStages: string[];
    source: 'check_constraint' | 'environment' | 'existing_rows' | 'empty';
  }> {
    const now = Date.now();
    if (this.projectStageListCache && now - this.projectStageListCache.at < ProjectService.PROJECT_STAGE_LIST_TTL_MS) {
      const r = this.projectStageListCache.result;
      return { projectStages: r.values, source: r.source };
    }
    const r = await this.resolveProjectStageAllowlist();
    this.projectStageListCache = { at: now, result: r };
    return { projectStages: r.values, source: r.source };
  }

  /**
   * When the allowlist is empty (CHECK not readable, no env, no existing rows), we do **not** block
   * the request here — SQL Server enforces the CHECK and returns the real driver error in `detail`
   * on failure. When we do have an allowlist, we match the previous app validation.
   */
  private async assertValidProjectStage(stage: string): Promise<void> {
    const { projectStages } = await this.getProjectStageMeta();
    if (projectStages.length === 0) {
      return;
    }
    if (!projectStages.includes(stage)) {
      throw new BadRequestException({
        message: `Invalid project stage "${stage}". Allowed values: ${projectStages.join(', ')}.`,
      });
    }
  }

  private async assertTourExists(tourId: number): Promise<Tour> {
    const tour = await this.tourRepo.findOne({ where: { tourId } });
    if (!tour) {
      throw new BadRequestException({ message: `Tour with ID ${tourId} not found.` });
    }
    return tour;
  }

  private async assertVenueCompany(venueCompanyId: number): Promise<void> {
    const company = await this.companyRepo.findOne({ where: { companyId: venueCompanyId } });
    if (!company) {
      throw new BadRequestException({ message: `Company with ID ${venueCompanyId} not found.` });
    }
    const venue = await this.venueRepo.findOne({ where: { companyId: venueCompanyId } });
    if (!venue) {
      throw new BadRequestException({ message: 'Company exists but is not a venue.' });
    }
  }

  private async assertProjectExists(id: number): Promise<EngagementProject> {
    const project = await this.projectRepo.findOne({ where: { engagementProjectId: id } });
    if (!project) {
      throw new NotFoundException({ message: `Project with ID ${id} not found.` });
    }
    return project;
  }

  private async assertVenueInProject(projectId: number, venueId: number): Promise<EngagementProjectVenue> {
    const venue = await this.projectVenueRepo.findOne({
      where: { engagementProjectId: projectId, engagementProjectVenueId: venueId },
    });
    if (!venue) {
      throw new NotFoundException({ message: `Venue proposal with ID ${venueId} not found in project ${projectId}.` });
    }
    return venue;
  }

  private async assertOptionInProject(projectId: number, optionId: number): Promise<EngagementProjectPerformanceOption> {
    const option = await this.optionRepo.findOne({
      where: { engagementProjectId: projectId, performanceOptionId: optionId },
    });
    if (!option) {
      throw new NotFoundException({ message: `Performance option with ID ${optionId} not found in project ${projectId}.` });
    }
    return option;
  }

  // ─── Build response shape ─────────────────────────────────────────────────

  private async buildProjectResponse(project: EngagementProject) {
    const tour = await this.tourRepo.findOne({ where: { tourId: project.tourId } });
    const attraction = tour
      ? await this.attractionRepo.findOne({ where: { attractionId: tour.attractionId } })
      : null;

    const dbVenues = await this.projectVenueRepo.find({
      where: { engagementProjectId: project.engagementProjectId },
    });

    const options = await this.optionRepo.find({
      where: { engagementProjectId: project.engagementProjectId },
      order: { proposedDate: 'ASC' },
    });

    const venuesWithDetails = await Promise.all(
      dbVenues.map(async (v) => {
        const company = await this.companyRepo.findOne({ where: { companyId: v.venueCompanyId } });
        const venue = await this.venueRepo.findOne({ where: { companyId: v.venueCompanyId } });
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
          performanceOptions: options.map((o) => ({
            performanceOptionId: o.performanceOptionId,
            engagementProjectId: o.engagementProjectId,
            proposedDate: o.proposedDate,
            proposedTime: this.formatTime(o.proposedTime),
            optionStatus: o.optionStatus,
          })),
        };
      }),
    );

    return {
      engagementProjectId: project.engagementProjectId,
      tourId: project.tourId,
      tourName: tour?.tourName ?? null,
      attractionName: attraction?.attractionName ?? null,
      projectStage: project.projectStage,
      createdDate: project.createdDate,
      createdBy: project.createdBy,
      // Frontend-only fields returned as null
      name: null,
      bookerId: null,
      agentContactId: null,
      dmaIds: [],
      targetOnSale: null,
      notes: null,
      venues: venuesWithDetails,
    };
  }

  // ─── Project CRUD ─────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto): Promise<{ engagementProjectId: number }> {
    await this.assertTourExists(dto.tourId);
    await this.assertValidProjectStage(dto.projectStage);

    // Validate all venues before writing anything
    for (const v of dto.venues ?? []) {
      await this.assertVenueCompany(v.venueCompanyId);
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

        for (const v of dto.venues ?? []) {
          const pv = manager.create(EngagementProjectVenue, {
            engagementProjectId: savedProject.engagementProjectId,
            venueCompanyId: v.venueCompanyId,
            venueStatus: v.venueStatus,
          });
          await manager.save(EngagementProjectVenue, pv);

          for (const opt of v.performanceOptions ?? []) {
            const o = manager.create(EngagementProjectPerformanceOption, {
              engagementProjectId: savedProject.engagementProjectId,
              proposedDate: opt.proposedDate,
              proposedTime: this.normalizeTime(opt.proposedTime),
              optionStatus: opt.optionStatus,
            });
            await manager.save(EngagementProjectPerformanceOption, o);
          }
        }

        return { engagementProjectId: savedProject.engagementProjectId };
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const d = String((err as QueryFailedError).driverError ?? err.message);
        this.logger.warn(`Create project failed: ${d}`);
        const isStageCheck =
          /CHECK constraint/i.test(d) && /ProjectStage/i.test(d);
        throw new BadRequestException({
          message: isStageCheck
            ? 'This project stage isn’t accepted for this project. Choose a different stage, or ask your administrator to update the allowed stages for your system.'
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
      await this.assertValidProjectStage(dto.projectStage);
      project.projectStage = dto.projectStage;
    }
    if (dto.createdBy !== undefined) project.createdBy = dto.createdBy?.trim() ?? null;
    if (dto.tourId !== undefined) {
      await this.assertTourExists(dto.tourId);
      project.tourId = dto.tourId;
    }
    try {
      await this.projectRepo.save(project);
    } catch (e: unknown) {
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
        await manager.delete(EngagementProjectVenue, { engagementProjectId: id });
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

  async list() {
    const projects = await this.projectRepo.find({ order: { engagementProjectId: 'DESC' } });
    return await Promise.all(
      projects.map(async (p) => {
        const tour = await this.tourRepo.findOne({ where: { tourId: p.tourId } });
        const attraction = tour
          ? await this.attractionRepo.findOne({ where: { attractionId: tour.attractionId } })
          : null;
        return {
          engagementProjectId: p.engagementProjectId,
          tourId: p.tourId,
          tourName: tour?.tourName ?? null,
          attractionName: attraction?.attractionName ?? null,
          projectStage: p.projectStage,
          createdDate: p.createdDate,
          createdBy: p.createdBy,
          name: null,
          bookerId: null,
          agentContactId: null,
          dmaIds: [],
          targetOnSale: null,
          notes: null,
        };
      }),
    );
  }

  async getOne(id: number) {
    const project = await this.assertProjectExists(id);
    return this.buildProjectResponse(project);
  }

  // ─── Project Venue APIs ───────────────────────────────────────────────────

  async addVenue(
    projectId: number,
    dto: AddProjectVenueDto,
  ): Promise<{ engagementProjectVenueId: number }> {
    await this.assertProjectExists(projectId);
    await this.assertVenueCompany(dto.venueCompanyId);

    return await this.dataSource.transaction(async (manager) => {
      const pv = manager.create(EngagementProjectVenue, {
        engagementProjectId: projectId,
        venueCompanyId: dto.venueCompanyId,
        venueStatus: dto.venueStatus,
      });
      const saved = await manager.save(EngagementProjectVenue, pv);

      for (const opt of dto.performanceOptions ?? []) {
        const o = manager.create(EngagementProjectPerformanceOption, {
          engagementProjectId: projectId,
          proposedDate: opt.proposedDate,
          proposedTime: this.normalizeTime(opt.proposedTime),
          optionStatus: opt.optionStatus,
        });
        await manager.save(EngagementProjectPerformanceOption, o);
      }

      return { engagementProjectVenueId: saved.engagementProjectVenueId };
    });
  }

  async updateVenue(
    projectId: number,
    venueId: number,
    dto: UpdateProjectVenueDto,
  ): Promise<void> {
    const pv = await this.assertVenueInProject(projectId, venueId);
    if (dto.venueStatus !== undefined) pv.venueStatus = dto.venueStatus;
    await this.projectVenueRepo.save(pv);
  }

  async removeVenue(projectId: number, venueId: number): Promise<void> {
    await this.assertVenueInProject(projectId, venueId);
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
    const opt = this.optionRepo.create({
      engagementProjectId: projectId,
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
    if (dto.proposedTime !== undefined) opt.proposedTime = this.normalizeTime(dto.proposedTime);
    if (dto.optionStatus !== undefined) opt.optionStatus = dto.optionStatus;
    await this.optionRepo.save(opt);
  }

  async removePerformanceOption(projectId: number, optionId: number): Promise<void> {
    await this.assertOptionInProject(projectId, optionId);
    await this.optionRepo.delete({
      engagementProjectId: projectId,
      performanceOptionId: optionId,
    });
  }
}
