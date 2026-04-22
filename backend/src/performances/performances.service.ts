import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { normalizeEngagementStatus } from '../engagements/engagement-status.util';

export interface PerformanceCalendarRow {
  performanceId: number;
  engagementId: number;
  performanceStatus: string;
  performanceDate: string; // YYYY-MM-DD
  performanceTime: string; // HH:MM:SS
  engagementStatus: string;
  tourId: number | null;
  tourName: string | null;
  attractionId: number | null;
  attractionName: string | null;
  venueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
}

const CALENDAR_SELECT = [
  'p.performanceId         AS performanceId',
  'p.engagementId          AS engagementId',
  'p.performanceStatus     AS performanceStatus',
  'CONVERT(varchar(10), p.performanceDate, 120) AS performanceDate',
  'CONVERT(varchar(8),  p.performanceTime, 108) AS performanceTime',
  'e.engagementStatus      AS engagementStatus',
  'e.tourId                AS tourId',
  't.tourName              AS tourName',
  't.attractionId          AS attractionId',
  'a.attractionName        AS attractionName',
  'ev.venueCompanyId       AS venueCompanyId',
  'vc.companyName          AS venueCompanyName',
  'v.venueName             AS venueName',
  'addr.city               AS city',
  'addr.stateProvince      AS stateProvince',
] as const;

@Injectable()
export class PerformancesService {
  constructor(
    @InjectRepository(Performance)
    private readonly performanceRepo: Repository<Performance>,
  ) {}

  private buildCalendarQuery(
    year?: number,
    month?: number,
  ): SelectQueryBuilder<Performance> {
    const qb = this.performanceRepo
      .createQueryBuilder('p')
      .innerJoin(Engagement, 'e', 'e.engagementId = p.engagementId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
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
      .select([...CALENDAR_SELECT])
      .orderBy('p.performanceDate', 'ASC')
      .addOrderBy('p.performanceTime', 'ASC');

    if (year !== undefined && !isNaN(year)) {
      qb.andWhere('YEAR(p.performanceDate) = :year', { year });
    }
    if (month !== undefined && !isNaN(month)) {
      qb.andWhere('MONTH(p.performanceDate) = :month', { month });
    }
    return qb;
  }

  /** Optional visibility filter for calendar list (subset of Unknown / Private / Public). */
  private applyVisibilityFilter(
    qb: SelectQueryBuilder<Performance>,
    visibility: string[],
  ): void {
    const allowed = new Set(['Unknown', 'Private', 'Public']);
    const wanted = [...new Set(visibility.map((s) => s.trim()))].filter((s) => allowed.has(s));
    if (wanted.length === 0 || wanted.length >= 3) return;

    const orParts: string[] = [];
    if (wanted.includes('Private')) {
      orParts.push(`e.engagementStatus = 'Private'`);
    }
    if (wanted.includes('Public')) {
      orParts.push(`e.engagementStatus = 'Public'`);
    }
    if (wanted.includes('Unknown')) {
      orParts.push(
        `(e.engagementStatus IS NULL OR e.engagementStatus NOT IN ('Private', 'Public'))`,
      );
    }
    if (orParts.length > 0) {
      qb.andWhere(`(${orParts.join(' OR ')})`);
    }
  }

  private mapCalendarRaw(r: Record<string, unknown>): PerformanceCalendarRow {
    return {
      performanceId: Number(r['performanceId']),
      engagementId: Number(r['engagementId']),
      performanceStatus: String(r['performanceStatus'] ?? ''),
      performanceDate: String(r['performanceDate'] ?? ''),
      performanceTime: String(r['performanceTime'] ?? ''),
      engagementStatus: normalizeEngagementStatus(String(r['engagementStatus'] ?? '')),
      tourId: r['tourId'] != null ? Number(r['tourId']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      attractionId: r['attractionId'] != null ? Number(r['attractionId']) : null,
      attractionName: r['attractionName'] != null ? String(r['attractionName']) : null,
      venueCompanyId: r['venueCompanyId'] != null ? Number(r['venueCompanyId']) : null,
      venueCompanyName: r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince: r['stateProvince'] != null ? String(r['stateProvince']) : null,
    };
  }

  async findAll(year?: number, month?: number): Promise<PerformanceCalendarRow[]> {
    const qb = this.buildCalendarQuery(year, month);
    const raw = await qb.getRawMany<Record<string, unknown>>();
    return raw.map((r) => this.mapCalendarRaw(r));
  }

  async findAllPaginated(
    year: number,
    month: number,
    offset: number,
    limit: number,
    visibility: string[],
  ): Promise<{ data: PerformanceCalendarRow[]; total: number }> {
    const qb = this.buildCalendarQuery(year, month);
    this.applyVisibilityFilter(qb, visibility);
    const total = await qb.getCount();
    const raw = await qb.offset(offset).limit(limit).getRawMany<Record<string, unknown>>();
    return {
      data: raw.map((r) => this.mapCalendarRaw(r)),
      total,
    };
  }
}
