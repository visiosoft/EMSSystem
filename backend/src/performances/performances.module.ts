import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { PerformancesController } from './performances.controller';
import { PerformancesService } from './performances.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Performance,
      Engagement,
      Tour,
      Attraction,
      EngagementVenue,
      Venue,
      Company,
      Address,
    ]),
  ],
  controllers: [PerformancesController],
  providers: [PerformancesService],
  exports: [PerformancesService],
})
export class PerformancesModule {}
