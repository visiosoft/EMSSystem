import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from '../entities/class.entity';
import { CompanyType } from '../entities/company-type.entity';
import { Department } from '../entities/department.entity';
import { Dma } from '../entities/dma.entity';
import { Role } from '../entities/role.entity';
import { SeatingType } from '../entities/seating-type.entity';
import { VenueType } from '../entities/venue-type.entity';
import { Brand } from '../entities/brand.entity';
import { ServiceProvided } from '../entities/service-provided.entity';
import { Tax } from '../entities/tax.entity';
import { CompanyService as CompanyServiceEntity } from '../entities/company-service.entity';
import { Company } from '../entities/company.entity';
import { NonResidentWithholding } from '../entities/non-resident-withholding.entity';

@Injectable()
export class LookupsService {
  constructor(
    @InjectRepository(CompanyType)
    private readonly companyTypeRepo: Repository<CompanyType>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(SeatingType)
    private readonly seatingTypeRepo: Repository<SeatingType>,
    @InjectRepository(Dma)
    private readonly dmaRepo: Repository<Dma>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(VenueType)
    private readonly venueTypeRepo: Repository<VenueType>,
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Tax)
    private readonly taxRepo: Repository<Tax>,
    @InjectRepository(ServiceProvided)
    private readonly serviceProvidedRepo: Repository<ServiceProvided>,
    @InjectRepository(CompanyServiceEntity)
    private readonly companyServiceRepo: Repository<CompanyServiceEntity>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(NonResidentWithholding)
    private readonly nonResidentWithholdingRepo: Repository<NonResidentWithholding>,
  ) {}

  findCompanyTypes() {
    return this.companyTypeRepo.find({
      order: { companyTypeName: 'ASC' },
    });
  }

  findRoles() {
    return this.roleRepo.find({ order: { roleName: 'ASC' } });
  }

  findDepartments() {
    return this.departmentRepo.find({ order: { departmentName: 'ASC' } });
  }

  findSeatingTypes() {
    return this.seatingTypeRepo.find({ order: { seatingName: 'ASC' } });
  }

  findClasses() {
    return this.classRepo.find({ order: { className: 'ASC' } });
  }

  findVenueTypes() {
    return this.venueTypeRepo.find({ order: { venueTypeName: 'ASC' } });
  }

  findBrands() {
    return this.brandRepo.find({ order: { brandName: 'ASC' } });
  }

  findTaxes() {
    return this.taxRepo.find({ order: { taxJurisdictionType: 'ASC' as const, taxName: 'ASC' as const } });
  }

  findServicesProvided() {
    return this.serviceProvidedRepo.find({ order: { serviceName: 'ASC' } });
  }

  async findStagehandProviders(): Promise<{ companyId: number; companyName: string }[]> {
    const stagehands = await this.serviceProvidedRepo
      .createQueryBuilder('sp')
      .where('LOWER(sp.serviceName) = LOWER(:n)', { n: 'Stagehands' })
      .getOne();
    if (!stagehands) return [];

    const rows = await this.companyServiceRepo
      .createQueryBuilder('cs')
      .innerJoin(Company, 'c', 'c.companyId = cs.companyId')
      .where('cs.serviceProvidedId = :sid', { sid: stagehands.serviceProvidedId })
      .select(['c.companyId AS companyId', 'c.companyName AS companyName'])
      .orderBy('c.companyName', 'ASC')
      .getRawMany<Record<string, unknown>>();

    return rows.map((r) => ({
      companyId: Number(r.companyId ?? r.CompanyID),
      companyName: String(r.companyName ?? r.CompanyName ?? ''),
    }));
  }

  async findNonResidentWithholdings(): Promise<
    { withholdingId: number; withholdingTaxRate: string; dmaid: number | null; taxAgencyId: number | null }[]
  > {
    const rows = await this.nonResidentWithholdingRepo.find({
      order: { withholdingId: 'ASC' as const },
    });
    return rows.map((r) => ({
      withholdingId: r.withholdingId,
      withholdingTaxRate: r.withholdingTaxRate,
      dmaid: r.dmaid ?? null,
      taxAgencyId: r.taxAgencyId ?? null,
    }));
  }

  /** First DMA row matching postal code (dbo.DMA is postal-level). */
  async findDmaByPostal(postalCode: string) {
    const pc = postalCode.trim();
    const row = await this.dmaRepo
      .createQueryBuilder('d')
      .where('d.postalCode = :pc', { pc })
      .orderBy('d.dmaid', 'ASC')
      .getOne();
    return row;
  }

  /**
   * One row per (MarketName, PostalCode): duplicate DMA rows are collapsed using MIN(DMAID).
   * Raw table can repeat the same label with different DMAIDs; pickers must not list repeats.
   */
  private buildDmaMarketsGroupedSubquery(query: string) {
    const qb = this.dmaRepo
      .createQueryBuilder('d')
      .select('MIN(d.dmaid)', 'dmaid')
      .addSelect('d.marketName', 'marketName')
      .addSelect('d.postalCode', 'postalCode')
      .groupBy('d.marketName')
      .addGroupBy('d.postalCode');

    const trimmed = query.trim();
    if (!trimmed) return qb;

    const sq = `%${trimmed}%`;
    /**
     * DMAID matching must not use substring/prefix on CAST(dmaid): e.g. "76363" matched IDs 763630001,
     * 176363, etc., surfacing unrelated postal/market rows after GROUP BY.
     */
    const digitsOnly = /^\d+$/.test(trimmed);

    if (digitsOnly) {
      const dmaIdExact = Number.parseInt(trimmed, 10);
      const idExactUsable =
        Number.isFinite(dmaIdExact) &&
        dmaIdExact >= 0 &&
        dmaIdExact <= 2147483647 &&
        String(dmaIdExact) === trimmed;

      if (idExactUsable) {
        qb.where(
          "(LOWER(d.marketName) LIKE LOWER(:sq) OR LOWER(ISNULL(d.postalCode, '')) LIKE LOWER(:sq) OR d.dmaid = :dmaIdExact)",
          { sq, dmaIdExact },
        );
      } else {
        qb.where(
          "(LOWER(d.marketName) LIKE LOWER(:sq) OR LOWER(ISNULL(d.postalCode, '')) LIKE LOWER(:sq))",
          { sq },
        );
      }
    } else {
      qb.where(
        "(LOWER(d.marketName) LIKE LOWER(:sq) OR LOWER(ISNULL(d.postalCode, '')) LIKE LOWER(:sq))",
        { sq },
      );
    }

    return qb;
  }

  private mapDmaMarketRows(rows: Record<string, unknown>[]) {
    return rows.map((r) => ({
      dmaid: Number(r.dmaid ?? r.DMAID),
      marketName: String(r.marketName ?? r.MarketName ?? ''),
      postalCode: String(r.postalCode ?? r.PostalCode ?? ''),
    }));
  }

  /**
   * All logical DMA markets (one per name + postal), MIN(DMAID) per group.
   */
  async findDmaMarkets(): Promise<
    { dmaid: number; marketName: string; postalCode: string }[]
  > {
    const inner = this.buildDmaMarketsGroupedSubquery('');
    const rows = await this.dmaRepo.manager
      .createQueryBuilder()
      .select('t.dmaid', 'dmaid')
      .addSelect('t.marketName', 'marketName')
      .addSelect('t.postalCode', 'postalCode')
      .from(`(${inner.getQuery()})`, 't')
      .setParameters(inner.getParameters())
      .orderBy('t.marketName', 'ASC')
      .addOrderBy('t.dmaid', 'ASC')
      .getRawMany<Record<string, unknown>>();
    return this.mapDmaMarketRows(rows);
  }

  /** Search DMA markets by query string (case-insensitive partial match). */
  async searchDmaMarkets(
    query: string,
    limit = 50,
  ): Promise<{ dmaid: number; marketName: string; postalCode: string }[]> {
    const inner = this.buildDmaMarketsGroupedSubquery(query);
    const rows = await this.dmaRepo.manager
      .createQueryBuilder()
      .select('t.dmaid', 'dmaid')
      .addSelect('t.marketName', 'marketName')
      .addSelect('t.postalCode', 'postalCode')
      .from(`(${inner.getQuery()})`, 't')
      .setParameters(inner.getParameters())
      .orderBy('t.marketName', 'ASC')
      .addOrderBy('t.dmaid', 'ASC')
      .take(limit)
      .getRawMany<Record<string, unknown>>();
    return this.mapDmaMarketRows(rows);
  }

  /** Paginated DMA markets with optional search filter. */
  async findDmaMarketsPaginated(
    offset: number,
    limit: number,
    query = '',
  ): Promise<{
    data: { dmaid: number; marketName: string; postalCode: string }[];
    total: number;
  }> {
    const inner = this.buildDmaMarketsGroupedSubquery(query);

    const countRow = await this.dmaRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'cnt')
      .from(`(${inner.getQuery()})`, 'dedup')
      .setParameters(inner.getParameters())
      .getRawOne<{ cnt: string | number }>();

    const total = Number(countRow?.cnt ?? 0);

    const rows = await this.dmaRepo.manager
      .createQueryBuilder()
      .select('t.dmaid', 'dmaid')
      .addSelect('t.marketName', 'marketName')
      .addSelect('t.postalCode', 'postalCode')
      .from(`(${inner.getQuery()})`, 't')
      .setParameters(inner.getParameters())
      .orderBy('t.marketName', 'ASC')
      .addOrderBy('t.dmaid', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawMany<Record<string, unknown>>();

    return {
      data: this.mapDmaMarketRows(rows),
      total,
    };
  }
}
