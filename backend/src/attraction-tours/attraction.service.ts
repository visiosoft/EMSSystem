import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateAttractionDto): Promise<{ attractionId: number }> {
    // Attraction only has AttractionName + AttractionManagementLinkID (nullable)
    const row = this.attractionRepo.create({
      attractionName: dto.attractionName.trim(),
      attractionManagementLinkId: null,
    });
    const saved = await this.attractionRepo.save(row);
    this.emsCreated.recordAttraction(saved.attractionId);
    return { attractionId: saved.attractionId };
  }

  async update(id: number, dto: UpdateAttractionDto): Promise<void> {
    const existing = await this.attractionRepo.findOne({ where: { attractionId: id } });
    if (!existing) throw new NotFoundException({ message: 'Attraction not found.' });
    if (dto.attractionName !== undefined) existing.attractionName = dto.attractionName.trim();
    await this.attractionRepo.save(existing);
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
