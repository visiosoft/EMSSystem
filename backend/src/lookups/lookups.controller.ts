import { Controller, Get, Param } from '@nestjs/common';
import { LookupsService } from './lookups.service';

@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('company-types')
  companyTypes() {
    return this.lookupsService.findCompanyTypes();
  }

  @Get('roles')
  roles() {
    return this.lookupsService.findRoles();
  }

  @Get('departments')
  departments() {
    return this.lookupsService.findDepartments();
  }

  @Get('seating-types')
  seatingTypes() {
    return this.lookupsService.findSeatingTypes();
  }

  @Get('classes')
  classes() {
    return this.lookupsService.findClasses();
  }

  @Get('venue-types')
  venueTypes() {
    return this.lookupsService.findVenueTypes();
  }

  @Get('dma-by-postal/:postalCode')
  async dmaByPostal(@Param('postalCode') postalCode: string) {
    const row = await this.lookupsService.findDmaByPostal(postalCode);
    return row ?? null;
  }
}
