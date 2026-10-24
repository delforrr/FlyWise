import { Module } from '@nestjs/common';
import { AirlinesService } from './airlines.service.js';
import { AirlinesController } from './airlines.controller.js';

@Module({
  controllers: [AirlinesController],
  providers: [AirlinesService],
  exports: [AirlinesService],
})
export class AirlinesModule {}
