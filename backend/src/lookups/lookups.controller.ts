import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
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

  /**
   * IMPORTANT: dma-markets/search MUST come before dma-markets
   * so NestJS doesn't treat 'search' as the :id param of a parameterized route.
   */
  @Get('dma-markets/search')
  async searchDmaMarkets(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lookupsService.searchDmaMarkets(
      query?.trim() ?? '',
      limit ? Number(limit) : 50,
    );
  }

  @Get('dma-markets')
  dmaMarkets(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') query?: string,
  ) {
    const safeLimit = Math.min(25, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);
    return this.lookupsService.findDmaMarketsPaginated(
      safeOffset,
      safeLimit,
      query?.trim() ?? '',
    );
  }
}