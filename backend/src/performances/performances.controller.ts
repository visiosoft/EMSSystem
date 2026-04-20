import { Controller, Get, Query } from '@nestjs/common';
import { PerformancesService } from './performances.service';

@Controller('performances')
export class PerformancesController {
  constructor(private readonly performancesService: PerformancesService) {}

  /**
   * GET /api/performances
   * Optional query params:
   *   year  – filter by year (e.g. 2026)
   *   month – filter by 1-based month (e.g. 3 = March)
   */
  @Get()
  findAll(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.performancesService.findAll(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
