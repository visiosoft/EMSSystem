import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { TicketingSales } from '../entities/ticketing-sales.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';

export interface DailySalesRow {
  performanceId: number;
  engagementId: number;
  salesDate: string;
  performanceDate: string;
  performanceTime: string;
  performanceStatus: string;
  engagementStatus: string;
  ticketsSold: number | null;
  revenue: number | null;
  tourId: number | null;
  tourName: string | null;
  attractionId: number | null;
  attractionName: string | null;
  venueCompanyId: number | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  dmaMarketName: string | null;
}

/** Row returned by GET /daily-sales/by-performance — one row per Performance */
export interface PerformanceSalesRow {
  performanceId: number;
  engagementId: number;
  performanceDate: string;     // YYYY-MM-DD
  performanceTime: string;     // HH:MM:SS
  performanceStatus: string;
  engagementStatus: string;
  attractionName: string | null;
  tourName: string | null;
  venueCompanyName: string | null;
  venueName: string | null;
  city: string | null;
  stateProvince: string | null;
  /** Today's ISO date string YYYY-MM-DD */
  todayDate: string;
  todayTicketsSold: number | null;
  todayRevenue: number | null;
  /** Yesterday's ISO date string YYYY-MM-DD */
  yesterdayDate: string;
  yesterdayTicketsSold: number | null;
  yesterdayRevenue: number | null;
}

@Injectable()
export class DailySalesService {
  constructor(
    @InjectRepository(TicketingSales)
    private readonly salesRepo: Repository<TicketingSales>,
    @InjectRepository(Performance)
    private readonly performanceRepo: Repository<Performance>,
  ) {}

  // ─── GET /daily-sales (legacy flat list) ──────────────────────────────────

