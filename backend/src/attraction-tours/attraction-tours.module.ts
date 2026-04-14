import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Class } from '../entities/class.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { Tour } from '../entities/tour.entity';
import { VenueType } from '../entities/venue-type.entity';
import { AttractionController } from './attraction.controller';
import { AttractionService } from './attraction.service';
import { EmsAppCreatedStore } from './ems-app-created.store';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attraction,
      Tour,
      Class,
      Company,
      VenueType,
      Engagement,
    ]),
  ],
  controllers: [AttractionController, TourController],
  providers: [AttractionService, TourService, EmsAppCreatedStore],
  exports: [AttractionService, TourService, EmsAppCreatedStore],
})
export class AttractionToursModule {}
