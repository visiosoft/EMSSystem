import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyType } from '../entities/company-type.entity';
import { Dma } from '../entities/dma.entity';
import { Address } from '../entities/address.entity';
import { Venue } from '../entities/venue.entity';
import { VenueType } from '../entities/venue-type.entity';
import { VenueDirectoryController } from './venue-directory.controller';
import { VenueDirectoryService } from './venue-directory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venue,
      CompanyType,
      Dma,
      Address,
      VenueType,
    ]),
  ],
  controllers: [VenueDirectoryController],
  providers: [VenueDirectoryService],
})
export class VenueDirectoryModule {}
