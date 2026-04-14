import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Class } from '../entities/class.entity';
import { Engagement } from '../entities/engagement.entity';
import { Tour } from '../entities/tour.entity';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';
import { EmsAppCreatedStore } from './ems-app-created.store';

export interface AttractionListRow {
  attractionId: number;
  attractionName: string;
  classId: number;
  className: string;
  activeTourCount: number;
  /** True when this row was created via the EMS app (eligible for delete rules). */
  appCreated: boolean;
}

@Injectable()
export class AttractionService {
  constructor(
    @InjectRepository(Attraction)
    private readonly attractionRepo: Repository<Attraction>,
    @InjectRepository(Tour)
    private readonly tourRepo: Repository<Tour>,
    @InjectRepository(Engagement)
    private readonly engagementRepo: Repository<Engagement>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    private readonly emsCreated: EmsAppCreatedStore,
  ) {}

  async list(): Promise<AttractionListRow[]> {
    const attractions = await this.attractionRepo.find({
      relations: ['class'],
      order: { attractionName: 'ASC' },
    });
    const countsRaw = await this.tourRepo
      .createQueryBuilder('t')
      .select('t.attractionId', 'aid')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('t.attractionId')
      .getRawMany<{ aid: number; cnt: string }>();
    const countMap = new Map<number, number>();
    for (const r of countsRaw) {
      countMap.set(Number(r.aid), Number(r.cnt));
    }
    return attractions.map((a) => ({
      attractionId: a.attractionId,
      attractionName: a.attractionName,
      classId: a.classId,
      className: a.class?.className ?? '',
      activeTourCount: countMap.get(a.attractionId) ?? 0,
      appCreated: this.emsCreated.canDeleteAttraction(a.attractionId),
    }));
  }

  async create(dto: CreateAttractionDto): Promise<{ attractionId: number }> {
    const cls = await this.classRepo.findOne({
      where: { classId: dto.classId },
    });
    if (!cls) {
      throw new NotFoundException({
        message: 'Genre (class) not found.',
        detail: `No Class row for ClassID=${dto.classId}`,
      });
    }
    if (dto.attractionManagementLinkId != null) {
      throw new ConflictException({
        message: 'Management link cannot be set from this form yet.',
        detail: 'AttractionManagementLinkID requires a Link row; omit for now.',
      });
    }
    const row = this.attractionRepo.create({
      attractionName: dto.attractionName.trim(),
      classId: dto.classId,
      attractionManagementLinkId: null,
    });
    const saved = await this.attractionRepo.save(row);
    this.emsCreated.recordAttraction(saved.attractionId);
    return { attractionId: saved.attractionId };
  }

  async update(id: number, dto: UpdateAttractionDto): Promise<void> {
    const existing = await this.attractionRepo.findOne({
      where: { attractionId: id },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Attraction not found.' });
    }
    if (dto.classId != null) {
      const cls = await this.classRepo.findOne({
        where: { classId: dto.classId },
      });
      if (!cls) {
        throw new NotFoundException({ message: 'Genre (class) not found.' });
      }
      existing.classId = dto.classId;
    }
    if (dto.attractionName !== undefined) {
      existing.attractionName = dto.attractionName.trim();
    }
    if (dto.attractionManagementLinkId !== undefined) {
      throw new ConflictException({
        message: 'Management link cannot be updated from this form yet.',
      });
    }
    await this.attractionRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    if (!this.emsCreated.canDeleteAttraction(id)) {
      throw new ForbiddenException({
        message: 'Only attractions created in this app can be removed.',
        detail: 'Pre-existing attractions cannot be deleted from the API.',
      });
    }
    const tourCount = await this.tourRepo.count({
      where: { attractionId: id },
    });
    if (tourCount > 0) {
      throw new ConflictException({
        message: 'Remove tours for this attraction before deleting it.',
        detail: `There are ${tourCount} tour(s) linked to this attraction.`,
      });
    }
    const engCount = await this.engagementRepo.count({
      where: { attractionId: id },
    });
    if (engCount > 0) {
      throw new ConflictException({
        message: 'This attraction still has engagements and cannot be removed.',
        detail: `Engagement count=${engCount}`,
      });
    }
    await this.attractionRepo.delete({ attractionId: id });
  }
}
