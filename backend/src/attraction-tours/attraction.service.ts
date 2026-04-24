import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Tour } from '../entities/tour.entity';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';
import { EmsAppCreatedStore } from './ems-app-created.store';

export interface AttractionListRow {
  attractionId: number;
  attractionName: string;
  activeTourCount: number;
  appCreated: boolean;
}

@Injectable()
export class AttractionService {
  constructor(
    @InjectRepository(Attraction)
    private readonly attractionRepo: Repository<Attraction>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    private readonly emsCreated: EmsAppCreatedStore,
  ) {}

  /** Case-insensitive uniqueness (matches list/search behavior). */
  private async assertUniqueAttractionName(
    name: string,
    excludeAttractionId?: number,
  ): Promise<void> {
    const t = name.trim();
    if (!t) return;
    const qb = this.attractionRepo
      .createQueryBuilder('a')
      .where('LOWER(a.attractionName) = LOWER(:name)', { name: t });
    if (excludeAttractionId != null) {
      qb.andWhere('a.attractionId != :excludeId', {
        excludeId: excludeAttractionId,
      });
    }
    const found = await qb.getOne();
    if (found) {
      throw new ConflictException(
        'An attraction with this name already exists. Choose a different name.',
      );
    }
  }

  async list(): Promise<AttractionListRow[]> {
    const attractions = await this.attractionRepo.find({ order: { attractionName: 'ASC' } });
    const countsRaw = await this.tourRepo
      .createQueryBuilder('t')
      .select('t.attractionId', 'aid')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('t.attractionId')
      .getRawMany<{ aid: number; cnt: string }>();
    const countMap = new Map<number, number>();
    for (const r of countsRaw) countMap.set(Number(r.aid), Number(r.cnt));
    return attractions.map((a) => ({
      attractionId: a.attractionId,
      attractionName: a.attractionName,
      activeTourCount: countMap.get(a.attractionId) ?? 0,
      appCreated: this.emsCreated.canDeleteAttraction(a.attractionId),
    }));
  }

  async listPaginated(
    offset: number,
    limit: number,
    q?: string,
  ): Promise<{ data: AttractionListRow[]; total: number }> {
    const trimmed = (q ?? '').trim();
    const baseQb = this.attractionRepo
      .createQueryBuilder('a')
      .orderBy('a.attractionName', 'ASC');
    if (trimmed) {
      baseQb.andWhere('LOWER(a.attractionName) LIKE LOWER(:like)', {
        like: `%${trimmed}%`,
      });
    }
    const total = await baseQb.getCount();
    const attractions = await baseQb.skip(offset).take(limit).getMany();
    const ids = attractions.map((a) => a.attractionId);
    const countMap = new Map<number, number>();
    if (ids.length > 0) {
      const countsRaw = await this.tourRepo
        .createQueryBuilder('t')
        .select('t.attractionId', 'aid')
        .addSelect('COUNT(*)', 'cnt')
        .where('t.attractionId IN (:...ids)', { ids })
        .groupBy('t.attractionId')
        .getRawMany<{ aid: number; cnt: string }>();
      for (const r of countsRaw) countMap.set(Number(r.aid), Number(r.cnt));
    }
    return {
      data: attractions.map((a) => ({
        attractionId: a.attractionId,
        attractionName: a.attractionName,
        activeTourCount: countMap.get(a.attractionId) ?? 0,
        appCreated: this.emsCreated.canDeleteAttraction(a.attractionId),
      })),
      total,
    };
  }


  async create(dto: CreateAttractionDto): Promise<AttractionListRow> {
    const attractionName = dto.attractionName.trim();
    if (!attractionName) {
      throw new BadRequestException('Attraction name is required.');
    }
    await this.assertUniqueAttractionName(attractionName);
    // Attraction only has AttractionName + AttractionManagementLinkID (nullable)
    const row = this.attractionRepo.create({
      attractionName,
      attractionManagementLinkId: null,
    });
    const saved = await this.attractionRepo.save(row);
    this.emsCreated.recordAttraction(saved.attractionId);
    return this.buildListRow(saved.attractionId);
  }

  async update(id: number, dto: UpdateAttractionDto): Promise<AttractionListRow> {
    const existing = await this.attractionRepo.findOne({ where: { attractionId: id } });
    if (!existing) throw new NotFoundException({ message: 'Attraction not found.' });
    if (dto.attractionName !== undefined) {
      const attractionName = dto.attractionName.trim();
      if (!attractionName) {
        throw new BadRequestException('Attraction name is required.');
      }
      await this.assertUniqueAttractionName(attractionName, id);
      existing.attractionName = attractionName;
    }
    await this.attractionRepo.save(existing);
    return this.buildListRow(id);
  }

  /** Same shape as GET /attractions rows, so the client can patch its cache in-place. */
  private async buildListRow(attractionId: number): Promise<AttractionListRow> {
    const a = await this.attractionRepo.findOne({ where: { attractionId } });
    if (!a) {
      throw new NotFoundException({ message: 'Attraction not found.' });
    }
    const activeTourCount = await this.tourRepo.count({ where: { attractionId } });
    return {
      attractionId: a.attractionId,
      attractionName: a.attractionName,
      activeTourCount,
      appCreated: this.emsCreated.canDeleteAttraction(a.attractionId),
    };
  }

  async remove(id: number): Promise<void> {
    const existing = await this.attractionRepo.findOne({ where: { attractionId: id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Attraction not found.' });
    }
    const tourCount = await this.tourRepo.count({ where: { attractionId: id } });
    if (tourCount > 0) {
      throw new ConflictException({
        message:
          'This attraction can’t be removed because it still has one or more tours. Remove those tours first (and close any engagements on them), then try again.',
      });
    }
    await this.attractionRepo.delete({ attractionId: id });
    this.emsCreated.removeAttraction(id);
  }
}