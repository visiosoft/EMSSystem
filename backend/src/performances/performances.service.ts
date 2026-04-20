import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';

export interface PerformanceCalendarRow {
  performanceId: number;
  engagementId: number;
  performanceStatus: string;
  performanceDate: string;     // YYYY-MM-DD
  performanceTime: string;     // HH:MM:SS
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

@Injectable()
export class PerformancesService {
  constructor(
    @InjectRepository(Performance)
    private readonly performanceRepo: Repository<Performance>,
  ) {}

  async findAll(year?: number, month?: number): Promise<PerformanceCalendarRow[]> {
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
      .select([
        'p.performanceId         AS performanceId',
        'p.engagementId          AS engagementId',
        'p.performanceStatus     AS performanceStatus',
        // CAST to varchar so raw result is always a plain string
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
      ])
      .orderBy('p.performanceDate', 'ASC')
      .addOrderBy('p.performanceTime', 'ASC');

    if (year !== undefined && !isNaN(year)) {
      qb.andWhere('YEAR(p.performanceDate) = :year', { year });
    }
    if (month !== undefined && !isNaN(month)) {
      qb.andWhere('MONTH(p.performanceDate) = :month', { month });
    }

    const raw = await qb.getRawMany<Record<string, unknown>>();

    return raw.map((r) => ({
      performanceId: Number(r['performanceId']),
      engagementId: Number(r['engagementId']),
      performanceStatus: String(r['performanceStatus'] ?? ''),
      performanceDate: String(r['performanceDate'] ?? ''),
      performanceTime: String(r['performanceTime'] ?? ''),
      engagementStatus: String(r['engagementStatus'] ?? ''),
      tourId: r['tourId'] != null ? Number(r['tourId']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      attractionId: r['attractionId'] != null ? Number(r['attractionId']) : null,
      attractionName: r['attractionName'] != null ? String(r['attractionName']) : null,
      venueCompanyId: r['venueCompanyId'] != null ? Number(r['venueCompanyId']) : null,
      venueCompanyName: r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince: r['stateProvince'] != null ? String(r['stateProvince']) : null,
    }));
  }
}
