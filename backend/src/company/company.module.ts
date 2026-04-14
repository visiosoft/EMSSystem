import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/address.entity';
import { Attraction } from '../entities/attraction.entity';
import { CompanyType } from '../entities/company-type.entity';
import { Company } from '../entities/company.entity';
import { ContactAssignment } from '../entities/contact-assignment.entity';
import { ContactInfo } from '../entities/contact-info.entity';
import { Contact } from '../entities/contact.entity';
import { Department } from '../entities/department.entity';
import { Dma } from '../entities/dma.entity';
import { EngagementVenue } from '../entities/engagement-venue.entity';
import { Engagement } from '../entities/engagement.entity';
import { Role } from '../entities/role.entity';
import { NonResidentWithholding } from '../entities/non-resident-withholding.entity';
import { SeatingType } from '../entities/seating-type.entity';
import { Tour } from '../entities/tour.entity';
import { Class } from '../entities/class.entity';
import { VenueType } from '../entities/venue-type.entity';
import { Venue } from '../entities/venue.entity';
import { LookupsController } from '../lookups/lookups.controller';
import { LookupsService } from '../lookups/lookups.service';
import {
  CompanyController,
  ContactAssignmentsController,
} from './company.controller';
import { CompanyService } from './company.service';

const entities = [
  Address,
  CompanyType,
  Company,
  Dma,
  ContactInfo,
  Contact,
  ContactAssignment,
  Role,
  Department,
  Venue,
  EngagementVenue,
  Engagement,
  Tour,
  Attraction,
  SeatingType,
  VenueType,
  NonResidentWithholding,
  Class,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [
    CompanyController,
    ContactAssignmentsController,
    LookupsController,
  ],
  providers: [CompanyService, LookupsService],
  exports: [CompanyService, LookupsService],
})
export class CompanyModule {}
