import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttractionToursModule } from '../attraction-tours/attraction-tours.module';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { Link } from '../entities/link.entity';
import { EngagementFinances } from '../entities/engagement-finance.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { NonResidentWithholding } from '../entities/non-resident-withholding.entity';
import { ArtistFinance } from '../entities/artist-finance.entity';
import { SettlementFinance } from '../entities/settlement-finance.entity';
import { Performance } from '../entities/performance.entity';
import { TicketingSales } from '../entities/ticketing-sales.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Engagement,
      Link,
      EngagementFinances,
      EngagementVenue,
      Performance,
      TicketingSales,
      Attraction,
      Tour,
      Venue,
      Company,
      NonResidentWithholding,
      ArtistFinance,
      SettlementFinance,
    ]),
    AttractionToursModule,
  ],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementsModule {}
