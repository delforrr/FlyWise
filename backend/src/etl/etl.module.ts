import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EtlService } from './etl.service';
import { EtlProcessor } from './etl.processor';
import { EtlController } from './etl.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'etl-queue',
    }),
  ],
  controllers: [EtlController],
  providers: [EtlService, EtlProcessor],
  exports: [EtlService],
})
export class EtlModule {}
