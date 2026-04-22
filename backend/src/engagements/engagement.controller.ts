import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AddEngagementVenueDto } from './dto/add-engagement-venue.dto';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { CreatePerformanceDto } from './dto/create-performance.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { EngagementService } from './engagement.service';

@Controller('engagements')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  // ─── Engagement CRUD ──────────────────────────────────────────────────────

  @Get()
  list() {
    return this.engagementService.list();
  }

  /** Distinct attraction / market / venue labels for list filters (must stay before `:id`). */
  @Get('filter-options')
  filterOptions() {
    return this.engagementService.filterOptions();
  }

  @Get('paged')
  listPaged(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('attraction') attraction?: string,
    @Query('dma') dma?: string,
    @Query('venue') venue?: string,
    @Query('timing') timing?: string,
  ) {
    const t =
      timing === 'upcoming' || timing === 'past'
        ? timing
        : ('all' as const);
    return this.engagementService.listPaginated(offset, limit, {
      q,
      status,
      attractionName: attraction,
      dmaMarketName: dma,
      venueLabel: venue,
      timing: t,
    });
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.engagementService.getOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEngagementDto) {
    return this.engagementService.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEngagementDto,
  ) {
    return this.engagementService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.engagementService.remove(id);
  }

  // ─── Engagement Venue APIs ─────────────────────────────────────────────────

  @Get(':id/venues')
  listVenues(@Param('id', ParseIntPipe) id: number) {
    return this.engagementService.listVenues(id);
  }

  @Post(':id/venues')
  @HttpCode(HttpStatus.CREATED)
  addVenue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddEngagementVenueDto,
  ) {
    return this.engagementService.addVenue(id, dto);
  }

  @Delete(':id/venues/:venueCompanyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVenue(
    @Param('id', ParseIntPipe) id: number,
    @Param('venueCompanyId', ParseIntPipe) venueCompanyId: number,
  ) {
    return this.engagementService.removeVenue(id, venueCompanyId);
  }

  // ─── Performance APIs ──────────────────────────────────────────────────────

  @Get(':id/performances')
  listPerformances(@Param('id', ParseIntPipe) id: number) {
    return this.engagementService.listPerformances(id);
  }

  @Post(':id/performances')
  @HttpCode(HttpStatus.CREATED)
  createPerformance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePerformanceDto,
  ) {
    return this.engagementService.createPerformance(id, dto);
  }

  @Patch(':id/performances/:performanceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  updatePerformance(
    @Param('id', ParseIntPipe) id: number,
    @Param('performanceId', ParseIntPipe) performanceId: number,
    @Body() dto: { performanceDate?: string; performanceTime?: string; performanceStatus?: string },
  ) {
    return this.engagementService.updatePerformance(id, performanceId, dto);
  }

  @Delete(':id/performances/:performanceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePerformance(
    @Param('id', ParseIntPipe) id: number,
    @Param('performanceId', ParseIntPipe) performanceId: number,
  ) {
    return this.engagementService.deletePerformance(id, performanceId);
  }
}
