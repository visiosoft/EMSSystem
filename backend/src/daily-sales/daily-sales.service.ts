import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { TicketingSales } from '../entities/ticketing-sales.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { normalizeEngagementStatus } from '../engagements/engagement-status.util';

function ymdAddDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function numOrZero(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    const s = (v as { toString: () => string }).toString();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return typeof v === 'number' && Number.isFinite(v)
    ? v
    : parseFloat(String(v)) || 0;
}

function pickRow<T>(
  row: Record<string, unknown> | null | undefined,
  name: string,
): T | undefined {
  if (row == null) return undefined;
  if (name in row) return row[name] as T;
  const l = name.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === l) return row[k] as T;
  }
  return undefined;
}

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
  performanceDate: string; // YYYY-MM-DD
  performanceTime: string; // HH:MM:SS
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

/** Paged by-performance list + global totals (same filter as the table). */
export interface PerformanceSalesPageResult {
  items: PerformanceSalesRow[];
  total: number;
  page: number;
  pageSize: number;
  todayDate: string;
  yesterdayDate: string;
  summary: {
    todayTickets: number;
    todayRevenue: number;
    yesterdayTickets: number;
    yesterdayRevenue: number;
  };
  /** Distinct non-null attraction names for the filter (same performance-date window as the table when set). */
  attractionNames: string[];
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
      .leftJoin(
        EngagementVenue,
        'ev',
        'ev.engagementId = e.engagementId AND ev.isPrimary = :prim',
        { prim: true },
      )
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
      engagementStatus: normalizeEngagementStatus(
        String(r['engagementStatus'] ?? ''),
      ),
      ticketsSold: r['ticketsSold'] != null ? Number(r['ticketsSold']) : null,
      revenue: r['revenue'] != null ? Number(r['revenue']) : null,
      tourId: r['tourId'] != null ? Number(r['tourId']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      attractionId:
        r['attractionId'] != null ? Number(r['attractionId']) : null,
      attractionName:
        r['attractionName'] != null ? String(r['attractionName']) : null,
      venueCompanyId:
        r['venueCompanyId'] != null ? Number(r['venueCompanyId']) : null,
      venueCompanyName:
        r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince:
        r['stateProvince'] != null ? String(r['stateProvince']) : null,
      dmaMarketName:
        r['dmaMarketName'] != null ? String(r['dmaMarketName']) : null,
    }));
  }

  // ─── GET /daily-sales/by-performance (paged) ────────────────────────────
  /**
   * One page of performances with PerformanceDate <= asOf, plus totals over the full
   * filter (not just the current page) and options for the attraction filter.
   */
  private applyByPerformanceSort(
    qb: SelectQueryBuilder<Performance>,
    sortByRaw?: string,
    sortDirRaw?: string,
  ): void {
    const sortBy = (sortByRaw ?? '').trim().toLowerCase();
    const sortDir =
      (sortDirRaw ?? '').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const addChronoTie = () => {
      qb.addOrderBy('p.performanceDate', 'ASC')
        .addOrderBy('p.performanceTime', 'ASC')
        .addOrderBy('p.performanceId', 'ASC');
    };
    if (sortBy === 'attraction') {
      qb.orderBy('a.attractionName', sortDir);
      addChronoTie();
    } else if (sortBy === 'tour') {
      qb.orderBy('t.tourName', sortDir);
      addChronoTie();
    } else if (sortBy === 'venue') {
      qb.orderBy('vc.companyName', sortDir).addOrderBy('v.venueName', sortDir);
      addChronoTie();
    } else if (sortBy === 'city') {
      qb.orderBy('addr.city', sortDir);
      addChronoTie();
    } else if (sortBy === 'state') {
      qb.orderBy('addr.stateProvince', sortDir);
      addChronoTie();
    } else if (sortBy === 'status' || sortBy === 'engagement') {
      qb.orderBy('e.engagementStatus', sortDir);
      addChronoTie();
    } else if (sortBy === 'todaytickets') {
      qb.orderBy('ts_today.performanceSalesQuantity', sortDir);
      addChronoTie();
    } else if (sortBy === 'todayrevenue') {
      qb.orderBy('ts_today.performanceSalesRevenue', sortDir);
      addChronoTie();
    } else {
      qb.orderBy('p.performanceDate', sortDir)
        .addOrderBy('p.performanceTime', sortDir)
        .addOrderBy('p.performanceId', 'ASC');
    }
  }

  async findByPerformancePage(
    asOfDateParam: string | undefined,
    pageIn: number,
    pageSizeIn: number,
    searchRaw: string | undefined,
    attractionName: string | undefined,
    performanceDateRaw?: string,
    sortByRaw?: string,
    sortDirRaw?: string,
  ): Promise<PerformanceSalesPageResult> {
    const asOf = await this.resolveAsOfDateString(asOfDateParam);
    const page = Math.max(1, Number.isFinite(pageIn) ? Math.floor(pageIn) : 1);
    const pageSize = Math.min(
      10_000,
      Math.max(1, Number.isFinite(pageSizeIn) ? Math.floor(pageSizeIn) : 25),
    );
    const search = (searchRaw ?? '').trim() || undefined;
    const performanceDate = this.normalizeOptionalYmd(performanceDateRaw);

    const yesterdayDate = ymdAddDays(asOf, -1);

    const baseQb = this.createByPerformanceBaseQb(asOf, {
      search,
      attractionName: attractionName?.trim() || undefined,
      performanceDate,
    });

    // Run in parallel: previously (attraction list → count) were sequential, doubling wait time
    // on large dbo.Performance sets. Count + rollups + page each scan the same join pattern.
    const [attractionNames, total, agg, rawItems] = await Promise.all([
      this.getDistinctAttractionNames(asOf, performanceDate),
      baseQb.clone().getCount(),
      this.sumSalesForByPerformanceQuery(baseQb.clone(), asOf),
      (async () => {
        const pageQb = baseQb
          .clone()
          .select([
            'p.performanceId                                         AS performanceId',
            'p.engagementId                                         AS engagementId',
            'CONVERT(varchar(10), p.performanceDate, 120)           AS performanceDate',
            'CONVERT(varchar(8),  p.performanceTime, 108)          AS performanceTime',
            'p.performanceStatus                                    AS performanceStatus',
            'e.engagementStatus                                     AS engagementStatus',
            'a.attractionName                                       AS attractionName',
            't.tourName                                             AS tourName',
            'vc.companyName                                         AS venueCompanyName',
            'v.venueName                                            AS venueName',
            'addr.city                                              AS city',
            'addr.stateProvince                                   AS stateProvince',
            'CONVERT(varchar(10), CAST(:asOf AS date), 120)         AS todayDate',
            'ts_today.performanceSalesQuantity                      AS todayTicketsSold',
            'ts_today.performanceSalesRevenue                        AS todayRevenue',
            'CONVERT(varchar(10), DATEADD(day, -1, CAST(:asOf AS date)), 120) AS yesterdayDate',
            'ts_yesterday.performanceSalesQuantity                  AS yesterdayTicketsSold',
            'ts_yesterday.performanceSalesRevenue                    AS yesterdayRevenue',
          ])
          .setParameter('asOf', asOf);
        this.applyByPerformanceSort(pageQb, sortByRaw, sortDirRaw);
        return pageQb
          .skip((page - 1) * pageSize)
          .take(pageSize)
          .getRawMany<Record<string, unknown>>();
      })(),
    ]);

    const items: PerformanceSalesRow[] = rawItems.map((r) => ({
      performanceId: Number(r['performanceId']),
      engagementId: Number(r['engagementId']),
      performanceDate: String(r['performanceDate'] ?? ''),
      performanceTime: String(r['performanceTime'] ?? ''),
      performanceStatus: String(r['performanceStatus'] ?? ''),
      engagementStatus: normalizeEngagementStatus(
        String(r['engagementStatus'] ?? ''),
      ),
      attractionName:
        r['attractionName'] != null ? String(r['attractionName']) : null,
      tourName: r['tourName'] != null ? String(r['tourName']) : null,
      venueCompanyName:
        r['venueCompanyName'] != null ? String(r['venueCompanyName']) : null,
      venueName: r['venueName'] != null ? String(r['venueName']) : null,
      city: r['city'] != null ? String(r['city']) : null,
      stateProvince:
        r['stateProvince'] != null ? String(r['stateProvince']) : null,
      todayDate: String(r['todayDate'] ?? ''),
      todayTicketsSold:
        r['todayTicketsSold'] != null ? Number(r['todayTicketsSold']) : null,
      todayRevenue:
        r['todayRevenue'] != null ? Number(r['todayRevenue']) : null,
      yesterdayDate: String(r['yesterdayDate'] ?? yesterdayDate),
      yesterdayTicketsSold:
        r['yesterdayTicketsSold'] != null
          ? Number(r['yesterdayTicketsSold'])
          : null,
      yesterdayRevenue:
        r['yesterdayRevenue'] != null ? Number(r['yesterdayRevenue']) : null,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      todayDate: asOf,
      yesterdayDate,
      summary: {
        todayTickets: numOrZero(pickRow(agg, 'sumTixT')),
        todayRevenue: numOrZero(pickRow(agg, 'sumRevT')),
        yesterdayTickets: numOrZero(pickRow(agg, 'sumTixY')),
        yesterdayRevenue: numOrZero(pickRow(agg, 'sumRevY')),
      },
      attractionNames,
    };
  }

  private createByPerformanceBaseQb(
    asOf: string,
    options: { search?: string; attractionName?: string; performanceDate?: string },
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
      .leftJoin(
        TicketingSales,
        'ts_today',
        'ts_today.performanceId = p.performanceId AND ' +
          'CONVERT(date, ts_today.salesDate) = CAST(:asOf AS date)',
      )
      .leftJoin(
        TicketingSales,
        'ts_yesterday',
        'ts_yesterday.performanceId = p.performanceId AND ' +
          'CONVERT(date, ts_yesterday.salesDate) = DATEADD(day, -1, CAST(:asOf AS date))',
      )
      .where('CONVERT(date, p.performanceDate) <= CAST(:asOf AS date)')
      .setParameter('asOf', asOf);

    if (options.performanceDate) {
      qb.andWhere(
        'CONVERT(date, p.performanceDate) = CAST(:perfDay AS date)',
        { perfDay: options.performanceDate },
      );
    }

    if (options.attractionName) {
      qb.andWhere('a.attractionName = :attName', {
        attName: options.attractionName,
      });
    }

    if (options.search) {
      // Single :searchT bind — repeating the same named param breaks some mssql/TypeORM drivers.
      const s = options.search.toLowerCase();
      qb.andWhere(
        `CHARINDEX(:searchT, LOWER(CONCAT(
          N' ',
          a.attractionName,
          N' ',
          t.tourName,
          N' ',
          vc.companyName,
          N' ',
          v.venueName,
          N' ',
          addr.city,
          N' ',
          addr.stateProvince,
          N' ',
          CONVERT(varchar(10), p.performanceDate, 120)
        ))) > 0`,
        { searchT: s },
      );
    }

    return qb;
  }

  private async sumSalesForByPerformanceQuery(
    base: SelectQueryBuilder<Performance>,
    asOf: string,
  ): Promise<Record<string, unknown>> {
    const one = await base
      .clone()
      .setParameter('asOf', asOf)
      .select(
        'COALESCE(SUM(CAST(ts_today.performanceSalesQuantity AS BIGINT)), 0)',
        'sumTixT',
      )
      .addSelect(
        'COALESCE(SUM(ts_today.performanceSalesRevenue), 0)',
        'sumRevT',
      )
      .addSelect(
        'COALESCE(SUM(CAST(ts_yesterday.performanceSalesQuantity AS BIGINT)), 0)',
        'sumTixY',
      )
      .addSelect(
        'COALESCE(SUM(ts_yesterday.performanceSalesRevenue), 0)',
        'sumRevY',
      )
      .getRawOne<Record<string, unknown>>();
    return (one as Record<string, unknown>) ?? {};
  }

  private async getDistinctAttractionNames(
    asOf: string,
    performanceDate?: string,
  ): Promise<string[]> {
    const qb = this.performanceRepo
      .createQueryBuilder('p')
      .innerJoin(Engagement, 'e', 'e.engagementId = p.engagementId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .where('CONVERT(date, p.performanceDate) <= CAST(:asOf AS date)')
      .andWhere('a.attractionName IS NOT NULL')
      .setParameter('asOf', asOf);

    if (performanceDate) {
      qb.andWhere(
        'CONVERT(date, p.performanceDate) = CAST(:perfDay AS date)',
        { perfDay: performanceDate },
      );
    }

    const raw = await qb
      .select('a.attractionName', 'n')
      .distinct(true)
      .orderBy('a.attractionName', 'ASC')
      .getRawMany<{ n: string }>();

    return raw
      .map((x) =>
        String(pickRow<unknown>(x as Record<string, unknown>, 'n') ?? ''),
      )
      .filter((s) => s.length > 0);
  }

  /** Optional performance calendar day filter (YYYY-MM-DD); invalid values ignored. */
  private normalizeOptionalYmd(raw?: string): string | undefined {
    const s = (raw ?? '').trim();
    if (!s) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return undefined;
  }

  /** YYYY-MM-DD or fetch from server via GETDATE() for consistency with SQL. */
  private async resolveAsOfDateString(input?: string): Promise<string> {
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    if (input) {
      throw new BadRequestException({
        message: 'asOfDate must be YYYY-MM-DD when provided.',
      });
    }
    const r = await this.performanceRepo.query(
      'SELECT CONVERT(varchar(10), CAST(GETDATE() AS date), 120) AS d',
    );
    return r[0]?.d ?? new Date().toISOString().slice(0, 10);
  }

  // ─── PATCH — upsert sales for a specific performance + date ──────────────
  /**
   * Creates or updates the single dbo.TicketingSales row for (PerformanceID, SalesDate).
   * Business: one record per day per show = the **running (cumulative) total** to that point
   * for that performance; the stored value is the latest total, not a delta to stack.
   */
  async updateSales(
    performanceId: number,
    salesDate: string,
    body: { ticketsSold?: number | null; revenue?: number | null },
  ): Promise<void> {
    if (body.ticketsSold !== undefined && body.ticketsSold !== null) {
      if (!Number.isInteger(body.ticketsSold) || body.ticketsSold < 0) {
        throw new BadRequestException({
          message: 'ticketsSold must be a non-negative integer.',
        });
      }
    }
    if (body.revenue !== undefined && body.revenue !== null) {
      if (body.revenue < 0) {
        throw new BadRequestException({
          message: 'revenue must be a non-negative number.',
        });
      }
    }

    let row = await this.salesRepo.findOne({
      where: { performanceId, salesDate },
    });

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
