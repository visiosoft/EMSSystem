import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Dma } from '../entities/dma.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { TicketingSales } from '../entities/ticketing-sales.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { EmsAppCreatedStore } from '../attraction-tours/ems-app-created.store';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { CreatePerformanceDto } from './dto/create-performance.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { AddEngagementVenueDto } from './dto/add-engagement-venue.dto';
import { buildEngagementDisplayTitle } from './engagement-display.util';
import { normalizeEngagementStatus } from './engagement-status.util';

export interface EngagementListRow {
  engagementId: number;
  engagementStatus: string;
  /** Earliest dbo.Performance for this engagement (opening show), if any */
  openingPerformanceDate: string | null;
  openingPerformanceTime: string | null;
  /** Derived via Engagement → Tour → Attraction */
  attractionId: number | null;
  attractionName: string | null;
  tourId: number;
  tourName: string;
  primaryVenueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  displayTitle: string;
  appCreated: boolean;
}

export interface EngagementVenueRow {
  engagementId: number;
  venueCompanyId: number;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  isPrimary: boolean;
}

/** Query params for {@link EngagementService.listPaginated}. */
export interface EngagementListFilters {
  q?: string;
  status?: string;
  attractionName?: string;
  dmaMarketName?: string;
  venueLabel?: string;
  timing?: 'all' | 'upcoming' | 'past';
}

