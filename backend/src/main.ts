import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
