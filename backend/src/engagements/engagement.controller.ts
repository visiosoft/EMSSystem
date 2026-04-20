import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
}