  async findAll(engagementId?: number): Promise<DailySalesRow[]> {
    const qb = this.salesRepo
      .createQueryBuilder('ts')
      .innerJoin(Performance, 'p', 'p.performanceId = ts.performanceId')
      .innerJoin(Engagement, 'e', 'e.engagementId = p.engagementId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .leftJoin(EngagementVenue, 'ev', 'ev.engagementId = e.engagementId AND ev.isPrimary = :prim', { prim: true })
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin(Address, 'addr', 'addr.addressId = vc.physicalAddressId')
      .leftJoin('vc.dma', 'dma')
      .select([
        'ts.performanceId                                        AS performanceId',
        'p.engagementId                                         AS engagementId',
        'CONVERT(varchar(10), ts.salesDate, 120)                AS salesDate',
        'CONVERT(varchar(10), p.performanceDate, 120)           AS performanceDate',
        'CONVERT(varchar(8),  p.performanceTime, 108)           AS performanceTime',
        'p.performanceStatus                                     AS performanceStatus',
        'e.engagementStatus                                      AS engagementStatus',
        'ts.performanceSalesQuantity                             AS ticketsSold',
        'ts.performanceSalesRevenue                              AS revenue',
        'e.tourId                                                AS tourId',
        't.tourName                                              AS tourName',
        't.attractionId                                          AS attractionId',
        'a.attractionName                                        AS attractionName',
        'ev.venueCompanyId                                       AS venueCompanyId',
        'vc.companyName                                          AS venueCompanyName',
        'v.venueName                                             AS venueName',
        'addr.city                                               AS city',
        'addr.stateProvince                                      AS stateProvince',
        'dma.marketName                                          AS dmaMarketName',
      ])
      .orderBy('ts.salesDate', 'DESC')
      .addOrderBy('p.performanceDate', 'ASC');

    if (engagementId !== undefined && !isNaN(engagementId)) {
      qb.andWhere('e.engagementId = :engagementId', { engagementId });
    }

    const raw = await qb.getRawMany<Record<string, unknown>>();
    return raw.map((r) => ({
      performanceId: Number(r['performanceId']),
      engagementId: Number(r['engagementId']),
      salesDate: String(r['salesDate'] ?? ''),
      performanceDate: String(r['performanceDate'] ?? ''),
      performanceTime: String(r['performanceTime'] ?? ''),
      performanceStatus: String(r['performanceStatus'] ?? ''),
      engagementStatus: String(r['engagementStatus'] ?? ''),
      ticketsSold: r['ticketsSold'] != null ? Number(r['ticketsSold']) : null,
      revenue: r['revenue'] != null ? Number(r['revenue']) : null,
      tourId: r['tourId'] != null ? Number(r['tourId']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      attractionId: r['attractionId'] != null ? Number(r['attractionId']) : null,
      attractionName: r['attractionName'] != null ? String(r['attractionName']) : null,
      venueCompanyId: r['venueCompanyId'] != null ? Number(r['venueCompanyId']) : null,
      venueCompanyName: r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince: r['stateProvince'] != null ? String(r['stateProvince']) : null,
      dmaMarketName: r['dmaMarketName'] != null ? String(r['dmaMarketName']) : null,
    }));
  }

  // ─── GET /daily-sales/by-performance ─────────────────────────────────────
  /**
   * Returns one row per Performance.
   * Each row includes sales totals for TODAY and YESTERDAY (left-joined).
   * Uses SQL Server CONVERT + GETDATE() / DATEADD so dates are always server-timezone.
   * Optional filter: performanceDate (YYYY-MM-DD)
   */
  async findByPerformance(performanceDate?: string): Promise<PerformanceSalesRow[]> {
    // We use a raw query because we need two conditional left-joins on TicketingSales
    const qb = this.performanceRepo
      .createQueryBuilder('p')
      .innerJoin(Engagement, 'e', 'e.engagementId = p.engagementId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .leftJoin(EngagementVenue, 'ev', 'ev.engagementId = e.engagementId AND ev.isPrimary = :prim', { prim: true })
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin(Address, 'addr', 'addr.addressId = vc.physicalAddressId')
      // Today's sales — left join on matching performanceId AND today's date
      .leftJoin(
        TicketingSales,
        'ts_today',
        "ts_today.performanceId = p.performanceId AND CONVERT(varchar(10), ts_today.salesDate, 120) = CONVERT(varchar(10), GETDATE(), 120)",
      )
      // Yesterday's sales
      .leftJoin(
        TicketingSales,
        'ts_yesterday',
        "ts_yesterday.performanceId = p.performanceId AND CONVERT(varchar(10), ts_yesterday.salesDate, 120) = CONVERT(varchar(10), DATEADD(day, -1, GETDATE()), 120)",
      )
      .select([
        'p.performanceId                                         AS performanceId',
        'p.engagementId                                         AS engagementId',
        'CONVERT(varchar(10), p.performanceDate, 120)           AS performanceDate',
        'CONVERT(varchar(8),  p.performanceTime, 108)           AS performanceTime',
        'p.performanceStatus                                     AS performanceStatus',
        'e.engagementStatus                                      AS engagementStatus',
        'a.attractionName                                        AS attractionName',
        't.tourName                                              AS tourName',
        'vc.companyName                                          AS venueCompanyName',
        'v.venueName                                             AS venueName',
        'addr.city                                               AS city',
        'addr.stateProvince                                      AS stateProvince',
        // Today
        "CONVERT(varchar(10), GETDATE(), 120)                   AS todayDate",
        'ts_today.performanceSalesQuantity                       AS todayTicketsSold',
        'ts_today.performanceSalesRevenue                        AS todayRevenue',
        // Yesterday
        "CONVERT(varchar(10), DATEADD(day, -1, GETDATE()), 120) AS yesterdayDate",
        'ts_yesterday.performanceSalesQuantity                   AS yesterdayTicketsSold',
        'ts_yesterday.performanceSalesRevenue                    AS yesterdayRevenue',
      ])
      .orderBy('p.performanceDate', 'ASC')
      .addOrderBy('p.performanceTime', 'ASC');

    if (performanceDate) {
      qb.andWhere("CONVERT(varchar(10), p.performanceDate, 120) = :pd", { pd: performanceDate });
    }

    const raw = await qb.getRawMany<Record<string, unknown>>();

    return raw.map((r) => ({
      performanceId: Number(r['performanceId']),
      engagementId: Number(r['engagementId']),
      performanceDate: String(r['performanceDate'] ?? ''),
      performanceTime: String(r['performanceTime'] ?? ''),
      performanceStatus: String(r['performanceStatus'] ?? ''),
      engagementStatus: String(r['engagementStatus'] ?? ''),
      attractionName: r['attractionName'] != null ? String(r['attractionName']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      venueCompanyName: r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince: r['stateProvince'] != null ? String(r['stateProvince']) : null,
      todayDate: String(r['todayDate'] ?? ''),
      todayTicketsSold: r['todayTicketsSold'] != null ? Number(r['todayTicketsSold']) : null,
      todayRevenue: r['todayRevenue'] != null ? Number(r['todayRevenue']) : null,
      yesterdayDate: String(r['yesterdayDate'] ?? ''),
      yesterdayTicketsSold: r['yesterdayTicketsSold'] != null ? Number(r['yesterdayTicketsSold']) : null,
      yesterdayRevenue: r['yesterdayRevenue'] != null ? Number(r['yesterdayRevenue']) : null,
    }));
  }

  // ─── PATCH — upsert sales for a specific performance + date ──────────────
  /**
   * Creates or updates dbo.TicketingSales for the given composite key.
   * If the row doesn't exist yet (e.g. no entry made for today), it is created.
   */
  async updateSales(
    performanceId: number,
    salesDate: string,
    body: { ticketsSold?: number | null; revenue?: number | null },
  ): Promise<void> {
    if (body.ticketsSold !== undefined && body.ticketsSold !== null) {
      if (!Number.isInteger(body.ticketsSold) || body.ticketsSold < 0) {
        throw new BadRequestException({ message: 'ticketsSold must be a non-negative integer.' });
      }
    }
    if (body.revenue !== undefined && body.revenue !== null) {
      if (body.revenue < 0) {
        throw new BadRequestException({ message: 'revenue must be a non-negative number.' });
      }
    }

    let row = await this.salesRepo.findOne({ where: { performanceId, salesDate } });

    if (!row) {
      // Upsert — create new row for this performance + date
      row = this.salesRepo.create({
        performanceId,
        salesDate,
        performanceSalesQuantity: null,
        performanceSalesRevenue: null,
      });
    }

    if (body.ticketsSold !== undefined) {
      row.performanceSalesQuantity = body.ticketsSold;
    }
    if (body.revenue !== undefined) {
      row.performanceSalesRevenue =
        body.revenue != null ? parseFloat(body.revenue.toFixed(2)) : null;
    }

    await this.salesRepo.save(row);
  }
}

