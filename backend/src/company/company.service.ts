import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { CompanyType } from '../entities/company-type.entity';
import { Company } from '../entities/company.entity';
import { ContactAssignment } from '../entities/contact-assignment.entity';
import { ContactInfo } from '../entities/contact-info.entity';
import { Contact } from '../entities/contact.entity';
import { Attraction } from '../entities/attraction.entity';
import { Dma } from '../entities/dma.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementProjectVenue } from '../entities/engagement-project-venue.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { buildEngagementDisplayTitle } from '../engagements/engagement-display.util';
import { normalizeEngagementStatus } from '../engagements/engagement-status.util';
import { CreateCompanyContactDto } from './dto/create-company-contact.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyContactDto } from './dto/create-company-contact.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateVenueTicketingDto } from './dto/update-venue-ticketing.dto';
import { UpdateVenueProfileDto } from './dto/update-venue-profile.dto';
import { isValidPhoneNumber } from 'libphonenumber-js';

function assertOptionalE164Phone(
  value: string | null | undefined,
  field: 'work phone' | 'cell phone',
): void {
  if (value == null) return;
  const t = value.trim();
  if (t.length === 0) return;
  if (!isValidPhoneNumber(t)) {
    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: `Invalid ${field}. Use a full international number (E.164, e.g. +1 415 555 1234) or leave the field empty.`,
    });
  }
}

export interface CompanyListRow {
  companyId: number;
  companyName: string;
  companyTypeId: number;
  companyTypeName: string;
  physicalCity: string;
  physicalStateProvince: string;
  dmaId: number | null;
  dmaMarketName: string;
}

export interface CompanyDetail extends CompanyListRow {
  physicalAddress: Address;
  mailingAddress: Address;
}

export interface CompanyContactRow {
  contactAssignmentId: number;
  contactId: number;
  contactInfoId: number;
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string | null;
  workPhone: string | null;
  roleId: number;
  roleName: string;
  departmentId: number;
  departmentName: string;
}

