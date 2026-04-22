import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Class } from '../entities/class.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { Tour } from '../entities/tour.entity';
import { VenueType } from '../entities/venue-type.entity';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { EmsAppCreatedStore } from './ems-app-created.store';

export interface TourListRow {
  tourId: number;
  tourName: string;
  attractionId: number;
  attractionName: string;
  classId: number;
  className: string;
  audienceGender: string | null;
  audienceAgeRange: string | null;
  ascap: boolean;
  bmi: boolean;
  sesac: boolean;
  gmr: boolean;
  tourInsuranceLanguage: string | null;
  tourManagementCompanyId: number | null;
  tourManagementCompanyName: string | null;
  techRiderLinkId: number | null;
  venueTypePreferenceId: number | null;
  venueTypePreferenceName: string | null;
  appCreated: boolean;
}

@Injectable()
export class TourService {
  private readonly logger = new Logger(TourService.name);

  constructor(
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(Attraction)
    private readonly attractionRepo: Repository<Attraction>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(VenueType)
    private readonly venueTypeRepo: Repository<VenueType>,
    @InjectRepository(Engagement)
    private readonly engagementRepo: Repository<Engagement>,
    private readonly emsCreated: EmsAppCreatedStore,
  ) {}

  async list(): Promise<TourListRow[]> {
    const rows = await this.tourRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.attraction', 'a')
      .innerJoinAndSelect('t.class', 'c')
      .leftJoinAndSelect('t.tourManagementCompany', 'm')
      .leftJoinAndSelect('t.venueTypePreference', 'v')
      .orderBy('t.tourName', 'ASC')
      .getMany();

    return rows.map((t) => ({
      tourId: t.tourId,
      tourName: t.tourName,
      attractionId: t.attractionId,
      attractionName: t.attraction?.attractionName ?? '',
      classId: t.classId,
      className: t.class?.className ?? '',
      audienceGender: t.audienceGender,
      audienceAgeRange: t.audienceAgeRange,
      ascap: t.ascap,
      bmi: t.bmi,
      sesac: t.sesac,
      gmr: t.gmr,
      tourInsuranceLanguage: t.tourInsuranceLanguage,
      tourManagementCompanyId: t.tourManagementCompanyId,
      tourManagementCompanyName: t.tourManagementCompany?.companyName ?? null,
      techRiderLinkId: t.techRiderLinkId,
      venueTypePreferenceId: t.venueTypePreferenceId,
      venueTypePreferenceName: t.venueTypePreference?.venueTypeName ?? null,
      appCreated: this.emsCreated.canDeleteTour(t.tourId),
    }));
  }

  async listPaginated(
    offset: number,
    limit: number,
    q?: string,
  ): Promise<{ data: TourListRow[]; total: number }> {
    const qb = this.tourRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.attraction', 'a')
      .innerJoinAndSelect('t.class', 'c')
      .leftJoinAndSelect('t.tourManagementCompany', 'm')
      .leftJoinAndSelect('t.venueTypePreference', 'v')
      .orderBy('t.tourName', 'ASC');

    const trimmed = (q ?? '').trim();
    if (trimmed) {
      qb.andWhere(
        `(LOWER(t.tourName) LIKE LOWER(:like) OR LOWER(a.attractionName) LIKE LOWER(:like) OR LOWER(c.className) LIKE LOWER(:like) OR LOWER(ISNULL(m.companyName, '')) LIKE LOWER(:like))`,
        { like: `%${trimmed}%` },
      );
    }

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    return {
      data: rows.map((t) => ({
        tourId: t.tourId,
        tourName: t.tourName,
        attractionId: t.attractionId,
        attractionName: t.attraction?.attractionName ?? '',
        classId: t.classId,
        className: t.class?.className ?? '',
        audienceGender: t.audienceGender,
        audienceAgeRange: t.audienceAgeRange,
        ascap: t.ascap,
        bmi: t.bmi,
        sesac: t.sesac,
        gmr: t.gmr,
        tourInsuranceLanguage: t.tourInsuranceLanguage,
        tourManagementCompanyId: t.tourManagementCompanyId,
        tourManagementCompanyName: t.tourManagementCompany?.companyName ?? null,
        techRiderLinkId: t.techRiderLinkId,
        venueTypePreferenceId: t.venueTypePreferenceId,
        venueTypePreferenceName: t.venueTypePreference?.venueTypeName ?? null,
        appCreated: this.emsCreated.canDeleteTour(t.tourId),
      })),
      total,
    };
  }


