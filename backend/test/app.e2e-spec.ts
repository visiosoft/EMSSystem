import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getApiStatus: jest.fn().mockReturnValue({
              message: 'NestJS backend is running',
              service: 'iae-event-flow-backend',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
            getDatabaseStatus: jest.fn().mockResolvedValue({ connected: true }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer()).get('/api').expect(200).expect({
      message: 'NestJS backend is running',
      service: 'iae-event-flow-backend',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