export interface CompanyEngagementRow {
  engagementId: number;
  engagementStatus: string;
  tourName: string | null;
  attractionName: string | null;
  /** Same format as the main Engagements list (`attraction — tour @ venue`). */
  displayTitle: string;
}

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(Dma)
    private readonly dmaRepo: Repository<Dma>,
    @InjectRepository(ContactAssignment)
    private readonly assignmentRepo: Repository<ContactAssignment>,
    @InjectRepository(ContactInfo)
    private readonly contactInfoRepo: Repository<ContactInfo>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(EngagementVenue)
    private readonly engagementVenueRepo: Repository<EngagementVenue>,
    @InjectRepository(EngagementProjectVenue)
    private readonly engagementProjectVenueRepo: Repository<EngagementProjectVenue>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(CompanyType)
    private readonly companyTypeRepo: Repository<CompanyType>,
  ) {}

  normalizePostal(postalCode: string, country: string): string {
    const raw = postalCode.trim();
    const c = country.trim().toLowerCase();
    if (c === 'usa' || c === 'united states' || c === 'us') {
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 5) return digits.slice(0, 5);
    }
    return raw.toUpperCase().replace(/\s+/g, ' ');
  }

  async resolveDmaId(
    postalCode: string,
    country: string,
  ): Promise<number | null> {
    const raw = postalCode.trim();
    if (!raw) return null;
    /** Same as GET /lookups/dma-by-postal (trim-only exact) before normalized match. */
    const direct = await this.dmaRepo
      .createQueryBuilder('d')
      .where('d.postalCode = :pc', { pc: raw })
      .orderBy('d.dmaid', 'ASC')
      .getOne();
    if (direct) return direct.dmaid;
    const normalized = this.normalizePostal(postalCode, country);
    const row = await this.dmaRepo
      .createQueryBuilder('d')
      .where('d.postalCode = :pc', { pc: normalized })
      .orderBy('d.dmaid', 'ASC')
      .getOne();
    if (row) return row.dmaid;
    const likeZip = normalized.replace(/\D/g, '').slice(0, 5);
    if (likeZip.length === 5) {
      const fuzzy = await this.dmaRepo
        .createQueryBuilder('d')
        .where("REPLACE(REPLACE(d.postalCode, ' ', ''), '-', '') LIKE :z", {
          z: `${likeZip}%`,
        })
        .orderBy('d.dmaid', 'ASC')
        .getOne();
      return fuzzy?.dmaid ?? null;
    }
    return null;
  }

  private normalizeAddressPayload(dto: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  }) {
    return {
      addressLine1: dto.addressLine1.trim(),
      addressLine2: dto.addressLine2?.trim() || null,
      city: dto.city.trim(),
      stateProvince: dto.stateProvince.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.trim(),
    };
  }

  /**
   * dbo.Address has a unique index over normalized address fields.
   * Reuse an existing row when possible instead of always inserting.
   */
  private async getOrCreateAddress(
    em: EntityManager,
    dto: {
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    },
  ): Promise<Address> {
    const normalized = this.normalizeAddressPayload(dto);
    const existing = await em.findOne(Address, {
      where: {
        ...normalized,
        addressLine2:
          normalized.addressLine2 === null ? IsNull() : normalized.addressLine2,
      },
    });
    if (existing) return existing;
    const address = em.create(Address, normalized);
    return em.save(Address, address);
  }

  /**
   * Blocks creating/updating a company when another already has the same
   * name (case-insensitive) and company type.
   */
  private async assertNoDuplicateCompany(
    em: EntityManager,
    args: {
      companyName: string;
      companyTypeId: number;
      excludeCompanyId?: number;
    },
  ): Promise<void> {
    const name = args.companyName.trim();
    const qb = em
      .getRepository(Company)
      .createQueryBuilder('c')
      .where('c.companyTypeId = :ct', { ct: args.companyTypeId })
      .andWhere('LOWER(LTRIM(RTRIM(c.companyName))) = LOWER(LTRIM(RTRIM(:name)))', {
        name,
      });
    if (args.excludeCompanyId != null) {
      qb.andWhere('c.companyId != :id', { id: args.excludeCompanyId });
    }
    const found = await qb.getOne();
    if (found) {
      throw new ConflictException({
        message:
          'A company with this name and type already exists. Open that record or use a different name or type.',
      });
    }
  }

  async findAll(): Promise<CompanyDetail[]> {
    const rows = await this.companyRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.companyType', 'ct')
      .leftJoinAndSelect('c.physicalAddress', 'pa')
      .leftJoinAndSelect('c.mailingAddress', 'ma')
      .leftJoinAndSelect('c.dma', 'd')
      .orderBy('c.companyName', 'ASC')
      .getMany();

    return rows.map((c) => ({
      companyId: c.companyId,
      companyName: c.companyName,
      companyTypeId: c.companyTypeId,
      companyTypeName: c.companyType.companyTypeName,
      physicalCity: c.physicalAddress?.city ?? '',
      physicalStateProvince: c.physicalAddress?.stateProvince ?? '',
      dmaId: c.dmaid,
      dmaMarketName: c.dma?.marketName ?? '',
      physicalAddress: c.physicalAddress,
      mailingAddress: c.mailingAddress,
    }));
  }

  async findAllPaginated(
    offset: number,
    limit: number,
    search?: string,
    companyType?: string,
  ): Promise<{ data: CompanyDetail[]; total: number }> {
    const qb = this.companyRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.companyType', 'ct')
      .leftJoinAndSelect('c.physicalAddress', 'pa')
      .leftJoinAndSelect('c.mailingAddress', 'ma')
      .leftJoinAndSelect('c.dma', 'd')
      .orderBy('c.companyName', 'ASC');

    const q = (search ?? '').trim();
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        `(LOWER(c.companyName) LIKE LOWER(:like) OR LOWER(ISNULL(pa.city, '')) LIKE LOWER(:like) OR LOWER(ISNULL(pa.stateProvince, '')) LIKE LOWER(:like) OR LOWER(ISNULL(d.marketName, '')) LIKE LOWER(:like))`,
        { like },
      );
    }
    const typeName = (companyType ?? '').trim();
    if (typeName && typeName !== 'All') {
      qb.andWhere('ct.companyTypeName = :typeName', { typeName });
    }

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    return {
      data: rows.map((c) => ({
        companyId: c.companyId,
        companyName: c.companyName,
        companyTypeId: c.companyTypeId,
        companyTypeName: c.companyType.companyTypeName,
        physicalCity: c.physicalAddress?.city ?? '',
        physicalStateProvince: c.physicalAddress?.stateProvince ?? '',
        dmaId: c.dmaid,
        dmaMarketName: c.dma?.marketName ?? '',
        physicalAddress: c.physicalAddress,
        mailingAddress: c.mailingAddress,
      })),
      total,
    };
  }


  async findOne(companyId: number): Promise<CompanyDetail> {
    const c = await this.companyRepo.findOne({
      where: { companyId },
      relations: {
        companyType: true,
        physicalAddress: true,
        mailingAddress: true,
        dma: true,
      },
    });
    if (!c) throw new NotFoundException(`Company ${companyId} not found`);
    return {
      companyId: c.companyId,
      companyName: c.companyName,
      companyTypeId: c.companyTypeId,
      companyTypeName: c.companyType.companyTypeName,
      physicalCity: c.physicalAddress.city,
      physicalStateProvince: c.physicalAddress.stateProvince,
      dmaId: c.dmaid,
      dmaMarketName: c.dma?.marketName ?? '',
      physicalAddress: c.physicalAddress,
      mailingAddress: c.mailingAddress,
    };
  }

  async create(dto: CreateCompanyDto): Promise<CompanyDetail> {
    const dmaId =
      dto.dmaId ??
      (await this.resolveDmaId(dto.physical.postalCode, dto.physical.country));
    if (dmaId == null) {
      throw new BadRequestException(
        'Could not resolve DMAID from the physical postal code. Use a postal code that exists in dbo.DMA, or pass dmaId explicitly.',
      );
    }

    if (dto.mailingSameAsPhysical === false && !dto.mailing) {
      throw new BadRequestException(
        'Mailing address is required when mailingSameAsPhysical is false.',
      );
    }

    await this.assertNoDuplicateCompany(this.dataSource.manager, {
      companyName: dto.companyName,
      companyTypeId: dto.companyTypeId,
    });

    const saved = await this.dataSource.transaction(async (em) => {
      const savedPhysical = await this.getOrCreateAddress(em, dto.physical);

      let mailingId = savedPhysical.addressId;
      const same =
        dto.mailingSameAsPhysical !== false &&
        (!dto.mailing || dto.mailingSameAsPhysical === true);
      if (!same && dto.mailing) {
        const savedMailing = await this.getOrCreateAddress(em, dto.mailing);
        mailingId = savedMailing.addressId;
      }

      const company = em.create(Company, {
        companyName: dto.companyName.trim(),
        companyTypeId: dto.companyTypeId,
        physicalAddressId: savedPhysical.addressId,
        mailingAddressId: mailingId,
        dmaid: dmaId,
      });
      const row = await em.save(Company, company);
      await this.ensureVenueRowForNewVenueCompany(em, row);
      return row;
    });

    /**
     * Return the full detail row (same shape as GET /companies items) so the
     * frontend can patch its cache in-place without a follow-up fetch.
     */
    return this.findOne(saved.companyId);
  }

  /** Default dbo.Venue row when registering a company whose type is Venue (1:1 with Company). */
  private newVenuePayload(companyId: number, companyName: string): Partial<Venue> {
    return {
      companyId,
      venueName: companyName.trim().slice(0, 200),
      seatingCapacity: 0,
      salesTaxRate: null,
      taxInCart: false,
      insuranceLanguage: null,
      insurancePolicyCopyRequirements: null,
      venueRelationshipIae: 'Standard',
      venueTypeId: null,
      seatingTypeId: null,
      loadDockAddressId: null,
      nonResidentWithholdingId: null,
    };
  }

  private async ensureVenueRowForNewVenueCompany(
    em: EntityManager,
    company: Company,
  ): Promise<void> {
    const ct = await em.findOne(CompanyType, {
      where: { companyTypeId: company.companyTypeId },
    });
    if (!ct || ct.companyTypeName.trim().toLowerCase() !== 'venue') {
      return;
    }
    const existing = await em.findOne(Venue, {
      where: { companyId: company.companyId },
    });
    if (existing) return;
    const venue = em.create(Venue, this.newVenuePayload(company.companyId, company.companyName));
    await em.save(Venue, venue);
  }

  private async assertVenueCompanyForProfile(companyId: number): Promise<Company> {
    const c = await this.companyRepo.findOne({
      where: { companyId },
      relations: { companyType: true },
    });
    if (!c) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    if (c.companyType.companyTypeName.trim().toLowerCase() !== 'venue') {
      throw new BadRequestException(
        'Venue profile is only available for companies with type Venue.',
      );
    }
    return c;
  }

  async getVenueProfile(companyId: number) {
    await this.assertVenueCompanyForProfile(companyId);
    const venue = await this.venueRepo.findOne({
      where: { companyId },
      relations: { venueType: true, seatingType: true },
    });
    if (!venue) {
      return { missing: true as const };
    }
    return {
      missing: false as const,
      companyId: venue.companyId,
      venueName: venue.venueName,
      seatingCapacity: venue.seatingCapacity,
      salesTaxRate: venue.salesTaxRate,
      taxInCart: venue.taxInCart,
      insuranceLanguage: venue.insuranceLanguage,
      insurancePolicyCopyRequirements: venue.insurancePolicyCopyRequirements,
      venueRelationshipIae: venue.venueRelationshipIae,
      venueTypeId: venue.venueTypeId,
      venueTypeName: venue.venueType?.venueTypeName ?? null,
      seatingTypeId: venue.seatingTypeId,
      seatingTypeName: venue.seatingType?.seatingName ?? null,
    };
  }

  async provisionVenueProfile(
    companyId: number,
  ): Promise<{ created: boolean }> {
    const c = await this.assertVenueCompanyForProfile(companyId);
    const existing = await this.venueRepo.findOne({ where: { companyId } });
    if (existing) {
      return { created: false };
    }
    const venue = this.venueRepo.create(
      this.newVenuePayload(companyId, c.companyName),
    );
    await this.venueRepo.save(venue);
    return { created: true };
  }

  async updateVenueProfile(
    companyId: number,
    dto: UpdateVenueProfileDto,
  ): Promise<void> {
    await this.assertVenueCompanyForProfile(companyId);
    const venue = await this.venueRepo.findOne({ where: { companyId } });
    if (!venue) {
      throw new NotFoundException({
        message:
          'No venue profile exists for this company yet. Use Create venue profile first.',
      });
    }
    if (dto.venueName !== undefined) {
      venue.venueName = dto.venueName.trim().slice(0, 200);
    }
    if (dto.seatingCapacity !== undefined) {
      venue.seatingCapacity = dto.seatingCapacity;
    }
    if (dto.salesTaxRate !== undefined) {
      const raw = dto.salesTaxRate;
      venue.salesTaxRate =
        raw === null || raw === undefined
          ? null
          : String(raw).trim() || null;
    }
    if (dto.taxInCart !== undefined) {
      venue.taxInCart = dto.taxInCart;
    }
    if (dto.insuranceLanguage !== undefined) {
      venue.insuranceLanguage = dto.insuranceLanguage?.trim() || null;
    }
    if (dto.insurancePolicyCopyRequirements !== undefined) {
      venue.insurancePolicyCopyRequirements =
        dto.insurancePolicyCopyRequirements?.trim() || null;
    }
    if (dto.venueRelationshipIae !== undefined) {
      venue.venueRelationshipIae = dto.venueRelationshipIae.trim().slice(0, 100);
    }
    if (dto.venueTypeId !== undefined) {
      venue.venueTypeId = dto.venueTypeId;
    }
    if (dto.seatingTypeId !== undefined) {
      venue.seatingTypeId = dto.seatingTypeId;
    }
    await this.venueRepo.save(venue);
  }

  private normalizeCompanyTypeName(name: string | null | undefined): string {
    return (name ?? '').trim().toLowerCase();
  }

  /**
   * Block company-type changes that would contradict how the row is already used
   * (tours, venue profile, engagement/project venues).
   */
  private async assertCompanyTypeChangeAllowed(
    companyId: number,
    oldCompanyTypeId: number,
    newCompanyTypeId: number,
  ): Promise<void> {
    if (oldCompanyTypeId === newCompanyTypeId) return;

    const newType = await this.companyTypeRepo.findOne({
      where: { companyTypeId: newCompanyTypeId },
    });
    if (!newType) {
      throw new BadRequestException({
        message: 'That company type is not valid. Pick a type from the list.',
      });
    }
    const newKind = this.normalizeCompanyTypeName(newType.companyTypeName);

    const tourMgmtCount = await this.tourRepo.count({
      where: { tourManagementCompanyId: companyId },
    });
    const venueRowCount = await this.venueRepo.count({ where: { companyId } });
    const engagementVenueCount = await this.engagementVenueRepo.count({
      where: { venueCompanyId: companyId },
    });
    const projectVenueCount = await this.engagementProjectVenueRepo.count({
      where: { venueCompanyId: companyId },
    });

    const needsVenueType =
      venueRowCount > 0 || engagementVenueCount > 0 || projectVenueCount > 0;
    const needsTalentAgencyType = tourMgmtCount > 0;

    if (needsVenueType && needsTalentAgencyType) {
      throw new ConflictException({
        message:
          'This company can’t be retyped while it is both used as a venue (or has a venue profile) and set as the tour management company on one or more tours. Reassign one of those links first so the company only needs one role.',
      });
    }

    if (needsVenueType && newKind !== 'venue') {
      const reasons: string[] = [];
      if (venueRowCount > 0) {
        reasons.push('it has a venue profile');
      }
      if (engagementVenueCount > 0) {
        reasons.push(
          `it is linked to ${engagementVenueCount} engagement venue${engagementVenueCount === 1 ? '' : 's'}`,
        );
      }
      if (projectVenueCount > 0) {
        reasons.push(
          `it is used on ${projectVenueCount} project venue link${projectVenueCount === 1 ? '' : 's'}`,
        );
      }
      throw new ConflictException({
        message: `This company can’t be retyped because ${reasons.join(' and ')}. It must stay a Venue, or remove those links first.`,
      });
    }

    if (needsTalentAgencyType && newKind !== 'talent agency') {
      throw new ConflictException({
        message: `This company can’t be retyped because it is the tour management company on ${tourMgmtCount} tour${tourMgmtCount === 1 ? '' : 's'}. It must stay a Talent Agency, or pick a different management company on those tours first.`,
      });
    }
  }

  async update(companyId: number, dto: UpdateCompanyDto): Promise<CompanyDetail> {
    const existing = await this.companyRepo.findOne({
      where: { companyId },
      relations: { physicalAddress: true, mailingAddress: true },
    });
    if (!existing)
      throw new NotFoundException(`Company ${companyId} not found`);

    /** If unchanged, name+type duplicate check is skipped (saves with only address/DMA edits). */
    const companyNameBefore = existing.companyName.trim();
    const companyTypeIdBefore = existing.companyTypeId;

    const oldPhysicalId = existing.physicalAddressId;
    const oldMailingId = existing.mailingAddressId;

    // Never UPDATE dbo.Address in place when the new values might match another row —
    // UX_Address dedupes on (line1, city, state, country, postal) and SQL Server
    // rejects updates that would duplicate. Reuse the same get-or-create path as create().
    let physicalAddressId = oldPhysicalId;
    if (dto.physical) {
      const resolved = await this.getOrCreateAddress(
        this.dataSource.manager,
        dto.physical,
      );
      physicalAddressId = resolved.addressId;
    }

    let mailingAddressId = oldMailingId;
    if (dto.mailingSameAsPhysical === true) {
      mailingAddressId = physicalAddressId;
    } else if (dto.mailing) {
      const resolved = await this.getOrCreateAddress(
        this.dataSource.manager,
        dto.mailing,
      );
      mailingAddressId = resolved.addressId;
    } else if (dto.physical && oldMailingId === oldPhysicalId) {
      mailingAddressId = physicalAddressId;
    }

    if (dto.companyName !== undefined) {
      existing.companyName = dto.companyName.trim();
    }
    if (dto.companyTypeId !== undefined) {
      await this.assertCompanyTypeChangeAllowed(
        companyId,
        existing.companyTypeId,
        dto.companyTypeId,
      );
      existing.companyTypeId = dto.companyTypeId;
    }

    /** Do not clear DMA: ignore null/0 from client; keep existing when re-resolution fails. */
    let nextDmaId: number | null = existing.dmaid ?? null;
    if (typeof dto.dmaId === 'number' && Number.isInteger(dto.dmaId) && dto.dmaId > 0) {
      nextDmaId = dto.dmaId;
    } else if (dto.physical) {
      const resolved = await this.resolveDmaId(
        dto.physical.postalCode,
        dto.physical.country,
      );
      if (resolved != null) {
        nextDmaId = resolved;
      }
    }
    existing.dmaid = nextDmaId;
    existing.physicalAddressId = physicalAddressId;
    existing.mailingAddressId = mailingAddressId;

    const nameAfter = existing.companyName.trim();
    const typeAfter = existing.companyTypeId;
    const nameOrTypeChanged =
      nameAfter !== companyNameBefore || typeAfter !== companyTypeIdBefore;
    if (nameOrTypeChanged) {
      await this.assertNoDuplicateCompany(this.dataSource.manager, {
        companyName: existing.companyName,
        companyTypeId: existing.companyTypeId,
        excludeCompanyId: companyId,
      });
    }

    // TypeORM can persist the loaded ManyToOne relations and overwrite PhysicalAddressID /
    // MailingAddressID with the stale in-memory join rows. Point relations at the rows that
    // match the IDs we just computed (otherwise DB and GET /companies stay on old e.g. street 880).
    if (physicalAddressId !== oldPhysicalId) {
      const pa = await this.addressRepo.findOneBy({ addressId: physicalAddressId });
      if (pa) existing.physicalAddress = pa;
    }
    if (mailingAddressId !== oldMailingId) {
      if (mailingAddressId === physicalAddressId) {
        existing.mailingAddress = existing.physicalAddress;
      } else {
        const ma = await this.addressRepo.findOneBy({ addressId: mailingAddressId });
        if (ma) existing.mailingAddress = ma;
      }
    }

    await this.companyRepo.save(existing);

    /**
     * Always return the freshly-joined detail row so the frontend can patch
     * its list cache in place (type name, DMA market name, nested addresses).
     */
    return this.findOne(companyId);
  }

  async remove(companyId: number): Promise<void> {
    const existing = await this.companyRepo.findOne({ where: { companyId } });
    if (!existing) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'This company was already removed or could not be found.',
        detail: 'The company was not found during delete.',
      });
    }

    const engagementVenueCount = await this.engagementVenueRepo.count({
      where: { venueCompanyId: companyId },
    });
    if (engagementVenueCount > 0) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `This company can’t be removed because it is linked to ${engagementVenueCount} engagement venue(s). Remove it from those engagements (or the venue list on each engagement) first, then try again.`,
        detail: `engagement_venue_venueCompanyId=${companyId} count=${engagementVenueCount}`,
      });
    }
    const projectVenueCount = await this.engagementProjectVenueRepo.count({
      where: { venueCompanyId: companyId },
    });
    if (projectVenueCount > 0) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `This company can’t be removed because it is used on ${projectVenueCount} project venue link(s). Remove or change those project venues first, then try again.`,
        detail: `engagement_project_venue_venueCompanyId=${companyId} count=${projectVenueCount}`,
      });
    }
    const tourAsManagementCount = await this.tourRepo.count({
      where: { tourManagementCompanyId: companyId },
    });
    if (tourAsManagementCount > 0) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message:
          'This company can’t be removed because it is set as the tour management (talent) company on one or more tours. Reassign or clear that on each tour first, then try again.',
        detail: `tour_tourManagementCompanyId=${companyId} count=${tourAsManagementCount}`,
      });
    }

    // Remove company-contact assignments first, and clean up orphaned contacts.
    const assignments = await this.assignmentRepo.find({
      where: { companyId },
      select: { contactAssignmentId: true },
    });
    for (const asg of assignments) {
      await this.removeContact(asg.contactAssignmentId);
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        // Attractions can reference this company as "attraction management" (nullable FK).
        // There may be no tours/engagements/projects, but this link still blocks dbo.Company
        // delete unless cleared first.
        await manager.update(
          Attraction,
          { attractionManagementLinkId: companyId },
          { attractionManagementLinkId: null },
        );
        // Legacy/CRM cross-refs: dbo.CompanyXref(CompanyID) -> Company(CompanyID).
        // Not the same as dbo.Engagement; rows here still block Company DELETE.
        const cid = Number(companyId);
        if (!Number.isInteger(cid) || cid <= 0) {
          throw new BadRequestException('Invalid company id for delete.');
        }
        await manager.query(
          `DELETE FROM [dbo].[CompanyXref] WHERE [CompanyID] = ${cid}`,
        );
        // Venue-type companies get a dbo.Venue row (1:1 on CompanyID). Remove it
        // before Company or SQL Server will block the delete with an FK error.
        await manager.delete(Venue, { companyId });
        await manager.delete(Company, { companyId });
      });
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Company delete blocked (companyId=${companyId}): ${detail}`,
      );
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message:
          'This company can’t be removed because it’s still linked to other records.',
        detail,
      });
    }

    // Intentionally keep address / lookup records untouched on company delete.
    // This protects pre-existing shared data from accidental removal.
  }

  async listContacts(companyId: number): Promise<CompanyContactRow[]> {
    await this.ensureCompany(companyId);
    const raw = await this.assignmentRepo
      .createQueryBuilder('ca')
      .innerJoin('ca.contact', 'ct')
      .innerJoin('ct.contactInfo', 'ci')
      .innerJoin('ca.role', 'r')
      .innerJoin('ca.department', 'd')
      .where('ca.companyId = :cid', { cid: companyId })
      .select([
        'ca.contactAssignmentId AS contactAssignmentId',
        'ca.contactId AS contactId',
        'ci.contactInfoId AS contactInfoId',
        'ci.firstName AS firstName',
        'ci.lastName AS lastName',
        'ci.email AS email',
        'ci.cellPhone AS cellPhone',
        'ci.workPhone AS workPhone',
        'r.roleId AS roleId',
        'r.roleName AS roleName',
        'd.departmentId AS departmentId',
        'd.departmentName AS departmentName',
      ])
      .orderBy('ci.lastName', 'ASC')
      .addOrderBy('ci.firstName', 'ASC')
      .getRawMany();

    return raw.map((row) => ({
      contactAssignmentId: Number(row.contactAssignmentId),
      contactId: Number(row.contactId),
      contactInfoId: Number(row.contactInfoId),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      email: String(row.email),
      cellPhone: row.cellPhone != null ? String(row.cellPhone) : null,
      workPhone: row.workPhone != null ? String(row.workPhone) : null,
      roleId: Number(row.roleId),
      roleName: String(row.roleName),
      departmentId: Number(row.departmentId),
      departmentName: String(row.departmentName),
    }));
  }

  async addContact(
    companyId: number,
    dto: CreateCompanyContactDto,
  ): Promise<CompanyContactRow> {
    await this.ensureCompany(companyId);
    assertOptionalE164Phone(dto.workPhone ?? null, 'work phone');
    assertOptionalE164Phone(dto.cellPhone ?? null, 'cell phone');

    return this.dataSource.transaction(async (em) => {
      const email = dto.email.trim();
      const existingInfo = await em
        .createQueryBuilder(ContactInfo, 'ci')
        .where('LOWER(ci.email) = LOWER(:email)', { email })
        .getOne();
      const savedInfo =
        existingInfo ??
        (await em.save(
          ContactInfo,
          em.create(ContactInfo, {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email,
            cellPhone: dto.cellPhone?.trim() || null,
            workPhone: dto.workPhone?.trim() || null,
          }),
        ));

      const existingContact = await em.findOne(Contact, {
        where: { contactInfoId: savedInfo.contactInfoId },
      });
      const savedContact =
        existingContact ??
        (await em.save(
          Contact,
          em.create(Contact, { contactInfoId: savedInfo.contactInfoId }),
        ));

      const existingAssignment = await em.findOne(ContactAssignment, {
        where: { companyId, contactId: savedContact.contactId },
      });
      if (existingAssignment) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'This contact is already linked to this company.',
          detail:
            'A contact assignment already exists for this company/contact pair.',
        });
      }

      const assignment = em.create(ContactAssignment, {
        contactId: savedContact.contactId,
        companyId,
        roleId: dto.roleId,
        departmentId: dto.departmentId,
      });
      const savedAsg = await em.save(ContactAssignment, assignment);

      const row = await this.getContactRow(savedAsg.contactAssignmentId, em);
      if (!row) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request',
            message:
              'The contact was saved but could not be loaded. Refresh the contacts list.',
            detail:
              'The contact row could not be loaded immediately after save. Check contact role/department links and joins.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return row;
    });
  }

  async updateContact(
    contactAssignmentId: number,
    dto: UpdateCompanyContactDto,
  ): Promise<CompanyContactRow> {
    const asg = await this.assignmentRepo.findOne({
      where: { contactAssignmentId },
      relations: { contact: { contactInfo: true } },
    });
    if (!asg) {
      throw new NotFoundException(
        `Contact assignment ${contactAssignmentId} not found`,
      );
    }

    if (dto.workPhone !== undefined) {
      assertOptionalE164Phone(dto.workPhone, 'work phone');
    }
    if (dto.cellPhone !== undefined) {
      assertOptionalE164Phone(dto.cellPhone, 'cell phone');
    }

    const info = asg.contact.contactInfo;
    if (dto.firstName !== undefined) info.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) info.lastName = dto.lastName.trim();
    if (dto.email !== undefined) info.email = dto.email.trim();
    if (dto.cellPhone !== undefined) {
      info.cellPhone = dto.cellPhone?.trim() || null;
    }
    if (dto.workPhone !== undefined) {
      info.workPhone = dto.workPhone?.trim() || null;
    }
    await this.contactInfoRepo.save(info);

    if (dto.roleId !== undefined) asg.roleId = dto.roleId;
    if (dto.departmentId !== undefined) asg.departmentId = dto.departmentId;
    await this.assignmentRepo.save(asg);

    const row = await this.getContactRow(contactAssignmentId);
    if (!row) throw new NotFoundException('Contact row missing after update');
    return row;
  }

  async removeContact(contactAssignmentId: number): Promise<void> {
    const asg = await this.assignmentRepo.findOne({
      where: { contactAssignmentId },
      relations: { contact: true },
    });
    if (!asg) {
      throw new NotFoundException(
        `Contact assignment ${contactAssignmentId} not found`,
      );
    }

    const contactId = asg.contactId;
    await this.assignmentRepo.delete({ contactAssignmentId });

    const remaining = await this.assignmentRepo.count({
      where: { contactId },
    });
    if (remaining === 0) {
      const contactInfoId = asg.contact.contactInfoId;
      await this.contactRepo.delete({ contactId });
      await this.contactInfoRepo.delete({ contactInfoId });
    }
  }

  /**
   * When called inside a transaction, pass `em` so the query sees uncommitted rows.
   */
  private async getContactRow(
    contactAssignmentId: number,
    em?: EntityManager,
  ): Promise<CompanyContactRow | null> {
    const assignmentRepo = em
      ? em.getRepository(ContactAssignment)
      : this.assignmentRepo;
    const raw = await assignmentRepo
      .createQueryBuilder('ca')
      .innerJoin('ca.contact', 'ct')
      .innerJoin('ct.contactInfo', 'ci')
      .innerJoin('ca.role', 'r')
      .innerJoin('ca.department', 'd')
      .where('ca.contactAssignmentId = :id', { id: contactAssignmentId })
      .select([
        'ca.contactAssignmentId AS contactAssignmentId',
        'ca.contactId AS contactId',
        'ci.contactInfoId AS contactInfoId',
        'ci.firstName AS firstName',
        'ci.lastName AS lastName',
        'ci.email AS email',
        'ci.cellPhone AS cellPhone',
        'ci.workPhone AS workPhone',
        'r.roleId AS roleId',
        'r.roleName AS roleName',
        'd.departmentId AS departmentId',
        'd.departmentName AS departmentName',
      ])
      .getRawOne();
    if (!raw) return null;
    return {
      contactAssignmentId: Number(raw.contactAssignmentId),
      contactId: Number(raw.contactId),
      contactInfoId: Number(raw.contactInfoId),
      firstName: String(raw.firstName),
      lastName: String(raw.lastName),
      email: String(raw.email),
      cellPhone: raw.cellPhone != null ? String(raw.cellPhone) : null,
      workPhone: raw.workPhone != null ? String(raw.workPhone) : null,
      roleId: Number(raw.roleId),
      roleName: String(raw.roleName),
      departmentId: Number(raw.departmentId),
      departmentName: String(raw.departmentName),
    };
  }

  async listEngagements(companyId: number): Promise<CompanyEngagementRow[]> {
    await this.ensureCompany(companyId);
    const raw = await this.engagementVenueRepo
      .createQueryBuilder('ev')
      .innerJoin(Engagement, 'e', 'e.engagementId = ev.engagementId')
      .leftJoin(Tour, 't', 't.tourId = e.tourId')
      .leftJoin(Attraction, 'a', 'a.attractionId = t.attractionId')
      .leftJoin(Company, 'vc', 'vc.companyId = ev.venueCompanyId')
      .leftJoin(Venue, 'v', 'v.companyId = ev.venueCompanyId')
      .where('ev.venueCompanyId = :cid', { cid: companyId })
      .select([
        'e.engagementId AS engagementId',
        'e.engagementStatus AS engagementStatus',
        't.tourName AS tourName',
        'a.attractionName AS attractionName',
        'vc.companyName AS venueCompanyName',
        'v.venueName AS venueName',
      ])
      .orderBy('e.engagementId', 'DESC')
      .getRawMany();

    return raw.map((r) => {
      const g = (k: string) =>
        (r as Record<string, unknown>)[k] ??
        (r as Record<string, unknown>)[k.toLowerCase()];
      const tourName = g('tourName') != null ? String(g('tourName')) : null;
      const attractionName =
        g('attractionName') != null ? String(g('attractionName')) : null;
      const venueCompanyName =
        g('venueCompanyName') != null ? String(g('venueCompanyName')) : null;
      const venueName = g('venueName') != null ? String(g('venueName')) : null;
      const venueLabel = venueCompanyName ?? venueName ?? 'TBD';
      return {
        engagementId: Number(g('engagementId')),
        engagementStatus: normalizeEngagementStatus(String(g('engagementStatus'))),
        tourName,
        attractionName,
        displayTitle: buildEngagementDisplayTitle(
          attractionName,
          tourName ?? '',
          venueLabel,
        ),
      };
    });
  }

  async updateVenueTicketing(
    companyId: number,
    dto: UpdateVenueTicketingDto,
  ): Promise<{ updated: boolean }> {
    const venue = await this.venueRepo.findOne({ where: { companyId } });
    if (!venue) {
      return { updated: false };
    }
    if (dto.seatingTypeId !== undefined) {
      venue.seatingTypeId = dto.seatingTypeId;
      await this.venueRepo.save(venue);
    }
    return { updated: true };
  }

  async getVenueTicketing(companyId: number): Promise<{
    seatingTypeId: number | null;
    seatingTypeName: string | null;
  } | null> {
    const venue = await this.venueRepo.findOne({
      where: { companyId },
      relations: { seatingType: true },
    });
    if (!venue) return null;
    return {
      seatingTypeId: venue.seatingTypeId,
      seatingTypeName: venue.seatingType?.seatingName ?? null,
    };
  }

  private async ensureCompany(companyId: number): Promise<void> {
    const n = await this.companyRepo.count({ where: { companyId } });
    if (!n) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'This company was not found.',
        detail: 'The company record does not exist.',
      });
    }
  }
}