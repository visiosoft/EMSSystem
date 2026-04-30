import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { DailySalesService } from './daily-sales.service';

class UpdateSalesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  ticketsSold?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number | null;
}

@Controller('daily-sales')
export class DailySalesController {
  constructor(private readonly dailySalesService: DailySalesService) {}

  /**
   * GET /api/daily-sales/by-performance
   * Paged rows per show with PerformanceDate <= asOf.
   * Reporting columns: asOf (current) and asOf minus one calendar day.
   * ?asOfDate=YYYY-MM-DD (optional; defaults to server date in SQL)
   * &page=1&pageSize=25&search=&attraction=&performanceDate=YYYY-MM-DD
   */
  @Get('by-performance')
  findByPerformance(
    @Query('asOfDate') asOfDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('attraction') attraction?: string,
    @Query('performanceDate') performanceDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.dailySalesService.findByPerformancePage(
      asOfDate,
      page != null && page !== '' ? Number(page) : 1,
      pageSize != null && pageSize !== '' ? Number(pageSize) : 25,
      search,
      attraction,
      performanceDate,
      sortBy,
      sortDir,
    );
  }

  /**
   * GET /api/daily-sales
   * Legacy flat list — optional: ?engagementId=472
   */
  @Get()
  findAll(@Query('engagementId') engagementId?: string) {
    const id = engagementId ? Number(engagementId) : undefined;
    return this.dailySalesService.findAll(id);
  }

  /**
   * PATCH /api/daily-sales/:performanceId/:salesDate
   * Upserts PerformanceSalesQuantity and/or PerformanceSalesRevenue.
   * Creates the row if it doesn't exist yet (first entry for this date).
   * salesDate format: YYYY-MM-DD
   */
  @Patch(':performanceId/:salesDate')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateSales(
    @Param('performanceId') performanceId: string,
    @Param('salesDate') salesDate: string,
    @Body() body: UpdateSalesDto,
  ) {
    return this.dailySalesService.updateSales(
      Number(performanceId),
      salesDate,
      body,
    );
  }
}
