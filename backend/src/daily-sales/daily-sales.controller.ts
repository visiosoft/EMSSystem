import { Controller, Get, Query } from '@nestjs/common';
import { DailySalesService } from './daily-sales.service';

@Controller('daily-sales')
export class DailySalesController {
  constructor(private readonly dailySalesService: DailySalesService) {}

  /**
   * GET /api/daily-sales
   * Optional: ?engagementId=472 to scope to a single engagement
   */
  @Get()
  findAll(@Query('engagementId') engagementId?: string) {
    const id = engagementId ? Number(engagementId) : undefined;
    return this.dailySalesService.findAll(id);
  }
}
