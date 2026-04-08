import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

function sqlCellToDisplay(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
      return String(value);
    default:
      return null;
  }
}

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

  async getDatabaseStatus(): Promise<{
    connected: boolean;
    latencyMs?: number;
    serverTime?: string | null;
    error?: string;
  }> {
    const started = Date.now();
    try {
      // TypeORM types query() as any; narrow manually for lint safety.
      const raw: unknown = await this.dataSource.query(
        'SELECT 1 AS ok, SYSDATETIME() AS server_time',
      );
      if (!Array.isArray(raw) || raw.length === 0) {
        return {
          connected: true,
          latencyMs: Date.now() - started,
          serverTime: null,
        };
      }
      const row = raw[0] as Record<string, unknown>;
      return {
        connected: true,
        latencyMs: Date.now() - started,
        serverTime: sqlCellToDisplay(row['server_time']),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        latencyMs: Date.now() - started,
        error: message,
      };
    }
  }
}
