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

  /** Distinct market names from dbo.DMA — deduplicated, sorted alphabetically. */
  async findDmaMarkets(): Promise<{ marketName: string }[]> {
    const rows = await this.dmaRepo
      .createQueryBuilder('d')
      .select('DISTINCT d.marketName', 'marketName')
      .orderBy('d.marketName', 'ASC')
      .getRawMany<{ marketName: string }>();
    return rows;
  }

  /** Search DMA markets by query string (case-insensitive partial match). */
  async searchDmaMarkets(query: string, limit = 50): Promise<{ marketName: string }[]> {
    const qb = this.dmaRepo
      .createQueryBuilder('d')
      .select('DISTINCT d.marketName', 'marketName')
      .orderBy('d.marketName', 'ASC');

    if (query) {
      qb.where('d.marketName LIKE :query', { query: `%${query}%` });
    }

    qb.limit(limit);
    return qb.getRawMany<{ marketName: string }>();
  }
}
