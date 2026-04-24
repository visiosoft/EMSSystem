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
import { AddPerformanceOptionDto } from './dto/add-performance-option.dto';
import { AddProjectVenueDto } from './dto/add-project-venue.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdatePerformanceOptionDto } from './dto/update-performance-option.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectVenueDto } from './dto/update-project-venue.dto';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // ─── Project meta (must be registered before :id) ───────────────────────

  @Get('meta/project-stages')
  projectStagesMeta() {
    return this.projectService.getProjectStageMeta();
  }

  @Get('meta/venue-statuses')
  venueStatusesMeta() {
    return this.projectService.getVenueStatusMeta();
  }

  // ─── Project CRUD ─────────────────────────────────────────────────────────

  @Get()
  list(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('projectStage') projectStage?: string,
  ) {
    return this.projectService.listPaginated(offset, limit, q, projectStage);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }

  // ─── Project Venue APIs ───────────────────────────────────────────────────

  @Post(':id/venues')
  @HttpCode(HttpStatus.CREATED)
  addVenue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProjectVenueDto,
  ) {
    return this.projectService.addVenue(id, dto);
  }

  @Patch(':id/venues/:venueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateVenue(
    @Param('id', ParseIntPipe) id: number,
    @Param('venueId', ParseIntPipe) venueId: number,
    @Body() dto: UpdateProjectVenueDto,
  ) {
    return this.projectService.updateVenue(id, venueId, dto);
  }

  @Delete(':id/venues/:venueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVenue(
    @Param('id', ParseIntPipe) id: number,
    @Param('venueId', ParseIntPipe) venueId: number,
  ) {
    return this.projectService.removeVenue(id, venueId);
  }

  // ─── Performance Option APIs ──────────────────────────────────────────────

  @Post(':id/performance-options')
  @HttpCode(HttpStatus.CREATED)
  addPerformanceOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPerformanceOptionDto,
  ) {
    return this.projectService.addPerformanceOption(id, dto);
  }

  @Patch(':id/performance-options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  updatePerformanceOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdatePerformanceOptionDto,
  ) {
    return this.projectService.updatePerformanceOption(id, optionId, dto);
  }

  @Delete(':id/performance-options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePerformanceOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ) {
    return this.projectService.removePerformanceOption(id, optionId);
  }
}
