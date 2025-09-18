import { Module } from '@nestjs/common';
import { BipsService } from './bips.service';
import { BipsController } from './bips.controller';

@Module({
  providers: [BipsService],
  controllers: [BipsController],
  exports: [BipsService],
})
export class BipsModule {}


