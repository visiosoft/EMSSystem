import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttractionToursModule } from './attraction-tours/attraction-tours.module';
import { CompanyModule } from './company/company.module';
import { EngagementsModule } from './engagements/engagements.module';

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (!value) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
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
        options: {
          encrypt: parseBoolean(configService.get<string>('DB_ENCRYPT'), true),
          trustServerCertificate: parseBoolean(
            configService.get<string>('DB_TRUST_SERVER_CERT'),
            true,
          ),
        },
      }),
    }),
    CompanyModule,
    AttractionToursModule,
    EngagementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
