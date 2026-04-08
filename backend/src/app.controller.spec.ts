import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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
            getDatabaseStatus: jest.fn().mockResolvedValue({
              connected: true,
              latencyMs: 2,
              serverTime: '2026-01-01T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return api health payload', () => {
      expect(appController.getHealth()).toEqual({
        message: 'NestJS backend is running',
        service: 'iae-event-flow-backend',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });
  });
});
