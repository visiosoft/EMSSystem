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
import { EngagementProject } from '../entities/engagement-project.entity';
import { Link } from '../entities/link.entity';
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
  /** dbo.Link.LinkURL from Tour.BannerLinkID */
  tourBannerImageUrl: string | null;
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
    @InjectRepository(EngagementProject)
    private readonly engagementProjectRepo: Repository<EngagementProject>,
    @InjectRepository(Link)
    private readonly linkRepo: Repository<Link>,
    private readonly emsCreated: EmsAppCreatedStore,
  ) {}

  private async attachBannerFromUpload(
    tour: Tour,
    file: Express.Multer.File,
  ): Promise<void> {
    const fileName = file.filename;
    if (!fileName?.trim()) {
      throw new BadRequestException('Upload did not produce a filename.');
    }
    const publicPath = `/uploads/tour-banners/${fileName}`.slice(0, 2048);
    const safeName = (file.originalname || 'Tour banner')
      .replace(/[\x00-\x1f]/g, '')
      .slice(0, 255);
    const link = this.linkRepo.create({
      linkType: 'Image',
      linkUrl: publicPath,
      linkPath: publicPath.slice(0, 1024),
      linkName: safeName || 'Tour banner',
    });
    const savedLink = await this.linkRepo.save(link);
    tour.bannerLinkId = savedLink.linkId;
    await this.tourRepo.save(tour);
  }

  private async tourBannerUrlsByTourIds(
    tourIds: number[],
  ): Promise<Map<number, string | null>> {
    const uniq = [...new Set(tourIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const map = new Map<number, string | null>();
    for (const id of uniq) map.set(id, null);
    if (!uniq.length) return map;

    const rows = await this.tourRepo
      .createQueryBuilder('t')
      .leftJoin(Link, 'tb', 'tb.linkId = t.bannerLinkId')
      .select('t.tourId', 'tourId')
      .addSelect('tb.linkUrl', 'tourBannerImageUrl')
      .where('t.tourId IN (:...ids)', { ids: uniq })
      .getRawMany<{ tourId: number; tourBannerImageUrl: string | null }>();

    for (const row of rows) {
      const tid = Number(row.tourId);
      const u =
        row.tourBannerImageUrl != null
          ? String(row.tourBannerImageUrl).trim()
          : '';
      map.set(tid, u || null);
    }
    return map;
  }

  private mapTourEntityToRow(
    t: Tour,
    tourBannerImageUrl: string | null,
  ): TourListRow {
    return {
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
      tourBannerImageUrl,
      appCreated: this.emsCreated.canDeleteTour(t.tourId),
    };
  }

  /** Tour names are globally unique (case-insensitive), across all attractions. */
  private async assertUniqueTourName(
    tourName: string,
    excludeTourId?: number,
  ): Promise<void> {
    const t = tourName.trim();
    if (!t) return;
    const qb = this.tourRepo
      .createQueryBuilder('t')
      .where('LOWER(t.tourName) = LOWER(:tourName)', { tourName: t });
    if (excludeTourId != null) {
      qb.andWhere('t.tourId != :excludeTourId', { excludeTourId });
    }
    const found = await qb.getOne();
    if (found) {
      throw new ConflictException(
        'A tour with this name already exists. Choose a different name.',
      );
    }
  }

  async list(): Promise<TourListRow[]> {
    const rows = await this.tourRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.attraction', 'a')
      .innerJoinAndSelect('t.class', 'c')
      .leftJoinAndSelect('t.tourManagementCompany', 'm')
      .leftJoinAndSelect('t.venueTypePreference', 'v')
      .orderBy('t.tourName', 'ASC')
      .getMany();

    const bannerMap = await this.tourBannerUrlsByTourIds(
      rows.map((t) => t.tourId),
    );
    return rows.map((t) =>
      this.mapTourEntityToRow(t, bannerMap.get(t.tourId) ?? null),
    );
  }

  async listPaginated(
    offset: number,
    limit: number,
    q?: string,
    sortByRaw?: string,
    sortDirRaw?: string,
  ): Promise<{ data: TourListRow[]; total: number }> {
    const qb = this.tourRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.attraction', 'a')
      .innerJoinAndSelect('t.class', 'c')
      .leftJoinAndSelect('t.tourManagementCompany', 'm')
      .leftJoinAndSelect('t.venueTypePreference', 'v');

    const sortBy = (sortByRaw ?? '').trim().toLowerCase();
    const sortDir =
      (sortDirRaw ?? '').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    if (sortBy === 'attraction') {
      qb.orderBy('a.attractionName', sortDir).addOrderBy('t.tourName', 'ASC');
    } else if (sortBy === 'class') {
      qb.orderBy('c.className', sortDir).addOrderBy('t.tourName', 'ASC');
    } else if (sortBy === 'management' || sortBy === 'tourmgmt') {
      qb.orderBy('m.companyName', sortDir).addOrderBy('t.tourName', 'ASC');
    } else {
      qb.orderBy('t.tourName', sortDir).addOrderBy('t.tourId', 'ASC');
    }

    const trimmed = (q ?? '').trim();
    if (trimmed) {
      qb.andWhere(
        `(LOWER(t.tourName) LIKE LOWER(:like) OR LOWER(a.attractionName) LIKE LOWER(:like) OR LOWER(c.className) LIKE LOWER(:like) OR LOWER(ISNULL(m.companyName, '')) LIKE LOWER(:like))`,
        { like: `%${trimmed}%` },
      );
    }

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    const bannerMap = await this.tourBannerUrlsByTourIds(
      rows.map((t) => t.tourId),
    );
    return {
      data: rows.map((t) =>
        this.mapTourEntityToRow(t, bannerMap.get(t.tourId) ?? null),
      ),
      total,
    };
  }

  async create(
    dto: CreateTourDto,
    bannerFile?: Express.Multer.File,
  ): Promise<TourListRow> {
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

    const tourName = dto.tourName.trim();
    if (!tourName) {
      throw new BadRequestException('Tour name is required.');
    }
    await this.assertUniqueTourName(tourName);

    const row = this.tourRepo.create({
      tourName,
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
      bannerLinkId: null,
    });
    const saved = await this.tourRepo.save(row);
    this.emsCreated.recordTour(saved.tourId);
    if (bannerFile) {
      await this.attachBannerFromUpload(saved, bannerFile);
    }
    return this.buildListRow(saved.tourId);
  }

  async update(
    id: number,
    dto: UpdateTourDto,
    bannerFile?: Express.Multer.File,
  ): Promise<TourListRow> {
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
      existing.tourInsuranceLanguage =
        dto.tourInsuranceLanguage?.trim() || null;
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
    const finalName = existing.tourName.trim();
    if (!finalName) {
      throw new BadRequestException('Tour name is required.');
    }
    existing.tourName = finalName;
    await this.assertUniqueTourName(finalName, id);
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

    const refreshed = await this.tourRepo.findOne({ where: { tourId: id } });
    if (!refreshed) {
      throw new NotFoundException({ message: 'Tour not found.' });
    }
    if (bannerFile) {
      await this.attachBannerFromUpload(refreshed, bannerFile);
    } else if (dto.removeBanner) {
      refreshed.bannerLinkId = null;
      await this.tourRepo.save(refreshed);
    }

    return this.buildListRow(id);
  }

  /** Same shape as GET /tours rows, so the client can patch its cache in-place. */
  private async buildListRow(tourId: number): Promise<TourListRow> {
    const t = await this.tourRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.attraction', 'a')
      .innerJoinAndSelect('t.class', 'c')
      .leftJoinAndSelect('t.tourManagementCompany', 'm')
      .leftJoinAndSelect('t.venueTypePreference', 'v')
      .where('t.tourId = :tourId', { tourId })
      .getOne();
    if (!t) {
      throw new NotFoundException({ message: 'Tour not found.' });
    }
    const bannerMap = await this.tourBannerUrlsByTourIds([tourId]);
    return this.mapTourEntityToRow(t, bannerMap.get(tourId) ?? null);
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
    const projectCount = await this.engagementProjectRepo.count({
      where: { tourId: id },
    });
    if (projectCount > 0) {
      throw new ConflictException({
        message:
          'This tour can’t be removed because it is linked to one or more projects. Remove or reassign the project so it no longer uses this tour, then try again.',
      });
    }
    await this.tourRepo.delete({ tourId: id });
    this.emsCreated.removeTour(id);
  }
}
