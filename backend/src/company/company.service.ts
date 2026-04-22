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
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { normalizeEngagementStatus } from '../engagements/engagement-status.util';
import { CreateCompanyContactDto } from './dto/create-company-contact.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyContactDto } from './dto/create-company-contact.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateVenueTicketingDto } from './dto/update-venue-ticketing.dto';
import { UpdateVenueProfileDto } from './dto/update-venue-profile.dto';

export interface CompanyListRow {
  companyId: number;
  companyName: string;
  companyTypeId: number;
  companyTypeName: string;
  physicalCity: string;
  physicalStateProvince: string;
  dmaId: number;
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
      dmaMarketName: c.dma.marketName,
      physicalAddress: c.physicalAddress,
      mailingAddress: c.mailingAddress,
    };
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
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

    return this.dataSource.transaction(async (em) => {
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
      const saved = await em.save(Company, company);
      await this.ensureVenueRowForNewVenueCompany(em, saved);
      return saved;
    });
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

  async update(companyId: number, dto: UpdateCompanyDto): Promise<Company> {
    const existing = await this.companyRepo.findOne({
      where: { companyId },
      relations: { physicalAddress: true, mailingAddress: true },
    });
    if (!existing)
      throw new NotFoundException(`Company ${companyId} not found`);

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
      existing.companyTypeId = dto.companyTypeId;
    }

    let dmaId = existing.dmaid;
    if (dto.dmaId !== undefined) {
      dmaId = dto.dmaId;
    } else if (dto.physical) {
      const resolved = await this.resolveDmaId(
        dto.physical.postalCode,
        dto.physical.country,
      );
      if (resolved != null) dmaId = resolved;
    }
    existing.dmaid = dmaId;
    existing.physicalAddressId = physicalAddressId;
    existing.mailingAddressId = mailingAddressId;

    return this.companyRepo.save(existing);
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

    // Remove company-contact assignments first, and clean up orphaned contacts.
    const assignments = await this.assignmentRepo.find({
      where: { companyId },
      select: { contactAssignmentId: true },
    });
    for (const asg of assignments) {
      await this.removeContact(asg.contactAssignmentId);
    }

    try {
      await this.companyRepo.delete({ companyId });
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
      .where('ev.venueCompanyId = :cid', { cid: companyId })
      .select([
        'e.engagementId AS engagementId',
        'e.engagementStatus AS engagementStatus',
        't.tourName AS tourName',
        'a.attractionName AS attractionName',
      ])
      .orderBy('e.engagementId', 'DESC')
      .getRawMany();

    return raw.map((r) => {
      const g = (k: string) =>
        (r as Record<string, unknown>)[k] ??
        (r as Record<string, unknown>)[k.toLowerCase()];
      return {
        engagementId: Number(g('engagementId')),
        engagementStatus: normalizeEngagementStatus(String(g('engagementStatus'))),
        tourName: g('tourName') != null ? String(g('tourName')) : null,
        attractionName:
          g('attractionName') != null ? String(g('attractionName')) : null,
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
