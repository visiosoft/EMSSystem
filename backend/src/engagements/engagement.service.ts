import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { EmsAppCreatedStore } from '../attraction-tours/ems-app-created.store';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { CreatePerformanceDto } from './dto/create-performance.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';

export interface EngagementListRow {
  engagementId: number;
  engagementStatus: string;
  engagementScaling: string | null;
  attractionId: number;
  attractionName: string;
  tourId: number | null;
  tourName: string | null;
  primaryVenueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
  /** Human-readable title for UI (not a DB column). */
  displayTitle: string;
  appCreated: boolean;
}

function pickRaw(r: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in r) return r[k];
    const lower = k.toLowerCase();
    const found = Object.keys(r).find((x) => x.toLowerCase() === lower);
    if (found) return r[found];
  }
  return undefined;
}

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(Engagement)
    private readonly engagementRepo: Repository<Engagement>,
    @InjectRepository(EngagementVenue)
    private readonly engagementVenueRepo: Repository<EngagementVenue>,
    @InjectRepository(Attraction)
    private readonly attractionRepo: Repository<Attraction>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Performance)
    private readonly performanceRepo: Repository<Performance>,
    private readonly emsCreated: EmsAppCreatedStore,
  ) {}

  private normalizeTimeToSql(t: string): string {
    const s = t.trim();
    const parts = s.split(':');
    if (parts.length === 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    }
    if (parts.length === 3) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0').slice(0, 2)}`;
    }
    throw new BadRequestException({ message: 'Invalid performance time.' });
  }

  async listPerformances(engagementId: number) {
    const e = await this.engagementRepo.findOne({ where: { engagementId } });
    if (!e) {
      throw new NotFoundException({ message: 'Engagement not found.' });
    }
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
    const e = await this.engagementRepo.findOne({ where: { engagementId } });
    if (!e) {
      throw new NotFoundException({ message: 'Engagement not found.' });
    }
    const performanceTime = this.normalizeTimeToSql(dto.performanceTime);
    const row = this.performanceRepo.create({
      engagementId,
      performanceDate: dto.performanceDate,
      performanceTime,
      performanceStatus: dto.performanceStatus?.trim() || 'Public',
    });
    const saved = await this.performanceRepo.save(row);
    return { performanceId: saved.performanceId };
  }

  private mapRawToRow(r: Record<string, unknown>): EngagementListRow {
    const g = (camel: string, ...alts: string[]) =>
      pickRaw(r, [camel, ...alts]);
    const engagementId = Number(g('engagementId'));
    const attractionName = String(g('attractionName') ?? '');
    const tourName =
      g('tourName') != null ? String(g('tourName')) : null;
    const venueCompanyName =
      g('venueCompanyName') != null ? String(g('venueCompanyName')) : null;
    const venueName = g('venueName') != null ? String(g('venueName')) : null;
    const venueLabel = venueCompanyName ?? venueName ?? 'Venue';
    const displayTitle = `${attractionName} — ${tourName ?? 'Tour TBD'} @ ${venueLabel}`;
    return {
      engagementId,
      engagementStatus: String(g('engagementStatus') ?? ''),
      engagementScaling:
        g('engagementScaling') != null ? String(g('engagementScaling')) : null,
      attractionId: Number(g('attractionId')),
      attractionName,
      tourId: g('tourId') != null ? Number(g('tourId')) : null,
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
      displayTitle,
      appCreated: this.emsCreated.canDeleteEngagement(engagementId),
    };
  }

  async list(): Promise<EngagementListRow[]> {
    const raw = await this.engagementRepo
      .createQueryBuilder('e')
      .innerJoin(Attraction, 'a', 'a.attractionId = e.attractionId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(
        EngagementVenue,
        'ev',
        'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
        { prim: true },
      )
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin('vc.physicalAddress', 'addr')
      .leftJoin('vc.dma', 'dma')
      .select([
        'e.engagementId AS engagementId',
        'e.engagementStatus AS engagementStatus',
        'e.engagementScaling AS engagementScaling',
        'e.attractionId AS attractionId',
        'a.attractionName AS attractionName',
        'e.tourId AS tourId',
        't.tourName AS tourName',
        'ev.venueCompanyId AS primaryVenueCompanyId',
        'vc.companyName AS venueCompanyName',
        'v.venueName AS venueName',
        'addr.city AS city',
        'addr.stateProvince AS stateProvince',
        'dma.marketName AS dmaMarketName',
      ])
      .orderBy('e.engagementId', 'DESC')
      .getRawMany();

    return (raw as Record<string, unknown>[]).map((row) =>
      this.mapRawToRow(row),
    );
  }

  async getOne(id: number): Promise<EngagementListRow> {
    const raw = await this.engagementRepo
      .createQueryBuilder('e')
      .innerJoin(Attraction, 'a', 'a.attractionId = e.attractionId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(
        EngagementVenue,
        'ev',
        'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
        { prim: true },
      )
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin('vc.physicalAddress', 'addr')
      .leftJoin('vc.dma', 'dma')
      .select([
        'e.engagementId AS engagementId',
        'e.engagementStatus AS engagementStatus',
        'e.engagementScaling AS engagementScaling',
        'e.attractionId AS attractionId',
        'a.attractionName AS attractionName',
        'e.tourId AS tourId',
        't.tourName AS tourName',
        'ev.venueCompanyId AS primaryVenueCompanyId',
        'vc.companyName AS venueCompanyName',
        'v.venueName AS venueName',
        'addr.city AS city',
        'addr.stateProvince AS stateProvince',
        'dma.marketName AS dmaMarketName',
      ])
      .where('e.engagementId = :id', { id })
      .getRawOne();

    if (!raw) {
      throw new NotFoundException({ message: 'Engagement not found.' });
    }
    return this.mapRawToRow(raw as Record<string, unknown>);
  }

  private async assertTourMatchesAttraction(
    tourId: number,
    attractionId: number,
  ): Promise<void> {
    const tour = await this.tourRepo.findOne({ where: { tourId } });
    if (!tour) {
      throw new NotFoundException({ message: 'Tour not found.' });
    }
    if (tour.attractionId !== attractionId) {
      throw new NotFoundException({
        message: 'Tour does not belong to the selected attraction.',
      });
    }
  }

  private async assertVenueCompany(venueCompanyId: number): Promise<void> {
    const venue = await this.venueRepo.findOne({
      where: { companyId: venueCompanyId },
    });
    if (!venue) {
      throw new NotFoundException({
        message: 'Venue not found for this company. Pick a company that has a venue profile.',
      });
    }
  }

  async create(dto: CreateEngagementDto): Promise<{ engagementId: number }> {
    const attraction = await this.attractionRepo.findOne({
      where: { attractionId: dto.attractionId },
    });
    if (!attraction) {
      throw new NotFoundException({ message: 'Attraction not found.' });
    }
    if (dto.tourId != null) {
      await this.assertTourMatchesAttraction(dto.tourId, dto.attractionId);
    }
    await this.assertVenueCompany(dto.primaryVenueCompanyId);

    const row = this.engagementRepo.create({
      engagementStatus: dto.engagementStatus.trim(),
      engagementScaling: dto.engagementScaling?.trim() || null,
      attractionId: dto.attractionId,
      tourId: dto.tourId ?? null,
    });
    const saved = await this.engagementRepo.save(row);

    const ev = this.engagementVenueRepo.create({
      engagementId: saved.engagementId,
      venueCompanyId: dto.primaryVenueCompanyId,
      isPrimary: true,
    });
    await this.engagementVenueRepo.save(ev);

    this.emsCreated.recordEngagement(saved.engagementId);
    return { engagementId: saved.engagementId };
  }

  async update(id: number, dto: UpdateEngagementDto): Promise<void> {
    const existing = await this.engagementRepo.findOne({
      where: { engagementId: id },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Engagement not found.' });
    }

    const attractionId = dto.attractionId ?? existing.attractionId;
    if (dto.attractionId != null) {
      const a = await this.attractionRepo.findOne({
        where: { attractionId: dto.attractionId },
      });
      if (!a) throw new NotFoundException({ message: 'Attraction not found.' });
      existing.attractionId = dto.attractionId;
    }

    if (dto.tourId !== undefined) {
      if (dto.tourId != null) {
        await this.assertTourMatchesAttraction(dto.tourId, attractionId);
      }
      existing.tourId = dto.tourId;
    } else if (dto.attractionId != null && existing.tourId != null) {
      await this.assertTourMatchesAttraction(existing.tourId, attractionId);
    }

    if (dto.engagementStatus !== undefined) {
      existing.engagementStatus = dto.engagementStatus.trim();
    }
    if (dto.engagementScaling !== undefined) {
      existing.engagementScaling = dto.engagementScaling?.trim() || null;
    }

    await this.engagementRepo.save(existing);

    if (dto.primaryVenueCompanyId != null) {
      await this.assertVenueCompany(dto.primaryVenueCompanyId);
      await this.engagementVenueRepo.delete({ engagementId: id });
      await this.engagementVenueRepo.save(
        this.engagementVenueRepo.create({
          engagementId: id,
          venueCompanyId: dto.primaryVenueCompanyId,
          isPrimary: true,
        }),
      );
    }
  }

  async remove(id: number): Promise<void> {
    if (!this.emsCreated.canDeleteEngagement(id)) {
      throw new ForbiddenException({
        message: 'Only engagements created in this app can be removed.',
        detail: 'Pre-existing engagements cannot be deleted from the API.',
      });
    }
    await this.performanceRepo.delete({ engagementId: id });
    await this.engagementVenueRepo.delete({ engagementId: id });
    await this.engagementRepo.delete({ engagementId: id });
  }
}
