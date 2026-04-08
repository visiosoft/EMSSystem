import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getApiStatus() {
    return {
      message: 'NestJS backend is running',
      service: 'iae-event-flow-backend',
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseStatus() {
    try {
      await this.dataSource.query('SELECT 1 AS ok');
      return { connected: true };
    } catch {
      return { connected: false };
    }
  }
}
