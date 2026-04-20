import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { Company } from '../entities/company.entity';
import { Engagement } from '../entities/engagement.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Performance } from '../entities/performance.entity';
import { TicketingSales } from '../entities/ticketing-sales.entity';
import { Tour } from '../entities/tour.entity';
import { Venue } from '../entities/venue.entity';
import { DailySalesController } from './daily-sales.controller';
import { DailySalesService } from './daily-sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketingSales,
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
  controllers: [DailySalesController],
  providers: [DailySalesService],
})
export class DailySalesModule {}