  async create(dto: CreateTourDto): Promise<{ tourId: number }> {
    const attraction = await this.attractionRepo.findOne({
      where: { attractionId: dto.attractionId },
    });
    if (!attraction) {
      throw new NotFoundException({ message: 'Attraction not found.' });
    }
    const cls = await this.classRepo.findOne({
      where: { classId: dto.classId },
    });
    if (!cls) {
      throw new NotFoundException({ message: 'Genre (class) not found.' });
    }
    if (dto.tourManagementCompanyId != null) {
      const co = await this.companyRepo.findOne({
        where: { companyId: dto.tourManagementCompanyId },
      });
      if (!co) {
        throw new NotFoundException({
          message: 'Company not found for talent agent.',
        });
      }
    }

    const row = this.tourRepo.create({
      tourName: dto.tourName.trim(),
      attractionId: dto.attractionId,
      classId: dto.classId,
      audienceGender: null,
      audienceAgeRange: null,
      ascap: dto.ascap ?? false,
      bmi: dto.bmi ?? false,
      sesac: dto.sesac ?? false,
      gmr: dto.gmr ?? false,
      tourInsuranceLanguage: null,
      tourManagementCompanyId: dto.tourManagementCompanyId ?? null,
      techRiderLinkId: null,
      venueTypePreferenceId: null,
    });
    const saved = await this.tourRepo.save(row);
    this.emsCreated.recordTour(saved.tourId);
    return { tourId: saved.tourId };
  }

  async update(id: number, dto: UpdateTourDto): Promise<void> {
    const existing = await this.tourRepo.findOne({ where: { tourId: id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Tour not found.' });
    }
    if (dto.attractionId != null) {
      const a = await this.attractionRepo.findOne({
        where: { attractionId: dto.attractionId },
      });
      if (!a) throw new NotFoundException({ message: 'Attraction not found.' });
      existing.attractionId = dto.attractionId;
    }
    if (dto.classId != null) {
      const c = await this.classRepo.findOne({
        where: { classId: dto.classId },
      });
      if (!c)
        throw new NotFoundException({ message: 'Genre (class) not found.' });
      existing.classId = dto.classId;
    }
    if (dto.tourName !== undefined) {
      existing.tourName = dto.tourName.trim();
    }
    if (dto.ascap !== undefined) existing.ascap = dto.ascap;
    if (dto.bmi !== undefined) existing.bmi = dto.bmi;
    if (dto.sesac !== undefined) existing.sesac = dto.sesac;
    if (dto.gmr !== undefined) existing.gmr = dto.gmr;
    if (dto.tourManagementCompanyId !== undefined) {
      if (dto.tourManagementCompanyId != null) {
        const co = await this.companyRepo.findOne({
          where: { companyId: dto.tourManagementCompanyId },
        });
        if (!co)
          throw new NotFoundException({
            message: 'Company not found for talent agent.',
          });
      }
      existing.tourManagementCompanyId = dto.tourManagementCompanyId;
    }
    if (dto.audienceGender !== undefined) {
      existing.audienceGender = dto.audienceGender?.trim() || null;
    }
    if (dto.audienceAgeRange !== undefined) {
      existing.audienceAgeRange = dto.audienceAgeRange?.trim() || null;
    }
    if (dto.tourInsuranceLanguage !== undefined) {
      existing.tourInsuranceLanguage = dto.tourInsuranceLanguage?.trim() || null;
    }
    if (dto.venueTypePreferenceId !== undefined) {
      if (dto.venueTypePreferenceId != null) {
        const vt = await this.venueTypeRepo.findOne({
          where: { venueTypeId: dto.venueTypePreferenceId },
        });
        if (!vt)
          throw new NotFoundException({
            message: 'Venue type not found.',
          });
      }
      existing.venueTypePreferenceId = dto.venueTypePreferenceId;
    }
    try {
      await this.tourRepo.save(existing);
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const d = String((e as QueryFailedError).driverError ?? e.message);
        this.logger.warn(`Tour update failed (tourId=${id}): ${d}`);
        throw new BadRequestException({
          message:
            'Could not update the tour. The talent agent / company may be invalid for this tour, or the change conflicts with existing data.',
          detail: d,
        });
      }
      throw e;
    }
  }

  async remove(id: number): Promise<void> {
    const existing = await this.tourRepo.findOne({ where: { tourId: id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Tour not found.' });
    }
    const engCount = await this.engagementRepo.count({
      where: { tourId: id },
    });
    if (engCount > 0) {
      throw new ConflictException({
        message:
          'This tour can’t be removed because it’s still linked to one or more engagements. Remove or close those engagements first, then try again.',
      });
    }
    await this.tourRepo.delete({ tourId: id });
    this.emsCreated.removeTour(id);
  }
}