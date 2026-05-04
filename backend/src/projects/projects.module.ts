import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { EngagementProject } from '../entities/engagement-project.entity';
import { EngagementProjectDma } from '../entities/engagement-project-dma.entity';
import { EngagementProjectPerformanceOption } from '../entities/engagement-project-performance-option.entity';
import { EngagementProjectVenue } from '../entities/engagement-project-venue.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EngagementProject,
      EngagementProjectDma,
      EngagementProjectVenue,
      EngagementProjectPerformanceOption,
      Tour,
      Attraction,
      Venue,
      Company,
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectsModule {}
