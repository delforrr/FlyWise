import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service.js';

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = module.get<AppService>(AppService);
  });

  it('should return "Hello World!" from getHello()', () => {
    expect(appService.getHello()).toBe('Hello World!');
  });
});
