import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TOUR_BANNER_UPLOAD_DIR } from './attraction-tours/tour-banner-multer.config';

const DEFAULT_PORT = 3001;

async function bootstrap() {
  fs.mkdirSync(TOUR_BANNER_UPLOAD_DIR, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(TOUR_BANNER_UPLOAD_DIR, { prefix: '/uploads/tour-banners/' });
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const logger = new Logger('Bootstrap');

  try {
    await app.listen(port);
    logger.log(`Listening on http://localhost:${port} (api prefix: /api)`);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Stop the other process (e.g. an old Nest server) or set PORT in backend/.env — try PORT=${DEFAULT_PORT + 1}. On Linux: fuser -k ${port}/tcp`,
      );
    }
    throw err;
  }
}
void bootstrap();
