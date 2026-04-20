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
   * Returns one row per Performance with today's and yesterday's
   * sales data joined. Used by the new Daily Sales UI.
   * Optional: ?performanceDate=YYYY-MM-DD to filter by performance date.
   */
  @Get('by-performance')
  findByPerformance(@Query('performanceDate') performanceDate?: string) {
    return this.dailySalesService.findByPerformance(performanceDate);
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
