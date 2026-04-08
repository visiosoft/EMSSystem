import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getApiStatus();
  }

  @Get('db-health')
  async getDbHealth() {
    const db = await this.appService.getDatabaseStatus();
    return {
      ...this.appService.getApiStatus(),
      db,
    };
  }
}
