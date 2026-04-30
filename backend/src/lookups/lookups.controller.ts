import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
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

  @Get('brands')
  brands() {
    return this.lookupsService.findBrands();
  }

  @Get('taxes')
  taxes() {
    return this.lookupsService.findTaxes();
  }

  @Get('services-provided')
  servicesProvided() {
    return this.lookupsService.findServicesProvided();
  }

  @Get('stagehand-providers')
  stagehandProviders() {
    return this.lookupsService.findStagehandProviders();
  }

  @Get('non-resident-withholdings')
  nonResidentWithholdings() {
    return this.lookupsService.findNonResidentWithholdings();
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
    const raw = limit ? Number(limit) : 50;
    const safeLimit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.floor(raw))) : 50;
    return this.lookupsService.searchDmaMarkets(query?.trim() ?? '', safeLimit);
  }

  @Get('dma-markets')
  dmaMarkets(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') query?: string,
  ) {
    const safeLimit = Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 25;
    const safeOffset = Math.max(0, offset);
    return this.lookupsService.findDmaMarketsPaginated(
      safeOffset,
      safeLimit,
      query?.trim() ?? '',
    );
  }
}
