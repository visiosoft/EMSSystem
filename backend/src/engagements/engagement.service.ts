import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Dma } from '../entities/dma.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { EmsAppCreatedStore } from '../attraction-tours/ems-app-created.store';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { CreatePerformanceDto } from './dto/create-performance.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { AddEngagementVenueDto } from './dto/add-engagement-venue.dto';

export interface EngagementListRow {
  engagementId: number;
  engagementStatus: string;
  engagementScaling: string | null;
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
    private readonly emsCreated: EmsAppCreatedStore,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalizeTime(t: string): string {
    const parts = t.trim().split(':');
    if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
    if (parts.length === 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0').slice(0,2)}`;
    throw new BadRequestException({ message: 'Invalid performance time.' });
  }

  private async assertVenueCompany(venueCompanyId: number): Promise<void> {
    const company = await this.companyRepo.findOne({ where: { companyId: venueCompanyId } });
    if (!company) throw new BadRequestException({ message: `Company ${venueCompanyId} not found.` });
    const venue = await this.venueRepo.findOne({ where: { companyId: venueCompanyId } });
    if (!venue) throw new BadRequestException({ message: 'Company exists but is not a venue.' });
  }

  private async assertEngagementExists(id: number): Promise<Engagement> {
    const e = await this.engagementRepo.findOne({ where: { engagementId: id } });
    if (!e) throw new NotFoundException({ message: 'Engagement not found.' });
    return e;
  }

  private buildDisplayTitle(attractionName: string | null, tourName: string, venueLabel: string): string {
    if (!attractionName) return `${tourName} @ ${venueLabel}`;
    return `${attractionName} — ${tourName} @ ${venueLabel}`;
  }

  /**
   * Core query: Engagement → Tour → Attraction (for attraction name/id)
   *                         → EngagementVenue (primary) → Venue → Company → Address → DMA
   */
  private buildEngagementQuery(whereId?: number) {
    const qb = this.engagementRepo
      .createQueryBuilder('e')
      .innerJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .leftJoin(EngagementVenue, 'ev', 'ev.engagementId = e.engagementId AND ev.isPrimary = :prim', { prim: true })
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin(Address, 'addr', 'addr.addressId = vc.physicalAddressId')
      .leftJoin(Dma, 'dma', 'dma.dmaid = vc.dmaid')
      .select([
        'e.engagementId         AS engagementId',
        'e.engagementStatus     AS engagementStatus',
        'e.engagementScaling    AS engagementScaling',
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
      ]);
    if (whereId !== undefined) qb.where('e.engagementId = :id', { id: whereId });
    else qb.orderBy('e.engagementId', 'DESC');
    return qb;
  }

  private mapRaw(r: Record<string, unknown>): EngagementListRow {
    const g = (k: string) => pickRaw(r, k);
    const attractionName = g('attractionName') != null ? String(g('attractionName')) : null;
    const tourName = String(g('tourName') ?? '');
    const venueCompanyName = g('venueCompanyName') != null ? String(g('venueCompanyName')) : null;
    const venueName = g('venueName') != null ? String(g('venueName')) : null;
    const venueLabel = venueCompanyName ?? venueName ?? 'Venue';
    const engagementId = Number(g('engagementId'));
    return {
      engagementId,
      engagementStatus: String(g('engagementStatus') ?? ''),
      engagementScaling: g('engagementScaling') != null ? String(g('engagementScaling')) : null,
      attractionId: g('attractionId') != null ? Number(g('attractionId')) : null,
      attractionName,
      tourId: Number(g('tourId')),
      tourName,
      primaryVenueCompanyId: g('primaryVenueCompanyId') != null ? Number(g('primaryVenueCompanyId')) : null,
      venueCompanyName,
      venueName,
      city: g('city') != null ? String(g('city')) : null,
      stateProvince: g('stateProvince') != null ? String(g('stateProvince')) : null,
      dmaMarketName: g('dmaMarketName') != null ? String(g('dmaMarketName')) : null,
      displayTitle: this.buildDisplayTitle(attractionName, tourName, venueLabel),
      appCreated: this.emsCreated.canDeleteEngagement(engagementId),
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async list(): Promise<EngagementListRow[]> {
    const raw = await this.buildEngagementQuery().getRawMany();
    return (raw as Record<string, unknown>[]).map((r) => this.mapRaw(r));
  }

  async getOne(id: number): Promise<EngagementListRow> {
    const raw = await this.buildEngagementQuery(id).getRawOne();
    if (!raw) throw new NotFoundException({ message: 'Engagement not found.' });
    return this.mapRaw(raw as Record<string, unknown>);
  }

  async create(dto: CreateEngagementDto): Promise<{ engagementId: number }> {
    // Validate tour exists
    const tour = await this.tourRepo.findOne({ where: { tourId: dto.tourId } });
    if (!tour) throw new BadRequestException({ message: `Tour ${dto.tourId} not found.` });

    await this.assertVenueCompany(dto.primaryVenueCompanyId);
    for (const id of dto.secondaryVenueCompanyIds ?? []) await this.assertVenueCompany(id);

    return await this.dataSource.transaction(async (manager) => {
      const row = manager.create(Engagement, {
        engagementStatus: dto.engagementStatus.trim(),
        engagementScaling: dto.engagementScaling?.trim() || null,
        tourId: dto.tourId,
      });
      const saved = await manager.save(Engagement, row);

      await manager.save(EngagementVenue, manager.create(EngagementVenue, {
        engagementId: saved.engagementId,
        venueCompanyId: dto.primaryVenueCompanyId,
        isPrimary: true,
      }));

      for (const secId of dto.secondaryVenueCompanyIds ?? []) {
        await manager.save(EngagementVenue, manager.create(EngagementVenue, {
          engagementId: saved.engagementId,
          venueCompanyId: secId,
          isPrimary: false,
        }));
      }

      this.emsCreated.recordEngagement(saved.engagementId);
      return { engagementId: saved.engagementId };
    });
  }

  async update(id: number, dto: UpdateEngagementDto): Promise<void> {
    const existing = await this.assertEngagementExists(id);

    if (dto.tourId !== undefined) {
      const tour = await this.tourRepo.findOne({ where: { tourId: dto.tourId } });
      if (!tour) throw new BadRequestException({ message: 'Tour not found.' });
      existing.tourId = dto.tourId;
    }
    if (dto.engagementStatus !== undefined) existing.engagementStatus = dto.engagementStatus.trim();
    if (dto.engagementScaling !== undefined) existing.engagementScaling = dto.engagementScaling?.trim() || null;

    await this.engagementRepo.save(existing);

    if (dto.primaryVenueCompanyId != null) {
      await this.assertVenueCompany(dto.primaryVenueCompanyId);
      await this.dataSource.transaction(async (manager) => {
        const current = await manager.findOne(EngagementVenue, { where: { engagementId: id, isPrimary: true } });
        if (current) { current.isPrimary = false; await manager.save(EngagementVenue, current); }
        const existing2 = await manager.findOne(EngagementVenue, { where: { engagementId: id, venueCompanyId: dto.primaryVenueCompanyId } });
        if (existing2) { existing2.isPrimary = true; await manager.save(EngagementVenue, existing2); }
        else {
          await manager.save(EngagementVenue, manager.create(EngagementVenue, {
            engagementId: id, venueCompanyId: dto.primaryVenueCompanyId, isPrimary: true,
          }));
        }
      });
    }
  }

  async remove(id: number): Promise<void> {
    if (!this.emsCreated.canDeleteEngagement(id)) {
      throw new ForbiddenException({ message: 'Only engagements created in this app can be removed.' });
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Performance, { engagementId: id });
      await manager.delete(EngagementVenue, { engagementId: id });
      await manager.delete(Engagement, { engagementId: id });
    });
  }

  // ─── Venues ───────────────────────────────────────────────────────────────

  async listVenues(engagementId: number) {
    await this.assertEngagementExists(engagementId);
    const rows = await this.engagementVenueRepo.find({ where: { engagementId } });
    return await Promise.all(rows.map(async (ev) => {
      const company = await this.companyRepo.findOne({ where: { companyId: ev.venueCompanyId }, relations: ['physicalAddress', 'dma'] });
      const venue = await this.venueRepo.findOne({ where: { companyId: ev.venueCompanyId } });
      return {
        engagementId: ev.engagementId,
        venueCompanyId: ev.venueCompanyId,
        venueCompanyName: company?.companyName ?? null,
        venueName: venue?.venueName ?? null,
        city: company?.physicalAddress?.city ?? null,
        stateProvince: company?.physicalAddress?.stateProvince ?? null,
        dmaMarketName: company?.dma?.marketName ?? null,
        isPrimary: Boolean(ev.isPrimary),
      };
    }));
  }

  async addVenue(engagementId: number, dto: AddEngagementVenueDto): Promise<{ added: boolean }> {
    await this.assertEngagementExists(engagementId);
    await this.assertVenueCompany(dto.venueCompanyId);
    const existing = await this.engagementVenueRepo.findOne({ where: { engagementId, venueCompanyId: dto.venueCompanyId } });
    if (existing) throw new ConflictException({ message: 'Venue already linked to this engagement.' });
    const isPrimary = dto.isPrimary === true;
    await this.dataSource.transaction(async (manager) => {
      if (isPrimary) {
        const cur = await manager.findOne(EngagementVenue, { where: { engagementId, isPrimary: true } });
        if (cur) { cur.isPrimary = false; await manager.save(EngagementVenue, cur); }
      }
      await manager.save(EngagementVenue, manager.create(EngagementVenue, { engagementId, venueCompanyId: dto.venueCompanyId, isPrimary }));
    });
    return { added: true };
  }

  async removeVenue(engagementId: number, venueCompanyId: number): Promise<void> {
    await this.assertEngagementExists(engagementId);
    const row = await this.engagementVenueRepo.findOne({ where: { engagementId, venueCompanyId } });
    if (!row) throw new NotFoundException({ message: 'Venue not linked to this engagement.' });
    const all = await this.engagementVenueRepo.find({ where: { engagementId } });
    if (all.length === 1) throw new ConflictException({ message: 'Cannot remove the only venue.' });
    if (row.isPrimary && all.filter(v => !v.isPrimary).length > 0) {
      throw new ForbiddenException({ message: 'Reassign primary before removing it.' });
    }
    await this.engagementVenueRepo.delete({ engagementId, venueCompanyId });
  }

  // ─── Performances ─────────────────────────────────────────────────────────

  async listPerformances(engagementId: number) {
    await this.assertEngagementExists(engagementId);
    const rows = await this.performanceRepo.find({ where: { engagementId }, order: { performanceDate: 'ASC', performanceTime: 'ASC' } });
    return rows.map((r) => ({
      performanceId: r.performanceId,
      engagementId: r.engagementId,
      performanceStatus: r.performanceStatus,
      performanceDate: r.performanceDate,
      performanceTime: r.performanceTime,
    }));
  }

  async createPerformance(engagementId: number, dto: CreatePerformanceDto): Promise<{ performanceId: number }> {
    await this.assertEngagementExists(engagementId);
    const row = this.performanceRepo.create({
      engagementId,
      performanceDate: dto.performanceDate,
      performanceTime: this.normalizeTime(dto.performanceTime),
      performanceStatus: dto.performanceStatus?.trim() || 'Public',
    });
    const saved = await this.performanceRepo.save(row);
    return { performanceId: saved.performanceId };
  }
}
