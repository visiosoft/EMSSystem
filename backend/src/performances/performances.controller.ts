import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PerformancesService } from './performances.service';

@Controller('performances')
export class PerformancesController {
  constructor(private readonly performancesService: PerformancesService) {}

  /**
   * Paginated list for Calendar “List” view.
   * Must be registered before the bare `@Get()` route.
   */
  @Get('paged')
  findPaged(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('visibility') visibility?: string | string[],
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const visList = visibility
      ? Array.isArray(visibility)
        ? visibility
        : visibility
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
      : ['Unknown', 'Private', 'Public'];
    const safeLimit = Math.min(10_000, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);
    return this.performancesService.findAllPaginated(
      year,
      month,
      safeOffset,
      safeLimit,
      visList,
      sortBy,
      sortDir,
    );
  }

  /**
   * GET /api/performances
   * Optional query params:
   *   year  – filter by year (e.g. 2026)
   *   month – filter by 1-based month (e.g. 3 = March)
   */
  @Get()
  findAll(@Query('year') year?: string, @Query('month') month?: string) {
    return this.performancesService.findAll(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