function pickRaw(r: Record<string, unknown>, key: string): unknown {
  if (key in r) return r[key];
  const lower = key.toLowerCase();
  const found = Object.keys(r).find((x) => x.toLowerCase() === lower);
  return found ? r[found] : undefined;
}

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(Engagement)
    private readonly engagementRepo: Repository<Engagement>,
    @InjectRepository(EngagementVenue)
    private readonly engagementVenueRepo: Repository<EngagementVenue>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Performance)
    private readonly performanceRepo: Repository<Performance>,
    @InjectRepository(TicketingSales)
    private readonly ticketingSalesRepo: Repository<TicketingSales>,
    private readonly emsCreated: EmsAppCreatedStore,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalizeTime(t: string): string {
    const parts = t.trim().split(':');
    if (parts.length === 2)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    if (parts.length === 3)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0').slice(0, 2)}`;
    throw new BadRequestException({ message: 'Invalid performance time format. Expected HH:mm or HH:mm:ss.' });
  }

  private async assertVenueCompany(venueCompanyId: number): Promise<void> {
    const company = await this.companyRepo.findOne({
      where: { companyId: venueCompanyId },
    });
    if (!company) {
      throw new BadRequestException({
        message: `Company with ID ${venueCompanyId} does not exist.`,
      });
    }
    const venue = await this.venueRepo.findOne({
      where: { companyId: venueCompanyId },
    });
    if (!venue) {
      throw new BadRequestException({
        message: `Company #${venueCompanyId} exists but is not registered as a venue.`,
      });
    }
  }

  private async assertEngagementExists(id: number): Promise<Engagement> {
    const e = await this.engagementRepo.findOne({ where: { engagementId: id } });
    if (!e)
      throw new NotFoundException({ message: `Engagement #${id} not found.` });
    return e;
  }

  /**
   * Core query:
   *   Engagement → Tour → Attraction (attraction name/id)
   *             → EngagementVenue (primary) → Venue → Company → Address + DMA
   */
  private buildEngagementQuery(whereId?: number) {
    const qb = this.engagementRepo
      .createQueryBuilder('e')
      .innerJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .leftJoin(
        EngagementVenue,
        'ev',
        'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
        { prim: true },
      )
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin(Address, 'addr', 'addr.addressId = vc.physicalAddressId')
      .leftJoin(Dma, 'dma', 'dma.dmaid = vc.dmaid')
      .select([
        'e.engagementId         AS engagementId',
        'e.engagementStatus     AS engagementStatus',
        'e.tourId               AS tourId',
        't.tourName             AS tourName',
        't.attractionId         AS attractionId',
        'a.attractionName       AS attractionName',
        'ev.venueCompanyId      AS primaryVenueCompanyId',
        'vc.companyName         AS venueCompanyName',
        'v.venueName            AS venueName',
        'addr.city              AS city',
        'addr.stateProvince     AS stateProvince',
        'dma.marketName         AS dmaMarketName',
      ])
      .addSelect(this.openingPerformanceDateSubquery(), 'openingPerformanceDate')
      .addSelect(this.openingPerformanceTimeSubquery(), 'openingPerformanceTime');

    if (whereId !== undefined) {
      qb.where('e.engagementId = :id', { id: whereId });
    } else {
      qb.orderBy('e.engagementId', 'DESC');
    }
    return qb;
  }

  /**
   * Normalize opening date to `yyyy-MM-dd` (never pass driver Date through JSON).
   * Drops `1970-01-01` (epoch placeholder from bad/missing data).
   */
  private parseOpeningDateOnly(raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) return null;
      const y = raw.getUTCFullYear();
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
      const d = String(raw.getUTCDate()).padStart(2, '0');
      const ymd = `${y}-${m}-${d}`;
      return ymd === '1970-01-01' ? null : ymd;
    }
    const s = String(raw).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return null;
    return m[1] === '1970-01-01' ? null : m[1];
  }

  /**
   * Normalize opening time to `HH:mm:ss` (wall clock, no long locale strings).
   */
  private parseOpeningTimeOnly(raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) return null;
      const h = String(raw.getUTCHours()).padStart(2, '0');
      const min = String(raw.getUTCMinutes()).padStart(2, '0');
      const sec = String(raw.getUTCSeconds()).padStart(2, '0');
      return `${h}:${min}:${sec}`;
    }
    const s = String(raw).trim();
    const t = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (t) {
      const h = String(Math.min(23, Math.max(0, parseInt(t[1], 10)))).padStart(2, '0');
      const min = t[2].padStart(2, '0');
      const sec = (t[3] ?? '00').padStart(2, '0');
      return `${h}:${min}:${sec}`;
    }
    if (s.length > 20 && (s.includes('GMT') || s.includes('1970'))) return null;
    return null;
  }

  private mapRaw(r: Record<string, unknown>): EngagementListRow {
    const g = (k: string) => pickRaw(r, k);
    const attractionName =
      g('attractionName') != null ? String(g('attractionName')) : null;
    const tourName = String(g('tourName') ?? '');
    const venueCompanyName =
      g('venueCompanyName') != null ? String(g('venueCompanyName')) : null;
    const venueName = g('venueName') != null ? String(g('venueName')) : null;
    const venueLabel = venueCompanyName ?? venueName ?? 'TBD';
    const engagementId = Number(g('engagementId'));

    const openingDate = this.parseOpeningDateOnly(g('openingPerformanceDate'));
    const openingTime = this.parseOpeningTimeOnly(g('openingPerformanceTime'));

    return {
      engagementId,
      engagementStatus: normalizeEngagementStatus(
        String(g('engagementStatus') ?? ''),
      ),
      openingPerformanceDate: openingDate,
      openingPerformanceTime: openingTime,
      attractionId:
        g('attractionId') != null ? Number(g('attractionId')) : null,
      attractionName,
      tourId: Number(g('tourId')),
      tourName,
      primaryVenueCompanyId:
        g('primaryVenueCompanyId') != null
          ? Number(g('primaryVenueCompanyId'))
          : null,
      venueCompanyName,
      venueName,
      city: g('city') != null ? String(g('city')) : null,
      stateProvince:
        g('stateProvince') != null ? String(g('stateProvince')) : null,
      dmaMarketName:
        g('dmaMarketName') != null ? String(g('dmaMarketName')) : null,
      displayTitle: buildEngagementDisplayTitle(
        attractionName,
        tourName,
        venueLabel,
      ),
      appCreated: this.emsCreated.canDeleteEngagement(engagementId),
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async list(): Promise<EngagementListRow[]> {
    const raw = await this.buildEngagementQuery().getRawMany();
    return (raw as Record<string, unknown>[]).map((r) => this.mapRaw(r));
  }

  /**
   * Earliest performance date as `yyyy-MM-dd` string (avoids driver `Date` objects
   * serializing to long GMT strings in the API).
   */
  private openingPerformanceDateSubquery(): string {
    return `(
          SELECT TOP 1 CONVERT(varchar(10), op.PerformanceDate, 23)
          FROM dbo.[Performance] op
          WHERE op.EngagementID = e.EngagementID
          ORDER BY op.PerformanceDate ASC, op.PerformanceTime ASC
        )`;
  }

  /** Earliest performance time as `HH:mm:ss` string (see {@link openingPerformanceDateSubquery}). */
  private openingPerformanceTimeSubquery(): string {
    return `(
          SELECT TOP 1 CONVERT(varchar(8), op.PerformanceTime, 108)
          FROM dbo.[Performance] op
          WHERE op.EngagementID = e.EngagementID
          ORDER BY op.PerformanceDate ASC, op.PerformanceTime ASC
        )`;
  }

  private applyEngagementListFilters(
    qb: SelectQueryBuilder<Engagement>,
    f: EngagementListFilters,
  ): void {
    const q = (f.q ?? '').trim();
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        `(LOWER(CAST(e.engagementId AS VARCHAR(20))) LIKE LOWER(:like) OR LOWER(ISNULL(a.attractionName, '')) LIKE LOWER(:like) OR LOWER(t.tourName) LIKE LOWER(:like) OR LOWER(ISNULL(vc.companyName, '')) LIKE LOWER(:like) OR LOWER(ISNULL(v.venueName, '')) LIKE LOWER(:like) OR LOWER(ISNULL(dma.marketName, '')) LIKE LOWER(:like) OR LOWER(ISNULL(e.engagementStatus, '')) LIKE LOWER(:like) OR LOWER(ISNULL(addr.city, '')) LIKE LOWER(:like) OR LOWER(ISNULL(addr.stateProvince, '')) LIKE LOWER(:like))`,
        { like },
      );
    }

    const st = (f.status ?? '').trim();
    if (st && st !== 'All') {
      if (st === 'Unknown') {
        qb.andWhere(
          `(e.engagementStatus IS NULL OR LTRIM(RTRIM(e.engagementStatus)) NOT IN ('Private', 'Public'))`,
        );
      } else if (st === 'Private' || st === 'Public') {
        qb.andWhere('LTRIM(RTRIM(e.engagementStatus)) = :stExact', { stExact: st });
      }
    }

    const an = (f.attractionName ?? '').trim();
    if (an) {
      qb.andWhere('a.attractionName = :an', { an });
    }

    const dma = (f.dmaMarketName ?? '').trim();
    if (dma) {
      qb.andWhere('dma.marketName = :dma', { dma });
    }

    const vl = (f.venueLabel ?? '').trim();
    if (vl) {
      qb.andWhere('(vc.companyName = :vl OR v.venueName = :vl)', { vl });
    }

    const openingSub = this.openingPerformanceDateSubquery();
    if (f.timing === 'upcoming') {
      qb.andWhere(
        `(${openingSub} IS NULL OR CAST(${openingSub} AS DATE) >= CAST(GETDATE() AS DATE))`,
      );
    } else if (f.timing === 'past') {
      qb.andWhere(
        `(${openingSub} IS NOT NULL AND CAST(${openingSub} AS DATE) < CAST(GETDATE() AS DATE))`,
      );
    }
  }

  async listPaginated(
    offset: number,
    limit: number,
    filters: EngagementListFilters = {},
  ): Promise<{ data: EngagementListRow[]; total: number }> {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const off = Math.max(0, offset);

    const qb = this.buildEngagementQuery();
    this.applyEngagementListFilters(qb, filters);
    const total = await qb.clone().getCount();
    const raw = await qb.skip(off).take(safeLimit).getRawMany();
    return {
      data: (raw as Record<string, unknown>[]).map((r) => this.mapRaw(r)),
      total,
    };
  }

  /** Distinct filter values for engagements list UI (not tied to current page). */
  async filterOptions(): Promise<{
    attractionNames: string[];
    dmaMarketNames: string[];
    venueLabels: string[];
  }> {
    const attractionNames = (
      await this.engagementRepo
        .createQueryBuilder('e')
        .innerJoin(Tour, 't', 't.tourId = e.tourId')
        .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
        .select('a.attractionName', 'name')
        .where('a.attractionName IS NOT NULL')
        .distinct(true)
        .orderBy('a.attractionName', 'ASC')
        .getRawMany<{ name: string }>()
    ).map((r) => String(r.name ?? ''));

    const dmaMarketNames = (
      await this.engagementRepo
        .createQueryBuilder('e')
        .innerJoin(Tour, 't', 't.tourId = e.tourId')
        .leftJoin(
          EngagementVenue,
          'ev',
          'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
          { prim: true },
        )
        .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
        .leftJoin(Dma, 'dma', 'dma.dmaid = vc.dmaid')
        .select('dma.marketName', 'name')
        .where('dma.marketName IS NOT NULL')
        .distinct(true)
        .orderBy('dma.marketName', 'ASC')
        .getRawMany<{ name: string }>()
    ).map((r) => String(r.name ?? ''));

    const venueRows = await this.engagementRepo
      .createQueryBuilder('e')
      .innerJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(
        EngagementVenue,
        'ev',
        'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
        { prim: true },
      )
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .select(['vc.companyName AS cn', 'v.venueName AS vn'])
      .getRawMany<{ cn: string | null; vn: string | null }>();

    const venueSet = new Set<string>();
    for (const r of venueRows) {
      const label = (r.cn?.trim() || r.vn?.trim() || '').trim();
      if (label) venueSet.add(label);
    }
    const venueLabels = [...venueSet].sort((a, b) => a.localeCompare(b));

    return { attractionNames, dmaMarketNames, venueLabels };
  }

  async getOne(id: number): Promise<EngagementListRow> {
    const raw = await this.buildEngagementQuery(id).getRawOne();
    if (!raw)
      throw new NotFoundException({ message: `Engagement #${id} not found.` });
    return this.mapRaw(raw as Record<string, unknown>);
  }

  async create(dto: CreateEngagementDto): Promise<{ engagementId: number }> {
    // Validate tour
    const tour = await this.tourRepo.findOne({ where: { tourId: dto.tourId } });
    if (!tour) {
      throw new BadRequestException({
        message: `Tour #${dto.tourId} does not exist.`,
      });
    }

    // Validate venues before transaction
    await this.assertVenueCompany(dto.primaryVenueCompanyId);
    if (dto.secondaryVenueCompanyIds?.length) {
      for (const secId of dto.secondaryVenueCompanyIds) {
        if (secId === dto.primaryVenueCompanyId) {
          throw new BadRequestException({
            message: `Secondary venue #${secId} is the same as the primary venue.`,
          });
        }
        await this.assertVenueCompany(secId);
      }
    }

    return await this.dataSource.transaction(async (manager) => {
      const row = manager.create(Engagement, {
        engagementStatus: dto.engagementStatus.trim(),
        engagementScaling: null,
        tourId: dto.tourId,
      });
      const saved = await manager.save(Engagement, row);

      await manager.save(
        EngagementVenue,
        manager.create(EngagementVenue, {
          engagementId: saved.engagementId,
          venueCompanyId: dto.primaryVenueCompanyId,
          isPrimary: true,
        }),
      );

      for (const secId of dto.secondaryVenueCompanyIds ?? []) {
        await manager.save(
          EngagementVenue,
          manager.create(EngagementVenue, {
            engagementId: saved.engagementId,
            venueCompanyId: secId,
            isPrimary: false,
          }),
        );
      }

      const perfStatus =
        dto.engagementStatus === 'Private' || dto.engagementStatus === 'Public'
          ? dto.engagementStatus
          : 'Public';
      await manager.save(
        Performance,
        manager.create(Performance, {
          engagementId: saved.engagementId,
          performanceDate: dto.openingShowDate,
          performanceTime: this.normalizeTime(dto.openingShowTime),
          performanceStatus: perfStatus,
        }),
      );

      this.emsCreated.recordEngagement(saved.engagementId);
      return { engagementId: saved.engagementId };
    });
  }

  async update(id: number, dto: UpdateEngagementDto): Promise<void> {
    const existing = await this.assertEngagementExists(id);

    if (dto.tourId !== undefined) {
      const tour = await this.tourRepo.findOne({
        where: { tourId: dto.tourId },
      });
      if (!tour) {
        throw new BadRequestException({
          message: `Tour #${dto.tourId} does not exist.`,
        });
      }
      existing.tourId = dto.tourId;
    }

    if (dto.engagementStatus !== undefined) {
      existing.engagementStatus = dto.engagementStatus.trim();
    }

    await this.engagementRepo.save(existing);

    // Update primary venue if requested
    if (dto.primaryVenueCompanyId != null) {
      await this.assertVenueCompany(dto.primaryVenueCompanyId);

      await this.dataSource.transaction(async (manager) => {
        // Demote existing primary
        const current = await manager.findOne(EngagementVenue, {
          where: { engagementId: id, isPrimary: true },
        });
        if (current && current.venueCompanyId !== dto.primaryVenueCompanyId) {
          current.isPrimary = false;
          await manager.save(EngagementVenue, current);
        }

        // Promote or insert new primary
        const targetRow = await manager.findOne(EngagementVenue, {
          where: { engagementId: id, venueCompanyId: dto.primaryVenueCompanyId },
        });
        if (targetRow) {
          targetRow.isPrimary = true;
          await manager.save(EngagementVenue, targetRow);
        } else {
          await manager.save(
            EngagementVenue,
            manager.create(EngagementVenue, {
              engagementId: id,
              venueCompanyId: dto.primaryVenueCompanyId,
              isPrimary: true,
            }),
          );
        }
      });
    }
  }

  /**
   * Deletion is allowed for any engagement unless:
   * - the earliest (opening) show date is **before today** (server date), or
   * - **TicketingSales** rows exist for any of its performances (revenue / ticket data).
   */
  private async assertEngagementDeletableForDelete(engagementId: number): Promise<void> {
    await this.assertEngagementExists(engagementId);

    const minRow = await this.performanceRepo
      .createQueryBuilder('p')
      .select('MIN(CAST(p.performanceDate AS date))', 'minD')
      .where('p.engagementId = :eid', { eid: engagementId })
      .getRawOne<{ minD: Date | string | null }>();
    const raw = minRow?.minD;
    if (raw != null) {
      const ymd =
        raw instanceof Date
          ? `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`
          : String(raw).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        const t = new Date();
        const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (ymd < todayStr) {
          throw new BadRequestException({
            message:
              'The first show for this engagement is in the past. Remove or archive it instead of deleting.',
          });
        }
      }
    }

    const salesCount = await this.ticketingSalesRepo
      .createQueryBuilder('ts')
      .innerJoin(Performance, 'p', 'p.performanceId = ts.performanceId')
      .where('p.engagementId = :eid', { eid: engagementId })
      .getCount();
    if (salesCount > 0) {
      throw new BadRequestException({
        message:
          'This engagement has ticket sales or revenue on file for one or more performances. Resolve or reassign that data in Daily Sales / ticketing before deleting.',
      });
    }
  }

  async remove(id: number): Promise<void> {
    await this.assertEngagementDeletableForDelete(id);

    await this.dataSource.transaction(async (manager) => {
      const pids = (
        await manager.find(Performance, {
          where: { engagementId: id },
          select: { performanceId: true },
        })
      ).map((p) => p.performanceId);
      if (pids.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(TicketingSales)
          .where('performanceId IN (:...pids)', { pids })
          .execute();
      }
      await manager.delete(Performance, { engagementId: id });
      await manager.delete(EngagementVenue, { engagementId: id });
      await manager.delete(Engagement, { engagementId: id });
    });

    this.emsCreated.removeEngagement(id);
  }

  // ─── Venues ───────────────────────────────────────────────────────────────

  async listVenues(engagementId: number): Promise<EngagementVenueRow[]> {
    await this.assertEngagementExists(engagementId);

    const evRows = await this.engagementVenueRepo.find({
      where: { engagementId },
      order: { isPrimary: 'DESC' },
    });

    if (evRows.length === 0) return [];

    const venueCompanyIds = evRows.map((ev) => ev.venueCompanyId);

    // Batch-load companies + venues (avoids N+1)
    const [companies, venues] = await Promise.all([
      this.companyRepo.find({
        where: { companyId: In(venueCompanyIds) },
        relations: ['physicalAddress', 'dma'],
      }),
      this.venueRepo.find({ where: { companyId: In(venueCompanyIds) } }),
    ]);

    const companyMap = new Map(companies.map((c) => [c.companyId, c]));
    const venueMap = new Map(venues.map((v) => [v.companyId, v]));

    return evRows.map((ev) => {
      const company = companyMap.get(ev.venueCompanyId);
      const venue = venueMap.get(ev.venueCompanyId);
      return {
        engagementId: ev.engagementId,
        venueCompanyId: ev.venueCompanyId,
        venueCompanyName: company?.companyName ?? null,
        venueName: venue?.venueName ?? null,
        city: (company as any)?.physicalAddress?.city ?? null,
        stateProvince: (company as any)?.physicalAddress?.stateProvince ?? null,
        dmaMarketName: (company as any)?.dma?.marketName ?? null,
        isPrimary: Boolean(ev.isPrimary),
      };
    });
  }

  async addVenue(
    engagementId: number,
    dto: AddEngagementVenueDto,
  ): Promise<{ added: boolean }> {
    await this.assertEngagementExists(engagementId);
    await this.assertVenueCompany(dto.venueCompanyId);

    const existing = await this.engagementVenueRepo.findOne({
      where: { engagementId, venueCompanyId: dto.venueCompanyId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'This venue is already linked to the engagement.',
      });
    }

    const isPrimary = dto.isPrimary === true;

    await this.dataSource.transaction(async (manager) => {
      if (isPrimary) {
        const cur = await manager.findOne(EngagementVenue, {
          where: { engagementId, isPrimary: true },
        });
        if (cur) {
          cur.isPrimary = false;
          await manager.save(EngagementVenue, cur);
        }
      }
      await manager.save(
        EngagementVenue,
        manager.create(EngagementVenue, {
          engagementId,
          venueCompanyId: dto.venueCompanyId,
          isPrimary,
        }),
      );
    });

    return { added: true };
  }

  async removeVenue(engagementId: number, venueCompanyId: number): Promise<void> {
    await this.assertEngagementExists(engagementId);

    const row = await this.engagementVenueRepo.findOne({
      where: { engagementId, venueCompanyId },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'This venue is not linked to the engagement.',
      });
    }

    const allVenues = await this.engagementVenueRepo.find({
      where: { engagementId },
    });
    if (allVenues.length === 1) {
      throw new ConflictException({
        message: 'Cannot remove the only venue. An engagement must have at least one venue.',
      });
    }

    if (row.isPrimary) {
      const secondaries = allVenues.filter((v) => !v.isPrimary);
      if (secondaries.length === 0) {
        throw new ConflictException({
          message: 'Cannot remove the primary venue when no secondary venues exist. Reassign primary first.',
        });
      }
    }

    await this.engagementVenueRepo.delete({ engagementId, venueCompanyId });
  }

  // ─── Performances ─────────────────────────────────────────────────────────

  async listPerformances(engagementId: number) {
    await this.assertEngagementExists(engagementId);
    const rows = await this.performanceRepo.find({
      where: { engagementId },
      order: { performanceDate: 'ASC', performanceTime: 'ASC' },
    });
    return rows.map((r) => ({
      performanceId: r.performanceId,
      engagementId: r.engagementId,
      performanceStatus: r.performanceStatus,
      performanceDate: r.performanceDate,
      performanceTime: r.performanceTime,
    }));
  }

  async createPerformance(
    engagementId: number,
    dto: CreatePerformanceDto,
  ): Promise<{ performanceId: number }> {
    await this.assertEngagementExists(engagementId);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.performanceDate)) {
      throw new BadRequestException({
        message: 'Invalid performance date. Expected format: YYYY-MM-DD.',
      });
    }

    const row = this.performanceRepo.create({
      engagementId,
      performanceDate: dto.performanceDate,
      performanceTime: this.normalizeTime(dto.performanceTime),
      performanceStatus: dto.performanceStatus?.trim() || 'Public',
    });

    const saved = await this.performanceRepo.save(row);
    return { performanceId: saved.performanceId };
  }

  async updatePerformance(
    engagementId: number,
    performanceId: number,
    dto: {
      performanceDate?: string;
      performanceTime?: string;
      performanceStatus?: string;
    },
  ): Promise<void> {
    await this.assertEngagementExists(engagementId);

    const perf = await this.performanceRepo.findOne({
      where: { performanceId, engagementId },
    });
    if (!perf) {
      throw new NotFoundException({
        message: `Performance #${performanceId} not found for engagement #${engagementId}.`,
      });
    }

    if (dto.performanceDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.performanceDate)) {
        throw new BadRequestException({
          message: 'Invalid performance date. Expected format: YYYY-MM-DD.',
        });
      }
      perf.performanceDate = dto.performanceDate;
    }

    if (dto.performanceTime !== undefined) {
      perf.performanceTime = this.normalizeTime(dto.performanceTime);
    }

    if (dto.performanceStatus !== undefined) {
      perf.performanceStatus = dto.performanceStatus.trim() || 'Public';
    }

    await this.performanceRepo.save(perf);
  }

  async deletePerformance(
    engagementId: number,
    performanceId: number,
  ): Promise<void> {
    await this.assertEngagementExists(engagementId);

    const perf = await this.performanceRepo.findOne({
      where: { performanceId, engagementId },
    });
    if (!perf) {
      throw new NotFoundException({
        message: `Performance #${performanceId} not found for engagement #${engagementId}.`,
      });
    }

    await this.performanceRepo.delete({ performanceId, engagementId });
  }
}