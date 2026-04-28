import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttractionToursModule } from './attraction-tours/attraction-tours.module';
import { CompanyModule } from './company/company.module';
import { EngagementsModule } from './engagements/engagements.module';
import { PerformancesModule } from './performances/performances.module';
import { ProjectsModule } from './projects/projects.module';
import { DailySalesModule } from './daily-sales/daily-sales.module';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '1433')),
        username: configService.get<string>('DB_USERNAME', 'SA'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME', 'master'),
        synchronize: false,
        autoLoadEntities: true,
        /**
         * If SQL is temporarily unavailable (startup ordering, transient network),
         * retry rather than failing the whole Nest boot.
         */
        retryAttempts: parseNumber(configService.get<string>('DB_RETRY_ATTEMPTS'), 10),
        retryDelay: parseNumber(configService.get<string>('DB_RETRY_DELAY_MS'), 3000),
        options: {
          encrypt: parseBoolean(configService.get<string>('DB_ENCRYPT'), true),
          trustServerCertificate: parseBoolean(
            configService.get<string>('DB_TRUST_SERVER_CERT'),
            true,
          ),
        },
        /**
         * `extra` is passed through to the underlying `mssql` driver (tedious).
         * Helps avoid hard 15s connect timeouts on slow links and keeps pool sane.
         */
        extra: {
          connectionTimeout: parseNumber(
            configService.get<string>('DB_CONNECTION_TIMEOUT_MS'),
            30000,
          ),
          requestTimeout: parseNumber(
            configService.get<string>('DB_REQUEST_TIMEOUT_MS'),
            30000,
          ),
          pool: {
            max: parseNumber(configService.get<string>('DB_POOL_MAX'), 10),
            min: parseNumber(configService.get<string>('DB_POOL_MIN'), 0),
            idleTimeoutMillis: parseNumber(
              configService.get<string>('DB_POOL_IDLE_TIMEOUT_MS'),
              30000,
            ),
          },
        },
      }),
    }),
    CompanyModule,
    AttractionToursModule,
    EngagementsModule,
    ProjectsModule,
    PerformancesModule,
    DailySalesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
