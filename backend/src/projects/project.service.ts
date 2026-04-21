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

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

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
        throw new BadRequestException({
          message:
            'Could not create the project. Check that the tour exists and that project data matches database rules (stage, tour link, and related keys).',
          detail: d,
        });
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateProjectDto): Promise<void> {
    const project = await this.assertProjectExists(id);
    if (dto.projectStage !== undefined) project.projectStage = dto.projectStage;
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
            'Could not update the project. Check project stage, tour link, and related data.',
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
