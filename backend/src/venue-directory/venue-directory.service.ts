import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Venue } from '../entities/venue.entity';

const VENUE_TYPE_NAME = 'venue';

export interface AllVenueDirectoryRow {
  companyId: number;
  /** Comma-separated complex company names when a venue belongs to more than one complex. */
  entertainmentComplexNames: string | null;
  venueName: string;
  seatingCapacity: number;
  venueTypeId: number | null;
  venueTypeName: string | null;
  dmaId: number | null;
  dmaMarketName: string | null;
}

@Injectable()
export class VenueDirectoryService {
  constructor(
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
  ) {}

  private static applyVenueTypeWhere(
    qb: SelectQueryBuilder<Venue>,
  ): SelectQueryBuilder<Venue> {
    return qb.andWhere('LOWER(LTRIM(RTRIM(ct.companyTypeName))) = :ctVenue', {
      ctVenue: VENUE_TYPE_NAME,
    });
  }

  private baseAllVenuesQuery(
    v: { q?: string; complexName?: string; complexCompanyId?: number } & {
      venueTypeId?: number;
      dmaId?: number;
    },
  ): SelectQueryBuilder<Venue> {
    const qb = this.venueRepo
      .createQueryBuilder('v')
      .innerJoin('v.company', 'c')
      .innerJoin('c.companyType', 'ct')
      .leftJoin('v.venueType', 'vt')
      .leftJoin('c.dma', 'd')
      .leftJoin('c.physicalAddress', 'pa');
    VenueDirectoryService.applyVenueTypeWhere(qb);

    const qVen = (v.q ?? '').trim();
    if (qVen) {
      const likeV = `%${qVen.toLowerCase()}%`;
      qb.andWhere('LOWER(v.venueName) LIKE :qVenue', { qVenue: likeV });
    }
    if (v.complexCompanyId != null && Number.isFinite(v.complexCompanyId)) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM dbo.VenueComplexMember vcmf WHERE vcmf.VenueCompanyID = v.companyId AND vcmf.ComplexCompanyID = :ccid)`,
        { ccid: v.complexCompanyId },
      );
    } else {
      const cName = (v.complexName ?? '').trim();
      if (cName) {
        const likeC = `%${cName.toLowerCase()}%`;
        qb.andWhere(
          `EXISTS (SELECT 1 FROM dbo.VenueComplexMember vcmf2 INNER JOIN dbo.Company ccnf ON ccnf.CompanyID = vcmf2.ComplexCompanyID WHERE vcmf2.VenueCompanyID = v.companyId AND LOWER(LTRIM(RTRIM(ccnf.CompanyName))) LIKE :qC)`,
          { qC: likeC },
        );
      }
    }
    if (v.venueTypeId != null && Number.isFinite(v.venueTypeId)) {
      qb.andWhere('v.venueTypeId = :vtypeId', { vtypeId: v.venueTypeId });
    }
    if (v.dmaId != null && Number.isFinite(v.dmaId)) {
      qb.andWhere('c.dmaid = :dmaF', { dmaF: v.dmaId });
    }
    return qb;
  }

  async listAllVenues(
    offset: number,
    limit: number,
    filters: {
      q?: string;
      complexName?: string;
      complexCompanyId?: number;
      venueTypeId?: number;
      dmaId?: number;
    },
  ): Promise<{ data: AllVenueDirectoryRow[]; total: number }> {
    const safeOffset = Math.max(0, Math.floor(offset) || 0);
    const safeLimit = Math.min(10_000, Math.max(1, Math.floor(limit) || 25));

    const dataQb = this.baseAllVenuesQuery(filters)
      .select('v.companyId', 'companyId')
      .addSelect(
        `(SELECT STRING_AGG(LTRIM(RTRIM(ccx.CompanyName)), N', ') WITHIN GROUP (ORDER BY LTRIM(RTRIM(ccx.CompanyName)))
          FROM dbo.VenueComplexMember vcmx
          INNER JOIN dbo.Company ccx ON ccx.CompanyID = vcmx.ComplexCompanyID
          WHERE vcmx.VenueCompanyID = v.companyId)`,
        'entertainmentComplexNames',
      )
      .addSelect('v.venueName', 'venueName')
      .addSelect('v.seatingCapacity', 'seatingCapacity')
      .addSelect('v.venueTypeId', 'venueTypeId')
      .addSelect('vt.venueTypeName', 'venueTypeName')
      .addSelect('c.dmaid', 'dmaId')
      .addSelect('d.marketName', 'dmaMarketName')
      .orderBy('v.venueName', 'ASC');

    const countQb = this.baseAllVenuesQuery(filters).select(
      'COUNT(1)',
      'cnt',
    );
    const totalRow = await countQb.getRawOne<Record<string, string | number>>();
    const total = Math.floor(
      Number(
        (totalRow?.cnt as string | number | undefined) ??
          this.pickRaw(
            (totalRow ?? {}) as Record<string, unknown>,
            'cnt',
            0,
          ) ??
          0,
      ),
    );

    const raw = (await dataQb
      .offset(safeOffset)
      .limit(safeLimit)
      .getRawMany()) as Record<string, unknown>[];

    const data: AllVenueDirectoryRow[] = raw.map((row) => ({
      companyId: Math.floor(Number(this.pickRaw(row, 'companyId', 0))),
      entertainmentComplexNames: this.nullableStr(
        this.pickRaw(row, 'entertainmentComplexNames', null),
      ),
      venueName: String(this.pickRaw(row, 'venueName', '')).trim(),
      seatingCapacity: Math.floor(
        Number(this.pickRaw(row, 'seatingCapacity', 0)),
      ),
      venueTypeId: this.nullableInt(
        this.pickRaw(row, 'venueTypeId', null),
      ),
      venueTypeName: this.nullableStr(
        this.pickRaw(row, 'venueTypeName', null),
      ),
      dmaId: this.nullableInt(this.pickRaw(row, 'dmaId', null)),
      dmaMarketName: this.nullableStr(
        this.pickRaw(row, 'dmaMarketName', null),
      ),
    }));

    return { data, total: Number.isFinite(total) && total > 0 ? total : 0 };
  }

  private pickRaw(
    row: Record<string, unknown>,
    key: string,
    def: string | number | null,
  ): string | number | null {
    const direct = row[key];
    if (direct != null) return direct as string | number;
    const l = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === l) return row[k] as string | number;
    }
    return def;
  }

  private nullableInt(
    v: string | number | null,
  ): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private nullableStr(
    v: string | number | null,
  ): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t || null;
  }

}
